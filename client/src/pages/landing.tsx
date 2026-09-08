import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  ShieldCheck,
  ChevronRight,
  Menu,
  X,
  Cloud,
  Layers,
  Hexagon,
  Cpu,
  Zap,
  Globe,
  FileCode2,
  Fingerprint,
  Activity,
  Network,
  Ghost,
  MapPin,
  Lock,
  LineChart,
  Bot,
  ShieldAlert,
  CheckCircle2,
  Wallet,
  SlidersHorizontal,
  PieChart,
  Target,
  ArrowRight,
  Settings,
  Code,
  Play,
  Check,
} from "lucide-react";
import { useState } from "react";
import { LandingDashboardPreview } from "@/components/landing/LandingDashboardPreview";

const marqueeLogos = [
  { icon: Cloud, name: "CloudScale" },
  { icon: Layers, name: "StackSync" },
  { icon: Hexagon, name: "Nexus" },
  { icon: Cpu, name: "CyberCore" },
  { icon: Zap, name: "BoltAds" },
  { icon: Globe, name: "Orbis" },
  { icon: Network, name: "NetBase" },
];

const detectionLayers = [
  {
    icon: Globe,
    title: "Network Intelligence",
    desc: "Analyze visitor network characteristics and flag high-risk infrastructure before a single byte of your app is served.",
    items: [
      "IP Reputation",
      "ASN Detection",
      "Datacenter Detection",
      "VPN Detection",
      "Tor Exit Nodes",
      "Proxy Detection",
      "Mobile Carrier Detection",
      "Hosting Provider Detection",
    ],
  },
  {
    icon: FileCode2,
    title: "HTTP Request Analysis",
    desc: "Inspect every request for anomalies commonly produced by bots, scrapers, and automation tools.",
    items: [
      "Suspicious Headers",
      "Missing Headers",
      "Header Spoofing",
      "Invalid Accept Headers",
      "Invalid Language Headers",
      "HTTP Version Anomalies",
      "Referer Anomalies",
    ],
  },
  {
    icon: Fingerprint,
    title: "Browser Integrity",
    desc: "Identify headless browsers and automation frameworks attempting to impersonate real users.",
    items: [
      "Headless Browsers",
      "Selenium",
      "Playwright",
      "Puppeteer",
      "WebDriver Detection",
      "DevTools Detection",
      "Navigator Inconsistencies",
    ],
  },
  {
    icon: Activity,
    title: "Behavioral Analysis",
    desc: "Evaluate real interaction signals that automated traffic consistently fails to reproduce.",
    items: [
      "Mouse Movement",
      "Scroll Behavior",
      "Typing Cadence",
      "Click Timing",
      "Session Duration",
      "Navigation Flow",
      "Idle Time",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Threat Intelligence",
    desc: "Leverage continuously updated intelligence to block known malicious actors before they reach your app.",
    items: [
      "Known Attackers",
      "Known Scrapers",
      "Malicious Fingerprints",
      "VPN Providers",
      "High-Risk ASNs",
      "Bot Signatures",
      "Emerging Threat Indicators",
    ],
  },
];

const resourceFeatures = [
  {
    icon: Settings,
    title: "Automation Tools",
    desc: "Detect and block automated browsers, scraping tools, and bots used for form submissions, data harvesting, and large-scale automation.",
  },
  {
    icon: Network,
    title: "Botnets",
    desc: "Identify coordinated networks of malicious bots before they can launch attacks, abuse resources, or overwhelm your infrastructure.",
  },
  {
    icon: ShieldAlert,
    title: "Fraud Prevention",
    desc: "Stop suspicious traffic linked to payment fraud, account takeovers, fake signups, credential stuffing, and other forms of online abuse.",
  },
  {
    icon: Ghost,
    title: "VPNs & Proxies",
    desc: "Detect visitors attempting to conceal their identity or location through VPNs, proxies, Tor networks, and anonymous infrastructure.",
  },
  {
    icon: Bot,
    title: "AI & Web Crawlers",
    desc: "Control automated crawlers that collect, index, or scrape your content without permission, protecting your data and server capacity.",
  },
  {
    icon: MapPin,
    title: "IP Intelligence",
    desc: "Leverage rich IP data — reputation, geolocation, ASN, hosting provider, usage type, and risk signals — to make smarter real-time decisions.",
  },
  {
    icon: Lock,
    title: "Cybersecurity",
    desc: "Strengthen your security posture by identifying high-risk traffic early, reducing attack surfaces, and stopping malicious requests at the edge.",
  },
  {
    icon: LineChart,
    title: "Performance & Cost",
    desc: "Reduce unnecessary server load, bandwidth, API calls, and database queries so your infrastructure stays dedicated to real users.",
  },
];

const adFeatures = [
  {
    title: "Save Money 24/7",
    desc: "Protect your advertising budget around the clock. CleanTraffic blocks invalid clicks, fake impressions, and malicious traffic before they drain your campaigns.",
    icon: Wallet,
    color: "bg-[#E5F5FE]",
    iconColor: "text-[#2B6CB0]",
  },
  {
    title: "Customize Protection",
    desc: "Tailor detection to your needs with configurable rules: geo targeting, device detection, risk thresholds, IP policies, and advanced filtering for greater accuracy.",
    icon: SlidersHorizontal,
    color: "bg-[#E9F3ED]",
    iconColor: "text-[#2C7A7B]",
  },
  {
    title: "Actionable Insights",
    desc: "Access a comprehensive analytics dashboard with visibility into every click and visitor — browser, device, location, ISP, ASN, network type, and timestamps.",
    icon: PieChart,
    color: "bg-[#F0EEFF]",
    iconColor: "text-[#6B46C1]",
  },
  {
    title: "Optimize Campaigns",
    desc: "Use detailed traffic intelligence to identify suspicious patterns, eliminate wasted spend, and make data-driven decisions that improve campaign effectiveness.",
    icon: Target,
    color: "bg-[#FFFAF0]",
    iconColor: "text-[#C05621]",
  },
];

export default function Landing() {
  const [, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div
      className="min-h-screen w-full flex flex-col bg-white text-slate-900 selection:bg-emerald-500 selection:text-white overflow-x-hidden"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* ── Top Navigation Bar (Full Width, Sticky) ─────────────────── */}
      <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80 transition-all">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5 cursor-pointer group select-none"
          >
            <div className="w-8 h-8 rounded-xl bg-[#064E3B] border border-[#047857] flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
            </div>
            <span className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
              CleanTraffic
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-[13px] lg:text-[14px] font-medium text-slate-600">
            <a
              href="#features"
              className="hover:text-slate-900 transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="hover:text-slate-900 transition-colors"
            >
              Detection Engine
            </a>
            <a
              href="#click-fraud"
              className="hover:text-slate-900 transition-colors"
            >
              Fraud Prevention
            </a>
            <a
              href="#pricing"
              className="hover:text-slate-900 transition-colors"
            >
              Pricing
            </a>
          </nav>

          {/* Desktop CTA Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => navigate("/user")}
              className="text-[13px] lg:text-[14px] font-medium text-slate-600 hover:text-slate-900 transition-colors px-2 py-1"
            >
              Log in
            </button>
            <button
              onClick={() => navigate("/user")}
              className="text-[13px] lg:text-[14px] font-semibold bg-[#0F172A] hover:bg-black text-white px-4 py-2 rounded-full shadow-xs hover:shadow transition-all duration-200"
            >
              Try CleanTraffic free
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-slate-700 p-2 rounded-lg hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden w-full bg-white border-b border-slate-200 px-5 py-4 flex flex-col gap-3.5 shadow-lg">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="text-[15px] font-medium text-slate-700 py-1"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="text-[15px] font-medium text-slate-700 py-1"
            >
              Detection Engine
            </a>
            <a
              href="#click-fraud"
              onClick={() => setMobileMenuOpen(false)}
              className="text-[15px] font-medium text-slate-700 py-1"
            >
              Fraud Prevention
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="text-[15px] font-medium text-slate-700 py-1"
            >
              Pricing
            </a>
            <div className="h-px bg-slate-100 my-1" />
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate("/user");
              }}
              className="text-[15px] font-medium text-slate-700 py-1 text-left"
            >
              Log in
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate("/user");
              }}
              className="text-[14px] font-semibold bg-[#0F172A] text-white px-5 py-3 rounded-full w-full text-center shadow-sm"
            >
              Try CleanTraffic free
            </button>
          </div>
        )}
      </header>

      {/* ── Full-Width Hero Section (Edge-to-Edge with Atmospheric Gradient) ── */}
      <section className="w-full bg-gradient-to-b from-[#E7F2FA] via-[#F3F8FC] to-white border-b border-slate-200/60 relative overflow-hidden pt-4 sm:pt-6 md:pt-8 pb-8 sm:pb-12 md:pb-16">
        {/* Subtle Ambient Cloud Accents */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[90vw] max-w-[1200px] h-[450px] rounded-full bg-gradient-to-b from-white/70 via-white/40 to-transparent blur-3xl" />
          <div className="absolute top-1/4 -left-20 w-80 h-80 rounded-full bg-sky-200/30 blur-3xl" />
          <div className="absolute top-1/3 -right-20 w-80 h-80 rounded-full bg-emerald-100/40 blur-3xl" />
        </div>

        {/* Content Container (Comfortable Max Width for Typography) */}
        <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 relative z-10 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="max-w-4xl mx-auto flex flex-col items-center"
          >
            {/* Hero Headline (Positioned higher, punchy and compact on mobile) */}
            <h1
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-[3.65rem] leading-[1.12] sm:leading-[1.08] font-black tracking-tight text-slate-900 mb-2 sm:mb-3 md:mb-3.5"
              style={{
                fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
                WebkitFontSmoothing: "antialiased",
              }}
            >
              Run your traffic campaigns like a pro
            </h1>

            {/* Subhead */}
            <p className="text-xs sm:text-sm md:text-base lg:text-lg text-slate-600 max-w-xl mx-auto leading-relaxed mb-4 sm:mb-5 font-normal px-2">
              All-in-one platform for real-time visitor classification, residential bot cloaking, and ad spend defense. Route genuine humans to your money page and deflect bots with zero latency.
            </p>

            {/* CTA Action Group */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-4 w-full max-w-md mx-auto mb-1 sm:mb-2">
              <button
                onClick={() => navigate("/user")}
                className="w-full sm:w-auto min-h-[42px] px-6 sm:px-7 py-2.5 sm:py-3 bg-[#0F172A] hover:bg-black text-white rounded-full font-semibold text-[14px] sm:text-[15px] shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2 group"
              >
                <span>Try CleanTraffic free</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <a
                href="#dashboard-preview"
                className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-2 text-slate-700 hover:text-slate-900 font-semibold text-[14px] sm:text-[15px] px-4 py-2 rounded-full hover:bg-white/80 transition-colors"
              >
                <div className="w-6 h-6 rounded-full border border-slate-300 bg-white flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
                  <Play className="w-2.5 h-2.5 fill-slate-700 ml-0.5" />
                </div>
                <span>See how it works</span>
              </a>
            </div>
          </motion.div>

          {/* ── Responsive Dashboard Analytics Showcase (Immediately Peeking into Viewport) ── */}
          <motion.div
            id="dashboard-preview"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="w-full max-w-6xl mx-auto mt-3 sm:mt-5 md:mt-6 relative scroll-mt-20"
          >
            {/* Real Application Preview Component */}
            <LandingDashboardPreview />

            {/* Bottom Mist Fade Reflection (Matching the Reference Aesthetic) */}
            <div
              className="absolute -bottom-6 sm:-bottom-8 inset-x-0 h-16 sm:h-24 md:h-32 bg-gradient-to-t from-white via-white/85 to-transparent pointer-events-none z-10"
              aria-hidden="true"
            />
          </motion.div>
        </div>
      </section>

      {/* ── Full-Width Marquee Strip ─────────────────────────────────── */}
      <section className="w-full py-6 sm:py-8 bg-white border-b border-slate-200/80 overflow-hidden">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center gap-4 md:gap-8">
          <div className="shrink-0 flex items-center">
            <span className="text-slate-400 font-bold text-xs uppercase tracking-[0.16em]">
              Trusted by Media Buyers & Networks
            </span>
            <div className="hidden md:block w-px h-5 bg-slate-200 ml-6" />
          </div>
          <div
            className="relative flex overflow-hidden w-full flex-1"
            style={{
              maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
              WebkitMaskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            }}
          >
            {[0, 1].map((copy) => (
              <div
                key={copy}
                className="flex shrink-0 items-center gap-12 md:gap-20 pr-12 md:pr-20"
                style={{ animation: "marquee 30s linear infinite" }}
                aria-hidden={copy === 1}
              >
                {marqueeLogos.map((logo, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 text-slate-400 hover:text-slate-700 transition-colors duration-300"
                  >
                    <logo.icon className="w-5 h-5 md:w-6 md:h-6" />
                    <span className="font-bold text-sm md:text-base tracking-tight text-slate-600">
                      {logo.name}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Full-Width Editorial / Narrative Section ────────────────── */}
      <section className="w-full bg-white py-14 sm:py-20 md:py-24 border-b border-slate-100">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Left Narrative */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="lg:col-span-7 space-y-6"
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Next-Generation Cloaking</span>
              </div>
              <h2
                className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] font-bold text-slate-900 tracking-tight leading-[1.15]"
                style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}
              >
                Stop bad traffic before it reaches your website
              </h2>
              <div className="space-y-4 text-slate-600 text-base sm:text-lg leading-relaxed">
                <p>
                  Traditional CAPTCHAs and basic IP blocklists fail against modern automated bots. Today's residential proxies and automation frameworks easily mimic human devices and bypass simple rate limits.
                </p>
                <p>
                  CleanTraffic takes a deterministic, multi-layer approach — analyzing every visitor across network intelligence, HTTP header anomalies, browser integrity, and behavioral signals in real time.
                </p>
                <p>
                  Deflect automated scrapers and ad-fraud crawlers while letting genuine paying customers flow straight to your high-converting money pages without friction.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => navigate("/user")}
                  className="w-full sm:w-auto px-7 py-3.5 bg-[#0F172A] hover:bg-black text-white rounded-full font-semibold text-[15px] shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 group"
                >
                  <span>Start Free Trial</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>

            {/* Right Highlights Cards */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="lg:col-span-5 space-y-3.5"
            >
              {[
                {
                  title: "Sub-Millisecond Edge Evaluation",
                  desc: "PHP SDK and direct API responses under 1ms mean zero conversion dropoff for human visitors.",
                  badge: "< 1ms latency",
                },
                {
                  title: "Zero False Positives for Real Buyers",
                  desc: "Granular heuristics distinguish real mobile carriers and residential ISPs from malicious bot proxies.",
                  badge: "99.8% precision",
                },
                {
                  title: "Safe Page Cloaking & Deflection",
                  desc: "Serve safe, benign pages or HTTP 404/403 drops to crawlers while routing buyers to your real offer.",
                  badge: "Custom rules",
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 sm:p-5 rounded-2xl bg-[#F8FAFC] border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      {item.title}
                    </h3>
                    <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Full-Width Resource Feature Grid ────────────────────────── */}
      <section id="features" className="w-full bg-[#FAFBFD] py-14 sm:py-20 md:py-24 border-b border-slate-200/80">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="max-w-3xl mb-12 sm:mb-16"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 mb-3">
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              <span>Full-Stack Bot Defense</span>
            </div>
            <h2
              className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] font-bold text-slate-900 tracking-tight leading-[1.15] mb-4"
              style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}
            >
              Keep your resources focused on real visitors
            </h2>
            <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
              Block malicious traffic before it consumes ad budget, database resources, server capacity, or alters your conversion metrics.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {resourceFeatures.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.05 }}
                className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center mb-4 text-slate-700 group-hover:bg-[#0F172A] group-hover:text-white transition-colors duration-200">
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <h3
                    className="text-base sm:text-lg font-bold text-slate-900 mb-2 tracking-tight"
                    style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
                  >
                    {feature.title}
                  </h3>
                  <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 sm:mt-16 flex flex-col items-center text-center">
            <button
              onClick={() => navigate("/user")}
              className="px-8 py-3.5 bg-[#0F172A] hover:bg-black text-white rounded-full font-semibold text-[15px] shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 group"
            >
              <span>Get Started for Free</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="mt-3 text-xs sm:text-sm text-slate-500 font-medium">
              Start protecting your campaigns in under 5 minutes. No credit card required.
            </p>
          </div>
        </div>
      </section>

      {/* ── Full-Width Detection Engine (Dark Luxury Security Section) ── */}
      <section id="how-it-works" className="w-full bg-[#0B0F17] py-16 sm:py-20 md:py-28 relative overflow-hidden border-b border-slate-800">
        {/* Animated Security Grid & Light Beams */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl opacity-30 mix-blend-screen">
            <div className="absolute top-0 left-[15%] w-[1px] h-full bg-gradient-to-b from-transparent via-[#FFB300]/30 to-transparent" />
            <div className="absolute top-0 left-[50%] w-[1px] h-full bg-gradient-to-b from-transparent via-emerald-500/30 to-transparent" />
            <div className="absolute top-0 left-[85%] w-[1px] h-full bg-gradient-to-b from-transparent via-sky-500/20 to-transparent" />
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.06),transparent_50%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:32px_32px]" />
        </div>

        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="mb-12 sm:mb-16"
          >
            <span className="inline-block text-emerald-400 uppercase text-xs sm:text-sm font-bold tracking-[0.14em] mb-2 sm:mb-3">
              Multi-Layer Defense Architecture
            </span>
            <h2
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white mb-4 sm:mb-6"
              style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}
            >
              <span>Our Detection </span>
              <span className="text-emerald-400">Engine</span>
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-slate-400 leading-relaxed max-w-3xl font-normal">
              Every visitor is evaluated through multiple independent detection layers. By synthesizing network intelligence, browser fingerprinting, request structure, and behavioral analytics, CleanTraffic accurately shields your revenue.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {detectionLayers.map((layer, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-2xl p-5 sm:p-7 flex flex-col justify-between hover:bg-white/[0.06] hover:border-emerald-500/30 transition-all duration-300"
              >
                <div>
                  <div className="flex items-center gap-3 mb-4 text-emerald-400">
                    <layer.icon className="w-6 h-6 shrink-0" />
                    <h3
                      className="text-lg sm:text-xl font-black uppercase tracking-tight text-white"
                      style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
                    >
                      {layer.title}
                    </h3>
                  </div>
                  <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
                    {layer.desc}
                  </p>
                </div>
                <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                  {layer.items.map((item, j) => (
                    <div key={j} className="flex items-center gap-2 text-xs sm:text-[13px] text-slate-300">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Full-Width Click Fraud Section ──────────────────────────── */}
      <section id="click-fraud" className="w-full bg-[#F2F7F6] py-14 sm:py-20 md:py-24 border-b border-slate-200/80">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-teal-800 bg-teal-100/70 border border-teal-200 mb-3">
                <Target className="w-3.5 h-3.5 text-teal-700" />
                <span>Ad Budget Protection</span>
              </div>
              <h2
                className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] font-bold text-slate-900 mb-3 tracking-tight"
                style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}
              >
                Say Goodbye to Click Fraud
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-slate-600 leading-relaxed">
                Stop wasting paid advertising budget on click farms, automated scrapers, and malicious bot traffic. CleanTraffic keeps your ad spend targeted exclusively at real buyers.
              </p>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-10 sm:mb-12">
            {adFeatures.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.07 }}
                className="bg-white rounded-2xl p-5 sm:p-6 flex flex-col border border-slate-200/90 shadow-2xs hover:shadow-md transition-shadow duration-200"
              >
                <div
                  className={`w-full h-28 sm:h-32 rounded-xl ${feature.color} flex items-center justify-center mb-5`}
                >
                  <feature.icon className={`w-9 h-9 ${feature.iconColor}`} strokeWidth={1.75} />
                </div>
                <h3
                  className="text-base sm:text-lg font-bold text-slate-900 mb-2 tracking-tight"
                  style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
                >
                  {feature.title}
                </h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>

          <div className="text-center max-w-md mx-auto">
            <button
              onClick={() => navigate("/user")}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#0F172A] hover:bg-black text-white rounded-full font-semibold text-[15px] shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 mx-auto mb-3"
            >
              <span>Get Started for Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-slate-500 text-xs sm:text-sm">
              No credit card required • 14-day free trial • Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* ── Full-Width Transparent Pricing Section ──────────────────── */}
      <section id="pricing" className="w-full bg-white py-16 sm:py-20 md:py-24 border-b border-slate-200/80">
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 mb-3">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Simple, Transparent Plans</span>
            </div>
            <h2
              className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] font-bold text-slate-900 mb-4 tracking-tight"
              style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}
            >
              Protect your traffic campaigns today
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-slate-600 mb-8 max-w-xl mx-auto leading-relaxed">
              Start with a 14-day full-featured free trial. Test your campaigns with our PHP snippet and real-time visitor logs without committing a cent.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 max-w-md mx-auto">
              <button
                onClick={() => navigate("/user")}
                className="w-full sm:w-auto px-8 py-3.5 bg-[#0F172A] hover:bg-black text-white rounded-full font-semibold text-[15px] shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 group"
              >
                <span>Start Free Trial</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => navigate("/user")}
                className="w-full sm:w-auto px-8 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full font-semibold text-[15px] transition-colors"
              >
                Log In
              </button>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs sm:text-sm text-slate-600 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 14-day free trial
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Instant activation
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Full-Width Footer ───────────────────────────────────────── */}
      <footer className="w-full bg-[#0B0F17] border-t border-slate-800 py-12 sm:py-14 px-4 sm:px-6 lg:px-8 text-slate-400">
        <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5 text-white">
            <div className="w-7 h-7 rounded-lg bg-[#064E3B] border border-[#047857] flex items-center justify-center text-white">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
            </div>
            <span className="font-bold text-base tracking-tight">CleanTraffic</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-8 text-xs sm:text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">Detection Engine</a>
            <a href="#click-fraud" className="hover:text-white transition-colors">Click Fraud</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <button onClick={() => navigate("/user")} className="hover:text-white transition-colors">Log In</button>
          </div>

          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} CleanTraffic. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
