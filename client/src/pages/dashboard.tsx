import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, Code, Copy, LogOut, Server, Shield, User, ShieldCheck, Trash2, AlertCircle, Info, ScrollText } from "lucide-react";
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
import DomainPoolManagement from "@/components/domain-pool-management";
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="bg-card/50 backdrop-blur-sm shadow-sm border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-green-600 text-white px-3 py-1.5 rounded-full text-sm font-medium">
                <div className="w-2 h-2 bg-white rounded-full inline-block mr-2 animate-pulse"></div>
                Live
              </div>
              <div className="hidden md:flex items-center space-x-2 bg-muted/50 rounded-lg px-3 py-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{user?.username || 'Admin'}</span>
              </div>
              <Button 
                variant="outline" 
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                data-testid="button-logout"
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="container mx-auto p-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="overview" data-testid="tab-overview">📊 Dashboard</TabsTrigger>
              <TabsTrigger value="client-users" data-testid="tab-client-users">👥 Client Users</TabsTrigger>
              <TabsTrigger value="countries" data-testid="tab-countries">🌍 Countries</TabsTrigger>
              <TabsTrigger value="isp-whitelist" data-testid="tab-isp-whitelist">✅ ISP Whitelist</TabsTrigger>
              <TabsTrigger value="isp-blacklist" data-testid="tab-isp-blacklist">❌ ISP Blacklist</TabsTrigger>
              <TabsTrigger value="ip-whitelist" data-testid="tab-ip-whitelist">🔒 IP Whitelist</TabsTrigger>
              <TabsTrigger value="domain-pool" data-testid="tab-domain-pool">🌐 Domain Pool</TabsTrigger>
              <TabsTrigger value="analytics" data-testid="tab-analytics">📈 Analytics</TabsTrigger>
              <TabsTrigger value="settings" data-testid="tab-settings">⚙️ Settings</TabsTrigger>
              <TabsTrigger value="audit-log" data-testid="tab-audit-log">📋 Audit Log</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview">
              <ClassificationTable />
            </TabsContent>

            <TabsContent value="client-users">
              <ClientUserManagement />
            </TabsContent>

            <TabsContent value="countries">
              <CountryWhitelist />
            </TabsContent>

            <TabsContent value="isp-whitelist">
              <IspWhitelist />
            </TabsContent>

            <TabsContent value="isp-blacklist">
              <IspBlacklist />
            </TabsContent>

            <TabsContent value="ip-whitelist">
              <div className="space-y-6">
                {/* Header Card with Enable/Disable Toggle */}
                <Card className="shadow border border-border">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-foreground">
                      <ShieldCheck className="text-primary mr-2 inline h-5 w-5" />
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

            <TabsContent value="domain-pool">
              <DomainPoolManagement />
            </TabsContent>

            <TabsContent value="analytics">
              <AnalyticsDashboard />
            </TabsContent>

            <TabsContent value="settings">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* API Endpoint Info */}
                  <Card className="shadow border border-border">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-foreground">
                        <Code className="text-primary mr-2 inline h-5 w-5" />
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
                      <CardTitle className="text-lg font-semibold text-foreground">
                        <Server className="text-primary mr-2 inline h-5 w-5" />
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
            <TabsContent value="audit-log">
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
                  <div className="overflow-x-auto rounded-lg border">
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
          </Tabs>
      </main>
    </div>
  );
}
