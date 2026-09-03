/**
 * High-Performance Bot & Crawler Detection Engine
 * Incorporates the Monperrus Crawler Database, Ultimate Bad Bot signatures,
 * and Datacenter ASN pre-screening tables for zero-latency local classification.
 */

// Monperrus & Curated Crawler User-Agent Patterns (Compiled Regex Array)
const KNOWN_CRAWLER_PATTERNS: Array<{ pattern: RegExp; name: string; category: string }> = [
  // Major Search Engine Crawlers
  { pattern: /googlebot/i, name: "Googlebot", category: "Search Engine Crawler" },
  { pattern: /google-inspectiontool/i, name: "Google Inspection Tool", category: "Search Engine Crawler" },
  { pattern: /mediapartners-google/i, name: "Google Ads/AdSense Bot", category: "Ad Crawler" },
  { pattern: /adsbot-google/i, name: "Google AdsBot", category: "Ad Crawler" },
  { pattern: /bingbot/i, name: "Bingbot", category: "Search Engine Crawler" },
  { pattern: /bingpreview/i, name: "Bing Preview", category: "Search Engine Crawler" },
  { pattern: /adidxbot/i, name: "Bing AdsBot", category: "Ad Crawler" },
  { pattern: /yandex(bot|images|video|media|blogs|favicons|metrika)/i, name: "Yandex Bot", category: "Search Engine Crawler" },
  { pattern: /baiduspider/i, name: "Baidu Spider", category: "Search Engine Crawler" },
  { pattern: /duckduckbot/i, name: "DuckDuckGo Bot", category: "Search Engine Crawler" },
  { pattern: /petalbot/i, name: "Huawei PetalBot", category: "Search Engine Crawler" },
  { pattern: /applebot/i, name: "Applebot", category: "Search Engine Crawler" },
  { pattern: /sogou( spider| web spider| head spider)/i, name: "Sogou Spider", category: "Search Engine Crawler" },
  { pattern: /seznambot/i, name: "SeznamBot", category: "Search Engine Crawler" },
  { pattern: /naverbot|yeti/i, name: "Naver Yeti", category: "Search Engine Crawler" },
  { pattern: /daumoa/i, name: "Daum Bot", category: "Search Engine Crawler" },
  { pattern: /qwantify/i, name: "Qwantify", category: "Search Engine Crawler" },
  { pattern: /slurp/i, name: "Yahoo Slurp", category: "Search Engine Crawler" },
  { pattern: /exabot/i, name: "Exabot", category: "Search Engine Crawler" },
  { pattern: /ia_archiver/i, name: "Alexa / Internet Archive", category: "Archiver" },
  { pattern: /archive\.org_bot/i, name: "Wayback Machine Archive", category: "Archiver" },

  // Social Media & Link Preview Bots
  { pattern: /facebookexternalhit/i, name: "Facebook External Hit", category: "Social Preview Bot" },
  { pattern: /facebot/i, name: "Facebot", category: "Social Preview Bot" },
  { pattern: /twitterbot/i, name: "Twitterbot", category: "Social Preview Bot" },
  { pattern: /linkedinbot/i, name: "LinkedInBot", category: "Social Preview Bot" },
  { pattern: /pinterestbot|pinterest/i, name: "Pinterest Bot", category: "Social Preview Bot" },
  { pattern: /slackbot/i, name: "Slackbot", category: "Social Preview Bot" },
  { pattern: /telegrambot/i, name: "TelegramBot", category: "Social Preview Bot" },
  { pattern: /whatsapp/i, name: "WhatsApp Preview", category: "Social Preview Bot" },
  { pattern: /discordbot/i, name: "Discordbot", category: "Social Preview Bot" },
  { pattern: /redditbot/i, name: "RedditBot", category: "Social Preview Bot" },
  { pattern: /skypeuripreview/i, name: "Skype URI Preview", category: "Social Preview Bot" },
  { pattern: /vkshare/i, name: "VK Share Bot", category: "Social Preview Bot" },
  { pattern: /tumblr/i, name: "Tumblr Bot", category: "Social Preview Bot" },
  { pattern: /bytespider/i, name: "ByteDance / TikTok Spider", category: "Scraper" },

  // Commercial SEO, Content Scrapers & Monitoring Crawlers
  { pattern: /ahrefs(bot|siteaudit)/i, name: "AhrefsBot", category: "SEO Scraper" },
  { pattern: /semrush(bot|audit)/i, name: "SemrushBot", category: "SEO Scraper" },
  { pattern: /mj12bot/i, name: "Majestic-12 Bot", category: "SEO Scraper" },
  { pattern: /dotbot/i, name: "DotBot", category: "SEO Scraper" },
  { pattern: /rogerbot/i, name: "Moz Rogerbot", category: "SEO Scraper" },
  { pattern: /screaming frog/i, name: "Screaming Frog SEO Spider", category: "SEO Scraper" },
  { pattern: /blexbot/i, name: "BLEXBot", category: "SEO Scraper" },
  { pattern: /dataforseo/i, name: "DataForSeoBot", category: "SEO Scraper" },
  { pattern: /serpstatbot/i, name: "SerpstatBot", category: "SEO Scraper" },
  { pattern: /spyfu/i, name: "SpyFu Bot", category: "SEO Scraper" },
  { pattern: /zoominfobot/i, name: "Zoominfo Bot", category: "Data Scraper" },
  { pattern: /amazonbot/i, name: "Amazon Crawler", category: "Commercial Bot" },
  { pattern: /uptimerobot/i, name: "UptimeRobot", category: "Uptime Monitor" },
  { pattern: /pingdom/i, name: "Pingdom Monitor", category: "Uptime Monitor" },
  { pattern: /statuscake/i, name: "StatusCake Monitor", category: "Uptime Monitor" },
  { pattern: /site24x7/i, name: "Site24x7", category: "Uptime Monitor" },
  { pattern: /datadog/i, name: "Datadog Synthetics", category: "Monitoring Bot" },
  { pattern: /newrelicpinger/i, name: "New Relic Pinger", category: "Monitoring Bot" },
  { pattern: /admantx/i, name: "ADmantX Ad Verifier", category: "Ad Verifier" },
  { pattern: /integralads|ias-/i, name: "Integral Ad Science (IAS)", category: "Ad Verifier" },
  { pattern: /doubleverify/i, name: "DoubleVerify Bot", category: "Ad Verifier" },
  { pattern: /moatbot/i, name: "Oracle Moat Ad Bot", category: "Ad Verifier" },
  { pattern: /brandverity/i, name: "BrandVerity Ad Inspector", category: "Ad Verifier" },

  // Malicious Security Scanners & Vulnerability Probes (Ultimate Bad Bot list)
  { pattern: /censysinspect/i, name: "Censys Scanner", category: "Security Scanner" },
  { pattern: /shodan/i, name: "Shodan Scanner", category: "Security Scanner" },
  { pattern: /zoomeye/i, name: "ZoomEye Scanner", category: "Security Scanner" },
  { pattern: /masscan/i, name: "Masscan Port Scanner", category: "Security Scanner" },
  { pattern: /zgrab/i, name: "Zgrab Banner Grabber", category: "Security Scanner" },
  { pattern: /nmap/i, name: "Nmap Scripting Engine", category: "Security Scanner" },
  { pattern: /sqlmap/i, name: "SQLmap Injection Tool", category: "Exploit Tool" },
  { pattern: /nikto/i, name: "Nikto Vulnerability Scanner", category: "Security Scanner" },
  { pattern: /wpscan/i, name: "WPScan WordPress Scanner", category: "Security Scanner" },
  { pattern: /nuclei/i, name: "Nuclei Vulnerability Scanner", category: "Security Scanner" },
  { pattern: /gobuster|dirbuster|ffuf|feroxbuster/i, name: "Directory Bruteforcer", category: "Security Scanner" },
  { pattern: /acunetix|nessus|openvas|qualys/i, name: "Commercial Security Scanner", category: "Security Scanner" },
  { pattern: /netcraft/i, name: "Netcraft Survey Agent", category: "Security Scanner" },

  // Headless Browsers, Automated Emulators & WebDrivers
  { pattern: /headlesschrome/i, name: "Headless Chrome", category: "Headless Browser" },
  { pattern: /phantomjs/i, name: "PhantomJS", category: "Headless Browser" },
  { pattern: /selenium/i, name: "Selenium WebDriver", category: "Automation Engine" },
  { pattern: /puppeteer/i, name: "Puppeteer / Chromium Automation", category: "Automation Engine" },
  { pattern: /playwright/i, name: "Playwright Automation", category: "Automation Engine" },
  { pattern: /webdriver/i, name: "Generic WebDriver", category: "Automation Engine" },
  { pattern: /htmlunit/i, name: "HtmlUnit Java Browser", category: "Automation Engine" },
  { pattern: /nightmare/i, name: "Nightmare JS", category: "Automation Engine" },

  // Automated Scripting Libraries & CLI Tools
  { pattern: /^curl\//i, name: "cURL CLI", category: "HTTP Library" },
  { pattern: /^wget\//i, name: "Wget CLI", category: "HTTP Library" },
  { pattern: /python-requests|python-urllib|httpx|aiohttp|scrapy/i, name: "Python HTTP Client / Scrapy", category: "HTTP Library" },
  { pattern: /go-http-client/i, name: "Go HTTP Client", category: "HTTP Library" },
  { pattern: /apache-httpclient|jakarta commons-httpclient|java\//i, name: "Java HTTP Client", category: "HTTP Library" },
  { pattern: /okhttp/i, name: "OkHttp Library", category: "HTTP Library" },
  { pattern: /node-fetch|axios|undici|got\/|needle\//i, name: "Node.js HTTP Client", category: "HTTP Library" },
  { pattern: /libwww-perl|lwp-trivial/i, name: "Perl LWP", category: "HTTP Library" },
  { pattern: /guzzlehttp|php\/[0-9]/i, name: "PHP Guzzle / HTTP Client", category: "HTTP Library" },
  { pattern: /ruby|faraday/i, name: "Ruby HTTP Library", category: "HTTP Library" },
  { pattern: /winhttp|msie (4|5|6)\.0/i, name: "WinHTTP / Legacy Emulation", category: "HTTP Library" },
];

// Major Cloud & Datacenter ASN / Provider Names
const DATACENTER_ISP_PATTERNS: Array<{ pattern: RegExp; provider: string }> = [
  { pattern: /amazon|aws|amazon\.com|amazon technologies|amazon data services/i, provider: "Amazon Web Services (AWS)" },
  { pattern: /google cloud|google llc|google hosting|gcp/i, provider: "Google Cloud Platform" },
  { pattern: /microsoft corporation|azure|msft/i, provider: "Microsoft Azure" },
  { pattern: /digitalocean/i, provider: "DigitalOcean" },
  { pattern: /hetzner/i, provider: "Hetzner Online" },
  { pattern: /ovh|ovhcloud|kimsufi|soyoustart/i, provider: "OVHcloud" },
  { pattern: /linode|akamai connected cloud/i, provider: "Linode / Akamai" },
  { pattern: /choopa|vultr|the constant company/i, provider: "Vultr / Choopa" },
  { pattern: /leaseweb/i, provider: "Leaseweb" },
  { pattern: /contabo/i, provider: "Contabo Hosting" },
  { pattern: /oracle cloud|oracle america/i, provider: "Oracle Cloud" },
  { pattern: /alibaba|aliyun/i, provider: "Alibaba Cloud" },
  { pattern: /tencent cloud|tencent building/i, provider: "Tencent Cloud" },
  { pattern: /rackspace/i, provider: "Rackspace Hosting" },
  { pattern: /scaleway|online sas/i, provider: "Scaleway" },
  { pattern: /hostinger/i, provider: "Hostinger Datacenter" },
  { pattern: /ionos|1&1 internet/i, provider: "IONOS / 1&1 Hosting" },
  { pattern: /m247/i, provider: "M247 Datacenter" },
  { pattern: /cogent communications/i, provider: "Cogent Datacenter Transit" },
  { pattern: /hostwinds/i, provider: "Hostwinds" },
];

/**
 * Checks whether a User-Agent matches known search engine crawlers, SEO tools,
 * security scanners, or automated headless browsers.
 */
export function checkCrawlerUserAgent(userAgent: string | undefined | null): {
  isBot: boolean;
  name?: string;
  category?: string;
  patternMatched?: string;
} {
  if (!userAgent || userAgent.trim() === "") {
    return {
      isBot: true,
      name: "Empty User Agent",
      category: "Automated Tool",
      patternMatched: "Missing User-Agent Header",
    };
  }

  const cleanUA = userAgent.trim();

  for (const item of KNOWN_CRAWLER_PATTERNS) {
    if (item.pattern.test(cleanUA)) {
      return {
        isBot: true,
        name: item.name,
        category: item.category,
        patternMatched: item.pattern.toString(),
      };
    }
  }

  // Generic keyword match catch-all
  const lower = cleanUA.toLowerCase();
  if (
    lower.includes("bot") ||
    lower.includes("crawler") ||
    lower.includes("spider") ||
    lower.includes("scraper") ||
    lower.includes("archiver") ||
    lower.includes("checker") ||
    lower.includes("preview") ||
    lower.includes("inspection")
  ) {
    return {
      isBot: true,
      name: "Generic Bot / Crawler Signature",
      category: "Automated Robot",
      patternMatched: "Generic Bot Keyword",
    };
  }

  return { isBot: false };
}

/**
 * Checks whether an ISP or ASN organization belongs to a commercial datacenter or cloud server provider.
 */
export function checkDatacenterIsp(ispOrOrg: string | undefined | null): {
  isDatacenter: boolean;
  provider?: string;
} {
  if (!ispOrOrg || ispOrOrg === "Unknown") {
    return { isDatacenter: false };
  }

  const clean = ispOrOrg.trim();

  for (const item of DATACENTER_ISP_PATTERNS) {
    if (item.pattern.test(clean)) {
      return {
        isDatacenter: true,
        provider: item.provider,
      };
    }
  }

  return { isDatacenter: false };
}

/**
 * Fast header consistency check for automated headless HTTP clients.
 */
export function checkHeaderAnomalies(headers: Record<string, any>, userAgent: string): {
  isSuspicious: boolean;
  reason?: string;
} {
  if (!userAgent) return { isSuspicious: true, reason: "Missing User-Agent" };

  const accept = headers["accept"] || "";
  const acceptLanguage = headers["accept-language"] || "";

  // CLI tools like curl / python / scripts typically omit accept-language completely
  // If user-agent claims to be a modern desktop Chrome/Safari/Firefox but provides zero Accept-Language or generic */*
  const isClaimingModernBrowser =
    userAgent.includes("Mozilla/5.0") &&
    (userAgent.includes("Chrome/") || userAgent.includes("Safari/") || userAgent.includes("Firefox/"));

  if (isClaimingModernBrowser && !acceptLanguage && (!accept || accept === "*/*")) {
    return {
      isSuspicious: true,
      reason: "Synthetic Browser Profile (Missing Accept-Language and Standard Headers)",
    };
  }

  return { isSuspicious: false };
}

/**
 * High-performance in-memory request velocity tracker to intercept automated
 * scrapers and headless bots executing on clean residential/office IPs.
 */
interface VelocityRecord {
  timestamps: number[];
  lastSeen: number;
}

const velocityMap = new Map<string, VelocityRecord>();
const VELOCITY_BURST_LIMIT = 8; // Max requests within 2 seconds
const VELOCITY_BURST_WINDOW_MS = 2000;
const VELOCITY_RATE_LIMIT = 30; // Max requests within 15 seconds
const VELOCITY_RATE_WINDOW_MS = 15000;

export function checkRequestVelocity(clientIp: string): {
  isVelocityExceeded: boolean;
  reqCount?: number;
  reason?: string;
} {
  if (!clientIp || clientIp === "unknown" || clientIp === "127.0.0.1" || clientIp === "::1") {
    return { isVelocityExceeded: false };
  }

  const now = Date.now();
  let record = velocityMap.get(clientIp);
  if (!record) {
    record = { timestamps: [now], lastSeen: now };
    velocityMap.set(clientIp, record);
    return { isVelocityExceeded: false };
  }

  // Filter timestamps within the rate window
  record.timestamps = record.timestamps.filter((t) => now - t < VELOCITY_RATE_WINDOW_MS);
  record.timestamps.push(now);
  record.lastSeen = now;

  // Check rapid 2-second burst limit
  const recentBurstCount = record.timestamps.filter((t) => now - t < VELOCITY_BURST_WINDOW_MS).length;
  if (recentBurstCount > VELOCITY_BURST_LIMIT) {
    return {
      isVelocityExceeded: true,
      reqCount: recentBurstCount,
      reason: `Rapid-fire automated click velocity (${recentBurstCount} req / 2s)`,
    };
  }

  // Check 15-second frequency rate limit
  if (record.timestamps.length > VELOCITY_RATE_LIMIT) {
    return {
      isVelocityExceeded: true,
      reqCount: record.timestamps.length,
      reason: `High-frequency scraping velocity (${record.timestamps.length} req / 15s)`,
    };
  }

  // Periodic pruning if map grows large (> 5000 entries)
  if (velocityMap.size > 5000) {
    const cutoff = now - VELOCITY_RATE_WINDOW_MS;
    for (const [ip, rec] of velocityMap.entries()) {
      if (rec.lastSeen < cutoff) {
        velocityMap.delete(ip);
      }
    }
  }

  return { isVelocityExceeded: false };
}
