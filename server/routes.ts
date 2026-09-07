import type { Express } from "express";
import { z } from "zod";
import Stripe from "stripe";
import { randomUUID, randomBytes } from "crypto";
import rateLimit from "express-rate-limit";
import {
  createVerificationToken,
  validateVerificationCode,
  invalidatePreviousTokens,
  invalidateAllTokensForUser,
  checkEmailCooldown,
  recordEmailDispatch,
  maskEmail,
  TOKEN_EXPIRATION_MS,
  MAX_VERIFICATION_ATTEMPTS,
  EMAIL_COOLDOWN_MS,
} from "./authVerificationService";

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
import { ip2LocationHealth } from "./ip2locationHealth";
import { evaluateSafeProxyClassification, formatUsageTypeDescription } from "./vpnClassifier";
import { db } from "./db";
import { sql as sqlTag } from "drizzle-orm";
import session from "express-session";
import createMemoryStore from "memorystore";
const MemoryStore = createMemoryStore(session);
import { insertClassificationSchema, type ClientUser, computeEffectiveAccountStatus, normalizeTier, getTierCallLimit, type AccountStatusSummary } from "@shared/schema";
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
import {
  checkCrawlerUserAgent,
  checkDatacenterIsp,
  checkHeaderAnomalies,
  checkRequestVelocity,
} from "./crawlerDetection";

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
  message: {
    status: 429,
    code: "RATE_LIMIT_EXCEEDED",
    message: "Too Many Requests. You have made too many requests in a short period of time. Please wait a moment and try again.",
    error: "Too Many Requests",
  },
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

