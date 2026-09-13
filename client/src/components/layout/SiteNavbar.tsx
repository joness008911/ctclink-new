import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ShieldCheck, Menu, X, ChevronRight } from "lucide-react";

interface SiteNavbarProps {
  activePage?: "home" | "use-cases" | "docs" | "pricing";
}

export function SiteNavbar({ activePage }: SiteNavbarProps) {
  const [location, navigate] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavAnchor = (hash: string) => {
    setMobileMenuOpen(false);
    if (location === "/") {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    navigate(`/${hash}`);
  };

  const isUseCasesActive = activePage === "use-cases" || location.startsWith("/use-cases");

  return (
    <header className="sticky top-3 sm:top-4 z-50 w-full px-3 sm:px-6 lg:px-8 transition-all duration-300">
      <div
        className={`w-full max-w-7xl mx-auto rounded-full transition-all duration-300 ${
          isScrolled
            ? "bg-white/92 backdrop-blur-md border border-slate-200/80 shadow-[0_10px_30px_-8px_rgba(15,23,42,0.12),0_2px_8px_-2px_rgba(15,23,42,0.04)] py-2 sm:py-2.5 px-4 sm:px-6"
            : "backdrop-blur-xl border border-white/55 py-2 sm:py-2.5 px-4 sm:px-6"
        } flex items-center justify-between`}
        style={
          !isScrolled
            ? {
                background:
                  "linear-gradient(135deg, rgba(255, 255, 255, 0.38) 0%, rgba(220, 238, 254, 0.32) 45%, rgba(195, 226, 253, 0.25) 100%)",
                boxShadow:
                  "inset 0 1px 1.5px 0 rgba(255, 255, 255, 0.75), 0 8px 32px -8px rgba(30, 64, 175, 0.12), 0 2px 8px -2px rgba(15, 23, 42, 0.03)",
              }
            : undefined
        }
      >
        {/* Brand Logo */}
        <div
          onClick={() => {
            setMobileMenuOpen(false);
            navigate("/");
          }}
          className="flex items-center gap-2.5 cursor-pointer group select-none shrink-0"
        >
          <div className="w-8 h-8 rounded-xl bg-[#064E3B] border border-[#047857] flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
          </div>
          <span className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
            CleanTraffic
          </span>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 lg:gap-9 xl:gap-11 text-[14px] font-medium text-slate-800">
          <button
            onClick={() => handleNavAnchor("#features")}
            className="hover:text-slate-950 transition-colors cursor-pointer"
          >
            Features
          </button>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              navigate("/use-cases");
            }}
            className={`transition-colors cursor-pointer flex items-center gap-1.5 ${
              isUseCasesActive
                ? "text-emerald-700 font-semibold"
                : "text-slate-800 hover:text-slate-950"
            }`}
          >
            <span>Use Cases</span>
            {isUseCasesActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            )}
          </button>
          <button
            onClick={() => handleNavAnchor("#how-it-works")}
            className="hover:text-slate-950 transition-colors cursor-pointer"
          >
            Detection Engine
          </button>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              navigate("/use-cases/ai-agents");
            }}
            className={`hover:text-slate-950 transition-colors cursor-pointer ${
              location === "/use-cases/ai-agents" ? "text-orange-600 font-semibold" : ""
            }`}
          >
            AI Agents
          </button>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              navigate("/use-cases/fraud-prevention");
            }}
            className="hover:text-slate-950 transition-colors cursor-pointer"
          >
            Fraud Prevention
          </button>
          <button
            onClick={() => handleNavAnchor("#pricing")}
            className="hover:text-slate-950 transition-colors cursor-pointer"
          >
            Pricing
          </button>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              navigate("/docs");
            }}
            className={`hover:text-slate-950 transition-colors cursor-pointer ${
              activePage === "docs" ? "text-emerald-700 font-semibold" : ""
            }`}
          >
            Docs
          </button>
        </nav>

        {/* Desktop CTA Action Buttons */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <button
            onClick={() => navigate("/user")}
            className="text-[14px] font-medium text-slate-800 hover:text-slate-950 transition-colors px-3 py-2 cursor-pointer"
          >
            Log in
          </button>
          <button
            onClick={() => navigate("/user")}
            className="text-[14px] font-semibold bg-[#0F172A] hover:bg-black text-white px-5 sm:px-6 py-2 rounded-full shadow-xs hover:shadow transition-all duration-200 cursor-pointer"
          >
            Try CleanTraffic free
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-slate-800 p-2 rounded-full hover:bg-white/40 min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div
          className={`md:hidden w-full max-w-7xl mx-auto mt-2 rounded-2xl p-5 flex flex-col gap-3.5 shadow-xl transition-all duration-300 ${
            isScrolled
              ? "bg-white/95 backdrop-blur-xl border border-slate-200/80"
              : "backdrop-blur-2xl border border-white/60"
          }`}
          style={
            !isScrolled
              ? {
                  background:
                    "linear-gradient(180deg, rgba(255, 255, 255, 0.75) 0%, rgba(224, 241, 255, 0.7) 100%)",
                  boxShadow:
                    "inset 0 1px 2px 0 rgba(255, 255, 255, 0.9), 0 20px 40px -15px rgba(30, 64, 175, 0.15)",
                }
              : undefined
          }
        >
          <button
            onClick={() => handleNavAnchor("#features")}
            className="text-[15px] font-medium text-slate-700 py-1 text-left hover:text-slate-950"
          >
            Features
          </button>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              navigate("/use-cases");
            }}
            className={`text-[15px] font-medium py-1 text-left ${
              isUseCasesActive ? "text-emerald-700 font-semibold" : "text-slate-700 hover:text-slate-950"
            }`}
          >
            Use Cases
          </button>
          <button
            onClick={() => handleNavAnchor("#how-it-works")}
            className="text-[15px] font-medium text-slate-700 py-1 text-left hover:text-slate-950"
          >
            Detection Engine
          </button>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              navigate("/use-cases/ai-agents");
            }}
            className={`text-[15px] font-medium py-1 text-left ${
              location === "/use-cases/ai-agents" ? "text-orange-600 font-semibold" : "text-slate-700 hover:text-slate-950"
            }`}
          >
            AI Agents
          </button>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              navigate("/use-cases/fraud-prevention");
            }}
            className="text-[15px] font-medium text-slate-700 py-1 text-left hover:text-slate-950"
          >
            Fraud Prevention
          </button>
          <button
            onClick={() => handleNavAnchor("#pricing")}
            className="text-[15px] font-medium text-slate-700 py-1 text-left hover:text-slate-950"
          >
            Pricing
          </button>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              navigate("/docs");
            }}
            className="text-[15px] font-medium text-slate-700 py-1 text-left hover:text-slate-950"
          >
            Documentation
          </button>

          <div className="pt-3 border-t border-slate-200/60 flex flex-col gap-2.5">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate("/user");
              }}
              className="w-full py-2.5 text-center text-[14px] font-medium text-slate-800 hover:text-slate-950 bg-white/50 rounded-xl border border-white/60"
            >
              Log in
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate("/user");
              }}
              className="w-full py-2.5 text-center text-[14px] font-semibold text-white bg-[#0F172A] hover:bg-black rounded-xl shadow-xs"
            >
              Try CleanTraffic free
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
