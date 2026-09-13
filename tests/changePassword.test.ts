import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

const BASE_URL = "http://localhost:3000";

describe("User Change Password Security & Verification Flow", () => {
  let clientToken: string;
  let clientEmail: string;
  const initialPassword = "SecureOldPassword123!";
  const newValidPassword = "BrandNewSecurePassword456$";
  let adminToken: string;

  before(async () => {
    // Wait for server to be responsive
    for (let i = 0; i < 30; i++) {
      try {
        const ping = await fetch(`${BASE_URL}/api/user/health-check`).catch(() => fetch(`${BASE_URL}/`));
        if (ping) break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // 1. Obtain admin token to inspect email logs
    const adminLoginRes = await fetch(`${BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" }),
    });
    if (adminLoginRes.status === 200) {
      const adminData = await adminLoginRes.json();
      adminToken = adminData.token;
    }

    // 2. Register a new user for password testing
    clientEmail = `pwd_test_${Date.now()}@example.com`;
    const regRes = await fetch(`${BASE_URL}/api/user/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: clientEmail,
        password: initialPassword,
        tosAccepted: true,
      }),
    });
    assert.ok(regRes.status === 200 || regRes.status === 201, `User registration should succeed (got ${regRes.status})`);

    // 3. Login to get initial client session token
    const loginRes = await fetch(`${BASE_URL}/api/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: clientEmail, password: initialPassword }),
    });
    assert.equal(loginRes.status, 200, "Client login should succeed");
    const loginData = await loginRes.json();
    clientToken = loginData.token;
    assert.ok(clientToken, "Client token must be present");
  });

  after(() => {
    setTimeout(() => process.exit(0), 100).unref();
  });

  it("1. Unauthenticated requests are rejected with 401", async () => {
    const res = await fetch(`${BASE_URL}/api/user/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: initialPassword,
        newPassword: newValidPassword,
        confirmPassword: newValidPassword,
      }),
    });
    assert.equal(res.status, 401, "Unauthenticated request should return 401");
  });

  it("2. Rejects request when current password is incorrect (does NOT update password)", async () => {
    const res = await fetch(`${BASE_URL}/api/user/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${clientToken}`,
      },
      body: JSON.stringify({
        currentPassword: "CompletelyWrongPassword999!",
        newPassword: newValidPassword,
        confirmPassword: newValidPassword,
      }),
    });

    assert.equal(res.status, 401, "Wrong current password should return 401");
    const body = await res.json();
    assert.match(body.message, /Current password is incorrect/i);

    // Verify user can still login with initial password
    const verifyRes = await fetch(`${BASE_URL}/api/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: clientEmail, password: initialPassword }),
    });
    assert.equal(verifyRes.status, 200, "Initial password must still work because change failed");
  });

  it("3. PREVENTS PASSWORD REUSE: Rejects when new password is identical to current password", async () => {
    const res = await fetch(`${BASE_URL}/api/user/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${clientToken}`,
      },
      body: JSON.stringify({
        currentPassword: initialPassword,
        newPassword: initialPassword,
        confirmPassword: initialPassword,
      }),
    });

    assert.equal(res.status, 400, "Reused password must return 400 Bad Request");
    const body = await res.json();
    assert.match(
      body.message || JSON.stringify(body),
      /Your new password must be different from your current password/i
    );
  });

  it("4. Rejects when new password and confirm password do not match", async () => {
    const res = await fetch(`${BASE_URL}/api/user/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${clientToken}`,
      },
      body: JSON.stringify({
        currentPassword: initialPassword,
        newPassword: newValidPassword,
        confirmPassword: "DifferentConfirmationPassword456$",
      }),
    });

    assert.equal(res.status, 400, "Mismatched confirmation password must return 400");
    const body = await res.json();
    assert.match(
      body.message || JSON.stringify(body),
      /do not match/i
    );
  });

  it("5. Rejects when new password does not meet complexity requirements", async () => {
    // Too short (< 8 chars)
    const shortRes = await fetch(`${BASE_URL}/api/user/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${clientToken}`,
      },
      body: JSON.stringify({
        currentPassword: initialPassword,
        newPassword: "Aa1!",
        confirmPassword: "Aa1!",
      }),
    });
    assert.equal(shortRes.status, 400, "Too short password must return 400");

    // All lowercase (no uppercase)
    const noUpperRes = await fetch(`${BASE_URL}/api/user/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${clientToken}`,
      },
      body: JSON.stringify({
        currentPassword: initialPassword,
        newPassword: "alllowercasepassword123!",
        confirmPassword: "alllowercasepassword123!",
      }),
    });
    assert.equal(noUpperRes.status, 400, "Missing uppercase must return 400");
  });

  it("6. Successfully updates password when all requirements are satisfied", async () => {
    const oldToken = clientToken;

    const res = await fetch(`${BASE_URL}/api/user/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${oldToken}`,
      },
      body: JSON.stringify({
        currentPassword: initialPassword,
        newPassword: newValidPassword,
        confirmPassword: newValidPassword,
      }),
    });

    assert.equal(res.status, 200, "Valid password change must succeed with 200 OK");
    const body = await res.json();
    assert.equal(body.success, true);
    assert.match(body.message, /Password changed successfully/i);
    assert.ok(body.token, "A fresh replacement token should be issued");

    const freshToken = body.token;

    // Verify old session token was revoked
    const oldTokenRes = await fetch(`${BASE_URL}/api/user/me`, {
      headers: { Authorization: `Bearer ${oldToken}` },
    });
    assert.equal(oldTokenRes.status, 401, "Previous session token must be revoked and return 401");

    // Verify fresh token works
    const freshTokenRes = await fetch(`${BASE_URL}/api/user/me`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    });
    assert.equal(freshTokenRes.status, 200, "Fresh session token must be accepted");

    // Verify login with old password fails
    const oldLoginRes = await fetch(`${BASE_URL}/api/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: clientEmail, password: initialPassword }),
    });
    assert.equal(oldLoginRes.status, 401, "Old password must no longer authenticate");

    // Verify login with new password succeeds
    const newLoginRes = await fetch(`${BASE_URL}/api/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: clientEmail, password: newValidPassword }),
    });
    assert.equal(newLoginRes.status, 200, "New password must authenticate successfully");

    // Update clientToken to freshToken for subsequent assertions
    clientToken = freshToken;
  });

  it("7. PREVENTS PASSWORD REUSE AGAINST DB HASH: Rejects changing back to the same password", async () => {
    // Attempt to set the password to the current one again (newValidPassword)
    const reuseRes = await fetch(`${BASE_URL}/api/user/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${clientToken}`,
      },
      body: JSON.stringify({
        currentPassword: newValidPassword,
        newPassword: newValidPassword,
        confirmPassword: newValidPassword,
      }),
    });

    assert.equal(reuseRes.status, 400, "Attempting to change to current password must be rejected");
    const body = await reuseRes.json();
    assert.match(
      body.message || JSON.stringify(body),
      /Your new password must be different from your current password/i
    );
  });

  it("8. Security notification email is logged / dispatched", async () => {
    if (!adminToken) return;

    // Check email logs as admin
    const emailLogsRes = await fetch(`${BASE_URL}/api/interface/email/logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (emailLogsRes.status === 200) {
      const data = await emailLogsRes.json();
      const logs = data.logs || data;
      const passwordChangedEmail = logs.find(
        (log: any) =>
          log.to === clientEmail &&
          (log.templateType === "password_changed" || /password/i.test(log.subject))
      );
      assert.ok(
        passwordChangedEmail,
        `Expected a password change security email to be dispatched to ${clientEmail}`
      );
    }
  });
});
