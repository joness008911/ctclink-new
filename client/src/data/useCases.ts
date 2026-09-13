import {
  Settings,
  Network,
  ShieldAlert,
  Ghost,
  Bot,
  MapPin,
  Lock,
  LineChart,
  Cpu,
  Layers,
  Zap,
  CheckCircle2,
  LucideIcon,
  Sparkles,
} from "lucide-react";

export interface UseCaseData {
  slug: string;
  title: string;
  shortDesc: string;
  tagline: string;
  icon: LucideIcon;
  badge: string;
  overview: string;
  whyItMatters: {
    headline: string;
    points: { title: string; desc: string }[];
  };
  howCleanTrafficProtects: {
    headline: string;
    capabilities: { title: string; desc: string }[];
  };
  technicalEnforcement: {
    ruleType: string;
    latency: string;
    detectionLayer: string;
    defaultMitigation: string;
  };
  realWorldImpact: {
    stat: string;
    statLabel: string;
    summary: string;
  };
}

export const USE_CASES: UseCaseData[] = [
  {
    slug: "ai-agents",
    title: "Autonomous AI Agents",
    shortDesc:
      "Verify authorized autonomous agents, enforce granular endpoint policies, and isolate stealth scrapers impersonating AI assistants.",
    tagline: "Govern autonomous agentic traffic with sub-millisecond cryptographic attestation and zero-trust route policies.",
    icon: Sparkles,
    badge: "Autonomous Agent Governance",
    overview:
      "As autonomous AI agents, enterprise assistants, and synthetic operators increasingly navigate web applications, security teams need fine-grained control over automated access. CleanTraffic evaluates cryptographic provider signatures, validates ASN origin ranges, and analyzes runtime browser characteristics at the edge. Legitimate AI agents receive controlled, policy-governed access to authorized endpoints while impersonators, residential proxy scrapers, and credential-stuffing bots are deflected before touching application servers.",
    whyItMatters: {
      headline: "The operational and security challenges of unmanaged autonomous agent traffic",
      points: [
        {
          title: "Spoofed User-Agent Signatures & Identity Forgery",
          desc: "Malicious scrapers frequently disguise headless browsers under legitimate AI agent headers to bypass standard bot heuristics and harvest proprietary catalog data.",
        },
        {
          title: "Uncontrolled Infrastructure Load & SSR Costs",
          desc: "Unrestricted autonomous agents crawling complex single-page apps cause severe server-side rendering bottlenecks, database load, and compute budget exhaustion.",
        },
        {
          title: "False Positives Disrupting Valuable AI Discovery",
          desc: "Blanket bot blocking breaks authorized shopping assistants, search citation crawlers, and partner agents that drive direct user transactions and discovery.",
        },
      ],
    },
    howCleanTrafficProtects: {
      headline: "Edge-computed cryptographic attestation, route scoping, and behavioral analysis",
      capabilities: [
        {
          title: "Cryptographic Provider Verification (JWS & Mutual TLS)",
          desc: "Validates signed cryptographic tokens and authoritative public key registries for major autonomous operators—including OpenAI, Anthropic, and Google—confirming authenticity before granting access.",
        },
        {
          title: "Granular Endpoint Scoping & Route Policies",
          desc: "Restrict autonomous agents to public APIs, documentation, and product catalog routes while strictly shielding authentication portals, user settings, and payment gateways.",
        },
        {
          title: "Heuristic Decoupling of Stealth Automation",
          desc: "Inspects runtime browser engine primitives, canvas fingerprint entropy, and residential proxy hops to instantly isolate automated scrapers masquerading as AI assistants.",
        },
      ],
    },
    technicalEnforcement: {
      ruleType: "Cryptographic JWS Verification & Layer 3 Browser Integrity Analysis",
      latency: "< 0.45ms edge evaluation",
      detectionLayer: "Layer 4: Application Protocol & Layer 3: Browser Runtime",
      defaultMitigation: "Enforce policy route scope or deflect unverified traffic to 404",
    },
    realWorldImpact: {
      stat: "0",
      statLabel: "False Positives on Verified Agents",
      summary:
        "Security teams maintain complete control over machine-to-machine interactions, allowing certified agents to discover content seamlessly while eliminating unauthorized scraping and agent spoofing.",
    },
  },
  {
    slug: "automation-tools",
    title: "Automation Tools",
    shortDesc:
      "Detect and block automated browsers, scraping tools, and script runners before they interact with your apps.",
    tagline: "Stop automated headless frameworks and scrapers in sub-milliseconds.",
    icon: Settings,
    badge: "Headless & Framework Defense",
    overview:
      "Modern scrapers and automated tools deploy headless browser environments like Puppeteer, Playwright, Selenium, and curl scripts to harvest content, test stolen cards, or inflate impressions. CleanTraffic identifies the telltale signatures of automated browser engines without requiring cumbersome CAPTCHAs.",
    whyItMatters: {
      headline: "The real cost of automated tooling on your business",
      points: [
        {
          title: "Skewed Analytics & Attribution",
          desc: "Automated test scripts and spiders trigger ad pixels and visit events, distorting your conversion funnels and ROAS data.",
        },
        {
          title: "Competitor Price & Content Scraping",
          desc: "Automated scripts systematically strip inventory, pricing matrices, and proprietary content before your team can react.",
        },
        {
          title: "Wasted Backend Capacity",
          desc: "Headless scrapers generate hundreds of concurrent requests, overloading your database queries and spiking server bills.",
        },
      ],
    },
    howCleanTrafficProtects: {
      headline: "Multi-layered detection for automated frameworks",
      capabilities: [
        {
          title: "WebDriver & Stealth Signature Probing",
          desc: "Flags automation traces in `navigator.webdriver`, missing window plugins, and synthetic user agent fingerprints.",
        },
        {
          title: "HTTP Client Hints Verification",
          desc: "Compares declared browser platform against genuine TLS handshakes, Sec-CH-UA client hints, and header ordering.",
        },
        {
          title: "Deterministic 404 / 403 Redirection",
          desc: "Silently routes bots away to a lightweight 404 handler or custom fallback URL, preserving bandwidth for real buyers.",
        },
      ],
    },
    technicalEnforcement: {
      ruleType: "Deterministic Header & Signature Filtering",
      latency: "< 0.8ms",
      detectionLayer: "Layer 3: Browser Integrity & Layer 2: HTTP Anomalies",
      defaultMitigation: "Drop to 404 or serve decoy page",
    },
    realWorldImpact: {
      stat: "99.4%",
      statLabel: "Automated Framework Deflection",
      summary:
        "E-commerce brands and media buyers eliminate scraper-induced server latency and fake conversion events on Day 1.",
    },
  },
  {
    slug: "botnets",
    title: "Botnets",
    shortDesc:
      "Identify coordinated networks of compromised devices and residential proxy pools before they launch attacks.",
    tagline: "Dismantle distributed attacks and rotating residential botnets.",
    icon: Network,
    badge: "Distributed Network Protection",
    overview:
      "Attackers lease millions of compromised home routers and mobile devices via residential proxy pools to orchestrate distributed credential stuffing, inventory hoarding, and click flooding. CleanTraffic uncovers coordinated IP clusters and ASN patterns in real time.",
    whyItMatters: {
      headline: "Why simple IP rate limits fail against distributed botnets",
      points: [
        {
          title: "Distributed IP Spreading",
          desc: "A botnet can send 100,000 hits where no single IP sends more than 2 requests, easily evading naive per-IP rate limits.",
        },
        {
          title: "Residential Carrier Disguise",
          desc: "Compromised residential nodes look like everyday Comcast or AT&T connections unless evaluated against global telemetry.",
        },
        {
          title: "Infrastructure Outages",
          desc: "Coordinated surges during product launches or ad campaigns exhaust connection pools and choke database threads.",
        },
      ],
    },
    howCleanTrafficProtects: {
      headline: "Cluster intelligence & threat scoring",
      capabilities: [
        {
          title: "Global Threat Correlation",
          desc: "Cross-checks inbound requests against IP2Proxy threat scores, known botnet zombie lists, and abuse registries.",
        },
        {
          title: "Burst Velocity Tracking",
          desc: "Tracks micro-burst request velocity across ASN subnets, dropping coordinated packet waves at the edge.",
        },
        {
          title: "Autonomous Edge Mitigation",
          desc: "PHP SDK drops botnet traffic before application boot, protecting PHP worker processes from resource exhaustion.",
        },
      ],
    },
    technicalEnforcement: {
      ruleType: "ASN Clustering & IP2Proxy Threat Feed",
      latency: "< 0.7ms",
      detectionLayer: "Layer 1: Network Intelligence & Layer 5: Threat Feeds",
      defaultMitigation: "Instant connection termination (HTTP 403)",
    },
    realWorldImpact: {
      stat: "85%",
      statLabel: "Drop in Peak Server Concurrency",
      summary:
        "High-volume landing pages maintain rock-solid uptime during synchronized botnet spikes without scaling up server costs.",
    },
  },
  {
    slug: "fraud-prevention",
    title: "Fraud Prevention",
    shortDesc:
      "Stop invalid clicks, fake leads, and payment abuse that drain ad budgets and compromise checkout funnels.",
    tagline: "Protect your ad spend, lead pipelines, and revenue funnels.",
    icon: ShieldAlert,
    badge: "Ad & Revenue Protection",
    overview:
      "Click fraud and fraudulent form submissions rob media buyers of their budget while polluting CRM pipelines with junk data. CleanTraffic operates as an unyielding filter between your ad traffic and your conversion endpoints, guaranteeing only legitimate buyers click and convert.",
    whyItMatters: {
      headline: "The compounding damage of ad fraud & junk conversions",
      points: [
        {
          title: "Drained Google & Meta Budgets",
          desc: "Click farms and rival bots repeatedly click high-CPC search ads, exhausting your daily budget before genuine buyers search.",
        },
        {
          title: "Polluted Sales Rep Workflows",
          desc: "Bogus form fills waste countless sales hours and trigger spam traps that harm your domain's email deliverability.",
        },
        {
          title: "Chargeback & Processing Penalties",
          desc: "Card testing bots test compromised cards against your payment processor, risking merchant account suspension.",
        },
      ],
    },
    howCleanTrafficProtects: {
      headline: "Strict click filtering & conversion safeguarding",
      capabilities: [
        {
          title: "Preserved Attribution & UTMs",
          desc: "Verified human traffic is smoothly forwarded with all tracking parameters, Google Click IDs, and UTM strings intact.",
        },
        {
          title: "Fraud Score Scoring Engine",
          desc: "Evaluates multi-vector fraud indicators, from high-risk ASN ownership to suspicious device signature combinations.",
        },
        {
          title: "Custom Decoy Routing",
          desc: "Serve safe, decoy marketing content to click bots so competitors never realize their click script has been neutralized.",
        },
      ],
    },
    technicalEnforcement: {
      ruleType: "Fraud Scoring & Conversion Shielding",
      latency: "< 1.0ms",
      detectionLayer: "Multi-Tier Edge Evaluation",
      defaultMitigation: "Redirect to decoy safe page",
    },
    realWorldImpact: {
      stat: "34%",
      statLabel: "Average Saved Ad Budget",
      summary:
        "Performance marketers see immediate increases in ROAS by eliminating fraudulent clicks before ad networks bill them.",
    },
  },
  {
    slug: "vpns-and-proxies",
    title: "VPNs & Proxies",
    shortDesc:
      "Detect and control visitors masking their location or network identity through commercial or residential proxies.",
    tagline: "Distinguish privacy-conscious customers from bad actors.",
    icon: Ghost,
    badge: "Anonymizer & Proxy Classification",
    overview:
      "Not all proxies are malicious; some visitors use Apple iCloud Private Relay or mobile carrier data compression, while attackers abuse Tor and rotating residential tunnels. CleanTraffic's granular classification cleanly distinguishes legitimate privacy users from high-risk proxy farms.",
    whyItMatters: {
      headline: "Why all-or-nothing proxy blocking hurts your revenue",
      points: [
        {
          title: "Accidental Human Churn",
          desc: "Blocking all VPNs accidentally blocks millions of iOS users browsing through Apple iCloud Private Relay.",
        },
        {
          title: "Geo-Compliance Violations",
          desc: "Regulated products must ensure users reside in authorized jurisdictions, which proxy masking can violate.",
        },
        {
          title: "Account Takeover Masking",
          desc: "Attackers hop between rotating proxies to hide their geographic distance during brute-force login attempts.",
        },
      ],
    },
    howCleanTrafficProtects: {
      headline: "Multi-class proxy & tunnel intelligence",
      capabilities: [
        {
          title: "Safe Privacy Relay Allowance",
          desc: "Recognizes legitimate consumer privacy relays (Apple, Google One) and routes them through without disruption.",
        },
        {
          title: "Commercial Proxy & Tor Blocking",
          desc: "Instant detection of Tor exit nodes, public open proxies, and commercial anonymizer IP ranges.",
        },
        {
          title: "Configurable Policy Per Campaign",
          desc: "Choose whether to allow, challenge, or deflect VPN visitors on a per-domain or per-link basis.",
        },
      ],
    },
    technicalEnforcement: {
      ruleType: "Multi-Vector Safe VPN Classifier",
      latency: "< 0.6ms",
      detectionLayer: "Layer 1: Network Intelligence & IP2Proxy Type Parsing",
      defaultMitigation: "Configurable (Allow Safe, Block Tor/Commercial)",
    },
    realWorldImpact: {
      stat: "99.8%",
      statLabel: "Classification Precision",
      summary:
        "SaaS and e-commerce stores protect compliance boundaries without losing paying customers who use standard mobile privacy features.",
    },
  },
  {
    slug: "ai-and-web-crawlers",
    title: "AI & Web Crawlers",
    shortDesc:
      "Take back control over autonomous LLM bots, competitive intelligence scrapers, and aggressive search indexers.",
    tagline: "Govern autonomous AI spiders and intellectual property harvesters.",
    icon: Bot,
    badge: "AI & Crawler Governance",
    overview:
      "AI model developers and automated crawlers constantly scan public websites to scrape copyrighted data, training materials, and market pricing. CleanTraffic gives you fine-grained policy control to welcome beneficial search engines while blocking aggressive AI training crawlers.",
    whyItMatters: {
      headline: "Protecting your content, pricing, and infrastructure",
      points: [
        {
          title: "Uncontrolled Content Scraping",
          desc: "Autonomous bots scrape your articles, product catalogs, and databases without attribution or compensation.",
        },
        {
          title: "Ignoring `robots.txt`",
          desc: "Aggressive third-party scrapers frequently ignore standard disallow rules and crawl at full speed.",
        },
        {
          title: "Server Bandwidth Exhaustion",
          desc: "AI crawlers hit thousands of deep URLs simultaneously, pushing hosting bills to unnecessary highs.",
        },
      ],
    },
    howCleanTrafficProtects: {
      headline: "Targeted bot categorization & rate enforcement",
      capabilities: [
        {
          title: "Curated AI Crawler Registry",
          desc: "Pre-indexed signatures for GPTBot, ClaudeBot, PerplexityBot, CCBot, ByteSpider, and 100+ crawler agents.",
        },
        {
          title: "Verified Search Engine Whitelist",
          desc: "Authenticates legitimate Googlebot and Bingbot crawls using reverse-DNS lookups to prevent impersonators.",
        },
        {
          title: "Selective Access Policies",
          desc: "Allow search engine indexation while shielding your private pricing and inventory from competitive AI harvesters.",
        },
      ],
    },
    technicalEnforcement: {
      ruleType: "Monperrus Crawler Signature Engine & Reverse DNS",
      latency: "< 0.5ms",
      detectionLayer: "Layer 1 & 2: Known Crawlers & User-Agent Verification",
      defaultMitigation: "Drop request or serve HTTP 403 Forbidden",
    },
    realWorldImpact: {
      stat: "100%",
      statLabel: "Control Over AI Training Scrapes",
      summary:
        "Media publishers and SaaS platforms block unauthorized LLM scrapers while maintaining perfect SEO scores.",
    },
  },
  {
    slug: "ip-intelligence",
    title: "IP Intelligence",
    shortDesc:
      "Make precise routing decisions backed by real-time geolocation, ASN reputation, hosting flags, and connection types.",
    tagline: "Rich network metadata to drive automated routing decisions.",
    icon: MapPin,
    badge: "Deep Network Profiling",
    overview:
      "CleanTraffic enriches every visitor request with deep network telemetry—including accurate country, region, city, ISP name, ASN routing data, and hosting facility tags—enabling instantaneous geo-targeting and security policies.",
    whyItMatters: {
      headline: "Smarter traffic routing begins with network context",
      points: [
        {
          title: "Localized Landing Experiences",
          desc: "Route visitors to region-specific storefronts, currencies, and languages with zero client-side latency.",
        },
        {
          title: "Restricted Territory Enforcement",
          desc: "Block incoming traffic from embargoed nations or regions where your license or offer cannot legally operate.",
        },
        {
          title: "Cloud Datacenter Isolation",
          desc: "Isolate traffic originating from AWS, Hetzner, or DigitalOcean that should never be browsing consumer offers.",
        },
      ],
    },
    howCleanTrafficProtects: {
      headline: "High-speed in-memory IP enrichment",
      capabilities: [
        {
          title: "Sub-Millisecond In-Memory Lookup",
          desc: "Dual-tier cache ensures IP reputation and ASN metadata resolve with virtually zero overhead.",
        },
        {
          title: "Granular Country Allow / Block Lists",
          desc: "Easily configure allowed countries; any traffic outside the permitted list is automatically diverted.",
        },
        {
          title: "Connection Type Segmentation",
          desc: "Differentiate cable, fiber, and mobile cellular connections from commercial hosting facilities.",
        },
      ],
    },
    technicalEnforcement: {
      ruleType: "IP2Location & Geo-Fence Table Lookup",
      latency: "< 0.4ms",
      detectionLayer: "Layer 1: Network Intelligence",
      defaultMitigation: "Country-specific fallback or redirect",
    },
    realWorldImpact: {
      stat: "99.9%",
      statLabel: "Geolocation Accuracy",
      summary:
        "Affiliate teams and international businesses route traffic to appropriate localized landers with pinpoint reliability.",
    },
  },
  {
    slug: "cybersecurity",
    title: "Cybersecurity",
    shortDesc:
      "Stop web application attacks, vulnerability scanners, and automated exploits right at the edge.",
    tagline: "A resilient first line of defense before your application code.",
    icon: Lock,
    badge: "Edge Security Hardening",
    overview:
      "Automated vulnerability scanners probe web servers every second looking for unpatched WordPress plugins, exposed `.env` files, and open admin interfaces. CleanTraffic acts as an edge perimeter shield, extinguishing scan attempts before they touch your backend.",
    whyItMatters: {
      headline: "Stopping attacks before vulnerability exploitation",
      points: [
        {
          title: "Zero-Day & Automated Scanners",
          desc: "Mass scanners like Shodan, Nuclei, and Masscan indiscriminately poke internet-facing ports searching for flaws.",
        },
        {
          title: "Exposed Secrets & Sensitive Files",
          desc: "Bots cycle through common paths searching for configuration backups, database dumps, and credentials.",
        },
        {
          title: "Brute Force Infiltration",
          desc: "High-frequency password guessing on login and API endpoints creates vulnerability and degrades database throughput.",
        },
      ],
    },
    howCleanTrafficProtects: {
      headline: "Proactive perimeter mitigation",
      capabilities: [
        {
          title: "Pre-Flight Request Sanitization",
          desc: "PHP integration inspects incoming path, query parameters, and header structures before application execution.",
        },
        {
          title: "Automated Blacklisting",
          desc: "Malicious scanners triggering threat triggers are automatically blacklisted from the host environment.",
        },
        {
          title: "Zero Server Resource Footprint",
          desc: "Blocked requests terminate instantly without initializing database connections, ORM layers, or heavyweight frameworks.",
        },
      ],
    },
    technicalEnforcement: {
      ruleType: "Anomaly & Scanner Heuristic Filter",
      latency: "< 0.6ms",
      detectionLayer: "Layer 2: HTTP Request Analysis & Layer 5: Threat Feeds",
      defaultMitigation: "Immediate HTTP 403 / IP Blacklist",
    },
    realWorldImpact: {
      stat: "100%",
      statLabel: "Threat Deflection at Edge",
      summary:
        "Security teams eliminate 95%+ of probe noise from web server logs, keeping application monitoring clean and actionable.",
    },
  },
  {
    slug: "performance-and-cost",
    title: "Performance & Cost",
    shortDesc:
      "Eliminate useless bot load, conserve cloud bandwidth, and reduce database queries to keep infrastructure costs low.",
    tagline: "Dedicate your compute budget exclusively to real paying visitors.",
    icon: LineChart,
    badge: "Infrastructure Optimization",
    overview:
      "Between 30% and 50% of typical internet traffic is automated bot activity. By deflecting non-human traffic at the perimeter, CleanTraffic slashes cloud bandwidth bills, prevents database CPU spikes, and keeps web pages blazingly fast for human buyers.",
    whyItMatters: {
      headline: "The hidden financial drain of unmanaged bot traffic",
      points: [
        {
          title: "Inflated Cloud Hosting Bills",
          desc: "Autoscaling clusters spin up additional instances simply to serve data to bots that will never make a purchase.",
        },
        {
          title: "Slow Page Load Times",
          desc: "Real customers suffer from sluggish server response times when database threads are locked by scraping operations.",
        },
        {
          title: "High CDN & Bandwidth Costs",
          desc: "Images, scripts, and video assets repeatedly downloaded by crawlers unnecessarily pump up bandwidth expenses.",
        },
      ],
    },
    howCleanTrafficProtects: {
      headline: "Lightweight, zero-cost edge enforcement",
      capabilities: [
        {
          title: "Instant 404 Header Termination",
          desc: "Terminates bad traffic with an empty 20-byte response header rather than rendering heavy HTML and JS assets.",
        },
        {
          title: "Local Session Caching",
          desc: "Recognizes returning verified visitors locally, bypassing redundant cloud API calls and saving quota.",
        },
        {
          title: "Optimized Database Capacity",
          desc: "Keeps your primary transactional database completely isolated from non-human traffic storms.",
        },
      ],
    },
    technicalEnforcement: {
      ruleType: "Resource Protection & Early Exit Handler",
      latency: "< 0.3ms",
      detectionLayer: "Fast-Path Edge Gateway",
      defaultMitigation: "Sub-millisecond lightweight drop",
    },
    realWorldImpact: {
      stat: "40%+",
      statLabel: "Reduction in Server Load",
      summary:
        "Engineering teams scale down EC2 and Kubernetes node counts without impacting legitimate customer throughput.",
    },
  },
];
