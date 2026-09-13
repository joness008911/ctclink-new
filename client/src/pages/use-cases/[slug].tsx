import { useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Lock,
  Activity,
  Server,
  Layers,
  Sparkles,
  Sliders,
  Code2,
} from "lucide-react";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { USE_CASES, UseCaseData } from "@/data/useCases";
import { AgentGovernanceMonitor } from "@/components/landing/AgentGovernanceMonitor";

interface UseCaseDetailProps {
  slugOverride?: string;
  params?: { slug?: string };
}

export default function UseCaseDetail({ slugOverride, params: routeParams }: UseCaseDetailProps = {}) {
  const [, navigate] = useLocation();
  const [, hookParams] = useRoute("/use-cases/:slug");
  const currentSlug = slugOverride || routeParams?.slug || hookParams?.slug || "automation-tools";

  const useCase: UseCaseData =
    USE_CASES.find((item) => item.slug === currentSlug) || USE_CASES[0];

  const Icon = useCase.icon;

  // Other use cases for navigation footer
  const relatedCases = USE_CASES.filter((item) => item.slug !== useCase.slug).slice(0, 3);

  return (
    <div
      className="min-h-screen w-full flex flex-col bg-white text-slate-900 selection:bg-emerald-500 selection:text-white overflow-x-hidden"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* ── Global Unified Floating Navbar (Identical to Landing Page) ── */}
      <SiteNavbar activePage="use-cases" />

      {/* ── Breadcrumb Sub-Header ──────────────────────────────────── */}
      <div className="w-full border-b border-slate-100 bg-white/80 backdrop-blur-xs py-3 px-4 sm:px-6 lg:px-8 mt-1">
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <button
              onClick={() => navigate("/")}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Home
            </button>
            <span className="text-slate-300">/</span>
            <button
              onClick={() => navigate("/use-cases")}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Use Cases
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-semibold">{useCase.title}</span>
          </div>

          <button
            onClick={() => navigate("/use-cases")}
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Use Cases</span>
          </button>
        </div>
      </div>

      {/* ── Editorial Hero ────────────────────────────────────────────── */}
      <section className="relative w-full bg-gradient-to-b from-[#F8FAFC] via-[#FAFBFD] to-white pt-12 sm:pt-16 md:pt-20 pb-12 sm:pb-16 border-b border-slate-100">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Content Column */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/90 mb-4">
                <Icon className="w-3.5 h-3.5 text-emerald-600" />
                <span>{useCase.badge}</span>
              </div>

              <h1
                className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-[1.12] mb-5"
                style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}
              >
                {useCase.title}
              </h1>

              <p className="text-lg sm:text-xl font-medium text-emerald-850 text-slate-800 mb-4">
                {useCase.tagline}
              </p>

              <p className="text-slate-600 text-sm sm:text-base md:text-lg leading-relaxed mb-8 max-w-2xl">
                {useCase.overview}
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  onClick={() => navigate("/user")}
                  className="px-6 py-3.5 bg-[#0F172A] hover:bg-black text-white font-semibold rounded-full text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer group"
                >
                  <span>Protect Your App Free</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={() => navigate("/docs")}
                  className="px-6 py-3.5 bg-white hover:bg-slate-100 text-slate-800 font-medium rounded-full text-sm border border-slate-200 transition-colors cursor-pointer text-center"
                >
                  View SDK Documentation
                </button>
              </div>
            </div>

            {/* Right Card: Technical Enforcement Snapshot */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl bg-white border border-slate-200/90 shadow-[0_10px_30px_-10px_rgba(15,23,42,0.08)] p-6 sm:p-7">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <Code2 className="w-4 h-4 text-emerald-600" />
                    <span>Enforcement Architecture</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {useCase.technicalEnforcement.latency}
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">
                      Rule Type
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {useCase.technicalEnforcement.ruleType}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">
                      Detection Engine Layer
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {useCase.technicalEnforcement.detectionLayer}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">
                      Default Edge Mitigation
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {useCase.technicalEnforcement.defaultMitigation}
                    </span>
                  </div>
                </div>

                {/* Real World Impact Callout */}
                <div className="mt-6 pt-5 border-t border-slate-100 bg-[#FAFBFD] -mx-6 -mb-6 p-6 rounded-b-2xl">
                  <div className="text-3xl sm:text-4xl font-extrabold text-emerald-700 tracking-tight mb-1">
                    {useCase.realWorldImpact.stat}
                  </div>
                  <div className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                    {useCase.realWorldImpact.statLabel}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {useCase.realWorldImpact.summary}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why It Matters (The Real Cost) ─────────────────────────── */}
      <section className="w-full py-12 sm:py-16 md:py-20 bg-white border-b border-slate-100">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-200/70 px-2.5 py-0.5 rounded-full inline-block mb-3">
              The Problem
            </span>
            <h2
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 tracking-tight leading-tight"
              style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
            >
              {useCase.whyItMatters.headline}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {useCase.whyItMatters.points.map((pt, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-[#FAFBFD] border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs mb-4">
                  0{i + 1}
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">
                  {pt.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {pt.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How CleanTraffic Solves It (Capabilities) ──────────────── */}
      <section className="w-full py-12 sm:py-16 md:py-20 bg-[#FAFBFD] border-b border-slate-200/80">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full inline-block mb-3">
              The Defense Strategy
            </span>
            <h2
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 tracking-tight leading-tight"
              style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
            >
              {useCase.howCleanTrafficProtects.headline}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {useCase.howCleanTrafficProtects.capabilities.map((cap, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">
                  {cap.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {cap.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── If AI Agents Use Case: Interactive In-depth Inspection & Defense Matrix ── */}
      {useCase.slug === "ai-agents" && (
        <AgentGovernanceMonitor isStandalonePage={true} />
      )}

      {/* ── Explore More Use Cases ───────────────────────────────────── */}
      <section className="w-full py-12 sm:py-16 bg-white border-b border-slate-100">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h3
                className="text-xl sm:text-2xl font-bold text-slate-900"
                style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
              >
                Explore other use cases
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Discover how CleanTraffic stops abuse across your entire stack.
              </p>
            </div>
            <button
              onClick={() => navigate("/use-cases")}
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
            >
              <span>View all use cases</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedCases.map((rc) => {
              const RCIcon = rc.icon;
              return (
                <div
                  key={rc.slug}
                  onClick={() => navigate(`/use-cases/${rc.slug}`)}
                  className="p-5 rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer group bg-white"
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-3 group-hover:bg-[#0F172A] group-hover:text-white transition-colors">
                    <RCIcon className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors text-sm mb-1">
                    {rc.title}
                  </h4>
                  <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                    {rc.shortDesc}
                  </p>
                  <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <span>Learn more</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Conversion Bottom Strip ─────────────────────────────────── */}
      <section className="w-full bg-[#0F172A] text-white py-12 sm:py-16">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
          <h2
            className="text-2xl sm:text-3xl font-bold text-white mb-3"
            style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
          >
            Start mitigating {useCase.title.toLowerCase()} today
          </h2>
          <p className="text-slate-300 text-sm mb-6">
            Install the 1-file PHP gateway or integrate via direct REST API in under 5 minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate("/user")}
              className="px-7 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-full text-sm shadow-sm transition-all cursor-pointer"
            >
              Start 14-Day Free Trial
            </button>
            <button
              onClick={() => navigate("/use-cases")}
              className="px-7 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-full text-sm border border-slate-700 transition-colors cursor-pointer"
            >
              Browse All Use Cases
            </button>
          </div>
        </div>
      </section>

      {/* ── Global Unified Footer (Identical to Landing Page) ───────── */}
      <SiteFooter />
    </div>
  );
}
