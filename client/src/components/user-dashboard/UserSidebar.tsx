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
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Activity,
  Layers,
  ChevronRight,
  ChevronDown,
  Building2,
  Bell,
  SlidersHorizontal,
  MoreVertical
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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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
  isCollapsed = false,
  onToggleCollapse,
}: UserSidebarProps) {
  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard, testId: "tab-overview" },
    { id: "logs", label: "Visitor Logs", icon: FileText, testId: "tab-logs" },
    { id: "live", label: "Real-time", icon: Radio, testId: "tab-live", badge: "Live" },
    { id: "routing", label: "Rules & Policies", icon: SlidersHorizontal, testId: "tab-routing" },
    { id: "integration", label: "Integrations", icon: Code, testId: "tab-integration" },
    { id: "settings", label: "Settings", icon: Settings, testId: "tab-settings" },
    { id: "legal", label: "Compliance & Privacy", icon: Shield, testId: "tab-legal" },
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
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-[#FDFEFE] border-r border-[#E2E8F0] flex flex-col transition-all duration-300 ease-in-out lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0 shadow-2xl w-64" : "-translate-x-full"
        } ${
          isCollapsed ? "lg:w-[76px]" : "lg:w-64"
        }`}
      >
        {/* Brand Header */}
        <div className={`p-4 border-b border-[#E2E8F0] flex items-center transition-all ${
          isCollapsed ? "justify-center flex-col gap-2" : "justify-between"
        }`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div 
              className="w-9 h-9 rounded-xl bg-[#064E3B] border border-[#047857] flex items-center justify-center text-white shadow-xs shrink-0 cursor-pointer transition-transform hover:scale-105"
              onClick={onToggleCollapse}
              title={isCollapsed ? "Expand sidebar" : "CleanTraffic Cloak Portal"}
            >
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <div className="font-bold text-sm text-slate-900 tracking-tight flex items-center gap-1.5">
                  CleanTraffic
                </div>
                <div className="text-[11px] text-slate-500 font-medium truncate">
                  IP Intelligence & Defense
                </div>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={isCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
              className={`hidden lg:flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all ${
                isCollapsed ? "w-8 h-8 mt-1 border border-slate-200" : "w-7 h-7"
              }`}
            >
              {isCollapsed ? (
                <PanelLeftOpen className="h-4 w-4 text-[#0A5C48]" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          )}

          {/* Mobile Close Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-slate-900 lg:hidden"
            onClick={onCloseMobile}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Workspace / Campaign Selector Card (Matching Reference Image) */}
        {!isCollapsed ? (
          <div className="px-3 pt-3 pb-1">
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#CBD5E1] transition-all rounded-xl p-2.5 flex items-center justify-between cursor-pointer group shadow-2xs">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs shrink-0">
                  <Building2 className="h-3.5 w-3.5" />
                </div>
                <div className="overflow-hidden">
                  <div className="font-bold text-xs text-slate-900 truncate">
                    {user?.fullName || user?.username || "Acme Corp"}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium truncate">
                    Production Campaign
                  </div>
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700 transition-colors shrink-0" />
            </div>
          </div>
        ) : (
          <div className="p-2 flex justify-center">
            <div 
              className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs cursor-pointer"
              title="Campaign: Production"
            >
              <Building2 className="h-4 w-4" />
            </div>
          </div>
        )}

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;

            return (
              <div key={item.id} className="relative group">
                <button
                  type="button"
                  data-testid={item.testId}
                  onClick={() => {
                    onTabChange(item.id);
                    onCloseMobile();
                  }}
                  title={isCollapsed ? item.label : undefined}
                  className={`transition-all flex items-center rounded-xl ${
                    isCollapsed
                      ? "w-10 h-10 mx-auto justify-center"
                      : "w-full text-xs font-medium px-3 py-2.5 gap-3 text-left"
                  } ${
                    isSelected
                      ? "bg-[#E6F4EA] text-[#0A5C48] font-bold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <div className="relative shrink-0">
                    <Icon
                      className={`h-4 w-4 transition-colors ${
                        isSelected ? "text-[#0A5C48]" : "text-slate-500 group-hover:text-slate-900"
                      }`}
                    />
                    {isCollapsed && isSelected && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#0A5C48] ring-2 ring-white" />
                    )}
                  </div>

                  {!isCollapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0A5C48] shrink-0" />
                      )}
                      {item.badge && !isSelected && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </button>

                {/* Collapsed Tooltip */}
                {isCollapsed && (
                  <div className="hidden lg:group-hover:flex absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-md shadow-xl z-50 whitespace-nowrap items-center gap-2 pointer-events-none animate-in fade-in-50 zoom-in-95 duration-150">
                    <span>{item.label}</span>
                    <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Usage Meter Widget (Live API Key Usage & Quota Tracker) */}
        {!isCollapsed && (
          <div className="p-3 mx-3 mb-2 rounded-xl bg-slate-50/80 border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>Usage This Month</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-slate-200/70 text-slate-700">
                {billing?.subscriptionStatus === "active" ? "PRO PLAN" : "TRIAL"}
              </span>
            </div>
            {(() => {
              const used = apiKeyDetails?.callCount ?? 0;
              const limit = apiKeyDetails?.callLimit ?? (billing?.subscriptionStatus === "trialing" ? 5000 : 50000);
              const percentage = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
              const trialDays = billing?.trialDaysRemaining;
              
              const formatK = (n: number) => {
                if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
                if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
                return n.toString();
              };

              return (
                <>
                  <div className="flex items-baseline justify-between font-bold text-slate-900">
                    <span>
                      {formatK(used)}{" "}
                      <span className="text-slate-400 font-normal">
                        / {formatK(limit)} requests
                      </span>
                    </span>
                    <span className="text-slate-500 text-[11px]">{percentage}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        percentage > 90 ? "bg-rose-500" : percentage > 75 ? "bg-amber-500" : "bg-[#0A5C48]"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>
                      {billing?.subscriptionStatus === "trialing"
                        ? trialDays !== null && trialDays !== undefined
                          ? `Trial: ${trialDays} day${trialDays === 1 ? "" : "s"} left`
                          : "14-Day Free Trial"
                        : "Resets next billing cycle"}
                    </span>
                    <span className="text-slate-500 font-medium">
                      {isLicenseActive ? "Active" : apiKeyDetails?.status || "Live"}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* User Account Profile Footer (Matching Reference) */}
        <div className="p-3 border-t border-[#E2E8F0] bg-white">
          {!isCollapsed ? (
            <div className="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#0A5C48] font-bold text-xs flex items-center justify-center shrink-0">
                  {getInitials(user?.fullName || user?.username)}
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {user?.fullName || user?.username || "John Admin"}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {user?.email || "admin@acme.com"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                disabled={logoutPending}
                title="Sign Out"
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div 
                className="w-9 h-9 rounded-full bg-emerald-100 text-[#0A5C48] font-bold text-xs flex items-center justify-center cursor-pointer shadow-xs"
                title={`Account: ${user?.username || "Admin"}`}
              >
                {getInitials(user?.fullName || user?.username)}
              </div>
              <button
                type="button"
                onClick={onLogout}
                disabled={logoutPending}
                title="Sign Out"
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
