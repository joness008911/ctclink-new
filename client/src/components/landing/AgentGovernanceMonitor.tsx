import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Copy,
  Check,
  Bot,
  Terminal,
  Globe,
  Lock,
  UserCheck,
  Fingerprint,
  Play,
  Pause,
  RefreshCw,
  Plus,
  Sliders,
  Filter,
  Layers,
  Cpu,
  Activity,
  ArrowUpRight,
} from "lucide-react";

export interface TelemetryEvent {
  id: string;
  timestamp: string;
  sourceName: string;
  provider: string;
  originIp: string;
  asn: string;
  declaredCategory: "ai_agent" | "bad_bot" | "human" | "crawler";
  verdict: "verified_agent" | "deflected" | "human_allowed" | "crawler_allowed";
  actionTaken: "Scoped Policy Enforced" | "Deflected to 404" | "Standard Routing" | "Rate Limited";
  threatScore: number;
  jwsStatus: "valid" | "missing" | "invalid_signature";
  runtimeCheck: "clean" | "webdriver_detected" | "canvas_anomalous";
  latencyMs: number;
  allowedRoutes: string[];
  restrictedRoutes: string[];
  ja4Fingerprint: string;
}

let globalEventCounter = 3000;
function createUniqueEventId(prefix = "evt"): string {
  globalEventCounter += 1;
  return `${prefix}-${Date.now()}-${globalEventCounter}-${Math.random().toString(36).substring(2, 7)}`;
}

const INITIAL_EVENTS: TelemetryEvent[] = [
  {
    id: "evt-1091",
    timestamp: "Just now",
    sourceName: "OpenAI Operator",
    provider: "OpenAI Inc.",
    originIp: "23.98.142.66",
    asn: "AS8075 (Microsoft Corp)",
    declaredCategory: "ai_agent",
    verdict: "verified_agent",
    actionTaken: "Scoped Policy Enforced",
    threatScore: 2,
    jwsStatus: "valid",
    runtimeCheck: "clean",
    latencyMs: 0.38,
    allowedRoutes: ["/api/v1/catalog", "/products", "/search", "/docs"],
    restrictedRoutes: ["/admin", "/auth/*", "/checkout/pay", "/api/user/*"],
    ja4Fingerprint: "t13d1516h2_8daaf6152771_0182ec290518",
  },
  {
    id: "evt-1090",
    timestamp: "3s ago",
    sourceName: "Puppeteer Stealth Scraper",
    provider: "Unknown / Residential Node",
    originIp: "185.220.101.5",
    asn: "AS44558 (Residential Pool)",
    declaredCategory: "bad_bot",
    verdict: "deflected",
    actionTaken: "Deflected to 404",
    threatScore: 97,
    jwsStatus: "missing",
    runtimeCheck: "webdriver_detected",
    latencyMs: 0.42,
    allowedRoutes: [],
    restrictedRoutes: ["/*"],
    ja4Fingerprint: "t13d190800_b219cf921509_38a9d109f001",
  },
  {
    id: "evt-1089",
    timestamp: "7s ago",
    sourceName: "Anthropic Assistant (Claude)",
    provider: "Anthropic PBC",
    originIp: "160.79.104.12",
    asn: "AS396982 (Google Cloud)",
    declaredCategory: "ai_agent",
    verdict: "verified_agent",
    actionTaken: "Scoped Policy Enforced",
    threatScore: 0,
    jwsStatus: "valid",
    runtimeCheck: "clean",
    latencyMs: 0.35,
    allowedRoutes: ["/api/v1/catalog", "/products", "/docs", "/faq"],
    restrictedRoutes: ["/checkout/*", "/billing", "/api/user/*"],
    ja4Fingerprint: "t13d1516h2_7baac5129901_1092eb391200",
  },
  {
    id: "evt-1088",
    timestamp: "11s ago",
    sourceName: "Legitimate Shopper (Safari)",
    provider: "Consumer ISP",
    originIp: "73.189.44.112",
    asn: "AS7922 (Comcast Cable)",
    declaredCategory: "human",
    verdict: "human_allowed",
    actionTaken: "Standard Routing",
    threatScore: 1,
    jwsStatus: "missing",
    runtimeCheck: "clean",
    latencyMs: 0.29,
    allowedRoutes: ["/*"],
    restrictedRoutes: [],
    ja4Fingerprint: "t13d311200_1289cf009210_55b8e901a120",
  },
  {
    id: "evt-1087",
    timestamp: "15s ago",
    sourceName: "Perplexity Citation Indexer",
    provider: "Perplexity AI",
    originIp: "192.241.220.19",
    asn: "AS14061 (DigitalOcean)",
    declaredCategory: "crawler",
    verdict: "crawler_allowed",
    actionTaken: "Rate Limited",
    threatScore: 8,
    jwsStatus: "valid",
    runtimeCheck: "clean",
    latencyMs: 0.44,
    allowedRoutes: ["/articles/*", "/products", "/sitemap.xml"],
    restrictedRoutes: ["/api/*", "/account/*", "/cart"],
    ja4Fingerprint: "t13d1516h2_4490ef118277_9921bc440911",
  },
  {
    id: "evt-1086",
    timestamp: "20s ago",
    sourceName: "Headless Chrome Credential Bot",
    provider: "Datacenter Proxy",
    originIp: "45.142.214.90",
    asn: "AS51852 (Hosting Solutions)",
    declaredCategory: "bad_bot",
    verdict: "deflected",
    actionTaken: "Deflected to 404",
    threatScore: 99,
    jwsStatus: "invalid_signature",
    runtimeCheck: "canvas_anomalous",
    latencyMs: 0.41,
    allowedRoutes: [],
    restrictedRoutes: ["/*"],
    ja4Fingerprint: "t13d190800_aa81de339012_7120fc882310",
  },
];

