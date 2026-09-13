import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { storage } from "./storage";
import { randomUUID } from "crypto";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  fromName: string;
  providerPreset?: string; // 'resend' | 'sendgrid' | 'mailgun' | 'postmark' | 'ses' | 'custom'
}

export interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  templateType: string;
  status: "delivered" | "failed" | "simulated";
  errorMessage?: string;
  messageId?: string;
  sentAt: string;
  metadata?: Record<string, any>;
}

// In-memory buffer of recent email logs (also persisted to Firestore/settings where available)
const emailLogs: EmailLogEntry[] = [];
const MAX_LOGS = 200;

function addEmailLog(entry: Omit<EmailLogEntry, "id" | "sentAt">) {
  const log: EmailLogEntry = {
    id: randomUUID(),
    sentAt: new Date().toISOString(),
    ...entry,
  };
  emailLogs.unshift(log);
  if (emailLogs.length > MAX_LOGS) {
    emailLogs.pop();
  }
  return log;
}

export async function getEmailLogs(): Promise<EmailLogEntry[]> {
  return [...emailLogs];
}

// ── Sanitize & Auto-heal SMTP Configuration ────────────────────────────────
export function sanitizeSmtpConfig(config: SmtpConfig): SmtpConfig {
  const sanitized: SmtpConfig = {
    ...config,
    host: (config.host || "").trim(),
    port: Number(config.port) || 587,
    secure: Boolean(config.secure),
    user: (config.user || "").trim(),
    pass: (config.pass || "").trim(),
    from: (config.from || "").trim(),
    fromName: (config.fromName || "").trim(),
    providerPreset: config.providerPreset || "custom",
  };

  // 1. Correct common typo: port 585 (invalid/obsolete port) -> 465 (SSL) or 587 (TLS)
  if (sanitized.port === 585) {
    sanitized.port = sanitized.secure ? 465 : 587;
  }

  // Strip whitespace from passwords (Google App Passwords are shown with spaces, e.g. "xxxx xxxx xxxx xxxx")
  if (sanitized.pass) {
    sanitized.pass = sanitized.pass.replace(/\s+/g, "");
  }

  // 2. Provider-specific intelligent normalization
  const lowerHost = sanitized.host.toLowerCase();
  if (lowerHost.includes("gmail.com") || lowerHost.includes("googlemail.com")) {
    // Gmail supports 465 (direct SSL/TLS, secure=true) and 587 (STARTTLS, secure=false)
    if (sanitized.port === 465) {
      sanitized.secure = true;
    } else if (sanitized.port === 587) {
      sanitized.secure = false;
    } else {
      // Non-standard port entered for Gmail - normalize to 465 if secure, otherwise 587
      sanitized.port = sanitized.secure ? 465 : 587;
    }
    // If from is empty or default non-Gmail placeholder, default to authenticated user email
    if (!sanitized.from || sanitized.from === "noreply@cleantraffic.io") {
      if (sanitized.user && sanitized.user.includes("@")) {
        sanitized.from = sanitized.user;
      }
    }
  } else if (lowerHost.includes("resend.com")) {
    if (sanitized.port === 465) {
      sanitized.secure = true;
    } else if (sanitized.port === 587) {
      sanitized.secure = false;
    }
  } else if (
    lowerHost.includes("sendgrid.net") ||
    lowerHost.includes("brevo.com") ||
    lowerHost.includes("mailgun.org") ||
    lowerHost.includes("postmarkapp.com")
  ) {
    if (sanitized.port === 465) {
      sanitized.secure = true;
    } else if (sanitized.port === 587) {
      sanitized.secure = false;
    }
  }

  return sanitized;
}

