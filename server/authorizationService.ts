import { storage } from "./storage";
import { type ApiKey, type ClientUser } from "@shared/schema";
import { computeEffectiveAccountStatus, getTierCallLimit, normalizeTier, type AccountStatusSummary } from "@shared/subscription";

export type AuthDenialCode =
  | "INVALID_API_KEY"
  | "API_KEY_REVOKED"
  | "API_KEY_PAUSED"
  | "API_KEY_EXPIRED"
  | "TRIAL_EXPIRED"
  | "SUBSCRIPTION_EXPIRED"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_DEACTIVATED"
  | "QUOTA_EXCEEDED"
  | "INTERNAL_ERROR";

export type EntitlementType =
  | "admin_promoted"      // Manually granted by administrator
  | "stripe_paid"         // Active paid Stripe subscription
  | "active_trial"        // Active time-limited free trial
  | "standalone_key"      // Standalone administrative or service API key
  | "none";               // No active entitlement

export interface AuthorizationResult {
  authorized: boolean;
  statusCode: number;
  code: string;
  message: string;
  apiKeyId: string | null;
  keyOwnerId: string | null;
  entitlementType: EntitlementType;
  effectiveTier: string;
  limitReached: boolean;
  statusSummary?: AccountStatusSummary;
  user?: ClientUser;
  apiKey?: ApiKey;
}

/**
 * Authoritative helper that ensures user subscription status and API-key state are synchronized
 * with current database records and time:
 * 1. Re-fetches freshest client user record directly from storage to prevent stale in-memory state.
 * 2. Checks trial expiration against real time (Date.now()) and persists 'trial_expired' if passed.
 * 3. Computes comprehensive statusSummary (isActive, isPaidActive, isTrialExpired, etc.).
 * 4. Ensures the user's API key state matches:
 *    - If active paid, admin-promoted, or valid trial: re-activates API key (even if previously marked expired),
 *      clears stale trial expiresAt, and updates call limit to current tier limit.
 *    - If trial or subscription expired: keeps API key record marked appropriately.
 */
export async function syncClientUserSubscription(activeUser: ClientUser): Promise<{
  user: ClientUser;
  statusSummary: AccountStatusSummary;
}> {
  // Always fetch latest state from storage to avoid race conditions
  const fresh = await storage.getClientUser(activeUser.id);
  if (fresh) {
    activeUser = fresh;
  }

  const statusSummary = computeEffectiveAccountStatus({
    status: activeUser.status,
    complianceStatus: activeUser.complianceStatus,
    subscriptionStatus: activeUser.subscriptionStatus,
    subscriptionTier: activeUser.subscriptionTier,
    trialEndsAt: activeUser.trialEndsAt,
  });

  // If trial is expired in statusSummary, but user record still says 'trialing', persist to database
  if (statusSummary.isTrialExpired && activeUser.subscriptionStatus === "trialing") {
    try {
      const updated = await storage.updateClientUser(activeUser.id, {
        subscriptionStatus: "trial_expired",
        updatedAt: new Date(),
      });
      if (updated) {
        activeUser = updated;
      }
    } catch (err) {
      console.error(`[SYNC_ERROR] Failed to persist expired trial status for user ${activeUser.id}:`, err);
    }
  }

  // Ensure user has an API key linked; if missing, locate or auto-provision one
  let apiKey: ApiKey | undefined;
  if (activeUser.apiKeyId) {
    apiKey = (await storage.getApiKeyById(activeUser.apiKeyId)) || (await storage.getApiKey(activeUser.apiKeyId));
  }

  // Fallback: search by user-specific key name pattern if apiKeyId is disconnected
  if (!apiKey) {
    const allKeys = await storage.getApiKeys();
    apiKey = allKeys.find((k) =>
      k.keyName === `Trial - ${activeUser.username}` ||
      k.keyName === `User - ${activeUser.username}` ||
      k.keyName === `Trial - ${activeUser.email}`
    );
    if (apiKey && apiKey.id !== activeUser.apiKeyId) {
      try {
        const linked = await storage.updateClientUser(activeUser.id, { apiKeyId: apiKey.id, updatedAt: new Date() });
        if (linked) activeUser = linked;
      } catch (linkErr) {
        console.error(`[SYNC_ERROR] Failed to link existing API key ${apiKey.id} to user ${activeUser.id}:`, linkErr);
      }
    }
  }

  // Synchronize API key state with the user's authoritative entitlement
  if (apiKey) {
    try {
      if (statusSummary.isActive) {
        // User account is active and entitled (Active Paid, Admin Promoted, or Valid Trial)
        const isStaleExpired = apiKey.status === "expired";
        const isStaleExpiresAt = statusSummary.isPaidActive && apiKey.expiresAt !== null;
        const isStaleCallLimit = (apiKey.callLimit || 0) < statusSummary.callLimit;
        const isTrialExtended = statusSummary.isTrial && activeUser.trialEndsAt && (
          !apiKey.expiresAt || new Date(apiKey.expiresAt).getTime() !== new Date(activeUser.trialEndsAt).getTime()
        );

        if (isStaleExpired || isStaleExpiresAt || isStaleCallLimit || isTrialExtended) {
          const updatedKey = await storage.updateApiKey(apiKey.id, {
            status: "active",
            enabled: true,
            expiresAt: statusSummary.isPaidActive ? null : (activeUser.trialEndsAt ? new Date(activeUser.trialEndsAt) : null),
            callLimit: statusSummary.callLimit,
            updatedAt: new Date(),
          });
          if (updatedKey) {
            apiKey = updatedKey;
          }
          console.log(`[KEY_SYNC] Restored active API key ${apiKey.id} for user ${activeUser.username} (${activeUser.id}) [tier=${statusSummary.tier}]`);
        }
      } else {
        // User account is not active (trial expired, subscription expired, etc.)
        if (apiKey.status === "active") {
          await storage.updateApiKey(apiKey.id, {
            status: "expired",
            updatedAt: new Date(),
          });
          apiKey.status = "expired";
        }
      }
    } catch (keySyncErr) {
      console.error(`[SYNC_ERROR] Failed to synchronize API key state for user ${activeUser.id}:`, keySyncErr);
    }
  }

  return { user: activeUser, statusSummary };
}

