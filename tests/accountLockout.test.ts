import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import {
  recordFailedLogin,
  recordSuccessfulLogin,
  isAccountLocked,
  isIpLocked,
  getLockoutStatus,
} from "../server/accountLockout.js";

describe("Account Lockout and Brute-Force Protection", () => {
  const testAccount = "security_test_user@example.com";
  const testIp = "192.0.2.100";

  after(() => {
    // Terminate process cleanly to release any background Firestore channels
    setTimeout(() => process.exit(0), 100).unref();
  });

  beforeEach(() => {
    // Reset by recording a successful login
    recordSuccessfulLogin(testAccount, testIp);
  });

  it("should start in unlocked state", () => {
    const status = isAccountLocked(testAccount);
    assert.equal(status.isLocked, false);
    assert.equal(status.remainingSeconds, 0);
  });

  it("should record failed attempts and lock out after threshold", () => {
    // Attempts 1 to 4 should not lock
    for (let i = 1; i <= 4; i++) {
      const res = recordFailedLogin(testAccount, testIp);
      assert.equal(res.isLocked, false);
      assert.equal(res.remainingAttempts, 5 - i);
    }

    // Attempt 5 triggers lockout
    const fifth = recordFailedLogin(testAccount, testIp);
    assert.equal(fifth.isLocked, true);
    assert.equal(fifth.remainingAttempts, 0);
    assert.ok(fifth.remainingSeconds > 0);

    // Verify account is now reported as locked
    const check = isAccountLocked(testAccount);
    assert.equal(check.isLocked, true);
    assert.ok(check.remainingSeconds > 0);
  });

  it("should reset failed attempts upon successful login", () => {
    // 3 failed attempts
    recordFailedLogin(testAccount, testIp);
    recordFailedLogin(testAccount, testIp);
    recordFailedLogin(testAccount, testIp);

    // Successful login resets
    recordSuccessfulLogin(testAccount, testIp);

    const status = isAccountLocked(testAccount);
    assert.equal(status.isLocked, false);

    // Next failure should start from attempt 1 (4 remaining)
    const nextFailure = recordFailedLogin(testAccount, testIp);
    assert.equal(nextFailure.remainingAttempts, 4);
  });

  it("should report accurate status in getLockoutStatus", () => {
    const status = getLockoutStatus(testAccount);
    assert.ok(typeof status.attempts === "number");
    assert.ok(typeof status.isLocked === "boolean");
  });
});
