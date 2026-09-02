import { 
  Radio, 
  Trash2, 
  Users, 
  Bot, 
  Shield, 
  Activity, 
  Sparkles,
  ArrowUpRight,
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { useSecurityEvents } from "@/hooks/use-security-events";

export function UserLiveEventsTab() {
  const { events, connected, clear } = useSecurityEvents();

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-[#E5EAE7] rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2.5 tracking-tight">
              <div className="w-8 h-8 rounded-lg bg-[#E6F2ED] border border-[#CCE5DB] flex items-center justify-center text-[#0A5C48]">
                <Radio className="h-4 w-4 text-[#0A5C48]" />
              </div>
              Live Security Telemetry Feed
            </h2>
            <p className="text-xs text-[#64748B] mt-1">
              Real-time stream of incoming visitor classifications and automated cloaking decisions
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#F7FAF8] border border-[#E0E9E4] px-3 py-1.5 rounded-lg text-xs font-semibold">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  connected ? "bg-[#0A5C48] animate-pulse" : "bg-[#82928A]"
                }`}
              />
              <span className="text-[#2D3B35]">
                {connected ? "SSE Stream Connected" : "Connecting..."}
              </span>
            </div>

            {events.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clear}
                className="h-8 text-xs text-[#52635B] hover:text-[#0F172A] border-[#D5DFD9] bg-white hover:bg-[#F2F6F4] rounded-lg font-semibold shadow-xs"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Events Table Container */}
      <div className="bg-white border border-[#E5EAE7] rounded-xl p-6 shadow-xs">
        {events.length === 0 ? (
          <div className="text-center py-16 text-[#64748B]">
            <div className="w-12 h-12 rounded-xl bg-[#F7FAF8] border border-[#E0E9E4] flex items-center justify-center text-[#0A5C48] mx-auto mb-3">
              <Radio className="h-6 w-6" />
            </div>
            <p className="font-bold text-[#0F172A]">Listening for incoming traffic…</p>
            <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">
              Any visitor evaluated by your integrated PHP script or API key will appear here instantly with low-latency live telemetry.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5EAE7] text-[10px] font-bold uppercase tracking-wider text-[#64748B] bg-[#F7FAF8]">
                  <th className="py-2.5 px-3 font-semibold">TIME</th>
                  <th className="py-2.5 px-3 font-semibold">TYPE</th>
                  <th className="py-2.5 px-3 font-semibold">IP ADDRESS</th>
                  <th className="py-2.5 px-3 font-semibold">DETECTION RULE</th>
                  <th className="py-2.5 px-3 font-semibold">COUNTRY</th>
                  <th className="py-2.5 px-3 font-semibold">ISP / CARRIER</th>
                  <th className="py-2.5 px-3 font-semibold text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F4]">
                {events.map((evt) => {
                  const isHuman = evt.visitorType === "Human";
                  return (
                    <tr
                      key={evt.id}
                      className={`hover:bg-[#F7FAF8] transition-colors ${
                        evt.isNew ? "bg-[#E6F2ED]/40" : ""
                      }`}
                    >
                      <td className="py-3 px-3 font-mono text-[#64748B] whitespace-nowrap">
                        {formatDistanceToNow(new Date(evt.timestamp), { addSuffix: true })}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            isHuman
                              ? "bg-[#E6F2ED] text-[#07382D] border border-[#CCE5DB]"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {isHuman ? <Users className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                          {evt.visitorType}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-[#0F172A]">{evt.ipAddress}</td>
                      <td className="py-3 px-3 text-[#52635B]">{evt.detectionMethod}</td>
                      <td className="py-3 px-3 text-[#2D3B35] font-medium">{evt.country}</td>
                      <td className="py-3 px-3 text-[#2D3B35] max-w-[160px] truncate" title={evt.isp}>
                        {evt.isp}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`inline-flex text-[11px] font-bold px-2 py-0.5 rounded ${
                            evt.action === "Allowed"
                              ? "bg-[#E6F2ED] text-[#07382D] border border-[#CCE5DB]"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
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
