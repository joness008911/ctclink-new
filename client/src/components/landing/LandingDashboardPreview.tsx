import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Users,
  Bot,
  ShieldAlert,
  Activity,
  CheckCircle2,
  XCircle,
  Zap,
  FileText,
  SlidersHorizontal,
  Code,
  Settings,
  Copy,
  Check,
  Lock,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Base realistic hourly traffic dataset for 24h cycle
const baseHourlyData = [
  { time: "00:00", human: 340, bot: 120, challenged: 40 },
  { time: "03:00", human: 240, bot: 180, challenged: 55 },
  { time: "06:00", human: 380, bot: 190, challenged: 60 },
  { time: "09:00", human: 820, bot: 270, challenged: 85 },
  { time: "12:00", human: 1120, bot: 360, challenged: 110 },
  { time: "15:00", human: 980, bot: 310, challenged: 90 },
  { time: "18:00", human: 850, bot: 260, challenged: 75 },
  { time: "21:00", human: 680, bot: 210, challenged: 60 },
  { time: "23:59", human: 490, bot: 150, challenged: 45 },
];

const weeklyData = [
  { time: "Mon", human: 6200, bot: 2300, challenged: 650 },
  { time: "Tue", human: 7100, bot: 2450, challenged: 710 },
  { time: "Wed", human: 7800, bot: 2600, challenged: 820 },
  { time: "Thu", human: 8400, bot: 2800, challenged: 890 },
  { time: "Fri", human: 9200, bot: 3100, challenged: 940 },
  { time: "Sat", human: 6800, bot: 2100, challenged: 580 },
  { time: "Sun", human: 5900, bot: 1950, challenged: 510 },
];

const monthlyData = [
  { time: "W1", human: 38000, bot: 14200, challenged: 4100 },
  { time: "W2", human: 42500, bot: 15800, challenged: 4600 },
  { time: "W3", human: 47100, bot: 16900, challenged: 5100 },
  { time: "W4", human: 51400, bot: 17800, challenged: 5400 },
];

interface LogEntry {
  id: string;
  ip: string;
  country: string;
  flag: string;
  city: string;
  isp: string;
  device: string;
  browser: string;
  type: "Human" | "Bot" | "Challenged";
  status: "Allowed" | "Blocked" | "Challenged";
  action: string;
  time: string;
  method: string;
  latencyMs: number;
}

// Realistic classification visitor samples strictly matching CleanTraffic fields
const initialLogs: LogEntry[] = [
  {
    id: "log-1",
    ip: "73.189.44.112",
    country: "United States",
    flag: "🇺🇸",
    city: "San Francisco, CA",
    isp: "Comcast Cable",
    device: "Desktop",
    browser: "Chrome 125 • macOS",
    type: "Human",
    status: "Allowed",
    action: "Forwarded to Target Destination",
    time: "Just now",
    method: "Residential Verified",
    latencyMs: 0.78,
  },
  {
    id: "log-2",
    ip: "54.210.89.24",
    country: "United States",
    flag: "🇺🇸",
    city: "Ashburn, VA",
    isp: "Amazon AWS ASN",
    device: "Server",
    browser: "Headless Chrome 124",
    type: "Bot",
    status: "Blocked",
    action: "Deflected to 404",
    time: "6s ago",
    method: "Datacenter ASN Rule",
    latencyMs: 0.42,
  },
  {
    id: "log-3",
    ip: "86.154.21.90",
    country: "United Kingdom",
    flag: "🇬🇧",
    city: "London",
    isp: "Virgin Media",
    device: "Mobile",
    browser: "Safari 17.4 • iOS",
    type: "Human",
    status: "Allowed",
    action: "Forwarded to Target Destination",
    time: "14s ago",
    method: "Mobile Carrier Clean",
    latencyMs: 0.84,
  },
  {
    id: "log-4",
    ip: "185.220.101.5",
    country: "Germany",
    flag: "🇩🇪",
    city: "Frankfurt",
    isp: "Tor Exit Relay",
    device: "Server",
    browser: "Automated Scraper",
    type: "Bot",
    status: "Blocked",
    action: "Deflected to 403",
    time: "22s ago",
    method: "Tor Anonymizer Node",
    latencyMs: 0.38,
  },
  {
    id: "log-5",
    ip: "142.250.190.46",
    country: "United States",
    flag: "🇺🇸",
    city: "Mountain View, CA",
    isp: "Google LLC",
    device: "Server",
    browser: "Googlebot/2.1",
    type: "Challenged",
    status: "Challenged",
    action: "Served Safe Page",
    time: "35s ago",
    method: "Search Crawler Policy",
    latencyMs: 0.91,
  },
];

