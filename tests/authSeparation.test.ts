import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:3000";

describe("User vs Administrator Authentication & Authorization Separation", () => {
  let adminToken: string;
  let clientToken: string;
  let clientEmail: string;
  let clientPassword = "TestPassword123!";
  let clientApiKeyId: string;

  before(async () => {
    // 1. Authenticate as Admin
    const adminLoginRes = await fetch(`${BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" }),
    });
    assert.equal(adminLoginRes.status, 200, "Admin login should succeed");
    const adminData = await adminLoginRes.json();
    adminToken = adminData.token;
    assert.ok(adminToken.startsWith("adm_tok_"), "Admin token should have adm_tok_ prefix");

    // 2. Register & Login as Normal User
    clientEmail = `sec_user_${Date.now()}@example.com`;
    const clientRegRes = await fetch(`${BASE_URL}/api/user/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: clientEmail,
        password: clientPassword,
        tosAccepted: true,
      }),
    });
    assert.ok(clientRegRes.status === 200 || clientRegRes.status === 201, `User registration should succeed (got ${clientRegRes.status})`);

    const clientLoginRes = await fetch(`${BASE_URL}/api/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: clientEmail, password: clientPassword }),
    });
    assert.equal(clientLoginRes.status, 200, "Client login should succeed");
    const clientData = await clientLoginRes.json();
    clientToken = clientData.token;
    assert.ok(clientToken.startsWith("ct_cli_"), "Client token should have ct_cli_ prefix");
    clientApiKeyId = clientData.apiKey?.id || clientData.user?.apiKeyId || "";
  });

  after(() => {
    // Terminate process cleanly
    setTimeout(() => process.exit(0), 100).unref();
  });

  // Scenario 1: Normal user → /user
  it("Scenario 1: Normal user → /user: Allowed to access user dashboard & /api/user/me", async () => {
    const res = await fetch(`${BASE_URL}/api/user/me`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    assert.equal(res.status, 200, "Normal user should be authorized to access /api/user/me");
    const data = await res.json();
    assert.equal(data.email, clientEmail);
    assert.equal(data.status, "active");
  });

  // Scenario 2: Normal user → /interface
  it("Scenario 2: Normal user → /interface: Denied from admin authentication validation", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/user`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    assert.equal(res.status, 401, "Normal user should be rejected with 401 on /api/auth/user");
    const data = await res.json();
    assert.match(data.message, /admin access required/i);
  });

  // Scenario 3: Normal user → admin API
  it("Scenario 3: Normal user → admin API: Denied access with 401/403", async () => {
    // Attempting to access admin client-users listing
    const resUsers = await fetch(`${BASE_URL}/api/interface/client-users`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    assert.equal(resUsers.status, 401, "Normal user must receive 401 accessing /api/interface/client-users");

    // Attempting to access admin audit-logs
    const resLogs = await fetch(`${BASE_URL}/api/interface/audit-logs`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    assert.equal(resLogs.status, 401, "Normal user must receive 401 accessing /api/interface/audit-logs");
  });

  // Scenario 4: Normal user token → admin API
  it("Scenario 4: Normal user token → admin API: Denied on all core admin endpoints", async () => {
    const endpoints = [
      "/api/stats",
      "/api/detection-rules",
      "/api/interface/email/settings",
      "/api/domain-pool",
      "/api/countries",
      "/api/isp-blacklist",
    ];

    for (const ep of endpoints) {
      const res = await fetch(`${BASE_URL}${ep}`, {
        headers: { Authorization: `Bearer ${clientToken}` },
      });
      assert.equal(res.status, 401, `Endpoint ${ep} must reject normal user token with 401`);
    }
  });

  // Scenario 5: Normal user modifies client role to admin
  it("Scenario 5: Normal user modifies client role/user-type to admin: Denied (server rejects)", async () => {
    // Attempt with X-Role header
    const resHeader = await fetch(`${BASE_URL}/api/interface/client-users`, {
      headers: {
        Authorization: `Bearer ${clientToken}`,
        "X-Role": "admin",
        "X-User-Type": "admin",
      },
    });
    assert.equal(resHeader.status, 401, "Client-provided role headers must not grant admin access");

    // Attempt to update self or endpoints with role body payload
    const resBody = await fetch(`${BASE_URL}/api/user/redirect-urls`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${clientToken}`,
      },
      body: JSON.stringify({
        role: "admin",
        userType: "admin",
        isAdmin: true,
      }),
    });
    // Body is accepted only for legitimate redirect URL fields; role is completely ignored
    assert.ok(resBody.status === 200 || resBody.status === 400);

    // Verify user is STILL not admin after attempt
    const verifyAdmin = await fetch(`${BASE_URL}/api/auth/user`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    assert.equal(verifyAdmin.status, 401, "User must still be rejected from admin resources");
  });

  // Scenario 6: Normal user manually enters admin URL
  it("Scenario 6: Normal user manually enters admin API URL: Denied without admin credentials", async () => {
    const res = await fetch(`${BASE_URL}/api/interface/compliance/stats`, {
      headers: {
        Authorization: `Bearer ${clientToken}`,
      },
    });
    assert.equal(res.status, 401, "Manual direct request to admin URL must be denied");
  });

  // Scenario 7: Admin → admin interface
  it("Scenario 7: Admin → admin interface: Allowed to authenticate and access /api/auth/user", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/user`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200, "Admin must be authorized for /api/auth/user");
    const data = await res.json();
    assert.equal(data.username, "admin");
  });

  // Scenario 8: Admin → admin API
  it("Scenario 8: Admin → admin API: Allowed on administrative endpoints", async () => {
    const resStats = await fetch(`${BASE_URL}/api/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resStats.status, 200, "Admin must be allowed on /api/stats");

    const resUsers = await fetch(`${BASE_URL}/api/interface/client-users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resUsers.status, 200, "Admin must be allowed on /api/interface/client-users");
  });

  // Scenario 9: Invalid/non-admin account → admin interface
  it("Scenario 9: Invalid/non-admin account → admin interface: Denied at /api/login", async () => {
    // Attempt to log into /api/login using normal user credentials
    const res = await fetch(`${BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: clientEmail,
        password: clientPassword,
      }),
    });
    assert.equal(res.status, 401, "Normal user credentials must be rejected at admin login endpoint");
    const data = await res.json();
    assert.match(data.message, /invalid credentials/i);
  });

  // Scenario 10: Logged-out user → admin interface
  it("Scenario 10: Logged-out user → admin interface: Denied with 401 (redirects to admin auth)", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/user`, {
      // No credentials or tokens provided
    });
    assert.equal(res.status, 401, "Unauthenticated request to /api/auth/user must return 401");
  });

  // Scenario 11: Expired admin session → admin interface
  it("Scenario 11: Expired admin session → admin interface: Re-authentication required (401)", async () => {
    const expiredFakeToken = "adm_tok_00000000000000000000000000000000";
    const res = await fetch(`${BASE_URL}/api/auth/user`, {
      headers: { Authorization: `Bearer ${expiredFakeToken}` },
    });
    assert.equal(res.status, 401, "Expired/invalid admin token must return 401");
  });

  // Reverse direction checks:
  it("Reverse check 1: Admin credentials cannot authenticate through /api/user/login", async () => {
    const res = await fetch(`${BASE_URL}/api/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "admin",
        password: "admin123",
      }),
    });
    assert.equal(res.status, 401, "Admin credentials must be rejected at user login endpoint");
  });

  it("Reverse check 2: Admin token cannot access client-only endpoints (/api/user/me)", async () => {
    const res = await fetch(`${BASE_URL}/api/user/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 401, "Admin token must be rejected at /api/user/me (requireClientAuth)");
  });

  // IDOR / BOLA Prevention:
  it("IDOR / BOLA check: Normal user cannot pause another user's or admin's API key", async () => {
    const foreignKeyId = "foreign-api-key-id-999";
    const res = await fetch(`${BASE_URL}/api/api-keys/${foreignKeyId}/pause`, {
      method: "POST",
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    assert.equal(res.status, 403, "Client user must receive 403 Forbidden when targeting an unowned API key");
    const data = await res.json();
    assert.match(data.message, /forbidden/i);
  });

  // UI Code Audit check:
  it("UI separation check: User login page does NOT contain Admin Control Center link", () => {
    const userLoginFile = path.join(process.cwd(), "client/src/pages/user-login.tsx");
    const content = fs.readFileSync(userLoginFile, "utf-8");
    assert.ok(
      !content.includes("System Administrator? Sign in to Admin Control Center"),
      "user-login.tsx must NOT contain the Admin Control Center link"
    );
    assert.ok(
      !content.includes('href="/login"'),
      "user-login.tsx must NOT contain href='/login'"
    );
  });

  it("UI separation check: Admin login page does NOT advertise or invite client signups", () => {
    const adminLoginFile = path.join(process.cwd(), "client/src/pages/login.tsx");
    const content = fs.readFileSync(adminLoginFile, "utf-8");
    assert.ok(
      !content.includes("Client Sign In →"),
      "login.tsx must NOT contain 'Client Sign In →'"
    );
    assert.ok(
      !content.includes("Create Trial Account"),
      "login.tsx must NOT contain 'Create Trial Account'"
    );
  });
});
