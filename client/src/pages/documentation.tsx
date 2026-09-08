import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ShieldCheck,
  Search,
  BookOpen,
  Code2,
  Cpu,
  Layers,
  BarChart3,
  Sliders,
  Terminal,
  Lock,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
  Menu,
  X,
  FileCode,
  Globe,
  Zap,
  CheckCircle2,
  Server,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Share2,
} from "lucide-react";

interface DocSection {
  id: string;
  title: string;
  icon: any;
  category: string;
}

const docSections: DocSection[] = [
  { id: "introduction", title: "Introduction", icon: BookOpen, category: "Overview" },
  { id: "getting-started", title: "Getting Started", icon: Zap, category: "Overview" },
  { id: "installation", title: "Installation & Integration", icon: Code2, category: "Setup" },
  { id: "bot-detection", title: "Bot Detection Engine", icon: Cpu, category: "Core Concepts" },
  { id: "crawlers-seo", title: "Search, AI & Web Crawlers", icon: Sparkles, category: "Core Concepts" },
  { id: "visitor-intelligence", title: "Visitor Intelligence", icon: Globe, category: "Core Concepts" },
  { id: "dashboard", title: "Dashboard & Telemetry", icon: BarChart3, category: "Features" },
  { id: "configuration", title: "Routing & Mitigation Policies", icon: Sliders, category: "Features" },
  { id: "api-reference", title: "API & Developer Reference", icon: Terminal, category: "Developers" },
  { id: "security-privacy", title: "Security & Privacy", icon: Lock, category: "Security" },
  { id: "troubleshooting", title: "Troubleshooting", icon: AlertCircle, category: "Support" },
  { id: "boundaries", title: "Platform Boundaries", icon: ShieldAlert, category: "Support" },
  { id: "faq", title: "Frequently Asked Questions", icon: HelpCircle, category: "Support" },
];