export function extractFirstPublicIp(rawIpOrHeader: string | string[] | undefined): string {
  if (!rawIpOrHeader) return 'unknown';
  const rawStr = Array.isArray(rawIpOrHeader) ? rawIpOrHeader.join(',') : String(rawIpOrHeader);
  const parts = rawStr.split(',').map(s => s.trim().replace(/^::ffff:/, '')).filter(Boolean);
  for (const part of parts) {
    if (!isPrivateOrLocalIp(part)) {
      return part;
    }
  }
  return parts[0] || 'unknown';
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

  const startLookupTime = Date.now();

  // 1. Try IP2Location API with ultra-fast 1200ms timeout
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`https://api.ip2location.io/?key=${encodeURIComponent(apiKey)}&ip=${encodeURIComponent(ip)}`, {
      headers: { 'User-Agent': userAgent || 'CleanTraffic/1.0', 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeout);

    let data: any = null;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }

    if (res.ok && data && !data.error && (data.country_name || data.country_code)) {
      ip2LocationHealth.recordSuccess(Date.now() - startLookupTime, 'ip2location.io');
      const p = data.proxy || {};
      const fraudScore = typeof data.fraud_score === 'number' 
        ? data.fraud_score 
        : (parseInt(data.fraud_score, 10) || 0);

      const hasProxyIndicator = Boolean(
        data.is_proxy || 
        p.is_vpn || 
        p.is_tor || 
        p.is_public_proxy || 
        p.is_web_proxy || 
        p.is_residential_proxy || 
        p.is_consumer_privacy_network || 
        p.is_enterprise_private_network ||
        p.is_web_crawler || 
        p.is_ai_crawler || 
        p.is_spammer || 
        p.is_scanner || 
        p.is_botnet || 
        p.is_bogon
      );

      return {
        ip,
        location: data.city_name && data.country_name ? `${data.city_name}, ${data.country_name}` : (data.country_name || 'Unknown'),
        isp: data.as || data.isp || 'Unknown',
        country_code: data.country_code || '',
        country_name: data.country_name || 'Unknown',
        city_name: data.city_name || 'Unknown',
        region_name: data.region_name || '',
        usage_type: data.usage_type || '',
        is_proxy: hasProxyIndicator,
        fraud_score: fraudScore,
        proxy_data: {
          last_seen: p.last_seen ?? 0,
          proxy_type: p.proxy_type || '-',
          threat: p.threat || '-',
          provider: p.provider || '-',
          is_vpn: Boolean(p.is_vpn),
          is_tor: Boolean(p.is_tor),
          is_data_center: Boolean(p.is_data_center),
          is_public_proxy: Boolean(p.is_public_proxy),
          is_web_proxy: Boolean(p.is_web_proxy),
          is_web_crawler: Boolean(p.is_web_crawler),
          is_ai_crawler: Boolean(p.is_ai_crawler),
          is_residential_proxy: Boolean(p.is_residential_proxy),
          is_consumer_privacy_network: Boolean(p.is_consumer_privacy_network),
          is_enterprise_private_network: Boolean(p.is_enterprise_private_network),
          is_spammer: Boolean(p.is_spammer),
          is_scanner: Boolean(p.is_scanner),
          is_botnet: Boolean(p.is_botnet),
          is_bogon: Boolean(p.is_bogon),
        }
      };
    }

    // Inspect errors returned by IP2Location.io
    if (data?.error) {
      const errCode = data.error.error_code;
      const errMsg = (data.error.error_message || '').toString();
      if (errCode === 10001 || errMsg.includes('INSUFFICIENT') || errMsg.includes('CREDIT') || errMsg.includes('QUOTA')) {
        ip2LocationHealth.recordError('quota_exhausted', errCode, errMsg, 'ip2location.io');
      } else if (errCode === 10000 || errMsg.includes('INVALID_API_KEY')) {
        ip2LocationHealth.recordError('invalid_key', errCode, errMsg, 'ip2location.io');
      } else if (errCode !== 10002) {
        ip2LocationHealth.recordError('service_down', errCode, errMsg, 'ip2location.io');
      }
    } else if (res.status === 429) {
      ip2LocationHealth.recordError('service_down', 429, 'Rate limit exceeded (HTTP 429)', 'ip2location.io');
    } else if (res.status >= 500) {
      ip2LocationHealth.recordError('service_down', res.status, `Upstream server error (HTTP ${res.status})`, 'ip2location.io');
    }
  } catch (e: any) {
    const isTimeout = e?.name === 'AbortError';
    if (isTimeout) {
      ip2LocationHealth.recordError('timeout', 'TIMEOUT', 'IP2Location lookup timed out (>1200ms)', 'ip2location.io');
    } else {
      ip2LocationHealth.recordError('network', 'NETWORK_ERR', e?.message || 'Network lookup error', 'ip2location.io');
    }
  }

  // 2. Try IP2Geolocation.io API fallback with fast 1200ms timeout
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`https://api.ip2geolocation.io/ipgeo?apiKey=${encodeURIComponent(apiKey)}&ip=${encodeURIComponent(ip)}&include=security`, {
      headers: { 'User-Agent': userAgent || 'CleanTraffic/1.0', 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data.country_name || data.country_code2) {
        ip2LocationHealth.recordSuccess(Date.now() - startLookupTime, 'ip2geolocation.io');
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
  // Initialize proactive IP2Location health probe and background checking
  ip2LocationHealth.init(getEffectiveIp2GeoKey);

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

  /**
   * Authoritative helper that ensures user subscription status and API-key state are synchronized
   * with current database records and time:
   * 1. Re-fetches freshest client user record directly from storage to prevent stale in-memory state.
   * 2. Checks trial expiration against real time (Date.now()) and persists 'trial_expired' if passed.
   * 3. Computes comprehensive statusSummary (isActive, isPaidActive, isTrialExpired, etc.).
   * 4. Ensures the user's API key state matches:
   *    - If active paid or valid trial: re-activates API key (even if previously marked expired),
   *      clears stale trial expiresAt, and updates call limit to current tier limit.
   *    - If inactive/expired: updates API key status to 'expired'.
   */
  async function syncClientUserSubscription(user: ClientUser): Promise<{ user: ClientUser; statusSummary: AccountStatusSummary }> {
    let activeUser = (await storage.getClientUser(user.id)) || user;
    const now = new Date();

    const isTrialing = (activeUser.subscriptionStatus || 'trialing').toLowerCase().trim() === 'trialing';
    let hasExpiredTrialDate = false;

    if (activeUser.trialEndsAt) {
      const trialDate = activeUser.trialEndsAt instanceof Date ? activeUser.trialEndsAt : new Date(activeUser.trialEndsAt);
      if (!isNaN(trialDate.getTime()) && trialDate.getTime() <= now.getTime()) {
        hasExpiredTrialDate = true;
      }
    } else if (isTrialing) {
      // If trialing but trialEndsAt is null or missing, it is expired to prevent unbounded trial
      hasExpiredTrialDate = true;
    }

    if (isTrialing && hasExpiredTrialDate) {
      try {
        const updated = await storage.updateClientUser(activeUser.id, {
          subscriptionStatus: 'trial_expired',
        });
        if (updated) {
          activeUser = updated;
          console.log(`[SUBSCRIPTION_SYNC] Automatically transitioned expired trial user ${activeUser.username} (${activeUser.id}) to 'trial_expired'`);
        }
      } catch (err) {
        console.error(`[SUBSCRIPTION_SYNC] Error updating expired status for user ${activeUser.id}:`, err);
        activeUser = { ...activeUser, subscriptionStatus: 'trial_expired' };
      }
    }

    const statusSummary = computeEffectiveAccountStatus(activeUser);

    // Keep API key status and call limit authoritatively aligned with account state
    if (activeUser.apiKeyId) {
      try {
        const apiKey = (await storage.getApiKeyById(activeUser.apiKeyId)) || (await storage.getApiKey(activeUser.apiKeyId));
        if (apiKey) {
          if (statusSummary.isActive) {
            const isStaleExpired = apiKey.status === 'expired';
            const isStaleExpiresAt = statusSummary.isPaidActive && apiKey.expiresAt !== null;
            const isStaleCallLimit = (apiKey.callLimit || 0) < statusSummary.callLimit;

            if (isStaleExpired || isStaleExpiresAt || isStaleCallLimit) {
              await storage.updateApiKey(apiKey.id, {
                status: 'active',
                expiresAt: statusSummary.isPaidActive ? null : (activeUser.trialEndsAt ? new Date(activeUser.trialEndsAt) : null),
                callLimit: statusSummary.callLimit,
                updatedAt: new Date(),
              });
              console.log(`[SUBSCRIPTION_SYNC] Re-activated API key ${apiKey.id} for active account ${activeUser.username} (tier: ${statusSummary.tier}, status: ${statusSummary.status})`);
            }
          } else {
            if (apiKey.status === 'active') {
              await storage.updateApiKey(apiKey.id, {
                status: 'expired',
                updatedAt: new Date(),
              });
              console.log(`[SUBSCRIPTION_SYNC] Expired API key ${apiKey.id} for inactive account ${activeUser.username} (status: ${statusSummary.status})`);
            }
          }
        }
      } catch (err) {
        console.error(`[SUBSCRIPTION_SYNC] Error synchronizing API key for user ${activeUser.id}:`, err);
      }
    }

    return { user: activeUser, statusSummary };
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
        subscriptionTier: "Pro",
        trialEndsAt,
        tosAccepted: new Date(),
        complianceStatus: "cleared",
        newsletter: !!newsletter,
      });

      // Provision trial API key & redirect URLs
      const apiKey = await provisionTrialForClientUser(newUser.id, username);

      // Generate cryptographically secure 5-minute verification token (SHA-256 hashed)
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress;
      const { record: tokenRecord, code: verificationCode, token: verificationToken } = await createVerificationToken({
        userId: newUser.id,
        email: cleanEmail,
        purpose: "email_verification",
        ip,
      });
      recordEmailDispatch(cleanEmail);

      // Send real transactional verification email via configured SMTP / Provider
      const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
      const host = req.get('host') || 'localhost:3000';
      const baseUrl = `${protocol}://${host}`;

      let sendRes: any = { success: false, message: "Email delivery not attempted" };
      try {
        sendRes = await sendVerificationEmail({
          to: cleanEmail,
          name: newUser.fullName || newUser.username,
          code: verificationCode,
          token: verificationToken,
          baseUrl,
        });
        if (sendRes.success) {
          console.log(`[AUTH_EVENT] Registration verification email dispatched to ${maskEmail(cleanEmail)} [messageId: ${sendRes.messageId || 'N/A'}]`);
        } else {
          console.error(`[AUTH_EVENT] Registration verification email delivery failed for ${maskEmail(cleanEmail)}: ${sendRes.message}`);
        }
      } catch (err: any) {
        console.error(`[AUTH_EVENT] Registration email dispatch exception for ${maskEmail(cleanEmail)}:`, err?.message || err);
        sendRes = { success: false, message: err?.message || "Mail delivery error" };
      }

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
          message: sendRes.success
            ? "Registration successful! A verification email with your 6-digit confirmation code has been dispatched to your inbox."
            : `Registration successful! Note: Outbound verification email could not be delivered (${sendRes.message}). You can resend the code in settings.`,
          requiresVerification: true,
          emailDispatched: !!sendRes.success,
          emailDeliveryError: !sendRes.success ? sendRes.message : undefined,
          email: cleanEmail,
          token: clientToken,
          verificationToken,
          expiresAt: tokenRecord.expiresAt,
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
        subscriptionTier: "Pro",
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

      const { user: syncedUser, statusSummary } = await syncClientUserSubscription(user);

      req.session.save((err) => {
        if (err) {
          console.error("Client session save error:", err);
        }
        res.json({
          message: "Login successful",
          token: clientToken,
          userId: syncedUser.id,
          username: syncedUser.username,
          user: {
            id: syncedUser.id,
            username: syncedUser.username,
            email: syncedUser.email,
            fullName: syncedUser.fullName,
            status: syncedUser.status,
            subscriptionStatus: statusSummary.status,
            subscriptionTier: statusSummary.tier,
            statusLabel: statusSummary.statusLabel,
            tierLabel: statusSummary.tierLabel,
            trialDaysRemaining: statusSummary.trialDaysRemaining,
            trialEndsAt: statusSummary.trialEndsAt,
            isActive: statusSummary.isActive,
            isTrial: statusSummary.isTrial,
            isTrialExpired: statusSummary.isTrialExpired,
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

      // Per-target email cooldown check (60s) to prevent inbox flooding / email abuse
      const cooldown = checkEmailCooldown(cleanEmail);
      if (!cooldown.allowed) {
        return res.status(429).json({
          message: `A verification code was recently requested for this email. Please wait ${cooldown.remainingSec} seconds before requesting a new one.`,
          retryAfter: cooldown.remainingSec,
        });
      }

      // Safe uniform response to protect account privacy and prevent account enumeration
      const genericResponse = {
        success: true,
        message: "If an account with this email exists in our system, you will receive a verification email with instructions to reset your password.",
        email: cleanEmail,
      };

      // Look up user by email or username/email
      const user = await storage.getClientUserByEmail(cleanEmail) || await storage.getClientUserByUsernameOrEmail(cleanEmail);
      if (!user) {
        console.log(`[AUTH_EVENT] Password reset requested for non-existent email: ${maskEmail(cleanEmail)}`);
        return res.json(genericResponse);
      }

      if (user.status === "deleted" || user.status === "deactivated") {
        console.log(`[AUTH_EVENT] Password reset requested for deactivated account: ${maskEmail(cleanEmail)}`);
        return res.json(genericResponse);
      }

      // Generate cryptographically secure 5-minute reset token (SHA-256 hashed), invalidating older tokens
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress;
      const { record: tokenRecord, code, token } = await createVerificationToken({
        userId: user.id,
        email: cleanEmail,
        purpose: "password_reset",
        ip,
      });
      recordEmailDispatch(cleanEmail);

      // Send real password recovery email via SMTP
      sendPasswordResetEmail({
        to: cleanEmail,
        name: user.fullName || user.username,
        code,
        token,
      })
        .then((emailRes) => {
          if (emailRes.success) {
            console.log(`[AUTH_EVENT] Password reset email sent to ${maskEmail(cleanEmail)} [messageId: ${emailRes.messageId || 'N/A'}]`);
          } else {
            console.error(`[AUTH_EVENT] Password reset email delivery failure for ${maskEmail(cleanEmail)}: ${emailRes.message}`);
          }
        })
        .catch((err) => console.error("[Password Recovery Email Dispatch Error]:", err));

      console.log(`[AUTH_EVENT] Password reset initiated for ${maskEmail(cleanEmail)} (userId: ${user.id}, expires: 5m)`);

      return res.json(genericResponse);
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

      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress;
      const result = await validateVerificationCode({
        email: cleanEmail,
        code,
        purpose: "password_reset",
        ip,
      });

      if (!result.valid || !result.record) {
        const statusCode = result.status === 'invalidated' ? 429 : 400;
        return res.status(statusCode).json({
          valid: false,
          message: result.message,
          remainingAttempts: result.remainingAttempts,
        });
      }

      return res.json({ valid: true, token: result.record.token, message: "Verification code verified successfully." });
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

      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress;
      const result = await validateVerificationCode({
        email: cleanEmail,
        code,
        token,
        purpose: "password_reset",
        ip,
      });

      if (!result.valid || !result.record) {
        const statusCode = result.status === 'invalidated' ? 429 : 400;
        return res.status(statusCode).json({ message: result.message });
      }

      const user = await storage.getClientUser(result.record.userId);
      if (!user) {
        return res.status(404).json({ message: "User account not found." });
      }
      if (user.status === "deleted" || user.status === "deactivated") {
        return res.status(403).json({ message: "Account has been deactivated." });
      }

      // Hash and update the user's password securely
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateClientUser(user.id, {
        password: hashedPassword,
      });

      // Invalidate all remaining password reset tokens for this user
      await invalidateAllTokensForUser(user.id, "password_reset");

      // Invalidate all active authenticated sessions/tokens for this user
      for (const [authToken, tokenData] of authTokens.entries()) {
        if (tokenData.userId === user.id) {
          authTokens.delete(authToken);
        }
      }
      if (req.session) {
        delete (req.session as any).clientUserId;
        delete (req.session as any).clientUserAuthenticated;
      }

      console.log(`[AUTH_EVENT] Successfully reset password for user ${user.id} (${maskEmail(cleanEmail)}). All active sessions invalidated.`);

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
      const cleanEmail = email ? email.toLowerCase().trim() : undefined;

      const auth = getSessionOrToken(req);
      const sessionUserId = auth?.userId || req.session?.clientUserId;
      let sessionUser: any = null;
      if (sessionUserId) {
        sessionUser = await storage.getClientUser(sessionUserId);
      }

      // If user is authenticated, ensure they cannot verify an email belonging to another account
      if (sessionUser && sessionUser.email && cleanEmail && sessionUser.email.toLowerCase().trim() !== cleanEmail) {
        return res.status(403).json({
          message: "You can only verify the email address associated with your logged-in account.",
        });
      }

      const targetEmail = cleanEmail || (sessionUser?.email ? sessionUser.email.toLowerCase().trim() : undefined);

      // Check if user is already verified in authoritative storage
      if (targetEmail) {
        const existing = await storage.getClientUserByEmail(targetEmail);
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

      let targetUserId = sessionUser?.id;
      if (!targetUserId && targetEmail) {
        const matchingUser = await storage.getClientUserByEmail(targetEmail);
        if (matchingUser) targetUserId = matchingUser.id;
      }

      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress;
      const result = await validateVerificationCode({
        userId: targetUserId,
        email: targetEmail,
        code,
        token,
        purpose: "email_verification",
        ip,
      });

      if (!result.valid || !result.record) {
        const statusCode = result.status === 'invalidated' ? 429 : 400;
        return res.status(statusCode).json({
          message: result.message,
          remainingAttempts: result.remainingAttempts,
          status: result.status,
        });
      }

      // Mark user email verified in persistent storage
      const user = (await storage.getClientUser(result.record.userId)) || (await storage.getClientUserByEmail(result.record.email));
      if (!user) {
        return res.status(404).json({ message: "User account not found." });
      }
      if (user.status === "suspended" || user.complianceStatus === "suspended") {
        return res.status(403).json({ message: "Account is suspended. Please contact support." });
      }
      if (user.status === "deleted" || user.status === "deactivated") {
        return res.status(403).json({ message: "Account has been deactivated." });
      }

      const updatedUser = await storage.updateClientUser(user.id, {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      });

      // Invalidate all pending verification tokens for this user
      await invalidateAllTokensForUser(user.id, "email_verification");

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

      console.log(`[AUTH_EVENT] Email verified successfully for ${maskEmail(user.email || "")} (${user.id})`);

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
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress;
      const result = await validateVerificationCode({
        token,
        purpose: "email_verification",
        ip,
      });

      if (!result.valid || !result.record) {
        const errorReason = result.status === 'expired' ? 'expired' : result.status === 'consumed' ? 'already_used' : 'invalid_or_expired';
        return res.redirect(`/verification-required?error=${errorReason}`);
      }

      const user = (await storage.getClientUser(result.record.userId)) || (await storage.getClientUserByEmail(result.record.email));
      if (user) {
        if (user.status === "suspended" || user.status === "deleted") {
          return res.redirect("/verification-required?error=account_unavailable");
        }

        await storage.updateClientUser(user.id, {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        });
        await invalidateAllTokensForUser(user.id, "email_verification");

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
    email: z.string().email("Please provide a valid email address").max(100).trim().optional(),
  });

  app.post("/api/user/resend-verification", emailVerificationLimiter, async (req, res) => {
    try {
      const parse = resendVerificationSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ message: "Invalid email address", errors: parse.error.flatten().fieldErrors });
      }

      const auth = getSessionOrToken(req);
      const sessionUserId = auth?.userId || req.session?.clientUserId;
      let targetUser: any = null;

      if (sessionUserId) {
        targetUser = await storage.getClientUser(sessionUserId);
      }

      let cleanEmail = parse.data?.email ? parse.data.email.toLowerCase().trim() : "";
      if (!cleanEmail && targetUser?.email) {
        cleanEmail = targetUser.email.toLowerCase().trim();
      }

      if (!cleanEmail) {
        return res.status(400).json({ message: "Please provide your account email address." });
      }

      // If user is authenticated, ensure they cannot request codes for a different user's email
      if (targetUser && targetUser.email && targetUser.email.toLowerCase().trim() !== cleanEmail) {
        return res.status(403).json({
          message: "You can only request verification emails for the email address registered to your account.",
        });
      }

      // Per-email cooldown (60s) to protect mail delivery systems
      const cooldown = checkEmailCooldown(cleanEmail);
      if (!cooldown.allowed) {
        return res.status(429).json({
          message: `Please wait ${cooldown.remainingSec} seconds before requesting another verification email.`,
          retryAfter: cooldown.remainingSec,
        });
      }

      const user = targetUser || (await storage.getClientUserByEmail(cleanEmail)) || (await storage.getClientUserByUsernameOrEmail(cleanEmail));
      if (!user) {
        // Return generic message to prevent email enumeration for unauthenticated requests
        return res.json({
          success: true,
          message: "If an account exists with this email, a fresh verification link and code have been sent.",
        });
      }

      if (user.status === "suspended" || user.complianceStatus === "suspended") {
        return res.status(403).json({ message: "Account is suspended. Please contact support." });
      }
      if (user.status === "deleted" || user.status === "deactivated") {
        return res.status(403).json({ message: "Account has been deactivated." });
      }

      if (user.emailVerified) {
        return res.json({
          success: true,
          alreadyVerified: true,
          message: "Your email address is already verified. You can access your dashboard directly.",
        });
      }

      // Generate a fresh 5-minute cryptographically secure code, automatically invalidating previous codes
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress;
      const { record: tokenRecord, code: verificationCode, token: verificationToken } = await createVerificationToken({
        userId: user.id,
        email: cleanEmail,
        purpose: "email_verification",
        ip,
      });

      const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
      const host = req.get('host') || 'localhost:3000';
      const baseUrl = `${protocol}://${host}`;

      let sendRes: any;
      try {
        sendRes = await sendVerificationEmail({
          to: cleanEmail,
          name: user.fullName || user.username,
          code: verificationCode,
          token: verificationToken,
          baseUrl,
        });
      } catch (sendErr: any) {
        console.error(`[AUTH_EVENT] Resend verification email dispatch error for ${maskEmail(cleanEmail)}:`, sendErr?.message || sendErr);
        sendRes = { success: false, message: sendErr?.message || "Internal mail service connection error" };
      }

      // CRITICAL: Strict delivery verification. Do not report success if SMTP failed!
      if (!sendRes || !sendRes.success) {
        console.error(`[AUTH_EVENT] Mail delivery rejected for ${maskEmail(cleanEmail)}: ${sendRes?.message}`);
        // Invalidate token so no undelivered phantom code exists
        await invalidateAllTokensForUser(user.id, "email_verification");
        return res.status(502).json({
          success: false,
          message: sendRes?.message || "Mail delivery service could not deliver the verification email. Please verify SMTP settings or try again.",
        });
      }

      recordEmailDispatch(cleanEmail);
      console.log(`[AUTH_EVENT] Resend verification email successfully delivered to mail server for ${maskEmail(cleanEmail)} [messageId: ${sendRes.messageId || 'N/A'}]`);

      return res.json({
        success: true,
        message: `A fresh 6-digit confirmation code (valid for 5 minutes) has been dispatched to ${cleanEmail}. Please check your inbox and spam folder.`,
        expiresAt: tokenRecord.expiresAt,
      });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Failed to resend verification email. Please try again." });
    }
  });

  // Check email verification status against authoritative database record
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

      const { user: syncedUser, statusSummary } = await syncClientUserSubscription(user);

      return res.json({
        email: syncedUser.email,
        emailVerified: !!syncedUser.emailVerified,
        emailVerifiedAt: syncedUser.emailVerifiedAt,
        status: syncedUser.status,
        subscriptionStatus: statusSummary.status,
        subscriptionTier: statusSummary.tier,
        statusLabel: statusSummary.statusLabel,
        tierLabel: statusSummary.tierLabel,
        isActive: statusSummary.isActive,
        isTrial: statusSummary.isTrial,
        isTrialExpired: statusSummary.isTrialExpired,
        trialEndsAt: statusSummary.trialEndsAt,
        trialDaysRemaining: statusSummary.trialDaysRemaining,
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

      // Authoritatively sync user subscription and API key status with database records
      const { user: syncedUser, statusSummary } = await syncClientUserSubscription(user);

      if (apiKeyRecord.status === "paused") {
        return res.status(403).json({ message: "API key is currently paused in the dashboard." });
      }

      if (!statusSummary.isActive) {
        return res.status(403).json({
          message: statusSummary.rejectionReason || "API key has expired. Please renew your subscription in the dashboard.",
        });
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
      const userId = auth?.userId || req.session?.clientUserId || (req as any).clientUserId;
      if (!userId) return res.status(401).json({ message: "User not found" });
      const rawUser = await storage.getClientUser(userId);
      if (!rawUser) return res.status(401).json({ message: "User not found" });

      const { user, statusSummary } = await syncClientUserSubscription(rawUser);

      if (statusSummary.isActive) {
        return next();
      }

      return res.status(402).json({
        message: statusSummary.isTrialExpired
          ? "Your trial has expired. Please upgrade to continue."
          : "Your subscription is inactive. Please upgrade to continue.",
        subscriptionStatus: statusSummary.status,
        subscriptionTier: statusSummary.tier,
        statusLabel: statusSummary.statusLabel,
        tierLabel: statusSummary.tierLabel,
        trialEndsAt: statusSummary.trialEndsAt,
        upgradeRequired: true,
        notification: statusSummary.notification,
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
      const userId = auth?.userId || req.session?.clientUserId || (req as any).clientUserId;
      const rawUser = await storage.getClientUser(userId);
      if (!rawUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const { user, statusSummary } = await syncClientUserSubscription(rawUser);

      // Get API key info
      const apiKey = user.apiKeyId ? await storage.getApiKeyById(user.apiKeyId) : null;

      res.json({ 
        id: user.id,
        username: user.username,
        email: user.email,
        emailVerified: !!user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        status: user.status,
        createdAt: user.createdAt,
        // Authoritative Billing fields
        subscriptionStatus: statusSummary.status,
        subscriptionTier: statusSummary.tier,
        statusLabel: statusSummary.statusLabel,
        tierLabel: statusSummary.tierLabel,
        isActive: statusSummary.isActive,
        isTrial: statusSummary.isTrial,
        isTrialExpired: statusSummary.isTrialExpired,
        isExpiringSoon: statusSummary.isExpiringSoon,
        trialEndsAt: statusSummary.trialEndsAt,
        trialDaysRemaining: statusSummary.trialDaysRemaining,
        notification: statusSummary.notification,
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
        botUrl: "",
        allowedCountries: "ALL",
        allowedDevices: "all",
        blockVpn: "block",
        blockDatacenter: "block",
        blockTor: "block",
        fingerprintActivate: "enabled",
        wildcardSubdomains: "disabled",
        allowVpn: false
      });
    } catch (error) {
      console.error("Get user redirect URLs error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Client user's auto-detected location
  app.get("/api/client/current-location", async (req: any, res) => {
    try {
      let clientIp = req.headers['cf-connecting-ip'] ||
                     req.headers['x-forwarded-for'] ||
                     req.headers['x-real-ip'] ||
                     req.ip || 'unknown';
      if (typeof clientIp === 'string' && clientIp.includes(',')) {
        clientIp = clientIp.split(',')[0].trim();
      }
      const cleanTrafficApiKey = await getEffectiveIp2GeoKey();
      let geoData: any = null;
      if (cleanTrafficApiKey && !isPrivateOrLocalIp(clientIp)) {
        geoData = await fetchIpGeolocation(cleanTrafficApiKey, clientIp, req.headers['user-agent'] || '');
      }
      return res.json({
        ip: clientIp,
        countryCode: geoData?.country_code || 'AU',
        countryName: geoData?.country_name || 'Australia',
        city: geoData?.city_name || ''
      });
    } catch (e) {
      return res.json({
        ip: '127.0.0.1',
        countryCode: 'AU',
        countryName: 'Australia',
      });
    }
  });

  // Update client user's redirect URLs and routing rules
  app.put("/api/user/redirect-urls", requireClientAuth, async (req: any, res) => {
    try {
      const auth = getSessionOrToken(req);
      const userId = auth?.userId || req.session?.clientUserId || (req as any).clientUserId;
      if (!userId) {
        return res.status(401).json({ message: "User not found" });
      }

      const rawUser = await storage.getClientUser(userId);
      if (rawUser) {
        const { statusSummary } = await syncClientUserSubscription(rawUser);
        if (!statusSummary.isActive) {
          return res.status(403).json({
            message: statusSummary.isTrialExpired
              ? "Your trial has expired and your dashboard is in read-only mode. Upgrade your subscription to modify routing rules."
              : "Your subscription is inactive and your dashboard is in read-only mode. Upgrade your subscription to modify routing rules.",
            readOnly: true,
          });
        }
      }

      const { 
        humanUrl, 
        botUrl, 
        allowedCountries, 
        allowedDevices,
        desktopOsFilter,
        blockVpn,
        blockDatacenter,
        blockTor,
        fingerprintActivate,
        wildcardSubdomains,
        allowVpn 
      } = req.body;
      
      if (!humanUrl || !botUrl) {
        return res.status(400).json({ message: "Both humanUrl and botUrl are required" });
      }

      // Human URL format validation
      let parsedHuman: URL;
      try {
        parsedHuman = new URL(humanUrl.trim());
      } catch {
        return res.status(400).json({ message: "Invalid Target Offer (Human URL) format" });
      }

      // Reject non-HTTP(S) protocols for human URL
      if (parsedHuman.protocol !== 'http:' && parsedHuman.protocol !== 'https:') {
        return res.status(400).json({ message: "humanUrl must use http or https" });
      }

      // Bot action validation: Can be "404", "403" or a valid HTTP/HTTPS URL
      const trimmedBot = botUrl.trim();
      const isHttpErrorCode = trimmedBot === "404" || trimmedBot === "403" || trimmedBot.startsWith("404") || trimmedBot.startsWith("403");
      let normalizedBotUrl = trimmedBot;

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
      const suspiciousPaths = [
        '/login', '/signin', '/auth', '/account', '/password', '/verify',
        '/confirm', '/secure', '/banking', '/wallet', '/crypto'
      ];

      if (isHttpErrorCode) {
        normalizedBotUrl = trimmedBot.includes("403") ? "403" : "404";
      } else {
        let parsedBot: URL;
        try {
          parsedBot = new URL(trimmedBot);
        } catch {
          return res.status(400).json({ message: "Bot Action must be 404, 403, or a valid full URL (https://...)" });
        }

        if (parsedBot.protocol !== 'http:' && parsedBot.protocol !== 'https:') {
          return res.status(400).json({ message: "botUrl must use http or https, or be 404/403" });
        }

        const botHost = parsedBot.hostname.replace(/^www\./, '').toLowerCase();
        if (blockedHosts.includes(botHost)) {
          return res.status(400).json({ message: "URL shorteners are not allowed" });
        }

        const botPath = parsedBot.pathname.toLowerCase();
        if (suspiciousPaths.some(p => botPath.includes(p))) {
          return res.status(400).json({ message: "Redirect URLs containing login or banking paths are not permitted" });
        }
      }

      // Block known URL shorteners commonly used in phishing for human URL
      const humanHost = parsedHuman.hostname.replace(/^www\./, '').toLowerCase();
      if (blockedHosts.includes(humanHost)) {
        return res.status(400).json({ message: "URL shorteners are not allowed" });
      }

      // Block redirecting to known phishing/login targets for human URL
      const humanPath = parsedHuman.pathname.toLowerCase();
      if (suspiciousPaths.some(p => humanPath.includes(p))) {
        return res.status(400).json({ message: "Redirect URLs containing login or banking paths are not permitted" });
      }

      // Format allowedCountries as a clean uppercase comma-separated string
      let formattedAllowedCountries = "ALL";
      if (typeof allowedCountries === 'string') {
        const trimmed = allowedCountries.trim();
        if (trimmed && trimmed.toUpperCase() !== "ALL") {
          formattedAllowedCountries = trimmed.split(',').map(c => c.trim().toUpperCase()).filter(Boolean).join(',');
        } else if (trimmed.toUpperCase() === "ALL") {
          formattedAllowedCountries = "ALL";
        }
      } else if (Array.isArray(allowedCountries)) {
        if (allowedCountries.length > 0 && !allowedCountries.includes("ALL")) {
          formattedAllowedCountries = allowedCountries.map((c: string) => String(c).trim().toUpperCase()).filter(Boolean).join(',');
        } else {
          formattedAllowedCountries = "ALL";
        }
      }

      const validDevices = ["all", "desktop", "mobile", "mobile_tablet"];
      const formattedAllowedDevices = validDevices.includes(allowedDevices) ? allowedDevices : "all";

      const validOs = ["both", "windows", "mac"];
      const formattedDesktopOsFilter = validOs.includes(desktopOsFilter) ? desktopOsFilter : "both";

      const effectiveBlockVpn = blockVpn === "allow" ? "allow" : (blockVpn === "block" ? "block" : (allowVpn ? "allow" : "block"));
      const effectiveAllowVpn = effectiveBlockVpn === "allow";

      // Log URL update for compliance audit trail
      console.log(`[COMPLIANCE] User ${userId} updated routing rules: human=${parsedHuman.hostname} bot=${normalizedBotUrl} allowedCountries=${formattedAllowedCountries} allowedDevices=${formattedAllowedDevices} desktopOs=${formattedDesktopOsFilter} blockVpn=${effectiveBlockVpn}`);

      const updated = await storage.setUserRedirectUrls(userId, { 
        humanUrl, 
        botUrl: normalizedBotUrl,
        allowedCountries: formattedAllowedCountries,
        allowedDevices: formattedAllowedDevices,
        desktopOsFilter: formattedDesktopOsFilter,
        blockVpn: effectiveBlockVpn,
        blockDatacenter: blockDatacenter || "block",
        blockTor: blockTor || "block",
        fingerprintActivate: fingerprintActivate || "enabled",
        wildcardSubdomains: wildcardSubdomains || "disabled",
        allowVpn: effectiveAllowVpn
      });
      res.json(updated);
    } catch (error) {
      console.error("Update user redirect URLs error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get client user's classifications (their traffic logs)
  // Preserved and accessible even after trial expires (read-only history)
  app.get("/api/user/classifications", requireClientAuth, async (req: any, res) => {
    try {
      const auth = getSessionOrToken(req);
      const userId = auth?.userId || req.session?.clientUserId || (req as any).clientUserId;
      if (!userId) {
        return res.status(401).json({ message: "User not found" });
      }
      const user = await storage.getClientUser(userId);
      if (!user || !user.apiKeyId) {
        return res.json([]);
      }

      const limit = parseInt(req.query.limit as string) || 500;
      const classifications = await storage.getUserClassifications(user.apiKeyId, limit);
      
      // Return user classifications including individual visitor IP addresses and telemetry
      const formattedClassifications = classifications.map(c => ({
        id: c.id,
        ipAddress: c.ipAddress,
        ip: c.ipAddress,
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
      }));
      
      res.json(formattedClassifications);
    } catch (error) {
      console.error("Get user classifications error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get client user's statistics
  // Preserved and accessible even after trial expires (read-only history)
  app.get("/api/user/stats", requireClientAuth, async (req: any, res) => {
    try {
      const auth = getSessionOrToken(req);
      const userId = auth?.userId || req.session?.clientUserId || (req as any).clientUserId;
      if (!userId) {
        return res.status(401).json({ message: "User not found" });
      }
      const user = await storage.getClientUser(userId);
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
  
  // Get all client users (Admin only) - Authoritative sync of subscription & trial status
  app.get("/api/interface/client-users", requireAuth, async (req, res) => {
    try {
      const rawUsers = await storage.getAllClientUsers();
      const syncedUsers = await Promise.all(
        rawUsers.map(async (u) => {
          const { user, statusSummary } = await syncClientUserSubscription(u);
          return {
            ...user,
            subscriptionStatus: statusSummary.status,
            subscriptionTier: statusSummary.tier,
            statusLabel: statusSummary.statusLabel,
            tierLabel: statusSummary.tierLabel,
            trialDaysRemaining: statusSummary.trialDaysRemaining,
            isActive: statusSummary.isActive,
            isTrial: statusSummary.isTrial,
            isTrialExpired: statusSummary.isTrialExpired,
            isExpiringSoon: statusSummary.isExpiringSoon,
          };
        })
      );
      res.json(syncedUsers);
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

  // Update client user subscription & tier (Admin only)
  app.patch("/api/interface/client-users/:id/subscription", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { subscriptionStatus, subscriptionTier, trialDays } = req.body;

      const user = await storage.getClientUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updates: Partial<ClientUser> = {};

      if (subscriptionTier) {
        updates.subscriptionTier = normalizeTier(subscriptionTier);
      }

      if (subscriptionStatus) {
        const cleanStatus = subscriptionStatus.toLowerCase().trim();
        if (!['trialing', 'trial_expired', 'active', 'past_due', 'cancelled'].includes(cleanStatus)) {
          return res.status(400).json({ message: "Invalid status. Must be: trialing, trial_expired, active, past_due, cancelled" });
        }
        updates.subscriptionStatus = cleanStatus;

        if (cleanStatus === 'active') {
          // Upgrading to active subscription clears trial end date
          updates.trialEndsAt = null;
        } else if (cleanStatus === 'trial_expired') {
          // Set trial end date to now
          updates.trialEndsAt = new Date();
        } else if (cleanStatus === 'trialing') {
          const days = typeof trialDays === 'number' && trialDays > 0 ? trialDays : 14;
          updates.trialEndsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        }
      } else if (typeof trialDays === 'number' && trialDays > 0) {
        updates.subscriptionStatus = 'trialing';
        updates.trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
      }

      const updated = await storage.updateClientUser(id, updates);
      if (!updated) {
        return res.status(500).json({ message: "Failed to update user subscription" });
      }

      const { user: syncedUser, statusSummary } = await syncClientUserSubscription(updated);

      void auditLog({
        actorId: (req as any).session?.userId,
        actorType: "admin",
        action: "subscription.updated",
        targetId: id,
        targetType: "client_user",
        metadata: { updates, effectiveStatus: statusSummary.status, effectiveTier: statusSummary.tier },
      });

      console.log(`[ADMIN_SUBSCRIPTION_UPDATE] Admin updated user ${user.username} (${id}): status=${statusSummary.status}, tier=${statusSummary.tier}`);

      res.json({
        success: true,
        user: {
          ...syncedUser,
          subscriptionStatus: statusSummary.status,
          subscriptionTier: statusSummary.tier,
          statusLabel: statusSummary.statusLabel,
          tierLabel: statusSummary.tierLabel,
          trialDaysRemaining: statusSummary.trialDaysRemaining,
          isActive: statusSummary.isActive,
          isTrial: statusSummary.isTrial,
          isTrialExpired: statusSummary.isTrialExpired,
          isExpiringSoon: statusSummary.isExpiringSoon,
        },
      });
    } catch (error) {
      console.error("Admin subscription update error:", error);
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

      const subscriptionTier = normalizeTier(req.body.subscriptionTier || "Pro");
      const initialStatus = req.body.subscriptionStatus === "active" ? "active" : "trialing";
      const trialDays = typeof req.body.trialDays === "number" && req.body.trialDays > 0 ? req.body.trialDays : 14;
      const trialEndsAt = initialStatus === "active" ? null : new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

      const newUser = await storage.createClientUser({
        username,
        password: hashedPassword,
        email: email || null,
        apiKeyId: apiKeyId || null,
        status: 'active',
        subscriptionStatus: initialStatus,
        subscriptionTier,
        trialEndsAt,
      });

      const { user: syncedUser, statusSummary } = await syncClientUserSubscription(newUser);

      void auditLog({
        actorId: (req as any).session?.userId,
        actorType: "admin",
        action: "client_user.created",
        targetId: newUser.id,
        targetType: "client_user",
        metadata: { username, tier: subscriptionTier, status: initialStatus },
      });
      res.json({
        ...syncedUser,
        subscriptionStatus: statusSummary.status,
        subscriptionTier: statusSummary.tier,
        statusLabel: statusSummary.statusLabel,
        tierLabel: statusSummary.tierLabel,
        trialDaysRemaining: statusSummary.trialDaysRemaining,
        isActive: statusSummary.isActive,
        isTrial: statusSummary.isTrial,
        isTrialExpired: statusSummary.isTrialExpired,
        isExpiringSoon: statusSummary.isExpiringSoon,
      });
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
    code: string;
    message: string;
    apiKeyId: string | null;
    limitReached: boolean;
  }> {
    if (!apiKey || !apiKey.trim()) {
      return {
        valid: false,
        statusCode: 401,
        code: "INVALID_API_KEY",
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
        code: "INVALID_API_KEY",
        message: "Invalid API key. The provided key was not found or has been deleted.",
        apiKeyId: null,
        limitReached: false,
      };
    }

    if (validKey.enabled === false || validKey.status === "disabled") {
      return {
        valid: false,
        statusCode: 403,
        code: "API_KEY_REVOKED",
        message: "API key has been disabled by the resource owner.",
        apiKeyId: validKey.id,
        limitReached: true,
      };
    }

    if (validKey.status === "revoked") {
      return {
        valid: false,
        statusCode: 403,
        code: "API_KEY_REVOKED",
        message: "API key has been revoked by the resource owner.",
        apiKeyId: validKey.id,
        limitReached: true,
      };
    }

    if (validKey.status === "paused") {
      return {
        valid: false,
        statusCode: 403,
        code: "API_KEY_PAUSED",
        message: "API key is currently paused in the dashboard.",
        apiKeyId: validKey.id,
        limitReached: true,
      };
    }

    // Identify the user associated with this API key
    const keyOwner = await storage.getClientUserByApiKey(validKey.id);
    if (!keyOwner) {
      // Scenario: Account deleted, deactivated, or missing
      return {
        valid: false,
        statusCode: 403,
        code: "ACCOUNT_DEACTIVATED",
        message: "Account associated with this API key no longer exists or has been deactivated.",
        apiKeyId: validKey.id,
        limitReached: true,
      };
    }

    // Authoritatively check account-level states
    if (keyOwner.status === 'suspended' || keyOwner.complianceStatus === 'suspended') {
      return {
        valid: false,
        statusCode: 403,
        code: "ACCOUNT_SUSPENDED",
        message: "Account has been suspended. Please contact support.",
        apiKeyId: validKey.id,
        limitReached: true,
      };
    }

    if (keyOwner.status === 'inactive' || keyOwner.status === 'deactivated' || keyOwner.status === 'deleted') {
      return {
        valid: false,
        statusCode: 403,
        code: "ACCOUNT_DEACTIVATED",
        message: "Account has been deactivated. Please contact support.",
        apiKeyId: validKey.id,
        limitReached: true,
      };
    }

    // Retrieve current authoritative account status and subscription state from database records
    const { user: syncedUser, statusSummary } = await syncClientUserSubscription(keyOwner);

    // Re-validate API key authorization against the current subscription tier and state
    if (statusSummary.isActive) {
      // User has upgraded or is currently active!
      // If the API key was previously marked expired, re-activate it immediately so it is not treated as expired
      if (validKey.status === "expired" || (statusSummary.isPaidActive && validKey.expiresAt !== null)) {
        await storage.updateApiKey(validKey.id, {
          status: "active",
          expiresAt: statusSummary.isPaidActive ? null : (syncedUser.trialEndsAt ? new Date(syncedUser.trialEndsAt) : null),
          callLimit: statusSummary.callLimit,
          updatedAt: new Date(),
        });
        validKey.status = "active";
        validKey.expiresAt = statusSummary.isPaidActive ? null : validKey.expiresAt;
        validKey.callLimit = statusSummary.callLimit;
      }
    } else {
      // Account is not active. Authoritatively determine which state applies and return the exact required response
      if (statusSummary.isTrialExpired) {
        if (validKey.status !== "expired") {
          await storage.updateApiKey(validKey.id, { status: "expired" });
        }
        return {
          valid: false,
          statusCode: 403,
          code: "API_KEY_EXPIRED",
          message: "API key has expired. Please renew your subscription in the dashboard.",
          apiKeyId: validKey.id,
          limitReached: true,
        };
      }

      if (statusSummary.isPaidExpired) {
        if (validKey.status !== "expired") {
          await storage.updateApiKey(validKey.id, { status: "expired" });
        }
        return {
          valid: false,
          statusCode: 403,
          code: "API_KEY_EXPIRED",
          message: "Paid subscription has expired. Please renew your subscription in the dashboard to resume API calls.",
          apiKeyId: validKey.id,
          limitReached: true,
        };
      }

      if (statusSummary.isCancelled) {
        if (validKey.status !== "expired") {
          await storage.updateApiKey(validKey.id, { status: "expired" });
        }
        return {
          valid: false,
          statusCode: 403,
          code: "API_KEY_EXPIRED",
          message: "Subscription has been cancelled. Please reactivate your subscription in the dashboard to resume API calls.",
          apiKeyId: validKey.id,
          limitReached: true,
        };
      }

      return {
        valid: false,
        statusCode: 403,
        code: "API_KEY_EXPIRED",
        message: statusSummary.rejectionReason || "Account subscription is inactive. Please upgrade or renew your subscription in the dashboard to resume API calls.",
        apiKeyId: validKey.id,
        limitReached: true,
      };
    }

    let limitReached = false;
    // Increment usage quota
    const usageAllowed = await storage.incrementApiKeyUsage(cleanKey);
    if (!usageAllowed) {
      limitReached = true;
    }

    return {
      valid: true,
      statusCode: 200,
      code: "OK",
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
        code: authResult.code,
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
        code: authResult.code,
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
      const auth = getSessionOrToken(req);
      const userId = auth?.userId || req.session?.clientUserId || (req as any).clientUserId;
      const rawUser = await storage.getClientUser(userId);
      if (!rawUser) return res.status(404).json({ message: "User not found" });

      const { user, statusSummary } = await syncClientUserSubscription(rawUser);

      res.json({
        subscriptionStatus: statusSummary.status,
        subscriptionTier: statusSummary.tier,
        statusLabel: statusSummary.statusLabel,
        tierLabel: statusSummary.tierLabel,
        trialEndsAt: statusSummary.trialEndsAt,
        trialDaysRemaining: statusSummary.trialDaysRemaining,
        isActive: statusSummary.isActive,
        isTrial: statusSummary.isTrial,
        isTrialExpired: statusSummary.isTrialExpired,
        isExpiringSoon: statusSummary.isExpiringSoon,
        notification: statusSummary.notification,
      });
    } catch (error) {
      console.error("Get billing status error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST upgrade subscription tier for the authenticated client user
  app.post("/api/user/upgrade", requireClientAuth, async (req: any, res) => {
    try {
      const auth = getSessionOrToken(req);
      const userId = auth?.userId || req.session?.clientUserId || (req as any).clientUserId;
      const rawUser = await storage.getClientUser(userId);
      if (!rawUser) return res.status(404).json({ message: "User not found" });

      const requestedTier = normalizeTier(req.body?.tier || req.body?.subscriptionTier || "Pro");

      const updated = await storage.updateClientUser(rawUser.id, {
        subscriptionStatus: "active",
        subscriptionTier: requestedTier,
        trialEndsAt: null, // Clear trial end date on active upgrade
      });

      if (!updated) {
        return res.status(500).json({ message: "Failed to update subscription" });
      }

      const { user, statusSummary } = await syncClientUserSubscription(updated);

      void auditLog({
        actorId: user.id,
        actorType: "client" as any,
        action: "user.subscription_upgraded",
        targetId: user.id,
        targetType: "client_user",
        metadata: { tier: requestedTier, previousStatus: rawUser.subscriptionStatus },
      });

      console.log(`[USER_UPGRADE] User ${user.username} (${user.id}) upgraded to ${requestedTier} tier!`);

      res.json({
        success: true,
        message: `Successfully upgraded to ${requestedTier} tier!`,
        subscriptionStatus: statusSummary.status,
        subscriptionTier: statusSummary.tier,
        statusLabel: statusSummary.statusLabel,
        tierLabel: statusSummary.tierLabel,
        isActive: statusSummary.isActive,
        isTrial: statusSummary.isTrial,
        isTrialExpired: statusSummary.isTrialExpired,
        isExpiringSoon: statusSummary.isExpiringSoon,
        trialEndsAt: statusSummary.trialEndsAt,
        trialDaysRemaining: statusSummary.trialDaysRemaining,
        notification: statusSummary.notification,
      });
    } catch (error) {
      console.error("Upgrade error:", error);
      res.status(500).json({ message: "Failed to upgrade subscription" });
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
      
      // Extract Visitor IP with Cloudflare, Akamai, Fastly, AWS ALB & Reverse Proxy awareness
      const ipCandidates = [
        req.body?.ip,
        req.query?.ip,
        req.headers['cf-connecting-ip'],
        req.headers['true-client-ip'],
        req.headers['x-real-ip'],
        req.headers['fastly-client-ip'],
        req.headers['x-client-ip'],
        req.headers['x-forwarded-for'],
        req.ip,
        req.connection?.remoteAddress,
        req.socket?.remoteAddress,
      ];
      let clientIp = 'unknown';
      for (const cand of ipCandidates) {
        if (cand) {
          const resolved = extractFirstPublicIp(cand as any);
          if (resolved && resolved !== 'unknown') {
            clientIp = resolved;
            break;
          }
        }
      }
      if (clientIp === 'unknown') {
        clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';
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

      // Fetch user configured redirect URLs & routing rules strictly from API key owner account
      let ownerUser: ClientUser | undefined = undefined;
      let configuredHumanUrl: string | null = null;
      let configuredBotUrl: string | null = null;
      let ownerAllowedCountries: string[] = [];
      let ownerAllowedDevices: string = "all";
      let ownerDesktopOsFilter: string = "both";
      let ownerBlockVpn: string = "block";
      let ownerBlockDatacenter: string = "block";
      let ownerBlockTor: string = "block";
      let ownerFingerprintActivate: string = "enabled";
      let ownerWildcardSubdomains: string = "disabled";
      let ownerAllowVpn: boolean = false;

      if (apiKeyId) {
        try {
          ownerUser = await storage.getClientUserByApiKey(apiKeyId);
          if (ownerUser) {
            const redirectUrls = await storage.getUserRedirectUrls(ownerUser.id);
            if (redirectUrls) {
              configuredHumanUrl = redirectUrls.humanUrl?.trim() || null;
              configuredBotUrl = redirectUrls.botUrl?.trim() || null;
              redirectVersion = redirectUrls.updatedAt ? new Date(redirectUrls.updatedAt).getTime() : 0;
              
              if (redirectUrls.allowedCountries && redirectUrls.allowedCountries.trim() && redirectUrls.allowedCountries.trim().toUpperCase() !== "ALL") {
                ownerAllowedCountries = redirectUrls.allowedCountries
                  .split(',')
                  .map((c: string) => c.trim().toUpperCase())
                  .filter(c => c && c !== "ALL");
              } else {
                ownerAllowedCountries = [];
              }

              ownerAllowedDevices = redirectUrls.allowedDevices || "all";
              ownerDesktopOsFilter = redirectUrls.desktopOsFilter || "both";
              ownerBlockVpn = redirectUrls.blockVpn || (redirectUrls.allowVpn ? "allow" : "block");
              ownerBlockDatacenter = redirectUrls.blockDatacenter || "block";
              ownerBlockTor = redirectUrls.blockTor || "block";
              ownerFingerprintActivate = redirectUrls.fingerprintActivate || "enabled";
              ownerWildcardSubdomains = redirectUrls.wildcardSubdomains || "disabled";
              ownerAllowVpn = ownerBlockVpn === "allow";
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
        // TIER 0: RATE LIMITS & SUBSCRIPTION STATUS
        if (authError) {
          visitorType = 'Bot';
          detectionMethod = 'Authentication Failed';
          blockReason = authError;
          console.log(`🚫 BLOCKED (Tier 0 - Auth Error): ${clientIp} - ${authError}`);
        } else if (limitReached) {
          visitorType = 'Bot';
          detectionMethod = 'Rate Limit / Subscription Expired';
          blockReason = 'Account limit reached or subscription expired';
          console.log(`🚫 BLOCKED (Tier 0 - Limit Reached): ${clientIp}`);
        }
        
        // TIER 1: MONPERRUS CRAWLER DATABASE & BAD BOT SIGNATURES (Pre-database check)
        const crawlerCheck = checkCrawlerUserAgent(userAgent);
        if (visitorType !== 'Bot' && crawlerCheck.isBot) {
          visitorType = 'Bot';
          detectionMethod = crawlerCheck.category || 'Monperrus Crawler Signature';
          blockReason = `${crawlerCheck.name || 'Bot'} detected (${crawlerCheck.patternMatched || 'Signature'})`;
          console.log(`🚫 BLOCKED (Tier 1 - Crawler Database): ${clientIp} - ${crawlerCheck.name} [${userAgent.substring(0, 40)}]`);
        }

        // TIER 1B: HIGH-FREQUENCY REQUEST VELOCITY ANOMALY (Intercepts automated scrapers on clean residential IPs)
        const velocityCheck = checkRequestVelocity(clientIp);
        if (visitorType !== 'Bot' && velocityCheck.isVelocityExceeded) {
          visitorType = 'Bot';
          detectionMethod = 'High-Frequency Request Velocity';
          blockReason = velocityCheck.reason || 'Excessive automated click velocity from single IP';
          console.log(`🚫 BLOCKED (Tier 1B - Request Velocity): ${clientIp} - ${velocityCheck.reason}`);
        }

        // Check header anomalies (synthetic browsers omitting standard headers)
        if (visitorType !== 'Bot') {
          const isApiForwarded = Boolean(req.body?.userAgent || req.body?.ip);
          const effectiveHeaders = isApiForwarded
            ? {
                accept: req.body?.accept || req.body?.headers?.['accept'] || req.body?.headers?.['Accept'] || '',
                'accept-language': req.body?.acceptLanguage || req.body?.accept_language || req.body?.headers?.['accept-language'] || req.body?.headers?.['Accept-Language'] || '',
              }
            : (req.headers || {});

          // Only perform header anomaly checks if:
          // 1) It's a direct visitor HTTP request, OR
          // 2) The forwarding proxy/PHP script explicitly provided the visitor's HTTP headers in the payload
          const hasForwardedHeaders = Boolean(req.body?.accept || req.body?.acceptLanguage || req.body?.headers);
          if (!isApiForwarded || hasForwardedHeaders) {
            const headerCheck = checkHeaderAnomalies(effectiveHeaders, userAgent);
            if (headerCheck.isSuspicious) {
              visitorType = 'Bot';
              detectionMethod = 'Synthetic Browser Headers';
              blockReason = headerCheck.reason || 'Synthetic browser headers detected';
              console.log(`🚫 BLOCKED (Tier 1 - Header Anomaly): ${clientIp} - ${headerCheck.reason}`);
            }
          }
        }

        // Check IP blocklist
        if (visitorType !== 'Bot') {
          const isBlockedIp = await storage.isIpBlocked(clientIp);
          if (isBlockedIp) {
            visitorType = 'Bot';
            detectionMethod = 'IP Blocklist';
            blockReason = `IP is on custom blocklist: ${clientIp}`;
            console.log(`🚫 BLOCKED (Tier 1 - IP Blocklist): ${clientIp}`);
          }
        }

        // Check CIDR blocklist
        if (visitorType !== 'Bot') {
          const isBlockedCidr = await storage.isIpInBlockedCidrRange(clientIp);
          if (isBlockedCidr) {
            visitorType = 'Bot';
            detectionMethod = 'CIDR Blocklist';
            blockReason = `IP is in blocked CIDR range: ${clientIp}`;
            console.log(`🚫 BLOCKED (Tier 1 - CIDR Blocklist): ${clientIp}`);
          }
        }

        // TIER 2: USER DEVICE & OS ROUTING RULES (100% Local evaluation from User-Agent - ZERO external IP2 calls)
        if (visitorType !== 'Bot' && ownerAllowedDevices && ownerAllowedDevices !== 'all') {
          const lowerDevice = (deviceType || '').toLowerCase();
          if (ownerAllowedDevices === 'desktop') {
            if (lowerDevice !== 'desktop') {
              visitorType = 'Bot';
              detectionMethod = 'Device Restricted (Desktop Only)';
              blockReason = `Device ${deviceType || 'non-desktop'} blocked by desktop-only policy`;
              console.log(`🚫 BLOCKED (Tier 2 - Device Filter): ${clientIp} is ${deviceType}, policy is desktop only`);
            } else if (ownerDesktopOsFilter && ownerDesktopOsFilter !== 'both') {
              const isWindows = /windows nt|win32|win64/i.test(userAgent);
              const isMac = /macintosh|mac os x/i.test(userAgent);
              if (ownerDesktopOsFilter === 'windows' && !isWindows) {
                visitorType = 'Bot';
                detectionMethod = 'OS Restricted (Windows Desktop Only)';
                blockReason = `Non-Windows OS blocked by Windows-only desktop policy`;
                console.log(`🚫 BLOCKED (Tier 2 - OS Filter): ${clientIp} blocked, required Windows desktop`);
              } else if (ownerDesktopOsFilter === 'mac' && !isMac) {
                visitorType = 'Bot';
                detectionMethod = 'OS Restricted (Mac Desktop Only)';
                blockReason = `Non-Mac OS blocked by macOS-only desktop policy`;
                console.log(`🚫 BLOCKED (Tier 2 - OS Filter): ${clientIp} blocked, required Mac desktop`);
              }
            }
          } else if (ownerAllowedDevices === 'mobile' && lowerDevice !== 'mobile') {
            visitorType = 'Bot';
            detectionMethod = 'Device Restricted (Mobile Only)';
            blockReason = `Device ${deviceType || 'non-mobile'} blocked by mobile-only policy`;
            console.log(`🚫 BLOCKED (Tier 2 - Device Filter): ${clientIp} is ${deviceType}, policy is mobile only`);
          } else if (ownerAllowedDevices === 'mobile_tablet' && lowerDevice !== 'mobile' && lowerDevice !== 'tablet') {
            visitorType = 'Bot';
            detectionMethod = 'Device Restricted (Mobile & Tablet Only)';
            blockReason = `Device ${deviceType || 'desktop'} blocked by mobile/tablet policy`;
            console.log(`🚫 BLOCKED (Tier 2 - Device Filter): ${clientIp} is ${deviceType}, policy is mobile & tablet only`);
          }
        }

        // Check if visitor was caught locally in Layer 1 or Layer 2
        if (visitorType === 'Bot') {
          // Zero-cost local rejection: Do NOT burn external IP2 API credits!
          const cachedData = ip2geoCache.get(clientIp);
          classificationData = cachedData ? { ...cachedData } : {
            ip: clientIp,
            location: isPrivateOrLocalIp(clientIp) ? 'Localhost' : 'Unknown',
            isp: isPrivateOrLocalIp(clientIp) ? 'Localhost' : 'Filtered by Rule',
            country_code: '',
            country_name: 'Unknown',
            city_name: '',
            region_name: '',
            usage_type: 'POLICY',
            connection_type: 'Local Rule Filter',
          };
          classificationData.browser = browser;
          classificationData.device_type = deviceType;
        } else {
          // TIER 3: FETCH IP GEOLOCATION & THREAT INTELLIGENCE (Only for candidates that passed Layer 1 & 2)
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
                country_code: isPrivateOrLocalIp(clientIp) ? 'AU' : '',
                country_name: isPrivateOrLocalIp(clientIp) ? 'Australia' : 'Unknown',
                city_name: isPrivateOrLocalIp(clientIp) ? 'Localhost' : 'Unknown',
                region_name: '',
                usage_type: 'RES',
                is_proxy: false
              };
            }
          }
          classificationData.browser = browser;
          classificationData.device_type = deviceType;

          const countryCode = (classificationData.country_code || '').toUpperCase();
          const ispName = classificationData.isp || '';
          const usageType = classificationData.usage_type || '';

          // TIER 3A: USER GEO-FENCING RULES (User-defined allowed countries evaluated first)
          if (visitorType !== 'Bot' && ownerAllowedCountries.length > 0) {
            if (countryCode && ownerAllowedCountries.includes(countryCode)) {
              // Country is explicitly permitted by user
              console.log(`✅ GEO-FENCING PASS: ${clientIp} country ${countryCode} is in user's allowed list [${ownerAllowedCountries.join(', ')}]`);
            } else {
              // Country is outside user's target market
              visitorType = 'Bot';
              detectionMethod = 'Geo-Fencing Restricted';
              blockReason = `Country ${countryCode || 'Unknown'} is not in your allowed countries (${ownerAllowedCountries.join(', ')})`;
              console.log(`🚫 BLOCKED (Tier 3A - User Geo-Fencing): ${clientIp} (${countryCode || 'Unknown'}) not in [${ownerAllowedCountries.join(', ')}]`);
            }
          } else if (visitorType !== 'Bot') {
            // Fallback to system-wide country whitelist if configured
            const systemCountryWhitelist = await storage.getCountryWhitelist();
            const enabledCountries = systemCountryWhitelist.filter(c => c.enabled !== false);
            if (enabledCountries.length > 0) {
              if (countryCode) {
                const isAllowed = await storage.isCountryAllowed(countryCode);
                if (!isAllowed) {
                  visitorType = 'Bot';
                  detectionMethod = 'Country Not Whitelisted';
                  blockReason = `Country not whitelisted: ${countryCode}`;
                  console.log(`🚫 BLOCKED (Tier 3A - System Country Whitelist): ${clientIp} - ${countryCode}`);
                }
              } else {
                visitorType = 'Bot';
                detectionMethod = 'Country Not Whitelisted';
                blockReason = `Unknown country while geo-fencing is active`;
              }
            }
          }

          // TIER 3B: DATACENTER ASN / CLOUD HOSTING PRE-SCREENING
          const datacenterAsnCheck = checkDatacenterIsp(ispName);
          const proxyDetailsForDch = classificationData.proxy_data || {};
          const isKnownVpnCandidate = Boolean(
            classificationData.is_proxy ||
            proxyDetailsForDch.is_vpn ||
            proxyDetailsForDch.is_residential_proxy ||
            proxyDetailsForDch.is_consumer_privacy_network
          );

          if (visitorType !== 'Bot' && ownerBlockDatacenter !== 'allow' && !(ownerAllowVpn && isKnownVpnCandidate) && datacenterAsnCheck.isDatacenter) {
            visitorType = 'Bot';
            detectionMethod = 'Datacenter Cloud ASN';
            blockReason = `Cloud/Datacenter provider detected: ${datacenterAsnCheck.provider}`;
            console.log(`🚫 BLOCKED (Tier 3B - Datacenter ASN): ${clientIp} - ${datacenterAsnCheck.provider}`);
          }

          if (visitorType !== 'Bot' && ownerBlockDatacenter !== 'allow' && !(ownerAllowVpn && isKnownVpnCandidate) && (usageType === 'DCH' || classificationData.proxy_data?.is_data_center)) {
            visitorType = 'Bot';
            detectionMethod = 'Datacenter Hosting (DCH)';
            blockReason = 'Datacenter hosting facility IP detected';
            console.log(`🚫 BLOCKED (Tier 3B - DCH Usage Type): ${clientIp}`);
          }

          // TIER 3C: SEARCH ENGINE SPIDER (SES) USAGE TYPE PRE-SCREENING
          if (visitorType !== 'Bot' && usageType === 'SES') {
            visitorType = 'Bot';
            detectionMethod = 'Search Engine Spider (SES)';
            blockReason = 'Search engine spider network address identified by IP intelligence';
            console.log(`🚫 BLOCKED (Tier 3C - SES Usage Type): ${clientIp}`);
          }

          // TIER 3D: SYSTEM-WIDE ISP BLACKLIST
          if (visitorType !== 'Bot' && ispName && ispName !== 'Unknown') {
            const isBlacklisted = await storage.isIspBlacklisted(ispName);
            if (isBlacklisted) {
              visitorType = 'Bot';
              detectionMethod = 'ISP Blacklisted';
              blockReason = `ISP blacklisted: ${ispName}`;
              console.log(`🚫 BLOCKED (Tier 3D - ISP Blacklist): ${clientIp} - ${ispName}`);
            }
          }

          // TIER 3E: VPN & PROXY POLICY (Multi-Vector Safe Classification Pipeline)
          const proxyDetails = classificationData.proxy_data || {};
          const isDetectedAsProxyOrVpn = Boolean(
            classificationData.is_proxy || 
            proxyDetails.is_vpn || 
            proxyDetails.is_tor || 
            proxyDetails.is_web_crawler ||
            proxyDetails.is_ai_crawler ||
            proxyDetails.is_residential_proxy ||
            proxyDetails.is_public_proxy ||
            proxyDetails.is_web_proxy ||
            proxyDetails.is_consumer_privacy_network ||
            proxyDetails.is_enterprise_private_network ||
            proxyDetails.is_botnet ||
            proxyDetails.is_spammer ||
            proxyDetails.is_scanner ||
            proxyDetails.is_bogon
          );

          if (visitorType !== 'Bot' && isDetectedAsProxyOrVpn) {
            const isApiForwarded = Boolean(req.body?.userAgent || req.body?.ip);
            const effectiveHeaders: Record<string, any> = isApiForwarded
              ? {
                  accept: req.body?.accept || req.body?.headers?.['accept'] || req.body?.headers?.['Accept'] || '',
                  'accept-language': req.body?.acceptLanguage || req.body?.accept_language || req.body?.headers?.['accept-language'] || req.body?.headers?.['Accept-Language'] || '',
                  'sec-ch-ua': req.body?.secChUa || req.body?.sec_ch_ua || req.body?.headers?.['sec-ch-ua'] || '',
                  'sec-ch-ua-platform': req.body?.secChUaPlatform || req.body?.sec_ch_ua_platform || req.body?.headers?.['sec-ch-ua-platform'] || '',
                  'sec-ch-ua-mobile': req.body?.secChUaMobile || req.body?.sec_ch_ua_mobile || req.body?.headers?.['sec-ch-ua-mobile'] || '',
                  'sec-fetch-site': req.body?.secFetchSite || req.body?.sec_fetch_site || req.body?.headers?.['sec-fetch-site'] || '',
                  'sec-fetch-mode': req.body?.secFetchMode || req.body?.sec_fetch_mode || req.body?.headers?.['sec-fetch-mode'] || '',
                }
              : (req.headers || {});

            const safeVpnResult = evaluateSafeProxyClassification(
              proxyDetails,
              classificationData.fraud_score || 0,
              usageType,
              ispName,
              effectiveHeaders,
              userAgent,
              {
                blockVpn: (ownerBlockVpn as any) || (ownerAllowVpn ? 'allow' : 'block'),
                allowVpn: Boolean(ownerAllowVpn),
                blockDatacenter: (ownerBlockDatacenter as any) || 'block',
                blockTor: (ownerBlockTor as any) || 'block',
              },
              datacenterAsnCheck.isDatacenter
            );

            visitorType = safeVpnResult.verdict;
            detectionMethod = safeVpnResult.detectionMethod;
            blockReason = safeVpnResult.blockReason;
            classificationData.connection_type = safeVpnResult.subType;
            classificationData.risk_score = safeVpnResult.riskScore;
            classificationData.threat_level = safeVpnResult.threatLevel;
            classificationData.telemetry_signals = safeVpnResult.signals;

            if (visitorType === 'Bot') {
              console.log(`🚫 BLOCKED (Tier 3E - Safe Proxy Defense): ${clientIp} - ${safeVpnResult.detectionMethod} [Type: ${safeVpnResult.subType}, Risk: ${safeVpnResult.riskScore}]`);
            } else {
              console.log(`✅ ALLOWED (Tier 3E - Verified Safe VPN): ${clientIp} - ${safeVpnResult.detectionMethod} [Type: ${safeVpnResult.subType}, Risk: ${safeVpnResult.riskScore}]`);
            }
          }

          // TIER 3F: ISP WHITELIST OVERRIDE (Allow trusted ISPs if flagged falsely)
          if (visitorType === 'Bot' && ispName && ispName !== 'Unknown') {
            const isWhitelisted = await storage.isIspWhitelisted(ispName);
            if (isWhitelisted) {
              visitorType = 'Human';
              detectionMethod = 'ISP Whitelist Override';
              blockReason = `ISP whitelisted (trusted): ${ispName}`;
              console.log(`✅ ALLOWED (Tier 3F - ISP Whitelist Override): ${clientIp} - ${ispName} is trusted`);
            }
          }
        }

        // TIER 4: REPUTATION & VERDICT FINALIZATION
        if (visitorType === 'Human') {
          if (detectionMethod === 'IP Analysis' || !detectionMethod) {
            detectionMethod = 'Clean Residential IP';
          }
        }

        if (!classificationData.connection_type) {
          classificationData.connection_type = classificationData.usage_type
            ? formatUsageTypeDescription(classificationData.usage_type)
            : (visitorType === 'Human' ? 'Residential Fixed-Line Broadband (ISP)' : 'Datacenter / Cloud Server (DCH)');
        }

        classificationData.visitor_type = visitorType;
        classificationData.detection_method = detectionMethod;
        console.log(`✅ Final Classification: ${clientIp} = ${visitorType} (${detectionMethod}) [Usage: ${classificationData.usage_type || 'N/A'}, Connection: ${classificationData.connection_type}]`);

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

      const isHumanVisitor = (visitorType === 'Human') && !limitReached && !authError;
      const effectiveRedirectUrl = isHumanVisitor ? finalHumanUrl : finalBotUrl;

      // Save classification record asynchronously (non-blocking) so HTTP response returns in <30ms
      (async () => {
        try {
          const classification = await storage.createClassification({
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
            detectionMethod: classificationData.detection_method || detectionMethod || 'IP Analysis',
            connectionType: classificationData.connection_type || (visitorType === 'Human' ? 'Residential Broadband (ISP)' : 'Proxy / Datacenter'),
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
              detectionMethod: classificationData.detection_method || detectionMethod || 'IP Analysis',
              country: classificationData.country_name || 'Unknown',
              isp: classificationData.isp || 'Unknown',
              action: visitorType === 'Human' ? 'Allowed' : 'Blocked',
              connectionType: classificationData.connection_type || (visitorType === 'Human' ? 'Residential Broadband (ISP)' : 'Proxy / Datacenter'),
              usageType: classificationData.usage_type || '',
              riskScore: classificationData.risk_score,
            });
          }
          console.log(`📝 Logged classification for IP ${clientIp} (${visitorType}) under API key ID ${apiKeyId || 'global'}`);
        } catch (logErr) {
          console.error("Error writing classification log:", logErr);
        }
      })();

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

      const isErrorCode = !isHumanVisitor && (finalBotUrl === '404' || finalBotUrl === '403');
      const response: any = {
        ip: clientIp,
        location: classificationData.location || 'Unknown',
        country: classificationData.country_name || 'Unknown',
        countryCode: classificationData.country_code || '',
        city: classificationData.city_name || 'Unknown',
        browser: classificationData.browser || browser || 'Unknown',
        device_type: classificationData.device_type || deviceType || 'Unknown', 
        visitorType: isHumanVisitor ? 'Human' : 'Bot',
        visitor_type: isHumanVisitor ? 'Human' : 'Bot',
        isHuman: isHumanVisitor,
        is_human: isHumanVisitor,
        action: isHumanVisitor ? 'Allowed' : 'Blocked',
        statusAction: isErrorCode ? finalBotUrl : 'redirect',
        statusCode: isErrorCode ? parseInt(finalBotUrl!) : 200,
        detection_method: classificationData.detection_method || detectionMethod || 'IP Analysis',
        block_reason: blockReason || null,
        isp: classificationData.isp || 'Unknown',
        usage_type: classificationData.usage_type || '',
        connection_type: classificationData.connection_type || (isHumanVisitor ? 'Residential Broadband (ISP)' : 'Proxy / Datacenter'),
        risk_score: classificationData.risk_score ?? (isHumanVisitor ? 8 : 80),
        threat_level: classificationData.threat_level || (isHumanVisitor ? 'low' : 'medium'),
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

  // Get IP2Geolocation API key status and health
  app.get("/api/ip2geo-api-key/status", requireAuth, async (req, res) => {
    try {
      const apiKey = await getEffectiveIp2GeoKey();
      const health = ip2LocationHealth.getState();
      
      if (!apiKey) {
        return res.json({
          hasKey: false,
          keyPreview: null,
          lastUpdated: "Never",
          health
        });
      }
      
      // Create masked key: first 4 + ***** + last 4
      const maskedKey = apiKey.length > 8 
        ? `${apiKey.substring(0, 4)}*****${apiKey.substring(apiKey.length - 4)}`
        : '****';
      
      res.json({
        hasKey: true,
        keyPreview: maskedKey,
        lastUpdated: health.lastChecked || new Date().toISOString(),
        health
      });
    } catch (error) {
      console.error("Check IP2Geo API key status error:", error);
      res.status(500).json({ 
        hasKey: false,
        keyPreview: null,
        lastUpdated: "Never",
        health: ip2LocationHealth.getState()
      });
    }
  });

  // Dedicated Health Check Endpoint for IP2Location API
  app.get("/api/ip2geo-api-key/health", requireAuth, async (req, res) => {
    try {
      const health = ip2LocationHealth.getState();
      res.json(health);
    } catch (error: any) {
      res.status(500).json({ error: true, message: error.message || "Failed to retrieve health status" });
    }
  });

  // On-demand Test / Diagnostic Probe for IP2Location API Key
  app.post("/api/ip2geo-api-key/test", requireAuth, async (req, res) => {
    try {
      const { apiKey } = req.body || {};
      const keyToTest = apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0
        ? apiKey.trim()
        : await getEffectiveIp2GeoKey();

      if (!keyToTest) {
        return res.status(400).json({
          success: false,
          message: "No API key configured to test. Please enter a key.",
          health: ip2LocationHealth.getState()
        });
      }

      const result = await ip2LocationHealth.testKey(keyToTest);
      res.json(result);
    } catch (error: any) {
      console.error("Test IP2Geo API key error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to execute diagnostic probe",
        health: ip2LocationHealth.getState()
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
      
      // Test the API key using comprehensive health diagnostics
      const testResult = await ip2LocationHealth.testKey(trimmedKey);

      // Save to storage layer (works with both Firestore and DatabaseStorage)
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
        success: testResult.success,
        message: testResult.message,
        keyPreview: `${trimmedKey.substring(0, 4)}*****${trimmedKey.substring(trimmedKey.length - 4)}`,
        health: testResult.health,
        details: testResult.details
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