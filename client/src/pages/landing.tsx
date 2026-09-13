import { motion, AnimatePresence } from "framer-motion";
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
  BookOpen,
  Sparkles,
} from "lucide-react";
import { useState, useEffect } from "react";
import { LandingDashboardPreview } from "@/components/landing/LandingDashboardPreview";
import { HeroSkyAtmosphere } from "@/components/landing/HeroSkyAtmosphere";
import { TrafficInspectorJsonDashboard } from "@/components/landing/TrafficInspectorJsonDashboard";
import { AgentGovernanceMonitor } from "@/components/landing/AgentGovernanceMonitor";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";

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
    slug: "ai-agents",
    icon: Sparkles,
    title: "Autonomous AI Agents",
    desc: "Verify authorized autonomous agents, enforce granular route policies, and isolate stealth scrapers impersonating AI assistants.",
    badge: "Agent Governance",
  },
  {
    slug: "automation-tools",
    icon: Settings,
    title: "Automation Tools",
    desc: "Detect and block automated browsers, scraping tools, and bots used for form submissions, data harvesting, and large-scale automation.",
    badge: "Headless & Frameworks",
  },
  {
    slug: "botnets",
    icon: Network,
    title: "Botnets",
    desc: "Identify coordinated networks of malicious bots before they can launch attacks, abuse resources, or overwhelm your infrastructure.",
    badge: "Distributed Networks",
  },
  {
    slug: "fraud-prevention",
    icon: ShieldAlert,
    title: "Fraud Prevention",
    desc: "Stop suspicious traffic linked to payment fraud, account takeovers, fake signups, credential stuffing, and other forms of online abuse.",
    badge: "Ad & Click Fraud",
  },
  {
    slug: "vpns-and-proxies",
    icon: Ghost,
    title: "VPNs & Proxies",
    desc: "Detect and flag visitors masking their network identity or location through VPNs, proxies, Tor networks, and anonymous infrastructure.",
    badge: "Proxy Classification",
  },
  {
    slug: "ai-and-web-crawlers",
    icon: Bot,
    title: "AI & Web Crawlers",
    desc: "Control automated crawlers that collect, index, or scrape your content without permission, protecting your data and server capacity.",
    badge: "AI Scrapers & Spiders",
  },
  {
    slug: "ip-intelligence",
    icon: MapPin,
    title: "IP Intelligence",
    desc: "Leverage rich IP data — reputation, geolocation, ASN, hosting provider, usage type, and risk signals — to make smarter real-time decisions.",
    badge: "Deep Network Profiling",
  },
  {
    slug: "cybersecurity",
    icon: Lock,
    title: "Cybersecurity",
    desc: "Strengthen your security posture by identifying high-risk traffic early, reducing attack surfaces, and stopping malicious requests at the edge.",
    badge: "Edge Hardening",
  },
  {
    slug: "performance-and-cost",
    icon: LineChart,
    title: "Performance & Cost",
    desc: "Reduce unnecessary server load, bandwidth, API calls, and database queries so your infrastructure stays dedicated to real users.",
    badge: "Compute Optimization",
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

const heroHeadlines = [
  "Know Every Visitor.",
  "See Every Bot. Stop Every Threat.",
  "Real-Time Bot Detection & Protection.",
  "Know Who’s Human. Detect What Isn’t.",
  "Smarter Bot Detection. Stronger Security.",
];

export default function Landing() {
  const [, navigate] = useLocation();
  const [currentHeadlineIdx, setCurrentHeadlineIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHeadlineIdx((prev) => (prev + 1) % heroHeadlines.length);
    }, 3800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="min-h-screen w-full flex flex-col bg-white text-slate-900 selection:bg-emerald-500 selection:text-white overflow-x-hidden"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* ── Global Unified Floating Navbar (Shared Across Site) ── */}
      <SiteNavbar activePage="home" />

      {/* ── Full-Width Hero Section with Sky & Cloud Atmosphere (Reference Style) ── */}
      <section className="relative w-full -mt-[68px] sm:-mt-[76px] pt-[88px] sm:pt-[106px] md:pt-[118px] pb-12 sm:pb-16 md:pb-24 overflow-hidden border-b border-slate-200/60">
        {/* Soft Blue Cloud & Gradient Atmosphere Component */}
        <HeroSkyAtmosphere />

        {/* Content Container (Center Aligned, Matching Typography & Staging) */}
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="max-w-4xl mx-auto flex flex-col items-center"
          >
            {/* Rotating Hero Headline */}
            <div className="min-h-[58px] sm:min-h-[70px] md:min-h-[82px] lg:min-h-[96px] flex items-center justify-center w-full mb-3 sm:mb-3.5">
              <AnimatePresence mode="wait">
                <motion.h1
                  key={currentHeadlineIdx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.32, ease: "easeInOut" }}
                  className="text-2xl sm:text-3xl md:text-[2.5rem] lg:text-[2.85rem] xl:text-[3.2rem] leading-[1.16] sm:leading-[1.12] font-bold tracking-tight text-slate-900"
                  style={{
                    fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
                    WebkitFontSmoothing: "antialiased",
                  }}
                >
                  {heroHeadlines[currentHeadlineIdx]}
                </motion.h1>
              </AnimatePresence>
            </div>

            {/* Supporting Description */}
            <p className="text-[13px] sm:text-[15px] md:text-base text-slate-600/90 max-w-xl sm:max-w-2xl mx-auto leading-relaxed mb-5 sm:mb-6 font-normal px-2">
              Know who’s real and who’s not. Detect bad bots, AI agents, and fraudulent traffic with industry-leading accuracy.
            </p>

            {/* CTA Action Group (Refined proportions and balanced footprint) */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3.5 w-full max-w-sm sm:max-w-md mx-auto">
              <button
                onClick={() => navigate("/user")}
                className="w-full sm:w-auto min-h-[40px] px-6 sm:px-6.5 py-2.5 bg-[#0F172A] hover:bg-black text-white rounded-full font-medium sm:font-semibold text-[13.5px] sm:text-[14px] shadow-xs hover:shadow-sm transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Try CleanTraffic free</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <a
                href="#dashboard-preview"
                className="w-full sm:w-auto min-h-[40px] inline-flex items-center justify-center gap-2 text-slate-700 hover:text-slate-950 font-medium text-[13.5px] sm:text-[14px] px-4 sm:px-4.5 py-2 rounded-full hover:bg-white/70 transition-all duration-200"
              >
                <div className="w-5 h-5 rounded-full border border-slate-300/80 bg-white flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
                  <Play className="w-2 h-2 fill-slate-700 ml-0.5" />
                </div>
                <span>See how it works</span>
              </a>
            </div>
          </motion.div>

          {/* ── Responsive Dashboard Analytics Showcase (Subtly lowered for composition balance) ── */}
          <motion.div
            id="dashboard-preview"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="w-full max-w-6xl mx-auto mt-8 sm:mt-11 md:mt-14 relative scroll-mt-24"
          >
            {/* Real Application Preview Component with floating 3D elevation */}
            <div className="relative rounded-2xl sm:rounded-3xl shadow-[0_25px_60px_-15px_rgba(15,23,42,0.14),0_10px_25px_-5px_rgba(15,23,42,0.06),0_1px_3px_rgba(0,0,0,0.04)]">
              <LandingDashboardPreview />
            </div>

            {/* Bottom Mist & Cloud Reflection (Matching the Reference Aesthetic) */}
            <div
              className="absolute -bottom-6 sm:-bottom-8 inset-x-0 h-20 sm:h-28 md:h-36 bg-gradient-to-t from-white via-white/85 to-transparent pointer-events-none z-10"
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

      {/* ── Section: Stop bad traffic before it reaches your website ───── */}
      <section className="w-full bg-white py-12 sm:py-16 md:py-20 border-b border-slate-200/80">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Content Column (Priority Headline & Messaging) */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-7 xl:col-span-7 flex flex-col justify-center"
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 mb-3.5 self-start">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Real-Time Traffic Inspection</span>
              </div>
              <h2
                className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.5rem] font-bold text-slate-900 tracking-tight leading-[1.18] mb-4"
                style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}
              >
                Stop bad traffic before it reaches your website
              </h2>
              <p className="text-slate-600 text-sm sm:text-base md:text-[17px] leading-relaxed max-w-2xl">
                Every inbound request is evaluated in sub-milliseconds across browser runtime fingerprints, network ASN reputation, and behavioral biometrics. Deflect bots and automated crawlers while letting verified humans convert with zero friction.
              </p>
            </motion.div>

            {/* Right Column: Compact Light-Theme JSON Dashboard Visual */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.08 }}
              className="lg:col-span-5 xl:col-span-5 flex justify-center lg:justify-end"
            >
              <TrafficInspectorJsonDashboard />
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
                key={feature.slug}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.05 }}
                onClick={() => navigate(`/use-cases/${feature.slug}`)}
                className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs hover:shadow-lg hover:border-slate-300 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 group-hover:bg-[#0F172A] group-hover:text-white transition-colors duration-200 shadow-2xs">
                      <feature.icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200/70 px-2 py-0.5 rounded-full group-hover:border-emerald-200 group-hover:text-emerald-700 transition-colors">
                      {feature.badge}
                    </span>
                  </div>

                  <h3
                    className="text-base sm:text-lg font-bold text-slate-900 mb-2 tracking-tight group-hover:text-emerald-700 transition-colors"
                    style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
                  >
                    {feature.title}
                  </h3>
                  <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-4">
                    {feature.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700 group-hover:text-emerald-700 transition-colors">
                  <span>Explore use case</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 sm:mt-16 flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
            <button
              onClick={() => navigate("/use-cases")}
              className="px-8 py-3.5 bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 rounded-full font-bold text-[15px] shadow-2xs hover:shadow-sm transition-all flex items-center justify-center gap-2 group cursor-pointer"
            >
              <span>See all use cases</span>
              <ArrowRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => navigate("/user")}
              className="px-8 py-3.5 bg-[#0F172A] hover:bg-black text-white rounded-full font-semibold text-[15px] shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 group cursor-pointer"
            >
              <span>Get Started for Free</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          <p className="mt-3.5 text-center text-xs sm:text-sm text-slate-500 font-medium">
            Start protecting your campaigns in under 5 minutes. No credit card required.
          </p>
        </div>
      </section>

      {/* ── AI Agents & Autonomous Workflows Showcase Section ── */}
      <AgentGovernanceMonitor />

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

      {/* ── Full-Width Documentation Section ────────────────────────── */}
      <section id="docs" className="w-full bg-[#F7FAF8] py-16 sm:py-20 md:py-24 border-b border-slate-200/80">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-12">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-emerald-800 bg-emerald-100/70 border border-emerald-200 mb-3">
                <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                <span>Developer & Security Guide</span>
              </div>
              <h2
                className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] font-bold text-slate-900 mb-3 tracking-tight"
                style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}
              >
                Comprehensive Documentation & Setup Guides
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
                Everything you need to integrate CleanTraffic, understand real-time bot detection signals, configure routing policies, and audit visitor traffic.
              </p>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-10">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-2.5 hover:shadow-sm transition-shadow">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-xs">
                01
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">What the Platform Does</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Learn how CleanTraffic protects web applications, landing pages, and marketing campaigns from unwanted automated traffic, scrapers, and ad click fraud.
              </p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-2.5 hover:shadow-sm transition-shadow">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-xs">
                02
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">How Bot Detection Works</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Understand the multi-tier inspection pipeline: crawler databases, request velocity tracking, synthetic header checks, datacenter ASN screening, and proxy detection.
              </p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-2.5 hover:shadow-sm transition-shadow">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-xs">
                03
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">How to Install & Integrate</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Step-by-step instructions for deploying our zero-dependency PHP script on cPanel, aaPanel, WordPress, or custom Nginx/Apache servers.
              </p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-2.5 hover:shadow-sm transition-shadow">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-xs">
                04
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Configuring Routing Rules</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Configure your Human Target URL, Bot Mitigation Actions (HTTP 404, HTTP 403, or Fallback URL), country geo-fencing, and device filters.
              </p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-2.5 hover:shadow-sm transition-shadow">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-xs">
                05
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Understanding Telemetry & Results</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Interpret visitor classifications, risk scores, ASN network usage types, triggering conditions, and live dashboard analytics.
              </p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-2.5 hover:shadow-sm transition-shadow">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-xs">
                06
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Troubleshooting Integration</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Quick diagnostic procedures for verifying cURL settings, inspecting HTTP response headers, clearing session caches, and testing API connectivity.
              </p>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={() => navigate("/docs")}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#0F172A] hover:bg-black text-white rounded-full font-semibold text-[15px] shadow-sm hover:shadow transition-all group"
            >
              <span>View Documentation</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
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

      {/* ── Global Unified Footer (Shared Across Site) ─────────────── */}
      <SiteFooter />
    </div>
  );
}