export default function Documentation() {
  const [, navigate] = useLocation();
  const [activeSection, setActiveSection] = useState("introduction");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [copiedCodeSnippet, setCopiedCodeSnippet] = useState<string | null>(null);

  // Sync with URL hash if present
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash && docSections.some((s) => s.id === hash)) {
      setActiveSection(hash);
      const element = document.getElementById(hash);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, []);

  const handleSelectSection = (id: string) => {
    setActiveSection(id);
    setMobileNavOpen(false);
    window.location.hash = id;
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeSnippet(id);
    setTimeout(() => setCopiedCodeSnippet(null), 2000);
  };

  const filteredSections = docSections.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#FAFCFB] text-slate-800 font-sans flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
      {/* ── Top Header Bar ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90 h-16 flex items-center px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Mobile Nav Toggle */}
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Toggle navigation"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Brand */}
            <div
              onClick={() => navigate("/")}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-[#064E3B] border border-[#047857] flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
              </div>
              <span className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                CleanTraffic
              </span>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 border border-emerald-300/60 px-2 py-0.5 rounded-md hidden sm:inline-block">
                Documentation
              </span>
            </div>
          </div>

          {/* Quick Search */}
          <div className="relative hidden md:flex items-center w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-900 placeholder:text-slate-400 transition-all"
            />
          </div>

          {/* Right Action Links */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors hidden sm:inline-block"
            >
              Home
            </button>
            <button
              onClick={() => navigate("/user")}
              className="text-xs font-semibold bg-[#0F172A] hover:bg-black text-white px-3.5 py-2 rounded-lg shadow-xs hover:shadow transition-all flex items-center gap-1.5"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Layout (Sidebar + Content) ─────────────────────────── */}
      <div className="w-full max-w-7xl mx-auto flex-1 flex px-4 sm:px-6 lg:px-8 py-6 sm:py-8 gap-8 relative">
        {/* ── Desktop Persistent Sidebar ────────────────────────────── */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-3 space-y-6">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-3">
                Table of Contents
              </div>
              <nav className="space-y-1">
                {filteredSections.map((sec) => {
                  const Icon = sec.icon;
                  const isActive = activeSection === sec.id;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => handleSelectSection(sec.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg text-left transition-all ${
                        isActive
                          ? "bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200/80 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? "text-emerald-700" : "text-slate-400"
                        }`}
                      />
                      <span className="truncate">{sec.title}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Quick Helper Box */}
            <div className="bg-[#F0F7F4] border border-[#CCE3D8] rounded-xl p-4 text-xs space-y-2">
              <div className="font-bold text-[#064E3B] flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ready to integrate?</span>
              </div>
              <p className="text-[#2D5A47] text-[11px] leading-relaxed">
                Log in to your account, copy your personalized PHP script, and start tracking real-time visitor telemetry in under 3 minutes.
              </p>
              <button
                onClick={() => navigate("/user")}
                className="w-full mt-2 py-1.5 bg-[#064E3B] hover:bg-[#053F30] text-white rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                <span>Open Dashboard</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </aside>

        {/* ── Mobile Drawer Navigation ──────────────────────────────── */}
        {mobileNavOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex">
            <div className="w-72 bg-white h-full p-5 flex flex-col shadow-2xl overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
                <span className="font-bold text-sm text-slate-900">Documentation Nav</span>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1 flex-1">
                {docSections.map((sec) => {
                  const Icon = sec.icon;
                  const isActive = activeSection === sec.id;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => handleSelectSection(sec.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium rounded-lg text-left ${
                        isActive
                          ? "bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? "text-emerald-700" : "text-slate-400"
                        }`}
                      />
                      <span className="truncate">{sec.title}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    setMobileNavOpen(false);
                    navigate("/user");
                  }}
                  className="w-full py-2 bg-[#0F172A] text-white text-xs font-semibold rounded-lg text-center"
                >
                  Open Dashboard
                </button>
              </div>
            </div>
            <div className="flex-1" onClick={() => setMobileNavOpen(false)} />
          </div>
        )}

        {/* ── Primary Documentation Body ────────────────────────────── */}
        <main className="flex-1 min-w-0 max-w-4xl space-y-16 pb-20">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span
              onClick={() => navigate("/")}
              className="hover:text-slate-900 cursor-pointer transition-colors"
            >
              CleanTraffic
            </span>
            <span>/</span>
            <span className="text-slate-900 font-semibold">Developer Documentation</span>
          </div>

          {/* ── SECTION 1: Introduction ─────────────────────────────── */}
          <section id="introduction" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
              <BookOpen className="w-4 h-4" />
              <span>Overview</span>
            </div>
            <h1
              className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight"
              style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}
            >
              CleanTraffic Documentation
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-3xl">
              CleanTraffic is a deterministic, real-time bot detection and traffic intelligence platform designed to protect web applications, marketing funnels, and registration endpoints from automated scrapers, ad click fraud, and unwanted non-human traffic.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
              <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs">
                <div className="font-bold text-xs text-slate-900 mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  What It Solves
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Stops automated web scrapers, click bots draining ad budgets, and credential-stuffing automated scripts.
                </p>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs">
                <div className="font-bold text-xs text-slate-900 mb-1 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-teal-600" />
                  Who It Is For
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Media buyers, application developers, e-commerce stores, and teams requiring high-confidence visitor telemetry.
                </p>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs">
                <div className="font-bold text-xs text-slate-900 mb-1 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-blue-600" />
                  Execution Speed
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Evaluates requests with non-blocking server processing, delivering deterministic decisions in under 30 milliseconds.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION 2: Getting Started ──────────────────────────── */}
          <section id="getting-started" className="scroll-mt-24 space-y-4 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
              <Zap className="w-4 h-4" />
              <span>Getting Started</span>
            </div>
            <h2
              className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight"
              style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
            >
              Quickstart: Account to First Live Traffic
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Setting up CleanTraffic takes less than 3 minutes. Follow these 4 straightforward steps to activate real-time traffic protection:
            </p>

            <div className="space-y-3 pt-2">
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3.5 shadow-2xs">
                <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">Create & Verify Your Account</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Register at <span className="font-mono text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded">/signup</span>. Complete the 6-digit email confirmation code to activate your 7-day trial and unlock API key generation.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3.5 shadow-2xs">
                <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">Configure Your Routing Rules</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    In your dashboard under <strong>Routing</strong>, specify your <strong>Target Destination</strong> (the page genuine human users should reach) and your <strong>Bot Action</strong> (HTTP 404, HTTP 403, or a Fallback Block Page URL).
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3.5 shadow-2xs">
                <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">Download the PHP Integration Package</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Under the <strong>Integration</strong> tab, click <strong>Download ZIP Package</strong> or copy the pre-configured <code className="text-xs bg-slate-100 text-slate-800 px-1 py-0.5 rounded">index.php</code> file containing your authenticated API key.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3.5 shadow-2xs">
                <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  4
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">Deploy & Verify Live Traffic</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Upload the script to your server or campaign directory. Visit the URL in your browser and check the <strong>Overview</strong> tab in your CleanTraffic dashboard to see your visit registered in real time.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── SECTION 3: Installation & Integration ───────────────── */}
          <section id="installation" className="scroll-mt-24 space-y-4 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
              <Code2 className="w-4 h-4" />
              <span>Integration</span>
            </div>
            <h2
              className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight"
              style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
            >
              Installation & Server Deployment
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              CleanTraffic operates with a zero-footprint server integration. It requires no external database drivers or heavy SDK dependencies on your host.
            </p>

            <div className="bg-[#F7FAF8] border border-[#E0E9E4] rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-700" />
                Server Requirements
              </h3>
              <ul className="text-xs text-slate-600 space-y-1 list-disc pl-5">
                <li>PHP 7.4, 8.0, 8.1, 8.2, or 8.3</li>
                <li>cURL extension enabled (<code className="bg-white px-1 py-0.5 rounded border border-slate-200">curl_init</code> support)</li>
                <li>Outbound HTTPS access (TCP Port 443) to connect to the CleanTraffic API endpoint</li>
                <li>Works on cPanel, aaPanel, Plesk, Nginx, Apache, OpenLiteSpeed, Docker, and standard LAMP/LEMP stacks</li>
              </ul>
            </div>

            {/* Deployment Models */}
            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-bold text-slate-900">Supported Deployment Modes</h3>

              {/* Mode 1 */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    Mode A: Campaign & Funnel Redirector (Recommended for Ads)
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">Standalone Directory</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Drop the generated <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">index.php</code> into a specific folder in your web root, such as <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">public_html/promo/index.php</code>.
                </p>
                <div className="bg-[#051C15] border border-[#0F382B] rounded-lg p-3.5 text-xs text-[#C8E0D7] font-mono overflow-x-auto">
                  https://yourdomain.com/promo/ &nbsp;➔ Evaluated in &lt;30ms &nbsp;➔ Human forwarded to Target Page | Bot receives 404/403
                </div>
              </div>

              {/* Mode 2 */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                    Mode B: Existing Application / WordPress Integration
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">Inline Guard</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  To protect an existing script or WordPress registration/login endpoint, include CleanTraffic at the top of your existing PHP file:
                </p>
                <div className="relative bg-[#051C15] border border-[#0F382B] rounded-lg p-3.5 text-xs text-[#C8E0D7] font-mono overflow-x-auto">
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `<?php\n// CleanTraffic Inline Protection\nrequire_once __DIR__ . '/index.php';\n?>`,
                        "php-inline"
                      )
                    }
                    className="absolute top-2.5 right-2.5 p-1 text-slate-400 hover:text-white bg-slate-800/80 rounded border border-slate-700"
                  >
                    {copiedCodeSnippet === "php-inline" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <pre>{`<?php
// Include CleanTraffic inspection before rendering sensitive forms
require_once __DIR__ . '/index.php';
?>`}</pre>
                </div>
              </div>

              {/* Mode C: cPanel, aaPanel & Server Hosts */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                    Mode C: cPanel & aaPanel Deployment Instructions
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">Web Host Guides</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
                    <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-slate-700" />
                      cPanel Deployment Steps
                    </h4>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Log in to your <strong>cPanel</strong> account and open <strong>File Manager</strong>.</li>
                      <li>Navigate to your website root: <code className="bg-white px-1 py-0.2 rounded border">public_html/</code> (for root domain) or create a subfolder (e.g. <code className="bg-white px-1 py-0.2 rounded border">public_html/campaign/</code>).</li>
                      <li>Upload your pre-configured <code className="bg-white px-1 py-0.2 rounded border">index.php</code> downloaded from your CleanTraffic dashboard.</li>
                      <li>Ensure file permissions are set to <code className="bg-white px-1 py-0.2 rounded border">0644</code>.</li>
                    </ol>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
                    <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-slate-700" />
                      aaPanel Deployment Steps
                    </h4>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Log in to <strong>aaPanel</strong> and click <strong>Website</strong> from the left sidebar.</li>
                      <li>Click the site's directory path link (typically <code className="bg-white px-1 py-0.2 rounded border">/www/wwwroot/yourdomain.com</code>).</li>
                      <li>Upload your customized <code className="bg-white px-1 py-0.2 rounded border">index.php</code> into the root or target campaign folder.</li>
                      <li>In site settings, verify PHP-curl is enabled under PHP Extensions.</li>
                    </ol>
                  </div>
                </div>

                <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-3 text-xs text-[#166534] space-y-1">
                  <span className="font-bold">Securing Naked Root Domain vs. Campaign Page:</span>
                  <p className="leading-relaxed">
                    If you place <code className="bg-white px-1 py-0.5 rounded border border-[#BBF7D0] font-mono">index.php</code> in your root (<code className="bg-white px-1 py-0.5 rounded border border-[#BBF7D0] font-mono">public_html/index.php</code>), every visitor hitting <code className="font-mono">https://domain.com</code> or <code className="font-mono">https://domain.com/</code> is evaluated at the front door before your page renders. If you only want to protect a specific marketing path (e.g. <code className="font-mono">/promo</code> or <code className="font-mono">/signup</code>), create that directory and place the script inside it.
                  </p>
                </div>
              </div>
            </div>

            {/* Verification Steps */}
            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-bold text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                How to Verify That Integration Is Working
              </h3>
              <ul className="text-xs text-emerald-950 space-y-1.5 pl-5 list-disc leading-relaxed">
                <li>
                  <strong>Check your Dashboard Overview:</strong> Open your dashboard at <span className="font-mono">/user</span> and refresh your integrated page. The <em>Total Evaluated</em> counter and live event stream will immediately log your visit.
                </li>
                <li>
                  <strong>Diagnostic Parameter:</strong> Append <code className="bg-white px-1 rounded font-mono">?nocache=1</code> to your URL to bypass session caching and trigger an immediate fresh API lookup.
                </li>
                <li>
                  <strong>Inspect Server Response Headers:</strong> CleanTraffic emits standard HTTP response headers indicating whether the evaluation was served from cache or live API.
                </li>
              </ul>
            </div>
          </section>

          {/* ── SECTION 4: Bot Detection ────────────────────────────── */}
          <section id="bot-detection" className="scroll-mt-24 space-y-4 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
              <Cpu className="w-4 h-4" />
              <span>Detection Engine</span>
            </div>
            <h2
              className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight"
              style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
            >
              Multi-Layer Bot & Threat Detection
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              CleanTraffic applies a cascading, deterministic evaluation pipeline across network, header, and behavioral signatures rather than relying on disruptive CAPTCHAs.
            </p>

            <div className="space-y-3 pt-2">
              <div className="border border-slate-200 bg-white rounded-xl p-4 space-y-1 shadow-2xs">
                <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                  <span>1. Known Crawler & Scraper User-Agent Signatures</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-mono">Tier 1</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Identifies automated scraping frameworks including Puppeteer, Selenium, Playwright, HeadlessChrome, Scrapy, curl, python-requests, and automated vulnerability scanners.
                </p>
              </div>

              <div className="border border-slate-200 bg-white rounded-xl p-4 space-y-1 shadow-2xs">
                <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                  <span>2. Request Velocity Anomaly Detection</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-mono">Tier 1B</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Monitors per-IP hit velocity. High-frequency automated bursts (5 or more requests within 10 seconds) are flagged and throttled with clean HTTP 429 Too Many Requests responses.
                </p>
              </div>

              <div className="border border-slate-200 bg-white rounded-xl p-4 space-y-1 shadow-2xs">
                <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                  <span>3. HTTP Header Integrity & Synthetic Browser Checks</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-mono">Tier 2</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Analyzes missing or synthetically generated HTTP headers (e.g. missing <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">Accept-Language</code> or spoofed browser signatures).
                </p>
              </div>

              <div className="border border-slate-200 bg-white rounded-xl p-4 space-y-1 shadow-2xs">
                <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                  <span>4. Datacenter Cloud ASN & Hosting Facility Pre-Screening</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-mono">Tier 3</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Detects traffic originating from AWS, DigitalOcean, Hetzner, Linode, OVH, Google Cloud, and other hosting centers where real human users do not browse residential web pages.
                </p>
              </div>

              <div className="border border-slate-200 bg-white rounded-xl p-4 space-y-1 shadow-2xs">
                <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                  <span>5. VPN, Residential Proxy & Tor Exit Node Inspection</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-mono">Tier 3E</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Queries real-time network intelligence to flag commercial VPN relays, residential proxy pool IP addresses, and Tor onion exit relays.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION 5: Search, AI & Web Crawlers ──────────────── */}
          <section id="crawlers-seo" className="scroll-mt-24 space-y-4 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-700 uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Crawler Governance</span>
            </div>
            <h2
              className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight"
              style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
            >
              Search Engine, AI Scraper & Social Crawler Management
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Not all automated traffic is malicious. A major risk of blunt bot blockers is that they inadvertently block Googlebot (destroying SEO search rankings) or block WhatsApp and Facebook (breaking social share link previews). CleanTraffic separates crawler categories so you have granular control over each.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* Category 1 */}
              <div className="bg-white border border-slate-200 rounded-xl p-4.5 space-y-2.5 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
                  <Search className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">1. Verified Search Engine Spiders</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Includes Googlebot, Bingbot, Applebot, Baidu, Yandex, and DuckDuckBot.
                </p>
                <div className="bg-emerald-50/70 border border-emerald-200 text-emerald-950 p-2.5 rounded-lg text-[11px] leading-relaxed">
                  <strong>SEO Safe Bypass:</strong> When permitted, search crawlers bypass Tier 2 (device filters) and Tier 3 (geo-fencing) so your organic indexing is never penalized.
                </div>
              </div>

              {/* Category 2 */}
              <div className="bg-white border border-slate-200 rounded-xl p-4.5 space-y-2.5 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">2. AI & LLM Training Harvesters</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Includes OpenAI (GPTBot, ChatGPT-User), Anthropic (ClaudeBot), Common Crawl (CCBot), Perplexity, and ByteDance (Bytespider).
                </p>
                <div className="bg-purple-50/70 border border-purple-200 text-purple-950 p-2.5 rounded-lg text-[11px] leading-relaxed">
                  <strong>IP Protection:</strong> Prevents AI models from crawling and consuming your copyrighted copy, high-converting offer angles, and server bandwidth without attribution.
                </div>
              </div>

              {/* Category 3 */}
              <div className="bg-white border border-slate-200 rounded-xl p-4.5 space-y-2.5 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center">
                  <Share2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">3. Social Link Preview Fetchers</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Includes Facebook External Hit, Twitterbot / X, WhatsApp, Telegram, LinkedIn, Pinterest, and Slack.
                </p>
                <div className="bg-blue-50/70 border border-blue-200 text-blue-950 p-2.5 rounded-lg text-[11px] leading-relaxed">
                  <strong>Rich Open Graph Cards:</strong> Allows platforms to read your <code className="bg-white px-1 py-0.2 rounded border font-mono">&lt;meta og:title&gt;</code> tags so shares display rich visual thumbnails and titles.
                </div>
              </div>
            </div>

            {/* Explanatory Note on Bad Bots */}
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-4 space-y-1.5 text-xs text-slate-700">
              <span className="font-bold text-slate-900">Where do Bad Bots go?</span>
              <p className="leading-relaxed">
                Malicious scrapers, automated vulnerability scanners, credential stuffers, and ad click bots do NOT belong to any of these three allowed categories. They are immediately intercepted by CleanTraffic's behavioral and network heuristics and routed to your configured Bot Mitigation Action (HTTP 404, HTTP 403, or Safe Fallback URL).
              </p>
            </div>
          </section>

          {/* ── SECTION 6: Traffic & Visitor Intelligence ───────────── */}
          <section id="visitor-intelligence" className="scroll-mt-24 space-y-4 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
              <Globe className="w-4 h-4" />
              <span>Visitor Telemetry</span>
            </div>
            <h2
              className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight"
              style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
            >
              Visitor Telemetry & Audit Logs
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Every request evaluated by CleanTraffic produces structured diagnostic telemetry. You can click on any visitor entry in the dashboard to open the detailed visitor audit drawer.
            </p>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 font-bold text-xs text-slate-700">
                Extracted Visitor Attributes Available in Telemetry
              </div>
              <div className="p-4 bg-white grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="font-bold text-slate-900">Network IP & Geolocation:</span>
                  <p className="text-slate-600 mt-0.5">Public IPv4/IPv6, Country, ISO Country Code, City, Region name.</p>
                </div>
                <div>
                  <span className="font-bold text-slate-900">ISP & Autonomous System (ASN):</span>
                  <p className="text-slate-600 mt-0.5">ISP Organization Name, ASN Number, and Network Usage Type (Residential vs DCH).</p>
                </div>
                <div>
                  <span className="font-bold text-slate-900">Device & Platform:</span>
                  <p className="text-slate-600 mt-0.5">Device Type (Desktop, Mobile, Tablet), Operating System, and Browser Family.</p>
                </div>
                <div>
                  <span className="font-bold text-slate-900">Classification Verdict & Reason:</span>
                  <p className="text-slate-600 mt-0.5">Visitor Type (Human vs Bot), Action Taken (Allowed vs Blocked), and specific Triggering Condition.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── SECTION 6: Dashboard & Analytics ────────────────────── */}
          <section id="dashboard" className="scroll-mt-24 space-y-4 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
              <BarChart3 className="w-4 h-4" />
              <span>Dashboard</span>
            </div>
            <h2
              className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight"
              style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
            >
              Understanding Dashboard Analytics
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              The CleanTraffic client portal provides live, continuous feedback on your incoming traffic health:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-1">
                <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Human Visitors Allowed
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Real users on residential or mobile carrier networks who passed your country, device, and threat filtering rules.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-1">
                <div className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  Bots & Scrapers Mitigated
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Automated scripts, crawlers, and headless browsers that triggered signature rules or velocity limits.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-1">
                <div className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  VPN & Proxies Flagged
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Visitors masking their network identity via commercial VPN nodes, proxy networks, or Tor exit relays.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-1">
                <div className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4 text-blue-600" />
                  Live Event Stream
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Real-time Server-Sent Events (SSE) pipe displaying visitor decisions as they happen without manual page refreshes.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION 7: Configuration & Routing Policies ─────────── */}
          <section id="configuration" className="scroll-mt-24 space-y-4 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
              <Sliders className="w-4 h-4" />
              <span>Configuration</span>
            </div>
            <h2
              className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight"
              style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
            >
              Routing & Threat Mitigation Policies
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              All routing policies are managed centrally from your dashboard. Changes apply across all your integrated servers immediately with zero script edits or server restarts.
            </p>

            <div className="space-y-3 pt-2">
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Target Destination URL (Human Visitors)
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The primary URL where verified human traffic is routed. Query strings and UTM tracking parameters are automatically preserved and forwarded.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  Bot & Threat Mitigation Action
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Choose how non-human visitors or filtered traffic is handled:
                </p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc pl-5">
                  <li><strong>HTTP 404:</strong> Responds with a standard 404 Not Found error.</li>
                  <li><strong>HTTP 403:</strong> Responds with a clean 403 Forbidden message.</li>
                  <li><strong>Fallback URL:</strong> Redirects automated traffic to a safe block page or alternative destination.</li>
                </ul>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Granular Traffic Filters
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                  <div><strong>Allowed Countries:</strong> Comma-separated ISO codes (e.g. US, CA, GB) or ALL.</div>
                  <div><strong>Device Type:</strong> Filter by Desktop Only, Mobile Only, or All Devices.</div>
                  <div><strong>Desktop OS:</strong> Allow Windows only, macOS only, or Both.</div>
                  <div><strong>VPN & Proxy Policy:</strong> Toggle to Block or Allow identified VPNs/proxies.</div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  Crawler & Bot Governance Policies
                </h3>
                <div className="space-y-1.5 text-xs text-slate-600 pt-1">
                  <div><strong>Allow Search Engine Indexers:</strong> Permits Googlebot, Bingbot, Yandex, and Applebot to index your public content without obstruction. Automatically exempts them from country and device filters.</div>
                  <div><strong>Block AI & LLM Training Scrapers:</strong> Intercepts and mitigates OpenAI, Anthropic, Common Crawl, and ByteDance crawlers from scraping your content.</div>
                  <div><strong>Allow Social Media Previews:</strong> Permits WhatsApp, Facebook, Twitter/X, and LinkedIn bots to fetch link preview metadata for seamless sharing.</div>
                </div>
              </div>
            </div>
          </section>

          {/* ── SECTION 8: API / Developer Reference ─────────────────── */}
          <section id="api-reference" className="scroll-mt-24 space-y-4 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
              <Terminal className="w-4 h-4" />
              <span>Developers</span>
            </div>
            <h2
              className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight"
              style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
            >
              REST API & Developer Reference
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              If you are building a custom backend in Node.js, Python, Go, or Ruby, you can interact directly with the CleanTraffic classification endpoint.
            </p>

            <div className="space-y-4 pt-2">
              <div className="bg-slate-900 text-white rounded-xl p-4 font-mono text-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <span className="bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 text-[11px]">POST</span>
                  <span>/api/classify</span>
                </div>
                <div className="text-slate-400 text-[11px]">
                  Evaluates a visitor IP and HTTP header payload against your account's active policy rules.
                </div>
              </div>

              {/* Request Example */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Example Request (cURL)</span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `curl -X POST "https://your-domain.com/api/classify" \\\n  -H "X-API-Key: ctc_your_api_key_here" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "ip": "203.0.113.195",\n    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...",\n    "acceptLanguage": "en-US,en;q=0.9"\n  }'`,
                        "curl-req"
                      )
                    }
                    className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-900"
                  >
                    {copiedCodeSnippet === "curl-req" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedCodeSnippet === "curl-req" ? "Copied" : "Copy cURL"}</span>
                  </button>
                </div>
                <div className="bg-[#051C15] border border-[#0F382B] rounded-lg p-3.5 text-xs text-[#C8E0D7] font-mono overflow-x-auto">
                  <pre>{`curl -X POST "https://your-domain.com/api/classify" \\
  -H "X-API-Key: ctc_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "ip": "203.0.113.195",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...",
    "acceptLanguage": "en-US,en;q=0.9"
  }'`}</pre>
                </div>
              </div>

              {/* Response Example */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-slate-700">Example Response (JSON)</div>
                <div className="bg-[#051C15] border border-[#0F382B] rounded-lg p-3.5 text-xs text-[#C8E0D7] font-mono overflow-x-auto">
                  <pre>{`{
  "ip": "203.0.113.195",
  "visitorType": "Human",
  "isHuman": true,
  "action": "Allowed",
  "statusAction": "redirect",
  "statusCode": 200,
  "redirectUrl": "https://yourdomain.com/target-destination",
  "detection_method": "IP Analysis",
  "block_reason": null,
  "country": "United States",
  "countryCode": "US",
  "city": "Austin",
  "device_type": "desktop",
  "browser": "Chrome 124.0.0",
  "isp": "Spectrum Broadband"
}`}</pre>
                </div>
              </div>
            </div>
          </section>

          {/* ── SECTION 9: Security & Privacy ───────────────────────── */}
          <section id="security-privacy" className="scroll-mt-24 space-y-4 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
              <Lock className="w-4 h-4" />
              <span>Security & Privacy</span>
            </div>
            <h2
              className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight"
              style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
            >
              Data Privacy & Security Safeguards
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              CleanTraffic is built on privacy-first security principles:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs text-slate-600">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-1.5">
                <h3 className="font-bold text-slate-900">No Invasive User Profiling</h3>
                <p className="leading-relaxed">
                  We do not drop cross-site tracking cookies, inspect browsing history, or build persistent identity profiles across unrelated websites.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-1.5">
                <h3 className="font-bold text-slate-900">Transient Network Evaluation</h3>
                <p className="leading-relaxed">
                  Inspection happens synchronously using standard network layer signals (IP, ASN, User-Agent, and standard HTTP headers).
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-1.5">
                <h3 className="font-bold text-slate-900">Encrypted Transport</h3>
                <p className="leading-relaxed">
                  All communication between your server and the CleanTraffic API occurs over TLS 1.3 encrypted channels.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-1.5">
                <h3 className="font-bold text-slate-900">Account Isolation</h3>
                <p className="leading-relaxed">
                  Your API keys, visitor telemetry, and routing rules are strictly sandboxed to your account ID and inaccessible to any other user.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION 10: Troubleshooting ─────────────────────────── */}
          <section id="troubleshooting" className="scroll-mt-24 space-y-4 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
              <AlertCircle className="w-4 h-4" />
              <span>Troubleshooting</span>
            </div>
            <h2
              className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight"
              style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
            >
              Troubleshooting Common Issues
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              If your traffic isn't appearing or you encounter unexpected behavior, follow these diagnostics:
            </p>

            <div className="space-y-3 pt-2">
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-900">1. "No traffic appearing in my Overview tab"</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Check that your server has PHP cURL installed by creating a test file with <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">&lt;?php phpinfo(); ?&gt;</code>. Also verify that outbound firewall rules allow HTTPS traffic on port 443 to the CleanTraffic host.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-900">2. "I updated my Target URL in the dashboard, but visitors still see the old URL"</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  By default, the PHP script caches decisions in the visitor's PHP session for performance. Add <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">?nocache=1</code> to your URL or test in a Private/Incognito browser window.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-900">3. "API returned 401 Unauthorized"</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Ensure your API key is correctly pasted in <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">$apiKey</code> inside <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">index.php</code> without leading or trailing whitespace.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-900">4. "API returned 403 API_KEY_EXPIRED"</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your 7-day trial has concluded or your subscription renewal is pending. Visit the <strong>Billing</strong> tab in your dashboard to upgrade or renew your plan.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION 11: Boundaries & What We Don't Do ────────────── */}
          <section id="boundaries" className="scroll-mt-24 space-y-4 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-700 uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4" />
              <span>Platform Boundaries</span>
            </div>
            <h2
              className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight"
              style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
            >
              Platform Scope & What We Do Not Do
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              To maintain integrity, trust, and enterprise compliance, CleanTraffic operates strictly within the scope of legitimate application security and traffic intelligence:
            </p>

            <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-4 space-y-2 text-xs text-rose-950">
              <ul className="space-y-1.5 list-disc pl-5 leading-relaxed">
                <li>
                  <strong>We do NOT provide traffic cloaking or evasion systems:</strong> CleanTraffic is built for defensive visitor classification, ad spend protection, and scraper mitigation. We do not provide tools designed to bypass third-party ad network policies or evade security auditing.
                </li>
                <li>
                  <strong>We do NOT claim 100% absolute certainty:</strong> While our multi-tier heuristics intercept automated scrapers and high-risk proxies, sophisticated residential human-mimicking networks evolve continuously. We continuously update our ASN and signature databases to maximize accuracy.
                </li>
                <li>
                  <strong>We do NOT intercept encrypted payload contents:</strong> We analyze network headers and connection traits; we never inspect sensitive form inputs or encrypted request bodies.
                </li>
              </ul>
            </div>
          </section>

          {/* ── SECTION 12: Frequently Asked Questions (FAQ) ─────────── */}
          <section id="faq" className="scroll-mt-24 space-y-4 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
              <HelpCircle className="w-4 h-4" />
              <span>FAQ</span>
            </div>
            <h2
              className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight"
              style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
            >
              Frequently Asked Questions
            </h2>

            <div className="space-y-3 pt-2">
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-900">Does CleanTraffic add noticeable latency to my site?</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  No. The classification API response averages between 15ms and 30ms. Furthermore, once an authentic human visitor is validated, the PHP script caches the positive verdict in session storage for zero-latency subsequent pageviews.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-900">Will Google Search or Bing be blocked from indexing my site?</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Legitimate search engine crawlers (Googlebot, Bingbot, DuckDuckBot) are identified through verified User-Agent signatures and ASN heuristics. When you choose to permit search indexers, they can crawl public endpoints without restriction.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-900">Can I deploy the same script on multiple domains?</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Yes. Your API key can be deployed across unlimited tracking domains, landing pages, or server clusters. They will all communicate with your centralized CleanTraffic dashboard rules.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-900">What happens if my API call limit is reached?</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  If your monthly plan or trial quota is exhausted, the API responds with a quota limit status. You will receive notification banners in your dashboard with an immediate option to upgrade your plan.
                </p>
              </div>
            </div>
          </section>

          {/* Bottom Next Steps Bar */}
          <div className="bg-[#051C15] border border-[#0F382B] rounded-2xl p-6 sm:p-8 text-white space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3
                  className="text-lg sm:text-xl font-bold text-white tracking-tight"
                  style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
                >
                  Start Protecting Your Traffic Today
                </h3>
                <p className="text-xs sm:text-sm text-[#94CBB7] max-w-xl leading-relaxed">
                  Log in to your account, grab your pre-configured PHP integration script, and inspect your real-time visitor telemetry.
                </p>
              </div>

              <button
                onClick={() => navigate("/user")}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <span>Launch Client Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
