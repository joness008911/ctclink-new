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

// ── Retrieve Active SMTP Configuration ──────────────────────────────────────
export async function getSmtpConfig(): Promise<SmtpConfig> {
  // Check persisted settings first (from Firestore or DB)
  const host = (await storage.getSetting("smtp_host")) || process.env.SMTP_HOST || "";
  const portStr = (await storage.getSetting("smtp_port")) || process.env.SMTP_PORT || "587";
  const secureStr = (await storage.getSetting("smtp_secure")) || process.env.SMTP_SECURE || "false";
  const user = (await storage.getSetting("smtp_user")) || process.env.SMTP_USER || "";
  const pass = (await storage.getSetting("smtp_pass")) || process.env.SMTP_PASS || "";
  const from = (await storage.getSetting("smtp_from")) || process.env.SMTP_FROM || "noreply@cleantraffic.io";
  const fromName = (await storage.getSetting("smtp_from_name")) || process.env.SMTP_FROM_NAME || "CleanTraffic Cloak";
  const providerPreset = (await storage.getSetting("smtp_provider_preset")) || "custom";

  // Auto-detect Resend API key shortcut if no SMTP is explicitly configured
  if (!host && process.env.RESEND_API_KEY) {
    return {
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      user: "resend",
      pass: process.env.RESEND_API_KEY,
      from: from || "onboarding@resend.dev",
      fromName: fromName || "CleanTraffic Cloak",
      providerPreset: "resend",
    };
  }

  return {
    host: host.trim(),
    port: parseInt(portStr, 10) || 587,
    secure: secureStr === "true" || secureStr === "1",
    user: user.trim(),
    pass: pass.trim(),
    from: from.trim(),
    fromName: fromName.trim(),
    providerPreset,
  };
}

// ── Save SMTP Configuration ─────────────────────────────────────────────────
export async function saveSmtpConfig(config: Partial<SmtpConfig>): Promise<void> {
  if (config.host !== undefined) await storage.setSetting("smtp_host", config.host);
  if (config.port !== undefined) await storage.setSetting("smtp_port", String(config.port));
  if (config.secure !== undefined) await storage.setSetting("smtp_secure", String(config.secure));
  if (config.user !== undefined) await storage.setSetting("smtp_user", config.user);
  if (config.pass !== undefined && config.pass !== "••••••••") {
    await storage.setSetting("smtp_pass", config.pass);
  }
  if (config.from !== undefined) await storage.setSetting("smtp_from", config.from);
  if (config.fromName !== undefined) await storage.setSetting("smtp_from_name", config.fromName);
  if (config.providerPreset !== undefined) await storage.setSetting("smtp_provider_preset", config.providerPreset);
}

// ── Create Transporter Instance ─────────────────────────────────────────────
export async function createTransporter(overrideConfig?: Partial<SmtpConfig>): Promise<{
  transporter: Transporter | null;
  config: SmtpConfig;
  isConfigured: boolean;
}> {
  const baseConfig = await getSmtpConfig();
  const config: SmtpConfig = { ...baseConfig, ...overrideConfig };

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
  });

  return { transporter, config, isConfigured: true };
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

    await transporter.verify();
    return {
      success: true,
      message: `Successfully connected and authenticated with SMTP server (${config.host}:${config.port}).`,
    };
  } catch (error: any) {
    console.error("[SMTP Verification Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to establish SMTP connection. Please check your credentials.",
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
      <div class="logo">CleanTraffic <span>Cloak</span></div>
    </div>
    <div class="content">
      <h1>Confirm Your Email Address</h1>
      <p>Hello <strong>{{name}}</strong>,</p>
      <p>Thank you for signing up for CleanTraffic. To activate your 7-day trial and unlock cloaking protection, please confirm your email address using the confirmation button or the 6-digit code below.</p>
      
      <div class="btn-container">
        <a href="{{verification_link}}" class="btn" target="_blank">Verify Email Address</a>
      </div>

      <div class="pin-box">
        <div class="pin-label">Or Enter Verification Code</div>
        <div class="pin-code">{{code}}</div>
      </div>

      <p style="font-size: 13px; color: #94a3b8;">This verification code and link will expire in <strong>24 hours</strong>. If you did not create an account with {{app_name}}, you can safely ignore this message.</p>

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
      <div class="logo">CleanTraffic <span>Cloak</span></div>
    </div>
    <div class="content">
      <h1>Password Reset Request</h1>
      <p>Hello <strong>{{name}}</strong>,</p>
      <p>We received a request to reset your password for your {{app_name}} account. Use the 6-digit recovery code below to set a new password:</p>

      <div class="pin-box">
        <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">SECURITY RECOVERY CODE</div>
        <div class="pin-code">{{code}}</div>
      </div>

      <p style="font-size: 13px; color: #94a3b8;">This code will expire in <strong>15 minutes</strong>. If you did not request a password reset, your account is still secure and no changes were made.</p>
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
      <h2 style="color: #34d399; margin: 0;">CleanTraffic Cloak Enterprise</h2>
    </div>
    <div class="content">
      <h1>Welcome Aboard, {{name}}!</h1>
      <p>Your account is ready. Here is what you get during your 7-day free trial:</p>
      <div class="feature-card">
        <strong style="color: #34d399;">✓ 5,000 Cloaked Requests</strong><br>
        <span style="font-size: 13px; color: #94a3b8;">High-speed visitor classification, residential bot detection, and cloaking routing.</span>
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
      <div class="logo">CleanTraffic <span style="color: #38bdf8;">Cloak</span></div>
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
    app_name: "CleanTraffic Cloak",
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

  // If SMTP is not configured, log simulated delivery and return gracefully
  if (!isConfigured || !transporter) {
    console.log(
      `[Email Service (Simulated)] No SMTP configured. Email to ${to} (${renderedSubject}) recorded in logs.`
    );
    addEmailLog({
      to,
      subject: renderedSubject,
      templateType,
      status: "simulated",
      errorMessage: "SMTP not configured. Email logged in simulation mode.",
      metadata: { variables },
    });
    return {
      success: true,
      simulated: true,
      message: `SMTP not configured yet. Email logged to delivery tracker (Recipient: ${to}).`,
    };
  }

  try {
    const fromAddress = config.fromName ? `"${config.fromName}" <${config.from}>` : config.from;

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject: renderedSubject,
      html: renderedHtml,
      text: plainText,
    });

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

    addEmailLog({
      to,
      subject: renderedSubject,
      templateType,
      status: "failed",
      errorMessage: error?.message || "Unknown SMTP error",
      metadata: { variables },
    });

    return {
      success: false,
      message: error?.message || "Failed to send email via SMTP.",
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
}): Promise<{ success: boolean; message: string; simulated?: boolean }> {
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
}): Promise<{ success: boolean; message: string; simulated?: boolean }> {
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
