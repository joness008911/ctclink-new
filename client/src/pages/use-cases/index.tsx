import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowDown,
  ChevronRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { USE_CASES } from "@/data/useCases";

export default function UseCasesIndex() {
  const [, navigate] = useLocation();
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const cardsSectionRef = useRef<HTMLDivElement>(null);

  const categories = [
    { id: "all", label: "All Use Cases" },
    { id: "ai", label: "AI & Agents" },
    { id: "security", label: "Security & Fraud" },
    { id: "performance", label: "Infrastructure & Cost" },
    { id: "network", label: "Network & Traffic" },
  ];

  const filteredUseCases = USE_CASES.filter((item) => {
    if (selectedFilter === "all") return true;
    if (selectedFilter === "ai") {
      return ["ai-agents", "ai-and-web-crawlers", "automation-tools"].includes(item.slug);
    }
    if (selectedFilter === "security") {
      return ["ai-agents", "automation-tools", "botnets", "fraud-prevention", "cybersecurity"].includes(item.slug);
    }
    if (selectedFilter === "performance") {
      return ["performance-and-cost", "ai-and-web-crawlers"].includes(item.slug);
    }
    if (selectedFilter === "network") {
      return ["vpns-and-proxies", "ip-intelligence"].includes(item.slug);
    }
    return true;
  });

  const scrollToGrid = () => {
    cardsSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col bg-white text-slate-900 selection:bg-emerald-500 selection:text-white overflow-x-hidden"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* ── Global Unified Floating Navbar (Identical to Landing Page) ── */}
      <SiteNavbar activePage="use-cases" />

      {/* ── Hero Section (Centered Horizontally with Generous Breathing Room) ── */}
      <section className="relative w-full overflow-hidden">
        {/* Subtle architectural framing guidelines inspired by reference composition */}
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="border-x border-dashed border-slate-200/80 min-h-[520px] sm:min-h-[580px] flex flex-col items-center justify-center text-center pt-16 sm:pt-24 md:pt-28 pb-16 sm:pb-24 px-4 sm:px-8">
            
            {/* Centered Eyebrow Pill */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-700 bg-white border border-slate-200/90 shadow-2xs mb-6 sm:mb-8"
            >
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-mono text-[11px] font-bold tracking-wider uppercase border border-emerald-200/80">
                USE CASES
              </span>
              <span className="text-slate-600 font-medium">
                Comprehensive Traffic Protection
              </span>
            </motion.div>

            {/* Confident, Centered Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08 }}
              className="text-3xl sm:text-5xl md:text-6xl lg:text-[4rem] font-bold text-slate-900 tracking-tight leading-[1.12] mb-6 sm:mb-8 max-w-4xl mx-auto"
              style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}
            >
              Protect what matters from{" "}
              <span className="text-emerald-700 font-extrabold">
                unwanted traffic.
              </span>
            </motion.h1>

            {/* Focused Supporting Paragraph */}
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="text-slate-600 text-base sm:text-lg md:text-xl leading-relaxed max-w-2xl mx-auto mb-9 sm:mb-11 font-normal"
            >
              Explore how CleanTraffic helps businesses identify automation, botnets, fraud, and other forms of abusive traffic — while keeping legitimate visitors moving.
            </motion.p>

            {/* Centered Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.24 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full max-w-md"
            >
              <button
                onClick={() => navigate("/user")}
                className="w-full sm:w-auto px-8 py-3.5 bg-[#0F172A] hover:bg-black text-white font-semibold text-[15px] rounded-full shadow-xs hover:shadow transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 group"
              >
                <span>Get Started Free</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={scrollToGrid}
                className="w-full sm:w-auto px-7 py-3.5 bg-white hover:bg-slate-50 text-slate-800 font-medium text-[15px] rounded-full border border-slate-300 shadow-2xs hover:shadow-xs transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Browse All Cases</span>
                <ArrowDown className="w-4 h-4 text-slate-500" />
              </button>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── Natural Transition: Categories & Use Case Cards ──────────── */}
      <div ref={cardsSectionRef} className="w-full bg-[#FAFBFD] border-t border-slate-200/80 py-12 sm:py-16 md:py-20">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header & Filter Controls */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 sm:mb-12">
            <div>
              <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-2">
                Defense Matrix
              </div>
              <h2
                className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight"
                style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
              >
                Explore by threat vector & architecture
              </h2>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedFilter(cat.id)}
                  className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer ${
                    selectedFilter === cat.id
                      ? "bg-[#0F172A] text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:text-slate-900 shadow-2xs"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredUseCases.map((useCase, idx) => {
              const Icon = useCase.icon;
              return (
                <motion.div
                  key={useCase.slug}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.03 }}
                  onClick={() => navigate(`/use-cases/${useCase.slug}`)}
                  className="group rounded-2xl bg-white border border-slate-200/90 hover:border-slate-300 p-6 sm:p-7 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.03)] hover:shadow-[0_12px_32px_-8px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    {/* Top Row: Icon + Badge */}
                    <div className="flex items-center justify-between gap-3 mb-5">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center group-hover:bg-[#0F172A] group-hover:text-white transition-colors duration-200 shadow-2xs">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200/70 px-2.5 py-1 rounded-full group-hover:border-emerald-200 group-hover:text-emerald-700 transition-colors">
                        {useCase.badge}
                      </span>
                    </div>

                    {/* Title */}
                    <h3
                      className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-2 group-hover:text-emerald-700 transition-colors"
                      style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}
                    >
                      {useCase.title}
                    </h3>

                    {/* Tagline */}
                    <p className="text-xs sm:text-sm font-semibold text-emerald-800 mb-3">
                      {useCase.tagline}
                    </p>

                    {/* Short Description */}
                    <p className="text-slate-600 text-sm leading-relaxed mb-6">
                      {useCase.shortDesc}
                    </p>

                    {/* Key Capabilities Preview */}
                    <div className="space-y-2 mb-6 pt-3 border-t border-slate-100">
                      {useCase.howCleanTrafficProtects.capabilities.slice(0, 2).map((cap, cIdx) => (
                        <div key={cIdx} className="flex items-start gap-2 text-xs text-slate-600">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                          <span className="leading-snug">{cap.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dedicated Action Button */}
                  <div className="pt-2">
                    <div className="w-full py-2.5 px-4 rounded-xl bg-slate-50 group-hover:bg-[#0F172A] text-slate-800 group-hover:text-white font-semibold text-xs sm:text-sm border border-slate-200/80 group-hover:border-slate-900 transition-all duration-200 flex items-center justify-between">
                      <span>Explore {useCase.title}</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Global Unified Footer (Identical to Landing Page) ───────── */}
      <SiteFooter />
    </div>
  );
}
