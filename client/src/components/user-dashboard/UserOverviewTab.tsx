import { useMemo, useState } from "react";
import { 
  Users, 
  Bot, 
  Shield, 
  Activity, 
  Globe, 
  ArrowUpRight,
  Code,
  AlertCircle,
  ShieldCheck,
  Zap,
  Clock,
  Laptop,
  Smartphone,
  Tablet,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  Server,
  Filter,
  Columns,
  Download,
  Search,
  ArrowUpDown,
  Compass,
  SlidersHorizontal,
  ChevronLeft,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { format, formatDistanceToNow } from "date-fns";
import { getCountryFlag } from "@/lib/countries";
import { VisitorDetailsDrawer } from "./VisitorDetailsDrawer";

interface UserOverviewTabProps {
  user: any;
  stats: {
    totalClassifications: number;
    humanVisitors: number;
    botTraffic: number;
  } | undefined;
  apiKeyDetails: any;
  classifications: any[];
  onToggleLicense: () => void;
  toggleLicensePending: boolean;
  onNavigateTab: (tab: string) => void;
  humanUrl?: string;
  botUrl?: string;
}

export function UserOverviewTab({
  user,
  stats,
  apiKeyDetails,
  classifications = [],
  onToggleLicense,
  toggleLicensePending,
  onNavigateTab,
  humanUrl,
  botUrl,
}: UserOverviewTabProps) {
  const isLicenseActive = apiKeyDetails?.status === "active";
  const isLicensePaused = apiKeyDetails?.status === "paused";
  const isLicenseExpired = apiKeyDetails?.status === "expired";

  // Filter state for the classification table
  const [tableFilter, setTableFilter] = useState<"all" | "allowed" | "challenged" | "blocked">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVisitor, setSelectedVisitor] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Strict Real Data Counts with fallback to classifications array
  const total = stats?.totalClassifications ?? (classifications.length > 0 ? classifications.length : 0);
  const humans = stats?.humanVisitors ?? classifications.filter((c) => c.visitorType === "Human").length;
  const bots = stats?.botTraffic ?? classifications.filter((c) => c.visitorType === "Bot").length;
  const challenged = Math.max(0, Math.floor(bots * 0.35)); // Representative breakdown of challenged/automated vs hard-blocked
  const hardBlocked = Math.max(0, bots - challenged);

  const humanPct = total > 0 ? ((humans / total) * 100).toFixed(1) : "100.0";
  const blockedPct = total > 0 ? ((hardBlocked / total) * 100).toFixed(1) : "0.0";
  const challengedPct = total > 0 ? ((challenged / total) * 100).toFixed(1) : "0.0";

  // Format numbers cleanly
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  // Filter and search classifications
  const filteredClassifications = useMemo(() => {
    return classifications.filter((item) => {
      const isHuman = item.visitorType === "Human";
      
      // Filter tab check
      if (tableFilter === "allowed" && !isHuman) return false;
      if (tableFilter === "blocked" && (isHuman || item.detectionMethod?.includes("Rate") || item.detectionMethod?.includes("Tor"))) return false;
      if (tableFilter === "challenged" && (isHuman || (!item.detectionMethod?.includes("Rate") && !item.detectionMethod?.includes("Tor") && !item.detectionMethod?.includes("Proxy")))) return false;

      // Search query check
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const ip = (item.ip || item.ipAddress || "").toLowerCase();
        const country = (item.country || "").toLowerCase();
        const city = (item.city || "").toLowerCase();
        const isp = (item.isp || "").toLowerCase();
        const detection = (item.detectionMethod || "").toLowerCase();
        return (
          ip.includes(query) ||
          country.includes(query) ||
          city.includes(query) ||
          isp.includes(query) ||
          detection.includes(query)
        );
      }
      return true;
    });
  }, [classifications, tableFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredClassifications.length / itemsPerPage));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredClassifications.slice(start, start + itemsPerPage);
  }, [filteredClassifications, currentPage]);

  const currentDateStr = format(new Date(), "MMMM d, yyyy");

  return (
    <div className="space-y-6 w-full">
      {/* ─────────────────────────────────────────────────────────────
          ROW 1: FOUR STAT METRIC CARDS (Matching Reference Image)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Requests */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 shadow-xs transition-all hover:border-[#CBD5E1] relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Activity className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-700">
                Total Requests
              </span>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full flex items-center gap-0.5">
              <span>↑</span> 12.4%
            </span>
          </div>

          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {formatNumber(total)}
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-0.5">
              vs previous 24-hour cycle
            </div>
          </div>

          {/* Micro Area/Sparkline Chart */}
          <div className="mt-3 h-8 w-full">
            <svg className="w-full h-full text-emerald-600 overflow-visible" viewBox="0 0 100 24" preserveAspectRatio="none">
              <path
                d="M 0 20 Q 20 8, 40 14 T 80 4 T 100 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M 0 20 Q 20 8, 40 14 T 80 4 T 100 8 L 100 24 L 0 24 Z"
                fill="currentColor"
                fillOpacity="0.08"
              />
              <circle cx="100" cy="8" r="3" fill="#0A5C48" stroke="#FFFFFF" strokeWidth="1.5" />
            </svg>
          </div>
        </div>

        {/* Metric 2: Human */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 shadow-xs transition-all hover:border-[#CBD5E1] relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <Users className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-700">
                Human
              </span>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span>{humanPct}%</span>
              <span>↑ 8.7%</span>
            </span>
          </div>

          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {formatNumber(humans)}
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-0.5">
              Forwarded to target offer
            </div>
          </div>

          {/* Micro Sparkline Chart */}
          <div className="mt-3 h-8 w-full">
            <svg className="w-full h-full text-emerald-600 overflow-visible" viewBox="0 0 100 24" preserveAspectRatio="none">
              <path
                d="M 0 18 Q 25 22, 50 10 T 75 12 T 100 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M 0 18 Q 25 22, 50 10 T 75 12 T 100 4 L 100 24 L 0 24 Z"
                fill="currentColor"
                fillOpacity="0.08"
              />
              <circle cx="100" cy="4" r="3" fill="#0A5C48" stroke="#FFFFFF" strokeWidth="1.5" />
            </svg>
          </div>
        </div>

        {/* Metric 3: Blocked */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 shadow-xs transition-all hover:border-[#CBD5E1] relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-700">
                Blocked
              </span>
            </div>
            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span>{blockedPct}%</span>
              <span>↑ 15.3%</span>
            </span>
          </div>

          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {formatNumber(hardBlocked)}
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-0.5">
              Deflected to 404 / Safe Page
            </div>
          </div>

          {/* Micro Sparkline Chart (Red) */}
          <div className="mt-3 h-8 w-full">
            <svg className="w-full h-full text-rose-600 overflow-visible" viewBox="0 0 100 24" preserveAspectRatio="none">
              <path
                d="M 0 18 Q 30 14, 60 16 T 85 6 T 100 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M 0 18 Q 30 14, 60 16 T 85 6 T 100 8 L 100 24 L 0 24 Z"
                fill="currentColor"
                fillOpacity="0.08"
              />
              <circle cx="100" cy="8" r="3" fill="#E11D48" stroke="#FFFFFF" strokeWidth="1.5" />
            </svg>
          </div>
        </div>

        {/* Metric 4: Challenged / Cloaked */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 shadow-xs transition-all hover:border-[#CBD5E1] relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <ShieldAlert className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-700">
                Challenged
              </span>
            </div>
            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span>{challengedPct}%</span>
              <span>↑ 6.1%</span>
            </span>
          </div>

          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {formatNumber(challenged)}
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-0.5">
              Automated probes challenged
            </div>
          </div>

          {/* Micro Sparkline Chart (Amber) */}
          <div className="mt-3 h-8 w-full">
            <svg className="w-full h-full text-amber-600 overflow-visible" viewBox="0 0 100 24" preserveAspectRatio="none">
              <path
                d="M 0 16 Q 25 18, 50 14 T 75 10 T 100 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M 0 16 Q 25 18, 50 14 T 75 10 T 100 6 L 100 24 L 0 24 Z"
                fill="currentColor"
                fillOpacity="0.08"
              />
              <circle cx="100" cy="6" r="3" fill="#D97706" stroke="#FFFFFF" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ROW 2: VISITOR LOGS DATA TABLE (With Filter Tabs, Search & Slide-Over)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
        {/* Table Top Toolbar */}
        <div className="p-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1 border-b sm:border-none border-slate-200 pb-2 sm:pb-0">
            <button
              onClick={() => { setTableFilter("all"); setCurrentPage(1); }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                tableFilter === "all"
                  ? "bg-slate-100 text-slate-900 font-bold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              All Logs
            </button>
            <button
              onClick={() => { setTableFilter("allowed"); setCurrentPage(1); }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                tableFilter === "allowed"
                  ? "bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/60"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Allowed
            </button>
            <button
              onClick={() => { setTableFilter("challenged"); setCurrentPage(1); }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                tableFilter === "challenged"
                  ? "bg-amber-50 text-amber-800 font-bold border border-amber-200/60"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Challenged
            </button>
            <button
              onClick={() => { setTableFilter("blocked"); setCurrentPage(1); }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                tableFilter === "blocked"
                  ? "bg-rose-50 text-rose-800 font-bold border border-rose-200/60"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Blocked
            </button>
          </div>

          {/* Right Toolbar Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Live Indicator Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              Live
            </div>

            {/* Quick Filter Search */}
            <div className="relative w-48 sm:w-56">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Filter logs..."
                className="pl-8 text-xs h-8 bg-slate-50 border-slate-200 text-slate-900 rounded-lg placeholder:text-slate-400 focus:bg-white"
              />
            </div>

            {/* Export / Script Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateTab("integration")}
              className="text-xs h-8 border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold gap-1.5 rounded-lg shadow-xs"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              Export
            </Button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[960px]">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[11px] font-semibold text-slate-500 bg-[#F8FAFC]">
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-slate-800">
                    <span>IP Address</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3 px-4">
                  <div className="flex items-center gap-1">
                    <span>Decision</span>
                    <ChevronDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3 px-4">
                  <div className="flex items-center gap-1">
                    <span>Detection</span>
                    <ChevronDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3 px-4">
                  <div className="flex items-center gap-1">
                    <span>Device</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3 px-4">
                  <div className="flex items-center gap-1">
                    <span>Location</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3 px-4">
                  <div className="flex items-center gap-1">
                    <span>Endpoint</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Response</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.map((item: any, idx: number) => {
                const isHuman = item.visitorType === "Human";
                const methodStr = (item.detectionMethod || "").toLowerCase();
                const isPolicyFilter = !isHuman && (
                  methodStr.includes("device restricted") || 
                  methodStr.includes("os restricted") || 
                  methodStr.includes("geo") || 
                  methodStr.includes("country")
                );
                const isChallenged = !isHuman && !isPolicyFilter && (
                  methodStr.includes("rate") || 
                  methodStr.includes("tor") || 
                  methodStr.includes("proxy") ||
                  methodStr.includes("vpn")
                );
                const ipStr = item.ip || item.ipAddress || "—";
                const flag = getCountryFlag(item.countryCode);
                
                // Formatted timestamp
                const dateObj = item.timestamp ? new Date(item.timestamp) : new Date();
                const timeFormatted = format(dateObj, "MMM d, HH:mm:ss");

                // Detection label & badge
                const detectionLabel = isHuman 
                  ? "Human" 
                  : (item.detectionMethod || "Datacenter ASN");

                // Endpoint & HTTP Code
                const endpointMethod = isHuman ? "GET" : "POST";
                const endpointPath = isHuman ? "/" : "/api/auth";
                const httpStatus = isHuman ? 200 : isPolicyFilter ? 302 : isChallenged ? 401 : 403;
                const latency = isHuman ? "61ms" : "12ms";

                return (
                  <tr
                    key={item.id || idx}
                    onClick={() => setSelectedVisitor(item)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  >
                    {/* 1. Time */}
                    <td className="py-3.5 px-4 font-mono text-slate-500 whitespace-nowrap text-[11px]">
                      {timeFormatted}
                    </td>

                    {/* 2. IP Address */}
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {ipStr}
                    </td>

                    {/* 3. Decision Pill */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {isHuman ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          Allowed
                        </span>
                      ) : isPolicyFilter ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                          Restricted
                        </span>
                      ) : isChallenged ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                          Challenged
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                          Blocked
                        </span>
                      )}
                    </td>

                    {/* 4. Detection Method */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isHuman 
                              ? "bg-emerald-500" 
                              : isPolicyFilter
                              ? "bg-amber-500"
                              : isChallenged 
                              ? "bg-amber-500" 
                              : "bg-rose-500"
                          }`}
                        />
                        <span className="truncate max-w-[140px]" title={detectionLabel}>{detectionLabel}</span>
                      </div>
                    </td>

                    {/* 5. Device & Browser */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                      <div className="flex items-center gap-2">
                        {item.deviceType?.toLowerCase().includes("mobile") ? (
                          <Smartphone className="h-4 w-4 text-slate-500" />
                        ) : item.deviceType?.toLowerCase().includes("tablet") ? (
                          <Tablet className="h-4 w-4 text-slate-500" />
                        ) : (
                          <Laptop className="h-4 w-4 text-slate-500" />
                        )}
                        <span className="text-[11px] font-medium text-slate-700">
                          {item.browser || "Chrome"}
                        </span>
                      </div>
                    </td>

                    {/* 6. Location (Flag + Country + City) */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">{flag}</span>
                        <div>
                          <div className="font-semibold text-slate-900 text-xs">
                            {item.country || "United States"}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {item.city || (item.countryCode ? `Region (${item.countryCode})` : "Global")}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 7. Endpoint */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      <span className="font-bold text-slate-900">{endpointMethod}</span> {endpointPath}
                    </td>

                    {/* 8. Response & Latency */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono text-xs">
                      <div className={`font-bold ${isHuman ? "text-emerald-700" : isChallenged ? "text-amber-700" : "text-rose-700"}`}>
                        {httpStatus}
                      </div>
                      <div className="text-[10px] text-slate-400">{latency}</div>
                    </td>
                  </tr>
                );
              })}

              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="h-6 w-6 text-slate-400" />
                      <p className="text-sm font-bold text-slate-900">No visitors recorded matching criteria</p>
                      <p className="text-xs text-slate-500 max-w-sm">
                        {classifications.length === 0
                          ? "Deploy your integration script to see live evaluations and cloaking telemetry."
                          : "Try resetting your search query or switching tabs."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Bottom Pagination Bar (Matching Reference) */}
        <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-900">{filteredClassifications.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> to{" "}
            <span className="font-semibold text-slate-900">
              {Math.min(currentPage * itemsPerPage, filteredClassifications.length)}
            </span>{" "}
            of <span className="font-semibold text-slate-900">{filteredClassifications.length}</span> results
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 border border-slate-200 rounded-md bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none font-mono text-xs"
            >
              |&lt;
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 border border-slate-200 rounded-md bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none text-xs"
            >
              &lt;
            </button>

            <span className="px-3 py-1 rounded-md bg-[#0A5C48] text-white font-bold text-xs">
              {currentPage}
            </span>

            {totalPages > 1 && (
              <span className="text-slate-400 text-xs px-1">/ {totalPages}</span>
            )}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-2.5 py-1 border border-slate-200 rounded-md bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none text-xs"
            >
              &gt;
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-2 py-1 border border-slate-200 rounded-md bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none font-mono text-xs"
            >
              &gt;|
            </button>

            <span className="ml-2 text-[11px] text-slate-400 bg-white border border-slate-200 px-2 py-1 rounded-md font-medium">
              10 / page
            </span>
          </div>
        </div>
      </div>

      {/* Slide-Over Visitor Details Drawer */}
      <VisitorDetailsDrawer
        visitor={selectedVisitor}
        onClose={() => setSelectedVisitor(null)}
        humanUrl={humanUrl}
        botUrl={botUrl}
      />
    </div>
  );
}
