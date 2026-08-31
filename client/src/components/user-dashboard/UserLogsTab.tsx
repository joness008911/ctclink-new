import { useState } from "react";
import { format } from "date-fns";
import { 
  FileText, 
  Users, 
  Bot, 
  Search, 
  Filter, 
  Download, 
  Globe 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface UserLogsTabProps {
  classifications: any[];
}

export function UserLogsTab({ classifications = [] }: UserLogsTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "Human" | "Bot">("all");

  const filtered = classifications.filter((c) => {
    const matchesSearch =
      (c.isp && c.isp.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.country && c.country.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.city && c.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.visitorType && c.visitorType.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = filterType === "all" || c.visitorType === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="bg-[#101726] border border-[#1c2638] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <FileText className="h-5 w-5 text-blue-500" />
              Historical Traffic Classification Logs
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Privacy-first audit log of evaluated requests (retains last 50 entries)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-[#141d2e] border border-[#212e45] p-0.5 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  filterType === "all" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterType("Human")}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  filterType === "Human" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Humans
              </button>
              <button
                type="button"
                onClick={() => setFilterType("Bot")}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  filterType === "Bot" ? "bg-rose-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Bots
              </button>
            </div>
          </div>
        </div>

        {/* Search Field */}
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-3 text-slate-500" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by ISP, Country, City, or Category..."
            className="pl-9 bg-[#141d2e] border-[#212e45] text-white text-xs h-10"
          />
        </div>

        {/* Logs Table */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-30 text-blue-400" />
            <p className="text-xs">No classification logs matching your search criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1c2638] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="pb-3">TIMESTAMP</th>
                  <th className="pb-3">CLASSIFICATION</th>
                  <th className="pb-3">LOCATION</th>
                  <th className="pb-3">ISP / CARRIER</th>
                  <th className="pb-3 text-right">DEVICE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#172030]">
                {filtered.map((c, i) => {
                  const isHuman = c.visitorType === "Human";
                  return (
                    <tr key={i} className="hover:bg-[#141d2e] transition-colors">
                      <td className="py-3 font-mono text-slate-400">
                        {format(new Date(c.timestamp), "MM/dd HH:mm:ss")}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            isHuman
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {isHuman ? <Users className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                          {c.visitorType}
                        </span>
                      </td>
                      <td className="py-3 text-slate-300">
                        {c.city && c.countryCode
                          ? `${c.city}, ${c.countryCode}`
                          : c.country || "Global"}
                      </td>
                      <td className="py-3 text-slate-300 max-w-[200px] truncate" title={c.isp}>
                        {c.isp || "Datacenter ASN"}
                      </td>
                      <td className="py-3 text-right text-slate-400 font-mono text-[11px]">
                        {c.deviceType || "Desktop / Browser"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
