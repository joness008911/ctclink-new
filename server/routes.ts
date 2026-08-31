import type { Express } from "express";
import { z } from "zod";
import Stripe from "stripe";
import { randomUUID, randomBytes } from "crypto";
import rateLimit from "express-rate-limit";

// Extend session types
declare module 'express-session' {
  interface SessionData {
    userId?: string; // Admin user ID
    clientUserId?: string; // Client user ID (end-user customers)
    clientUserAuthenticated?: boolean; // Whether client user has verified API key
  }
}

// In-memory token store for iframe cross-origin authentication resilience
interface AuthTokenData {
  type: 'admin' | 'client';
  userId: string;
  authenticated?: boolean;
  expiresAt: number;
}

const authTokens = new Map<string, AuthTokenData>();

// Periodic cleanup of expired tokens
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of authTokens.entries()) {
    if (now > data.expiresAt) {
      authTokens.delete(token);
    }
  }
}, 30 * 60 * 1000);

export function getSessionOrToken(req: any): { type: 'admin' | 'client'; userId: string; authenticated?: boolean } | null {
  // 1. Check Authorization, X-Auth-Token, or X-Client-Token headers first (works across iframes)
  const authHeader = req.headers?.authorization || req.headers?.['x-auth-token'] || req.headers?.['x-client-token'];
  if (authHeader && typeof authHeader === 'string') {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
    if (token && authTokens.has(token)) {
      const data = authTokens.get(token)!;
      if (Date.now() < data.expiresAt) {
        return data;
      } else {
        authTokens.delete(token);
      }
    }
  }

  // 2. Fall back to Cookie Session
  if (req.session?.userId) {
    return { type: 'admin', userId: req.session.userId, authenticated: true };
  }
  if (req.session?.clientUserId) {
    return { 
      type: 'client', 
      userId: req.session.clientUserId, 
      authenticated: !!req.session.clientUserAuthenticated 
    };
  }

  return null;
}
import { createServer, type Server } from "http";
import { storage, ip2geoCache } from "./storage";
import { db } from "./db";
import { sql as sqlTag } from "drizzle-orm";
import session from "express-session";
import createMemoryStore from "memorystore";
const MemoryStore = createMemoryStore(session);
import { insertClassificationSchema, type ClientUser } from "@shared/schema";
import { UAParser } from "ua-parser-js";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import ipaddr from "ipaddr.js";
import { broadcastClassification, setupWebSocketServer } from "./ws";
import {
  getSmtpConfig,
  saveSmtpConfig,
  verifySmtpConnection,
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  getEmailTemplate,
  saveEmailTemplate,
  getEmailLogs,
  renderTemplate,
  defaultEmailTemplates,
  type SmtpConfig,
} from "./emailService";

// ── Rate limiters ──────────────────────────────────────────────────────────
// Brute-force protection for authentication endpoints (admin + client login).
// 10 attempts per IP per 15 minutes; returns 429 with Retry-After header.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,   // RateLimit-* headers (RFC 6585 draft)
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again later." },
});

// Dedicated registration rate limiter: Prevents automated bot account creation and registration abuse.
// 5 registration attempts per IP per 15 minutes.
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many registration attempts from this IP address. Please wait 15 minutes before trying again." },
});

// Rate limiter for verification email dispatch (e.g. forgot-password/verification codes)
// 5 email dispatch requests per IP per 15 minutes to prevent email spamming and quota exhaustion.
const emailVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many verification email requests. Please wait a few minutes before requesting another code." },
});

// Verification PIN code brute-force protection: 10 verification checks per IP per 15 minutes.
const verifyCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many verification code attempts. Please wait 15 minutes before trying again." },
});

// Per-email dispatch cooldown tracker (prevents rapid-fire email bombing to the same address)
const emailDispatchCooldowns = new Map<string, number>();
const EMAIL_COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown between verification emails for the same address

