import { useMemo } from "react";
import { 
  TrendingUp, 
  Users, 
  Bot, 
  Shield, 
  Activity, 
  Globe, 
  Key, 
  ArrowUpRight,
  Calendar,
  Layers,
  ChevronRight,
  Code,
  AlertCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { format, formatDistanceToNow } from "date-fns";

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

  // Strict Real Data Counts — No fallbacks, no demo numbers, no fake percentages
  const total = stats?.totalClassifications ?? (classifications.length > 0 ? classifications.length : 0);
  const humans = stats?.humanVisitors ?? classifications.filter((c) => c.visitorType === "Human").length;
  const bots = stats?.botTraffic ?? classifications.filter((c) => c.visitorType === "Bot").length;
  const blockRate = total > 0 ? Math.round((bots / total) * 100) : 0;

  // Format large numbers cleanly (e.g., 24.8K)
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  // Top ISPs derived STRICTLY from this user's actual bot classifications
  const topISPs = useMemo(() => {
    const counts: Record<string, number> = {};
    classifications
      .filter((c) => c.visitorType === "Bot")
      .forEach((c) => {
        const ispName = c.isp || c.country || "Datacenter ASN";
        counts[ispName] = (counts[ispName] || 0) + 1;
      });

    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const maxVal = entries[0]?.[1] || 1;

    return entries.slice(0, 5).map(([name, count]) => ({
      name,
      count,
      percentage: Math.max(10, Math.round((count / maxVal) * 100)),
    }));
  }, [classifications]);

  // Dynamic Chart Points derived from real classification timestamps
  const chartPoints = useMemo(() => {
    if (classifications.length === 0) return [];
    
    // Group into 6 4-hour buckets or relative buckets
    const now = Date.now();
    const buckets = [0, 0, 0, 0, 0, 0];
    const windowMs = 24 * 60 * 60 * 1000;
    const bucketSize = windowMs / 6;

    classifications.forEach((c) => {
      const ts = new Date(c.timestamp || now).getTime();
      const diff = now - ts;
      if (diff >= 0 && diff < windowMs) {
        const bucketIndex = Math.min(5, Math.max(0, 5 - Math.floor(diff / bucketSize)));
        buckets[bucketIndex]++;
      }
    });

    const maxCount = Math.max(...buckets, 1);
    // Convert to SVG coordinates: viewBox 0 0 600 200 (Y range: 35 to 175)
    return buckets.map((count, idx) => {
      const x = idx * 120;
      const normalizedHeight = (count / maxCount) * 130;
      const y = Math.round(175 - normalizedHeight);
      return { x, y, count };
    });
  }, [classifications]);

  // Construct smooth SVG path if real data exists
  const svgPathData = useMemo(() => {
    if (chartPoints.length < 2) return null;
    let d = `M ${chartPoints[0].x} ${chartPoints[0].y}`;
    for (let i = 1; i < chartPoints.length; i++) {
      const prev = chartPoints[i - 1];
      const curr = chartPoints[i];
      const cx1 = prev.x + (curr.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (curr.x - prev.x) / 2;
      const cy2 = curr.y;
      d += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${curr.x} ${curr.y}`;
    }
    return d;
  }, [chartPoints]);

  const currentDateStr = format(new Date(), "MMM d, yyyy");

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Welcome back, <span className="text-slate-200 font-medium">{user?.fullName || user?.username || "Account Owner"}</span>. Traffic defense overview.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#121927] border border-[#1f2b40] text-slate-300 text-xs px-3.5 py-1.5 rounded-xl font-medium shadow-sm">
            <Calendar className="h-3.5 w-3.5 text-blue-400" />
            <span>Today • {currentDateStr}</span>
          </div>

          <div className="flex items-center gap-2 bg-[#121927] border border-[#1f2b40] px-3.5 py-1.5 rounded-xl text-xs font-medium">
            <span className="text-slate-400">License:</span>
            <div className="flex items-center gap-1.5">
              <Switch
                checked={isLicenseActive}
                onCheckedChange={onToggleLicense}
                disabled={toggleLicensePending || isLicenseExpired}
                className="scale-90 data-[state=checked]:bg-blue-600"
              />
              <span className={`text-[11px] font-semibold ${isLicenseActive ? "text-emerald-400" : isLicensePaused ? "text-amber-400" : "text-rose-400"}`}>
                {isLicenseActive ? "Active" : isLicensePaused ? "Paused" : "Expired"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Requests */}
        <div className="bg-[#101726] border border-[#1c2638] rounded-2xl p-5 relative overflow-hidden transition-all hover:border-[#27354d]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            TOTAL REQUESTS
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {formatNumber(total)}
            </div>
            {/* Sparkline Indicator */}
            <svg className="w-16 h-7 text-blue-500" viewBox="0 0 60 20" fill="none">
              {total > 0 ? (
                <path
                  d="M 0 15 Q 15 5 25 12 T 45 4 T 60 10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M 0 16 L 60 16"
                  stroke="currentColor"
                  strokeOpacity="0.3"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </div>
          <div className="mt-3 flex items-center text-[11px] font-medium">
            {total > 0 ? (
              <span className="text-blue-400 flex items-center">
                <ArrowUpRight className="h-3 w-3 mr-0.5" />
                {total} total evaluations
              </span>
            ) : (
              <span className="text-slate-500">No API usage recorded yet</span>
            )}
          </div>
        </div>

        {/* Metric 2: Bots Filtered */}
        <div className="bg-[#101726] border border-[#1c2638] rounded-2xl p-5 relative overflow-hidden transition-all hover:border-[#27354d]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            BOTS FILTERED
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {formatNumber(bots)}
            </div>
            <svg className="w-16 h-7 text-indigo-400" viewBox="0 0 60 20" fill="none">
              {bots > 0 ? (
                <path
                  d="M 0 16 Q 15 12 30 8 T 48 3 T 60 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M 0 16 L 60 16"
                  stroke="currentColor"
                  strokeOpacity="0.3"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </div>
          <div className="mt-3 flex items-center text-[11px] font-medium">
            {total > 0 ? (
              <span className="text-indigo-400 flex items-center">
                <ArrowUpRight className="h-3 w-3 mr-0.5" />
                {blockRate}% cloaking rate
              </span>
            ) : (
              <span className="text-slate-500">0% cloaking rate</span>
            )}
          </div>
        </div>

        {/* Metric 3: Clean Visitors */}
        <div className="bg-[#101726] border border-[#1c2638] rounded-2xl p-5 relative overflow-hidden transition-all hover:border-[#27354d]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            CLEAN VISITORS
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {formatNumber(humans)}
            </div>
            <svg className="w-16 h-7 text-emerald-400" viewBox="0 0 60 20" fill="none">
              {humans > 0 ? (
                <path
                  d="M 0 14 Q 18 16 32 6 T 50 10 T 60 2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M 0 16 L 60 16"
                  stroke="currentColor"
                  strokeOpacity="0.3"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </div>
          <div className="mt-3 flex items-center text-[11px] font-medium">
            {humans > 0 ? (
              <span className="text-emerald-400 flex items-center">
                <ArrowUpRight className="h-3 w-3 mr-0.5" />
                {humans} forwarded to Money URL
              </span>
            ) : (
              <span className="text-slate-500">0 forwarded visitors</span>
            )}
          </div>
        </div>

        {/* Metric 4: Shield Status */}
        <div className="bg-[#101726] border border-[#1c2638] rounded-2xl p-5 relative overflow-hidden transition-all hover:border-[#27354d]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            SHIELD STATUS
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {isLicenseActive ? "Active" : isLicensePaused ? "Paused" : "Expired"}
            </div>
            <svg className="w-16 h-7 text-cyan-400" viewBox="0 0 60 20" fill="none">
              <path
                d="M 0 10 Q 15 2 30 10 T 45 6 T 60 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="mt-3 flex items-center text-[11px] text-cyan-400 font-medium">
            <Shield className="h-3 w-3 mr-1" />
            <span>{isLicenseActive ? "0ms latency overhead" : "Defense suspended"}</span>
          </div>
        </div>
      </div>

      {/* Row 2: Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Area Chart Card */}
          <div className="bg-[#101726] border border-[#1c2638] rounded-2xl p-6 shadow-sm relative">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Traffic overview</h3>
                <p className="text-xs text-slate-400 mt-0.5">Real-time visitor volume and bot defense trajectories</p>
              </div>
              {total > 0 ? (
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  Live Feed Active
                </span>
              ) : (
                <span className="text-xs font-medium text-slate-400 bg-[#141d2d] border border-[#1f2b40] px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                  Waiting for requests
                </span>
              )}
            </div>

            {/* Chart Area */}
            <div className="h-56 w-full pt-4 relative">
              {total > 0 && svgPathData ? (
                <svg className="w-full h-full overflow-visible" viewBox="0 0 600 200" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="userAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Guide Lines */}
                  <line x1="0" y1="40" x2="600" y2="40" stroke="#1f293d" strokeDasharray="3 3" strokeWidth="1" />
                  <line x1="0" y1="90" x2="600" y2="90" stroke="#1f293d" strokeDasharray="3 3" strokeWidth="1" />
                  <line x1="0" y1="140" x2="600" y2="140" stroke="#1f293d" strokeDasharray="3 3" strokeWidth="1" />
                  <line x1="0" y1="190" x2="600" y2="190" stroke="#1f293d" strokeWidth="1" />

                  {/* Area Fill */}
                  <path
                    d={`${svgPathData} L 600 190 L 0 190 Z`}
                    fill="url(#userAreaGradient)"
                  />

                  {/* Primary Line */}
                  <path
                    d={svgPathData}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />

                  {/* Data Points */}
                  {chartPoints.map((pt, i) => (
                    <circle key={i} cx={pt.x} cy={pt.y} r="4" fill="#3b82f6" stroke="#0e131f" strokeWidth="2" />
                  ))}
                </svg>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-[#1c2638] rounded-xl bg-[#0d131f]/50 p-6 text-center">
                  <Activity className="h-8 w-8 text-blue-500/40 mb-2" />
                  <p className="text-sm font-semibold text-slate-300">No API usage recorded yet</p>
                  <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">
                    Deploy your integration script or make requests using your API key to view real-time traffic volume and cloaking defense trajectories.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigateTab("integration")}
                    className="text-xs border-[#212e45] bg-[#121927] hover:bg-[#182235] text-blue-400 hover:text-blue-300"
                  >
                    <Code className="h-3.5 w-3.5 mr-1.5" />
                    Get Integration Script
                  </Button>
                </div>
              )}
            </div>

            {/* X-Axis Ticks */}
            <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-2 pt-2 border-t border-[#1a2334]">
              <span>-24h</span>
              <span>-20h</span>
              <span>-16h</span>
              <span>-12h</span>
              <span>-8h</span>
              <span>-4h</span>
              <span>Now</span>
            </div>
          </div>

          {/* Recent Classifications Table */}
          <div className="bg-[#101726] border border-[#1c2638] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Recent classifications</h3>
                <p className="text-xs text-slate-400 mt-0.5">Live incoming traffic stream for your account</p>
              </div>
              {classifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigateTab("logs")}
                  className="text-xs text-blue-400 hover:text-blue-300 p-0 h-auto font-medium"
                >
                  View all ({classifications.length})
                </Button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1c2638] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="pb-3">TIME</th>
                    <th className="pb-3">NETWORK / ISP</th>
                    <th className="pb-3">TYPE</th>
                    <th className="pb-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#172030]">
                  {classifications.slice(0, 5).map((item: any, idx: number) => {
                    const isHuman = item.visitorType === "Human";
                    return (
                      <tr key={item.id || idx} className="hover:bg-[#141d2e]/50 transition-colors">
                        <td className="py-3 font-mono text-slate-400 whitespace-nowrap">
                          {item.timestamp ? format(new Date(item.timestamp), "HH:mm:ss") : "Just now"}
                        </td>
                        <td className="py-3 font-medium text-slate-200 truncate max-w-[180px]">
                          {item.isp || item.country || "Datacenter ASN"}
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              isHuman
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            {isHuman ? "Human" : "Bot"}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={`text-[11px] font-medium ${
                              isHuman ? "text-emerald-400" : "text-slate-400"
                            }`}
                          >
                            {isHuman ? "Money URL" : "Safe Page"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {classifications.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <AlertCircle className="h-5 w-5 text-slate-500/60" />
                          <p className="text-xs font-medium text-slate-400">No traffic classifications recorded yet</p>
                          <p className="text-[11px] text-slate-500">Deploy your PHP script to begin routing and logging requests.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Column */}
        <div className="space-y-6">
          {/* Top Filtered Networks */}
          <div className="bg-[#101726] border border-[#1c2638] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Top filtered networks</h3>
              <span className="text-xs text-slate-400">By bot volume</span>
            </div>

            {topISPs.length > 0 ? (
              <div className="space-y-4">
                {topISPs.map((isp, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-200 font-medium truncate max-w-[180px]">
                        {isp.name}
                      </span>
                      <span className="text-blue-400 font-mono font-bold">{isp.count}</span>
                    </div>
                    <div className="w-full bg-[#172030] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${isp.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center border border-dashed border-[#1c2638] rounded-xl bg-[#0d131f]/40 p-4">
                <Shield className="h-6 w-6 text-slate-500/40 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-400">No blocked networks yet</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Automated scrapers and datacenters will be cataloged here once identified.
                </p>
              </div>
            )}
          </div>

          {/* Real-time Activity Feed */}
          <div className="bg-[#101726] border border-[#1c2638] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Live defense activity</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigateTab("live")}
                className="text-xs text-blue-400 hover:text-blue-300 p-0 h-auto font-medium"
              >
                View live
              </Button>
            </div>

            {classifications.length > 0 ? (
              <div className="space-y-3.5">
                {classifications.slice(0, 4).map((c: any, idx: number) => {
                  const isHuman = c.visitorType === "Human";
                  const timeAgo = c.timestamp
                    ? formatDistanceToNow(new Date(c.timestamp), { addSuffix: true })
                    : "Just now";

                  return (
                    <div key={c.id || idx} className="flex items-start gap-3 text-xs">
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isHuman
                            ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                            : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
                        }`}
                      >
                        {isHuman ? <Users className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1">
                        <div className="text-slate-200 font-medium">
                          {isHuman ? "Legitimate human visitor" : "Bot blocked & cloaked"}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {isHuman
                            ? `Forwarded to Money URL • ${timeAgo}`
                            : `${c.detectionMethod || "Datacenter ASN"} • ${timeAgo}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center border border-dashed border-[#1c2638] rounded-xl bg-[#0d131f]/40 p-4">
                <Bot className="h-6 w-6 text-slate-500/40 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-400">No defense activity yet</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Visitor classifications and bot actions will appear dynamically as traffic arrives.
                </p>
              </div>
            )}
          </div>

          {/* Quick Routing Summary Box */}
          <div className="bg-[#101726] border border-[#1c2638] rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-blue-400" />
                Active Redirect Config
              </span>
              <button
                type="button"
                onClick={() => onNavigateTab("routing")}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-medium"
              >
                Edit
              </button>
            </div>
            <div className="text-xs space-y-1.5">
              <div className="bg-[#141c2c] p-2.5 rounded-lg border border-[#1c2638] truncate">
                <span className="text-[10px] text-emerald-400 uppercase font-bold block">HUMAN URL:</span>
                <span className="text-slate-300 font-mono text-[11px] truncate block">
                  {humanUrl || <span className="text-slate-500 italic">Not configured yet</span>}
                </span>
              </div>
              <div className="bg-[#141c2c] p-2.5 rounded-lg border border-[#1c2638] truncate">
                <span className="text-[10px] text-rose-400 uppercase font-bold block">BOT URL:</span>
                <span className="text-slate-300 font-mono text-[11px] truncate block">
                  {botUrl || <span className="text-slate-500 italic">Not configured yet</span>}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
