export type SubscriptionStatus =
  | 'trialing'
  | 'trial_expired'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'suspended'
  | 'deactivated'
  | 'expired';

export type SubscriptionTier = 'Basic' | 'Pro' | 'Premium' | 'Enterprise';

export interface AccountStatusSummary {
  status: SubscriptionStatus;
  statusLabel: string;
  tier: SubscriptionTier;
  tierLabel: string;
  isActive: boolean;
  isTrial: boolean;
  isTrialExpired: boolean;
  isExpiringSoon: boolean;
  isPaidActive: boolean;
  isPaidExpired: boolean;
  isCancelled: boolean;
  isSuspended: boolean;
  isDeactivated: boolean;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  subscriptionEndsAt: string | null;
  callLimit: number;
  notification: {
    type: 'trial_expired' | 'trial_expiring_soon' | 'active_tier';
    title: string;
    message: string;
  } | null;
  rejectionReason?: string;
}

/**
 * Standard call limit by subscription tier
 */
export function getTierCallLimit(tier?: SubscriptionTier | string | null): number {
  const clean = (tier || 'Pro').trim().toLowerCase();
  if (clean === 'basic') return 50000;
  if (clean === 'pro') return 250000;
  if (clean === 'premium') return 1000000;
  if (clean === 'enterprise') return 10000000; // Effectively unlimited
  return 250000;
}

/**
 * Normalize and capitalize tier name
 */
export function normalizeTier(tier?: string | null): SubscriptionTier {
  if (!tier) return 'Pro';
  const clean = tier.trim().toLowerCase();
  if (clean === 'basic') return 'Basic';
  if (clean === 'pro') return 'Pro';
  if (clean === 'premium') return 'Premium';
  if (clean === 'enterprise') return 'Enterprise';
  // Capitalize first letter if custom
  return (tier.charAt(0).toUpperCase() + tier.slice(1)) as SubscriptionTier;
}

/**
 * Authoritative single source of truth for account status computation.
 * Evaluates subscription status and trial dates against current time.
 */