// Per-API-key rate limit for the classification endpoint (GET + POST).
// Key extraction mirrors every path the two handlers accept:
//   POST → X-API-Key header
//   GET  → ?api_key=XXX (standard) | first query param name (legacy)
// Each API key in any supported format gets its own independent bucket.
// Keyless requests (redirected immediately) are bucketed by socket IP to
// prevent them collapsing into one shared slot.
const classifyLimiter = rateLimit({
  windowMs: 60 * 1000,     // 1 minute window
  max: 300,
  keyGenerator: (req) => {
    // Check multiple locations for API key
    const headerKey = ((req.headers["x-api-key"] || req.headers["api-key"]) as string | undefined)?.trim();
    if (headerKey) return headerKey;
    const authHeader = req.headers["authorization"] as string | undefined;
    if (authHeader) {
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
      if (token) return token;
    }
    const bodyKey = (req.body?.apiKey || req.body?.api_key) as string | undefined;
    if (bodyKey?.trim()) return bodyKey.trim();
    const queryKey = (req.query?.api_key || req.query?.apiKey) as string | undefined;
    if (queryKey?.trim()) return queryKey.trim();
    const legacyKey = Object.keys(req.query)[0];
    if (legacyKey) return legacyKey;
    const rawIp =
      (req.socket?.remoteAddress ?? "unknown").replace(/^::ffff:/, "");
    return `nokey:${rawIp}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: false,
  message: { message: "Classification rate limit exceeded. Please slow down." },
});

// 10-minute silent logging: Track last log time for each IP
// First visit logs, subsequent visits within 10 minutes are silent, then logs again after 10 minutes
const ipLastLogTime = new Map<string, number>();
const SILENT_LOG_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

// IP Whitelist Cache: Store whitelist entries and enabled status in memory
// Refreshes every 60 seconds to avoid DB lookups on every /user request
interface WhitelistCache {
  enabled: boolean;
  entries: Array<{ cidr: string; enabled: boolean }>;
  lastRefresh: number;
}
const whitelistCache: WhitelistCache = {
  enabled: false,
  entries: [],
  lastRefresh: 0
};
const WHITELIST_CACHE_TTL = 60 * 1000; // 60 seconds

// Cache invalidation helper - call this when whitelist is modified
export function invalidateWhitelistCache() {
  whitelistCache.lastRefresh = 0; // Force refresh on next request
  console.log('🔄 IP whitelist cache invalidated');
}

// Rate-limited logging for IP whitelist denials (prevent log spam)
const whitelistDenialLog = new Map<string, number>();
function logWhitelistDenial(ip: string) {
  const now = Date.now();
  const lastLog = whitelistDenialLog.get(ip);
  if (!lastLog || (now - lastLog > 60000)) { // Log max once per minute per IP
    console.log(`🚫 IP whitelist: Blocked ${ip} from /user access`);
    whitelistDenialLog.set(ip, now);
  }
}

function isPrivateOrLocalIp(ip: string): boolean {
  if (!ip || ip === 'unknown') return false;
  const clean = ip.replace(/^::ffff:/, '').trim();
  if (clean === '127.0.0.1' || clean === '::1' || clean === 'localhost') return true;
  if (clean.startsWith('10.') || clean.startsWith('192.168.') || clean.startsWith('169.254.')) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) return true;
  return false;
}

export async function getEffectiveIp2GeoKey(): Promise<string> {
  const dbKey = await storage.getSetting('cleantraffic_api_key');
  if (dbKey && dbKey.trim()) return dbKey.trim();
  
  const envKey = process.env.IP2GEOLOCATION_API_KEY || process.env.IP2LOCATION_API_KEY || process.env.IP2GEO_API_KEY;
  if (envKey && envKey.trim()) return envKey.trim();

  try {
    const keyFile = path.join(process.cwd(), 'cleantraffic-php-package', 'api_key.txt');
    if (fs.existsSync(keyFile)) {
      const fileKey = fs.readFileSync(keyFile, 'utf8').trim();
      if (fileKey) return fileKey;
    }
  } catch (e) {}

  return '';
}

async function fetchIpGeolocation(apiKey: string, ip: string, userAgent: string): Promise<any> {
  if (isPrivateOrLocalIp(ip)) {
    return {
      ip,
      location: 'Localhost / Internal Network',
      isp: 'Local Development ISP',
      country_code: 'US',
      country_name: 'United States',
      city_name: 'Localhost',
      region_name: 'Local',
      usage_type: 'RES',
      is_proxy: false,
      proxy_data: null
    };
  }

  if (!apiKey || apiKey.trim() === '') {
    return null;
  }

  // 1. Try IP2Location API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`https://api.ip2location.io/?key=${encodeURIComponent(apiKey)}&ip=${encodeURIComponent(ip)}`, {
      headers: { 'User-Agent': userAgent || 'CleanTraffic/1.0', 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (!data.error && (data.country_name || data.country_code)) {
        return {
          ip,
          location: data.city_name && data.country_name ? `${data.city_name}, ${data.country_name}` : (data.country_name || 'Unknown'),
          isp: data.as || data.isp || 'Unknown',
          country_code: data.country_code || '',
          country_name: data.country_name || 'Unknown',
          city_name: data.city_name || 'Unknown',
          region_name: data.region_name || '',
          usage_type: data.usage_type || '',
          is_proxy: Boolean(data.is_proxy),
          proxy_data: data.proxy || null
        };
      }
    }
  } catch (e) {
    console.warn("IP2Location lookup notice:", e);
  }

  // 2. Try IP2Geolocation.io API fallback
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`https://api.ip2geolocation.io/ipgeo?apiKey=${encodeURIComponent(apiKey)}&ip=${encodeURIComponent(ip)}&include=security`, {
      headers: { 'User-Agent': userAgent || 'CleanTraffic/1.0', 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data.country_name || data.country_code2) {
        const isProxy = data.security?.is_proxy || false;
        const isTor = data.security?.is_tor || false;
        const isCrawler = data.security?.is_crawler || false;
        const isVpn = data.security?.proxy_type?.toLowerCase().includes('vpn') || false;
        const isDch = data.security?.proxy_type?.toLowerCase().includes('dch') || data.security?.proxy_type?.toLowerCase().includes('datacenter') || false;

        return {
          ip,
          location: data.city && data.country_name ? `${data.city}, ${data.country_name}` : (data.country_name || 'Unknown'),
          isp: data.isp || data.organization || 'Unknown',
          country_code: data.country_code2 || '',
          country_name: data.country_name || 'Unknown',
          city_name: data.city || 'Unknown',
          region_name: data.state_prov || '',
          usage_type: isDch ? 'DCH' : (data.usage_type || 'RES'),
          is_proxy: isProxy || isTor || isCrawler || isVpn || isDch,
          proxy_data: {
            is_vpn: isVpn,
            is_tor: isTor,
            is_data_center: isDch,
            is_web_crawler: isCrawler
          }
        };
      }
    }
  } catch (e) {
    console.warn("IP2Geolocation lookup notice:", e);
  }

  return null;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Trust exactly one reverse-proxy hop (Replit's ingress).
  // Using `true` would trust any X-Forwarded-For value, allowing clients to
  // spoof their IP and bypass the auth rate limiter.  With `1`, Express uses
  // the IP inserted by the nearest trusted proxy, which clients cannot forge.
  app.set('trust proxy', 1);
  
  // Clean up old IP log entries every hour to prevent memory leak
  setInterval(() => {
    const now = Date.now();
    const entries = Array.from(ipLastLogTime.entries());
    for (const [ip, lastLogTime] of entries) {
      if (now - lastLogTime > SILENT_LOG_DURATION) {
        ipLastLogTime.delete(ip);
      }
    }
  }, 60 * 60 * 1000); // Run cleanup every hour
  
  // IP Whitelist Middleware - Runs BEFORE session to block unauthorized /user access early
  app.use(async (req, res, next) => {
    // IMPORTANT: Only check /user and /api/user routes.
    // /interface (admin) and /api/classify must ALWAYS be accessible to avoid lockout.
    if (!req.path.startsWith('/user') && !req.path.startsWith('/api/user')) {
      return next();
    }
    
    // Get client IP - trust proxy headers from known reverse proxies
    const clientIp = (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '');
    
    try {
      // Refresh cache if expired
      const now = Date.now();
      if (now - whitelistCache.lastRefresh > WHITELIST_CACHE_TTL) {
        const [enabled, entries] = await Promise.all([
          storage.isClientWhitelistEnabled(),
          storage.getClientIpWhitelist()
        ]);
        whitelistCache.enabled = enabled;
        whitelistCache.entries = entries.filter(e => e.enabled).map(e => ({ cidr: e.cidr, enabled: e.enabled }));
        whitelistCache.lastRefresh = now;
        console.log(`♻️ IP whitelist cache refreshed: ${enabled ? 'ENABLED' : 'DISABLED'}, ${whitelistCache.entries.length} active entries`);
      }
      
      // If whitelist disabled, allow all
      if (!whitelistCache.enabled) {
        return next();
      }
      
      // If whitelist enabled but empty, deny access
      if (whitelistCache.entries.length === 0) {
        logWhitelistDenial(clientIp);
        return res.status(403).json({ message: "Access forbidden: IP not in authorized whitelist" });
      }
      
      // Check if IP is whitelisted using ipaddr.js for CIDR matching
      let isWhitelisted = false;
      const normalizedIp = ipaddr.parse(clientIp);
      
      for (const entry of whitelistCache.entries) {
        try {
          // Check if entry is CIDR range (contains /)
          if (entry.cidr.includes('/')) {
            const [rangeAddr, prefixLength] = ipaddr.parseCIDR(entry.cidr);
            if (normalizedIp.kind() === rangeAddr.kind() && normalizedIp.match(rangeAddr, prefixLength)) {
              isWhitelisted = true;
              break;
            }
          } else {
            // Exact IP match
            if (ipaddr.parse(entry.cidr).toString() === normalizedIp.toString()) {
              isWhitelisted = true;
              break;
            }
          }
        } catch (err) {
          // Invalid CIDR notation in database - skip entry
          console.error(`⚠️ Invalid whitelist entry: ${entry.cidr}`, err);
        }
      }
      
      if (!isWhitelisted) {
        logWhitelistDenial(clientIp);
        return res.status(403).json({ message: "Access forbidden: IP not in authorized whitelist" });
      }
      
      // IP is whitelisted, continue to next middleware
      next();
      
    } catch (error) {
      console.error('🚨 IP whitelist middleware error:', error);
      // Fail-open on error to avoid locking out all users
      next();
    }
  });
  
  // Session middleware
  const sessionSecret = process.env.SESSION_SECRET || "cleantraffic_dev_session_secret_2026_default_secure_key";

  // Capture session middleware reference so we can authenticate WebSocket upgrade requests
  const sessionMw = session({
    store: new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    name: 'ctid', // Obscure the default 'connect.sid' identifier
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Must be false behind reverse proxies / iframe dev environment
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
  });
  app.use(sessionMw);
  
  // Smart routing: Detect API subdomain and redirect browsers
  // IMPORTANT: This runs AFTER session/body parsing so API key validation works properly
  app.use((req, res, next) => {
    const host = req.headers.host || '';
    
    // Check if accessing from api.* subdomain
    if (host.startsWith('api.')) {
      // Allow GET, POST, OPTIONS, and HEAD requests to /api/classify (with query strings)
      // GET = Public classification endpoint
      // POST = PHP script API calls with request body
      // OPTIONS = CORS preflight requests
      // HEAD = Health checks
      // req.path excludes query string, so /api/classify?source=widget works
      const allowedMethods = ['GET', 'POST', 'OPTIONS', 'HEAD'];
      if (allowedMethods.includes(req.method) && req.path === '/api/classify') {
        return next(); // Let it proceed to normal API key validation and CORS handling
      }
      
      // Temporarily allow other routes on the API subdomain as well.
      // Route-level authentication and validation still protect sensitive endpoints.
      return next();
    }
    
    // Continue to normal routes for non-api subdomains
    next();
  });

  // Serve robots.txt to prevent indexing
  app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send(`User-agent: *
Disallow: /
Disallow: /interface
Disallow: /user
Disallow: /api/
Disallow: /assets/

# Prevent all crawling and archiving
Disallow: /*`);
  });

  // Authentication middleware — admin sessions only (via token or session)
  const requireAuth = (req: any, res: any, next: any) => {
    const auth = getSessionOrToken(req);
    if (auth && auth.type === 'admin') {
      req.session.userId = auth.userId;
      (req as any).adminUserId = auth.userId;
      return next();
    }
    res.status(401).json({ message: "Unauthorized. Admin access required." });
  };

  // Download endpoint for PHP package (working version)
  app.get("/download/cleantraffic-php-package", (req, res) => {
    const filePath = path.join(process.cwd(), 'CleanTraffic-PHP-Package-Working.tar.gz');
    res.download(filePath, 'CleanTraffic-PHP-Package-Working.tar.gz', (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(404).json({ message: "File not found" });
      }
    });
  });

  // Direct download endpoint for working package
  app.get("/CleanTraffic-PHP-Package-Working.tar.gz", (req, res) => {
    const filePath = path.join(process.cwd(), 'CleanTraffic-PHP-Package-Working.tar.gz');
    res.download(filePath, 'CleanTraffic-PHP-Package-Working.tar.gz', (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(404).json({ message: "File not found" });
      }
    });
  });

  // ── Audit log helper ──────────────────────────────────────────────────────
  // Fire-and-forget: failures are surfaced to the console but never propagate
  // to the caller, so an audit-log write error cannot break a sensitive action.
  async function auditLog(entry: {
    actorId?: string | null;
    actorType: "admin" | "system";
    action: string;
    targetId?: string | null;
    targetType?: string | null;
    metadata?: Record<string, unknown> | null;
    ipAddress?: string | null;
  }) {
    try {
      await storage.createAuditLog(entry);
    } catch (err) {
      console.error("Audit log write failed:", err);
    }
  }

  // ---- Auth request schemas ----
  const loginSchema = z.object({
    username: z.string().min(1).max(100).trim(),
    password: z.string().min(1).max(256),
  });

  const apiKeySchema = z.object({
    apiKey: z.string().min(1).max(256).trim(),
  });

  const changePasswordSchema = z.object({
    currentPassword: z.string().min(1).max(256),
    newPassword: z.string().min(8).max(256),
  });

  // Login endpoint
  app.post("/api/login", authLimiter, async (req, res) => {
    try {
      const parse = loginSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ message: "Invalid request", errors: parse.error.flatten().fieldErrors });
      }
      const { username, password } = parse.data;

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Generate Admin session token
      const adminToken = "adm_tok_" + randomUUID().replace(/-/g, "");
      authTokens.set(adminToken, {
        type: 'admin',
        userId: user.id,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
      });

      // Set Admin session and clear any client session keys
      req.session.userId = user.id;
      delete (req.session as any).clientUserId;
      delete (req.session as any).clientUserAuthenticated;
      req.session.save((err) => {
        if (err) {
          console.error("Admin session save error:", err);
        }
        void auditLog({
          actorId: user.id,
          actorType: "admin",
          action: "admin.login",
          ipAddress: (req.ip || "").replace("::ffff:", ""),
        });
        res.json({ message: "Login successful", token: adminToken, user: { id: user.id, username: user.username } });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Logout endpoint
  app.post("/api/logout", (req, res) => {
    const authHeader = req.headers?.authorization || req.headers?.['x-auth-token'];
    if (authHeader && typeof authHeader === 'string') {
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
      if (token) authTokens.delete(token);
    }
    req.session.destroy((err) => {
      res.clearCookie('ctid');
      res.json({ message: "Logout successful" });
    });
  });

  // Get current user (Admin)
  app.get("/api/auth/user", requireAuth, async (req: any, res) => {
    try {
      const auth = getSessionOrToken(req);
      const userId = auth?.userId || req.session?.userId;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ id: user.id, username: user.username });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========== CLIENT USER AUTHENTICATION ROUTES ==========

  const clientRegisterSchema = z.object({
    fullName: z.string().max(100).optional(),
    username: z.string().min(3).max(50).trim().optional(),
    email: z.string().email("Please enter a valid email address").max(100).trim(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .max(256)
      .refine((val) => /[a-z]/.test(val), {
        message: "Password must contain at least one lowercase letter (a-z)",
      })
      .refine((val) => /[A-Z]/.test(val), {
        message: "Password must contain at least one uppercase letter (A-Z)",
      })
      .refine((val) => /[0-9]/.test(val) || /[^A-Za-z0-9]/.test(val), {
        message: "Password must contain at least one number (0-9) or special symbol",
      }),
    newsletter: z.boolean().optional(),
    tosAccepted: z.boolean().refine((v) => v === true, {
      message: "You must accept the terms of use and privacy policy.",
    }),
  });

  const googleAuthSchema = z.object({
    email: z.string().email().max(100).trim(),
    name: z.string().max(100).optional(),
    googleId: z.string().min(1).max(256),
    idToken: z.string().optional(),
  });

  // Password recovery store & schemas
  interface PasswordResetData {
    userId: string;
    email: string;
    code: string;
    token: string;
    expiresAt: number;
    failedAttempts: number;
  }
  const passwordResetStore = new Map<string, PasswordResetData>();

  // Email verification store & session tracking
  interface EmailVerificationData {
    userId: string;
    email: string;
    code: string;
    token: string;
    expiresAt: number;
    createdAt: number;
    failedAttempts: number;
  }
  const emailVerificationStore = new Map<string, EmailVerificationData>();

  function createEmailVerificationSession(userId: string, email: string) {
    const cleanEmail = email.toLowerCase().trim();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const token = "ct_ev_" + randomBytes(24).toString("hex");
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    const sessionData: EmailVerificationData = {
      userId,
      email: cleanEmail,
      code,
      token,
      expiresAt,
      createdAt: Date.now(),
      failedAttempts: 0,
    };
    emailVerificationStore.set(cleanEmail, sessionData);
    emailVerificationStore.set(token, sessionData);
    console.log(`[Email Verification] Verification created for ${cleanEmail} -> PIN: ${code}, Link: /verify-email?token=${token}`);
    return sessionData;
  }

  const forgotPasswordSchema = z.object({
    email: z.string().email("Please enter a valid email address").max(100).trim(),
  });

  const verifyResetCodeSchema = z.object({
    email: z.string().email().trim(),
    code: z.string().trim().min(6).max(6),
  });

  const resetPasswordSchema = z.object({
    email: z.string().email().trim(),
    code: z.string().trim().min(6).max(6).optional(),
    token: z.string().optional(),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .max(256)
      .refine((val) => /[a-z]/.test(val), {
        message: "Password must contain at least one lowercase letter (a-z)",
      })
      .refine((val) => /[A-Z]/.test(val), {
        message: "Password must contain at least one uppercase letter (A-Z)",
      })
      .refine((val) => /[0-9]/.test(val) || /[^A-Za-z0-9]/.test(val), {
        message: "Password must contain at least one number (0-9) or special symbol",
      }),
  });

  // Helper to provision trial resources (API key, default redirect URLs) for a client user
  async function provisionTrialForClientUser(userId: string, usernameOrEmail: string) {
    const keyVal = "ctc_" + randomBytes(16).toString("hex");
    const trialDays = 7;
    const expiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

    const apiKey = await storage.createApiKey({
      keyName: `Trial - ${usernameOrEmail}`,
      keyValue: keyVal,
      callLimit: 5000,
      expirationPeriod: "weekly",
      status: "active",
      expiresAt,
    });

    await storage.updateClientUser(userId, {
      apiKeyId: apiKey.id,
      subscriptionStatus: "trialing",
      trialEndsAt: expiresAt,
      complianceStatus: "cleared",
      status: "active",
    });

    await storage.setUserRedirectUrls(userId, {
      humanUrl: "",
      botUrl: "",
    });

    return apiKey;
  }

  // Self-serve registration endpoint with dedicated rate limiting
  app.post("/api/user/register", registerLimiter, async (req, res) => {
    try {
      const parse = clientRegisterSchema.safeParse(req.body);
      if (!parse.success) {
        const fieldErrors = parse.error.flatten().fieldErrors as Record<string, string[] | undefined>;
        const firstErrorKey = Object.keys(fieldErrors)[0];
        const firstErrorMsg = firstErrorKey && fieldErrors[firstErrorKey]?.[0]
          ? fieldErrors[firstErrorKey]![0]
          : "Invalid registration data";
        return res.status(400).json({ message: firstErrorMsg, errors: fieldErrors });
      }
      const { fullName, email, password, newsletter, tosAccepted } = parse.data;
      const cleanEmail = email.toLowerCase().trim();

      // Check if email already exists
      const existingEmail = await storage.getClientUserByEmail(cleanEmail);
      if (existingEmail) {
        return res.status(400).json({ message: "An account with this email address already exists. Please log in." });
      }

      // Generate or normalize username
      let username = parse.data.username?.trim().toLowerCase();
      if (!username) {
        const prefix = cleanEmail.split("@")[0].replace(/[^a-z0-9_]/g, "_");
        username = `${prefix}_${randomBytes(3).toString("hex")}`;
      }

      // Check if username taken
      const existingUser = await storage.getClientUserByUsername(username);
      if (existingUser) {
        username = `${username}_${randomBytes(2).toString("hex")}`;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      const trialDays = 7;
      const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

      // Create client user record with emailVerified: false
      const newUser = await storage.createClientUser({
        username,
        password: hashedPassword,
        fullName: fullName || null,
        email: cleanEmail,
        emailVerified: false,
        emailVerifiedAt: null,
        status: "active",
        subscriptionStatus: "trialing",
        trialEndsAt,
        tosAccepted: new Date(),
        complianceStatus: "cleared",
        newsletter: !!newsletter,
      });

      // Provision trial API key & redirect URLs
      const apiKey = await provisionTrialForClientUser(newUser.id, username);

      // Generate verification session
      const verification = createEmailVerificationSession(newUser.id, cleanEmail);

      // Send real transactional verification email via configured SMTP / Provider
      const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
      const host = req.get('host') || 'localhost:3000';
      const baseUrl = `${protocol}://${host}`;

      sendVerificationEmail({
        to: cleanEmail,
        name: newUser.fullName || newUser.username,
        code: verification.code,
        token: verification.token,
        baseUrl,
      }).catch((err) => console.error("[Registration Email Dispatch Error]:", err));

      // Generate client token
      const clientToken = "ct_cli_" + randomUUID().replace(/-/g, "");
      authTokens.set(clientToken, {
        type: "client",
        userId: newUser.id,
        authenticated: true,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      // Establish session
      delete (req.session as any).userId;
      req.session.clientUserId = newUser.id;
      req.session.clientUserAuthenticated = true;

      req.session.save((err) => {
        if (err) console.error("Registration session save error:", err);
        res.status(201).json({
          message: "Registration successful! A verification email with your 6-digit confirmation code and activation link has been dispatched to your inbox.",
          requiresVerification: true,
          email: cleanEmail,
          token: clientToken,
          verificationToken: verification.token,
          user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            emailVerified: false,
            fullName: newUser.fullName,
            status: "active",
            subscriptionStatus: "trialing",
            trialDaysRemaining: 7,
            trialEndsAt,
          },
          apiKey: {
            name: apiKey.keyName,
            status: apiKey.status,
            callLimit: apiKey.callLimit,
            expirationPeriod: apiKey.expirationPeriod,
          },
        });
      });
    } catch (error) {
      console.error("Client registration error:", error);
      res.status(500).json({ message: "Registration failed. Please try again." });
    }
  });

  // Google OAuth sign-in / sign-up endpoint
  app.post("/api/user/google-auth", authLimiter, async (req, res) => {
    try {
      const parse = googleAuthSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ message: "Invalid Google authentication payload", errors: parse.error.flatten().fieldErrors });
      }
      const { email, name, googleId } = parse.data;
      const cleanEmail = email.toLowerCase().trim();

      // Check if user already exists
      let user = await storage.getClientUserByEmail(cleanEmail);

      if (user) {
        // User exists: verify active status
        if (user.status !== "active") {
          return res.status(403).json({ message: `Account is ${user.status}. Please contact support.` });
        }
        if (user.complianceStatus === "suspended") {
          return res.status(403).json({ message: "Account suspended due to compliance policy. Please contact support." });
        }

        // If user lacks an API key for any reason, auto-provision
        let apiKey = user.apiKeyId ? await storage.getApiKeyById(user.apiKeyId) : null;
        if (!apiKey) {
          apiKey = await provisionTrialForClientUser(user.id, user.username);
        }

        // Generate verified client token
        const clientToken = "ct_cli_" + randomUUID().replace(/-/g, "");
        authTokens.set(clientToken, {
          type: "client",
          userId: user.id,
          authenticated: true,
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });

        delete (req.session as any).userId;
        req.session.clientUserId = user.id;
        req.session.clientUserAuthenticated = true;

        const now = new Date();
        const trialDaysRemaining = user.trialEndsAt
          ? Math.max(0, Math.ceil((user.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          : null;

        return req.session.save((err) => {
          if (err) console.error("Google auth session save error:", err);
          res.json({
            message: "Google sign-in successful",
            token: clientToken,
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              fullName: user.fullName || name,
              status: user.status,
              subscriptionStatus: user.subscriptionStatus,
              trialDaysRemaining,
              trialEndsAt: user.trialEndsAt,
            },
            apiKey: apiKey ? {
              name: apiKey.keyName,
              status: apiKey.status,
              callLimit: apiKey.callLimit,
              expirationPeriod: apiKey.expirationPeriod,
            } : null,
          });
        });
      }

      // New user from Google: auto-register with 7-day trial
      const prefix = cleanEmail.split("@")[0].replace(/[^a-z0-9_]/g, "_");
      let username = `${prefix}_${randomBytes(3).toString("hex")}`;
      const randomPassword = randomBytes(24).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      const trialDays = 7;
      const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

      const newUser = await storage.createClientUser({
        username,
        password: hashedPassword,
        fullName: name || null,
        email: cleanEmail,
        status: "active",
        subscriptionStatus: "trialing",
        trialEndsAt,
        tosAccepted: new Date(),
        complianceStatus: "cleared",
        newsletter: true,
      });

      const apiKey = await provisionTrialForClientUser(newUser.id, username);

      const clientToken = "ct_cli_" + randomUUID().replace(/-/g, "");
      authTokens.set(clientToken, {
        type: "client",
        userId: newUser.id,
        authenticated: true,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      delete (req.session as any).userId;
      req.session.clientUserId = newUser.id;
      req.session.clientUserAuthenticated = true;

      req.session.save((err) => {
        if (err) console.error("Google new user session save error:", err);
        res.status(201).json({
          message: "Welcome to CleanTraffic! Your 7-day free trial has been activated.",
          token: clientToken,
          user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            fullName: newUser.fullName,
            status: "active",
            subscriptionStatus: "trialing",
            trialDaysRemaining: 7,
            trialEndsAt,
          },
          apiKey: {
            name: apiKey.keyName,
            status: apiKey.status,
            callLimit: apiKey.callLimit,
            expirationPeriod: apiKey.expirationPeriod,
          },
        });
      });
    } catch (error) {
      console.error("Google auth error:", error);
      res.status(500).json({ message: "Google authentication failed. Please try again." });
    }
  });

  // Client user login with username or email + password
  app.post("/api/user/login", authLimiter, async (req, res) => {
    try {
      const parse = loginSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ message: "Invalid request", errors: parse.error.flatten().fieldErrors });
      }
      const { username, password } = parse.data;

      // Find client user by username OR email
      const user = await storage.getClientUserByUsernameOrEmail(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Use bcrypt to compare passwords
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if user account is active
      if (user.status !== "active") {
        return res.status(403).json({ message: `Account is ${user.status}. Please contact support.` });
      }

      // Check compliance status before allowing login
      if (user.complianceStatus === "suspended") {
        return res.status(403).json({ message: "Account suspended due to compliance violation. Please contact support." });
      }

      // If user doesn't have an API key yet, auto-provision one
      let apiKey = user.apiKeyId ? await storage.getApiKeyById(user.apiKeyId) : null;
      if (!apiKey) {
        apiKey = await provisionTrialForClientUser(user.id, user.username);
      }

      // Check if ToS is accepted
      if (!user.tosAccepted) {
        const preTosToken = "ct_cli_" + randomUUID().replace(/-/g, "");
        authTokens.set(preTosToken, {
          type: "client",
          userId: user.id,
          authenticated: false,
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });
        delete (req.session as any).userId;
        req.session.clientUserId = user.id;
        req.session.clientUserAuthenticated = false;
        return res.status(200).json({
          message: "Terms of service must be accepted before using this service.",
          requiresTos: true,
          token: preTosToken,
          userId: user.id,
        });
      }

      // Fully authenticated client session
      const clientToken = "ct_cli_" + randomUUID().replace(/-/g, "");
      authTokens.set(clientToken, {
        type: "client",
        userId: user.id,
        authenticated: true,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      delete (req.session as any).userId;
      req.session.clientUserId = user.id;
      req.session.clientUserAuthenticated = true;

      const now = new Date();
      const trialDaysRemaining = user.trialEndsAt
        ? Math.max(0, Math.ceil((user.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null;

      req.session.save((err) => {
        if (err) {
          console.error("Client session save error:", err);
        }
        res.json({
          message: "Login successful",
          token: clientToken,
          userId: user.id,
          username: user.username,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            status: user.status,
            subscriptionStatus: user.subscriptionStatus,
            trialDaysRemaining,
            trialEndsAt: user.trialEndsAt,
          },
          apiKey: apiKey ? {
            name: apiKey.keyName,
            status: apiKey.status,
            expirationPeriod: apiKey.expirationPeriod,
            callLimit: apiKey.callLimit,
          } : null,
          requiresApiKey: false,
          requiresTos: false,
        });
      });
    } catch (error) {
      console.error("Client user login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Password Recovery - Step 1: Request Password Reset Link & Verification Code
  app.post("/api/user/forgot-password", emailVerificationLimiter, async (req, res) => {
    try {
      const parse = forgotPasswordSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ message: "Please provide a valid email address." });
      }
      const cleanEmail = parse.data.email.toLowerCase().trim();

      // Per-target email cooldown check to prevent inbox flooding / email abuse
      const lastSent = emailDispatchCooldowns.get(cleanEmail);
      if (lastSent && Date.now() - lastSent < EMAIL_COOLDOWN_MS) {
        const remainingSec = Math.ceil((EMAIL_COOLDOWN_MS - (Date.now() - lastSent)) / 1000);
        return res.status(429).json({
          message: `A verification code was recently requested for this email. Please wait ${remainingSec} seconds before requesting a new one.`,
          retryAfter: remainingSec,
        });
      }
      emailDispatchCooldowns.set(cleanEmail, Date.now());

      // Look up user by email or username/email
      const user = await storage.getClientUserByEmail(cleanEmail) || await storage.getClientUserByUsernameOrEmail(cleanEmail);
      if (!user) {
        // Safe uniform response to protect account privacy
        return res.json({
          success: true,
          message: "If an account is associated with this email address, a password reset verification code has been generated.",
          email: cleanEmail,
        });
      }

      // Generate 6-digit verification code and reset token
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const token = "pw_rst_" + randomBytes(24).toString("hex");
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes expiration

      const resetData: PasswordResetData = {
        userId: user.id,
        email: cleanEmail,
        code,
        token,
        expiresAt,
        failedAttempts: 0,
      };

      passwordResetStore.set(cleanEmail, resetData);
      passwordResetStore.set(token, resetData);

      // Send real password recovery email via SMTP
      sendPasswordResetEmail({
        to: cleanEmail,
        name: user.fullName || user.username,
        code,
        token,
      }).catch((err) => console.error("[Password Recovery Email Dispatch Error]:", err));

      console.log(`[Password Recovery] Generated reset code ${code} for ${cleanEmail} (userId: ${user.id}, expires: 15m)`);

      return res.json({
        success: true,
        message: "If an account is associated with this email address, a password reset verification code has been dispatched to your email inbox.",
        email: cleanEmail,
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to initiate password recovery. Please try again." });
    }
  });

  // Password Recovery - Step 2: Verify 6-digit Recovery Code with Brute-Force Lockout
  app.post("/api/user/verify-reset-code", verifyCodeLimiter, async (req, res) => {
    try {
      const parse = verifyResetCodeSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ valid: false, message: "Invalid email or 6-digit verification code format." });
      }
      const { email, code } = parse.data;
      const cleanEmail = email.toLowerCase().trim();

      const entry = passwordResetStore.get(cleanEmail);
      if (!entry) {
        return res.status(400).json({ valid: false, message: "No active recovery code found for this email. Please request a new code." });
      }

      if (Date.now() > entry.expiresAt) {
        passwordResetStore.delete(cleanEmail);
        if (entry.token) passwordResetStore.delete(entry.token);
        return res.status(400).json({ valid: false, message: "Verification code has expired. Please request a new one." });
      }

      // Check max failed verification attempts to prevent 6-digit PIN brute forcing
      if (entry.failedAttempts >= 5) {
        passwordResetStore.delete(cleanEmail);
        if (entry.token) passwordResetStore.delete(entry.token);
        return res.status(429).json({
          valid: false,
          message: "Too many incorrect verification attempts. For your security, this code has been invalidated. Please request a new code.",
        });
      }

      if (entry.code !== code.trim()) {
        entry.failedAttempts = (entry.failedAttempts || 0) + 1;
        const attemptsLeft = Math.max(0, 5 - entry.failedAttempts);
        return res.status(400).json({
          valid: false,
          message: attemptsLeft > 0
            ? `Invalid verification code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`
            : "Invalid verification code. Maximum attempts reached.",
        });
      }

      return res.json({ valid: true, token: entry.token });
    } catch (error) {
      console.error("Verify reset code error:", error);
      res.status(500).json({ valid: false, message: "Error verifying recovery code." });
    }
  });

  // Password Recovery - Step 3: Complete Password Reset with New Strong Password
  app.post("/api/user/reset-password", verifyCodeLimiter, async (req, res) => {
    try {
      const parse = resetPasswordSchema.safeParse(req.body);
      if (!parse.success) {
        const fieldErrors = parse.error.flatten().fieldErrors as Record<string, string[] | undefined>;
        const firstErrorKey = Object.keys(fieldErrors)[0];
        const firstErrorMsg = firstErrorKey && fieldErrors[firstErrorKey]?.[0]
          ? fieldErrors[firstErrorKey]![0]
          : "Invalid password reset data";
        return res.status(400).json({ message: firstErrorMsg, errors: fieldErrors });
      }

      const { email, code, token, newPassword } = parse.data;
      const cleanEmail = email.toLowerCase().trim();

      let entry = passwordResetStore.get(cleanEmail);
      if (!entry && token) {
        entry = passwordResetStore.get(token);
      }

      if (!entry) {
        return res.status(400).json({ message: "No active password recovery session found. Please request a new recovery code." });
      }

      if (Date.now() > entry.expiresAt) {
        passwordResetStore.delete(cleanEmail);
        if (entry.token) passwordResetStore.delete(entry.token);
        return res.status(400).json({ message: "Recovery session has expired. Please request a new recovery code." });
      }

      if (entry.failedAttempts >= 5) {
        passwordResetStore.delete(cleanEmail);
        if (entry.token) passwordResetStore.delete(entry.token);
        return res.status(429).json({ message: "Too many incorrect verification attempts. Please request a new recovery code." });
      }

      if (code && entry.code !== code.trim() && (!token || entry.token !== token)) {
        entry.failedAttempts = (entry.failedAttempts || 0) + 1;
        return res.status(400).json({ message: "Invalid verification code." });
      }

      // Hash and update the user's password securely
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateClientUser(entry.userId, {
        password: hashedPassword,
      });

      // Clear the used reset token and cooldowns
      passwordResetStore.delete(cleanEmail);
      if (entry.token) passwordResetStore.delete(entry.token);
      emailDispatchCooldowns.delete(cleanEmail);

      console.log(`[Password Recovery] Successfully reset password for user ${entry.userId} (${cleanEmail})`);

      return res.json({
        success: true,
        message: "Your password has been successfully updated! You can now sign in with your new credentials.",
      });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password. Please try again." });
    }
  });

  // ── Email Verification Endpoints ──────────────────────────────────────────

  const verifyEmailSchema = z.object({
    email: z.string().email().optional(),
    code: z.string().min(4).max(10).optional(),
    token: z.string().optional(),
  });

  // Verify email endpoint (handles both 6-digit code and token)
  app.post("/api/user/verify-email", verifyCodeLimiter, async (req, res) => {
    try {
      const parse = verifyEmailSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ message: "Invalid verification payload", errors: parse.error.flatten().fieldErrors });
      }
      const { email, code, token } = parse.data;
      let entry: EmailVerificationData | undefined;

      if (token) {
        entry = emailVerificationStore.get(token);
      }
      if (!entry && email) {
        entry = emailVerificationStore.get(email.toLowerCase().trim());
      }

      if (!entry) {
        // Check if user is already verified
        if (email) {
          const existing = await storage.getClientUserByEmail(email.toLowerCase().trim());
          if (existing && existing.emailVerified) {
            return res.json({
              success: true,
              alreadyVerified: true,
              message: "Your email address is already verified. You can access all features.",
              user: {
                id: existing.id,
                email: existing.email,
                emailVerified: true,
              },
            });
          }
        }
        return res.status(400).json({
          message: "Invalid or expired verification session. Please request a new verification email.",
        });
      }

      if (Date.now() > entry.expiresAt) {
        emailVerificationStore.delete(entry.email);
        emailVerificationStore.delete(entry.token);
        return res.status(400).json({
          message: "Verification link or code has expired. Please request a new verification email.",
        });
      }

      if (entry.failedAttempts >= 5) {
        emailVerificationStore.delete(entry.email);
        emailVerificationStore.delete(entry.token);
        return res.status(429).json({
          message: "Too many failed attempts. Please request a new verification email.",
        });
      }

      if (code && entry.code !== code.trim() && (!token || entry.token !== token)) {
        entry.failedAttempts = (entry.failedAttempts || 0) + 1;
        const attemptsLeft = Math.max(0, 5 - entry.failedAttempts);
        return res.status(400).json({
          message: attemptsLeft > 0
            ? `Invalid verification code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`
            : "Invalid verification code. Maximum attempts reached.",
        });
      }

      // Mark user email verified in persistent storage
      const user = (await storage.getClientUser(entry.userId)) || (await storage.getClientUserByEmail(entry.email));
      if (!user) {
        return res.status(404).json({ message: "User account not found." });
      }

      const updatedUser = await storage.updateClientUser(user.id, {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      });

      // Clean up verification store
      emailVerificationStore.delete(entry.email);
      emailVerificationStore.delete(entry.token);
      emailDispatchCooldowns.delete(entry.email);

      // Create authenticated client token
      const clientToken = "ct_cli_" + randomUUID().replace(/-/g, "");
      authTokens.set(clientToken, {
        type: "client",
        userId: user.id,
        authenticated: true,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      delete (req.session as any).userId;
      req.session.clientUserId = user.id;
      req.session.clientUserAuthenticated = true;

      console.log(`[Email Verification] Email confirmed for ${user.email} (${user.id})`);

      req.session.save((err) => {
        if (err) console.error("Verify email session save error:", err);
        res.json({
          success: true,
          message: "Email verified successfully! Welcome to CleanTraffic.",
          token: clientToken,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            emailVerified: true,
            emailVerifiedAt: updatedUser?.emailVerifiedAt || new Date(),
            status: user.status,
            subscriptionStatus: user.subscriptionStatus,
          },
        });
      });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ message: "Failed to verify email. Please try again." });
    }
  });

  // GET link verification (for email click-throughs)
  app.get("/api/user/verify-email", async (req, res) => {
    try {
      const token = req.query.token as string | undefined;
      if (!token) {
        return res.redirect("/verification-required?error=missing_token");
      }
      const entry = emailVerificationStore.get(token);
      if (!entry) {
        return res.redirect("/verification-required?error=invalid_or_expired");
      }
      if (Date.now() > entry.expiresAt) {
        emailVerificationStore.delete(entry.email);
        emailVerificationStore.delete(entry.token);
        return res.redirect(`/verification-required?error=expired&email=${encodeURIComponent(entry.email)}`);
      }

      const user = (await storage.getClientUser(entry.userId)) || (await storage.getClientUserByEmail(entry.email));
      if (user) {
        await storage.updateClientUser(user.id, {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        });
        emailVerificationStore.delete(entry.email);
        emailVerificationStore.delete(entry.token);
        emailDispatchCooldowns.delete(entry.email);

        const clientToken = "ct_cli_" + randomUUID().replace(/-/g, "");
        authTokens.set(clientToken, {
          type: "client",
          userId: user.id,
          authenticated: true,
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });
        req.session.clientUserId = user.id;
        req.session.clientUserAuthenticated = true;

        return res.redirect(`/verification-required?status=success&email=${encodeURIComponent(user.email || "")}&token=${clientToken}`);
      }
      return res.redirect("/verification-required?error=user_not_found");
    } catch (error) {
      console.error("GET verify-email error:", error);
      res.redirect("/verification-required?error=server_error");
    }
  });

  // Resend verification email endpoint
  const resendVerificationSchema = z.object({
    email: z.string().email("Please provide a valid email address").max(100).trim(),
  });

  app.post("/api/user/resend-verification", emailVerificationLimiter, async (req, res) => {
    try {
      const parse = resendVerificationSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ message: "Invalid email address", errors: parse.error.flatten().fieldErrors });
      }
      const cleanEmail = parse.data.email.toLowerCase().trim();

      // Per-email cooldown to protect mail delivery systems
      const lastSent = emailDispatchCooldowns.get(cleanEmail);
      if (lastSent && Date.now() - lastSent < EMAIL_COOLDOWN_MS) {
        const remainingSec = Math.ceil((EMAIL_COOLDOWN_MS - (Date.now() - lastSent)) / 1000);
        return res.status(429).json({
          message: `Please wait ${remainingSec} seconds before requesting another verification email.`,
          retryAfter: remainingSec,
        });
      }
      emailDispatchCooldowns.set(cleanEmail, Date.now());

      const user = (await storage.getClientUserByEmail(cleanEmail)) || (await storage.getClientUserByUsernameOrEmail(cleanEmail));
      if (!user) {
        // Return generic message to prevent email enumeration
        return res.json({
          success: true,
          message: "If an account exists with this email, a fresh verification link and code have been sent.",
        });
      }

      if (user.emailVerified) {
        return res.json({
          success: true,
          alreadyVerified: true,
          message: "Your email address is already verified. You can log in directly.",
        });
      }

      const verification = createEmailVerificationSession(user.id, cleanEmail);

      const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
      const host = req.get('host') || 'localhost:3000';
      const baseUrl = `${protocol}://${host}`;

      sendVerificationEmail({
        to: cleanEmail,
        name: user.fullName || user.username,
        code: verification.code,
        token: verification.token,
        baseUrl,
      }).catch((err) => console.error("[Resend Email Dispatch Error]:", err));

      return res.json({
        success: true,
        message: `A new verification email with a fresh 6-digit confirmation code and activation link has been dispatched to ${cleanEmail}. Please check your inbox and spam folder.`,
        expiresAt: verification.expiresAt,
      });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Failed to resend verification email. Please try again." });
    }
  });

  // Check email verification status
  app.get("/api/user/verification-status", async (req, res) => {
    try {
      const emailParam = (req.query.email as string | undefined)?.toLowerCase().trim();
      const auth = getSessionOrToken(req);
      const userId = auth?.userId || req.session?.clientUserId;

      let user: any = null;
      if (userId) {
        user = await storage.getClientUser(userId);
      } else if (emailParam) {
        user = await storage.getClientUserByEmail(emailParam);
      }

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.json({
        email: user.email,
        emailVerified: !!user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        subscriptionStatus: user.subscriptionStatus,
      });
    } catch (error) {
      console.error("Verification status check error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Verify / Attach API key for client user (optional secondary step)
  app.post("/api/user/verify-api-key", async (req, res) => {
    try {
      const parse = apiKeySchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ message: "Invalid request", errors: parse.error.flatten().fieldErrors });
      }
      const { apiKey } = parse.data;

      const auth = getSessionOrToken(req);
      let clientUserId = auth?.userId || req.session?.clientUserId;

      const apiKeyRecord = await storage.getApiKeyByValue(apiKey);
      if (!apiKeyRecord) {
        return res.status(401).json({ message: "Invalid API key" });
      }

      if (!clientUserId) {
        const matchingUser = await storage.getClientUserByApiKey(apiKeyRecord.id);
        if (matchingUser) {
          clientUserId = matchingUser.id;
          req.session.clientUserId = matchingUser.id;
        } else {
          return res.status(401).json({ message: "Please login with your username and password first" });
        }
      }

      const user = await storage.getClientUser(clientUserId);
      if (!user) {
        return res.status(403).json({ message: "User account not found" });
      }

      // If user doesn't have an apiKeyId or wants to attach this valid key
      if (!user.apiKeyId) {
        await storage.updateClientUser(user.id, { apiKeyId: apiKeyRecord.id });
      } else if (user.apiKeyId !== apiKeyRecord.id) {
        return res.status(403).json({ message: "API key does not match your account" });
      }

      if (apiKeyRecord.status === "paused") {
        return res.status(403).json({ message: "API key is paused" });
      }
      if (apiKeyRecord.status === "expired") {
        return res.status(403).json({ message: "API key has expired" });
      }

      if (!user.tosAccepted) {
        const preTosToken = "ct_cli_" + randomUUID().replace(/-/g, "");
        authTokens.set(preTosToken, {
          type: "client",
          userId: user.id,
          authenticated: false,
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });
        delete (req.session as any).userId;
        req.session.clientUserId = user.id;
        req.session.clientUserAuthenticated = false;
        return res.status(200).json({
          message: "Terms of service must be accepted before using this service.",
          requiresTos: true,
          token: preTosToken,
          userId: user.id,
        });
      }

      if (user.complianceStatus === "suspended") {
        return res.status(403).json({ message: "Account suspended due to compliance violation. Please contact support." });
      }

      const verifiedToken = "ct_cli_" + randomUUID().replace(/-/g, "");
      authTokens.set(verifiedToken, {
        type: "client",
        userId: user.id,
        authenticated: true,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      delete (req.session as any).userId;
      req.session.clientUserAuthenticated = true;
      req.session.clientUserId = user.id;

      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.json({
          message: "API key verified successfully",
          token: verifiedToken,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            status: user.status,
          },
          apiKey: {
            name: apiKeyRecord.keyName,
            status: apiKeyRecord.status,
            expirationPeriod: apiKeyRecord.expirationPeriod,
          },
        });
      });
    } catch (error) {
      console.error("API key verification error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Middleware for client user auth — supports token header or session cookie
  const requireClientAuth = (req: any, res: any, next: any) => {
    const auth = getSessionOrToken(req);
    if (auth && auth.type === 'client' && auth.authenticated) {
      req.session.clientUserId = auth.userId;
      req.session.clientUserAuthenticated = true;
      (req as any).clientUserId = auth.userId;
      return next();
    }
    res.status(401).json({ message: "Unauthorized. Please login and verify your API key." });
  };

  // ---- Subscription enforcement middleware ----
  const requireActiveSubscription = async (req: any, res: any, next: any) => {
    try {
      const auth = getSessionOrToken(req);
      const userId = auth?.userId || req.session?.clientUserId;
      if (!userId) return res.status(401).json({ message: "User not found" });
      const user = await storage.getClientUser(userId);
      if (!user) return res.status(401).json({ message: "User not found" });
      const now = new Date();
      if (
        user.subscriptionStatus === 'active' ||
        (user.subscriptionStatus === 'trialing' && (!user.trialEndsAt || user.trialEndsAt > now))
      ) {
        return next();
      }
      return res.status(402).json({
        message: "Your trial has expired or your subscription is inactive. Please upgrade to continue.",
        subscriptionStatus: user.subscriptionStatus,
        trialEndsAt: user.trialEndsAt,
        upgradeRequired: true,
      });
    } catch (error) {
      console.error("Subscription check error:", error);
      next(); // Fail-open on transient error
    }
  };

  // ── Health check ─────────────────────────────────────────────────────────
  // No authentication required; used by uptime monitors and load balancers.
  // Returns 200 + { status, uptime, db } when healthy, 503 when DB is down.
  app.get("/api/health", async (_req, res) => {
    try {
      if (db) {
        await db.execute(sqlTag`SELECT 1`);
      }
      res.json({ status: "ok", uptime: process.uptime(), db: db ? "reachable" : "in-memory" });
    } catch {
      res.status(503).json({ status: "error", uptime: process.uptime(), db: "unreachable" });
    }
  });

  // Get current client user info
  app.get("/api/user/me", requireClientAuth, async (req: any, res) => {
    try {
      const auth = getSessionOrToken(req);
      const userId = auth?.userId || req.session?.clientUserId;
      const user = await storage.getClientUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get API key info
      const apiKey = user.apiKeyId ? await storage.getApiKeyById(user.apiKeyId) : null;
      
      const now = new Date();
      const trialDaysRemaining = user.trialEndsAt
        ? Math.max(0, Math.ceil((user.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null;

      res.json({ 
        id: user.id,
        username: user.username,
        email: user.email,
        emailVerified: !!user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        status: user.status,
        createdAt: user.createdAt,
        // Billing fields
        subscriptionStatus: user.subscriptionStatus,
        trialEndsAt: user.trialEndsAt,
        trialDaysRemaining,
        apiKey: apiKey ? {
          name: apiKey.keyName,
          status: apiKey.status,
          expirationPeriod: apiKey.expirationPeriod,
          callLimit: apiKey.callLimit
        } : null
      });
    } catch (error) {
      console.error("Get client user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Client user logout
  app.post("/api/user/logout", (req, res) => {
    const authHeader = req.headers?.authorization || req.headers?.['x-auth-token'] || req.headers?.['x-client-token'];
    if (authHeader && typeof authHeader === 'string') {
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
      if (token) authTokens.delete(token);
    }
    req.session.destroy((err) => {
      res.clearCookie('ctid');
      res.json({ message: "Logout successful" });
    });
  });

  // Get client user's redirect URLs
  app.get("/api/user/redirect-urls", requireClientAuth, async (req: any, res) => {
    try {
      const userId = req.session.clientUserId;
      const redirectUrls = await storage.getUserRedirectUrls(userId);
      
      res.json(redirectUrls || { 
        humanUrl: "", 
        botUrl: "" 
      });
    } catch (error) {
      console.error("Get user redirect URLs error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update client user's redirect URLs
  app.put("/api/user/redirect-urls", requireClientAuth, async (req: any, res) => {
    try {
      const userId = req.session.clientUserId;
      const { humanUrl, botUrl } = req.body;
      
      if (!humanUrl || !botUrl) {
        return res.status(400).json({ message: "Both humanUrl and botUrl are required" });
      }

      // URL format validation
      let parsedHuman: URL, parsedBot: URL;
      try {
        parsedHuman = new URL(humanUrl);
        parsedBot = new URL(botUrl);
      } catch {
        return res.status(400).json({ message: "Invalid URL format" });
      }

      // Reject non-HTTP(S) protocols
      if (parsedHuman.protocol !== 'http:' && parsedHuman.protocol !== 'https:') {
        return res.status(400).json({ message: "humanUrl must use http or https" });
      }
      if (parsedBot.protocol !== 'http:' && parsedBot.protocol !== 'https:') {
        return res.status(400).json({ message: "botUrl must use http or https" });
      }

      // Block known URL shorteners commonly used in phishing
      const blockedHosts = [
        'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'short.link',
        'is.gd', 'cli.gs', 'pic.gd', 'DwarfURL.com', 'yfrog.com', 'migre.me',
        'ff.im', 'tiny.cc', 'url4.eu', 'tr.im', 'twit.ac', 'su.pr', 'twurl.nl',
        'snipurl.com', 'short.to', 'BudURL.com', 'ping.fm', 'post.ly',
        'Just.as', 'bkite.com', 'snipr.com', 'flic.kr', 'loopt.us',
        'doiop.com', 'twitthis.com', 'ht.ly', 'rubyurl.com', 'om.ly',
        'linkbee.com', 'lnk.co', 'whatsyourname.jp', 'moourl.com',
        'ur1.ca', 'goo.gl', 'dfl8.me', 'shorl.com', 'icanhaz.com',
        'viralurl.com', 'idek.net', 'x.co', 's.id', 'shorturl.at'
      ];
      const humanHost = parsedHuman.hostname.replace(/^www\./, '').toLowerCase();
      const botHost = parsedBot.hostname.replace(/^www\./, '').toLowerCase();
      if (blockedHosts.includes(humanHost) || blockedHosts.includes(botHost)) {
        return res.status(400).json({ message: "URL shorteners are not allowed" });
      }

      // Block redirecting to known phishing/login targets
      const suspiciousPaths = [
        '/login', '/signin', '/auth', '/account', '/password', '/verify',
        '/confirm', '/secure', '/banking', '/wallet', '/crypto'
      ];
      const humanPath = parsedHuman.pathname.toLowerCase();
      const botPath = parsedBot.pathname.toLowerCase();
      const hasSuspiciousPath = suspiciousPaths.some(p => humanPath.includes(p) || botPath.includes(p));
      if (hasSuspiciousPath) {
        return res.status(400).json({ message: "Redirect URLs containing login or banking paths are not permitted" });
      }

      // Log URL update for compliance audit trail
      console.log(`[COMPLIANCE] User ${userId} updated redirect URLs: human=${parsedHuman.hostname} bot=${parsedBot.hostname}`);

      const updated = await storage.setUserRedirectUrls(userId, { humanUrl, botUrl });
      res.json(updated);
    } catch (error) {
      console.error("Update user redirect URLs error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get client user's classifications (their traffic logs)
  app.get("/api/user/classifications", requireClientAuth, requireActiveSubscription, async (req: any, res) => {
    try {
      const user = await storage.getClientUser(req.session.clientUserId);
      if (!user || !user.apiKeyId) {
        return res.json([]);
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const classifications = await storage.getUserClassifications(user.apiKeyId, limit);
      
      // Filter out sensitive data (IP addresses) from client user view for privacy
      const filteredClassifications = classifications.map(c => ({
        id: c.id,
        location: c.location,
        country: c.country,
        countryCode: c.countryCode,
        city: c.city,
        region: c.region,
        visitorType: c.visitorType,
        detectionMethod: c.detectionMethod,
        connectionType: c.connectionType,
        isp: c.isp,
        browser: c.browser,
        deviceType: c.deviceType,
        timestamp: c.timestamp,
        // ipAddress excluded for privacy
      }));
      
      res.json(filteredClassifications);
    } catch (error) {
      console.error("Get user classifications error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get client user's statistics
  app.get("/api/user/stats", requireClientAuth, requireActiveSubscription, async (req: any, res) => {
    try {
      const user = await storage.getClientUser(req.session.clientUserId);
      if (!user || !user.apiKeyId) {
        return res.json({
          totalClassifications: 0,
          humanVisitors: 0,
          botTraffic: 0
        });
      }

      const stats = await storage.getUserStats(user.apiKeyId);
      res.json(stats);
    } catch (error) {
      console.error("Get user stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Change client user password
  app.post("/api/user/change-password", requireClientAuth, async (req: any, res) => {
    try {
      const parse = changePasswordSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ message: "Invalid request", errors: parse.error.flatten().fieldErrors });
      }
      const { currentPassword, newPassword } = parse.data;
      const userId = req.session.clientUserId;

      const user = await storage.getClientUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password using bcrypt
      const passwordMatch = await bcrypt.compare(currentPassword, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Hash new password before storing
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateClientUser(userId, { password: hashedPassword });

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Accept Terms of Service
  app.post("/api/user/accept-tos", async (req: any, res) => {
    try {
      const auth = getSessionOrToken(req);
      const userId = auth?.userId || req.session?.clientUserId || req.body?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Please login first" });
      }

      const user = await storage.getClientUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      await storage.updateClientUser(userId, {
        tosAccepted: new Date(),
        complianceStatus: 'cleared'
      });

      // Complete authentication token
      const verifiedToken = "ct_cli_" + randomUUID().replace(/-/g, "");
      authTokens.set(verifiedToken, {
        type: 'client',
        userId: user.id,
        authenticated: true,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
      });

      // Complete session
      delete (req.session as any).userId;
      req.session.clientUserId = user.id;
      req.session.clientUserAuthenticated = true;
      req.session.save?.(() => {});

      const apiKeyRecord = user.apiKeyId ? await storage.getApiKeyById(user.apiKeyId) : null;

      res.json({ 
        message: "Terms of service accepted successfully",
        token: verifiedToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          status: user.status
        },
        apiKey: apiKeyRecord ? {
          name: apiKeyRecord.keyName,
          status: apiKeyRecord.status,
          expirationPeriod: apiKeyRecord.expirationPeriod
        } : null
      });
    } catch (error) {
      console.error("Accept ToS error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get client user's API key details (for license management)
  app.get("/api/user/api-key-details", requireClientAuth, async (req: any, res) => {
    try {
      const user = await storage.getClientUser(req.session.clientUserId);
      if (!user || !user.apiKeyId) {
        return res.json(null);
      }

      const apiKey = await storage.getApiKeyById(user.apiKeyId);
      if (!apiKey) {
        return res.json(null);
      }

      // Return masked key and details
      const keyValue = apiKey.keyValue;
      const masked = keyValue.length > 8 
        ? `${keyValue.substring(0, 4)}${'*'.repeat(keyValue.length - 8)}${keyValue.substring(keyValue.length - 4)}`
        : '****';

      res.json({
        id: apiKey.id,
        keyName: apiKey.keyName,
        keyPreview: masked,
        status: apiKey.status,
        callLimit: apiKey.callLimit,
        callCount: apiKey.callCount,
        expirationPeriod: apiKey.expirationPeriod,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      });
    } catch (error) {
      console.error("Get API key details error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get client user's full API key value (for PHP script generation)
  app.get("/api/user/api-key-value", requireClientAuth, async (req: any, res) => {
    try {
      const user = await storage.getClientUser(req.session.clientUserId);
      if (!user || !user.apiKeyId) {
        return res.json({ keyValue: null });
      }

      const apiKey = await storage.getApiKeyById(user.apiKeyId);
      if (!apiKey) {
        return res.json({ keyValue: null });
      }

      // Return full key value (user needs this for PHP script)
      res.json({ keyValue: apiKey.keyValue });
    } catch (error) {
      console.error("Get API key value error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========== END CLIENT USER ROUTES ==========

  // ========== ADMIN CLIENT USER MANAGEMENT ROUTES ==========
  
  // Get all client users (Admin only)
  app.get("/api/interface/client-users", requireAuth, async (req, res) => {
    try {
      const users = await storage.getAllClientUsers();
      res.json(users);
    } catch (error) {
      console.error("Get client users error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update client user compliance status (Admin only)
  app.patch("/api/interface/client-users/:id/compliance", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { complianceStatus } = req.body;

      if (!complianceStatus || !['pending', 'cleared', 'flagged', 'suspended'].includes(complianceStatus)) {
        return res.status(400).json({ message: "Invalid compliance status. Must be: pending, cleared, flagged, suspended" });
      }

      const updated = await storage.updateClientUser(id, { complianceStatus });
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      console.log(`[COMPLIANCE] Admin updated user ${id} compliance status to ${complianceStatus}`);
      void auditLog({
        actorId: (req as any).session?.userId,
        actorType: "admin",
        action: "compliance.updated",
        targetId: id,
        targetType: "client_user",
        metadata: { complianceStatus },
      });
      res.json({ success: true, user: updated });
    } catch (error) {
      console.error("Update compliance status error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Audit log viewer (Admin only)
  app.get("/api/interface/audit-logs", requireAuth, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const logs = await storage.getRecentAuditLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Get audit logs error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get compliance dashboard stats (Admin only)
  app.get("/api/interface/compliance/stats", requireAuth, async (req, res) => {
    try {
      const users = await storage.getAllClientUsers();
      const stats = {
        totalUsers: users.length,
        pending: users.filter(u => u.complianceStatus === 'pending').length,
        cleared: users.filter(u => u.complianceStatus === 'cleared').length,
        flagged: users.filter(u => u.complianceStatus === 'flagged').length,
        suspended: users.filter(u => u.complianceStatus === 'suspended').length,
        tosNotAccepted: users.filter(u => !u.tosAccepted).length
      };
      res.json(stats);
    } catch (error) {
      console.error("Get compliance stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create a client user (Admin only)
  app.post("/api/interface/client-users", requireAuth, async (req, res) => {
    try {
      const { username, password, email, apiKeyId } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      // Check if username already exists
      const existingUser = await storage.getClientUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // If apiKeyId is provided, verify it exists
      if (apiKeyId) {
        const apiKey = await storage.getApiKeyById(apiKeyId);
        if (!apiKey) {
          return res.status(400).json({ message: "Invalid API key ID" });
        }
      }

      // Hash password before storing
      const hashedPassword = await bcrypt.hash(password, 10);

      // Start a 14-day trial for every new client user
      const trialDays = 14;
      const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

      const newUser = await storage.createClientUser({
        username,
        password: hashedPassword,
        email: email || null,
        apiKeyId: apiKeyId || null,
        status: 'active',
        subscriptionStatus: 'trialing',
        trialEndsAt,
      });

      void auditLog({
        actorId: (req as any).session?.userId,
        actorType: "admin",
        action: "client_user.created",
        targetId: newUser.id,
        targetType: "client_user",
        metadata: { username },
      });
      res.json(newUser);
    } catch (error) {
      console.error("Create client user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete a client user (Admin only)
  app.delete("/api/interface/client-users/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if user exists
      const user = await storage.getClientUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // For now, we don't have a delete method, so we'll suspend the user instead
      const updated = await storage.updateClientUser(id, { status: 'suspended' });

      void auditLog({
        actorId: (req as any).session?.userId,
        actorType: "admin",
        action: "client_user.suspended",
        targetId: id,
        targetType: "client_user",
        metadata: { username: user.username },
      });
      res.json({ message: "User suspended", user: updated });
    } catch (error) {
      console.error("Delete client user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========== END ADMIN CLIENT USER MANAGEMENT ROUTES ==========

  // ========== EMAIL & SMTP MANAGEMENT ROUTES ==========

  // 1. Get SMTP Configuration
  app.get("/api/interface/email/settings", requireAuth, async (req, res) => {
    try {
      const config = await getSmtpConfig();
      res.json({
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
        passMasked: config.pass ? "••••••••" : "",
        isConfigured: !!(config.host && config.user && config.pass),
        from: config.from,
        fromName: config.fromName,
        providerPreset: config.providerPreset || "custom",
      });
    } catch (error: any) {
      console.error("Get email settings error:", error);
      res.status(500).json({ message: "Failed to retrieve email settings" });
    }
  });

  // 2. Save SMTP Configuration
  const saveSmtpSchema = z.object({
    host: z.string().trim(),
    port: z.coerce.number().int().min(1).max(65535),
    secure: z.boolean().default(false),
    user: z.string().trim(),
    pass: z.string().optional(),
    from: z.string().email("Invalid sender email address").trim(),
    fromName: z.string().trim().default("CleanTraffic Cloak"),
    providerPreset: z.string().default("custom"),
  });

  app.post("/api/interface/email/settings", requireAuth, async (req, res) => {
    try {
      const parse = saveSmtpSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ message: "Invalid SMTP settings", errors: parse.error.flatten().fieldErrors });
      }

      await saveSmtpConfig(parse.data);
      const updated = await getSmtpConfig();

      void auditLog({
        actorId: (req as any).session?.userId,
        actorType: "admin",
        action: "email.update_smtp_settings",
        metadata: { host: updated.host, port: updated.port, from: updated.from, preset: updated.providerPreset },
      });

      res.json({
        message: "SMTP settings saved and updated successfully!",
        isConfigured: !!(updated.host && updated.user && updated.pass),
        settings: {
          host: updated.host,
          port: updated.port,
          secure: updated.secure,
          user: updated.user,
          passMasked: updated.pass ? "••••••••" : "",
          from: updated.from,
          fromName: updated.fromName,
          providerPreset: updated.providerPreset,
        },
      });
    } catch (error: any) {
      console.error("Save email settings error:", error);
      res.status(500).json({ message: "Failed to save SMTP settings" });
    }
  });

  // 3. Test SMTP Connection & Send Test Email
  const testSmtpSchema = z.object({
    host: z.string().optional(),
    port: z.coerce.number().optional(),
    secure: z.boolean().optional(),
    user: z.string().optional(),
    pass: z.string().optional(),
    from: z.string().optional(),
    fromName: z.string().optional(),
    testRecipient: z.string().email().optional(),
  });

  app.post("/api/interface/email/test-connection", requireAuth, async (req, res) => {
    try {
      const parse = testSmtpSchema.safeParse(req.body);
      const testData = parse.success ? parse.data : {};
      
      const configOverride: Partial<SmtpConfig> = {};
      if (testData.host) configOverride.host = testData.host;
      if (testData.port) configOverride.port = testData.port;
      if (testData.secure !== undefined) configOverride.secure = testData.secure;
      if (testData.user) configOverride.user = testData.user;
      if (testData.pass && testData.pass !== "••••••••") configOverride.pass = testData.pass;
      if (testData.from) configOverride.from = testData.from;
      if (testData.fromName) configOverride.fromName = testData.fromName;

      const result = await verifySmtpConnection(configOverride);

      if (!result.success) {
        return res.status(400).json(result);
      }

      // If test recipient provided, send an actual test email
      if (testData.testRecipient) {
        const sendResult = await sendEmail({
          to: testData.testRecipient,
          subject: "CleanTraffic Cloak - SMTP Connection Test",
          html: `<div style="font-family:sans-serif; background:#0b0f19; color:#f8fafc; padding:32px; border-radius:12px;">
            <h2 style="color:#38bdf8; margin-top:0;">✅ SMTP Integration Verified!</h2>
            <p>Congratulations! Your SMTP settings on CleanTraffic Cloak are functioning properly.</p>
            <p style="color:#94a3b8; font-size:13px;">Sent at: ${new Date().toUTCString()}</p>
          </div>`,
          templateType: "test_connection",
        });

        if (!sendResult.success) {
          return res.status(400).json({
            success: false,
            message: `SMTP connected, but failed to deliver test email to ${testData.testRecipient}: ${sendResult.message}`,
          });
        }

        return res.json({
          success: true,
          message: `Connection successful! Test email delivered to ${testData.testRecipient}.`,
        });
      }

      res.json(result);
    } catch (error: any) {
      console.error("Test SMTP error:", error);
      res.status(500).json({ success: false, message: error?.message || "Internal error testing SMTP" });
    }
  });

  // 4. Get Email Templates
  app.get("/api/interface/email/templates", requireAuth, async (req, res) => {
    try {
      const types: (keyof typeof defaultEmailTemplates)[] = ["verification", "reset", "welcome", "custom", "newsletter"];
      const templates: Record<string, { subject: string; html: string; defaultSubject: string; defaultHtml: string }> = {};

      for (const t of types) {
        const stored = await getEmailTemplate(t);
        const def = defaultEmailTemplates[t] || defaultEmailTemplates.custom;
        templates[t] = {
          subject: stored.subject,
          html: stored.html,
          defaultSubject: def.subject,
          defaultHtml: def.html,
        };
      }

      res.json({ templates });
    } catch (error: any) {
      console.error("Get templates error:", error);
      res.status(500).json({ message: "Failed to load email templates" });
    }
  });

  // 5. Save Email Template
  const saveTemplateSchema = z.object({
    type: z.enum(["verification", "reset", "welcome", "custom", "newsletter"]),
    subject: z.string().min(1, "Subject is required"),
    html: z.string().min(1, "HTML content is required"),
  });

  app.post("/api/interface/email/templates", requireAuth, async (req, res) => {
    try {
      const parse = saveTemplateSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ message: "Invalid template payload", errors: parse.error.flatten().fieldErrors });
      }

      const { type, subject, html } = parse.data;
      await saveEmailTemplate(type, { subject, html });

      void auditLog({
        actorId: (req as any).session?.userId,
        actorType: "admin",
        action: `email.update_template_${type}`,
        metadata: { subject },
      });

      res.json({ message: `Template '${type}' saved and activated successfully!` });
    } catch (error: any) {
      console.error("Save template error:", error);
      res.status(500).json({ message: "Failed to save email template" });
    }
  });

  // 6. Preview Template with Sample Variables
  app.post("/api/interface/email/templates/preview", requireAuth, async (req, res) => {
    try {
      const { subject = "", html = "", sampleVars = {} } = req.body;
      const sampleVariables = {
        name: "Alex Mercer",
        username: "alex_m",
        email: "alex.mercer@enterprise.io",
        code: "839201",
        verification_link: "https://cleantraffic.io/verify-email?token=ct_demo_preview_token",
        reset_link: "https://cleantraffic.io/signin",
        app_name: "CleanTraffic Cloak",
        support_email: "support@cleantraffic.io",
        current_year: String(new Date().getFullYear()),
        login_link: "https://cleantraffic.io/signin",
        api_key: "ctc_9f83a210c44e9912",
        custom_message: `<p>We are rolling out new residential bot cloaking algorithms. Your traffic filters have automatically been updated with zero downtime.</p>`,
        ...sampleVars,
      };

      const renderedSubject = renderTemplate(subject, sampleVariables);
      const renderedHtml = renderTemplate(html, sampleVariables);

      res.json({ renderedSubject, renderedHtml });
    } catch (error: any) {
      console.error("Preview template error:", error);
      res.status(500).json({ message: "Failed to render template preview" });
    }
  });

  // 7. Send Direct Email to a Specific User
  const sendToUserSchema = z.object({
    userId: z.string().optional(),
    email: z.string().email("Valid email required"),
    subject: z.string().min(1, "Subject is required"),
    message: z.string().min(1, "Message is required"),
    name: z.string().optional(),
    isHtml: z.boolean().default(true),
  });

  app.post("/api/interface/email/send-to-user", requireAuth, async (req, res) => {
    try {
      const parse = sendToUserSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ message: "Invalid email parameters", errors: parse.error.flatten().fieldErrors });
      }

      const { email, subject, message, name, isHtml } = parse.data;

      // Wrap custom message in standard CleanTraffic branded container if it's plain text
      let htmlContent = message;
      if (!message.includes("<html") && !message.includes("<div")) {
        const customTpl = await getEmailTemplate("custom");
        htmlContent = renderTemplate(customTpl.html, {
          subject,
          custom_message: message.split("\n").map(p => `<p style="margin: 0 0 16px;">${p}</p>`).join(""),
          name: name || email.split("@")[0],
          email,
        });
      }

      const result = await sendEmail({
        to: email,
        subject,
        html: htmlContent,
        templateType: "direct_admin_message",
        variables: { name, email },
      });

      void auditLog({
        actorId: (req as any).session?.userId,
        actorType: "admin",
        action: "email.send_direct",
        metadata: { to: email, subject, status: result.success ? "success" : "failed" },
      });

      res.json(result);
    } catch (error: any) {
      console.error("Send email to user error:", error);
      res.status(500).json({ success: false, message: error?.message || "Failed to send email" });
    }
  });

  // 8. Send Newsletter / Broadcast Email
  const broadcastSchema = z.object({
    audience: z.enum(["all", "newsletter", "active_trial", "active_subscribers"]).default("all"),
    subject: z.string().min(1, "Subject is required"),
    message: z.string().min(1, "Message is required"),
  });

  app.post("/api/interface/email/broadcast", requireAuth, async (req, res) => {
    try {
      const parse = broadcastSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ message: "Invalid broadcast parameters", errors: parse.error.flatten().fieldErrors });
      }

      const { audience, subject, message } = parse.data;
      const allUsers = await storage.getAllClientUsers();

      // Filter audience
      let recipients = allUsers.filter(u => u.email && u.email.includes("@"));

      if (audience === "newsletter") {
        recipients = recipients.filter(u => u.newsletter === true);
      } else if (audience === "active_trial") {
        recipients = recipients.filter(u => u.subscriptionStatus === "trialing" && u.status === "active");
      } else if (audience === "active_subscribers") {
        recipients = recipients.filter(u => u.subscriptionStatus === "active");
      }

      if (recipients.length === 0) {
        return res.json({
          success: true,
          sentCount: 0,
          failedCount: 0,
          message: "No users matched the selected audience criteria.",
        });
      }

      const newsletterTpl = await getEmailTemplate("newsletter");
      let successCount = 0;
      let failCount = 0;

      // Process delivery
      for (const u of recipients) {
        const userEmail = u.email!.trim();
        const userName = u.fullName || u.username;
        const html = renderTemplate(newsletterTpl.html, {
          subject,
          custom_message: message.split("\n").map(p => `<p style="margin: 0 0 16px;">${p}</p>`).join(""),
          name: userName,
          email: userEmail,
        });

        const res = await sendEmail({
          to: userEmail,
          subject,
          html,
          templateType: "broadcast_newsletter",
          variables: { name: userName, email: userEmail },
        });

        if (res.success) successCount++;
        else failCount++;
      }

      void auditLog({
        actorId: (req as any).session?.userId,
        actorType: "admin",
        action: "email.broadcast",
        metadata: { audience, subject, totalRecipients: recipients.length, successCount, failCount },
      });

      res.json({
        success: true,
        sentCount: successCount,
        failedCount: failCount,
        totalRecipients: recipients.length,
        message: `Broadcast complete: ${successCount} emails delivered (${failCount} failed).`,
      });
    } catch (error: any) {
      console.error("Broadcast email error:", error);
      res.status(500).json({ success: false, message: error?.message || "Failed to process broadcast" });
    }
  });

  // 9. Get Outbound Email Logs
  app.get("/api/interface/email/logs", requireAuth, async (req, res) => {
    try {
      const logs = await getEmailLogs();
      res.json({ logs });
    } catch (error: any) {
      console.error("Get email logs error:", error);
      res.status(500).json({ message: "Failed to retrieve email logs" });
    }
  });

  // ========== END EMAIL & SMTP MANAGEMENT ROUTES ==========

  // ========== WHITE-LABEL DOMAIN SETTINGS ==========
  
  // Get white-label domain setting
  app.get("/api/interface/whitelabel-domain", requireAuth, async (req, res) => {
    try {
      const domain = await storage.getSetting('whitelabel_domain');
      res.json({ domain: domain || '' });
    } catch (error) {
      console.error("Get white-label domain error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Set white-label domain setting
  app.post("/api/interface/whitelabel-domain", requireAuth, async (req, res) => {
    try {
      const { domain } = req.body;
      
      if (!domain || typeof domain !== 'string') {
        return res.status(400).json({ message: "Domain is required" });
      }
      
      await storage.setSetting('whitelabel_domain', domain);
      res.json({ message: "White-label domain updated successfully", domain });
    } catch (error) {
      console.error("Set white-label domain error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Get white-label domain (public - for user dashboard PHP script generation)
  app.get("/api/whitelabel-domain", async (req, res) => {
    try {
      const domain = await storage.getSetting('whitelabel_domain');
      res.json({ domain: domain || '' });
    } catch (error) {
      console.error("Get white-label domain error:", error);
      // Fallback to empty string if not set
      res.json({ domain: '' });
    }
  });
  
  // ========== END WHITE-LABEL DOMAIN SETTINGS ==========

  // Get API keys (protected)
  app.get("/api/api-keys", requireAuth, async (req, res) => {
    try {
      const apiKeys = await storage.getApiKeys();
      res.json(apiKeys);
    } catch (error) {
      console.error("Get API keys error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create API key (protected)
  app.post("/api/api-keys", requireAuth, async (req, res) => {
    try {
      const { keyName, keyValue, expirationPeriod, callLimit } = req.body;
      
      if (!keyName || !keyValue) {
        return res.status(400).json({ message: "Key name and value are required" });
      }

      // Validate expirationPeriod
      const validPeriods = ['10seconds', '1minute', '1hour', 'daily', 'weekly', 'monthly', 'unlimited'];
      const period = expirationPeriod || 'unlimited';
      if (!validPeriods.includes(period)) {
        return res.status(400).json({ message: "Invalid expiration period" });
      }

      // Validate callLimit (allow low limits for testing)
      const limit = parseInt(callLimit) || 1000;
      if (limit < 1 || limit > 100000) {
        return res.status(400).json({ message: "Call limit must be between 1 and 100,000" });
      }

      // Check if key value already exists
      const existingKey = await storage.getApiKey(keyValue);
      if (existingKey) {
        return res.status(400).json({ message: "API key value already exists" });
      }

      const apiKey = await storage.createApiKey({
        keyName,
        keyValue,
        expirationPeriod: period,
        callLimit: limit
      });

      void auditLog({
        actorId: (req as any).session?.userId,
        actorType: "admin",
        action: "api_key.created",
        targetId: apiKey.id,
        targetType: "api_key",
        metadata: { keyName },
      });
      res.json(apiKey);
    } catch (error) {
      console.error("Create API key error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete API key (protected)
  app.delete("/api/api-keys/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteApiKey(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "API key not found" });
      }

      void auditLog({
        actorId: (req as any).session?.userId,
        actorType: "admin",
        action: "api_key.deleted",
        targetId: id,
        targetType: "api_key",
      });
      res.json({ message: "API key deleted successfully" });
    } catch (error) {
      console.error("Delete API key error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Pause/Resume API key (Admin or Key Owner)
  app.post("/api/api-keys/:id/pause", async (req: any, res) => {
    try {
      const auth = getSessionOrToken(req);
      if (!auth) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;

      // If client user, strictly validate ownership of this API key
      if (auth.type === 'client') {
        const clientUser = await storage.getClientUser(auth.userId);
        if (!clientUser || clientUser.apiKeyId !== id) {
          return res.status(403).json({ message: "Forbidden. You can only manage your own API key." });
        }
      }

      const paused = await storage.pauseApiKey(id);
      
      if (!paused) {
        return res.status(404).json({ message: "API key not found" });
      }

      void auditLog({
        actorId: auth.userId,
        actorType: auth.type === "admin" ? "admin" : "system",
        action: "api_key.paused",
        targetId: id,
        targetType: "api_key",
      });
      res.json({ message: "API key paused successfully" });
    } catch (error) {
      console.error("Pause API key error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Resume API key (Admin or Key Owner)
  app.post("/api/api-keys/:id/resume", async (req: any, res) => {
    try {
      const auth = getSessionOrToken(req);
      if (!auth) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;

      // If client user, strictly validate ownership of this API key
      if (auth.type === 'client') {
        const clientUser = await storage.getClientUser(auth.userId);
        if (!clientUser || clientUser.apiKeyId !== id) {
          return res.status(403).json({ message: "Forbidden. You can only manage your own API key." });
        }
      }

      const resumed = await storage.pauseApiKey(id); // pauseApiKey toggles, so it resumes paused keys
      
      if (!resumed) {
        return res.status(404).json({ message: "API key not found" });
      }

      void auditLog({
        actorId: auth.userId,
        actorType: auth.type === "admin" ? "admin" : "system",
        action: "api_key.resumed",
        targetId: id,
        targetType: "api_key",
      });
      res.json({ message: "API key resumed successfully" });
    } catch (error) {
      console.error("Resume API key error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Renew API key (protected)
  app.post("/api/api-keys/:id/renew", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const renewed = await storage.renewApiKey(id);
      
      if (!renewed) {
        return res.status(404).json({ message: "API key not found" });
      }

      void auditLog({
        actorId: (req as any).session?.userId,
        actorType: "admin",
        action: "api_key.renewed",
        targetId: id,
        targetType: "api_key",
      });
      res.json(renewed);
    } catch (error) {
      console.error("Renew API key error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper function to extract API key from any request location
  function extractApiKeyFromRequest(req: any): string {
    const headerKey = ((req.headers['x-api-key'] || req.headers['api-key']) as string | undefined)?.trim();
    if (headerKey) return headerKey;
    const authHeader = req.headers['authorization'] as string | undefined;
    if (authHeader) {
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
      if (token) return token;
    }
    const bodyKey = (req.body?.apiKey || req.body?.api_key) as string | undefined;
    if (bodyKey?.trim()) return bodyKey.trim();
    const queryKey = (req.query?.api_key || req.query?.apiKey) as string | undefined;
    if (queryKey?.trim()) return queryKey.trim();
    const queryKeys = Object.keys(req.query || {});
    if (queryKeys.length > 0 && queryKeys[0] && !queryKeys[0].includes('=')) {
      return queryKeys[0].trim();
    }
    return '';
  }

  // Centralized API key validator for /api/classify traffic routing
  async function validateApiKeyForClassification(apiKey: string | null): Promise<{
    valid: boolean;
    statusCode: number;
    message: string;
    apiKeyId: string | null;
    limitReached: boolean;
  }> {
    if (!apiKey || !apiKey.trim()) {
      return {
        valid: false,
        statusCode: 401,
        message: "API key is required. Please provide a valid API key.",
        apiKeyId: null,
        limitReached: false,
      };
    }

    const cleanKey = apiKey.trim();
    const validKey = (await storage.getApiKey(cleanKey)) || (await storage.getApiKeyById(cleanKey));

    if (!validKey) {
      return {
        valid: false,
        statusCode: 401,
        message: "Invalid API key. The provided key was not found or has been deleted.",
        apiKeyId: null,
        limitReached: false,
      };
    }

    if (validKey.enabled === false || validKey.status === "disabled") {
      return {
        valid: false,
        statusCode: 403,
        message: "API key has been disabled. Please contact support.",
        apiKeyId: validKey.id,
        limitReached: true,
      };
    }

    if (validKey.status === "revoked") {
      return {
        valid: false,
        statusCode: 403,
        message: "API key has been revoked.",
        apiKeyId: validKey.id,
        limitReached: true,
      };
    }

    if (validKey.status === "paused") {
      return {
        valid: false,
        statusCode: 403,
        message: "API key is currently paused in the dashboard.",
        apiKeyId: validKey.id,
        limitReached: true,
      };
    }

    const now = Date.now();
    if (validKey.status === "expired" || (validKey.expiresAt && new Date(validKey.expiresAt).getTime() < now)) {
      return {
        valid: false,
        statusCode: 403,
        message: "API key has expired. Please renew your subscription in the dashboard.",
        apiKeyId: validKey.id,
        limitReached: true,
      };
    }

    // Check subscription status for the API key owner account
    let limitReached = false;
    const keyOwner = await storage.getClientUserByApiKey(validKey.id);
    if (keyOwner) {
      const nowDate = new Date();
      const subActive =
        keyOwner.subscriptionStatus === "active" ||
        (keyOwner.subscriptionStatus === "trialing" && (!keyOwner.trialEndsAt || keyOwner.trialEndsAt > nowDate));
      if (!subActive) {
        limitReached = true;
      }
    }

    // Increment usage quota
    const usageAllowed = await storage.incrementApiKeyUsage(cleanKey);
    if (!usageAllowed) {
      limitReached = true;
    }

    return {
      valid: true,
      statusCode: 200,
      message: "Authorized",
      apiKeyId: validKey.id,
      limitReached,
    };
  }

  // Classification endpoint (GET with API key support)
  app.get("/api/classify", classifyLimiter, async (req, res) => {
    const apiKey = extractApiKeyFromRequest(req);
    const authResult = await validateApiKeyForClassification(apiKey);

    if (!authResult.valid) {
      return res.status(authResult.statusCode).json({
        visitorType: "Bot",
        visitor_type: "Bot",
        isHuman: false,
        is_human: false,
        redirectUrl: null,
        redirect_url: null,
        destination: null,
        url: null,
        status: authResult.statusCode === 401 ? "unauthorized" : "forbidden",
        message: authResult.message,
        error: authResult.message,
      });
    }

    return handleClassification(req, res, authResult.limitReached, authResult.apiKeyId);
  });

  // Public classification endpoint (POST) - with API key support for PHP scripts
  app.post("/api/classify", classifyLimiter, async (req, res) => {
    const apiKey = extractApiKeyFromRequest(req);
    const authResult = await validateApiKeyForClassification(apiKey);

    if (!authResult.valid) {
      return res.status(authResult.statusCode).json({
        visitorType: "Bot",
        visitor_type: "Bot",
        isHuman: false,
        is_human: false,
        redirectUrl: null,
        redirect_url: null,
        destination: null,
        url: null,
        status: authResult.statusCode === 401 ? "unauthorized" : "forbidden",
        message: authResult.message,
        error: authResult.message,
      });
    }

    return handleClassification(req, res, authResult.limitReached, authResult.apiKeyId);
  });

  // Client error reporting endpoint (from PHP script)
  app.post("/api/client-error", async (req, res) => {
    try {
      const { apiKey, ip, error } = req.body;
      let apiKeyId = null;
      
      if (apiKey) {
        const validKey = await storage.getApiKey(apiKey);
        if (validKey) apiKeyId = validKey.id;
      }
      
      const classification = await storage.createClassification({
        ipAddress: ip || 'Unknown',
        location: 'API Connection Error',
        country: 'Unknown',
        countryCode: '',
        city: '',
        region: '',
        browser: 'PHP Client',
        deviceType: 'Server',
        visitorType: 'Error',
        isp: error ? String(error).substring(0, 100) : 'Unknown Error',
        detectionMethod: 'Client Connection Failure',
        apiKeyId: apiKeyId
      });
      
      if (apiKeyId) {
        broadcastClassification(apiKeyId, {
          id: classification.id || Math.random().toString(),
          timestamp: new Date().toISOString(),
          ipAddress: ip || 'Unknown',
          visitorType: 'Bot',
          detectionMethod: 'Client Connection Failure',
          country: 'Unknown',
          isp: error ? String(error).substring(0, 100) : 'Unknown Error',
          action: 'Blocked'
        });
      }
      
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to log client error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  });

  // ========== BILLING ROUTES ==========

  // Helper: initialise Stripe lazily (throws if key is missing at call time, not startup)
  function getStripe(): Stripe {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    return new Stripe(key, { apiVersion: "2026-07-29.dahlia" });
  }

  // GET billing status for the authenticated client user
  app.get("/api/user/billing", requireClientAuth, async (req: any, res) => {
    try {
      const user = await storage.getClientUser(req.session.clientUserId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const now = new Date();
      const trialDaysRemaining = user.trialEndsAt
        ? Math.max(0, Math.ceil((user.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null;
      const isActive =
        user.subscriptionStatus === 'active' ||
        (user.subscriptionStatus === 'trialing' && user.trialEndsAt && user.trialEndsAt > now);
      res.json({
        subscriptionStatus: user.subscriptionStatus,
        trialEndsAt: user.trialEndsAt,
        trialDaysRemaining,
        isActive,
      });
    } catch (error) {
      console.error("Get billing status error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST create Stripe checkout session for subscription upgrade
  app.post("/api/billing/create-checkout-session", requireClientAuth, async (req: any, res) => {
    try {
      const priceId = process.env.STRIPE_PRICE_ID;
      if (!priceId) {
        return res.status(503).json({ message: "Billing is not configured. Please contact support." });
      }
      const stripe = getStripe();
      const userId = req.session.clientUserId;
      const user = await storage.getClientUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Create or reuse a Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: { userId: user.id, username: user.username },
        });
        customerId = customer.id;
        await storage.updateClientUser(userId, { stripeCustomerId: customerId });
      }

      const origin = (req.headers.origin as string) || `${req.protocol}://${req.headers.host}`;
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${origin}/user?billing=success`,
        cancel_url: `${origin}/user?billing=cancelled`,
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Create checkout session error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST Stripe webhook — must receive raw body; signature-verified; idempotent
  app.post("/api/billing/webhook", async (req: any, res) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET is not set — webhook rejected");
      return res.status(503).json({ message: "Webhook not configured" });
    }

    let stripe: Stripe;
    try {
      stripe = getStripe();
    } catch {
      return res.status(503).json({ message: "Billing not configured" });
    }

    const sig = req.headers["stripe-signature"] as string;
    let event: Stripe.Event;
    try {
      // req.rawBody is populated by the express.json verify callback in server/index.ts
      event = stripe.webhooks.constructEvent(req.rawBody || req.body, sig, webhookSecret);
    } catch (err) {
      console.error("Stripe webhook signature verification failed:", err);
      return res.status(400).json({ message: "Webhook signature verification failed" });
    }

    // Atomically claim this event. Returns false if already processed (duplicate delivery).
    // Returns 5xx if the claim itself fails so Stripe retries.
    let claimed: boolean;
    try {
      claimed = await storage.claimStripeEvent(event.id);
    } catch (err) {
      console.error("Stripe event claim failed:", err);
      return res.status(500).json({ message: "Event claim failed; Stripe will retry" });
    }

    if (!claimed) {
      return res.json({ received: true, duplicate: true });
    }

    // Process the event. On any failure: release the claim and return 5xx so Stripe retries.
    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.mode === "subscription" && session.customer && session.subscription) {
            const subId = typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
            // Retrieve live subscription status to handle out-of-order events:
            // if deletion already arrived, the retrieved status will be 'canceled'
            // and we must not re-activate.
            const liveSub = await stripe.subscriptions.retrieve(subId);
            const user = await storage.getClientUserByStripeCustomerId(session.customer as string);
            if (user) {
              if (liveSub.status === "active" || liveSub.status === "trialing") {
                await storage.updateClientUser(user.id, {
                  subscriptionStatus: liveSub.status,
                  stripeSubscriptionId: subId,
                });
              } else if (liveSub.status === "canceled") {
                await storage.updateClientUser(user.id, {
                  subscriptionStatus: "cancelled",
                  stripeSubscriptionId: subId,
                });
              }
              // other transient statuses (incomplete, past_due) — store sub ID but don't flip status
              else {
                await storage.updateClientUser(user.id, { stripeSubscriptionId: subId });
              }
            }
          }
          break;
        }
        case "invoice.payment_succeeded": {
          // Correlate to user's current subscription to guard against out-of-order events.
          // In Stripe API 2026-07-29.dahlia, subscription lives on invoice.parent.subscription_details
          const invoice = event.data.object as Stripe.Invoice;
          const paidSubId = typeof invoice.parent?.subscription_details?.subscription === "string"
            ? invoice.parent.subscription_details.subscription
            : (invoice.parent?.subscription_details?.subscription as Stripe.Subscription | null)?.id ?? null;
          if (invoice.customer && paidSubId) {
            const user = await storage.getClientUserByStripeCustomerId(invoice.customer as string);
            if (user && user.stripeSubscriptionId === paidSubId) {
              await storage.updateClientUser(user.id, { subscriptionStatus: "active" });
            }
          }
          break;
        }
        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const failedSubId = typeof invoice.parent?.subscription_details?.subscription === "string"
            ? invoice.parent.subscription_details.subscription
            : (invoice.parent?.subscription_details?.subscription as Stripe.Subscription | null)?.id ?? null;
          if (invoice.customer && failedSubId) {
            const user = await storage.getClientUserByStripeCustomerId(invoice.customer as string);
            if (user && user.stripeSubscriptionId === failedSubId) {
              await storage.updateClientUser(user.id, { subscriptionStatus: "past_due" });
            }
          }
          break;
        }
        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          if (sub.customer) {
            const user = await storage.getClientUserByStripeCustomerId(sub.customer as string);
            if (user) {
              // Only cancel if this event is for the user's current subscription,
              // OR if no subscription ID is stored yet (out-of-order: deletion arrived before checkout).
              // Ignoring deletions for old subscriptions prevents a cancel/re-subscribe race
              // from locking out an active customer.
              if (!user.stripeSubscriptionId || user.stripeSubscriptionId === sub.id) {
                await storage.updateClientUser(user.id, {
                  subscriptionStatus: "cancelled",
                  stripeSubscriptionId: sub.id,
                });
              }
              // else: stale deletion for a previously active subscription — ignore
            }
          }
          break;
        }
      }
    } catch (error) {
      console.error("Stripe webhook processing error:", error);
      // Release the claim so Stripe can retry this event immediately
      try { await storage.releaseStripeEvent(event.id); } catch (e) {
        console.error("Failed to release Stripe event claim:", e);
      }
      return res.status(500).json({ message: "Webhook processing failed; Stripe will retry" });
    }

    // Mark as permanently processed AFTER the DB mutation succeeded.
    // Until this point processed_at is NULL, so a crash here is recoverable:
    // the next Stripe retry reclaims the stale lease (after 5 min) and re-applies the event.
    try {
      await storage.markStripeEventProcessed(event.id);
    } catch (e) {
      console.error("Failed to mark Stripe event as processed:", e);
      // Non-fatal: the mutation already succeeded. A duplicate delivery will reclaim
      // the stale lease after 5 min and apply the same idempotent mutation again.
    }

    res.json({ received: true });
  });

  // ========== END BILLING ROUTES ==========

  async function handleClassification(req: any, res: any, limitReached: boolean = false, apiKeyId: string | null = null, authError: string | null = null) {
    let configuredBotUrl: string | null = null;
    let redirectVersion = 0;
    try {
      
      // Check if IP is provided in request body (POST) or query parameter (GET) or use actual visitor IP
      let clientIp = req.body?.ip as string ||
                     req.query.ip as string || 
                     req.headers['cf-connecting-ip'] || 
                     req.headers['true-client-ip'] || 
                     req.headers['x-client-ip'] || 
                     req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.headers['fastly-client-ip'] ||
                     req.ip || 
                     req.connection?.remoteAddress || 
                     req.socket?.remoteAddress || 
                     'unknown';
      
      // Handle comma-separated forwarded IPs (take the first one)
      if (typeof clientIp === 'string' && clientIp.includes(',')) {
        clientIp = clientIp.split(',')[0].trim();
      }
      
      // Convert array to string if needed
      if (Array.isArray(clientIp)) {
        clientIp = clientIp[0];
      }
      
      // Check user agent from request body (POST) or headers
      const userAgent = req.body?.userAgent || req.headers['user-agent'] || '';
      
      // Extract email from request body (POST) or query parameters (GET)
      const email = req.body?.email || req.query.email || req.query.e || null;
      
      // Parse user agent for browser and device info
      const parser = new UAParser();
      parser.setUA(userAgent);
      const browserInfo = parser.getBrowser();
      const deviceInfo = parser.getDevice();
      const osInfo = parser.getOS();
      
      const browser = browserInfo.name ? `${browserInfo.name} ${browserInfo.version}` : 'Unknown';
      const deviceType = deviceInfo.type || (osInfo.name?.toLowerCase().includes('mobile') ? 'mobile' : 'desktop');

      // Load Geolocation & Threat Intelligence API key
      const cleanTrafficApiKey = await getEffectiveIp2GeoKey();

      // Fetch user configured redirect URLs strictly from API key owner account
      let ownerUser: ClientUser | undefined = undefined;
      let configuredHumanUrl: string | null = null;

      if (apiKeyId) {
        try {
          ownerUser = await storage.getClientUserByApiKey(apiKeyId);
          if (ownerUser) {
            const redirectUrls = await storage.getUserRedirectUrls(ownerUser.id);
            if (redirectUrls) {
              configuredHumanUrl = redirectUrls.humanUrl?.trim() || null;
              configuredBotUrl = redirectUrls.botUrl?.trim() || null;
              redirectVersion = redirectUrls.updatedAt ? new Date(redirectUrls.updatedAt).getTime() : 0;
            }
          }
        } catch (urlErr) {
          console.error("Error fetching user redirect URLs for API key owner:", urlErr);
        }
      }

      // Cascading Classification Pipeline
      let classificationData: any = {};
      let visitorType = 'Human';
      let detectionMethod = 'IP Analysis';
      let blockReason = '';

      try {
        // PRIORITY 0: RATE LIMITS & SUBSCRIPTION
        if (authError) {
          visitorType = 'Bot';
          detectionMethod = 'Authentication Failed';
          blockReason = authError;
          console.log(`🚫 BLOCKED (Priority 0 - Auth Error): ${clientIp} - ${authError}`);
        } else if (limitReached) {
          visitorType = 'Bot';
          detectionMethod = 'Rate Limit / Subscription Expired';
          blockReason = 'Account limit reached or subscription expired';
          console.log(`🚫 BLOCKED (Priority 0 - Limit Reached): ${clientIp}`);
        } else if (!userAgent || userAgent.trim() === '') {
          visitorType = 'Bot';
          detectionMethod = 'Missing User Agent';
          blockReason = 'No user agent provided - likely bot/scraper';
          console.log(`🚫 BLOCKED (Missing User Agent): ${clientIp}`);
        }
        // Check for suspicious/bot user agents
        else if (userAgent && (
          userAgent.toLowerCase().includes('bot') ||
          userAgent.toLowerCase().includes('crawler') ||
          userAgent.toLowerCase().includes('spider') ||
          userAgent.toLowerCase().includes('scraper') ||
          userAgent.toLowerCase().includes('curl') ||
          userAgent.toLowerCase().includes('wget') ||
          userAgent.toLowerCase().includes('python') ||
          userAgent.toLowerCase().includes('java/') ||
          userAgent.toLowerCase().includes('headless') ||
          userAgent.toLowerCase().includes('phantomjs') ||
          userAgent.toLowerCase().includes('selenium') ||
          userAgent.toLowerCase().includes('puppeteer')
        )) {
          visitorType = 'Bot';
          detectionMethod = 'Suspicious User Agent';
          blockReason = `Detected bot/scraper user agent: ${userAgent.substring(0, 50)}`;
          console.log(`🚫 BLOCKED (Suspicious UA): ${clientIp} - ${userAgent.substring(0, 50)}`);
        }

        // Check IP blocklist
        const isBlockedIp = await storage.isIpBlocked(clientIp);
        if (isBlockedIp) {
          visitorType = 'Bot';
          detectionMethod = 'IP Blocklist';
          blockReason = `IP is on custom blocklist: ${clientIp}`;
          console.log(`🚫 BLOCKED (IP Blocklist): ${clientIp}`);
        }

        // Check CIDR blocklist
        const isBlockedCidr = await storage.isIpInBlockedCidrRange(clientIp);
        if (isBlockedCidr) {
          visitorType = 'Bot';
          detectionMethod = 'CIDR Blocklist';
          blockReason = `IP is in blocked CIDR range: ${clientIp}`;
          console.log(`🚫 BLOCKED (CIDR Blocklist): ${clientIp}`);
        }

        // Fetch IP Geolocation & Threat Data
        const cachedData = ip2geoCache.get(clientIp);
        if (cachedData) {
          classificationData = { ...cachedData };
        } else {
          const fetchedGeo = await fetchIpGeolocation(cleanTrafficApiKey, clientIp, userAgent);
          if (fetchedGeo) {
            classificationData = fetchedGeo;
            ip2geoCache.set(clientIp, classificationData, 30 * 60 * 1000);
          } else {
            classificationData = {
              ip: clientIp,
              location: isPrivateOrLocalIp(clientIp) ? 'Localhost' : 'Unknown',
              isp: isPrivateOrLocalIp(clientIp) ? 'Localhost' : 'Unknown',
              country_code: isPrivateOrLocalIp(clientIp) ? 'US' : '',
              country_name: isPrivateOrLocalIp(clientIp) ? 'United States' : 'Unknown',
              city_name: isPrivateOrLocalIp(clientIp) ? 'Localhost' : 'Unknown',
              region_name: '',
              usage_type: 'RES',
              is_proxy: false
            };
          }
        }
        classificationData.browser = browser;
        classificationData.device_type = deviceType;

        const countryCode = classificationData.country_code || '';
        const ispName = classificationData.isp || '';
        const usageType = classificationData.usage_type || '';

        // PRIORITY 1: ISP BLACKLIST - Immediate block
        if (ispName && ispName !== 'Unknown') {
          const isBlacklisted = await storage.isIspBlacklisted(ispName);
          if (isBlacklisted) {
            visitorType = 'Bot';
            detectionMethod = 'ISP Blacklisted';
            blockReason = `ISP blacklisted: ${ispName}`;
            console.log(`🚫 BLOCKED (Priority 1 - ISP Blacklist): ${clientIp} - ${ispName}`);
          }
        }

        // PRIORITY 2: COUNTRY WHITELIST (Geo-Fencing)
        const countryWhitelist = await storage.getCountryWhitelist();
        const enabledCountries = countryWhitelist.filter(c => c.enabled !== false);
        const hasCountryWhitelist = enabledCountries.length > 0;

        if (hasCountryWhitelist) {
          if (countryCode) {
            const isCountryWhitelisted = await storage.isCountryAllowed(countryCode);
            if (isCountryWhitelisted) {
              if (usageType === 'DCH') {
                visitorType = 'Bot';
                detectionMethod = 'Datacenter in Whitelisted Country';
                blockReason = `Datacenter traffic from whitelisted country: ${countryCode}`;
                console.log(`🚫 BLOCKED (Priority 2 - DCH in Whitelisted Country): ${clientIp} - ${countryCode}`);
              } else if (visitorType !== 'Bot') {
                visitorType = 'Human';
                detectionMethod = 'Country Whitelist';
                blockReason = '';
                console.log(`✅ ALLOWED (Priority 2 - Country Whitelisted): ${clientIp} - ${countryCode}`);
              }
            } else {
              visitorType = 'Bot';
              detectionMethod = 'Country Not Whitelisted';
              blockReason = `Country not whitelisted: ${countryCode}`;
              console.log(`🚫 BLOCKED (Priority 2 - Country Not Whitelisted): ${clientIp} - ${countryCode}`);
            }
          } else {
            visitorType = 'Bot';
            detectionMethod = 'Country Not Whitelisted';
            blockReason = `Unknown country while geo-fencing is active`;
            console.log(`🚫 BLOCKED (Priority 2 - Unknown Country): ${clientIp}`);
          }
        } else if (visitorType !== 'Bot') {
          visitorType = 'Human';
          detectionMethod = 'IP Analysis';
        }

        // PRIORITY 3: DATACENTER & PROXY / VPN DETECTION
        if (visitorType === 'Human') {
          if (usageType === 'DCH') {
            visitorType = 'Bot';
            detectionMethod = 'Datacenter';
            blockReason = 'Datacenter IP detected';
            console.log(`🚫 BLOCKED (Priority 3 - Datacenter): ${clientIp}`);
          } else if (
            classificationData.is_proxy || 
            classificationData.proxy_data?.is_vpn || 
            classificationData.proxy_data?.is_tor || 
            classificationData.proxy_data?.is_data_center || 
            classificationData.proxy_data?.is_web_crawler
          ) {
            visitorType = 'Bot';
            if (classificationData.proxy_data?.is_vpn) {
              detectionMethod = 'VPN Detected';
            } else if (classificationData.proxy_data?.is_tor) {
              detectionMethod = 'TOR Detected';
            } else if (classificationData.proxy_data?.is_data_center) {
              detectionMethod = 'Datacenter Detected';
            } else if (classificationData.proxy_data?.is_web_crawler) {
              detectionMethod = 'Crawler Detected';
            } else {
              detectionMethod = 'Proxy Detected';
            }
            blockReason = `Detected: ${detectionMethod}`;
            console.log(`🚫 BLOCKED (Priority 3 - ${detectionMethod}): ${clientIp}`);
          }
        }

        // PRIORITY 4: ISP WHITELIST OVERRIDE (Allow trusted ISPs)
        if (visitorType === 'Bot' && ispName && ispName !== 'Unknown') {
          const isWhitelisted = await storage.isIspWhitelisted(ispName);
          if (isWhitelisted) {
            visitorType = 'Human';
            detectionMethod = 'ISP Whitelist Override';
            blockReason = `ISP whitelisted (trusted): ${ispName}`;
            console.log(`✅ ALLOWED (Priority 4 - ISP Whitelist Override): ${clientIp} - ${ispName} is trusted`);
          }
        }

        classificationData.visitor_type = visitorType;
        classificationData.detection_method = detectionMethod;
        console.log(`✅ Final Classification: ${clientIp} = ${visitorType} (${detectionMethod})`);

      } catch (error) {
        console.error("Classification error caught, falling back safely:", error);
        visitorType = userAgent && !userAgent.toLowerCase().includes('bot') ? 'Human' : 'Bot';
        detectionMethod = 'Fallback Classification';
        classificationData = {
          ip: clientIp,
          location: 'Unknown',
          country_name: 'Unknown',
          country_code: '',
          isp: 'Unknown',
          browser: browser,
          device_type: deviceType,
          visitor_type: visitorType,
          detection_method: detectionMethod
        };
      }

      // Save classification record for analytics and reporting
      let classification: any;
      try {
        classification = await storage.createClassification({
          ipAddress: clientIp,
          location: classificationData.location || 'Unknown',
          country: classificationData.country_name || 'Unknown',
          countryCode: classificationData.country_code || 'Unknown',
          city: classificationData.city_name || 'Unknown',
          region: classificationData.region_name || '',
          browser: classificationData.browser || browser,
          deviceType: classificationData.device_type || deviceType,
          visitorType: visitorType,
          isp: classificationData.isp || 'Unknown',
          detectionMethod: classificationData.detection_method || 'IP Analysis',
          apiKeyId: apiKeyId, // Track which API key made this request
        });
        
        // Broadcast live to connected dashboard clients for this specific API key
        if (apiKeyId) {
          broadcastClassification(apiKeyId, {
            id: classification.id ?? randomUUID(),
            timestamp: classification.timestamp
              ? new Date(classification.timestamp).toISOString()
              : new Date().toISOString(),
            ipAddress: clientIp,
            visitorType: visitorType as 'Human' | 'Bot',
            detectionMethod: classificationData.detection_method || 'IP Analysis',
            country: classificationData.country_name || 'Unknown',
            isp: classificationData.isp || 'Unknown',
            action: visitorType === 'Human' ? 'Allowed' : 'Blocked',
          });
        }
        console.log(`📝 Logged classification for IP ${clientIp} (${visitorType}) under API key ID ${apiKeyId || 'global'}`);
      } catch (logErr) {
        console.error("Error writing classification log:", logErr);
        classification = {
          ipAddress: clientIp,
          location: classificationData.location || 'Unknown',
          country: classificationData.country_name || 'Unknown',
          city: classificationData.city_name || 'Unknown',
          browser: classificationData.browser || browser,
          deviceType: classificationData.device_type || deviceType,
          visitorType: visitorType,
          isp: classificationData.isp || 'Unknown',
        };
      }

      // If API key is paused or expired, force visitor classification to Bot
      if (apiKeyId) {
        try {
          const apiKeyDetails = await storage.getApiKeyById(apiKeyId);
          if (apiKeyDetails && (apiKeyDetails.status === 'paused' || apiKeyDetails.status === 'expired')) {
            visitorType = 'Bot';
            detectionMethod = `License ${apiKeyDetails.status.toUpperCase()}`;
            blockReason = `API key license status is ${apiKeyDetails.status}`;
            if (classification) classification.visitorType = 'Bot';
            console.log(`⚠️ License ${apiKeyDetails.status.toUpperCase()}: Visitor classified as Bot`);
          }
        } catch (keyErr) {}
      }

      // Load system default URLs as fallback ONLY if the account has not configured custom URLs
      let systemDefaultHumanUrl = '';
      let systemDefaultBotUrl = '';
      try {
        const redirectUrlFile = path.join(process.cwd(), 'cleantraffic-php-package', 'redirect_url.txt');
        const botUrlFile = path.join(process.cwd(), 'cleantraffic-php-package', 'bot_url.txt');
        if (fs.existsSync(redirectUrlFile)) {
          systemDefaultHumanUrl = fs.readFileSync(redirectUrlFile, 'utf8').trim();
        }
        if (fs.existsSync(botUrlFile)) {
          systemDefaultBotUrl = fs.readFileSync(botUrlFile, 'utf8').trim();
        }
      } catch (e) {}

      // The user's dashboard configuration ALWAYS takes precedence and is NEVER overridden by system defaults
      const finalHumanUrl = (configuredHumanUrl && configuredHumanUrl.trim() !== '') 
        ? configuredHumanUrl.trim() 
        : (systemDefaultHumanUrl || null);

      const finalBotUrl = (configuredBotUrl && configuredBotUrl.trim() !== '') 
        ? configuredBotUrl.trim() 
        : (systemDefaultBotUrl || null);

      const isHumanVisitor = (visitorType === 'Human' || classification.visitorType === 'Human') && !limitReached && !authError;
      const effectiveRedirectUrl = isHumanVisitor ? finalHumanUrl : finalBotUrl;

      // Comprehensive tracing and audit log for traffic routing decisions
      console.log(`[TRAFFIC_ROUTING_TRACE]
================================================================================
  Visitor IP:              ${clientIp}
  API Key ID:              ${apiKeyId || '[None / Global]'}
  Account Owner:           ${ownerUser ? `${ownerUser.username} (${ownerUser.id})` : '[Unassigned / Not Found]'}
  Detected Visitor Type:   ${isHumanVisitor ? 'Human' : 'Bot'}
  Triggering Condition:    ${blockReason ? `Blocked by: ${blockReason}` : (detectionMethod || classificationData.detection_method || 'Clean Traffic Passed')}
  Detection Method:        ${detectionMethod || classificationData.detection_method || 'IP Analysis'}
  Dashboard Human URL:     ${configuredHumanUrl || '[Not set by user]'}
  Dashboard Bot URL:       ${configuredBotUrl || '[Not set by user]'}
  System Default Human:    ${systemDefaultHumanUrl || '[None]'}
  System Default Bot:      ${systemDefaultBotUrl || '[None]'}
  Final Redirect URL:      ${effectiveRedirectUrl || '[None / Empty]'}
================================================================================`);

      const response: any = {
        ip: clientIp,
        location: classification.location || classificationData.location || 'Unknown',
        country: classification.country || classificationData.country_name || 'Unknown',
        countryCode: classification.countryCode || classificationData.country_code || '',
        city: classification.city || classificationData.city_name || 'Unknown',
        browser: classification.browser || browser || 'Unknown',
        device_type: classification.deviceType || deviceType || 'Unknown', 
        visitorType: isHumanVisitor ? 'Human' : 'Bot',
        visitor_type: isHumanVisitor ? 'Human' : 'Bot',
        isHuman: isHumanVisitor,
        is_human: isHumanVisitor,
        action: isHumanVisitor ? 'Allowed' : 'Blocked',
        detection_method: classificationData.detection_method || classification.detectionMethod || detectionMethod || 'IP Analysis',
        block_reason: blockReason || null,
        isp: classification.isp || classificationData.isp || 'Unknown',
        redirectUrl: effectiveRedirectUrl || null,
        redirect_url: effectiveRedirectUrl || null,
        destination: effectiveRedirectUrl || null,
        url: effectiveRedirectUrl || null,
        humanUrl: finalHumanUrl || null,
        human_url: finalHumanUrl || null,
        botUrl: finalBotUrl || null,
        bot_url: finalBotUrl || null,
        redirectVersion: redirectVersion,
        configured: Boolean(effectiveRedirectUrl),
        status: "success"
      };
      
      res.json(response);
    } catch (error) {
      console.error("Classification error:", error);
      res.status(200).json({ 
        visitorType: "Bot",
        visitor_type: "Bot",
        isHuman: false,
        is_human: false,
        redirectUrl: configuredBotUrl || null,
        redirect_url: configuredBotUrl || null,
        destination: configuredBotUrl || null,
        url: configuredBotUrl || null,
        redirectVersion: redirectVersion,
        configured: Boolean(configuredBotUrl),
        message: "Classification failed - fail secure", 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get recent classifications
  app.get("/api/classifications", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const classifications = await storage.getRecentClassifications(limit);
      res.json(classifications);
    } catch (error) {
      console.error("Get classifications error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get classification statistics
  app.get("/api/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getClassificationStats();
      res.json(stats);
    } catch (error) {
      console.error("Get stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get detection rules
  app.get("/api/detection-rules", requireAuth, async (req, res) => {
    try {
      const rules = await storage.getDetectionRules();
      res.json(rules);
    } catch (error) {
      console.error("Get detection rules error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update detection rules
  app.put("/api/detection-rules", requireAuth, async (req: any, res) => {
    try {
      const rules = await storage.updateDetectionRules(req.body);
      void auditLog({
        actorId: req.session?.userId,
        actorType: "admin",
        action: "detection_rules.updated",
        targetType: "detection_rules",
      });
      res.json(rules);
    } catch (error) {
      console.error("Update detection rules error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Check CleanTraffic API key status  
  app.get("/api/api-key/status", requireAuth, async (req, res) => {
    try {
      // PERMANENT STORAGE: Try database first
      const { settings } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const dbKey = await db.select().from(settings).where(eq(settings.key, 'cleantraffic_api_key')).limit(1);
      let apiKey = dbKey.length > 0 ? dbKey[0].value : '';
      
      // Fallback to file if not in database
      if (!apiKey) {
        try {
          const keyFile = path.join(process.cwd(), 'cleantraffic-php-package', 'api_key.txt');
          if (fs.existsSync(keyFile)) {
            const fileKey = fs.readFileSync(keyFile, 'utf8').trim();
            if (fileKey) {
              apiKey = fileKey;
            }
          }
        } catch (readError) {
          console.warn("Could not read API key from file:", readError);
        }
      }
      
      if (!apiKey) {
        return res.json({
          hasKey: false,
          message: "CleanTraffic API key not configured"
        });
      }
      
      res.json({
        hasKey: true,
        keyPreview: `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)}`,
        message: "API key configured successfully",
        lastUpdated: dbKey.length > 0 ? dbKey[0].updatedAt : null
      });
    } catch (error) {
      console.error("Check API key error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get IP2Geolocation API key status (with masked key and last updated)
  app.get("/api/ip2geo-api-key/status", requireAuth, async (req, res) => {
    try {
      const apiKey = await getEffectiveIp2GeoKey();
      
      if (!apiKey) {
        return res.json({
          hasKey: false,
          keyPreview: null,
          lastUpdated: "Never"
        });
      }
      
      // Create masked key: first 4 + ***** + last 4
      const maskedKey = apiKey.length > 8 
        ? `${apiKey.substring(0, 4)}*****${apiKey.substring(apiKey.length - 4)}`
        : '****';
      
      res.json({
        hasKey: true,
        keyPreview: maskedKey,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Check IP2Geo API key status error:", error);
      res.status(500).json({ 
        hasKey: false,
        keyPreview: null,
        lastUpdated: "Never"
      });
    }
  });

  // Update CleanTraffic / IP2Location / IP2Geo API key
  app.put("/api/ip2geo-api-key", requireAuth, async (req, res) => {
    try {
      const { apiKey } = req.body;
      
      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        return res.status(400).json({
          error: true,
          message: "Valid API key is required"
        });
      }
      
      const trimmedKey = apiKey.trim();
      
      if (trimmedKey.length < 8) {
        return res.status(400).json({
          error: true,
          message: "API key appears to be invalid (too short)"
        });
      }
      
      // Test the API key against IP2Location or IP2Geolocation
      let isValid = false;
      let validationDetails: any = null;

      // 1. Test IP2Location.io
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const testApiUrl = `https://api.ip2location.io/?key=${encodeURIComponent(trimmedKey)}&ip=8.8.8.8`;
        const testResponse = await fetch(testApiUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (testResponse.ok) {
          const testData = await testResponse.json();
          if (!testData.error && testData.country_name) {
            isValid = true;
            validationDetails = { provider: 'ip2location.io', country: testData.country_name, city: testData.city_name, isp: testData.as };
          }
        }
      } catch (e) {}

      // 2. Test IP2Geolocation.io
      if (!isValid) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);
          const testApiUrl = `https://api.ip2geolocation.io/ipgeo?apiKey=${encodeURIComponent(trimmedKey)}&ip=8.8.8.8`;
          const testResponse = await fetch(testApiUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (testResponse.ok) {
            const testData = await testResponse.json();
            if (testData.country_name || testData.country_code2) {
              isValid = true;
              validationDetails = { provider: 'ip2geolocation.io', country: testData.country_name, city: testData.city, isp: testData.isp };
            }
          }
        } catch (e) {}
      }

      console.log('API key validation result:', { isValid, validationDetails });

      // Save to storage layer (works with both MemStorage and DatabaseStorage)
      await storage.setSetting('cleantraffic_api_key', trimmedKey);
      
      // Update runtime environment variables for immediate effect
      process.env.IP2GEO_API_KEY = trimmedKey;
      process.env.IP2GEOLOCATION_API_KEY = trimmedKey;
      process.env.IP2LOCATION_API_KEY = trimmedKey;
      
      // Save to persistent file
      try {
        const pkgDir = path.join(process.cwd(), 'cleantraffic-php-package');
        if (!fs.existsSync(pkgDir)) {
          fs.mkdirSync(pkgDir, { recursive: true });
        }
        const keyFile = path.join(pkgDir, 'api_key.txt');
        fs.writeFileSync(keyFile, trimmedKey, { flag: 'w', mode: 0o644 });
        
        // Also update .env file
        const envPath = path.join(process.cwd(), '.env');
        let envContent = '';
        try {
          if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
          }
        } catch (readError) {}
        
        const keyPattern = /^IP2GEOLOCATION_API_KEY=.*$/gm;
        const newKeyLine = `IP2GEOLOCATION_API_KEY=${trimmedKey}`;
        if (keyPattern.test(envContent)) {
          envContent = envContent.replace(keyPattern, newKeyLine);
        } else {
          envContent = envContent.trim() + '\n' + newKeyLine + '\n';
        }
        fs.writeFileSync(envPath, envContent, 'utf8');
      } catch (writeError) {
        console.warn("Notice: Could not write persistent key file:", writeError);
      }
      
      // Clear cached IP data so future classifications use the new key
      if (typeof ip2geoCache !== 'undefined' && ip2geoCache.clear) {
        ip2geoCache.clear();
      }
      
      res.json({
        success: true,
        message: isValid ? "API key updated and verified successfully" : "API key saved successfully",
        keyPreview: `${trimmedKey.substring(0, 4)}*****${trimmedKey.substring(trimmedKey.length - 4)}`
      });
      
    } catch (error) {
      console.error("Update IP2Geo API key error:", error);
      res.status(500).json({ 
        error: true,
        message: "Failed to update API key" 
      });
    }
  });

  // Get redirect URLs
  app.get("/api/redirect-urls", requireAuth, async (req, res) => {
    try {
      const redirectUrlFile = path.join(process.cwd(), 'cleantraffic-php-package', 'redirect_url.txt');
      const botUrlFile = path.join(process.cwd(), 'cleantraffic-php-package', 'bot_url.txt');
      
      let humanUrl = 'https://example.com/human';
      let botUrl = 'https://example.com/bot';
      
      if (fs.existsSync(redirectUrlFile)) {
        humanUrl = fs.readFileSync(redirectUrlFile, 'utf8').trim();
      }
      
      if (fs.existsSync(botUrlFile)) {
        botUrl = fs.readFileSync(botUrlFile, 'utf8').trim();
      }
      
      res.json({ humanUrl, botUrl });
    } catch (error) {
      console.error("Get redirect URLs error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update redirect URLs
  app.put("/api/redirect-urls", requireAuth, async (req, res) => {
    try {
      const { humanUrl, botUrl } = req.body;
      
      if (!humanUrl || !botUrl) {
        return res.status(400).json({ message: "Both humanUrl and botUrl are required" });
      }
      
      // Validate URLs
      try {
        new URL(humanUrl);
        new URL(botUrl);
      } catch {
        return res.status(400).json({ message: "Invalid URL format" });
      }
      
      const redirectUrlFile = path.join(process.cwd(), 'cleantraffic-php-package', 'redirect_url.txt');
      const botUrlFile = path.join(process.cwd(), 'cleantraffic-php-package', 'bot_url.txt');
      
      fs.writeFileSync(redirectUrlFile, humanUrl.trim(), 'utf8');
      fs.writeFileSync(botUrlFile, botUrl.trim(), 'utf8');
      
      console.log("Redirect URLs updated:", { humanUrl, botUrl });
      
      res.json({
        success: true,
        message: "Redirect URLs updated successfully",
        humanUrl,
        botUrl
      });
    } catch (error) {
      console.error("Update redirect URLs error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== COUNTRY WHITELIST ENDPOINTS ====================
  
  // Get all countries in whitelist
  app.get("/api/countries", requireAuth, async (req, res) => {
    try {
      const countries = await storage.getCountryWhitelist();
      res.json(countries);
    } catch (error) {
      console.error("Get countries error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add country to whitelist
  app.post("/api/countries", requireAuth, async (req, res) => {
    try {
      const { countryCode, countryName, enabled } = req.body;
      
      if (!countryCode || !countryName) {
        return res.status(400).json({ message: "countryCode and countryName are required" });
      }
      
      const country = await storage.addCountryToWhitelist({
        countryCode: countryCode.toUpperCase(),
        countryName,
        enabled: enabled !== undefined ? enabled : true
      });
      
      res.json(country);
    } catch (error) {
      console.error("Add country error:", error);
      res.status(500).json({ message: "Failed to add country" });
    }
  });

  // Remove country from whitelist
  app.delete("/api/countries/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.removeCountryFromWhitelist(req.params.id);
      if (success) {
        res.json({ success: true, message: "Country removed" });
      } else {
        res.status(404).json({ message: "Country not found" });
      }
    } catch (error) {
      console.error("Remove country error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Toggle country enabled status
  app.patch("/api/countries/:id/toggle", requireAuth, async (req, res) => {
    try {
      const { enabled } = req.body;
      const success = await storage.toggleCountryWhitelist(req.params.id, enabled);
      if (success) {
        res.json({ success: true, message: "Country status updated" });
      } else {
        res.status(404).json({ message: "Country not found" });
      }
    } catch (error) {
      console.error("Toggle country error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== ISP WHITELIST ENDPOINTS ====================
  
  // Get ISP whitelist (optionally filtered by country)
  app.get("/api/isp-whitelist", requireAuth, async (req, res) => {
    try {
      const countryCode = req.query.country as string | undefined;
      const isps = await storage.getIspWhitelist(countryCode);
      res.json(isps);
    } catch (error) {
      console.error("Get ISP whitelist error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add ISP to whitelist
  app.post("/api/isp-whitelist", requireAuth, async (req, res) => {
    try {
      const { ispName, countryCode, enabled } = req.body;
      
      if (!ispName) {
        return res.status(400).json({ message: "ispName is required" });
      }
      
      const isp = await storage.addIspToWhitelist({
        ispName: ispName.trim(),
        countryCode: countryCode || null,
        enabled: enabled !== undefined ? enabled : true
      });
      
      res.json(isp);
    } catch (error) {
      console.error("Add ISP to whitelist error:", error);
      res.status(500).json({ message: "Failed to add ISP to whitelist" });
    }
  });

  // Bulk add ISPs to whitelist
  app.post("/api/isp-whitelist/bulk", requireAuth, async (req, res) => {
    try {
      const { ispNames, countryCode } = req.body;
      
      if (!ispNames || !Array.isArray(ispNames)) {
        return res.status(400).json({ message: "ispNames array is required" });
      }
      
      const results = [];
      for (const ispName of ispNames) {
        if (ispName.trim()) {
          try {
            const isp = await storage.addIspToWhitelist({
              ispName: ispName.trim(),
              countryCode: countryCode || null,
              enabled: true
            });
            results.push(isp);
          } catch (error) {
            console.error(`Failed to add ISP ${ispName}:`, error);
          }
        }
      }
      
      res.json({ success: true, added: results.length, isps: results });
    } catch (error) {
      console.error("Bulk add ISP whitelist error:", error);
      res.status(500).json({ message: "Failed to add ISPs" });
    }
  });

  // Remove ISP from whitelist
  app.delete("/api/isp-whitelist/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.removeIspFromWhitelist(req.params.id);
      if (success) {
        res.json({ success: true, message: "ISP removed from whitelist" });
      } else {
        res.status(404).json({ message: "ISP not found" });
      }
    } catch (error) {
      console.error("Remove ISP from whitelist error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Toggle ISP whitelist status
  app.patch("/api/isp-whitelist/:id/toggle", requireAuth, async (req, res) => {
    try {
      const { enabled } = req.body;
      const success = await storage.toggleIspWhitelist(req.params.id, enabled);
      if (success) {
        res.json({ success: true, message: "ISP whitelist status updated" });
      } else {
        res.status(404).json({ message: "ISP not found" });
      }
    } catch (error) {
      console.error("Toggle ISP whitelist error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== ISP BLACKLIST ENDPOINTS ====================
  
  // Get ISP blacklist
  app.get("/api/isp-blacklist", requireAuth, async (req, res) => {
    try {
      const isps = await storage.getIspBlacklist();
      res.json(isps);
    } catch (error) {
      console.error("Get ISP blacklist error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add ISP to blacklist
  app.post("/api/isp-blacklist", requireAuth, async (req, res) => {
    try {
      const { ispName, category, enabled } = req.body;
      
      if (!ispName) {
        return res.status(400).json({ message: "ispName is required" });
      }
      
      const isp = await storage.addIspToBlacklist({
        ispName: ispName.trim(),
        category: category || null,
        enabled: enabled !== undefined ? enabled : true
      });
      
      res.json(isp);
    } catch (error) {
      console.error("Add ISP to blacklist error:", error);
      res.status(500).json({ message: "Failed to add ISP to blacklist" });
    }
  });

  // Bulk add ISPs to blacklist
  app.post("/api/isp-blacklist/bulk", requireAuth, async (req, res) => {
    try {
      const { ispNames, category } = req.body;
      
      if (!ispNames || !Array.isArray(ispNames)) {
        return res.status(400).json({ message: "ispNames array is required" });
      }
      
      if (ispNames.length === 0) {
        return res.status(400).json({ message: "ispNames array cannot be empty" });
      }
      
      const result = await storage.bulkAddIspsToBlacklist(ispNames, category || "Other");
      
      res.json(result);
    } catch (error) {
      console.error("Bulk add ISPs error:", error);
      res.status(500).json({ message: "Failed to bulk add ISPs to blacklist" });
    }
  });

  // Load default blacklist (50+ bot ISPs)
  app.post("/api/isp-blacklist/load-defaults", requireAuth, async (req, res) => {
    try {
      const defaultBlacklist = [
        // Cloud Providers / Datacenters
        { ispName: "Amazon.com", category: "Datacenter" },
        { ispName: "Amazon Data Services", category: "Datacenter" },
        { ispName: "Amazon Technologies", category: "Datacenter" },
        { ispName: "Google LLC", category: "Datacenter" },
        { ispName: "Google Cloud", category: "Datacenter" },
        { ispName: "Microsoft Corporation", category: "Datacenter" },
        { ispName: "Microsoft Azure", category: "Datacenter" },
        { ispName: "DigitalOcean", category: "Datacenter" },
        { ispName: "DigitalOcean, LLC", category: "Datacenter" },
        { ispName: "OVH SAS", category: "Datacenter" },
        { ispName: "OVH", category: "Datacenter" },
        { ispName: "Hetzner Online", category: "Datacenter" },
        { ispName: "Hetzner Online GmbH", category: "Datacenter" },
        { ispName: "Linode", category: "Datacenter" },
        { ispName: "Vultr", category: "Datacenter" },
        { ispName: "Cloudflare", category: "Datacenter" },
        { ispName: "Akamai Technologies", category: "Datacenter" },
        { ispName: "Alibaba Cloud", category: "Datacenter" },
        { ispName: "Oracle Cloud", category: "Datacenter" },
        { ispName: "IBM Cloud", category: "Datacenter" },
        { ispName: "Scaleway", category: "Datacenter" },
        { ispName: "Packet Host", category: "Datacenter" },
        { ispName: "Leaseweb", category: "Datacenter" },
        { ispName: "Choopa", category: "Datacenter" },
        { ispName: "ServerMania", category: "Datacenter" },
        { ispName: "Contabo", category: "Datacenter" },
        { ispName: "Datacamp Limited", category: "Datacenter" },
        { ispName: "QuadraNet", category: "Datacenter" },
        { ispName: "ColoCrossing", category: "Datacenter" },
        { ispName: "Secured Servers LLC", category: "Datacenter" },
        
        // VPN Providers
        { ispName: "NordVPN", category: "VPN" },
        { ispName: "ExpressVPN", category: "VPN" },
        { ispName: "ProtonVPN", category: "VPN" },
        { ispName: "Surfshark", category: "VPN" },
        { ispName: "CyberGhost", category: "VPN" },
        { ispName: "Private Internet Access", category: "VPN" },
        { ispName: "IPVanish", category: "VPN" },
        { ispName: "TunnelBear", category: "VPN" },
        { ispName: "HideMyAss", category: "VPN" },
        { ispName: "Hotspot Shield", category: "VPN" },
        { ispName: "Windscribe", category: "VPN" },
        { ispName: "VyprVPN", category: "VPN" },
        { ispName: "PureVPN", category: "VPN" },
        { ispName: "Mullvad", category: "VPN" },
        { ispName: "IVPN", category: "VPN" },
        
        // Proxy Services
        { ispName: "Bright Data", category: "Proxy" },
        { ispName: "Luminati Networks", category: "Proxy" },
        { ispName: "Oxylabs", category: "Proxy" },
        { ispName: "Smartproxy", category: "Proxy" },
        { ispName: "GeoSurf", category: "Proxy" },
        { ispName: "Storm Proxies", category: "Proxy" },
        { ispName: "ProxyRack", category: "Proxy" },
        { ispName: "IPRoyal", category: "Proxy" },
        
        // Tor Exit Nodes
        { ispName: "Tor", category: "Tor" },
        { ispName: "Tor Exit", category: "Tor" },
      ];
      
      const results = [];
      for (const entry of defaultBlacklist) {
        try {
          const isp = await storage.addIspToBlacklist({
            ispName: entry.ispName,
            category: entry.category,
            enabled: true
          });
          results.push(isp);
        } catch (error) {
          console.log(`ISP ${entry.ispName} may already exist, skipping...`);
        }
      }
      
      res.json({ success: true, loaded: results.length, isps: results });
    } catch (error) {
      console.error("Load default blacklist error:", error);
      res.status(500).json({ message: "Failed to load default blacklist" });
    }
  });

  // Remove ISP from blacklist
  app.delete("/api/isp-blacklist/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.removeIspFromBlacklist(req.params.id);
      if (success) {
        res.json({ success: true, message: "ISP removed from blacklist" });
      } else {
        res.status(404).json({ message: "ISP not found" });
      }
    } catch (error) {
      console.error("Remove ISP from blacklist error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Toggle ISP blacklist status
  app.patch("/api/isp-blacklist/:id/toggle", requireAuth, async (req, res) => {
    try {
      const { enabled } = req.body;
      const success = await storage.toggleIspBlacklist(req.params.id, enabled);
      if (success) {
        res.json({ success: true, message: "ISP blacklist status updated" });
      } else {
        res.status(404).json({ message: "ISP not found" });
      }
    } catch (error) {
      console.error("Toggle ISP blacklist error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // Client IP Whitelist Management Routes
  // ============================================

  // Get all IP whitelist entries
  app.get("/api/client-ip-whitelist", requireAuth, async (req, res) => {
    try {
      const entries = await storage.getClientIpWhitelist();
      res.json(entries);
    } catch (error) {
      console.error("Get IP whitelist error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add new IP to whitelist
  app.post("/api/client-ip-whitelist", requireAuth, async (req, res) => {
    try {
      const { label, cidr } = req.body;
      
      if (!label || !cidr) {
        return res.status(400).json({ message: "Label and CIDR are required" });
      }

      const entry = await storage.addIpToWhitelist({ label, cidr, enabled: true });
      invalidateWhitelistCache(); // Force cache refresh
      res.json({ success: true, entry });
    } catch (error: any) {
      console.error("Add IP to whitelist error:", error);
      if (error.message?.includes('duplicate') || error.code === '23505') {
        res.status(400).json({ message: "This IP/CIDR already exists in the whitelist" });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // Remove IP from whitelist
  app.delete("/api/client-ip-whitelist/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.removeIpFromWhitelist(req.params.id);
      if (success) {
        invalidateWhitelistCache(); // Force cache refresh
        res.json({ success: true, message: "IP removed from whitelist" });
      } else {
        res.status(404).json({ message: "IP entry not found" });
      }
    } catch (error) {
      console.error("Remove IP from whitelist error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Toggle IP whitelist entry status
  app.patch("/api/client-ip-whitelist/:id/toggle", requireAuth, async (req, res) => {
    try {
      const { enabled } = req.body;
      const success = await storage.toggleIpWhitelist(req.params.id, enabled);
      if (success) {
        invalidateWhitelistCache(); // Force cache refresh
        res.json({ success: true, message: "IP whitelist entry status updated" });
      } else {
        res.status(404).json({ message: "IP entry not found" });
      }
    } catch (error) {
      console.error("Toggle IP whitelist entry error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get whitelist enabled status
  app.get("/api/client-ip-whitelist/status", requireAuth, async (req, res) => {
    try {
      const enabled = await storage.isClientWhitelistEnabled();
      res.json({ enabled });
    } catch (error) {
      console.error("Get whitelist status error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Set whitelist enabled status
  app.put("/api/client-ip-whitelist/status", requireAuth, async (req, res) => {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ message: "enabled must be a boolean" });
      }
      
      await storage.setClientWhitelistEnabled(enabled);
      invalidateWhitelistCache(); // Force cache refresh
      res.json({ success: true, enabled, message: `IP whitelist ${enabled ? 'enabled' : 'disabled'}` });
    } catch (error) {
      console.error("Set whitelist status error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==========================================
  // DOMAIN POOL ROUTES (Admin Management)
  // ==========================================

  // Get all domains in pool (admin)
  app.get("/api/domain-pool", requireAuth, async (req, res) => {
    try {
      const domains = await storage.getDomainPool();
      res.json(domains);
    } catch (error) {
      console.error("Get domain pool error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add domain to pool (admin)
  app.post("/api/domain-pool", requireAuth, async (req, res) => {
    try {
      const { domain, description } = req.body;
      
      if (!domain) {
        return res.status(400).json({ message: "Domain is required" });
      }

      const newDomain = await storage.addDomainToPool({ domain, description, enabled: true });
      res.json({ success: true, domain: newDomain });
    } catch (error: any) {
      console.error("Add domain to pool error:", error);
      if (error.message?.includes('duplicate') || error.code === '23505') {
        res.status(400).json({ message: "This domain already exists in the pool" });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // Bulk add domains to pool (admin)
  app.post("/api/domain-pool/bulk", requireAuth, async (req, res) => {
    try {
      const { domains } = req.body;
      
      if (!Array.isArray(domains) || domains.length === 0) {
        return res.status(400).json({ message: "domains must be a non-empty array" });
      }

      if (domains.length > 1000) {
        return res.status(400).json({ message: "Maximum 1000 domains at once" });
      }

      let added = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const domain of domains) {
        const trimmed = typeof domain === 'string' ? domain.trim() : '';
        if (!trimmed) continue;

        try {
          await storage.addDomainToPool({ domain: trimmed, enabled: true });
          added++;
        } catch (error: any) {
          if (error.message?.includes('duplicate') || error.code === '23505') {
            skipped++;
          } else {
            errors.push(`${trimmed}: ${error.message || 'Unknown error'}`);
          }
        }
      }

      res.json({ success: true, added, skipped, errors });
    } catch (error) {
      console.error("Bulk add domains error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Remove domain from pool (admin)
  app.delete("/api/domain-pool/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.removeDomainFromPool(req.params.id);
      if (success) {
        res.json({ success: true, message: "Domain removed from pool" });
      } else {
        res.status(404).json({ message: "Domain not found" });
      }
    } catch (error) {
      console.error("Remove domain from pool error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Toggle domain in pool (admin)
  app.patch("/api/domain-pool/:id/toggle", requireAuth, async (req, res) => {
    try {
      const { enabled } = req.body;
      const success = await storage.toggleDomainInPool(req.params.id, enabled);
      if (success) {
        res.json({ success: true, message: "Domain status updated" });
      } else {
        res.status(404).json({ message: "Domain not found" });
      }
    } catch (error) {
      console.error("Toggle domain error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get daily generation limit (admin)
  app.get("/api/domain-pool/settings/limit", requireAuth, async (req, res) => {
    try {
      const limit = await storage.getDailyGenerationLimit();
      res.json({ limit });
    } catch (error) {
      console.error("Get generation limit error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Set daily generation limit (admin)
  app.put("/api/domain-pool/settings/limit", requireAuth, async (req, res) => {
    try {
      const { limit } = req.body;
      if (typeof limit !== 'number' || limit < 1 || limit > 100) {
        return res.status(400).json({ message: "Limit must be a number between 1 and 100" });
      }
      
      await storage.setDailyGenerationLimit(limit);
      res.json({ success: true, limit });
    } catch (error) {
      console.error("Set generation limit error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==========================================
  // USER DOMAIN ROUTES (Client User Access)
  // ==========================================

  // Get available domains for client user
  app.get("/api/user/domains", requireClientAuth, async (req: any, res) => {
    try {
      // Get all enabled domains from pool
      const allDomains = await storage.getDomainPool();
      const availableDomains = allDomains.filter(d => d.enabled);
      res.json(availableDomains);
    } catch (error) {
      console.error("Get user domains error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user's generated domains (history)
  app.get("/api/user/domains/generated", requireClientAuth, async (req: any, res) => {
    try {
      const userId = req.session.clientUserId;
      const generations = await storage.getUserDomainGenerations(userId);
      res.json(generations);
    } catch (error) {
      console.error("Get user domain generations error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user's remaining generations for today
  app.get("/api/user/domains/remaining", requireClientAuth, async (req: any, res) => {
    try {
      const userId = req.session.clientUserId;
      const [todayGenerations, dailyLimit] = await Promise.all([
        storage.getUserDomainGenerationsToday(userId),
        storage.getDailyGenerationLimit()
      ]);
      
      // Filter to only today's generations
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayCount = todayGenerations.filter(g => new Date(g.generatedAt) >= today).length;
      
      res.json({ 
        used: todayCount, 
        limit: dailyLimit, 
        remaining: Math.max(0, dailyLimit - todayCount) 
      });
    } catch (error) {
      console.error("Get remaining generations error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Test domain reachability (client user)
  app.post("/api/user/domains/test", requireClientAuth, async (req: any, res) => {
    try {
      const { domain } = req.body;
      
      if (!domain) {
        return res.status(400).json({ message: "domain is required" });
      }

      // Simple HEAD request to test if domain is reachable
      const https = await import('https');
      const http = await import('http');
      
      const testUrl = `https://${domain}`;
      
      const reachable = await new Promise<boolean>((resolve) => {
        const timeoutId = setTimeout(() => resolve(false), 5000);
        
        https.get(testUrl, { timeout: 5000 }, (response) => {
          clearTimeout(timeoutId);
          // Any response (even redirects) means it's reachable
          resolve(response.statusCode !== undefined && response.statusCode < 500);
          response.destroy();
        }).on('error', () => {
          clearTimeout(timeoutId);
          resolve(false);
        });
      });

      res.json({ domain, reachable });
    } catch (error) {
      console.error("Test domain error:", error);
      res.json({ domain: req.body.domain || '', reachable: false });
    }
  });

  // Generate link for a domain (client user)
  app.post("/api/user/domains/generate", requireClientAuth, async (req: any, res) => {
    try {
      const userId = req.session.clientUserId;
      const clientUser = await storage.getClientUser(userId);
      if (!clientUser) {
        return res.status(401).json({ message: "User not found" });
      }

      const { domainId } = req.body;

      if (!domainId) {
        return res.status(400).json({ message: "domainId is required" });
      }

      // Check daily limit
      const [todayGenerations, dailyLimit] = await Promise.all([
        storage.getUserDomainGenerationsToday(userId),
        storage.getDailyGenerationLimit()
      ]);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayCount = todayGenerations.filter(g => new Date(g.generatedAt) >= today).length;

      if (todayCount >= dailyLimit) {
        return res.status(429).json({ 
          message: `Daily limit reached (${dailyLimit} domains per day). Please try again tomorrow.`,
          remaining: 0
        });
      }

      // Get domain from pool
      const domain = await storage.getDomainFromPool(domainId);
      if (!domain || !domain.enabled) {
        return res.status(404).json({ message: "Domain not found or disabled" });
      }

      // Check if user already generated this domain
      const existingGenerations = await storage.getUserDomainGenerations(userId);
      const alreadyGenerated = existingGenerations.some(g => g.domain === domain.domain);
      if (alreadyGenerated) {
        return res.status(409).json({ message: "You have already generated this domain" });
      }

      // Get user's API key info
      const apiKey = clientUser.apiKeyId ? await storage.getApiKeyById(clientUser.apiKeyId) : null;

      // Create generation record
      const generation = await storage.createUserDomainGeneration({
        userId,
        domainId: domain.id,
        domain: domain.domain
      });

      // Get user's redirect URLs
      const redirectUrls = await storage.getUserRedirectUrls(userId);

      res.json({
        success: true,
        generation,
        domain: domain.domain,
        apiKey: apiKey?.keyValue || 'NO_API_KEY',
        redirectUrls: redirectUrls || { humanUrl: '', botUrl: '' },
        remaining: dailyLimit - todayCount - 1
      });
    } catch (error) {
      console.error("Generate domain link error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  // isClientIpWhitelisted: same logic as the /api/user HTTP middleware above,
  // threaded into the WebSocket upgrade path to avoid a circular import.
  // Fail-open (return true) on transient errors to match HTTP middleware behaviour.
  async function isClientIpWhitelisted(ip: string): Promise<boolean> {
    try {
      const now = Date.now();
      if (now - whitelistCache.lastRefresh > WHITELIST_CACHE_TTL) {
        const [enabled, entries] = await Promise.all([
          storage.isClientWhitelistEnabled(),
          storage.getClientIpWhitelist(),
        ]);
        whitelistCache.enabled = enabled;
        whitelistCache.entries = entries
          .filter((e) => e.enabled)
          .map((e) => ({ cidr: e.cidr, enabled: e.enabled }));
        whitelistCache.lastRefresh = now;
      }
      if (!whitelistCache.enabled) return true;           // disabled → allow all
      if (whitelistCache.entries.length === 0) return false; // enabled but empty → deny
      const normalizedIp = ipaddr.parse(ip);
      for (const entry of whitelistCache.entries) {
        try {
          if (entry.cidr.includes("/")) {
            const [rangeAddr, prefixLength] = ipaddr.parseCIDR(entry.cidr);
            if (normalizedIp.kind() === rangeAddr.kind() &&
                normalizedIp.match(rangeAddr, prefixLength)) {
              return true;
            }
          } else {
            if (ipaddr.parse(entry.cidr).toString() === normalizedIp.toString()) {
              return true;
            }
          }
        } catch { /* invalid entry — skip */ }
      }
      return false;
    } catch {
      return true; // fail-open
    }
  }

  // Attach WebSocket server for real-time security event streaming
  setupWebSocketServer(httpServer, sessionMw, isClientIpWhitelisted);
  return httpServer;
}