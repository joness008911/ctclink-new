import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal,
  Copy,
  Check,
  ShieldCheck,
  Code2,
} from "lucide-react";

interface InspectionScenario {
  id: string;
  label: string;
  verdict: "blocked" | "challenged" | "allowed";
  badgeClass: string;
  jsonPayload: Record<string, unknown>;
}

const scenarios: InspectionScenario[] = [
  {
    id: "headless",
    label: "Headless Bot",
    verdict: "blocked",
    badgeClass: "text-rose-700 bg-rose-50 border-rose-200/80",
    jsonPayload: {
      verdict: "blocked",
      traffic_type: "automated_script",
      risk_score: 99,
      signals: {
        headless_runtime: true,
        canvas_integrity: "anomalous",
        network_asn: "datacenter_host",
      },
      action: "deflect_to_404",
      latency_ms: 0.8,
    },
  },
  {
    id: "ai_agent",
    label: "AI Agent",
    verdict: "challenged",
    badgeClass: "text-amber-700 bg-amber-50 border-amber-200/80",
    jsonPayload: {
      verdict: "challenged",
      traffic_type: "ai_crawler",
      risk_score: 84,
      signals: {
        agent_profile: "unauthorized_scraper",
        robots_compliance: false,
        rapid_burst: true,
      },
      action: "cryptographic_challenge",
      latency_ms: 0.7,
    },
  },
  {
    id: "human",
    label: "Real Visitor",
    verdict: "allowed",
    badgeClass: "text-emerald-700 bg-emerald-50 border-emerald-200/80",
    jsonPayload: {
      verdict: "allowed",
      traffic_type: "verified_human",
      risk_score: 2,
      signals: {
        network_origin: "residential_carrier",
        device_integrity: "authentic_hardware",
        biometrics: "natural_organic",
      },
      action: "pass_to_destination",
      latency_ms: 0.4,
    },
  },
];

export function TrafficInspectorJsonDashboard() {
  const [activeScenarioId, setActiveScenarioId] = useState<string>("headless");
  const [copied, setCopied] = useState<boolean>(false);

  const activeScenario =
    scenarios.find((s) => s.id === activeScenarioId) || scenarios[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(
      JSON.stringify(activeScenario.jsonPayload, null, 2)
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderHighlightedJson = (obj: Record<string, unknown>) => {
    const jsonStr = JSON.stringify(obj, null, 2);
    const lines = jsonStr.split("\n");

    return (
      <pre className="font-mono text-[11.5px] sm:text-xs leading-relaxed text-slate-700 overflow-x-auto selection:bg-emerald-500/20 py-1">
        <code>
          {lines.map((line, idx) => {
            const trimmed = line.trim();
            const indent = line.substring(0, line.indexOf(trimmed));

            const match = trimmed.match(/^("[\w_]+"):\s*(.+)$/);
            if (match) {
              const [, key, val] = match;
              let coloredVal = <span className="text-slate-800">{val}</span>;

              if (val.startsWith('"blocked"') || val.includes("deflect")) {
                coloredVal = (
                  <span className="text-rose-600 font-semibold">{val}</span>
                );
              } else if (val.startsWith('"challenged"') || val.includes("challenge")) {
                coloredVal = (
                  <span className="text-amber-600 font-semibold">{val}</span>
                );
              } else if (val.startsWith('"allowed"') || val.includes("pass_to")) {
                coloredVal = (
                  <span className="text-emerald-600 font-semibold">{val}</span>
                );
              } else if (val.startsWith('"')) {
                coloredVal = <span className="text-sky-700 font-medium">{val}</span>;
              } else if (val === "true" || val === "false") {
                coloredVal = (
                  <span
                    className={
                      val === "true"
                        ? "text-indigo-600 font-semibold"
                        : "text-slate-500"
                    }
                  >
                    {val}
                  </span>
                );
              } else if (!isNaN(Number(val.replace(",", "")))) {
                coloredVal = <span className="text-amber-700 font-medium">{val}</span>;
              }

              return (
                <div
                  key={idx}
                  className="hover:bg-slate-100/70 px-1 sm:px-1.5 py-0.5 rounded transition-colors flex"
                >
                  <span className="text-slate-400 select-none w-5 sm:w-6 shrink-0 text-right pr-2 text-[10.5px]">
                    {idx + 1}
                  </span>
                  <span className="truncate">
                    {indent}
                    <span className="text-slate-600 font-medium">{key}</span>
                    <span className="text-slate-400">: </span>
                    {coloredVal}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={idx}
                className="hover:bg-slate-100/70 px-1 sm:px-1.5 py-0.5 rounded transition-colors flex"
              >
                <span className="text-slate-400 select-none w-5 sm:w-6 shrink-0 text-right pr-2 text-[10.5px]">
                  {idx + 1}
                </span>
                <span className="text-slate-500">{line}</span>
              </div>
            );
          })}
        </code>
      </pre>
    );
  };

  return (
    <div className="w-full max-w-lg lg:max-w-none bg-white rounded-2xl border border-slate-200/90 shadow-[0_10px_30px_-10px_rgba(15,23,42,0.08),0_2px_8px_-2px_rgba(15,23,42,0.03)] overflow-hidden">
      {/* Top Header Bar */}
      <div className="px-3.5 sm:px-4 py-2.5 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
            <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
            <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
          </div>
          <div className="h-3.5 w-px bg-slate-200 mx-0.5" />
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-700 font-medium">
            <Code2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>eval_response.json</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>&lt; 1ms</span>
          </span>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 text-[11px] font-medium text-slate-600 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            aria-label="Copy JSON payload"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                <span className="text-emerald-600 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-slate-400" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scenario Pill Switcher */}
      <div className="px-3 sm:px-4 py-2 bg-white border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="text-[10.5px] uppercase tracking-wider text-slate-400 font-semibold shrink-0 mr-1">
          Inspect:
        </span>
        {scenarios.map((sc) => {
          const isActive = sc.id === activeScenarioId;
          return (
            <button
              key={sc.id}
              onClick={() => setActiveScenarioId(sc.id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? "bg-slate-900 text-white shadow-2xs font-semibold"
                  : "bg-slate-100/70 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  sc.verdict === "blocked"
                    ? "bg-rose-400"
                    : sc.verdict === "challenged"
                    ? "bg-amber-400"
                    : "bg-emerald-400"
                }`}
              />
              <span>{sc.label}</span>
            </button>
          );
        })}
      </div>

      {/* Code Area */}
      <div className="p-3 sm:p-4 bg-[#FBFDFD] min-h-[220px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeScenarioId}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.18 }}
          >
            {renderHighlightedJson(activeScenario.jsonPayload)}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Subtle Footer Bar */}
      <div className="px-3.5 sm:px-4 py-2 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>CleanTraffic Live Edge</span>
        </span>
        <span className="text-slate-400">Zero-Trust Telemetry</span>
      </div>
    </div>
  );
}
