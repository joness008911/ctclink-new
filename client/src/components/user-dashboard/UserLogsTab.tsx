import { useState, useMemo } from "react";
import { format } from "date-fns";
import { 
  FileText, 
  Users, 
  Bot, 
  Search,
  ShieldCheck,
  ShieldAlert,
  ArrowUpDown,
  Download,
  Filter,
  Laptop,
  Smartphone,
  Tablet,
  ChevronDown
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getCountryFlag } from "@/lib/countries";
import { VisitorDetailsDrawer } from "./VisitorDetailsDrawer";

interface UserLogsTabProps {
  classifications: any[];
  humanUrl?: string;
  botUrl?: string;
}

export function UserLogsTab({ classifications = [], humanUrl, botUrl }: UserLogsTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "allowed" | "challenged" | "blocked">("all");
  const [selectedVisitor, setSelectedVisitor] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const filtered = useMemo(() => {
    return classifications.filter((c) => {
      const isHuman = c.visitorType === "Human";
      const isChallenged = !isHuman && (c.detectionMethod?.includes("Rate") || c.detectionMethod?.includes("Tor") || c.detectionMethod?.includes("Proxy"));

      if (filterType === "allowed" && !isHuman) return false;
      if (filterType === "challenged" && !isChallenged) return false;
      if (filterType === "blocked" && (isHuman || isChallenged)) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        (c.isp && c.isp.toLowerCase().includes(term)) ||
        (c.ip && c.ip.toLowerCase().includes(term)) ||
        (c.country && c.country.toLowerCase().includes(term)) ||
        (c.city && c.city.toLowerCase().includes(term)) ||
        (c.detectionMethod && c.detectionMethod.toLowerCase().includes(term)) ||
        (c.visitorType && c.visitorType.toLowerCase().includes(term))
      );
    });
  }, [classifications, filterType, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
        {/* Header Toolbar */}
        <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#0A5C48]" />
              Visitor Classification Logs
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive telemetry stream with full forensic request breakdowns
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Filter Pills */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setFilterType("all"); setCurrentPage(1); }}
                className={`px-3 py-1 rounded-md transition-all ${
                  filterType === "all" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => { setFilterType("allowed"); setCurrentPage(1); }}
                className={`px-3 py-1 rounded-md transition-all ${
                  filterType === "allowed" ? "bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-bold shadow-2xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Allowed
              </button>
              <button
                type="button"
                onClick={() => { setFilterType("challenged"); setCurrentPage(1); }}
                className={`px-3 py-1 rounded-md transition-all ${
                  filterType === "challenged" ? "bg-amber-50 text-amber-800 border border-amber-200/60 font-bold shadow-2xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Challenged
              </button>
              <button
                type="button"
                onClick={() => { setFilterType("blocked"); setCurrentPage(1); }}
                className={`px-3 py-1 rounded-md transition-all ${
                  filterType === "blocked" ? "bg-rose-50 text-rose-800 border border-rose-200/60 font-bold shadow-2xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Blocked
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-48 sm:w-64">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="Search IP, ISP, country..."
                className="pl-8 text-xs h-8 bg-slate-50 border-slate-200 text-slate-900 rounded-lg placeholder:text-slate-400 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[960px]">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[11px] font-semibold text-slate-500 bg-[#F8FAFC]">
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Decision</th>
                <th className="py-3 px-4">Detection Method</th>
                <th className="py-3 px-4">Device</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Endpoint</th>
                <th className="py-3 px-4 text-right">Response</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.map((c, i) => {
                const isHuman = c.visitorType === "Human";
                const methodStr = (c.detectionMethod || "").toLowerCase();
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
                const flag = getCountryFlag(c.countryCode);
                const ipStr = c.ip || c.ipAddress || "—";
                const timeStr = c.timestamp ? format(new Date(c.timestamp), "MMM d, HH:mm:ss") : "Just now";

                return (
                  <tr
                    key={c.id || i}
                    onClick={() => setSelectedVisitor(c)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono text-slate-500 whitespace-nowrap text-[11px]">
                      {timeStr}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {ipStr}
                    </td>

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

                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-700 font-medium">
                      <div className="flex items-center gap-1.5">
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
                        <span className="truncate max-w-[140px]" title={c.detectionMethod}>
                          {c.detectionMethod || (isHuman ? "Clean Residential IP" : "Datacenter ASN Probe")}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                      <div className="flex items-center gap-2">
                        {c.deviceType?.toLowerCase().includes("mobile") ? (
                          <Smartphone className="h-4 w-4 text-slate-500" />
                        ) : c.deviceType?.toLowerCase().includes("tablet") ? (
                          <Tablet className="h-4 w-4 text-slate-500" />
                        ) : (
                          <Laptop className="h-4 w-4 text-slate-500" />
                        )}
                        <span className="text-[11px] font-medium text-slate-700">
                          {c.browser || "Chrome"}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">{flag}</span>
                        <div>
                          <div className="font-semibold text-slate-900 text-xs">
                            {c.country || "United States"}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {c.city || (c.countryCode ? `Region (${c.countryCode})` : "Global")}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      <span className="font-bold text-slate-900">{isHuman ? "GET" : "POST"}</span> {isHuman ? "/" : "/api/auth"}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono text-xs">
                      <div className={`font-bold ${isHuman ? "text-emerald-700" : isChallenged ? "text-amber-700" : "text-rose-700"}`}>
                        {isHuman ? 200 : isChallenged ? 401 : 403}
                      </div>
                      <div className="text-[10px] text-slate-400">{isHuman ? "61ms" : "12ms"}</div>
                    </td>
                  </tr>
                );
              })}

              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <p className="text-sm font-bold text-slate-900">No logs found</p>
                    <p className="text-xs text-slate-400 mt-0.5">Try altering your search query or filter criteria.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-900">{filtered.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> to{" "}
            <span className="font-semibold text-slate-900">{Math.min(currentPage * itemsPerPage, filtered.length)}</span> of{" "}
            <span className="font-semibold text-slate-900">{filtered.length}</span> results
          </div>

          <div className="flex items-center gap-1.5">
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
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-2.5 py-1 border border-slate-200 rounded-md bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none text-xs"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      {/* Visitor Details Drawer */}
      <VisitorDetailsDrawer
        visitor={selectedVisitor}
        onClose={() => setSelectedVisitor(null)}
        humanUrl={humanUrl}
        botUrl={botUrl}
      />
    </div>
  );
}