/**
 * Determine the specific entitlement type for a user account
 */
export function getEntitlementType(user: ClientUser, statusSummary: AccountStatusSummary): EntitlementType {
  if (!statusSummary.isActive) {
    return "none";
  }

  if (statusSummary.isTrial) {
    return "active_trial";
  }

  if (statusSummary.isPaidActive) {
    // If stripeSubscriptionId is present, it's a Stripe paid customer
    if (user.stripeSubscriptionId && user.stripeSubscriptionId.trim()) {
      return "stripe_paid";
    }
    // Otherwise, an administrator manually promoted / granted active access
    return "admin_promoted";
  }

  return "none";
}

/**
 * Central Authoritative Server-Side Authorization Service
 *
 * Distinctly verifies:
 * 1. API key existence & formatting
 * 2. API key revocation / disabled status
 * 3. API key paused status
 * 4. User account existence & association
 * 5. Standalone API key support (fallback for direct admin service keys)
 * 6. User account status (active, suspended, deactivated, deleted)
 * 7. Compliance status (cleared, pending, flagged, suspended)
 * 8. Subscription / Trial / Pro entitlement
 * 9. Immediate self-healing synchronization (reactivating expired keys when an admin has promoted the user)
 * 10. Quota and rate verification
 */
export async function authorizeApiKey(rawApiKey: string | null | undefined): Promise<AuthorizationResult> {
  // Step 1: Presence & Format Check
  if (!rawApiKey || !rawApiKey.trim()) {
    return {
      authorized: false,
      statusCode: 401,
      code: "INVALID_API_KEY",
      message: "API key is required. Please provide a valid API key.",
      apiKeyId: null,
      keyOwnerId: null,
      entitlementType: "none",
      effectiveTier: "Basic",
      limitReached: false,
    };
  }

  const cleanKey = rawApiKey.trim();

  // Step 2: Database Look-up (by keyValue or by id)
  const apiKeyRecord = (await storage.getApiKey(cleanKey)) || (await storage.getApiKeyById(cleanKey));
  if (!apiKeyRecord) {
    return {
      authorized: false,
      statusCode: 401,
      code: "INVALID_API_KEY",
      message: "Invalid API key. The provided key was not found or has been deleted.",
      apiKeyId: null,
      keyOwnerId: null,
      entitlementType: "none",
      effectiveTier: "Basic",
      limitReached: false,
    };
  }

  // Step 3: Key-Level Disabled or Revoked Status
  if (apiKeyRecord.enabled === false || apiKeyRecord.status === "disabled" || apiKeyRecord.status === "revoked") {
    return {
      authorized: false,
      statusCode: 403,
      code: "API_KEY_REVOKED",
      message: "API key has been revoked or disabled by the resource owner.",
      apiKeyId: apiKeyRecord.id,
      keyOwnerId: null,
      entitlementType: "none",
      effectiveTier: "Basic",
      limitReached: true,
      apiKey: apiKeyRecord,
    };
  }

  // Step 4: Key-Level Paused Status
  if (apiKeyRecord.status === "paused") {
    return {
      authorized: false,
      statusCode: 403,
      code: "API_KEY_PAUSED",
      message: "API key is currently paused in the dashboard.",
      apiKeyId: apiKeyRecord.id,
      keyOwnerId: null,
      entitlementType: "none",
      effectiveTier: "Basic",
      limitReached: true,
      apiKey: apiKeyRecord,
    };
  }

  // Step 5: Associate with User Account (if any)
  let keyOwner = await storage.getClientUserByApiKey(apiKeyRecord.id);

  // Fallback: If not linked directly, check if key is named for a user
  if (!keyOwner) {
    const allUsers = await storage.getAllClientUsers();
    keyOwner = allUsers.find((u) =>
      apiKeyRecord.keyName === `Trial - ${u.username}` ||
      apiKeyRecord.keyName === `User - ${u.username}` ||
      apiKeyRecord.keyName === `Trial - ${u.email}` ||
      u.apiKeyId === apiKeyRecord.id ||
      u.apiKeyId === apiKeyRecord.keyValue
    );

    // If found via fallback, heal the link on the user record
    if (keyOwner && (!keyOwner.apiKeyId || keyOwner.apiKeyId !== apiKeyRecord.id)) {
      try {
        const updated = await storage.updateClientUser(keyOwner.id, { apiKeyId: apiKeyRecord.id, updatedAt: new Date() });
        if (updated) keyOwner = updated;
      } catch (err) {
        console.error(`[AUTH_SERVICE] Failed to heal apiKeyId on user ${keyOwner.id}:`, err);
      }
    }
  }

  // Step 6: Handle Standalone API Keys (e.g. Admin created service keys without a ClientUser)
  if (!keyOwner) {
    // Standalone key: Check its own expiration and call limit
    const now = new Date();
    if (apiKeyRecord.expiresAt && now > apiKeyRecord.expiresAt) {
      return {
        authorized: false,
        statusCode: 403,
        code: "API_KEY_EXPIRED",
        message: "API key has expired. Please renew or generate a new key in the dashboard.",
        apiKeyId: apiKeyRecord.id,
        keyOwnerId: null,
        entitlementType: "standalone_key",
        effectiveTier: "Enterprise",
        limitReached: true,
        apiKey: apiKeyRecord,
      };
    }

    if (apiKeyRecord.callLimit > 0 && apiKeyRecord.callCount >= apiKeyRecord.callLimit) {
      return {
        authorized: false,
        statusCode: 429,
        code: "QUOTA_EXCEEDED",
        message: "API key call limit has been reached.",
        apiKeyId: apiKeyRecord.id,
        keyOwnerId: null,
        entitlementType: "standalone_key",
        effectiveTier: "Enterprise",
        limitReached: true,
        apiKey: apiKeyRecord,
      };
    }

    // Standalone key is valid!
    return {
      authorized: true,
      statusCode: 200,
      code: "OK",
      message: "Authorized",
      apiKeyId: apiKeyRecord.id,
      keyOwnerId: null,
      entitlementType: "standalone_key",
      effectiveTier: "Enterprise",
      limitReached: false,
      apiKey: apiKeyRecord,
    };
  }

  // Step 7: Account-Level Checks
  if (keyOwner.status === "suspended" || keyOwner.complianceStatus === "suspended") {
    return {
      authorized: false,
      statusCode: 403,
      code: "ACCOUNT_SUSPENDED",
      message: "Account has been suspended. Please contact support.",
      apiKeyId: apiKeyRecord.id,
      keyOwnerId: keyOwner.id,
      entitlementType: "none",
      effectiveTier: normalizeTier(keyOwner.subscriptionTier),
      limitReached: true,
      user: keyOwner,
      apiKey: apiKeyRecord,
    };
  }

  if (keyOwner.status === "inactive" || keyOwner.status === "deactivated" || keyOwner.status === "deleted") {
    return {
      authorized: false,
      statusCode: 403,
      code: "ACCOUNT_DEACTIVATED",
      message: "Account has been deactivated. Please contact support.",
      apiKeyId: apiKeyRecord.id,
      keyOwnerId: keyOwner.id,
      entitlementType: "none",
      effectiveTier: normalizeTier(keyOwner.subscriptionTier),
      limitReached: true,
      user: keyOwner,
      apiKey: apiKeyRecord,
    };
  }

  // Step 8: Compute Authoritative Entitlement & Perform Self-Healing Sync
  const { user: syncedUser, statusSummary } = await syncClientUserSubscription(keyOwner);
  const entitlementType = getEntitlementType(syncedUser, statusSummary);

  // Step 9: Evaluate Entitlement
  if (!statusSummary.isActive) {
    // Determine the exact specific reason for denial
    if (statusSummary.isTrialExpired) {
      return {
        authorized: false,
        statusCode: 403,
        code: "TRIAL_EXPIRED",
        message: "Your free trial has ended. Please upgrade your subscription in the dashboard to resume API calls.",
        apiKeyId: apiKeyRecord.id,
        keyOwnerId: syncedUser.id,
        entitlementType: "none",
        effectiveTier: statusSummary.tier,
        limitReached: true,
        statusSummary,
        user: syncedUser,
        apiKey: apiKeyRecord,
      };
    }

    if (statusSummary.isPaidExpired || statusSummary.isCancelled || statusSummary.status === "past_due") {
      return {
        authorized: false,
        statusCode: 403,
        code: "SUBSCRIPTION_EXPIRED",
        message: statusSummary.rejectionReason || "Subscription is inactive. Please renew your subscription in the dashboard to resume API calls.",
        apiKeyId: apiKeyRecord.id,
        keyOwnerId: syncedUser.id,
        entitlementType: "none",
        effectiveTier: statusSummary.tier,
        limitReached: true,
        statusSummary,
        user: syncedUser,
        apiKey: apiKeyRecord,
      };
    }

    return {
      authorized: false,
      statusCode: 403,
      code: "SUBSCRIPTION_EXPIRED",
      message: statusSummary.rejectionReason || "Account subscription is inactive. Please upgrade or renew your subscription in the dashboard to resume API calls.",
      apiKeyId: apiKeyRecord.id,
      keyOwnerId: syncedUser.id,
      entitlementType: "none",
      effectiveTier: statusSummary.tier,
      limitReached: true,
      statusSummary,
      user: syncedUser,
      apiKey: apiKeyRecord,
    };
  }

  // Step 10: User is Active & Entitled! Ensure API Key in memory is marked active
  if (apiKeyRecord.status === "expired") {
    apiKeyRecord.status = "active";
    apiKeyRecord.expiresAt = statusSummary.isPaidActive ? null : (syncedUser.trialEndsAt ? new Date(syncedUser.trialEndsAt) : null);
  }

  // Step 11: Increment usage quota (without destructive expiry overrides)
  let limitReached = false;
  try {
    const usageAllowed = await storage.incrementApiKeyUsage(apiKeyRecord.keyValue);
    if (!usageAllowed) {
      limitReached = true;
    }
  } catch (usageErr) {
    console.error("[AUTH_SERVICE] Usage increment error:", usageErr);
  }

  return {
    authorized: true,
    statusCode: 200,
    code: "OK",
    message: "Authorized",
    apiKeyId: apiKeyRecord.id,
    keyOwnerId: syncedUser.id,
    entitlementType,
    effectiveTier: statusSummary.tier,
    limitReached,
    statusSummary,
    user: syncedUser,
    apiKey: apiKeyRecord,
  };
}