// ── Retrieve Active SMTP Configuration ──────────────────────────────────────
export async function getSmtpConfig(): Promise<SmtpConfig> {
  // Check persisted settings first (from Firestore or DB)
  const host = (await storage.getSetting("smtp_host")) || process.env.SMTP_HOST || "";
  const portStr = (await storage.getSetting("smtp_port")) || process.env.SMTP_PORT || "587";
  const secureStr = (await storage.getSetting("smtp_secure")) || process.env.SMTP_SECURE || "false";
  const user = (await storage.getSetting("smtp_user")) || process.env.SMTP_USER || "";
  const pass = (await storage.getSetting("smtp_pass")) || process.env.SMTP_PASS || "";
  const from = (await storage.getSetting("smtp_from")) || process.env.SMTP_FROM || "noreply@cleantraffic.io";
  const fromName = (await storage.getSetting("smtp_from_name")) || process.env.SMTP_FROM_NAME || "CleanTraffic Security";
  const providerPreset = (await storage.getSetting("smtp_provider_preset")) || "custom";

  // Auto-detect Resend API key shortcut if no SMTP is explicitly configured
  if (!host && process.env.RESEND_API_KEY) {
    return sanitizeSmtpConfig({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      user: "resend",
      pass: process.env.RESEND_API_KEY,
      from: from || "onboarding@resend.dev",
      fromName: fromName || "CleanTraffic Security",
      providerPreset: "resend",
    });
  }

  const rawConfig: SmtpConfig = {
    host: host.trim(),
    port: parseInt(portStr, 10) || 587,
    secure: secureStr === "true" || secureStr === "1",
    user: user.trim(),
    pass: pass.trim(),
    from: from.trim(),
    fromName: fromName.trim(),
    providerPreset,
  };

  return sanitizeSmtpConfig(rawConfig);
}

// ── Save SMTP Configuration ─────────────────────────────────────────────────
export async function saveSmtpConfig(config: Partial<SmtpConfig>): Promise<void> {
  const current = await getSmtpConfig();
  const merged: SmtpConfig = { ...current, ...config };
  const sanitized = sanitizeSmtpConfig(merged);

  await storage.setSetting("smtp_host", sanitized.host);
  await storage.setSetting("smtp_port", String(sanitized.port));
  await storage.setSetting("smtp_secure", String(sanitized.secure));
  await storage.setSetting("smtp_user", sanitized.user);
  if (sanitized.pass && sanitized.pass !== "••••••••") {
    await storage.setSetting("smtp_pass", sanitized.pass);
  }
  await storage.setSetting("smtp_from", sanitized.from);
  await storage.setSetting("smtp_from_name", sanitized.fromName);
  await storage.setSetting("smtp_provider_preset", sanitized.providerPreset || "custom");
}

// ── Create Transporter Instance ─────────────────────────────────────────────
export async function createTransporter(overrideConfig?: Partial<SmtpConfig>): Promise<{
  transporter: Transporter | null;
  config: SmtpConfig;
  isConfigured: boolean;
}> {
  const baseConfig = await getSmtpConfig();
  const config = sanitizeSmtpConfig({ ...baseConfig, ...overrideConfig });

  const isConfigured = !!(config.host && config.user && config.pass);

  if (!isConfigured) {
    return { transporter: null, config, isConfigured: false };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure, // true for 465, false for other ports (e.g. 587 using STARTTLS)
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: false, // Prevents self-signed cert issues during dev
    },
    connectionTimeout: 10000, // 10s connection timeout prevents long hangs
    greetingTimeout: 10000,   // 10s greeting timeout
    socketTimeout: 15000,     // 15s socket timeout
  });

  return { transporter, config, isConfigured: true };
}

// ── Helper: Format User-Friendly SMTP Errors ────────────────────────────────
function formatSmtpError(error: any, config: SmtpConfig): string {
  const errorMsg = error?.message || "";
  const isTimeout =
    error?.code === "ETIMEDOUT" ||
    errorMsg.toLowerCase().includes("timeout") ||
    errorMsg.toLowerCase().includes("connection timeout");

  if (isTimeout) {
    return `Connection timed out connecting to ${config.host}:${config.port}. Please check that the port is correct (e.g. 465 for SSL or 587 for TLS) and that outbound SMTP traffic is not blocked.`;
  }

  if (error?.code === "EAUTH" || error?.responseCode === 535) {
    if (config.host.toLowerCase().includes("gmail.com")) {
      return `Authentication failed for ${config.user}. Gmail requires a 16-character Google App Password (not your account password) with 2-Step Verification enabled.`;
    }
    return `Authentication failed for ${config.user}. Please verify your username and password or API key.`;
  }

  if (error?.code === "ENOTFOUND" || error?.code === "EAI_AGAIN") {
    return `Could not resolve hostname "${config.host}". Please check the SMTP host address.`;
  }

  if (error?.code === "ECONNREFUSED") {
    return `Connection refused by ${config.host}:${config.port}. The server is not accepting connections on this port.`;
  }

  return errorMsg || "Failed to establish SMTP connection. Please check your credentials.";
}