interface Props {
  isStandalonePage?: boolean;
}

export function AgentGovernanceMonitor({ isStandalonePage = false }: Props) {
  const [, navigate] = useLocation();

  // State management for live simulation
  const [isStreaming, setIsStreaming] = useState(true);
  const [events, setEvents] = useState<TelemetryEvent[]>(INITIAL_EVENTS);
  const [selectedEventId, setSelectedEventId] = useState<string>(INITIAL_EVENTS[0].id);
  const [activeFilter, setActiveFilter] = useState<"all" | "ai_agent" | "bad_bot" | "crawler" | "human">("all");
  const [activeInspectorTab, setActiveInspectorTab] = useState<"verdict" | "crypto" | "json">("verdict");
  const [copied, setCopied] = useState(false);

  // Policy Sandbox Toggles
  const [policyJwsRequired, setPolicyJwsRequired] = useState(true);
  const [policyRouteScoping, setPolicyRouteScoping] = useState(true);
  const [policyDropHeadless, setPolicyDropHeadless] = useState(true);

  // Dynamic Telemetry Metrics
  const [metrics, setMetrics] = useState({
    totalProcessed: 142890,
    verifiedAgents: 26305,
    deflectedThreats: 45892,
    avgLatency: 0.39,
  });

  // Real-time sparkline simulation data (16 bars)
  const [sparklineHeights, setSparklineHeights] = useState([
    45, 60, 50, 75, 40, 85, 90, 65, 70, 55, 80, 60, 95, 70, 85, 90,
  ]);

  const selectedEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId) || events[0];
  }, [events, selectedEventId]);

  const filteredEvents = useMemo(() => {
    if (activeFilter === "all") return events;
    return events.filter((e) => e.declaredCategory === activeFilter);
  }, [events, activeFilter]);

  // Periodic natural event stream simulation
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      // Natural variations for traffic stream
      const sampleSources: Array<Omit<TelemetryEvent, "id" | "timestamp">> = [
        {
          sourceName: "OpenAI Operator",
          provider: "OpenAI Inc.",
          originIp: `23.98.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 250)}`,
          asn: "AS8075 (Microsoft Corp)",
          declaredCategory: "ai_agent",
          verdict: policyJwsRequired ? "verified_agent" : "verified_agent",
          actionTaken: policyRouteScoping ? "Scoped Policy Enforced" : "Standard Routing",
          threatScore: 1,
          jwsStatus: "valid",
          runtimeCheck: "clean",
          latencyMs: +(0.32 + Math.random() * 0.12).toFixed(2),
          allowedRoutes: ["/api/v1/catalog", "/products", "/search"],
          restrictedRoutes: ["/admin", "/auth/*", "/checkout/*"],
          ja4Fingerprint: "t13d1516h2_8daaf6152771_0182ec290518",
        },
        {
          sourceName: "Headless Scraper (Playwright)",
          provider: "Residential Proxy",
          originIp: `185.191.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 250)}`,
          asn: "AS49505 (HostRoyale)",
          declaredCategory: "bad_bot",
          verdict: policyDropHeadless ? "deflected" : "deflected",
          actionTaken: "Deflected to 404",
          threatScore: 96,
          jwsStatus: "missing",
          runtimeCheck: "webdriver_detected",
          latencyMs: +(0.38 + Math.random() * 0.15).toFixed(2),
          allowedRoutes: [],
          restrictedRoutes: ["/*"],
          ja4Fingerprint: "t13d190800_b219cf921509_38a9d109f001",
        },
        {
          sourceName: "Anthropic Claude Assistant",
          provider: "Anthropic PBC",
          originIp: `160.79.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 250)}`,
          asn: "AS396982 (Google Cloud)",
          declaredCategory: "ai_agent",
          verdict: "verified_agent",
          actionTaken: policyRouteScoping ? "Scoped Policy Enforced" : "Standard Routing",
          threatScore: 0,
          jwsStatus: "valid",
          runtimeCheck: "clean",
          latencyMs: +(0.31 + Math.random() * 0.1).toFixed(2),
          allowedRoutes: ["/api/v1/catalog", "/products", "/docs"],
          restrictedRoutes: ["/checkout/*", "/billing"],
          ja4Fingerprint: "t13d1516h2_7baac5129901_1092eb391200",
        },
        {
          sourceName: "Direct Consumer (Chrome)",
          provider: "Verizon Fios",
          originIp: `108.45.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 250)}`,
          asn: "AS701 (Verizon)",
          declaredCategory: "human",
          verdict: "human_allowed",
          actionTaken: "Standard Routing",
          threatScore: 0,
          jwsStatus: "missing",
          runtimeCheck: "clean",
          latencyMs: +(0.26 + Math.random() * 0.08).toFixed(2),
          allowedRoutes: ["/*"],
          restrictedRoutes: [],
          ja4Fingerprint: "t13d311200_1289cf009210_55b8e901a120",
        },
      ];

      const chosen = sampleSources[Math.floor(Math.random() * sampleSources.length)];
      const newEvent: TelemetryEvent = {
        ...chosen,
        id: createUniqueEventId(),
        timestamp: "Just now",
      };

      setEvents((prev) => [newEvent, ...prev.slice(0, 7)]);
      setMetrics((prev) => ({
        totalProcessed: prev.totalProcessed + 1,
        verifiedAgents:
          chosen.declaredCategory === "ai_agent"
            ? prev.verifiedAgents + 1
            : prev.verifiedAgents,
        deflectedThreats:
          chosen.declaredCategory === "bad_bot"
            ? prev.deflectedThreats + 1
            : prev.deflectedThreats,
        avgLatency: +(0.36 + Math.random() * 0.08).toFixed(2),
      }));

      setSparklineHeights((prev) => [
        ...prev.slice(1),
        Math.floor(35 + Math.random() * 60),
      ]);
    }, 3600);

    return () => clearInterval(interval);
  }, [isStreaming, policyJwsRequired, policyRouteScoping, policyDropHeadless]);

  // Inject manually triggered test events
  const injectEvent = (type: "agent" | "bad_bot" | "human") => {
    let newEvt: TelemetryEvent;
    if (type === "agent") {
      newEvt = {
        id: createUniqueEventId("agent"),
        timestamp: "Just now",
        sourceName: "Custom Autonomous Operator",
        provider: "OpenAI Partner Verified",
        originIp: "23.98.140.11",
        asn: "AS8075 (Microsoft Azure)",
        declaredCategory: "ai_agent",
        verdict: policyJwsRequired ? "verified_agent" : "verified_agent",
        actionTaken: policyRouteScoping ? "Scoped Policy Enforced" : "Standard Routing",
        threatScore: 0,
        jwsStatus: "valid",
        runtimeCheck: "clean",
        latencyMs: 0.34,
        allowedRoutes: ["/api/v1/catalog", "/products", "/search"],
        restrictedRoutes: ["/admin", "/auth/*", "/checkout/*"],
        ja4Fingerprint: "t13d1516h2_8daaf6152771_0182ec290518",
      };
    } else if (type === "bad_bot") {
      newEvt = {
        id: createUniqueEventId("threat"),
        timestamp: "Just now",
        sourceName: "Residential Proxy Impersonator",
        provider: "Suspicious Pool",
        originIp: "94.102.61.18",
        asn: "AS200019 (Proxy Network)",
        declaredCategory: "bad_bot",
        verdict: "deflected",
        actionTaken: "Deflected to 404",
        threatScore: 98,
        jwsStatus: "invalid_signature",
        runtimeCheck: "webdriver_detected",
        latencyMs: 0.44,
        allowedRoutes: [],
        restrictedRoutes: ["/*"],
        ja4Fingerprint: "t13d190800_b219cf921509_38a9d109f001",
      };
    } else {
      newEvt = {
        id: createUniqueEventId("human"),
        timestamp: "Just now",
        sourceName: "Verified Human Visitor",
        provider: "AT&T Internet",
        originIp: "99.124.50.8",
        asn: "AS7018 (AT&T Services)",
        declaredCategory: "human",
        verdict: "human_allowed",
        actionTaken: "Standard Routing",
        threatScore: 0,
        jwsStatus: "missing",
        runtimeCheck: "clean",
        latencyMs: 0.28,
        allowedRoutes: ["/*"],
        restrictedRoutes: [],
        ja4Fingerprint: "t13d311200_1289cf009210_55b8e901a120",
      };
    }

    setEvents((prev) => [newEvt, ...prev.slice(0, 7)]);
    setSelectedEventId(newEvt.id);
    setMetrics((prev) => ({
      ...prev,
      totalProcessed: prev.totalProcessed + 1,
    }));
  };

  const handleCopyJson = () => {
    const payload = {
      event_id: selectedEvent.id,
      timestamp: new Date().toISOString(),
      edge_node: "iad-01.cleantraffic.net",
      visitor: {
        source_name: selectedEvent.sourceName,
        declared_provider: selectedEvent.provider,
        ip: selectedEvent.originIp,
        asn: selectedEvent.asn,
        ja4_fingerprint: selectedEvent.ja4Fingerprint,
      },
      evaluation: {
        classification: selectedEvent.declaredCategory,
        verdict: selectedEvent.verdict,
        threat_score: selectedEvent.threatScore,
        latency_ms: selectedEvent.latencyMs,
        cryptographic_attestation: {
          jws_signature: selectedEvent.jwsStatus,
          runtime_tamper_flag: selectedEvent.runtimeCheck,
        },
        route_governance: {
          action: selectedEvent.actionTaken,
          permitted_paths: selectedEvent.allowedRoutes,
          restricted_paths: selectedEvent.restrictedRoutes,
        },
      },
    };

    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      id="ai-agent-governance"
      className="w-full bg-[#FAFAF9] py-16 sm:py-24 border-b border-slate-200/80 overflow-hidden"
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ── Section Header in CleanTraffic Voice ───────────────────────── */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/90 mb-4 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span className="uppercase tracking-wider text-[11px] font-bold">
              Autonomous Agent Governance
            </span>
          </div>

          <h2
            className="text-3xl sm:text-4xl md:text-[2.75rem] font-bold text-slate-900 tracking-tight leading-[1.15] mb-4"
            style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}
          >
            Govern Autonomous AI Traffic. <br className="hidden sm:inline" />
            Neutralize Stealth Impersonation.
          </h2>

          <p className="text-slate-600 text-sm sm:text-base md:text-lg leading-relaxed mb-7 max-w-2xl mx-auto">
            Give engineering and security teams cryptographic visibility into the agentic web.
            Authorize certified AI operators with strict route policies while deflecting headless scrapers and credential stuffing at the edge.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate("/user")}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#0F172A] hover:bg-black text-white font-semibold rounded-full text-sm shadow-xs hover:shadow transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer"
            >
              <span>Get Started Free</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            {!isStandalonePage && (
              <button
                onClick={() => navigate("/use-cases/ai-agents")}
                className="w-full sm:w-auto px-6 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-full text-sm border border-slate-300 shadow-2xs transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Explore Technical Architecture</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>
        </div>

        {/* ── Real Interactive Monitoring Console ────────────────────────── */}
        <div className="w-full bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[0_20px_50px_-15px_rgba(15,23,42,0.07)] overflow-hidden mb-16">
          {/* Console Header Bar */}
          <div className="px-4 sm:px-6 py-3.5 bg-[#F8FAFC] border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs sm:text-sm font-semibold text-slate-800 tracking-tight font-mono">
                CleanTraffic Edge Telemetry Stream
              </span>
              <span className="hidden sm:inline-block text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                node: us-east-iad1
              </span>
            </div>

            {/* Live streaming status & Controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono font-medium">
                <span
                  className={`w-2 h-2 rounded-full bg-emerald-500 ${
                    isStreaming ? "animate-pulse" : "opacity-40"
                  }`}
                />
                <span>{isStreaming ? "STREAMING" : "PAUSED"}</span>
              </div>

              <button
                onClick={() => setIsStreaming(!isStreaming)}
                className="p-1.5 rounded-md hover:bg-slate-200/70 text-slate-600 transition-colors cursor-pointer"
                title={isStreaming ? "Pause stream" : "Resume stream"}
                aria-label={isStreaming ? "Pause stream" : "Resume stream"}
              >
                {isStreaming ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>

              <div className="h-4 w-px bg-slate-200" />

              {/* Quick Injection Triggers */}
              <div className="hidden lg:flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium mr-1">Inject:</span>
                <button
                  onClick={() => injectEvent("agent")}
                  className="px-2 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors cursor-pointer"
                >
                  + AI Agent
                </button>
                <button
                  onClick={() => injectEvent("bad_bot")}
                  className="px-2 py-0.5 text-[11px] font-medium bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded transition-colors cursor-pointer"
                >
                  + Scraper
                </button>
                <button
                  onClick={() => injectEvent("human")}
                  className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded transition-colors cursor-pointer"
                >
                  + Human
                </button>
              </div>
            </div>
          </div>

          {/* Metric Overview Ribbon */}
          <div className="grid grid-cols-2 md:grid-cols-4 border-b border-slate-200 divide-x divide-slate-100 sm:divide-slate-200 bg-white">
            <div className="p-4 sm:p-5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                24H Requests Inspected
              </span>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tracking-tight">
                {metrics.totalProcessed.toLocaleString()}
              </div>
              <span className="text-[11px] text-emerald-700 font-medium">99.998% SLA accuracy</span>
            </div>

            <div className="p-4 sm:p-5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Verified AI Operators
              </span>
              <div className="text-xl sm:text-2xl font-bold text-emerald-700 font-mono tracking-tight flex items-center gap-1.5">
                <span>{metrics.verifiedAgents.toLocaleString()}</span>
                <span className="text-xs font-normal text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  18.4%
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Policy scoped at edge</span>
            </div>

            <div className="p-4 sm:p-5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Deflected Impersonators
              </span>
              <div className="text-xl sm:text-2xl font-bold text-rose-600 font-mono tracking-tight flex items-center gap-1.5">
                <span>{metrics.deflectedThreats.toLocaleString()}</span>
                <span className="text-xs font-normal text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                  32.1%
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Zero app server impact</span>
            </div>

            <div className="p-4 sm:p-5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Edge Verification Latency
              </span>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tracking-tight flex items-center gap-2">
                <span>{metrics.avgLatency}ms</span>
                {/* Mini real-time activity sparkline */}
                <div className="flex items-end gap-0.5 h-5 ml-auto">
                  {sparklineHeights.slice(-10).map((h, i) => (
                    <div
                      key={`spark-${i}`}
                      style={{ height: `${Math.max(15, h)}%` }}
                      className="w-1 bg-emerald-500/70 rounded-xs transition-all duration-300"
                    />
                  ))}
                </div>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Cryptographic JWS test</span>
            </div>
          </div>

          {/* Master-Detail Traffic Console Body */}
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
            {/* Left Column: Real-time Traffic Event Stream */}
            <div className="lg:col-span-6 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col bg-[#FAFBFD]">
              {/* Category Filter Pills */}
              <div className="p-3 sm:p-4 border-b border-slate-200/80 bg-white flex items-center justify-between gap-2 overflow-x-auto">
                <div className="flex items-center gap-1 text-xs">
                  {(
                    [
                      { key: "all", label: "All Traffic" },
                      { key: "ai_agent", label: "AI Agents" },
                      { key: "bad_bot", label: "Scrapers" },
                      { key: "human", label: "Humans" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveFilter(tab.key)}
                      className={`px-2.5 py-1 rounded-md font-medium text-xs whitespace-nowrap transition-colors cursor-pointer ${
                        activeFilter === tab.key
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-slate-400 hidden sm:inline font-mono">
                  {filteredEvents.length} events
                </span>
              </div>

              {/* Event Table Rows */}
              <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[440px]">
                {filteredEvents.map((item) => {
                  const isSelected = selectedEventId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedEventId(item.id)}
                      className={`p-3.5 sm:p-4 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-white shadow-xs border-l-4 border-l-emerald-600"
                          : "hover:bg-white/80"
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                            item.verdict === "verified_agent"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : item.verdict === "deflected"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {item.verdict === "verified_agent" && <Sparkles className="w-3.5 h-3.5" />}
                          {item.verdict === "deflected" && <XCircle className="w-3.5 h-3.5" />}
                          {item.verdict === "human_allowed" && <UserCheck className="w-3.5 h-3.5" />}
                          {item.verdict === "crawler_allowed" && <Globe className="w-3.5 h-3.5" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                              {item.sourceName}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                              {item.timestamp}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 truncate">
                            {item.originIp} • {item.asn}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`inline-block text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full border ${
                            item.verdict === "verified_agent"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : item.verdict === "deflected"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {item.verdict === "verified_agent"
                            ? "VERIFIED AGENT"
                            : item.verdict === "deflected"
                            ? "DEFLECTED (404)"
                            : "ALLOWED"}
                        </span>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          {item.latencyMs}ms
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Deep Forensic & Policy Inspector */}
            <div className="lg:col-span-6 p-4 sm:p-6 bg-white flex flex-col justify-between">
              <div>
                {/* Inspector Header & Tab Navigation */}
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                      Inspection: {selectedEvent.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md text-[11px]">
                    <button
                      onClick={() => setActiveInspectorTab("verdict")}
                      className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                        activeInspectorTab === "verdict"
                          ? "bg-white text-slate-900 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Policy Verdict
                    </button>
                    <button
                      onClick={() => setActiveInspectorTab("crypto")}
                      className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                        activeInspectorTab === "crypto"
                          ? "bg-white text-slate-900 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Attestation & TLS
                    </button>
                    <button
                      onClick={() => setActiveInspectorTab("json")}
                      className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                        activeInspectorTab === "json"
                          ? "bg-white text-slate-900 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Payload JSON
                    </button>
                  </div>
                </div>

                {/* Tab 1: Policy Verdict */}
                {activeInspectorTab === "verdict" && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    {/* Status Box */}
                    <div
                      className={`p-3.5 rounded-xl border flex items-center justify-between ${
                        selectedEvent.verdict === "verified_agent"
                          ? "bg-emerald-50/70 border-emerald-200"
                          : selectedEvent.verdict === "deflected"
                          ? "bg-rose-50/70 border-rose-200"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold text-slate-900">
                          Enforcement Action: {selectedEvent.actionTaken}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          {selectedEvent.verdict === "verified_agent"
                            ? "Cryptographic signature validated. Agent scoped to designated read-only APIs."
                            : selectedEvent.verdict === "deflected"
                            ? "Automated scraper detected via browser runtime checks. Deflected prior to SSR execution."
                            : "Standard human visitor forwarded to target origin."}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-mono text-slate-500 block">Threat Score</span>
                        <span
                          className={`text-lg font-bold font-mono ${
                            selectedEvent.threatScore > 50 ? "text-rose-600" : "text-emerald-700"
                          }`}
                        >
                          {selectedEvent.threatScore} / 100
                        </span>
                      </div>
                    </div>

                    {/* Route Scopes Table */}
                    <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                        <span>Configured Route Governance</span>
                        <span className="text-[11px] text-emerald-700 font-mono font-medium">
                          Scope Enforced
                        </span>
                      </div>

                      <div className="space-y-2 text-xs font-mono">
                        <div>
                          <span className="text-[11px] text-slate-500 block mb-1">
                            Authorized Access Paths:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedEvent.allowedRoutes.length > 0 ? (
                              selectedEvent.allowedRoutes.map((r, i) => (
                                <span
                                  key={`allowed-${r}-${i}`}
                                  className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px]"
                                >
                                  {r}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">None (All traffic blocked)</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <span className="text-[11px] text-slate-500 block mb-1">
                            Protected / Restricted Endpoints:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedEvent.restrictedRoutes.length > 0 ? (
                              selectedEvent.restrictedRoutes.map((r, i) => (
                                <span
                                  key={`restricted-${r}-${i}`}
                                  className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[11px]"
                                >
                                  {r}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">None</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Tab 2: Attestation & TLS */}
                {activeInspectorTab === "crypto" && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3 font-mono text-xs"
                  >
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex justify-between items-center py-1 border-b border-slate-200/70">
                        <span className="text-slate-500">Cryptographic JWS Token:</span>
                        <span
                          className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                            selectedEvent.jwsStatus === "valid"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {selectedEvent.jwsStatus.toUpperCase()}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-slate-200/70">
                        <span className="text-slate-500">Declared Identity:</span>
                        <span className="text-slate-800 font-semibold">{selectedEvent.sourceName}</span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-slate-200/70">
                        <span className="text-slate-500">Origin ASN Registry:</span>
                        <span className="text-slate-800">{selectedEvent.asn}</span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-slate-200/70">
                        <span className="text-slate-500">Runtime Tamper Check:</span>
                        <span
                          className={
                            selectedEvent.runtimeCheck === "clean"
                              ? "text-emerald-700 font-semibold"
                              : "text-rose-600 font-semibold"
                          }
                        >
                          {selectedEvent.runtimeCheck === "clean"
                            ? "PASSED (NO WEBDRIVER)"
                            : "TAMPER DETECTED"}
                        </span>
                      </div>

                      <div className="py-1">
                        <span className="text-slate-500 block mb-1">JA4 Client Fingerprint:</span>
                        <span className="text-slate-800 bg-white px-2 py-1 rounded border border-slate-200 block truncate text-[11px]">
                          {selectedEvent.ja4Fingerprint}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Tab 3: Payload JSON */}
                {activeInspectorTab === "json" && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative bg-[#0F172A] rounded-xl p-3 text-slate-300 font-mono text-[11px] leading-relaxed max-h-[260px] overflow-y-auto"
                  >
                    <button
                      onClick={handleCopyJson}
                      className="absolute top-2.5 right-2.5 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Copy payload"
                    >
                      {copied ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>

                    <pre className="text-slate-300 pr-12">
                      {JSON.stringify(
                        {
                          event_id: selectedEvent.id,
                          visitor: {
                            source: selectedEvent.sourceName,
                            provider: selectedEvent.provider,
                            ip: selectedEvent.originIp,
                            asn: selectedEvent.asn,
                          },
                          evaluation: {
                            category: selectedEvent.declaredCategory,
                            verdict: selectedEvent.verdict,
                            threat_score: selectedEvent.threatScore,
                            action: selectedEvent.actionTaken,
                            latency_ms: selectedEvent.latencyMs,
                            jws_verified: selectedEvent.jwsStatus === "valid",
                          },
                        },
                        null,
                        2
                      )}
                    </pre>
                  </motion.div>
                )}
              </div>

              {/* Interactive Policy Rules Engine Sandbox */}
              <div className="mt-5 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Sliders className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Live Policy Engine Controls</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Rules active at Edge</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => setPolicyJwsRequired(!policyJwsRequired)}
                    className={`px-2.5 py-2 rounded-lg border text-left transition-all cursor-pointer ${
                      policyJwsRequired
                        ? "bg-emerald-50/70 border-emerald-300 text-emerald-900"
                        : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    <div className="text-[11px] font-semibold flex items-center justify-between">
                      <span>JWS Token Attestation</span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          policyJwsRequired ? "bg-emerald-600" : "bg-slate-300"
                        }`}
                      />
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {policyJwsRequired ? "Strictly Enforced" : "Permissive Mode"}
                    </div>
                  </button>

                  <button
                    onClick={() => setPolicyRouteScoping(!policyRouteScoping)}
                    className={`px-2.5 py-2 rounded-lg border text-left transition-all cursor-pointer ${
                      policyRouteScoping
                        ? "bg-emerald-50/70 border-emerald-300 text-emerald-900"
                        : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    <div className="text-[11px] font-semibold flex items-center justify-between">
                      <span>Route Scoping</span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          policyRouteScoping ? "bg-emerald-600" : "bg-slate-300"
                        }`}
                      />
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {policyRouteScoping ? "Public Endpoints Only" : "Full Access"}
                    </div>
                  </button>

                  <button
                    onClick={() => setPolicyDropHeadless(!policyDropHeadless)}
                    className={`px-2.5 py-2 rounded-lg border text-left transition-all cursor-pointer ${
                      policyDropHeadless
                        ? "bg-emerald-50/70 border-emerald-300 text-emerald-900"
                        : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    <div className="text-[11px] font-semibold flex items-center justify-between">
                      <span>Headless Drop</span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          policyDropHeadless ? "bg-emerald-600" : "bg-slate-300"
                        }`}
                      />
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {policyDropHeadless ? "Deflect to 404" : "Allow"}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Architectural Foundation (Original CleanTraffic Framework) ── */}
        <div className="max-w-4xl mx-auto text-center mb-10">
          <h3
            className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3"
            style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}
          >
            How CleanTraffic Governs the Agentic Web
          </h3>
          <p className="text-slate-600 text-sm sm:text-base max-w-2xl mx-auto">
            A three-tier inspection model designed specifically for high-throughput edge environments.
          </p>
        </div>

        {/* 3 Architectural Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 mb-4">
                <Lock className="w-5 h-5" />
              </div>
              <h4
                className="text-base sm:text-lg font-bold text-slate-900 mb-2 tracking-tight"
                style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
              >
                Cryptographic Identity Attestation
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Evaluates signed JSON Web Signatures (JWS), public key certificate chains, and verified ASN networks from major autonomous operators before granting access.
              </p>
            </div>
            <div className="pt-4 mt-6 border-t border-slate-100 flex items-center text-xs font-semibold text-emerald-800">
              <span>0% False Positive Guarantee</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 mb-4">
                <Sliders className="w-5 h-5" />
              </div>
              <h4
                className="text-base sm:text-lg font-bold text-slate-900 mb-2 tracking-tight"
                style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
              >
                Granular Route Scoping
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Permit certified AI assistants to discover documentation, inventory, and public catalog feeds while shielding user sessions, checkout transactions, and authentication portals.
              </p>
            </div>
            <div className="pt-4 mt-6 border-t border-slate-100 flex items-center text-xs font-semibold text-emerald-800">
              <span>Path & Method Isolation</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 mb-4">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h4
                className="text-base sm:text-lg font-bold text-slate-900 mb-2 tracking-tight"
                style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
              >
                Stealth Automation Isolation
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Analyzes runtime browser execution primitives, canvas entropy, and residential proxy hops to instantly distinguish rogue scrapers from legitimate autonomous agents.
              </p>
            </div>
            <div className="pt-4 mt-6 border-t border-slate-100 flex items-center text-xs font-semibold text-rose-700">
              <span>Sub-Millisecond Edge Deflection</span>
            </div>
          </div>
        </div>

        {/* Bottom CTA for Standalone vs Landing */}
        {!isStandalonePage && (
          <div className="mt-12 text-center">
            <button
              onClick={() => navigate("/use-cases/ai-agents")}
              className="inline-flex items-center gap-2 px-7 py-3 bg-slate-900 hover:bg-black text-white font-semibold rounded-full text-sm shadow-xs transition-all group cursor-pointer"
            >
              <span>Read the Full Autonomous AI Agent Specification</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