// Pool of realistic incoming visitor events to generate believable live traffic
const incomingEventPool: Omit<LogEntry, "id" | "time">[] = [
  {
    ip: "172.56.41.88",
    country: "United States",
    flag: "🇺🇸",
    city: "Dallas, TX",
    isp: "T-Mobile USA",
    device: "Mobile",
    browser: "Chrome 125 • Android",
    type: "Human",
    status: "Allowed",
    action: "Forwarded to Target Destination",
    method: "Carrier Verified Clean",
    latencyMs: 0.76,
  },
  {
    ip: "94.102.61.18",
    country: "Netherlands",
    flag: "🇳🇱",
    city: "Amsterdam",
    isp: "Residential Proxy Pool",
    device: "Server",
    browser: "Puppeteer Stealth 1.2",
    type: "Bot",
    status: "Blocked",
    action: "Deflected to 404",
    method: "Runtime Fingerprint Mismatch",
    latencyMs: 0.44,
  },
  {
    ip: "108.45.19.204",
    country: "United States",
    flag: "🇺🇸",
    city: "New York, NY",
    isp: "Verizon Fios",
    device: "Desktop",
    browser: "Edge 124 • Windows 11",
    type: "Human",
    status: "Allowed",
    action: "Forwarded to Target Destination",
    method: "Residential Verified",
    latencyMs: 0.69,
  },
  {
    ip: "157.55.39.8",
    country: "United States",
    flag: "🇺🇸",
    city: "Redmond, WA",
    isp: "Microsoft Corp",
    device: "Server",
    browser: "Bingbot/2.0",
    type: "Challenged",
    status: "Challenged",
    action: "Served Safe Page",
    method: "Search Engine Verified",
    latencyMs: 0.82,
  },
  {
    ip: "198.51.100.42",
    country: "Singapore",
    flag: "🇸🇬",
    city: "Singapore",
    isp: "DigitalOcean Droplet",
    device: "Server",
    browser: "Python-urllib/3.11",
    type: "Bot",
    status: "Blocked",
    action: "Deflected to 403",
    method: "Headless Script Agent",
    latencyMs: 0.39,
  },
  {
    ip: "212.58.244.71",
    country: "United Kingdom",
    flag: "🇬🇧",
    city: "Manchester",
    isp: "Vodafone Broadband",
    device: "Desktop",
    browser: "Firefox 125 • Windows",
    type: "Human",
    status: "Allowed",
    action: "Forwarded to Target Destination",
    method: "Residential Verified",
    latencyMs: 0.81,
  },
  {
    ip: "139.130.4.5",
    country: "Australia",
    flag: "🇦🇺",
    city: "Sydney",
    isp: "Telstra Internet",
    device: "Mobile",
    browser: "Safari 17.5 • iOS",
    type: "Human",
    status: "Allowed",
    action: "Forwarded to Target Destination",
    method: "Mobile Carrier Clean",
    latencyMs: 0.88,
  },
  {
    ip: "146.19.24.81",
    country: "France",
    flag: "🇫🇷",
    city: "Roubaix",
    isp: "OVH Hosting SAS",
    device: "Server",
    browser: "ScrapingBot/2.4",
    type: "Bot",
    status: "Blocked",
    action: "Deflected to 404",
    method: "Datacenter ASN Rule",
    latencyMs: 0.41,
  },
  {
    ip: "64.233.160.10",
    country: "United States",
    flag: "🇺🇸",
    city: "Los Angeles, CA",
    isp: "Google LLC",
    device: "Server",
    browser: "Google Storebot",
    type: "Challenged",
    status: "Challenged",
    action: "Served Safe Page",
    method: "Catalog Crawl Permitted",
    latencyMs: 0.94,
  },
  {
    ip: "24.120.90.15",
    country: "United States",
    flag: "🇺🇸",
    city: "Chicago, IL",
    isp: "AT&T U-verse",
    device: "Desktop",
    browser: "Chrome 125 • Windows",
    type: "Human",
    status: "Allowed",
    action: "Forwarded to Target Destination",
    method: "Residential Verified",
    latencyMs: 0.72,
  },
];

let globalLogCounter = 100;

/**
 * Custom hook that animates numerical increments using requestAnimationFrame.
 * - Smoothly interpolates integer values with cubic ease-out
 * - Honors prefers-reduced-motion by snapping immediately to target
 * - Cancels and clears running animation frames on unmount or when visibility is lost
 * - Prevents unnecessary re-renders when target value has not changed
 */
function useAnimatedCounter(
  targetValue: number,
  durationMs: number = 650,
  disabled: boolean = false
): number {
  const [displayValue, setDisplayValue] = useState(targetValue);
  const currentValRef = useRef(targetValue);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    // If disabled (reduced motion, out of view, or loading), immediately snap to target
    if (disabled) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      currentValRef.current = targetValue;
      setDisplayValue(targetValue);
      return;
    }

    const startVal = currentValRef.current;
    if (startVal === targetValue) return;

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    const startTime = performance.now();
    const diff = targetValue - startVal;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Subtle cubic ease-out curve
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextVal = Math.round(startVal + diff * eased);

      currentValRef.current = nextVal;
      setDisplayValue(nextVal);

      if (progress < 1) {
        rafIdRef.current = requestAnimationFrame(step);
      } else {
        rafIdRef.current = null;
      }
    };

    rafIdRef.current = requestAnimationFrame(step);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [targetValue, durationMs, disabled]);

  return displayValue;
}