// ── Test SMTP Connection ────────────────────────────────────────────────────
export async function verifySmtpConnection(testConfig?: Partial<SmtpConfig>): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const { transporter, config, isConfigured } = await createTransporter(testConfig);
    if (!isConfigured || !transporter) {
      return {
        success: false,
        message: "SMTP is not fully configured. Please provide Host, Port, Username, and Password / API Key.",
      };
    }

    try {
      await transporter.verify();
      return {
        success: true,
        message: `Successfully connected and authenticated with SMTP server (${config.host}:${config.port}, secure: ${config.secure ? "SSL" : "TLS"}).`,
      };
    } catch (firstErr: any) {
      // If verification timed out and host has a known alternative port (e.g. Gmail 465 <-> 587), try the sibling port!
      const isTimeout =
        firstErr?.code === "ETIMEDOUT" ||
        (firstErr?.message || "").toLowerCase().includes("timeout");

      const isKnownProvider =
        config.host.toLowerCase().includes("gmail.com") ||
        config.host.toLowerCase().includes("googlemail.com");

      if (isTimeout && isKnownProvider) {
        const altPort = config.port === 465 ? 587 : 465;
        const altSecure = altPort === 465;

        console.log(
          `[SMTP Verification] Port ${config.port} timed out. Attempting fallback on alternative port ${altPort} (secure: ${altSecure})...`
        );

        try {
          const altTransporter = nodemailer.createTransport({
            host: config.host,
            port: altPort,
            secure: altSecure,
            auth: { user: config.user, pass: config.pass },
            tls: { rejectUnauthorized: false },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
          });

          await altTransporter.verify();

          // Auto-save the working port configuration
          await saveSmtpConfig({ ...config, port: altPort, secure: altSecure });

          return {
            success: true,
            message: `Successfully connected and authenticated on port ${altPort} (${altSecure ? "SSL" : "TLS"}). Settings automatically updated from timed-out port ${config.port}.`,
          };
        } catch (secondErr: any) {
          console.error("[SMTP Verification Error (Fallback)]:", secondErr);
          throw firstErr; // Propagate original with formatting
        }
      }

      throw firstErr;
    }
  } catch (error: any) {
    console.warn("[SMTP Verification Check]:", error?.message || error);
    const resolvedConfig = await getSmtpConfig();
    const activeConfig = { ...resolvedConfig, ...testConfig };
    return {
      success: false,
      message: formatSmtpError(error, activeConfig),
    };
  }
}