export function computeEffectiveAccountStatus(user: {
  status?: string | null;
  complianceStatus?: string | null;
  subscriptionStatus?: string | null;
  subscriptionTier?: string | null;
  trialEndsAt?: Date | string | null;
  subscriptionEndsAt?: Date | string | null;
  currentPeriodEnd?: Date | string | null;
  cancelAtPeriodEnd?: boolean | null;
}): AccountStatusSummary {
  const now = new Date();
  const rawStatus = (user.subscriptionStatus || 'trialing').toLowerCase().trim();
  const userStatus = (user.status || 'active').toLowerCase().trim();
  const complianceStatus = (user.complianceStatus || 'cleared').toLowerCase().trim();
  const tier = normalizeTier(user.subscriptionTier);
  const tierCallLimit = getTierCallLimit(tier);

  // 1. ACCOUNT SUSPENDED (Account level or Compliance level)
  if (userStatus === 'suspended' || complianceStatus === 'suspended') {
    return {
      status: 'suspended',
      statusLabel: 'Suspended',
      tier,
      tierLabel: `${tier} Tier`,
      isActive: false,
      isTrial: false,
      isTrialExpired: false,
      isExpiringSoon: false,
      isPaidActive: false,
      isPaidExpired: false,
      isCancelled: false,
      isSuspended: true,
      isDeactivated: false,
      trialEndsAt: null,
      trialDaysRemaining: null,
      subscriptionEndsAt: null,
      callLimit: 0,
      notification: null,
      rejectionReason: 'Account has been suspended. Please contact support.',
    };
  }

  // 2. ACCOUNT DEACTIVATED / DELETED / INACTIVE
  if (userStatus === 'inactive' || userStatus === 'deactivated' || userStatus === 'deleted') {
    return {
      status: 'deactivated',
      statusLabel: 'Deactivated',
      tier,
      tierLabel: `${tier} Tier`,
      isActive: false,
      isTrial: false,
      isTrialExpired: false,
      isExpiringSoon: false,
      isPaidActive: false,
      isPaidExpired: false,
      isCancelled: false,
      isSuspended: false,
      isDeactivated: true,
      trialEndsAt: null,
      trialDaysRemaining: null,
      subscriptionEndsAt: null,
      callLimit: 0,
      notification: null,
      rejectionReason: 'Account has been deactivated. Please contact support.',
    };
  }

  // Parse potential subscription end date (for paid subscriptions)
  const rawSubEnd = user.subscriptionEndsAt || user.currentPeriodEnd;
  let subEndDate: Date | null = null;
  if (rawSubEnd) {
    subEndDate = rawSubEnd instanceof Date ? rawSubEnd : new Date(rawSubEnd);
    if (isNaN(subEndDate.getTime())) subEndDate = null;
  }

  let trialDate: Date | null = null;
  if (user.trialEndsAt) {
    trialDate = user.trialEndsAt instanceof Date ? user.trialEndsAt : new Date(user.trialEndsAt);
    if (isNaN(trialDate.getTime())) {
      trialDate = null;
    }
  }

  // Calculate trial days remaining (0 if past)
  let trialDaysRemaining: number | null = null;
  let hasTrialExpiredByDate = false;

  if (trialDate) {
    const diffMs = trialDate.getTime() - now.getTime();
    if (diffMs <= 0) {
      trialDaysRemaining = 0;
      hasTrialExpiredByDate = true;
    } else {
      trialDaysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }
  } else if (rawStatus === 'trialing') {
    // If no trial end date set but status is trialing, provide standard 14-day window rather than immediate expiry
    trialDaysRemaining = 14;
    hasTrialExpiredByDate = false;
  }

  // 3. ACTIVE PAID SUBSCRIPTION (Upgraded by user or administrator)
  if (rawStatus === 'active') {
    // Check if paid subscription had an explicit period end that has already passed
    if (subEndDate && subEndDate.getTime() <= now.getTime()) {
      return {
        status: 'past_due',
        statusLabel: 'Subscription Expired',
        tier,
        tierLabel: `${tier} Tier`,
        isActive: false,
        isTrial: false,
        isTrialExpired: false,
        isExpiringSoon: false,
        isPaidActive: false,
        isPaidExpired: true,
        isCancelled: false,
        isSuspended: false,
        isDeactivated: false,
        trialEndsAt: null,
        trialDaysRemaining: null,
        subscriptionEndsAt: subEndDate.toISOString(),
        callLimit: tierCallLimit,
        notification: {
          type: 'trial_expired',
          title: 'Paid Subscription Expired',
          message: 'Your paid subscription has expired. Please renew your subscription in the dashboard to resume API calls.',
        },
        rejectionReason: 'Paid subscription has expired. Please renew your subscription in the dashboard to resume API calls.',
      };
    }

    return {
      status: 'active',
      statusLabel: 'Active',
      tier,
      tierLabel: `${tier} Tier`,
      isActive: true,
      isTrial: false,
      isTrialExpired: false,
      isExpiringSoon: false,
      isPaidActive: true,
      isPaidExpired: false,
      isCancelled: false,
      isSuspended: false,
      isDeactivated: false,
      trialEndsAt: trialDate ? trialDate.toISOString() : null,
      trialDaysRemaining: null,
      subscriptionEndsAt: subEndDate ? subEndDate.toISOString() : null,
      callLimit: tierCallLimit,
      notification: null, // No trial notification once upgraded
    };
  }

  // 4. CANCELLED SUBSCRIPTION
  if (rawStatus === 'cancelled') {
    // Determine whether access remains active until the end of the paid billing period
    const hasRemainingPaidPeriod = subEndDate !== null && subEndDate.getTime() > now.getTime();
    if (hasRemainingPaidPeriod && subEndDate) {
      return {
        status: 'cancelled',
        statusLabel: `Cancelled (Active until ${subEndDate.toLocaleDateString()})`,
        tier,
        tierLabel: `${tier} Tier`,
        isActive: true, // Still active until billing cycle concludes
        isTrial: false,
        isTrialExpired: false,
        isExpiringSoon: false,
        isPaidActive: true,
        isPaidExpired: false,
        isCancelled: true,
        isSuspended: false,
        isDeactivated: false,
        trialEndsAt: null,
        trialDaysRemaining: null,
        subscriptionEndsAt: subEndDate.toISOString(),
        callLimit: tierCallLimit,
        notification: null,
      };
    }

    return {
      status: 'cancelled',
      statusLabel: 'Subscription Cancelled',
      tier,
      tierLabel: `${tier} Tier`,
      isActive: false,
      isTrial: false,
      isTrialExpired: false,
      isExpiringSoon: false,
      isPaidActive: false,
      isPaidExpired: false,
      isCancelled: true,
      isSuspended: false,
      isDeactivated: false,
      trialEndsAt: null,
      trialDaysRemaining: null,
      subscriptionEndsAt: subEndDate ? subEndDate.toISOString() : null,
      callLimit: 0,
      notification: {
        type: 'trial_expired',
        title: 'Subscription Cancelled',
        message: 'Your subscription has been cancelled. Please reactivate your subscription in the dashboard to resume API calls.',
      },
      rejectionReason: 'Subscription has been cancelled. Please reactivate your subscription in the dashboard to resume API calls.',
    };
  }

  // 5. PAST DUE / UNPAID / EXPIRED PAID SUBSCRIPTION
  if (rawStatus === 'past_due' || rawStatus === 'unpaid' || rawStatus === 'expired') {
    return {
      status: 'past_due',
      statusLabel: 'Subscription Expired',
      tier,
      tierLabel: `${tier} Tier`,
      isActive: false,
      isTrial: false,
      isTrialExpired: false,
      isExpiringSoon: false,
      isPaidActive: false,
      isPaidExpired: true,
      isCancelled: false,
      isSuspended: false,
      isDeactivated: false,
      trialEndsAt: null,
      trialDaysRemaining: null,
      subscriptionEndsAt: subEndDate ? subEndDate.toISOString() : null,
      callLimit: tierCallLimit,
      notification: {
        type: 'trial_expired',
        title: 'Subscription Expired',
        message: 'Your paid subscription has expired. Please renew your subscription in the dashboard to resume API calls.',
      },
      rejectionReason: 'Paid subscription has expired. Please renew your subscription in the dashboard to resume API calls.',
    };
  }

  // 6. TRIAL EXPIRED (Explicit status or trial end date has passed)
  if (rawStatus === 'trial_expired' || (rawStatus === 'trialing' && hasTrialExpiredByDate)) {
    return {
      status: 'trial_expired',
      statusLabel: 'Trial Expired',
      tier,
      tierLabel: 'Trial Expired',
      isActive: false,
      isTrial: false,
      isTrialExpired: true,
      isExpiringSoon: false,
      isPaidActive: false,
      isPaidExpired: false,
      isCancelled: false,
      isSuspended: false,
      isDeactivated: false,
      trialEndsAt: trialDate ? trialDate.toISOString() : null,
      trialDaysRemaining: 0,
      subscriptionEndsAt: null,
      callLimit: 5000,
      notification: {
        type: 'trial_expired',
        title: 'Your trial has expired.',
        message: 'Your trial period has ended. Upgrade to continue classifying traffic without interruption.',
      },
      rejectionReason: 'API key has expired. Please renew your subscription in the dashboard.',
    };
  }

  // 7. ACTIVE TRIAL (Trialing with future end date)
  if (rawStatus === 'trialing') {
    const daysLeft = trialDaysRemaining ?? 0;
    const isExpiringSoon = daysLeft <= 3 && daysLeft > 0;

    return {
      status: 'trialing',
      statusLabel: 'Trialing',
      tier,
      tierLabel: 'Free Trial',
      isActive: true,
      isTrial: true,
      isTrialExpired: false,
      isExpiringSoon,
      isPaidActive: false,
      isPaidExpired: false,
      isCancelled: false,
      isSuspended: false,
      isDeactivated: false,
      trialEndsAt: trialDate ? trialDate.toISOString() : null,
      trialDaysRemaining: daysLeft,
      subscriptionEndsAt: null,
      callLimit: 5000,
      notification: isExpiringSoon
        ? {
            type: 'trial_expiring_soon',
            title: 'Your trial is expiring soon.',
            message: `You have ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining on your trial. Upgrade now to avoid service interruption.`,
          }
        : null,
    };
  }

  // Fallback default (inactive)
  return {
    status: 'trial_expired',
    statusLabel: 'Inactive',
    tier,
    tierLabel: `${tier} Tier`,
    isActive: false,
    isTrial: false,
    isTrialExpired: true,
    isExpiringSoon: false,
    isPaidActive: false,
    isPaidExpired: false,
    isCancelled: false,
    isSuspended: false,
    isDeactivated: false,
    trialEndsAt: trialDate ? trialDate.toISOString() : null,
    trialDaysRemaining: null,
    subscriptionEndsAt: null,
    callLimit: 0,
    notification: null,
    rejectionReason: 'Account subscription is inactive. Please upgrade or renew your subscription in the dashboard to resume API calls.',
  };
}
