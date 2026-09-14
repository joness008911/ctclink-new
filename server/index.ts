import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { execSync } from "child_process";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { isValidDatabaseUrl } from "./db";

const app = express();

// Trust reverse proxy for Cloud Run and dev environments (critical for secure cookies & client IP)
app.set("trust proxy", 1);

// Security headers with Helmet - configured to allow iframe preview and inline scripts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      frameAncestors: ["*"],
    },
  },
  frameguard: false,
  referrerPolicy: { policy: 'no-referrer' },
}));

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  next();
});

// Block known scrapers, bots, and preview services (production only)
const blockedUserAgents = [
  'slackbot', 'slack-imgproxy', 'slackbot-linkexpanding',
  'facebookexternalhit', 'facebookcatalog', 'facebot',
  'twitterbot', 'linkedinbot', 'linkedin',
  'whatsapp', 'whatsappbot',
  'telegram', 'telegrambot',
  'discordbot', 'discord',
  'curl', 'wget', 'python-requests', 'python-urllib',
  'postman', 'insomnia', 'httpie',
  'archive.org_bot', 'ia_archiver',
  'pinterest', 'pinterestbot',
  'embedly', 'outbrain', 'quora',
  'applebot', 'bingpreview', 'googlebot', 'baiduspider',
  'yandexbot', 'seznambot', 'bingbot', 'duckduckbot',
];

app.use((req, res, next) => {
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  
  const isApiEndpoint = req.path.startsWith('/api/') || req.path === '/robots.txt';
  
  if (process.env.NODE_ENV === 'production' && !isApiEndpoint) {
    for (const blocked of blockedUserAgents) {
      if (userAgent.includes(blocked)) {
        return res.status(403).send("Forbidden");
      }
    }
  }
  
  next();
});

app.use(express.json({
  // Capture raw body for Stripe webhook signature verification
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Request timeout protection (25s timeout for API requests to mitigate hanging sockets and DoS)
app.use("/api", (req, res, next) => {
  const timeoutMs = 25000;
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      console.warn(`[TIMEOUT_EVENT] API Request timed out: ${req.method} ${req.path}`);
      res.status(504).json({
        message: "The server took too long to respond. Request timed out.",
        code: "GATEWAY_TIMEOUT"
      });
    }
  }, timeoutMs);

  res.on("finish", () => clearTimeout(timer));
  res.on("close", () => clearTimeout(timer));
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        try {
          const sanitized = JSON.parse(JSON.stringify(capturedJsonResponse, (key, value) => {
            if (typeof key === 'string' && /^(keyvalue|apikey|token|password|secret|authorization|idtoken)$/i.test(key)) {
              return typeof value === 'string' ? `${value.substring(0, 4)}••••` : '••••';
            }
            return value;
          }));
          logLine += ` :: ${JSON.stringify(sanitized)}`;
        } catch {
          logLine += ` :: [Response Redacted]`;
        }
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

(async () => {
  try {
    // Run pending database migrations if a valid Postgres database is configured
    if (isValidDatabaseUrl(process.env.DATABASE_URL)) {
      try {
        execSync("npx drizzle-kit migrate", { stdio: "pipe" });
        log("Database migrations applied");
      } catch (err: any) {
        const msg = (err.stderr?.toString() || err.stdout?.toString() || err.message || String(err)).slice(0, 500);
        console.warn("Database migration notice:\n" + msg);
      }
    }

    const server = await registerRoutes(app);
    
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      if (res.headersSent) {
        return _next(err);
      }
      const status = typeof err.status === "number" ? err.status : (typeof err.statusCode === "number" ? err.statusCode : 500);
      
      // Prevent internal error details, database paths, and sensitive stacks from leaking in 500 responses
      const isProduction = process.env.NODE_ENV === "production";
      let message = err.message || "Internal Server Error";
      if (status >= 500 && isProduction) {
        message = "An unexpected internal server error occurred. Please try again later.";
      }

      console.error(`[API_ERROR] ${_req.method} ${_req.path} -> Status ${status}:`, err);
      res.status(status).json({
        message,
        code: err.code || "INTERNAL_ERROR",
      });
    });

    // Setup Vite in development or serve static build in production
    if (process.env.NODE_ENV !== "production") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Bind to port from environment variable (Railway/Render/Cloud Run) or default 3000
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    server.listen({
      port,
      host: "0.0.0.0",
    }, () => {
      log(`serving on port ${port}`);
    });
  } catch (startupError) {
    console.error("🚨 Fatal error during server startup:", startupError);
    process.exit(1);
  }
})();
