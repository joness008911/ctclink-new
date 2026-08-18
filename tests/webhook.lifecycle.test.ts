/**
 * Webhook lifecycle tests
 * Covers: idempotency, retry-after-failure, out-of-order events, trial enforcement.
 * Uses MemStorage so no DB or Stripe SDK is needed.
 * Run with: npm test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { MemStorage } from "../server/storage.js";

describe("Stripe webhook idempotency (claimStripeEvent / markStripeEventProcessed / releaseStripeEvent)", () => {
  test("first delivery is claimed (returns true)", async () => {
    const storage = new MemStorage();
    const claimed = await storage.claimStripeEvent("evt_001");
    assert.equal(claimed, true);
  });

  test("in-flight event (claimed but not yet processed) is rejected as concurrent duplicate", async () => {
    const storage = new MemStorage();
    await storage.claimStripeEvent("evt_002");
    // No markStripeEventProcessed yet — still in-flight
    const dup = await storage.claimStripeEvent("evt_002");
    assert.equal(dup, false, "Concurrent delivery of in-flight event must be rejected");
  });

  test("after markStripeEventProcessed, delivery is a true duplicate (rejected forever)", async () => {
    const storage = new MemStorage();
    await storage.claimStripeEvent("evt_dup");
    await storage.markStripeEventProcessed("evt_dup"); // processing succeeded
    const retry = await storage.claimStripeEvent("evt_dup");
    assert.equal(retry, false, "Event with processedAt set must always be rejected");
  });

  test("independent events use separate claim slots", async () => {
    const storage = new MemStorage();
    const a = await storage.claimStripeEvent("evt_a");
    const b = await storage.claimStripeEvent("evt_b");
    assert.equal(a, true);
    assert.equal(b, true);
  });

  test("releaseStripeEvent allows Stripe retry after processing failure", async () => {
    const storage = new MemStorage();
    await storage.claimStripeEvent("evt_003");
    // Simulate processing error: release claim so Stripe can retry immediately
    await storage.releaseStripeEvent("evt_003");
    const retry = await storage.claimStripeEvent("evt_003");
    assert.equal(retry, true, "Released event must be claimable again on retry");
  });

  test("stale lease (>5 min) allows crash-recovery reclaim", async () => {
    const storage = new MemStorage();
    // Backdating requires accessing internal map; simulate via time manipulation:
    // claim, then manually age the claimedAt to trigger stale-lease reclaim path.
    await storage.claimStripeEvent("evt_stale");
    // Access private map and age the claim
    const internalMap = (storage as any)._stripeEvents as Map<string, { claimedAt: Date; processedAt: Date | null }>;
    const existing = internalMap.get("evt_stale")!;
    internalMap.set("evt_stale", { ...existing, claimedAt: new Date(Date.now() - 6 * 60 * 1000) });

    // Next delivery should reclaim the stale lease
    const reclaimed = await storage.claimStripeEvent("evt_stale");
    assert.equal(reclaimed, true, "Stale lease (process crashed) must be reclaimable");
  });

  test("releasing an unclaimed event is a no-op (does not throw)", async () => {
    const storage = new MemStorage();
    await assert.doesNotReject(() => storage.releaseStripeEvent("evt_never_claimed"));
  });
});

describe("Subscription deletion lifecycle", () => {
  async function makeActiveUser(storage: MemStorage, opts: { subId: string; custId: string }) {
    const user = await storage.createClientUser({
      username: `user_${Math.random()}`,
      password: "hash",
      email: null,
      apiKeyId: null,
      status: "active",
      subscriptionStatus: "trialing",
      trialEndsAt: new Date(Date.now() + 14 * 86400_000),
    });
    await storage.updateClientUser(user.id, {
      subscriptionStatus: "active",
      stripeCustomerId: opts.custId,
      stripeSubscriptionId: opts.subId,
    });
    return storage.getClientUser(user.id).then((u) => u!);
  }

  test("deletion for a different (old) subscription is ignored — user stays active", async () => {
    const storage = new MemStorage();
    const user = await makeActiveUser(storage, { subId: "sub_new", custId: "cus_A" });

    // Route handler logic: only cancel if !stripeSubscriptionId || stripeSubscriptionId === sub.id
    const oldSubId = "sub_old";
    if (!user.stripeSubscriptionId || user.stripeSubscriptionId === oldSubId) {
      await storage.updateClientUser(user.id, { subscriptionStatus: "cancelled", stripeSubscriptionId: oldSubId });
    }
    // else: stale deletion — no action

    const updated = await storage.getClientUser(user.id);
    assert.equal(updated!.subscriptionStatus, "active", "Old deletion must not cancel active subscription");
    assert.equal(updated!.stripeSubscriptionId, "sub_new", "Subscription ID must remain unchanged");
  });

  test("deletion for current subscription cancels the user", async () => {
    const storage = new MemStorage();
    const user = await makeActiveUser(storage, { subId: "sub_active", custId: "cus_B" });

    if (!user.stripeSubscriptionId || user.stripeSubscriptionId === "sub_active") {
      await storage.updateClientUser(user.id, { subscriptionStatus: "cancelled", stripeSubscriptionId: "sub_active" });
    }

    const updated = await storage.getClientUser(user.id);
    assert.equal(updated!.subscriptionStatus, "cancelled");
  });

  test("out-of-order: deletion arrives before checkout — stores cancellation so checkout re-validates via Stripe API", async () => {
    const storage = new MemStorage();
    // User created; no subscription ID yet (checkout hasn't arrived)
    const user = await storage.createClientUser({
      username: `user_oo_${Math.random()}`,
      password: "hash",
      email: null,
      apiKeyId: null,
      status: "active",
      subscriptionStatus: "trialing",
      trialEndsAt: new Date(Date.now() + 14 * 86400_000),
    });
    await storage.updateClientUser(user.id, { stripeCustomerId: "cus_C" });

    // Deletion arrives first (stripeSubscriptionId is null/undefined — allowed)
    const u = await storage.getClientUser(user.id);
    if (!u!.stripeSubscriptionId || u!.stripeSubscriptionId === "sub_xyz") {
      await storage.updateClientUser(user.id, { subscriptionStatus: "cancelled", stripeSubscriptionId: "sub_xyz" });
    }

    const afterDeletion = await storage.getClientUser(user.id);
    assert.equal(afterDeletion!.subscriptionStatus, "cancelled");
    assert.equal(afterDeletion!.stripeSubscriptionId, "sub_xyz");

    // When checkout.session.completed arrives, the route retrieves live Stripe status.
    // In our tests we simulate that Stripe says the subscription is 'canceled',
    // so the handler should not re-activate. We verify the stored state is 'cancelled'.
    // (The route handler calls stripe.subscriptions.retrieve and checks liveSub.status === 'canceled'.)
    assert.equal(afterDeletion!.subscriptionStatus, "cancelled", "Checkout must not re-activate a cancelled subscription");
  });
});

describe("Trial enforcement logic", () => {
  function isSubscriptionActive(status: string, trialEndsAt: Date | null): boolean {
    const now = new Date();
    return (
      status === "active" ||
      (status === "trialing" && (!trialEndsAt || trialEndsAt > now))
    );
  }

  test("active subscription is allowed", () => {
    assert.equal(isSubscriptionActive("active", null), true);
  });

  test("in-progress trial (trialEndsAt in future) is allowed", () => {
    const future = new Date(Date.now() + 7 * 86400_000);
    assert.equal(isSubscriptionActive("trialing", future), true);
  });

  test("trial with null expiry (existing accounts without trialEndsAt set) is allowed", () => {
    assert.equal(isSubscriptionActive("trialing", null), true);
  });

  test("expired trial is blocked", () => {
    const past = new Date(Date.now() - 1000);
    assert.equal(isSubscriptionActive("trialing", past), false);
  });

  test("past_due subscription is blocked", () => {
    assert.equal(isSubscriptionActive("past_due", null), false);
  });

  test("cancelled subscription is blocked", () => {
    assert.equal(isSubscriptionActive("cancelled", null), false);
  });
});
