import { useState, useMemo } from "react";
import {
  ShieldCheck,
  Users,
  Bot,
  ShieldAlert,
  Activity,
  Search,
  CheckCircle2,
  XCircle,
  Zap,
  FileText,
  SlidersHorizontal,
  Code,
  Settings,
  Globe2,
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

// Realistic hourly traffic dataset for 24h cycle
const hourlyData = [
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

// Realistic classification visitor samples strictly matching CleanTraffic fields
const sampleLogs = [
  {
    id: "log-1",
    ip: "73.189.44.112",
    country: "United States",
    flag: "🇺🇸",
    city: "San Francisco, CA",
    isp: "Comcast Cable",
    device: "Desktop",
    browser: "Chrome 124",
    type: "Human",
    status: "Allowed",
    action: "Forwarded to Money Page",
    time: "4s ago",
    method: "Residential Verified",
  },
  {
    id: "log-2",
    ip: "54.210.89.24",
    country: "United States",
    flag: "🇺🇸",
    city: "Ashburn, VA",
    isp: "Amazon AWS ASN",
    device: "Server",
    browser: "Headless Chrome",
    type: "Bot",
    status: "Blocked",
    action: "Deflected to 404",
    time: "18s ago",
    method: "Datacenter ASN Rule",
  },
  {
    id: "log-3",
    ip: "86.154.21.90",
    country: "United Kingdom",
    flag: "🇬🇧",
    city: "London",
    isp: "Virgin Media",
    device: "Mobile",
    browser: "Safari iOS",
    type: "Human",
    status: "Allowed",
    action: "Forwarded to Money Page",
    time: "32s ago",
    method: "Mobile Carrier Clean",
  },
  {
    id: "log-4",
    ip: "185.220.101.5",
    country: "Germany",
    flag: "🇩🇪",
    city: "Frankfurt",
    isp: "Tor Exit Relay",
    device: "Desktop",
    browser: "Firefox",
    type: "Bot",
    status: "Blocked",
    action: "Deflected to 403",
    time: "49s ago",
    method: "Tor Anonymizer Node",
  },
  {
    id: "log-5",
    ip: "142.250.190.46",
    country: "United States",
    flag: "🇺🇸",
    city: "Mountain View, CA",
    isp: "Googlebot Crawler",
    device: "Server",
    browser: "Googlebot/2.1",
    type: "Challenged",
    status: "Cloaked",
    action: "Served Safe Page",
    time: "1m ago",
    method: "Search Crawler Policy",
  },
];

export function LandingDashboardPreview() {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");
  const [activeTab, setActiveTab] = useState<"overview" | "logs">("overview");

  const chartData = useMemo(() => {
    if (timeRange === "7d") return weeklyData;
    if (timeRange === "30d") return monthlyData;
    return hourlyData;
  }, [timeRange]);

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
    return {
      total: "14,850",
      human: "9,420",
      humanPct: "63.4%",
      bot: "4,310",
      botPct: "29.0%",
      probes: "1,120",
      changeTotal: "+12.4%",
      changeHuman: "+15.8%",
      changeBot: "-6.2%",
      changeProbes: "+3.1%",
    };
  }, [timeRange]);

  return (
    <div
      id="dashboard-preview"
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
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate">
              Key: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px] text-slate-700">ctc_live_79a2...9f4b</code> • PHP 8.x Engine
            </p>
          </div>
        </div>

        {/* Right: Latency & Time selector */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-[11px] font-semibold">
            <Zap className="h-3 w-3 text-emerald-600 shrink-0" />
            <span>0.8ms Latency</span>
          </div>

          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 text-xs font-semibold">
            {(["24h", "7d", "30d"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2.5 py-1 rounded-md transition-all text-[11px] sm:text-xs ${
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
      <div className="flex md:hidden border-b border-slate-200/80 bg-slate-50/70 p-1.5 gap-1.5">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
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
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "logs"
              ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <FileText className="h-3.5 w-3.5 text-blue-600" />
          <span>Live Visitor Feed</span>
          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-700 font-bold">
            Live
          </span>
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
            { id: "overview", label: "Overview", icon: Activity, active: true },
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
                onClick={() => setActiveTab(item.id as "overview" | "logs")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
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
                <span className="text-[11px] font-bold text-slate-700">Account Quota</span>
                <span className="text-[10px] font-bold text-emerald-600">Active</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#064E3B] h-full w-[42%]" />
              </div>
              <p className="text-[10px] text-slate-400">42.1K / 100K calls</p>
            </div>
          </div>
        </div>

        {/* Main Content Pane */}
        <div className="flex-1 p-3.5 sm:p-5 lg:p-6 space-y-4 sm:space-y-5 bg-white min-w-0">
          {/* ── ROW 1: 4 Core Stat Cards ─────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 lg:gap-4">
            {/* Total Requests */}
            <div className="bg-[#F8FAFC] border border-slate-200/90 rounded-xl p-3 sm:p-4 transition-all hover:border-slate-300 shadow-2xs flex flex-col justify-between">
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
                <div className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                  {stats.total}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">Total campaign traffic</p>
              </div>
            </div>

            {/* Clean Human Traffic */}
            <div className="bg-[#F0FDF4]/70 border border-emerald-100 rounded-xl p-3 sm:p-4 transition-all hover:border-emerald-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
                  <div className="w-5 h-5 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Users className="h-3 w-3" />
                  </div>
                  <span className="truncate">Clean Human</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded shrink-0">
                  {stats.humanPct}
                </span>
              </div>
              <div>
                <div className="text-lg sm:text-2xl font-black text-emerald-900 tracking-tight">
                  {stats.human}
                </div>
                <p className="text-[10px] text-emerald-700/80 mt-0.5 truncate">Routed to money page</p>
              </div>
            </div>

            {/* Blocked Bots */}
            <div className="bg-[#FEF2F2]/70 border border-rose-100 rounded-xl p-3 sm:p-4 transition-all hover:border-rose-200 shadow-2xs flex flex-col justify-between">
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
                <div className="text-lg sm:text-2xl font-black text-rose-900 tracking-tight">
                  {stats.bot}
                </div>
                <p className="text-[10px] text-rose-700/80 mt-0.5 truncate">Deflected / dropped</p>
              </div>
            </div>

            {/* Challenged & Cloaked */}
            <div className="bg-[#FFFBEB]/70 border border-amber-100 rounded-xl p-3 sm:p-4 transition-all hover:border-amber-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                  <div className="w-5 h-5 rounded bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <ShieldAlert className="h-3 w-3" />
                  </div>
                  <span className="truncate">Cloaked</span>
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded shrink-0">
                  {stats.changeProbes}
                </span>
              </div>
              <div>
                <div className="text-lg sm:text-2xl font-black text-amber-900 tracking-tight">
                  {stats.probes}
                </div>
                <p className="text-[10px] text-amber-700/80 mt-0.5 truncate">Automated crawlers shielded</p>
              </div>
            </div>
          </div>

          {/* ── ROW 2: Classification Velocity Chart ──────────────────── */}
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
                  Real-time segmentation of legitimate visitors vs deflected threats
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
                  <span className="text-slate-700">Cloaked</span>
                </div>
              </div>
            </div>

            {/* Recharts Area Chart with safe responsive sizing */}
            <div className="h-36 sm:h-48 lg:h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="humanGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="botGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="chalGradient" x1="0" y1="0" x2="0" y2="1">
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
                    type="monotone"
                    dataKey="human"
                    name="Human Traffic"
                    stroke="#10B981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#humanGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="bot"
                    name="Blocked Bot"
                    stroke="#EF4444"
                    strokeWidth={1.8}
                    fillOpacity={1}
                    fill="url(#botGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="challenged"
                    name="Challenged"
                    stroke="#F59E0B"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    fillOpacity={1}
                    fill="url(#chalGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── ROW 3: Real-Time Classified Visitors Stream ────────────── */}
          <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
            <div className="p-3 sm:p-3.5 border-b border-slate-200/80 bg-[#FAFBFB] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-900 tracking-tight">
                  Live Classification Feed (Real Time)
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
                Auto-updating
              </span>
            </div>

            {/* Mobile Cards Feed (shown on < 640px) */}
            <div className="divide-y divide-slate-100 block sm:hidden">
              {sampleLogs.map((log) => {
                const isHuman = log.type === "Human";
                const isBot = log.type === "Bot";
                return (
                  <div key={log.id} className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-900">
                        <span className="text-base" role="img" aria-label="country flag">
                          {log.flag}
                        </span>
                        <span>{log.ip}</span>
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
                          Cloaked
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{log.city} • {log.isp}</span>
                      <span className="text-[10px] text-slate-400">{log.time}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                      <span className="text-[10px] text-slate-400 font-medium">{log.method}</span>
                      <span className={`font-semibold ${
                        isHuman ? "text-emerald-700" : isBot ? "text-rose-600" : "text-amber-700"
                      }`}>
                        {log.action}
                      </span>
                    </div>
                  </div>
                );
              })}
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
                <tbody className="divide-y divide-slate-100">
                  {sampleLogs.map((log) => {
                    const isHuman = log.type === "Human";
                    const isBot = log.type === "Bot";
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-2">
                            <span className="text-base" role="img" aria-label="country flag">
                              {log.flag}
                            </span>
                            <div>
                              <div className="font-mono font-bold text-slate-900 text-xs">
                                {log.ip}
                              </div>
                              <div className="text-[10px] text-slate-500">{log.city}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-medium text-slate-700">{log.isp}</span>
                          <div className="text-[10px] text-slate-400">{log.browser}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-slate-600 font-medium text-[11px]">
                            {log.method}
                          </span>
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
                        <td className="py-2.5 px-3.5 text-right">
                          <span className={`text-[11px] font-semibold ${
                            isHuman ? "text-emerald-700" : isBot ? "text-rose-600" : "text-amber-700"
                          }`}>
                            {log.action}
                          </span>
                          <div className="text-[10px] text-slate-400">{log.time}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
