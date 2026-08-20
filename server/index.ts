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
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
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
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Setup Vite in development or serve static build in production
  if (process.env.NODE_ENV !== "production") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Bind to port 3000 (standard ingress port) and host 0.0.0.0
  const port = 3000;
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });
})();