// ── Default Node HTML Email Templates ───────────────────────────────────────
export const defaultEmailTemplates = {
  verification: {
    subject: "Verify your email address - {{app_name}}",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email address</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; }
    .container { max-width: 560px; margin: 40px auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
    .header { background: linear-gradient(135deg, #1e3a8a, #0f172a); padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #1f2937; }
    .logo { font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
    .logo span { color: #38bdf8; }
    .content { padding: 36px 32px; }
    h1 { font-size: 22px; font-weight: 700; color: #f8fafc; margin-top: 0; margin-bottom: 16px; letter-spacing: -0.3px; }
    p { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px; }
    .pin-box { background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 20px; text-align: center; margin: 28px 0; }
    .pin-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 8px; }
    .pin-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; color: #38bdf8; letter-spacing: 8px; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #2563eb, #0284c7); color: #ffffff !important; text-decoration: none; padding: 14px 36px; font-size: 15px; font-weight: 600; border-radius: 10px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4); }
    .footer { background: #0b0f19; padding: 24px 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
    .link-alt { word-break: break-all; color: #38bdf8; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">CleanTraffic <span>Security</span></div>
    </div>
    <div class="content">
      <h1>Confirm Your Email Address</h1>
      <p>Hello <strong>{{name}}</strong>,</p>
      <p>Thank you for signing up for CleanTraffic. To activate your 7-day trial and unlock full traffic security & bot protection, please confirm your email address using the confirmation button or the 6-digit code below.</p>
      
      <div class="btn-container">
        <a href="{{verification_link}}" class="btn" target="_blank">Verify Email Address</a>
      </div>

      <div class="pin-box">
        <div class="pin-label">Or Enter Verification Code</div>
        <div class="pin-code">{{code}}</div>
      </div>

      <p style="font-size: 13px; color: #94a3b8;">This verification code and link will expire in <strong>5 minutes</strong>. If you did not create an account with {{app_name}}, you can safely ignore this message.</p>

      <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #1f2937; font-size: 12px; color: #64748b;">
        Button not working? Copy and paste this link into your browser:<br>
        <a href="{{verification_link}}" class="link-alt">{{verification_link}}</a>
      </div>
    </div>
    <div class="footer">
      &copy; {{current_year}} {{app_name}} Enterprise Security. All rights reserved.<br>
      Automated security dispatch &bull; Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>`,
  },
  reset: {
    subject: "Reset your password - {{app_name}}",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; }
    .container { max-width: 560px; margin: 40px auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #7f1d1d, #0f172a); padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #1f2937; }
    .logo { font-size: 22px; font-weight: 800; color: #ffffff; }
    .content { padding: 36px 32px; }
    h1 { font-size: 22px; font-weight: 700; color: #f8fafc; margin-top: 0; }
    p { font-size: 15px; line-height: 1.6; color: #cbd5e1; }
    .pin-box { background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 20px; text-align: center; margin: 28px 0; }
    .pin-code { font-family: monospace; font-size: 36px; font-weight: 800; color: #f87171; letter-spacing: 8px; }
    .footer { background: #0b0f19; padding: 24px 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">CleanTraffic <span>Security</span></div>
    </div>
    <div class="content">
      <h1>Password Reset Request</h1>
      <p>Hello <strong>{{name}}</strong>,</p>
      <p>We received a request to reset your password for your {{app_name}} account. Use the 6-digit recovery code below to set a new password:</p>

      <div class="pin-box">
        <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">SECURITY RECOVERY CODE</div>
        <div class="pin-code">{{code}}</div>
      </div>

      <p style="font-size: 13px; color: #94a3b8;">This code will expire in <strong>5 minutes</strong>. If you did not request a password reset, your account is still secure and no changes were made.</p>
    </div>
    <div class="footer">
      &copy; {{current_year}} {{app_name}} Security System.
    </div>
  </div>
</body>
</html>`,
  },
  welcome: {
    subject: "Welcome to {{app_name}} - Your 7-Day Trial is Active",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to CleanTraffic</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; }
    .container { max-width: 560px; margin: 40px auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #065f46, #0f172a); padding: 32px; text-align: center; }
    .content { padding: 36px 32px; }
    h1 { font-size: 22px; font-weight: 700; color: #f8fafc; margin: 0 0 16px; }
    p { font-size: 15px; line-height: 1.6; color: #cbd5e1; }
    .feature-card { background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 16px; margin: 16px 0; }
    .btn { display: inline-block; background: #10b981; color: #ffffff !important; text-decoration: none; padding: 14px 32px; font-size: 15px; font-weight: 600; border-radius: 10px; }
    .footer { background: #0b0f19; padding: 24px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="color: #34d399; margin: 0;">CleanTraffic Enterprise Security</h2>
    </div>
    <div class="content">
      <h1>Welcome Aboard, {{name}}!</h1>
      <p>Your account is ready. Here is what you get during your 7-day free trial:</p>
      <div class="feature-card">
        <strong style="color: #34d399;">✓ 5,000 Protected Requests</strong><br>
        <span style="font-size: 13px; color: #94a3b8;">High-speed visitor classification, automated bot detection, and threat mitigation routing.</span>
      </div>
      <div class="feature-card">
        <strong style="color: #38bdf8;">✓ Real-time Telemetry Dashboard</strong><br>
        <span style="font-size: 13px; color: #94a3b8;">Inspect live IPs, ISP classifications, and block threat vectors instantly.</span>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{login_link}}" class="btn" target="_blank">Open User Dashboard</a>
      </div>
    </div>
    <div class="footer">
      &copy; {{current_year}} {{app_name}}. Need help? Contact {{support_email}}
    </div>
  </div>
</body>
</html>`,
  },
  custom: {
    subject: "{{subject}}",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; }
    .container { max-width: 600px; margin: 40px auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; }
    .header { background: #1e293b; padding: 24px 32px; border-bottom: 1px solid #334155; }
    .logo { font-size: 18px; font-weight: 700; color: #ffffff; }
    .content { padding: 32px; font-size: 15px; line-height: 1.7; color: #cbd5e1; }
    .footer { background: #0b0f19; padding: 24px 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">CleanTraffic <span style="color: #38bdf8;">Security</span></div>
    </div>
    <div class="content">
      {{custom_message}}
    </div>
    <div class="footer">
      &copy; {{current_year}} {{app_name}}. You received this message regarding your account.
    </div>
  </div>
</body>
</html>`,
  },
  newsletter: {
    subject: "{{subject}}",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; }
    .container { max-width: 600px; margin: 40px auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #1e3a8a, #0f172a); padding: 32px; text-align: center; }
    .content { padding: 36px 32px; font-size: 15px; line-height: 1.7; color: #cbd5e1; }
    .footer { background: #0b0f19; padding: 24px 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="color: #ffffff; margin: 0;">CleanTraffic <span style="color: #38bdf8;">Updates</span></h2>
    </div>
    <div class="content">
      {{custom_message}}
    </div>
    <div class="footer">
      &copy; {{current_year}} {{app_name}}. You received this update as an active subscriber.<br>
      Manage your notification settings anytime from your dashboard.
    </div>
  </div>
</body>
</html>`,
  },
  account_status: {
    subject: "Important Account Notice: Status updated to {{status_label}} - {{app_name}}",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Status Update</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; }
    .container { max-width: 580px; margin: 40px auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #1e293b, #0f172a); padding: 28px 32px; border-bottom: 1px solid #1f2937; }
    .logo { font-size: 20px; font-weight: 800; color: #ffffff; }
    .content { padding: 32px; }
    h1 { font-size: 20px; font-weight: 700; color: #f8fafc; margin-top: 0; margin-bottom: 16px; }
    p { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin: 0 0 16px 0; }
    .status-badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px; background: #334155; color: #f1f5f9; }
    .status-suspended { background: #7f1d1d; color: #fecaca; }
    .status-flagged { background: #78350f; color: #fef08a; }
    .status-pending { background: #1e3a8a; color: #bfdbfe; }
    .status-cleared { background: #064e3b; color: #a7f3d0; }
    .status-deactivated { background: #334155; color: #e2e8f0; }
    .details-box { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 18px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #1e293b; font-size: 14px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #94a3b8; font-weight: 500; }
    .detail-value { color: #f8fafc; font-weight: 600; text-align: right; }
    .reason-box { background: rgba(239, 68, 68, 0.08); border-left: 4px solid #ef4444; padding: 14px 16px; margin: 20px 0; border-radius: 4px; font-size: 14px; color: #fca5a5; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 28px; font-size: 14px; font-weight: 600; border-radius: 8px; margin-top: 12px; }
    .footer { background: #0b0f19; padding: 20px 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">CleanTraffic <span>Security System</span></div>
    </div>
    <div class="content">
      <h1>Account Status Notification</h1>
      <p>Hello <strong>{{name}}</strong>,</p>
      <p>This automated message is to inform you that your account status on {{app_name}} has been updated:</p>
      
      <div style="margin: 12px 0;">
        <span class="status-badge status-{{status_class}}">{{status_label}}</span>
      </div>

      <div class="details-box">
        <div class="detail-row">
          <span class="detail-label">Account Username:</span>
          <span class="detail-value">{{username}}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Previous Status:</span>
          <span class="detail-value">{{previous_status}}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">New Status:</span>
          <span class="detail-value">{{status_label}}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Effective Date:</span>
          <span class="detail-value">{{timestamp}}</span>
        </div>
      </div>

      <div class="reason-box">
        <strong>Reason / Remarks:</strong><br>
        {{reason}}
      </div>

      <p>{{impact_message}}</p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="{{login_link}}" class="btn">Access User Portal</a>
      </div>
    </div>
    <div class="footer">
      &copy; {{current_year}} {{app_name}} Security Operations.<br>
      For questions or appeals, please contact <a href="mailto:{{support_email}}" style="color: #38bdf8;">{{support_email}}</a>.
    </div>
  </div>
</body>
</html>`,
  },
  password_changed: {
    subject: "Security Alert: Password Changed for {{app_name}}",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Alert - Password Changed</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; }
    .container { max-width: 580px; margin: 40px auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
    .header { background: linear-gradient(135deg, #0f2b23, #0f172a); padding: 28px 32px; border-bottom: 1px solid #1f2937; }
    .logo { font-size: 20px; font-weight: 800; color: #ffffff; }
    .logo span { color: #10b981; }
    .content { padding: 32px; }
    h1 { font-size: 20px; font-weight: 700; color: #f8fafc; margin-top: 0; margin-bottom: 16px; }
    p { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin: 0 0 16px 0; }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px; background: #064e3b; color: #a7f3d0; border: 1px solid #047857; }
    .details-box { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 18px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1e293b; font-size: 14px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #94a3b8; font-weight: 500; }
    .detail-value { color: #f8fafc; font-weight: 600; text-align: right; }
    .warning-box { background: rgba(239, 68, 68, 0.08); border-left: 4px solid #ef4444; padding: 14px 16px; margin: 20px 0; border-radius: 4px; font-size: 14px; color: #fca5a5; line-height: 1.5; }
    .btn { display: inline-block; background: #0A5C48; color: #ffffff !important; text-decoration: none; padding: 12px 28px; font-size: 14px; font-weight: 600; border-radius: 8px; margin-top: 12px; }
    .footer { background: #0b0f19; padding: 20px 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">CleanTraffic <span>Security System</span></div>
    </div>
    <div class="content">
      <div class="badge">Security Notice</div>
      <h1>Your Password Has Been Changed</h1>
      <p>Hello <strong>{{name}}</strong>,</p>
      <p>The password for your {{app_name}} account (<strong>{{email}}</strong>) was successfully updated.</p>

      <div class="details-box">
        <div class="detail-row">
          <span class="detail-label">Account:</span>
          <span class="detail-value">{{email}}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Event:</span>
          <span class="detail-value">Password Change</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Date & Time:</span>
          <span class="detail-value">{{timestamp}}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">IP Address:</span>
          <span class="detail-value">{{ip_address}}</span>
        </div>
      </div>

      <p style="font-size: 14px; color: #94a3b8;">
        For your security, all active sessions and existing tokens on other devices have been invalidated.
      </p>

      <div class="warning-box">
        <strong>Did not make this change?</strong><br>
        Your password was recently changed. If you did not make this change, please contact support/security immediately at <a href="mailto:{{support_email}}" style="color: #f87171; text-decoration: underline;">{{support_email}}</a> or request an immediate password reset.
      </div>

      <div style="text-align: center; margin: 24px 0;">
        <a href="{{login_link}}" class="btn">Go to User Portal</a>
      </div>
    </div>
    <div class="footer">
      &copy; {{current_year}} {{app_name}} Enterprise Security. All rights reserved.<br>
      Automated security alert &bull; Do not reply directly to this message.
    </div>
  </div>
</body>
</html>`,
  },
};

// ── Get Stored or Default Template ──────────────────────────────────────────
export async function getEmailTemplate(type: keyof typeof defaultEmailTemplates): Promise<{
  subject: string;
  html: string;
}> {
  const customSubject = await storage.getSetting(`email_tpl_${type}_subject`);
  const customHtml = await storage.getSetting(`email_tpl_${type}_html`);
  const def = defaultEmailTemplates[type] || defaultEmailTemplates.custom;

  return {
    subject: customSubject || def.subject,
    html: customHtml || def.html,
  };
}

export async function saveEmailTemplate(
  type: keyof typeof defaultEmailTemplates,
  template: { subject: string; html: string }
): Promise<void> {
  await storage.setSetting(`email_tpl_${type}_subject`, template.subject);
  await storage.setSetting(`email_tpl_${type}_html`, template.html);
}

// ── Render Template with Placeholder Variables ──────────────────────────────
export function renderTemplate(
  templateHtml: string,
  variables: Record<string, string | number | undefined>
): string {
  let rendered = templateHtml;
  const vars: Record<string, string> = {
    app_name: "CleanTraffic Security",
    support_email: "support@cleantraffic.io",
    current_year: String(new Date().getFullYear()),
    login_link: "/signin",
    ...Object.fromEntries(
      Object.entries(variables).map(([k, v]) => [k, v !== undefined ? String(v) : ""])
    ),
  };

  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    rendered = rendered.replace(regex, value);
  }

  return rendered;
}

// ── Core Send Email Dispatcher ──────────────────────────────────────────────
export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  templateType?: string;
  variables?: Record<string, string | number | undefined>;
}

export async function sendEmail(options: SendEmailOptions): Promise<{
  success: boolean;
  messageId?: string;
  message: string;
  simulated?: boolean;
}> {
  const { to, subject, html, text, templateType = "custom", variables = {} } = options;

  const renderedSubject = renderTemplate(subject, variables);
  const renderedHtml = renderTemplate(html, variables);
  const plainText = text || renderedHtml.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim();

  const { transporter, config, isConfigured } = await createTransporter();

  // If SMTP is not configured, log failure and return false so UI never reports false delivery
  if (!isConfigured || !transporter) {
    console.warn(
      `[Email Service] Cannot dispatch email: SMTP is not configured. (Recipient: ${to}, Subject: ${renderedSubject})`
    );
    addEmailLog({
      to,
      subject: renderedSubject,
      templateType,
      status: "failed",
      errorMessage: "SMTP is not configured on this server. Please enter host, port, username, and password in Email Settings.",
      metadata: { variables },
    });
    return {
      success: false,
      simulated: false,
      message: `Outbound email delivery service (SMTP) is not configured. Please configure SMTP in system settings.`,
    };
  }

  try {
    const fromEmail = config.from || config.user;
    const fromAddress = config.fromName ? `"${config.fromName}" <${fromEmail}>` : fromEmail;

    let info: any;
    try {
      info = await transporter.sendMail({
        from: fromAddress,
        replyTo: fromAddress,
        to,
        subject: renderedSubject,
        html: renderedHtml,
        text: plainText,
        headers: {
          "X-Entity-Ref-ID": randomUUID(),
          "X-Mailer": "CleanTraffic-Security-Mailer",
        },
      });
    } catch (sendErr: any) {
      // If delivery timed out and host has a known alternative port (e.g. Gmail 465 <-> 587), try the alternative port once
      const isTimeout =
        sendErr?.code === "ETIMEDOUT" ||
        (sendErr?.message || "").toLowerCase().includes("timeout");

      const isKnownProvider =
        config.host.toLowerCase().includes("gmail.com") ||
        config.host.toLowerCase().includes("googlemail.com");

      if (isTimeout && isKnownProvider) {
        const altPort = config.port === 465 ? 587 : 465;
        const altSecure = altPort === 465;

        console.log(
          `[Email Service] Port ${config.port} timed out sending to ${to}. Retrying via alternate port ${altPort} (secure: ${altSecure})...`
        );

        const altTransporter = nodemailer.createTransport({
          host: config.host,
          port: altPort,
          secure: altSecure,
          auth: { user: config.user, pass: config.pass },
          tls: { rejectUnauthorized: false },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        });

        info = await altTransporter.sendMail({
          from: fromAddress,
          to,
          subject: renderedSubject,
          html: renderedHtml,
          text: plainText,
        });

        // Persist working configuration
        await saveSmtpConfig({ ...config, port: altPort, secure: altSecure });
      } else {
        throw sendErr;
      }
    }

    console.log(`[Email Service] Sent email to ${to} [Message ID: ${info.messageId}]`);

    addEmailLog({
      to,
      subject: renderedSubject,
      templateType,
      status: "delivered",
      messageId: info.messageId,
      metadata: { response: info.response },
    });

    return {
      success: true,
      messageId: info.messageId,
      message: `Email successfully delivered to ${to}.`,
    };
  } catch (error: any) {
    console.error(`[Email Service Error] Failed to send to ${to}:`, error);
    const friendlyError = formatSmtpError(error, config);

    addEmailLog({
      to,
      subject: renderedSubject,
      templateType,
      status: "failed",
      errorMessage: friendlyError,
      metadata: { variables },
    });

    return {
      success: false,
      message: friendlyError,
    };
  }
}

// ── Specialized Mail Handlers ───────────────────────────────────────────────

export async function sendVerificationEmail(params: {
  to: string;
  name?: string;
  code: string;
  token: string;
  baseUrl?: string;
}): Promise<{ success: boolean; message: string; simulated?: boolean; messageId?: string }> {
  const { to, name, code, token, baseUrl = "" } = params;
  const tpl = await getEmailTemplate("verification");
  const verificationLink = `${baseUrl}/verification-required?status=success&token=${token}&email=${encodeURIComponent(to)}`;

  return await sendEmail({
    to,
    subject: tpl.subject,
    html: tpl.html,
    templateType: "verification",
    variables: {
      name: name || to.split("@")[0],
      email: to,
      code,
      verification_link: verificationLink,
    },
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  name?: string;
  code: string;
  token?: string;
}): Promise<{ success: boolean; message: string; simulated?: boolean; messageId?: string }> {
  const { to, name, code } = params;
  const tpl = await getEmailTemplate("reset");

  return await sendEmail({
    to,
    subject: tpl.subject,
    html: tpl.html,
    templateType: "reset",
    variables: {
      name: name || to.split("@")[0],
      email: to,
      code,
    },
  });
}

export async function sendWelcomeEmail(params: {
  to: string;
  name?: string;
  apiKey?: string;
}): Promise<{ success: boolean; message: string; simulated?: boolean }> {
  const { to, name, apiKey } = params;
  const tpl = await getEmailTemplate("welcome");

  return await sendEmail({
    to,
    subject: tpl.subject,
    html: tpl.html,
    templateType: "welcome",
    variables: {
      name: name || to.split("@")[0],
      email: to,
      api_key: apiKey || "",
    },
  });
}

export async function sendAccountStatusEmail(params: {
  to: string;
  name?: string;
  username: string;
  newStatus: string;
  previousStatus?: string;
  reason?: string;
  changedBy?: string;
}): Promise<{ success: boolean; message: string; simulated?: boolean; messageId?: string }> {
  const { to, name, username, newStatus, previousStatus, reason, changedBy } = params;
  const tpl = await getEmailTemplate("account_status");

  const normalizedStatus = newStatus.toLowerCase().trim();
  let statusLabel = newStatus.toUpperCase();
  let statusClass = "pending";
  let impactMessage = "Your account status has been updated by system administration.";

  if (normalizedStatus === "suspended") {
    statusLabel = "Suspended";
    statusClass = "suspended";
    impactMessage = "Your account access, dashboard logins, and all associated API keys have been suspended. API requests utilizing your keys will return HTTP 403 Forbidden. If you believe this is an error, please contact our support team immediately.";
  } else if (normalizedStatus === "flagged") {
    statusLabel = "Flagged / Under Review";
    statusClass = "flagged";
    impactMessage = "Your account has been flagged for security and compliance review. While basic dashboard access remains available, high-risk actions such as generating new routing links and creating or modifying API keys are temporarily restricted.";
  } else if (normalizedStatus === "pending") {
    statusLabel = "Pending Approval";
    statusClass = "pending";
    impactMessage = "Your account is awaiting administrative review. Live traffic link generation and active routing features will activate as soon as your account is cleared.";
  } else if (normalizedStatus === "cleared" || normalizedStatus === "active") {
    statusLabel = "Active / Cleared";
    statusClass = "cleared";
    impactMessage = "Your account is in good standing. All protection modules, link routing features, telemetry analytics, and API keys are fully operational.";
  } else if (normalizedStatus === "deactivated") {
    statusLabel = "Deactivated";
    statusClass = "deactivated";
    impactMessage = "Your account has been deactivated. All active sessions have been invalidated and API keys paused.";
  } else if (normalizedStatus === "deleted") {
    statusLabel = "Deleted";
    statusClass = "suspended";
    impactMessage = "Your account and associated configuration data have been permanently removed from our active database.";
  }

  return await sendEmail({
    to,
    subject: `Account Status Notice: ${statusLabel} - CleanTraffic Security`,
    html: tpl.html,
    templateType: "account_status",
    variables: {
      name: name || username || to.split("@")[0],
      username,
      status_label: statusLabel,
      status_class: statusClass,
      previous_status: previousStatus || "Active",
      reason: reason || "Administrative account review and status update.",
      changed_by: changedBy || "System Administrator",
      timestamp: new Date().toUTCString(),
      impact_message: impactMessage,
      login_link: "/signin",
    },
  });
}

// ── Send Password Changed Security Email ─────────────────────────────────────
export async function sendPasswordChangedEmail(params: {
  to: string;
  name?: string;
  ipAddress?: string;
  timestamp?: string;
}): Promise<{ success: boolean; message: string; simulated?: boolean; messageId?: string }> {
  const { to, name, ipAddress, timestamp } = params;
  const tpl = await getEmailTemplate("password_changed");

  return await sendEmail({
    to,
    subject: tpl.subject,
    html: tpl.html,
    templateType: "password_changed",
    variables: {
      name: name || to.split("@")[0],
      email: to,
      timestamp: timestamp || new Date().toUTCString(),
      ip_address: ipAddress || "Unknown",
      login_link: "/user",
    },
  });
}

