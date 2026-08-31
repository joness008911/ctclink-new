import { 
  LayoutDashboard, 
  Radio, 
  FileText, 
  Link as LinkIcon, 
  Code, 
  Settings, 
  Shield, 
  LogOut, 
  X,
  Zap,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface UserSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  user: any;
  apiKeyDetails: any;
  billing: any;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
  logoutPending: boolean;
}

export function UserSidebar({
  activeTab,
  onTabChange,
  user,
  apiKeyDetails,
  billing,
  mobileOpen,
  onCloseMobile,
  onLogout,
  logoutPending,
}: UserSidebarProps) {
  const navItems = [
    { id: "overview", label: "Dashboard", icon: LayoutDashboard, testId: "tab-overview" },
    { id: "live", label: "Live Events", icon: Radio, testId: "tab-live", badge: "Live" },
    { id: "routing", label: "Redirect URLs", icon: LinkIcon, testId: "tab-routing" },
    { id: "integration", label: "Integration Script", icon: Code, testId: "tab-integration" },
    { id: "logs", label: "Traffic Logs", icon: FileText, testId: "tab-logs" },
    { id: "settings", label: "Account Settings", icon: Settings, testId: "tab-settings" },
    { id: "legal", label: "Legal & Privacy", icon: Shield, testId: "tab-legal" },
  ];

  const getInitials = (name?: string) => {
    if (!name) return "CT";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const isLicenseActive = apiKeyDetails?.status === "active";
  const isLicensePaused = apiKeyDetails?.status === "paused";

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0d121d] border-r border-[#1a2333] flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-[#1a2333] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
              <Zap className="h-5 w-5 fill-white text-white" />
            </div>
            <div>
              <div className="font-bold text-sm text-white tracking-tight flex items-center gap-1.5">
                CleanTraffic
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Cloak Client Portal</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-white lg:hidden"
            onClick={onCloseMobile}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* License Status Badge */}
        <div className="px-4 pt-4 pb-2">
          <div className="bg-[#121927] border border-[#1f2b40] rounded-xl p-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isLicenseActive ? "bg-emerald-400" : isLicensePaused ? "bg-amber-400" : "bg-red-400"
                }`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  isLicenseActive ? "bg-emerald-500" : isLicensePaused ? "bg-amber-500" : "bg-red-500"
                }`}></span>
              </span>
              <span className="font-medium text-slate-200">
                {isLicenseActive ? "Shield Active" : isLicensePaused ? "Shield Paused" : "Suspended"}
              </span>
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
              isLicenseActive
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : isLicensePaused
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}>
              {apiKeyDetails?.status || "Live"}
            </span>
          </div>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={item.testId}
                onClick={() => {
                  onTabChange(item.id);
                  onCloseMobile();
                }}
                className={`w-full text-xs font-medium px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-3 text-left ${
                  isSelected
                    ? "bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-[#151d2d]"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-white" : "text-slate-400"}`} />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* User Account Footer */}
        <div className="p-3 border-t border-[#1a2333] bg-[#0b0f19]">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#121927] border border-[#1a2538]">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-sm">
                {getInitials(user?.username || user?.email)}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-semibold truncate text-white">
                  {user?.username || "Client"}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {billing?.subscriptionStatus === "trialing" 
                    ? `Trial (${billing.trialDaysRemaining ?? 0}d left)`
                    : billing?.subscriptionStatus === "active"
                    ? "Pro Subscriber"
                    : "Standard Tier"}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              disabled={logoutPending}
              data-testid="button-logout"
              title="Sign Out"
              className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-500/10 shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
