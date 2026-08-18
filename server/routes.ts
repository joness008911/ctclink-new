import type { Express } from "express";
import { z } from "zod";
import Stripe from "stripe";
import { randomUUID } from "crypto";
import rateLimit from "express-rate-limit";

// Extend session types
declare module 'express-session' {
  interface SessionData {
    userId?: string; // Admin user ID
    clientUserId?: string; // Client user ID (end-user customers)
    clientUserAuthenticated?: boolean; // Whether client user has verified API key
  }
}
import { createServer, type Server } from "http";
import { storage, ip2geoCache } from "./storage";
import { db } from "./db";
import { sql as sqlTag } from "drizzle-orm";
import session from "express-session";
import { insertClassificationSchema } from "@shared/schema";
import { UAParser } from "ua-parser-js";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import ipaddr from "ipaddr.js";
import { broadcastClassification, setupWebSocketServer } from "./ws";

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
    // POST format: X-API-Key header
    const headerKey = (req.headers["x-api-key"] as string | undefined)?.trim();
    if (headerKey) return headerKey;
    // GET standard format: ?api_key=XXX
    const stdKey = (req.query.api_key as string | undefined)?.trim();
    if (stdKey) return stdKey;
    // GET legacy format: first query param name is the API key
    const legacyKey = Object.keys(req.query)[0];
    if (legacyKey) return legacyKey;
    // No key at all — bucket by IP, normalized to avoid IPv4-mapped IPv6
    // duplicates.  These requests are immediately redirected in the handlers.
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
      
      // If whitelist enabled but empty, redirect to Google
      if (whitelistCache.entries.length === 0) {
        logWhitelistDenial(clientIp);
        return res.redirect('https://google.com');
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
        return res.redirect('https://google.com');
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
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error(
      "SESSION_SECRET environment variable is not set. " +
      "Set it to a long random string before starting the server."
    );
  }

  // Capture session middleware reference so we can authenticate WebSocket upgrade requests
  const sessionMw = session({
    name: 'ctid', // Obscure the default 'connect.sid' identifier
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
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

  // Authentication middleware — admin sessions only; explicitly rejects client-only sessions
  const requireAuth = (req: any, res: any, next: any) => {
    if (req.session?.userId) {
      next();
    } else if (req.session?.clientUserId) {
      // Client session present but not an admin session — forbidden, not just unauthorized
      res.status(403).json({ message: "Forbidden. Admin access required." });
    } else {
      res.status(401).json({ message: "Unauthorized" });
    }
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
      
      req.session.userId = user.id;
      void auditLog({
        actorId: user.id,
        actorType: "admin",
        action: "admin.login",
        ipAddress: (req.ip || "").replace("::ffff:", ""),
      });
      res.json({ message: "Login successful", user: { id: user.id, username: user.username } });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Logout endpoint
  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Could not log out" });
      }
      res.json({ message: "Logout successful" });
    });
  });

  // Get current user (Admin)
  app.get("/api/auth/user", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId);
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
  
  // Step 1: Client user login with username/password
  app.post("/api/user/login", authLimiter, async (req, res) => {
    try {
      const parse = loginSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ message: "Invalid request", errors: parse.error.flatten().fieldErrors });
      }
      const { username, password } = parse.data;

      // Find client user by username
      const user = await storage.getClientUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Use bcrypt to compare passwords
      const passwordMatch = await bcrypt.compare(password, user.password);
      
      if (!passwordMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if user account is active
      if (user.status !== 'active') {
        return res.status(403).json({ message: `Account is ${user.status}. Please contact support.` });
      }
      
      // Check compliance status before allowing login
      if (user.complianceStatus === 'suspended') {
        return res.status(403).json({ message: "Account suspended due to compliance violation. Please contact support." });
      }

      // Store user ID in session for step 2
      req.session.clientUserId = user.id;

      res.json({
        message: "Login successful. Please verify your API key.",
        userId: user.id,
        username: user.username,
        requiresApiKey: true,
        requiresTos: !user.tosAccepted
      });
    } catch (error) {
      console.error("Client user login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Step 2: Verify API key for client user
  app.post("/api/user/verify-api-key", async (req, res) => {
    try {
      const parse = apiKeySchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ message: "Invalid request", errors: parse.error.flatten().fieldErrors });
      }
      const { apiKey } = parse.data;
      const clientUserId = req.session.clientUserId;

      if (!clientUserId) {
        return res.status(401).json({ message: "Please login first" });
      }
      
      // Find the API key in the system
      const apiKeyRecord = await storage.getApiKeyByValue(apiKey);
      if (!apiKeyRecord) {
        return res.status(401).json({ message: "Invalid API key" });
      }

      // Verify this API key belongs to this user
      const user = await storage.getClientUser(clientUserId);
      if (!user || user.apiKeyId !== apiKeyRecord.id) {
        return res.status(403).json({ message: "API key does not match your account" });
      }

      // Check API key status
      if (apiKeyRecord.status === 'paused') {
        return res.status(403).json({ message: "API key is paused" });
      }
      if (apiKeyRecord.status === 'expired') {
        return res.status(403).json({ message: "API key has expired" });
      }

      // Check if ToS has been accepted — return 200 so the frontend shows the ToS UI
      if (!user.tosAccepted) {
        return res.status(200).json({
          message: "Terms of service must be accepted before using this service.",
          requiresTos: true,
          tosText: "This service is intended for legitimate bot traffic filtering, ad fraud prevention, and website security. You may not use this service to deceive search engines, serve different content to crawlers versus human visitors on the same URL, or facilitate phishing, identity theft, or financial fraud. You are solely responsible for ensuring your use complies with applicable laws and advertising platform terms. We reserve the right to suspend accounts where redirect patterns indicate cloaking, phishing, or other deceptive practices."
        });
      }

      // Check compliance status
      if (user.complianceStatus === 'suspended') {
        return res.status(403).json({ message: "Account suspended due to compliance violation. Please contact support." });
      }

      // Success! Mark user as fully authenticated
      req.session.clientUserAuthenticated = true;

      res.json({
        message: "API key verified successfully",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          status: user.status
        },
        apiKey: {
          name: apiKeyRecord.keyName,
          status: apiKeyRecord.status,
          expirationPeriod: apiKeyRecord.expirationPeriod
        }
      });
    } catch (error) {
      console.error("API key verification error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Middleware for client user auth — explicitly rejects admin-only sessions
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

  const requireClientAuth = (req: any, res: any, next: any) => {
    if (req.session?.clientUserId && req.session?.clientUserAuthenticated) {
      // Reject requests that carry an admin session alongside a client session
      // (defence-in-depth: admin and client namespaces must not bleed together)
      if (req.session?.userId) {
        return res.status(403).json({ message: "Admin sessions may not use client endpoints." });
      }
      next();
    } else {
      res.status(401).json({ message: "Unauthorized. Please login and verify your API key." });
    }
  };

  // ---- Subscription enforcement middleware ----
  // Checks that the authenticated client user has an active trial or paid subscription.
  // Fail-open on transient errors to avoid inadvertently locking out users.
  const requireActiveSubscription = async (req: any, res: any, next: any) => {
    try {
      const user = await storage.getClientUser(req.session.clientUserId);
      if (!user) return res.status(401).json({ message: "User not found" });
      const now = new Date();
      if (
        user.subscriptionStatus === 'active' ||
        // Trialing: allow if no expiry is set yet (existing accounts) or expiry is in the future
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
      await db.execute(sqlTag`SELECT 1`);
      res.json({ status: "ok", uptime: process.uptime(), db: "reachable" });
    } catch {
      res.status(503).json({ status: "error", uptime: process.uptime(), db: "unreachable" });
    }
  });

  // Block client sessions from every admin-only path prefix
  app.use(["/api/interface", "/api/api-keys"], (req: any, res: any, next: any) => {
    if (req.session?.clientUserId) {
      return res.status(403).json({ message: "Forbidden. Client sessions cannot access admin endpoints." });
    }
    next();
  });

  // Get current client user info
  app.get("/api/user/me", requireClientAuth, async (req: any, res) => {
    try {
      const user = await storage.getClientUser(req.session.clientUserId);
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
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Could not log out" });
      }
      res.json({ message: "Logout successful" });
    });
  });

  // Get client user's redirect URLs
  app.get("/api/user/redirect-urls", requireClientAuth, async (req: any, res) => {
    try {
      const userId = req.session.clientUserId;
      const redirectUrls = await storage.getUserRedirectUrls(userId);
      
      res.json(redirectUrls || { 
        humanUrl: "https://example.com/human", 
        botUrl: "https://google.com" 
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
      // Only requires clientUserId — the user has already passed password + API key
      // checks but hasn't accepted ToS yet, so clientUserAuthenticated isn't set.
      const userId = req.session?.clientUserId;
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

      // Complete the session — mark the user as fully authenticated
      req.session.clientUserAuthenticated = true;

      res.json({ message: "Terms of service accepted successfully" });
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

  // Pause/Resume API key (protected)
  app.post("/api/api-keys/:id/pause", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const paused = await storage.pauseApiKey(id);
      
      if (!paused) {
        return res.status(404).json({ message: "API key not found" });
      }

      void auditLog({
        actorId: (req as any).session?.userId,
        actorType: "admin",
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

  // Resume API key (protected)
  app.post("/api/api-keys/:id/resume", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const resumed = await storage.pauseApiKey(id); // pauseApiKey toggles, so it resumes paused keys
      
      if (!resumed) {
        return res.status(404).json({ message: "API key not found" });
      }

      void auditLog({
        actorId: (req as any).session?.userId,
        actorType: "admin",
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

  // Classification endpoint (GET with API key support)
  app.get("/api/classify", classifyLimiter, async (req, res) => {
    // Support both formats: ?api_key=XXX or just the first query param value
    let apiKey = req.query.api_key as string;
    
    // If api_key not provided, check if first query param is the key itself (backward compatibility)
    if (!apiKey) {
      const queryKeys = Object.keys(req.query);
      if (queryKeys.length > 0) {
        apiKey = queryKeys[0];
      }
    }
    
    // REQUIRE API key - no anonymous classification
    // Redirect to Google for white-label security (don't reveal it's an API)
    if (!apiKey) {
      return res.redirect(301, 'https://www.google.com');
    }
    
    let limitReached = false;
    let apiKeyId: string | null = null;
    
    // Validate API key
    const validKey = await storage.getApiKey(apiKey);
    if (!validKey || !validKey.enabled) {
      return res.status(401).json({ 
        error: "Invalid or disabled API key",
        status: "unauthorized"
      });
    }
    
    // Store API key ID for classification tracking
    apiKeyId = validKey.id;
    
    // Check subscription status for the API key owner — expired trials get bot fallback
    const keyOwner = await storage.getClientUserByApiKey(apiKeyId);
    if (keyOwner) {
      const now = new Date();
      const subActive =
        keyOwner.subscriptionStatus === 'active' ||
        (keyOwner.subscriptionStatus === 'trialing' && (!keyOwner.trialEndsAt || keyOwner.trialEndsAt > now));
      if (!subActive) limitReached = true;
    }

    // Check and increment usage count
    const usageAllowed = await storage.incrementApiKeyUsage(apiKey);
    if (!usageAllowed) {
      // Don't return error - classify as Bot instead (forces bot URL redirect)
      limitReached = true;
    }
    
    // Continue with classification logic, passing API key ID
    return handleClassification(req, res, limitReached, apiKeyId);
  });

  // Public classification endpoint (POST) - with API key support for PHP scripts
  app.post("/api/classify", classifyLimiter, async (req, res) => {
    // Check for API key in header (X-API-Key)
    const apiKeyFromHeader = req.headers['x-api-key'] as string;
    
    // REQUIRE API key - no anonymous classification
    // Redirect to Google for white-label security (don't reveal it's an API)
    if (!apiKeyFromHeader) {
      return res.redirect(301, 'https://www.google.com');
    }
    
    let limitReached = false;
    let apiKeyId: string | null = null;
    
    // Validate API key
    const validKey = await storage.getApiKey(apiKeyFromHeader);
    if (!validKey || !validKey.enabled) {
      return res.status(401).json({ 
        error: "Invalid or disabled API key",
        status: "unauthorized"
      });
    }
    
    // Store API key ID for classification tracking and redirect URL lookup
    apiKeyId = validKey.id;

    // Check subscription status for the API key owner — expired trials get bot fallback
    const postKeyOwner = await storage.getClientUserByApiKey(apiKeyId);
    if (postKeyOwner) {
      const now = new Date();
      const subActive =
        postKeyOwner.subscriptionStatus === 'active' ||
        (postKeyOwner.subscriptionStatus === 'trialing' && (!postKeyOwner.trialEndsAt || postKeyOwner.trialEndsAt > now));
      if (!subActive) limitReached = true;
    }
    
    // Check and increment usage count
    const usageAllowed = await storage.incrementApiKeyUsage(apiKeyFromHeader);
    if (!usageAllowed) {
      limitReached = true;
    }
    
    return handleClassification(req, res, limitReached, apiKeyId);
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

  async function handleClassification(req: any, res: any, limitReached: boolean = false, apiKeyId: string | null = null) {
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

      // Use original CleanTraffic API classification system
      // Load API key from storage layer (works with both MemStorage and DatabaseStorage)
      const cleanTrafficApiKey = await storage.getSetting('cleantraffic_api_key');
      
      if (!cleanTrafficApiKey) {
        console.warn("CleanTraffic API key not configured in storage");
        return res.status(500).json({ 
          message: "CleanTraffic API key not configured",
          error: "Missing API key in storage"
        });
      }
      
      console.log("✅ API key loaded from storage");

      // CASCADING CLASSIFICATION LOGIC (FAIL-SECURE)
      // DEFAULT TO BOT - Only allow as Human after passing all security checks
      // Step 1: Basic Security Checks → Step 2: API Call → Step 3: Country/ISP Rules → Step 4: Final Verdict
      
      let classificationData: any = {};
      let visitorType = 'Bot'; // 🔒 FAIL-SECURE: Default to Bot for safety
      let detectionMethod = 'Unknown/Unverified';
      let blockReason = 'Default security policy - verification required';

      // SECURITY CHECK 1: User Agent Validation
      if (!userAgent || userAgent.trim() === '') {
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
        userAgent.toLowerCase().includes('headless')
      )) {
        visitorType = 'Bot';
        detectionMethod = 'Suspicious User Agent';
        blockReason = `Detected bot/scraper user agent: ${userAgent.substring(0, 50)}`;
        console.log(`🚫 BLOCKED (Suspicious UA): ${clientIp} - ${userAgent.substring(0, 50)}`);
      }

      // Call API first to get country and ISP data (only if not already blocked)
      try {
        // Check cache first for faster response
        const cachedData = ip2geoCache.get(clientIp);
        if (cachedData) {
          classificationData = cachedData;
          console.log(`✅ Using cached data for IP: ${clientIp}`);
        } else {
          // Call IP2Geolocation API directly with the API key
          const apiUrl = `https://api.ip2location.io/?key=${encodeURIComponent(cleanTrafficApiKey)}&ip=${encodeURIComponent(clientIp)}`;
          
          console.log(`🔍 Calling IP2Geolocation API for IP: ${clientIp}`);
          
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'User-Agent': userAgent,
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            const geoData = await response.json();
            
            // Convert IP2Geolocation response to our format
            const location = geoData.city_name && geoData.country_name 
              ? `${geoData.city_name}, ${geoData.country_name}`
              : (geoData.country_name || 'Unknown');
            
            const isp = geoData.as || 'Unknown';
            const countryCode = geoData.country_code || '';
            const countryName = geoData.country_name || 'Unknown';
            const cityName = geoData.city_name || 'Unknown';
            const regionName = geoData.region_name || '';
            
            classificationData = {
              ip: clientIp,
              location: location,
              isp: isp,
              country_code: countryCode,
              country_name: countryName,
              city_name: cityName,
              region_name: regionName,
              browser: browser,
              device_type: deviceType,
              usage_type: geoData.usage_type,
              is_proxy: geoData.is_proxy,
              proxy_data: geoData.proxy
            };
            
            // Cache the response for 30 minutes
            ip2geoCache.set(clientIp, classificationData, 30 * 60 * 1000);
            console.log(`📍 API Response: IP=${clientIp}, Country=${countryCode}, ISP=${isp}, UsageType=${geoData.usage_type || 'MISSING'}`);
            
            // CHECK FOR API LIMITATION (Trial/Expired/Unpaid Plan)
            if (!geoData.usage_type) {
              console.warn(`⚠️ API LIMITATION DETECTED: IP2Geo returned no usage_type field for IP ${clientIp}`);
              console.warn(`⚠️ This indicates trial/expired/unpaid API plan - Cannot determine if human or bot`);
              visitorType = 'Bot';
              detectionMethod = 'API Limitation - Cannot Detect (Trial/Expired Plan)';
              classificationData.visitor_type = visitorType;
              classificationData.detection_method = detectionMethod;
              
              // Skip all other classification logic - go straight to saving and redirecting
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
                detectionMethod: detectionMethod,
                apiKeyId: apiKeyId,
              });

              // Broadcast to any connected dashboard clients for this API key
              if (apiKeyId) {
                broadcastClassification(apiKeyId, {
                  id: classification.id ?? randomUUID(),
                  timestamp: classification.timestamp
                    ? new Date(classification.timestamp).toISOString()
                    : new Date().toISOString(),
                  ipAddress: clientIp,
                  visitorType: 'Bot',
                  detectionMethod: detectionMethod,
                  country: classificationData.country_name || 'Unknown',
                  isp: classificationData.isp || 'Unknown',
                  action: 'Blocked',
                });
              }

              const response: any = {
                ip: clientIp,
                location: classification.location || 'Unknown',
                browser: classification.browser || 'Unknown',
                device_type: classification.deviceType || 'Unknown', 
                visitorType: 'Bot',
                isp: classification.isp || 'Unknown'
              };
              
              // Always redirect to bot URL when API is limited
              if (apiKeyId) {
                const user = await storage.getClientUserByApiKey(apiKeyId);
                const redirectUrls = user ? await storage.getUserRedirectUrls(user.id) : undefined;
                const botUrl = redirectUrls?.botUrl || 'https://google.com';
                response.redirectUrl = botUrl;
                console.log(`⚠️ API LIMITED: Redirecting ALL visitors to bot URL - ${botUrl}`);
              }
              
              return res.json(response);
            }
          } else {
            console.error(`IP2Geolocation API error: ${response.status}`);
            classificationData = {
              ip: clientIp,
              location: 'Unknown',
              country_name: 'Unknown',
              isp: 'Unknown',
              country_code: '',
              browser: browser,
              device_type: deviceType
            };
          }
        }

        // NEW PRIORITY-BASED CASCADING CLASSIFICATION LOGIC
        // Priority 1: ISP Blacklist (Immediate Block)
        // Priority 2: Country Whitelist Check (with DCH detection)
        // Priority 3: IP2Location Detection (DCH/Proxy/VPN/TOR)
        // Priority 4: ISP Whitelist Override (Allow trusted ISPs)
        
        const countryCode = classificationData.country_code || '';
        const ispName = classificationData.isp || '';
        const usageType = classificationData.usage_type || '';
        
        // PRIORITY 1: ISP BLACKLIST - Immediate block, no questions asked
        if (ispName && ispName !== 'Unknown') {
          const isBlacklisted = await storage.isIspBlacklisted(ispName);
          if (isBlacklisted) {
            visitorType = 'Bot';
            detectionMethod = 'ISP Blacklisted';
            blockReason = `ISP blacklisted: ${ispName}`;
            console.log(`🚫 BLOCKED (Priority 1 - ISP Blacklist): ${clientIp} - ${ispName}`);
          }
        }

        // PRIORITY 2: COUNTRY WHITELIST (Optional - If exists)
        if (visitorType !== 'Bot' || countryCode) { // Check even if Bot (may promote to Human)
          const countryWhitelist = await storage.getCountryWhitelist();
          const hasCountryWhitelist = countryWhitelist.length > 0;
          
          if (hasCountryWhitelist && countryCode) {
            const isCountryWhitelisted = await storage.isCountryAllowed(countryCode);
            
            if (isCountryWhitelisted) {
              // Country is whitelisted, but still check if it's datacenter
              if (usageType === 'DCH') {
                visitorType = 'Bot';
                detectionMethod = 'Datacenter in Whitelisted Country';
                blockReason = `Datacenter traffic from whitelisted country: ${countryCode}`;
                console.log(`🚫 BLOCKED (Priority 2 - DCH in Whitelisted Country): ${clientIp} - ${countryCode}`);
              } else {
                // Country whitelisted and NOT datacenter = HUMAN ✅
                visitorType = 'Human';
                detectionMethod = 'Country Whitelist';
                blockReason = '';
                console.log(`✅ ALLOWED (Priority 2 - Country Whitelisted): ${clientIp} - ${countryCode}, Usage: ${usageType}`);
              }
            } else {
              // Country NOT in whitelist = BLOCK
              visitorType = 'Bot';
              detectionMethod = 'Country Not Whitelisted';
              blockReason = `Country not whitelisted: ${countryCode}`;
              console.log(`🚫 BLOCKED (Priority 2 - Country Not Whitelisted): ${clientIp} - ${countryCode}`);
            }
          } else if (!hasCountryWhitelist && visitorType !== 'Bot') {
            // No country whitelist configured, allow to continue to next check
            visitorType = 'Human';
            detectionMethod = 'IP Analysis';
          }
        }

        // PRIORITY 3: IP2LOCATION DETECTION (Primary detection - Always active)
        if (visitorType === 'Human') {
          // Datacenter/Hosting detection (DCH only - residential proxies allowed)
          if (usageType === 'DCH') {
            visitorType = 'Bot';
            detectionMethod = 'Datacenter';
            blockReason = `IP2Location detected: Datacenter`;
            console.log(`🚫 BLOCKED (Priority 3 - IP2Location Datacenter): ${clientIp}`);
          }
          
          // Proxy/VPN/TOR detection
          if (classificationData.is_proxy || 
              classificationData.proxy_data?.is_vpn || 
              classificationData.proxy_data?.is_tor || 
              classificationData.proxy_data?.is_data_center || 
              classificationData.proxy_data?.is_web_crawler) {
            visitorType = 'Bot';
            
            // Determine specific detection method
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
            
            blockReason = `IP2Location detected: ${detectionMethod}`;
            console.log(`🚫 BLOCKED (Priority 3 - ${detectionMethod}): ${clientIp}`);
          }
        }

        // PRIORITY 4: ISP WHITELIST OVERRIDE (Optional - Allow trusted ISPs)
        // This can override previous bot detections for trusted ISPs
        if (visitorType === 'Bot' && ispName && ispName !== 'Unknown') {
          const isWhitelisted = await storage.isIspWhitelisted(ispName);
          if (isWhitelisted) {
            visitorType = 'Human';
            detectionMethod = 'ISP Whitelist Override';
            blockReason = `ISP whitelisted (trusted): ${ispName}`;
            console.log(`✅ ALLOWED (Priority 4 - ISP Whitelist Override): ${clientIp} - ${ispName} is trusted`);
          }
        }

        // Final classification with all data
        classificationData.visitor_type = visitorType;
        classificationData.detection_method = detectionMethod;
        
        console.log(`✅ Final Classification: ${clientIp} = ${visitorType} (${detectionMethod})`);
        
      } catch (error) {
        console.error("🚨 CRITICAL: Classification error -  FAIL-SECURE activated:", error);
        // 🔒 FAIL-SECURE: Default to Bot on ANY error for safety
        visitorType = 'Bot';
        detectionMethod = 'Error - API Failure (Fail-Secure)';
        blockReason = 'System error during classification - blocked for safety';
        classificationData = {
          ip: clientIp,
          location: 'Unknown',
          country_name: 'Unknown',
          isp: 'Unknown',
          browser: browser,
          device_type: deviceType,
          visitor_type: visitorType,
          detection_method: detectionMethod
        };
        console.log(`🚫 BLOCKED (Error Fail-Secure): ${clientIp} - API/System error, blocked for safety`);
      }

      // 10-MINUTE SILENT LOGGING: Check if this IP was logged recently
      // First visit logs, subsequent visits within 10 minutes are silent, then logs again after 10 minutes
      const now = Date.now();
      const lastLogTime = ipLastLogTime.get(clientIp);
      const shouldLog = !lastLogTime || (now - lastLogTime > SILENT_LOG_DURATION);
      
      let classification: any;
      
      if (shouldLog) {
        // Log this classification to the database
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
        
        // Broadcast to any connected dashboard clients for this API key
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

        // Update the last log time for this IP
        ipLastLogTime.set(clientIp, now);
        console.log(`📝 Logged classification for ${clientIp}`);
      } else {
        // Silent mode: Skip logging, but construct classification object from data
        const timeSinceLastLog = Math.round((now - lastLogTime) / 1000); // seconds
        console.log(`🔇 Silent mode: ${clientIp} last logged ${timeSinceLastLog}s ago (${Math.round(SILENT_LOG_DURATION / 1000 - timeSinceLastLog)}s until next log)`);
        
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
      
      // Email is captured from URL parameters (line 843) and available for redirect logic
      // but NOT stored in database for privacy (email variable available here if needed)

      const response: any = {
        ip: clientIp,
        location: classification.location || 'Unknown',
        browser: classification.browser || 'Unknown',
        device_type: classification.deviceType || 'Unknown', 
        visitorType: classification.visitorType || 'Human', // PHP expects camelCase
        isp: classification.isp || 'Unknown'
      };
      
      // If API key is provided, add redirect URL for PHP script usage
      if (apiKeyId) {
        try {
          // Get API key details to check status (paused/expired)
          const apiKeyDetails = await storage.getApiKeyById(apiKeyId);
          
          // If API key is paused or expired, redirect ALL visitors to bot URL
          if (apiKeyDetails && (apiKeyDetails.status === 'paused' || apiKeyDetails.status === 'expired')) {
            const user = await storage.getClientUserByApiKey(apiKeyId);
            const redirectUrls = user ? await storage.getUserRedirectUrls(user.id) : undefined;
            const botUrl = redirectUrls?.botUrl || 'https://google.com';
            const redirectVersion = redirectUrls?.updatedAt ? new Date(redirectUrls.updatedAt).getTime() : 0;
            response.redirectUrl = botUrl;
            response.redirectVersion = redirectVersion;
            response.visitorType = 'Bot'; // Force bot classification when paused/expired
            console.log(`⚠️ License ${apiKeyDetails.status.toUpperCase()}: Redirecting all visitors to bot URL`);
          } else {
            // Normal operation - get redirect URLs
            const user = await storage.getClientUserByApiKey(apiKeyId);
            let humanUrl = 'https://example.com/human';
            let botUrl = 'https://google.com';
            let redirectVersion = 0;
            
            if (user) {
              const redirectUrls = await storage.getUserRedirectUrls(user.id);
              humanUrl = redirectUrls?.humanUrl || humanUrl;
              botUrl = redirectUrls?.botUrl || botUrl;
              redirectVersion = redirectUrls?.updatedAt ? new Date(redirectUrls.updatedAt).getTime() : 0;
            } else {
              console.warn(`⚠️ No client user found for API key ID: ${apiKeyId} - using default redirect URLs`);
            }
            
            // Return appropriate redirect URL based on visitor type
            response.redirectUrl = classification.visitorType === 'Human' 
              ? humanUrl 
              : botUrl;
            response.redirectVersion = redirectVersion;
          }
        } catch (error) {
          console.error("Error fetching redirect URLs:", error);
          // ALWAYS provide redirect URLs even if lookup fails (prevents "Configuration error")
          response.redirectUrl = classification.visitorType === 'Human' 
            ? 'https://example.com/human' 
            : 'https://google.com';
          response.redirectVersion = 0;
        }
      }
      
      res.json(response);
    } catch (error) {
      console.error("Classification error:", error);
      res.status(500).json({ 
        message: "Classification failed", 
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
      const apiKey = await storage.getSetting('cleantraffic_api_key');
      
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

  // Update CleanTraffic API key
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
      
      if (trimmedKey.length < 10) {
        return res.status(400).json({
          error: true,
          message: "API key appears to be invalid (too short)"
        });
      }
      
      // Test the API key with IP2Geolocation API
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const testApiUrl = `https://api.ip2location.io/?key=${encodeURIComponent(trimmedKey)}&ip=8.8.8.8`;
        const testResponse = await fetch(testApiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        const testData = await testResponse.json();
        
        console.log('IP2Geolocation API validation:', { status: testResponse.status, data: testData });
        
        // Check if API key is valid - IP2Location returns error field for invalid keys
        if (!testResponse.ok || testData.error || !testData.country_name) {
          console.log('API key validation failed:', testData);
          return res.status(400).json({
            error: true,
            message: testData.error?.message || "Invalid API key - Must be a valid IP2Geolocation API key"
          });
        }
        
        console.log('API key validation successful:', { 
          country: testData.country_name, 
          city: testData.city_name,
          isp: testData.as 
        });
      } catch (validationError: any) {
        if (validationError.name === 'AbortError') {
          return res.status(400).json({
            error: true,
            message: "API key validation timed out - please try again"
          });
        }
        return res.status(400).json({
          error: true,
          message: "Failed to validate API key with CleanTraffic service"
        });
      }
      
      // Save to storage layer (works with both MemStorage and DatabaseStorage)
      await storage.setSetting('cleantraffic_api_key', trimmedKey);
      console.log("API key saved to storage");
      
      // Update both environment variables for immediate effect
      process.env.IP2GEO_API_KEY = trimmedKey;
      process.env.IP2GEOLOCATION_API_KEY = trimmedKey;
      
      // Save to persistent file for consistent access (this is what classification reads first)
      try {
        // Save to PHP package API key file for immediate use
        const keyFile = path.join(process.cwd(), 'cleantraffic-php-package', 'api_key.txt');
        
        // Clear any PHP cache before writing
        if (fs.existsSync(keyFile)) {
          fs.unlinkSync(keyFile); // Remove old file completely
        }
        
        // Write new key with exclusive lock
        fs.writeFileSync(keyFile, trimmedKey, { flag: 'w', mode: 0o644 });
        console.log("API key saved to PHP package file for immediate use");
        
        // Also update .env file for Replit persistence
        const envPath = path.join(process.cwd(), '.env');
        let envContent = '';
        
        try {
          if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
          }
        } catch (readError) {
          console.log("Creating new .env file");
        }
        
        // Update or add the API key in .env format
        const keyPattern = /^IP2GEOLOCATION_API_KEY=.*$/gm;
        const newKeyLine = `IP2GEOLOCATION_API_KEY=${trimmedKey}`;
        
        if (keyPattern.test(envContent)) {
          envContent = envContent.replace(keyPattern, newKeyLine);
        } else {
          envContent = envContent.trim() + '\n' + newKeyLine + '\n';
        }
        
        fs.writeFileSync(envPath, envContent, 'utf8');
        console.log("API key updated in .env file for Replit persistence");
        
      } catch (writeError) {
        console.warn("Could not update persistent files:", writeError);
        // This is not fatal, continue with memory-only storage
      }
      
      // Clear any cached IP data since we have a new API key
      if (typeof ip2geoCache !== 'undefined' && ip2geoCache.clear) {
        ip2geoCache.clear();
        console.log("Cleared IP geolocation cache after API key update");
      }
      
      res.json({
        success: true,
        message: "CleanTraffic API key updated and validated successfully",
        keyPreview: `${trimmedKey.substring(0, 5)}...${trimmedKey.substring(trimmedKey.length - 5)}`
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
        redirectUrls: redirectUrls || { humanUrl: 'https://example.com', botUrl: 'https://google.com' },
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