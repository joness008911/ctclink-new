import { 
  Radio, 
  Trash2, 
  Users, 
  Bot, 
  Shield, 
  Activity, 
  Sparkles,
  ArrowUpRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { useSecurityEvents } from "@/hooks/use-security-events";

export function UserLiveEventsTab() {
  const { events, connected, clear } = useSecurityEvents();

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-[#101726] border border-[#1c2638] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <Radio className="h-5 w-5 text-blue-500" />
              Live Security Telemetry Feed
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Real-time stream of incoming visitor classifications and cloaking decisions
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#141d2d] border border-[#212e45] px-3 py-1.5 rounded-xl text-xs">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  connected ? "bg-emerald-500 animate-pulse" : "bg-slate-500"
                }`}
              />
              <span className="text-slate-300 font-medium">
                {connected ? "SSE Stream Connected" : "Connecting..."}
              </span>
            </div>

            {events.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clear}
                className="h-8 text-xs text-slate-400 hover:text-white border-[#212e45] bg-[#141d2d]"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Events Table Container */}
      <div className="bg-[#101726] border border-[#1c2638] rounded-2xl p-6 shadow-sm">
        {events.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Radio className="h-10 w-10 mx-auto mb-3 opacity-30 text-blue-400" />
            <p className="font-semibold text-slate-200">Listening for incoming traffic…</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Any visitor evaluated by your integrated PHP script or API key will appear here instantly with low-latency live telemetry.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1c2638] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="pb-3">TIME</th>
                  <th className="pb-3">TYPE</th>
                  <th className="pb-3">IP ADDRESS</th>
                  <th className="pb-3">DETECTION RULE</th>
                  <th className="pb-3">COUNTRY</th>
                  <th className="pb-3">ISP / CARRIER</th>
                  <th className="pb-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#172030]">
                {events.map((evt) => {
                  const isHuman = evt.visitorType === "Human";
                  return (
                    <tr
                      key={evt.id}
                      className={`hover:bg-[#141d2e] transition-colors ${
                        evt.isNew ? "bg-blue-600/10" : ""
                      }`}
                    >
                      <td className="py-3 font-mono text-slate-400 whitespace-nowrap">
                        {formatDistanceToNow(new Date(evt.timestamp), { addSuffix: true })}
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
                          {evt.visitorType}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-slate-300">{evt.ipAddress}</td>
                      <td className="py-3 text-slate-400">{evt.detectionMethod}</td>
                      <td className="py-3 text-slate-300">{evt.country}</td>
                      <td className="py-3 text-slate-300 max-w-[160px] truncate" title={evt.isp}>
                        {evt.isp}
                      </td>
                      <td className="py-3 text-right">
                        <span
                          className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded ${
                            evt.action === "Allowed"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {evt.action}
                        </span>
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