export function LandingDashboardPreview() {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");
  const [activeTab, setActiveTab] = useState<
    "overview" | "logs" | "routing" | "integration" | "settings"
  >("overview");

  // Ref to track container element for IntersectionObserver
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Loading state for realistic initial appearance
  const [isLoading, setIsLoading] = useState(true);

  // Detect prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Controlled live telemetry state (only increments plausibly)
  const [liveMetrics, setLiveMetrics] = useState({
    total: 14850,
    human: 9420,
    bot: 4310,
    probes: 1120,
    latency: 0.8,
    lastSyncSec: 0,
  });

  // Track recently incremented category for subtle visual indicators
  const [recentlyIncremented, setRecentlyIncremented] = useState<{
    type: "total" | "human" | "bot" | "probes" | null;
    delta: number;
    timestamp: number;
  }>({ type: null, delta: 0, timestamp: 0 });

  // Recent logs state (bounded to 6 items maximum)
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);

  // Copied state for PHP code preview
  const [copiedCode, setCopiedCode] = useState(false);

  // Dynamically adjusted 24h chart data (keeps baseline and updates latest bucket)
  const [hourlyChartData, setHourlyChartData] = useState(baseHourlyData);

  // Track if container is in viewport and tab is visible
  const [isSimulationActive, setIsSimulationActive] = useState(true);

  // Detect prefers-reduced-motion once and listen for changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, []);

  // Graceful loading experience (short skeleton, then reveals live state)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 420);
    return () => clearTimeout(timer);
  }, []);

  // Viewport & Tab Visibility Awareness
  useEffect(() => {
    let isIntersecting = true;
    let isTabVisible = document.visibilityState === "visible";

    const updateSimulationState = () => {
      setIsSimulationActive(isIntersecting && isTabVisible);
    };

    const handleVisibilityChange = () => {
      isTabVisible = document.visibilityState === "visible";
      updateSimulationState();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    const observer = new IntersectionObserver(
      ([entry]) => {
        isIntersecting = entry.isIntersecting;
        updateSimulationState();
      },
      { threshold: 0.08 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      observer.disconnect();
    };
  }, []);

  // Controlled, believable live event generator
  // Runs every 4.8 seconds only when visible and active
  useEffect(() => {
    if (!isSimulationActive || isLoading) return;

    const interval = setInterval(() => {
      // Pick random realistic event from incoming event pool
      const template = incomingEventPool[Math.floor(Math.random() * incomingEventPool.length)];
      globalLogCounter += 1;

      const newId = `log-${Date.now()}-${globalLogCounter}`;
      const newEntry: LogEntry = {
        ...template,
        id: newId,
        time: "Just now",
        latencyMs: +(template.latencyMs + (Math.random() * 0.08 - 0.04)).toFixed(2),
      };

      // Believable increments:
      // Total clicks increments by 1 or 2
      const deltaTotal = Math.random() > 0.35 ? 2 : 1;
      const isHuman = template.type === "Human";
      const isBot = template.type === "Bot";
      const isChallenged = template.type === "Challenged";

      const deltaHuman = isHuman ? deltaTotal : 0;
      const deltaBot = isBot ? 1 : 0;
      const deltaChallenged = isChallenged ? 1 : 0;

      // Update metrics
      setLiveMetrics((prev) => {
        const nextTotal = prev.total + deltaTotal;
        const nextHuman = prev.human + deltaHuman;
        const nextBot = prev.bot + deltaBot;
        const nextProbes = prev.probes + deltaChallenged;
        const nextLatency = +(0.7 + Math.random() * 0.22).toFixed(1);

        return {
          total: nextTotal,
          human: nextHuman,
          bot: nextBot,
          probes: nextProbes,
          latency: nextLatency,
          lastSyncSec: 0,
        };
      });

      // Track recently incremented category for subtle visual indicators
      setRecentlyIncremented({
        type: isHuman ? "human" : isBot ? "bot" : isChallenged ? "probes" : "total",
        delta: isHuman ? deltaHuman : isBot ? deltaBot : isChallenged ? deltaChallenged : deltaTotal,
        timestamp: Date.now(),
      });

      // Update bounded logs array (keep most recent 6, age previous entries)
      setLogs((prev) => {
        const updatedPrevious = prev.slice(0, 5).map((item, idx) => {
          if (idx === 0) return { ...item, time: "5s ago" };
          if (idx === 1) return { ...item, time: "11s ago" };
          if (idx === 2) return { ...item, time: "18s ago" };
          if (idx === 3) return { ...item, time: "26s ago" };
          return { ...item, time: `${(idx + 1) * 9}s ago` };
        });
        return [newEntry, ...updatedPrevious];
      });

      // Gradually update the latest bucket in the 24h chart (no full chart rebuild)
      setHourlyChartData((prev) => {
        const copy = [...prev];
        const lastIdx = copy.length - 1;
        copy[lastIdx] = {
          ...copy[lastIdx],
          human: copy[lastIdx].human + deltaHuman,
          bot: copy[lastIdx].bot + deltaBot,
          challenged: copy[lastIdx].challenged + deltaChallenged,
        };
        return copy;
      });
    }, 4600);

    return () => clearInterval(interval);
  }, [isSimulationActive, isLoading]);

  // Subtle sync indicator timer (increments "Edge Synced X seconds ago" subtly)
  useEffect(() => {
    if (!isSimulationActive || isLoading) return;
    const syncTimer = setInterval(() => {
      setLiveMetrics((prev) => ({
        ...prev,
        lastSyncSec: prev.lastSyncSec < 50 ? prev.lastSyncSec + 1 : 0,
      }));
    }, 1000);
    return () => clearInterval(syncTimer);
  }, [isSimulationActive, isLoading]);

  // Animated live counters powered by requestAnimationFrame
  // Smoothly increment integer values when new traffic arrives,
  // honoring prefers-reduced-motion and pausing when scrolled out of view.
  const isCounterAnimationDisabled = prefersReducedMotion || !isSimulationActive || isLoading;
  const animatedTotal = useAnimatedCounter(liveMetrics.total, 650, isCounterAnimationDisabled);
  const animatedHuman = useAnimatedCounter(liveMetrics.human, 650, isCounterAnimationDisabled);
  const animatedBot = useAnimatedCounter(liveMetrics.bot, 650, isCounterAnimationDisabled);
  const animatedProbes = useAnimatedCounter(liveMetrics.probes, 650, isCounterAnimationDisabled);

  // Derived statistics with formatted percentages
  const stats = useMemo(() => {
    if (timeRange === "7d") {
      return {
        total: "70.8K",
        human: "51.4K",
        humanPct: "72.6%",
        bot: "19.4K",
        botPct: "27.4%",
        probes: "4.9K",
        changeTotal: "+14.8%",
        changeHuman: "+16.2%",
        changeBot: "-4.1%",
        changeProbes: "+2.3%",
      };
    }
    if (timeRange === "30d") {
      return {
        total: "282K",
        human: "179K",
        humanPct: "63.5%",
        bot: "103K",
        botPct: "36.5%",
        probes: "19.2K",
        changeTotal: "+22.5%",
        changeHuman: "+28.1%",
        changeBot: "-8.4%",
        changeProbes: "+5.1%",
      };
    }

    // Dynamic 24h live stats utilizing requestAnimationFrame interpolated counts
    const effectiveTotal = animatedTotal || 1;
    const humanPct = ((animatedHuman / effectiveTotal) * 100).toFixed(1) + "%";
    const botPct = ((animatedBot / effectiveTotal) * 100).toFixed(1) + "%";

    return {
      total: animatedTotal.toLocaleString(),
      human: animatedHuman.toLocaleString(),
      humanPct,
      bot: animatedBot.toLocaleString(),
      botPct,
      probes: animatedProbes.toLocaleString(),
      changeTotal: "+12.4%",
      changeHuman: "+15.8%",
      changeBot: "-6.2%",
      changeProbes: "+3.1%",
    };
  }, [timeRange, animatedTotal, animatedHuman, animatedBot, animatedProbes]);

  // Chart data selection based on range
  const chartData = useMemo(() => {
    if (timeRange === "7d") return weeklyData;
    if (timeRange === "30d") return monthlyData;
    return hourlyChartData;
  }, [timeRange, hourlyChartData]);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard?.writeText(
      `<?php\nrequire_once 'cleantraffic.php';\nCleanTraffic::protect([\n    'key' => 'ctc_live_79a24c18f8e99f4b',\n    'action' => 'deflect_404'\n]);\n?>`
    );
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }, []);

  return (
    <div
      ref={containerRef}
      id="dashboard-preview-card"
      className="w-full bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[0_12px_36px_-10px_rgba(15,23,42,0.12),0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden transition-all text-slate-800"
    >
      {/* ── Top App Bar ────────────────────────────────────────────── */}
      <div className="px-3.5 sm:px-6 py-3 border-b border-slate-200/80 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Campaign & Shield Status */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#064E3B] border border-[#047857] flex items-center justify-center text-white shrink-0 shadow-xs">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight truncate max-w-[200px] sm:max-w-none">
                Campaign: Summer E-Commerce Funnel
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 shrink-0">
                <span
                  className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${
                    prefersReducedMotion ? "" : "animate-pulse"
                  }`}
                />
                Live Ingress
              </span>
              <span className="hidden xl:inline-flex items-center text-[10px] text-slate-400 font-medium">
                • Synced {liveMetrics.lastSyncSec === 0 ? "just now" : `${liveMetrics.lastSyncSec}s ago`}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate">
              Key: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px] text-slate-700">ctc_live_79a2...9f4b</code> • PHP 8.x Engine
            </p>
          </div>
        </div>

        {/* Right: Latency, Demo label & Time selector */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          {/* Real-time micro-latency badge */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-[11px] font-semibold font-mono">
            <Zap className="h-3 w-3 text-emerald-600 shrink-0" />
            <span className="transition-opacity duration-300">
              {isLoading ? "0.8ms" : `${liveMetrics.latency}ms`}
            </span>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 text-xs font-semibold">
            {(["24h", "7d", "30d"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2.5 py-1 rounded-md transition-all text-[11px] sm:text-xs cursor-pointer ${
                  timeRange === range
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {range === "24h" ? "Today" : range === "7d" ? "7 Days" : "30 Days"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mobile Navigation Switcher (Under 768px) ─────────────────── */}
      <div className="flex md:hidden border-b border-slate-200/80 bg-slate-50/70 p-1.5 gap-1.5 overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex-1 min-w-[110px] flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "overview"
              ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Activity className="h-3.5 w-3.5 text-emerald-600" />
          <span>Overview</span>
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`flex-1 min-w-[130px] flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "logs"
              ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <FileText className="h-3.5 w-3.5 text-blue-600" />
          <span>Visitor Feed</span>
          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-700 font-bold">
            Live
          </span>
        </button>
        <button
          onClick={() => setActiveTab("routing")}
          className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "routing"
              ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-600" />
          <span>Rules</span>
        </button>
      </div>

      {/* ── Dashboard Layout: Mini Sidebar + Content ─────────────────── */}
      <div className="flex flex-col md:flex-row">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex flex-col w-48 lg:w-52 shrink-0 border-r border-slate-200/80 bg-[#FAFCFB] p-3 space-y-1">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-2 py-1.5">
            Dashboard Menu
          </div>
          {[
            { id: "overview", label: "Overview", icon: Activity },
            { id: "logs", label: "Visitor Logs", icon: FileText, badge: "Live" },
            { id: "routing", label: "Rules & Routing", icon: SlidersHorizontal },
            { id: "integration", label: "PHP Integration", icon: Code },
            { id: "settings", label: "Campaign Settings", icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as typeof activeTab)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#064E3B] text-white font-semibold shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${isSelected ? "text-white" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-4 mt-auto">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700">Edge Attestation</span>
                <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#064E3B] h-full transition-all duration-500"
                  style={{ width: "42%" }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Monthly Quota</span>
                <span>42.1K / 100K</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Pane */}
        <div className="flex-1 p-3.5 sm:p-5 lg:p-6 space-y-4 sm:space-y-5 bg-white min-w-0">
          {/* Conditional Sub-View: Rules & Routing Tab */}
          {activeTab === "routing" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Traffic Routing Rules</h3>
                  <p className="text-xs text-slate-500">
                    Deflection policies active at the edge before PHP execution.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("overview")}
                  className="text-xs font-semibold text-[#064E3B] hover:underline"
                >
                  ← Back to Overview
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Datacenter ASN Deflection</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Enforced (404)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Immediately drops traffic from AWS, DigitalOcean, Hetzner, and OVH scrapers.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Headless Browser Check</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Enforced (403)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Evaluates navigator.webdriver, canvas entropy, and missing audio codecs.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Tor Exit Node Isolation</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Blocked (403)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Blocks connections originating from verified Tor relays and anonymizers.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Search Engine Policy</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                      Permit Verified
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Allows verified Googlebot and Bingbot crawlers with reverse DNS validation.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Conditional Sub-View: PHP Integration Tab */}
          {activeTab === "integration" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">PHP 8.x Drop-in Integration</h3>
                  <p className="text-xs text-slate-500">
                    Zero-dependency server protection that shields your campaign in 3 lines.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("overview")}
                  className="text-xs font-semibold text-[#064E3B] hover:underline"
                >
                  ← Back to Overview
                </button>
              </div>

              <div className="bg-slate-900 rounded-xl p-4 text-slate-200 font-mono text-xs relative overflow-hidden">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px] text-slate-400">
                  <span>index.php (Top of script)</span>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-slate-300 overflow-x-auto leading-relaxed">
{`<?php
// CleanTraffic Edge Shield
require_once __DIR__ . '/cleantraffic.php';

CleanTraffic::protect([
    'key' => 'ctc_live_79a24c18f8e99f4b',
    'action' => 'deflect_404', // Drops bad bots before page renders
    'timeout_ms' => 150
]);

// Legitimate visitors continue here smoothly...
?>`}
                </pre>
              </div>
            </div>
          )}

          {/* Conditional Sub-View: Campaign Settings Tab */}
          {activeTab === "settings" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Campaign Safeguards</h3>
                  <p className="text-xs text-slate-500">
                    Configuration settings for Summer E-Commerce Funnel.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("overview")}
                  className="text-xs font-semibold text-[#064E3B] hover:underline"
                >
                  ← Back to Overview
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 border border-slate-200 rounded-xl bg-white space-y-1">
                  <span className="text-slate-500">Target Offer URL</span>
                  <div className="font-mono text-slate-900 font-semibold truncate">
                    https://myshop.com/summer-sale?src=funnel
                  </div>
                </div>
                <div className="p-3.5 border border-slate-200 rounded-xl bg-white space-y-1">
                  <span className="text-slate-500">Deflection Target</span>
                  <div className="font-mono text-slate-900 font-semibold truncate">
                    HTTP 404 Not Found (Silent Drop)
                  </div>
                </div>
                <div className="p-3.5 border border-slate-200 rounded-xl bg-white space-y-1">
                  <span className="text-slate-500">Attestation Timeout</span>
                  <div className="font-mono text-slate-900 font-semibold">150ms Fail-Open</div>
                </div>
                <div className="p-3.5 border border-slate-200 rounded-xl bg-white space-y-1">
                  <span className="text-slate-500">Geo Filtering</span>
                  <div className="font-mono text-slate-900 font-semibold">US, CA, UK, AU, DE</div>
                </div>
              </div>
            </div>
          )}

          {/* ── ROW 1: 4 Core Stat Cards ─────────────────────────────── */}
          {(activeTab === "overview" || activeTab === "logs") && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 lg:gap-4">
                {/* Total Requests / Clicks */}
                <div
                  className={`bg-[#F8FAFC] border border-slate-200/90 rounded-xl p-3 sm:p-4 transition-all hover:border-slate-300 shadow-2xs flex flex-col justify-between ${
                    !prefersReducedMotion && recentlyIncremented.timestamp > 0 && Date.now() - recentlyIncremented.timestamp < 1200
                      ? "ring-1 ring-blue-300/60"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                      <div className="w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Activity className="h-3 w-3" />
                      </div>
                      <span className="truncate">Total Clicks</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                      {stats.changeTotal}
                    </span>
                  </div>
                  <div>
                    {isLoading ? (
                      <div className="h-7 sm:h-8 w-24 bg-slate-200/70 rounded animate-pulse" />
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <div className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight transition-colors duration-300">
                          {stats.total}
                        </div>
                        {timeRange === "24h" && !isLoading && !prefersReducedMotion && recentlyIncremented.timestamp > 0 && (
                          <span
                            className={`text-[10px] font-bold font-mono transition-opacity duration-300 ${
                              Date.now() - recentlyIncremented.timestamp < 1200
                                ? "opacity-100 text-blue-600"
                                : "opacity-0"
                            }`}
                          >
                            +{recentlyIncremented.delta || 1}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                      Edge verified requests
                    </p>
                  </div>
                </div>

                {/* Human Visitors */}
                <div
                  className={`bg-[#ECFDF5]/60 border border-emerald-100 rounded-xl p-3 sm:p-4 transition-all hover:border-emerald-200 shadow-2xs flex flex-col justify-between ${
                    !prefersReducedMotion && recentlyIncremented.type === "human" && Date.now() - recentlyIncremented.timestamp < 1200
                      ? "ring-1 ring-emerald-400/60"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
                      <div className="w-5 h-5 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <Users className="h-3 w-3" />
                      </div>
                      <span className="truncate">Human Traffic</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded shrink-0">
                      {stats.humanPct}
                    </span>
                  </div>
                  <div>
                    {isLoading ? (
                      <div className="h-7 sm:h-8 w-24 bg-emerald-100/60 rounded animate-pulse" />
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <div className="text-lg sm:text-2xl font-black text-emerald-950 tracking-tight transition-colors duration-300">
                          {stats.human}
                        </div>
                        {timeRange === "24h" && !isLoading && !prefersReducedMotion && (
                          <span
                            className={`text-[10px] font-bold font-mono transition-opacity duration-300 ${
                              recentlyIncremented.type === "human" && Date.now() - recentlyIncremented.timestamp < 1200
                                ? "opacity-100 text-emerald-600"
                                : "opacity-0"
                            }`}
                          >
                            +{recentlyIncremented.delta || 1}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-[10px] text-emerald-700/80 mt-0.5 truncate">
                      Passed cleanly to offer
                    </p>
                  </div>
                </div>

                {/* Blocked Bots */}
                <div
                  className={`bg-[#FEF2F2]/60 border border-rose-100 rounded-xl p-3 sm:p-4 transition-all hover:border-rose-200 shadow-2xs flex flex-col justify-between ${
                    !prefersReducedMotion && recentlyIncremented.type === "bot" && Date.now() - recentlyIncremented.timestamp < 1200
                      ? "ring-1 ring-rose-400/60"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-900">
                      <div className="w-5 h-5 rounded bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                        <Bot className="h-3 w-3" />
                      </div>
                      <span className="truncate">Blocked Bots</span>
                    </div>
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100/80 px-1.5 py-0.5 rounded shrink-0">
                      {stats.botPct}
                    </span>
                  </div>
                  <div>
                    {isLoading ? (
                      <div className="h-7 sm:h-8 w-24 bg-rose-100/60 rounded animate-pulse" />
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <div className="text-lg sm:text-2xl font-black text-rose-900 tracking-tight transition-colors duration-300">
                          {stats.bot}
                        </div>
                        {timeRange === "24h" && !isLoading && !prefersReducedMotion && (
                          <span
                            className={`text-[10px] font-bold font-mono transition-opacity duration-300 ${
                              recentlyIncremented.type === "bot" && Date.now() - recentlyIncremented.timestamp < 1200
                                ? "opacity-100 text-rose-600"
                                : "opacity-0"
                            }`}
                          >
                            +{recentlyIncremented.delta || 1}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-[10px] text-rose-700/80 mt-0.5 truncate">
                      Deflected / dropped
                    </p>
                  </div>
                </div>

                {/* Challenged & Mitigated */}
                <div
                  className={`bg-[#FFFBEB]/70 border border-amber-100 rounded-xl p-3 sm:p-4 transition-all hover:border-amber-200 shadow-2xs flex flex-col justify-between ${
                    !prefersReducedMotion && recentlyIncremented.type === "probes" && Date.now() - recentlyIncremented.timestamp < 1200
                      ? "ring-1 ring-amber-400/60"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                      <div className="w-5 h-5 rounded bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <ShieldAlert className="h-3 w-3" />
                      </div>
                      <span className="truncate">Mitigated</span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded shrink-0">
                      {stats.changeProbes}
                    </span>
                  </div>
                  <div>
                    {isLoading ? (
                      <div className="h-7 sm:h-8 w-24 bg-amber-100/60 rounded animate-pulse" />
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <div className="text-lg sm:text-2xl font-black text-amber-900 tracking-tight transition-colors duration-300">
                          {stats.probes}
                        </div>
                        {timeRange === "24h" && !isLoading && !prefersReducedMotion && (
                          <span
                            className={`text-[10px] font-bold font-mono transition-opacity duration-300 ${
                              recentlyIncremented.type === "probes" && Date.now() - recentlyIncremented.timestamp < 1200
                                ? "opacity-100 text-amber-600"
                                : "opacity-0"
                            }`}
                          >
                            +{recentlyIncremented.delta || 1}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-[10px] text-amber-700/80 mt-0.5 truncate">
                      Search bots & proxies
                    </p>
                  </div>
                </div>
              </div>

              {/* ── ROW 2: Classification Velocity Chart ──────────────────── */}
              {activeTab === "overview" && (
                <div className="bg-[#FAFBFB] border border-slate-200/90 rounded-xl p-3 sm:p-4 lg:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                        <span>Traffic Classification Timeline</span>
                        <span className="text-[10px] sm:text-[11px] font-normal text-slate-500">
                          ({timeRange === "24h" ? "Hourly" : timeRange === "7d" ? "Daily" : "Weekly"})
                        </span>
                      </h4>
                      <p className="text-[10px] sm:text-[11px] text-slate-500">
                        Live segmentation of legitimate buyers vs automated scrapers
                      </p>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-3 sm:gap-4 text-[11px] sm:text-xs font-semibold">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                        <span className="text-slate-700">Human</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
                        <span className="text-slate-700">Bot</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                        <span className="text-slate-700">Mitigated</span>
                      </div>
                    </div>
                  </div>

                  {/* Recharts Area Chart */}
                  <div className="h-36 sm:h-48 lg:h-52 w-full">
                    {isLoading ? (
                      <div className="h-full w-full bg-slate-100/60 rounded-lg animate-pulse" />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
                          <defs>
                            <linearGradient id="liveHumanGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="liveBotGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="liveChalGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis
                            dataKey="time"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 10, fill: "#64748B" }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 10, fill: "#64748B" }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#0F172A",
                              border: "none",
                              borderRadius: "6px",
                              color: "#FFFFFF",
                              fontSize: "11px",
                              boxShadow: "0 8px 16px -3px rgba(0,0,0,0.3)",
                              padding: "6px 10px",
                            }}
                          />
                          <Area
                            isAnimationActive={!prefersReducedMotion}
                            type="monotone"
                            dataKey="human"
                            name="Human Traffic"
                            stroke="#10B981"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#liveHumanGradient)"
                          />
                          <Area
                            isAnimationActive={!prefersReducedMotion}
                            type="monotone"
                            dataKey="bot"
                            name="Blocked Bot"
                            stroke="#EF4444"
                            strokeWidth={1.8}
                            fillOpacity={1}
                            fill="url(#liveBotGradient)"
                          />
                          <Area
                            isAnimationActive={!prefersReducedMotion}
                            type="monotone"
                            dataKey="challenged"
                            name="Challenged"
                            stroke="#F59E0B"
                            strokeWidth={1.5}
                            strokeDasharray="3 3"
                            fillOpacity={1}
                            fill="url(#liveChalGradient)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              )}

              {/* ── ROW 3: Real-Time Classified Visitors Stream ────────────── */}
              <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
                <div className="p-3 sm:p-3.5 border-b border-slate-200/80 bg-[#FAFBFB] flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full bg-emerald-500 ${
                        prefersReducedMotion ? "" : "animate-pulse"
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-900 tracking-tight">
                      Live Classification Feed
                    </span>
                    <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded">
                      Edge Telemetry
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-slate-500 font-medium">
                    <span className="text-slate-400">Simulated real-time feed</span>
                    <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                      {logs.length} events
                    </span>
                  </div>
                </div>

                {/* Mobile Cards Feed (shown on < 640px) */}
                <div className="divide-y divide-slate-100 block sm:hidden">
                  <AnimatePresence initial={false}>
                    {logs.map((log, index) => {
                      const isHuman = log.type === "Human";
                      const isBot = log.type === "Bot";
                      return (
                        <motion.div
                          key={log.id}
                          initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                          transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: "easeOut" }}
                          className={`p-3 space-y-1.5 transition-colors duration-500 ${
                            index === 0 && !prefersReducedMotion
                              ? "bg-blue-50/20"
                              : "bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-900">
                              <span className="text-base" role="img" aria-label="country flag">
                                {log.flag}
                              </span>
                              <span>{log.ip}</span>
                              {index === 0 && !prefersReducedMotion && (
                                <span className="text-[9px] font-sans font-extrabold uppercase tracking-wide text-blue-600 bg-blue-50 border border-blue-200/80 px-1 py-0.2 rounded">
                                  Live
                                </span>
                              )}
                            </div>
                            {isHuman ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                Human
                              </span>
                            ) : isBot ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <XCircle className="h-3 w-3 text-rose-600" />
                                Bot
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <ShieldAlert className="h-3 w-3 text-amber-600" />
                                Challenged
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="truncate max-w-[210px]">{log.city} • {log.isp}</span>
                            <span className="text-[10px] text-slate-400 shrink-0 font-mono">{log.time}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-0.5">
                            <span className="text-[10px] text-slate-400 font-medium truncate max-w-[180px]">
                              {log.method}
                            </span>
                            <span
                              className={`font-semibold text-right ${
                                isHuman ? "text-emerald-700" : isBot ? "text-rose-600" : "text-amber-700"
                              }`}
                            >
                              {log.action}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Desktop Table Feed (shown on >= 640px) */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 font-semibold text-[11px]">
                        <th className="py-2.5 px-3.5">Visitor & Location</th>
                        <th className="py-2.5 px-3">Network / ISP</th>
                        <th className="py-2.5 px-3">Detection Trigger</th>
                        <th className="py-2.5 px-3">Verdict</th>
                        <th className="py-2.5 px-3.5 text-right">Routing Outcome</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      <AnimatePresence initial={false}>
                        {logs.map((log, index) => {
                          const isHuman = log.type === "Human";
                          const isBot = log.type === "Bot";
                          return (
                            <motion.tr
                              key={log.id}
                              initial={prefersReducedMotion ? false : { opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                              transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: "easeOut" }}
                              className={`transition-colors duration-500 ${
                                index === 0 && !prefersReducedMotion
                                  ? "bg-blue-50/20"
                                  : "hover:bg-slate-50/80"
                              }`}
                            >
                              <td className="py-2.5 px-3.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-base" role="img" aria-label="country flag">
                                    {log.flag}
                                  </span>
                                  <div>
                                    <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 text-xs">
                                      <span>{log.ip}</span>
                                      {index === 0 && !prefersReducedMotion && (
                                        <span className="text-[9px] font-sans font-extrabold uppercase tracking-wide text-blue-600 bg-blue-50 border border-blue-200/80 px-1 py-0.2 rounded">
                                          Live
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-sans">{log.city}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-medium text-slate-700 font-sans">{log.isp}</span>
                                <div className="text-[10px] text-slate-400 font-sans">{log.browser}</div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="text-slate-600 font-medium text-[11px] font-sans">
                                  {log.method}
                                </span>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {log.latencyMs}ms inspection
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                {isHuman ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                    Human
                                  </span>
                                ) : isBot ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    <XCircle className="h-3 w-3 text-rose-600" />
                                    Bot
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    <ShieldAlert className="h-3 w-3 text-amber-600" />
                                    Challenged
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3.5 text-right font-sans">
                                <span
                                  className={`text-[11px] font-semibold block ${
                                    isHuman ? "text-emerald-700" : isBot ? "text-rose-600" : "text-amber-700"
                                  }`}
                                >
                                  {log.action}
                                </span>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  {log.time}
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
