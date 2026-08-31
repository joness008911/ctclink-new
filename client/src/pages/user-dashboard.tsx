import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { userAuthApi } from "@/lib/user-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Menu, Mail, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400 font-medium">Securing CleanTraffic workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col lg:flex-row">
      {/* Left Vertical Navigation Sidebar */}
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
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header Bar */}
        <div className="lg:hidden p-4 border-b border-[#1a2333] bg-[#0d121d] flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileNavOpen(true)}
              className="h-8 w-8 text-slate-300 hover:text-white hover:bg-[#141d2e]"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
                <Zap className="h-4 w-4 fill-white" />
              </div>
              <span className="font-bold text-sm text-white">CleanTraffic</span>
            </div>
          </div>
          <div className="text-[11px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg">
            Client Portal
          </div>
        </div>

        {/* Dashboard Canvas Container */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Email Verification Banner */}
          {user?.email && !user?.emailVerified && (
            <Alert className="bg-amber-500/10 border-amber-500/30 text-amber-200 rounded-2xl">
              <Mail className="h-4 w-4 text-amber-400" />
              <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <span>
                  <strong>Email Verification Pending:</strong> Please verify <strong>{user.email}</strong> to activate premium geo-edge features.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    window.location.href = `/verification-required?email=${encodeURIComponent(user.email || "")}`;
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-white border-none h-7 px-3 text-xs"
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
              humanUrl={redirectUrls?.humanUrl}
              botUrl={redirectUrls?.botUrl}
            />
          )}

          {activeTab === "logs" && <UserLogsTab classifications={classifications} />}

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
