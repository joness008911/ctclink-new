import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  CheckCircle, 
  Code, 
  Copy, 
  LogOut, 
  Server, 
  Shield, 
  User, 
  ShieldCheck, 
  Trash2, 
  AlertCircle, 
  Info, 
  ScrollText,
  LayoutDashboard,
  BarChart3,
  Globe,
  ShieldAlert,
  Lock,
  Users,
  Network,
  Mail,
  Settings,
  Menu,
  X,
  ChevronRight,
  Sparkles,
  Activity
} from "lucide-react";
import ClassificationTable from "@/components/classification-table";
import DetectionRules from "@/components/detection-rules";
import ApiKeyManagement from "@/components/api-key-management";
import Ip2GeoKeyManagement from "@/components/ip2geo-key-management";
import RedirectUrlManagement from "@/components/redirect-url-management";
import AnalyticsDashboard from "@/components/analytics-dashboard";
import CountryWhitelist from "@/components/country-whitelist";
import IspWhitelist from "@/components/isp-whitelist";
import IspBlacklist from "@/components/isp-blacklist";
import ClientUserManagement from "@/components/client-user-management";
import WhitelabelDomainSettings from "@/components/whitelabel-domain-settings";
import EmailManagement from "@/components/email-management";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi, type User as AuthUser } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";

interface IpWhitelistEntry {
  id: string;
  label: string;
  cidr: string;
  enabled: boolean;
}

interface IpWhitelistStatus {
  enabled: boolean;
}

interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorType: string;
  action: string;
  targetId: string | null;
  targetType: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ipLabel, setIpLabel] = useState("");
  const [ipCidr, setIpCidr] = useState("");
  
  const { data: user } = useQuery<AuthUser>({
    queryKey: ["/api/auth/user"],
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.clear();
      toast({
        title: "Success",
        description: "Logged out successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Logout failed",
        variant: "destructive",
      });
    },
  });

  const { data: ipWhitelistEntries = [], isLoading: isLoadingEntries } = useQuery<IpWhitelistEntry[]>({
    queryKey: ["/api/client-ip-whitelist"],
  });

  const { data: ipWhitelistStatus } = useQuery<IpWhitelistStatus>({
    queryKey: ["/api/client-ip-whitelist/status"],
  });

  const { data: auditLogEntries = [] } = useQuery<AuditLogEntry[]>({
    queryKey: ["/api/interface/audit-logs"],
    refetchInterval: 30_000,
  });

  const addIpWhitelistMutation = useMutation({
    mutationFn: async (data: { label: string; cidr: string }) => {
      return await apiRequest("POST", "/api/client-ip-whitelist", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-ip-whitelist"] });
      setIpLabel("");
      setIpCidr("");
      toast({
        title: "Success",
        description: "IP whitelist entry added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add IP whitelist entry",
        variant: "destructive",
      });
    },
  });

  const deleteIpWhitelistMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/client-ip-whitelist/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-ip-whitelist"] });
      toast({
        title: "Success",
        description: "IP whitelist entry deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete IP whitelist entry",
        variant: "destructive",
      });
    },
  });

  const toggleIpWhitelistEntryMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return await apiRequest("PATCH", `/api/client-ip-whitelist/${id}/toggle`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-ip-whitelist"] });
      toast({
        title: "Success",
        description: "IP whitelist entry updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update IP whitelist entry",
        variant: "destructive",
      });
    },
  });

  const toggleIpWhitelistStatusMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return await apiRequest("PUT", "/api/client-ip-whitelist/status", { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-ip-whitelist"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-ip-whitelist/status"] });
      toast({
        title: "Success",
        description: "IP whitelist status updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update IP whitelist status",
        variant: "destructive",
      });
    },
  });

  const copyApiUrl = () => {
    const apiUrl = `${window.location.origin}/api/classify`;
    navigator.clipboard.writeText(apiUrl);
    toast({
      title: "Copied",
      description: "API URL copied to clipboard",
    });
  };

  const handleAddIpWhitelist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipLabel.trim() || !ipCidr.trim()) {
      toast({
        title: "Error",
        description: "Both label and CIDR/IP are required",
        variant: "destructive",
      });
      return;
    }
    addIpWhitelistMutation.mutate({ label: ipLabel, cidr: ipCidr });
  };

  const navigationGroups = [
    {
      group: "Traffic & Analytics",
      items: [
        { id: "overview", label: "Live Dashboard", icon: LayoutDashboard, testId: "tab-overview", badge: "Live" },
        { id: "analytics", label: "Traffic Analytics", icon: BarChart3, testId: "tab-analytics" },
      ],
    },
    {
      group: "Security & Filtering",
      items: [
        { id: "countries", label: "Country Whitelist", icon: Globe, testId: "tab-countries" },
        { id: "isp-whitelist", label: "ISP Whitelist", icon: ShieldCheck, testId: "tab-isp-whitelist" },
        { id: "isp-blacklist", label: "ISP Blacklist", icon: ShieldAlert, testId: "tab-isp-blacklist" },
        { id: "ip-whitelist", label: "Client IP Whitelist", icon: Lock, testId: "tab-ip-whitelist" },
      ],
    },
    {
      group: "Client & Services",
      items: [
        { id: "client-users", label: "Client Users", icon: Users, testId: "tab-client-users" },
        { id: "email", label: "Email & SMTP", icon: Mail, testId: "tab-email" },
      ],
    },
    {
      group: "System & Compliance",
      items: [
        { id: "settings", label: "System Settings", icon: Settings, testId: "tab-settings" },
        { id: "audit-log", label: "Audit Log", icon: ScrollText, testId: "tab-audit-log" },
      ],
    },
  ];

  // Lookup current tab label
  const currentNav = navigationGroups
    .flatMap((g) => g.items)
    .find((item) => item.id === activeTab);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex flex-col lg:flex-row">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col lg:flex-row min-h-screen">
        {/* Mobile Header */}
        <div className="lg:hidden bg-card/90 backdrop-blur-md border-b border-border sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="h-9 w-9"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <span className="font-bold text-sm tracking-tight">CleanTraffic Cloak</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="h-8 text-xs gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Backdrop for Mobile Sidebar */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Left-Hand Vertical Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
            mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
          }`}
        >
          {/* Sidebar Header / Brand */}
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-bold text-sm leading-tight text-foreground flex items-center gap-1.5">
                  CleanTraffic
                  <span className="text-[10px] bg-primary text-primary-foreground font-semibold px-1.5 py-0.2 rounded">
                    ADMIN
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">Cloak Control Engine</div>
              </div>
            </div>
            {/* Close button on mobile */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* System Live Status Pill */}
          <div className="px-4 pt-4 pb-2">
            <div className="bg-muted/50 border border-border/80 rounded-lg p-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="font-medium text-foreground">Traffic Defense Engine</span>
              </div>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Online
              </span>
            </div>
          </div>

          {/* Navigation Links Grouped Vertically */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
            <TabsList className="flex flex-col h-auto w-full bg-transparent p-0 space-y-5">
              {navigationGroups.map((group) => (
                <div key={group.group} className="space-y-1 w-full">
                  <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                    {group.group}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isSelected = activeTab === item.id;
                      return (
                        <TabsTrigger
                          key={item.id}
                          value={item.id}
                          data-testid={item.testId}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`w-full justify-start text-xs font-medium px-3 py-2.5 rounded-lg transition-all flex items-center gap-2.5 text-left border ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-sm font-semibold"
                              : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60 border-transparent"
                          }`}
                        >
                          <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-primary-foreground" : "text-muted-foreground"}`} />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                                isSelected
                                  ? "bg-primary-foreground/20 text-primary-foreground"
                                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </TabsTrigger>
                      );
                    })}
                  </div>
                </div>
              ))}
            </TabsList>
          </div>

          {/* Sidebar Footer: Admin Profile & Logout */}
          <div className="p-3 border-t border-border bg-card/80 space-y-2">
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/60">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-semibold truncate text-foreground">
                    {user?.username || "Admin"}
                  </div>
                  <div className="text-[10px] text-muted-foreground capitalize">
                    Administrator
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                data-testid="button-logout"
                title="Logout from Admin Panel"
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content Area on the Right */}
        <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          {/* Top Content Bar */}
          <header className="hidden lg:flex bg-card/50 backdrop-blur-sm border-b border-border px-8 py-3.5 items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground font-normal">Admin Panel</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                {currentNav?.icon && <currentNav.icon className="h-4 w-4 text-primary" />}
                {currentNav?.label || "Dashboard"}
              </span>
            </div>

            <div className="flex items-center space-x-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active Protection</span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                className="gap-1.5 h-8 text-xs"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </Button>
            </div>
          </header>

          {/* Tab Views Content */}
          <div className="p-4 sm:p-6 lg:p-8 flex-1">
            <TabsContent value="overview" className="mt-0 space-y-6">
              <ClassificationTable />
            </TabsContent>

            <TabsContent value="client-users" className="mt-0 space-y-6">
              <ClientUserManagement />
            </TabsContent>

            <TabsContent value="countries" className="mt-0 space-y-6">
              <CountryWhitelist />
            </TabsContent>

            <TabsContent value="isp-whitelist" className="mt-0 space-y-6">
              <IspWhitelist />
            </TabsContent>

            <TabsContent value="isp-blacklist" className="mt-0 space-y-6">
              <IspBlacklist />
            </TabsContent>

            <TabsContent value="ip-whitelist" className="mt-0 space-y-6">
              <div className="space-y-6">
                {/* Header Card with Enable/Disable Toggle */}
                <Card className="shadow border border-border">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <ShieldCheck className="text-primary h-5 w-5" />
                      Client IP Whitelist
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Control which IP addresses can access /user dashboard. Admin interface (/interface) is always accessible.
                    </p>
                    
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="space-y-0.5">
                        <label className="text-sm font-medium">Enable IP Whitelist</label>
                        <p className="text-xs text-muted-foreground">
                          Restrict access to specific IP addresses
                        </p>
                      </div>
                      <Switch
                        checked={ipWhitelistStatus?.enabled || false}
                        onCheckedChange={(checked) => toggleIpWhitelistStatusMutation.mutate(checked)}
                        disabled={toggleIpWhitelistStatusMutation.isPending}
                        data-testid="switch-ip-whitelist-enabled"
                      />
                    </div>

                    {ipWhitelistStatus?.enabled && ipWhitelistEntries.length === 0 && (
                      <Alert variant="destructive" data-testid="alert-empty-whitelist">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          ⚠️ IP whitelist is enabled but empty. All /user access will be blocked!
                        </AlertDescription>
                      </Alert>
                    )}

                    {!ipWhitelistStatus?.enabled && (
                      <Alert data-testid="alert-whitelist-disabled">
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          ℹ️ IP whitelist is disabled. All IPs can access /user dashboard.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                {/* Add New Entry Form Card */}
                <Card className="shadow border border-border">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-foreground">
                      Add New IP Entry
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleAddIpWhitelist} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">
                            Label
                          </label>
                          <Input
                            type="text"
                            placeholder="e.g., Office Network, Home IP"
                            value={ipLabel}
                            onChange={(e) => setIpLabel(e.target.value)}
                            data-testid="input-ip-label"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">
                            CIDR/IP Address
                          </label>
                          <Input
                            type="text"
                            placeholder="192.168.1.100 or 10.0.0.0/24"
                            value={ipCidr}
                            onChange={(e) => setIpCidr(e.target.value)}
                            data-testid="input-ip-cidr"
                          />
                        </div>
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={addIpWhitelistMutation.isPending}
                        data-testid="button-add-ip"
                      >
                        {addIpWhitelistMutation.isPending ? "Adding..." : "Add IP Entry"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Entries List Card */}
                <Card className="shadow border border-border">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-foreground">
                      IP Whitelist Entries
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingEntries ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Loading entries...
                      </div>
                    ) : ipWhitelistEntries.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground" data-testid="empty-state">
                        No IP whitelist entries yet. Add one above to get started.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Label</TableHead>
                            <TableHead>CIDR/IP</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ipWhitelistEntries.map((entry) => (
                            <TableRow key={entry.id} data-testid={`row-ip-entry-${entry.id}`}>
                              <TableCell className="font-medium" data-testid={`label-${entry.id}`}>
                                {entry.label}
                              </TableCell>
                              <TableCell className="font-mono text-sm" data-testid={`cidr-${entry.id}`}>
                                {entry.cidr}
                              </TableCell>
                              <TableCell>
                                <Switch
                                  checked={entry.enabled}
                                  onCheckedChange={() => toggleIpWhitelistEntryMutation.mutate({ id: entry.id, enabled: !entry.enabled })}
                                  disabled={toggleIpWhitelistEntryMutation.isPending}
                                  data-testid={`switch-entry-${entry.id}`}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => deleteIpWhitelistMutation.mutate(entry.id)}
                                  disabled={deleteIpWhitelistMutation.isPending}
                                  data-testid={`button-delete-${entry.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="email" className="mt-0 space-y-6">
              <EmailManagement />
            </TabsContent>

            <TabsContent value="analytics" className="mt-0 space-y-6">
              <AnalyticsDashboard />
            </TabsContent>

            <TabsContent value="settings" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* API Endpoint Info */}
                  <Card className="shadow border border-border">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Code className="text-primary h-5 w-5" />
                        API Endpoint
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                          Classification API
                        </label>
                        <div className="bg-muted rounded-md p-3 font-mono text-sm">
                          <span className="text-green-600 font-medium">POST</span>
                          <span className="ml-2">/api/classify</span>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p className="mb-2">
                          <strong>Response:</strong> JSON with IP, location, browser, device type, 
                          visitor type, detection method, and ISP
                        </p>
                      </div>
                      <Button 
                        className="w-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm font-medium"
                        onClick={copyApiUrl}
                        data-testid="button-copy-api-url"
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy API URL
                      </Button>
                    </CardContent>
                  </Card>

                  <DetectionRules />

                  <RedirectUrlManagement />

                  {/* System Status */}
                  <Card className="shadow border border-border">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Server className="text-primary h-5 w-5" />
                        System Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">API Service</span>
                        <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                          <CheckCircle className="mr-1 h-3 w-3 inline" />
                          Online
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">IP2Geo Service</span>
                        <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                          <CheckCircle className="mr-1 h-3 w-3 inline" />
                          Connected
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Database</span>
                        <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                          <CheckCircle className="mr-1 h-3 w-3 inline" />
                          Active
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  <Ip2GeoKeyManagement />

                  <ApiKeyManagement />

                  <WhitelabelDomainSettings />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="audit-log" className="mt-0 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ScrollText className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Audit Log</h2>
                  <span className="text-sm text-muted-foreground">— last 100 sensitive actions</span>
                </div>
                {auditLogEntries.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ScrollText className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p>No audit log entries yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[160px]">Time</TableHead>
                          <TableHead className="w-[200px]">Action</TableHead>
                          <TableHead>Actor</TableHead>
                          <TableHead>Target</TableHead>
                          <TableHead>IP</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogEntries.map((entry) => (
                          <TableRow key={entry.id} data-testid={`audit-row-${entry.id}`}>
                            <TableCell className="font-mono text-xs whitespace-nowrap">
                              {new Date(entry.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                                {entry.action}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              <div>{entry.actorType}</div>
                              {entry.actorId && (
                                <div className="text-muted-foreground truncate max-w-[120px]" title={entry.actorId}>
                                  {entry.actorId.slice(0, 8)}…
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {entry.targetType && (
                                <div className="text-muted-foreground">{entry.targetType}</div>
                              )}
                              {entry.targetId && (
                                <div className="font-mono truncate max-w-[120px]" title={entry.targetId}>
                                  {entry.targetId.slice(0, 8)}…
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {entry.ipAddress ?? "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                              {entry.metadata
                                ? Object.entries(entry.metadata)
                                    .map(([k, v]) => `${k}: ${String(v)}`)
                                    .join(", ")
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </main>
      </Tabs>
    </div>
  );
}

