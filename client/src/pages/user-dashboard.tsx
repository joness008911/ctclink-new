import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { userAuthApi } from "@/lib/user-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Menu, 
  Mail, 
  PanelLeftClose, 
  PanelLeftOpen,
  ShieldCheck,
  Zap,
  Activity,
  Search,
  Bell,
  Code
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { UserSidebar } from "@/components/user-dashboard/UserSidebar";
import { UserOverviewTab } from "@/components/user-dashboard/UserOverviewTab";
import { UserLiveEventsTab } from "@/components/user-dashboard/UserLiveEventsTab";
import { UserRoutingTab } from "@/components/user-dashboard/UserRoutingTab";
import { UserIntegrationTab } from "@/components/user-dashboard/UserIntegrationTab";
import { UserLogsTab } from "@/components/user-dashboard/UserLogsTab";
import { UserSettingsTab } from "@/components/user-dashboard/UserSettingsTab";
import { UserLegalTab } from "@/components/user-dashboard/UserLegalTab";

export default function UserDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [customEndpoint, setCustomEndpoint] = useState("");
  
  // Collapsible sidebar state with local storage persistence for PC devices
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("ctc_user_sidebar_collapsed") === "true";
      } catch {
        return false;
      }
    }
    return false;
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("ctc_user_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  // Keyboard shortcut (Ctrl+B / Cmd+B) to collapse/expand sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [globalSearch, setGlobalSearch] = useState("");

  // Keyboard shortcut (Ctrl+K / Cmd+K) to focus search
  useEffect(() => {
    const handleSearchKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("global-search-input")?.focus();
      }
    };
    window.addEventListener("keydown", handleSearchKeyDown);
    return () => window.removeEventListener("keydown", handleSearchKeyDown);
  }, []);

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["/api/user/me"],
    queryFn: userAuthApi.getCurrentUser,
  });

  const { data: stats } = useQuery<{
    totalClassifications: number;
    humanVisitors: number;
    botTraffic: number;
  }>({
    queryKey: ["/api/user/stats"],
    refetchInterval: 15000,
  });

  const { data: redirectUrls } = useQuery<{
    humanUrl: string;
    botUrl: string;
  }>({
    queryKey: ["/api/user/redirect-urls"],
    refetchOnMount: true,
  });

  const { data: classifications = [] } = useQuery<any[]>({
    queryKey: ["/api/user/classifications"],
    refetchInterval: 10000,
  });

  const { data: apiKeyDetails } = useQuery<any>({
    queryKey: ["/api/user/api-key-details"],
    refetchInterval: 20000,
  });

  const { data: apiKeyValue } = useQuery<{ keyValue: string | null }>({
    queryKey: ["/api/user/api-key-value"],
  });

  const { data: billing } = useQuery<{
    subscriptionStatus: string;
    trialEndsAt: string | null;
    trialDaysRemaining: number | null;
    isActive: boolean;
  }>({
    queryKey: ["/api/user/billing"],
    refetchInterval: 60000,
  });

  const { data: whitelabelData } = useQuery<{ domain: string }>({
    queryKey: ["/api/whitelabel-domain"],
  });

  useEffect(() => {
    if (!customEndpoint) {
      if (whitelabelData?.domain) {
        const domain = whitelabelData.domain;
        setCustomEndpoint(
          domain.startsWith("http://") || domain.startsWith("https://")
            ? domain
            : `https://api.${domain}`
        );
      } else if (typeof window !== "undefined") {
        setCustomEndpoint(window.location.origin);
      }
    }
  }, [whitelabelData]);

  const toggleLicenseMutation = useMutation({
    mutationFn: async (pause: boolean) => {
      if (!apiKeyDetails?.id) return;
      const endpoint = pause
        ? `/api/api-keys/${apiKeyDetails.id}/pause`
        : `/api/api-keys/${apiKeyDetails.id}/resume`;
      const response = await apiRequest("POST", endpoint, {});
      return response.json();
    },
    onSuccess: (_, pause) => {
      toast({
        title: pause ? "License Paused" : "Defense Shield Resumed",
        description: pause
          ? "Traffic is safely deflected to bot URL while paused"
          : "Active traffic classification is running normally",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-key-details"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Action Failed",
        description: error.message || "Failed to update license state",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: userAuthApi.logout,
    onSuccess: () => {
      queryClient.clear();
      navigate("/");
    },
  });

  const handleToggleLicense = () => {
    const isPaused = apiKeyDetails?.status === "paused";
    toggleLicenseMutation.mutate(!isPaused);
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-[#F7F9F8] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#0A5C48] border-t-transparent animate-spin mx-auto"></div>
          <p className="text-xs text-[#52635B] font-medium tracking-wide">Securing CleanTraffic workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9F8] text-[#0F172A] flex flex-col lg:flex-row antialiased selection:bg-[#E6F2ED] selection:text-[#07382D]">
      {/* Left Navigation Sidebar */}
      <UserSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={user}
        apiKeyDetails={apiKeyDetails}
        billing={billing}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        onLogout={() => logoutMutation.mutate()}
        logoutPending={logoutMutation.isPending}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        {/* Desktop Top Header Bar */}
        <header className="hidden lg:flex items-center justify-between px-6 py-3 bg-[#FCFDFD] border-b border-[#E5EAE7] sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#52635B] hover:text-[#0F172A] hover:bg-[#F0F4F2] border border-[#E5EAE7] transition-all shadow-xs"
            >
              {isSidebarCollapsed ? (
                <>
                  <PanelLeftOpen className="h-4 w-4 text-[#0A5C48]" />
                  <span>Expand</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4 text-[#7A8B83]" />
                  <span>Collapse</span>
                </>
              )}
              <kbd className="text-[10px] bg-[#EEF3F0] border border-[#D5DFD9] px-1.5 py-0.5 rounded text-[#64748B] font-mono">
                Ctrl+B
              </kbd>
            </button>

            <div className="h-4 w-[1px] bg-[#E5EAE7]" />

            {/* Global Quick Search Bar (Matching Reference) */}
            <div className="relative w-72 lg:w-96">
              <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
              <Input
                id="global-search-input"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search IP, domain, endpoint, user agent..."
                className="pl-9 pr-14 text-xs h-8 bg-slate-50 border-slate-200 text-slate-900 rounded-lg placeholder:text-slate-400 focus:bg-white focus:border-[#0A5C48] shadow-2xs"
              />
              <div className="absolute right-2 top-2 flex items-center gap-0.5 pointer-events-none">
                <kbd className="text-[10px] bg-white border border-slate-200 px-1 py-0.2 rounded text-slate-400 font-mono">
                  ⌘K
                </kbd>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick status indicator */}
            <div className="flex items-center gap-2 bg-[#F2F6F4] border border-[#DEE7E2] px-3 py-1 rounded-lg text-xs">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  apiKeyDetails?.status === "active" ? "bg-[#0A5C48]" : "bg-amber-500"
                }`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  apiKeyDetails?.status === "active" ? "bg-[#0A5C48]" : "bg-amber-500"
                }`}></span>
              </span>
              <span className="text-[11px] font-semibold text-[#2D3B35]">
                {apiKeyDetails?.status === "active" ? "Defense Engine Online" : "Engine Paused"}
              </span>
            </div>

            <div className="text-[11px] font-bold text-[#07382D] bg-[#E6F2ED] border border-[#CCE5DB] px-2.5 py-1 rounded-lg">
              {billing?.subscriptionStatus === "active" ? "Enterprise Pro" : "Standard Tier"}
            </div>
          </div>
        </header>

        {/* Mobile Header Bar */}
        <div className="lg:hidden p-4 border-b border-[#E5EAE7] bg-[#FCFDFD] flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileNavOpen(true)}
              className="h-8 w-8 text-[#52635B] hover:text-[#0F172A] hover:bg-[#F2F6F4]"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0A3E33] to-[#05241C] border border-[#135848] flex items-center justify-center text-white font-bold">
                <ShieldCheck className="h-4 w-4 text-[#34D399]" />
              </div>
              <span className="font-bold text-sm text-[#0F172A] tracking-tight">CleanTraffic</span>
            </div>
          </div>
          <div className="text-[11px] font-semibold text-[#07382D] bg-[#E6F2ED] border border-[#CCE5DB] px-2.5 py-1 rounded-lg">
            Client Portal
          </div>
        </div>

        {/* Dashboard Canvas Container */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Email Verification Banner */}
          {user?.email && !user?.emailVerified && (
            <Alert className="bg-amber-50/80 border-amber-200 text-amber-900 rounded-xl shadow-xs">
              <Mail className="h-4 w-4 text-amber-700" />
              <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <span>
                  <strong>Email Verification Notice:</strong> Verify <strong>{user.email}</strong> to activate premium geo-edge security capabilities.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    window.location.href = `/verification-required?email=${encodeURIComponent(user.email || "")}`;
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold border-none h-7 px-3 text-xs rounded-lg shadow-xs"
                >
                  Verify Email
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Active Tab View Rendering */}
          {activeTab === "overview" && (
            <UserOverviewTab
              user={user}
              stats={stats}
              apiKeyDetails={apiKeyDetails}
              classifications={classifications}
              onToggleLicense={handleToggleLicense}
              toggleLicensePending={toggleLicenseMutation.isPending}
              onNavigateTab={(tab) => setActiveTab(tab)}
              humanUrl={redirectUrls?.humanUrl}
              botUrl={redirectUrls?.botUrl}
            />
          )}

          {activeTab === "live" && <UserLiveEventsTab />}

          {activeTab === "routing" && <UserRoutingTab />}

          {activeTab === "integration" && (
            <UserIntegrationTab
              apiKeyValue={apiKeyValue?.keyValue || null}
              customEndpoint={customEndpoint}
              setCustomEndpoint={setCustomEndpoint}
            />
          )}

          {activeTab === "logs" && (
            <UserLogsTab
              classifications={classifications}
              humanUrl={redirectUrls?.humanUrl}
              botUrl={redirectUrls?.botUrl}
            />
          )}

          {activeTab === "settings" && (
            <UserSettingsTab
              user={user}
              billing={billing}
              apiKeyDetails={apiKeyDetails}
            />
          )}

          {activeTab === "legal" && <UserLegalTab />}
        </main>
      </div>
    </div>
  );
}
