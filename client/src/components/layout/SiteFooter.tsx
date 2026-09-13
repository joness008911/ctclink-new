import { useLocation } from "wouter";
import { ShieldCheck } from "lucide-react";

export function SiteFooter() {
  const [, navigate] = useLocation();

  return (
    <footer className="w-full bg-[#0B0F17] border-t border-slate-800 py-12 sm:py-14 px-4 sm:px-6 lg:px-8 text-slate-400">
      <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div
          onClick={() => navigate("/")}
          className="flex items-center gap-2.5 text-white cursor-pointer group"
        >
          <div className="w-7 h-7 rounded-lg bg-[#064E3B] border border-[#047857] flex items-center justify-center text-white group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
          </div>
          <span className="font-bold text-base tracking-tight">CleanTraffic</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-8 text-xs sm:text-sm text-slate-400">
          <button
            onClick={() => navigate("/#features")}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Features
          </button>
          <button
            onClick={() => navigate("/use-cases")}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Use Cases
          </button>
          <button
            onClick={() => navigate("/#how-it-works")}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Detection Engine
          </button>
          <button
            onClick={() => navigate("/use-cases/ai-agents")}
            className="hover:text-white transition-colors cursor-pointer text-orange-400 font-medium"
          >
            AI Agents
          </button>
          <button
            onClick={() => navigate("/use-cases/fraud-prevention")}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Fraud Prevention
          </button>
          <button
            onClick={() => navigate("/#pricing")}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Pricing
          </button>
          <button
            onClick={() => navigate("/docs")}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Documentation
          </button>
          <button
            onClick={() => navigate("/user")}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Log In
          </button>
        </div>

        <p className="text-xs text-slate-500">
          © {new Date().getFullYear()} CleanTraffic. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
