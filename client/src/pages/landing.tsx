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
} from "lucide-react";
import { useState } from "react";

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
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="w-full z-50 bg-[#161616] sticky top-0">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-20 md:h-24 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-7 h-7 text-white" />
              <span className="font-bold text-xl text-white tracking-tight">CleanTraffic</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              {["Features", "How It Works", "Pricing"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(/ /g, "-")}`}
                  className="text-[15px] font-medium text-[#a1a1a1] hover:text-white transition-colors"
                >
                  {item}
                </a>
              ))}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <button
              onClick={() => navigate("/user")}
              className="text-[15px] font-medium text-[#a1a1a1] hover:text-white transition-colors"
            >
              Log in
            </button>
            <button
              onClick={() => navigate("/user")}
              className="text-[15px] font-medium bg-white text-black px-6 py-2.5 rounded-full hover:bg-gray-100 transition-colors"
            >
              Get Started
            </button>
          </div>
          <button
            className="md:hidden text-[#a1a1a1]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#1a1a1a] border-t border-white/5 px-6 py-6 flex flex-col gap-5">
            {["Features", "How It Works", "Pricing"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/ /g, "-")}`}
                onClick={() => setMobileMenuOpen(false)}
                className="text-[15px] font-medium text-[#a1a1a1] hover:text-white transition-colors"
              >
                {item}
              </a>
            ))}
            <div className="h-px bg-white/10" />
            <button
              onClick={() => navigate("/user")}
              className="text-[15px] font-medium text-white text-left"
            >
              Log in
            </button>
            <button
              onClick={() => navigate("/user")}
              className="text-[15px] font-medium bg-white text-black px-6 py-3 rounded-full hover:bg-gray-100 transition-colors w-full"
            >
              Get Started
            </button>
          </div>
        )}
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="bg-[#161616] px-3 md:px-4 pb-8 md:pb-12 pt-3 md:pt-4">
        <div
          className="max-w-[1400px] mx-auto rounded-[2rem] md:rounded-[2.5rem] overflow-hidden relative flex flex-col"
          style={{
            background:
              "radial-gradient(100% 100% at 0% 0%, #c1e0c8 0%, transparent 100%), radial-gradient(100% 100% at 100% 0%, #c9e6f0 0%, transparent 100%), radial-gradient(100% 100% at 100% 100%, #e8d5ec 0%, transparent 100%), radial-gradient(100% 100% at 0% 100%, #d5e5d3 0%, transparent 100%), #eaf1eb",
          }}
        >
          {/* Hero content */}
          <div className="w-full px-6 pt-16 pb-0 md:px-8 md:py-20 lg:px-16 lg:pt-32 flex flex-col lg:flex-row justify-between gap-8 lg:gap-12 items-start lg:items-end flex-1 min-h-[85vh] md:min-h-[700px]">
            <div className="max-w-[700px] pb-8 md:pb-16 lg:pb-24 mt-auto lg:mt-0">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55 }}
              >
                <div className="inline-flex items-center gap-2 bg-black/8 border border-black/10 rounded-full px-4 py-1.5 mb-8">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-medium text-[#161616]">Bot protection running in real time</span>
                </div>
                <h1
                  className="text-[2.75rem] md:text-[3.5rem] lg:text-[5.5rem] leading-[1.05] font-bold tracking-tight text-[#000000] mb-6 md:mb-8"
                  style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif", WebkitFontSmoothing: "antialiased" }}
                >
                  Stop bad traffic before it reaches your site.
                </h1>
                <p className="text-lg lg:text-[1.35rem] text-[#4a4a4a] mb-8 md:mb-10 max-w-[600px] leading-relaxed">
                  Enterprise-grade bot mitigation, IP intelligence, and click fraud prevention. Integrate in minutes via PHP snippet or API.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <button
                    onClick={() => navigate("/user")}
                    className="w-full sm:w-auto px-8 py-4 bg-[#161616] hover:bg-black text-white rounded-full font-medium transition-all text-[15px] flex items-center justify-center gap-2 group"
                  >
                    Start Free Trial
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button
                    onClick={() => navigate("/user")}
                    className="w-full sm:w-auto px-8 py-4 bg-white/40 hover:bg-white/60 text-[#161616] rounded-full font-medium transition-all backdrop-blur-sm text-[15px] flex items-center justify-center gap-2"
                  >
                    <Code className="w-4 h-4" />
                    Log In
                  </button>
                </div>
              </motion.div>
            </div>

            {/* Hero image */}
            <div className="block w-full lg:w-[450px] relative self-end mt-8 lg:mt-0">
              <img
                src="https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                alt="Security team at work"
                className="w-full h-[250px] md:h-[350px] lg:h-auto object-cover rounded-t-2xl lg:rounded-tl-3xl shadow-2xl border-t border-x lg:border-r-0 lg:border-l border-white/40"
              />
            </div>
          </div>

          {/* Marquee strip */}
          <div className="py-6 md:py-8 bg-[#111111] border-y border-white/5 flex flex-col md:flex-row items-center justify-center lg:justify-start overflow-hidden">
            <div className="px-6 md:pl-10 md:pr-8 z-20 shrink-0 mb-6 md:mb-0 flex items-center">
              <span className="text-white/50 font-medium text-sm md:text-[15px] uppercase tracking-[0.2em]">Trusted by</span>
              <div className="hidden md:block w-px h-8 bg-white/10 ml-8" />
            </div>
            <div
              className="relative flex overflow-hidden w-full flex-1"
              style={{
                maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
                WebkitMaskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
              }}
            >
              {[0, 1].map((copy) => (
                <div
                  key={copy}
                  className="flex shrink-0 items-center gap-16 md:gap-24 pr-16 md:pr-24"
                  style={{ animation: "marquee 30s linear infinite" }}
                  aria-hidden={copy === 1}
                >
                  {marqueeLogos.map((logo, i) => (
                    <div key={i} className="flex items-center gap-3 text-white/40 hover:text-white/80 transition-colors duration-300">
                      <logo.icon className="w-7 h-7 md:w-8 md:h-8" />
                      <span className="font-bold text-lg md:text-xl tracking-tight">{logo.name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* ── Stop bad traffic editorial ───────────────────────────── */}
          <div className="py-16 md:py-24 px-6 md:px-8 lg:px-16 border-t border-black/5">
            <div className="w-full max-w-[750px]">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <h2
                  className="text-3xl md:text-5xl lg:text-[3.5rem] font-bold text-black mb-8 tracking-tight leading-[1.1]"
                  style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}
                >
                  Stop bad traffic before it reaches your website
                </h2>
                <div className="space-y-6 text-[#4a4a4a] text-lg lg:text-[1.15rem] leading-relaxed mb-10">
                  <p>
                    Traditional CAPTCHA is no longer enough. Today's bots are sophisticated enough to solve challenges, mimic real users, and fly under the radar of basic filters.
                  </p>
                  <p>
                    CleanTraffic takes a smarter approach — analyzing every visitor across multiple independent detection layers including IP intelligence, browser fingerprinting, HTTP request analysis, and behavioral analytics to accurately separate real users from automated threats in real time.
                  </p>
                  <p>
                    Protect your site, preserve accurate analytics, reduce ad fraud, and keep legitimate visitors moving without friction.
                  </p>
                </div>
                <button
                  onClick={() => navigate("/user")}
                  className="w-full sm:w-auto px-8 py-4 bg-[#161616] hover:bg-black text-white rounded-full font-medium transition-all text-[15px] flex items-center justify-center gap-2 group"
                >
                  Get Started for Free
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            </div>
          </div>

          {/* ── Resource feature grid ───────────────────────────────── */}
          <div id="features" className="py-16 md:py-24 px-6 md:px-8 lg:px-16 border-t border-black/5">
            <div className="w-full">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="max-w-[800px] mb-16 md:mb-20"
              >
                <h2
                  className="text-3xl md:text-5xl lg:text-[3.5rem] font-bold text-black mb-8 tracking-tight leading-[1.1]"
                  style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}
                >
                  Keep your resources focused on real visitors
                </h2>
                <p className="text-[#4a4a4a] text-lg lg:text-[1.15rem] leading-relaxed">
                  Block malicious traffic before it consumes bandwidth, API calls, database resources, and server capacity — so your infrastructure stays optimized for genuine users.
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12 md:gap-y-16">
                {resourceFeatures.map((feature, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.07 }}
                    className="flex flex-col group cursor-default"
                  >
                    <div className="w-12 h-12 rounded-[14px] bg-black/5 flex items-center justify-center mb-6 text-black/70 group-hover:bg-black group-hover:text-white transition-colors duration-300">
                      <feature.icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-black mb-3 tracking-tight" style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}>
                      {feature.title}
                    </h3>
                    <p className="text-[#4a4a4a] leading-relaxed text-[15px]">{feature.desc}</p>
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mt-20 md:mt-24 flex flex-col items-center text-center"
              >
                <button
                  onClick={() => navigate("/user")}
                  className="px-8 py-4 bg-[#161616] hover:bg-black text-white rounded-full font-medium transition-all text-[15px] flex items-center justify-center gap-2 group shadow-md shadow-black/5"
                >
                  Get Started for Free
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <p className="mt-5 text-sm font-medium text-[#4a4a4a]">Start protecting your site in minutes. No credit card required.</p>
              </motion.div>
            </div>
          </div>

          {/* ── Detection Engine (dark section) ─────────────────────── */}
          <div id="how-it-works" className="bg-[#0A0A0A] py-16 md:py-20 px-6 relative overflow-hidden">
            {/* Animated beams */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-[1200px] opacity-40 mix-blend-screen">
                <div className="absolute top-0 left-[10%] w-[1px] h-[150%] bg-gradient-to-b from-transparent via-[#FFB300]/30 to-transparent" style={{ animation: "beam 12s linear infinite" }} />
                <div className="absolute top-0 left-[45%] w-[1px] h-[150%] bg-gradient-to-b from-transparent via-indigo-500/30 to-transparent" style={{ animation: "beam 18s linear infinite" }} />
                <div className="absolute top-0 left-[85%] w-[1px] h-[150%] bg-gradient-to-b from-transparent via-white/20 to-transparent" style={{ animation: "beam 8s linear infinite" }} />
              </div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,179,0,0.03),transparent_50%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.03),transparent_50%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:32px_32px]" />
            </div>

            <div className="max-w-[1400px] mx-auto relative z-10">
              <div className="mb-12 md:mb-16">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  <span className="block text-white/70 uppercase text-sm md:text-base font-bold tracking-[0.1em] mb-2 md:mb-3">
                    Advanced Multi-Layer Detection
                  </span>
                  <h2
                    className="text-4xl md:text-5xl lg:text-6xl font-black uppercase leading-[0.9] tracking-tighter mb-6"
                    style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}
                  >
                    <span className="text-white block">Our Detection</span>
                    <span className="text-[#FFB300] block">Engine</span>
                  </h2>
                  <p className="text-base md:text-lg text-[#a1a1a1] leading-relaxed max-w-3xl font-medium">
                    Every visitor is evaluated through multiple independent detection layers — not just a single signal. By combining network intelligence, browser fingerprinting, request analysis, and behavioral analytics, CleanTraffic accurately distinguishes legitimate users from sophisticated automated traffic in real time.
                  </p>
                </motion.div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                {detectionLayers.map((layer, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="relative bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 md:p-7 flex flex-col group transition-all duration-500 hover:-translate-y-1 hover:scale-[1.01] hover:bg-white/[0.04] hover:border-white/[0.12] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7),0_0_20px_rgba(255,255,255,0.05)] overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                    <div className="relative z-10 flex items-center gap-3 mb-5 text-[#FFB300] group-hover:text-[#ffc436] transition-colors duration-300">
                      <layer.icon className="w-6 h-6 md:w-7 md:h-7 shrink-0 drop-shadow-[0_0_10px_rgba(255,179,0,0.3)] group-hover:drop-shadow-[0_0_15px_rgba(255,179,0,0.5)] transition-all duration-300" />
                      <h3
                        className="text-xl md:text-2xl font-black uppercase tracking-tighter leading-none mt-1 text-white/90 group-hover:text-white transition-colors duration-300"
                        style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}
                      >
                        {layer.title}
                      </h3>
                    </div>
                    <p className="relative z-10 text-[#888] text-xs uppercase font-bold tracking-[0.06em] leading-relaxed mb-6 min-h-[3.5rem] group-hover:text-[#a0a0a0] transition-colors duration-300">
                      {layer.desc}
                    </p>
                    <div className="relative z-10 space-y-2.5 mt-auto">
                      {layer.items.map((item, j) => (
                        <div key={j} className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-white/40 group-hover:text-[#FFB300]/80 shrink-0 mt-[1px] transition-colors duration-300" />
                          <span className="text-white/70 group-hover:text-white/95 text-xs md:text-[13px] font-semibold uppercase tracking-[0.05em] leading-snug transition-colors duration-300">
                            {item}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Click fraud section ─────────────────────────────────── */}
          <div className="bg-[#F2F7F6] py-16 md:py-24 px-6">
            <div className="max-w-[1400px] mx-auto">
              <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  <h2
                    className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#083038] mb-4 tracking-tight"
                    style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}
                  >
                    Say Goodbye to Click Fraud
                  </h2>
                  <p className="text-base md:text-lg text-[#415F63] leading-relaxed font-medium">
                    Stop wasting your advertising budget on fraudulent clicks, fake impressions, and malicious traffic. CleanTraffic monitors and filters invalid activity in real time, ensuring your campaigns reach genuine users.
                  </p>
                </motion.div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6 mb-12">
                {adFeatures.map((feature, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="bg-white rounded-2xl p-5 md:p-6 flex flex-col hover:shadow-[0_20px_40px_-15px_rgba(8,48,56,0.08)] transition-shadow duration-300 border border-[#083038]/[0.04]"
                  >
                    <div className={`w-full h-32 md:h-40 rounded-xl ${feature.color} flex items-center justify-center mb-6 relative overflow-hidden group`}>
                      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <feature.icon className={`w-10 h-10 md:w-12 md:h-12 ${feature.iconColor} transform group-hover:scale-110 transition-transform duration-300`} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-lg md:text-xl font-bold text-[#083038] mb-3 tracking-tight leading-snug" style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}>
                      {feature.title}
                    </h3>
                    <p className="text-[#415F63] leading-relaxed text-sm md:text-[15px]">{feature.desc}</p>
                  </motion.div>
                ))}
              </div>

              <div className="text-center max-w-xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  <button
                    onClick={() => navigate("/user")}
                    className="bg-[#083038] hover:bg-[#041a1f] text-white px-6 py-3 rounded-xl font-medium text-base transition-colors duration-200 flex items-center gap-2 mx-auto mb-4 group shadow-xl shadow-[#083038]/20"
                  >
                    Get Started for Free
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <p className="text-[#64848A] text-[13px] md:text-sm">No credit card required. Cancel anytime.</p>
                </motion.div>
              </div>
            </div>
          </div>

          {/* ── Pricing placeholder ─────────────────────────────────── */}
          <div id="pricing" className="py-16 md:py-24 px-6 md:px-8 lg:px-16 border-t border-black/5">
            <div className="max-w-[700px] mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <h2
                  className="text-3xl md:text-4xl lg:text-[2.75rem] font-bold text-black mb-5 tracking-tight leading-tight"
                  style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}
                >
                  Simple, transparent pricing
                </h2>
                <p className="text-base md:text-lg text-[#4a4a4a] mb-10 max-w-[560px] mx-auto leading-relaxed">
                  Start with a 14-day free trial — no credit card required. Contact us to discuss plans that fit your traffic volume.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    onClick={() => navigate("/user")}
                    className="w-full sm:w-auto px-8 py-4 bg-[#161616] hover:bg-black text-white rounded-full font-medium transition-all text-[15px] flex items-center justify-center gap-2 group"
                  >
                    Start Free Trial
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button
                    onClick={() => navigate("/user")}
                    className="w-full sm:w-auto px-8 py-4 bg-black/5 hover:bg-black/10 text-[#161616] rounded-full font-medium transition-all text-[15px]"
                  >
                    Log In
                  </button>
                </div>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-5 md:gap-8 text-sm text-[#4a4a4a] font-medium">
                  <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> 14-day free trial</span>
                  <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> No credit card required</span>
                  <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Cancel anytime</span>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="bg-[#161616] border-t border-white/5 py-12 px-6">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5 text-white">
            <ShieldCheck className="w-5 h-5" />
            <span className="font-bold tracking-tight">CleanTraffic</span>
          </div>
          <div className="flex gap-6 text-sm text-[#a1a1a1]">
            <a href="#" className="hover:text-white transition-colors">Documentation</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <button onClick={() => navigate("/user")} className="hover:text-white transition-colors">Log In</button>
          </div>
          <p className="text-sm text-[#555]">© {new Date().getFullYear()} CleanTraffic. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
