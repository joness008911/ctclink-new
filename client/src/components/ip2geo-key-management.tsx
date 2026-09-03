import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Globe, 
  Key, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle, 
  Activity, 
  Clock, 
  ShieldCheck,
  Zap,
  Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface Ip2LocationHealthInfo {
  status: 'healthy' | 'exhausted' | 'invalid_key' | 'degraded' | 'unconfigured';
  provider: 'ip2location.io' | 'ip2geolocation.io' | 'none';
  lastChecked: string;
  lastSuccess: string | null;
  lastError: {
    code: string | number;
    message: string;
    timestamp: string;
    errorType: string;
  } | null;
  consecutiveFailures: number;
  latencyMs: number | null;
  totalLookups: number;
  successfulLookups: number;
  failedLookups: number;
  keyPreview: string | null;
  hasKey: boolean;
  alertMessage: string | null;
}

interface KeyStatusResponse {
  hasKey: boolean;
  keyPreview: string | null;
  lastUpdated: string;
  health?: Ip2LocationHealthInfo;
}

export default function Ip2GeoKeyManagement() {
  const [newApiKey, setNewApiKey] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: statusData, isLoading, refetch } = useQuery<KeyStatusResponse>({
    queryKey: ["/api/ip2geo-api-key/status"],
    refetchInterval: 15000, // Refresh status every 15s to monitor health live
  });

  const health = statusData?.health;

  // On-demand diagnostic key test mutation
  const testKeyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ip2geo-api-key/test", {});
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ip2geo-api-key/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ip2geo-api-key/health"] });

      if (data.success) {
        toast({
          title: "Diagnostic Test Passed",
          description: data.message || `API Key active. Provider: ${data.details?.provider || 'IP2Location'} (${data.details?.latencyMs || 0}ms)`,
          variant: "default",
        });
      } else {
        toast({
          title: "Diagnostic Warning",
          description: data.message || "Key test detected an issue with the provider.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to execute diagnostic probe.",
        variant: "destructive",
      });
    }
  });

  // Update key mutation
  const updateKeyMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      const response = await apiRequest("PUT", "/api/ip2geo-api-key", { apiKey });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ip2geo-api-key/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ip2geo-api-key/health"] });
      setNewApiKey("");
      setIsEditing(false);

      if (data.success) {
        toast({
          title: "API Key Verified & Saved",
          description: data.message || "API key updated and verified with live provider.",
          variant: "default",
        });
      } else {
        toast({
          title: "API Key Saved with Warnings",
          description: data.message || "Key saved but validation returned an error.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update API key",
        variant: "destructive",
      });
    },
  });

  const handleUpdateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApiKey.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid API key",
        variant: "destructive",
      });
      return;
    }
    updateKeyMutation.mutate(newApiKey.trim());
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString || dateString === "Never") return "Never";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-sm border border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <Globe className="text-primary h-5 w-5" />
            IP2Location API & Geolocation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentStatus = health?.status || (statusData?.hasKey ? 'healthy' : 'unconfigured');

  return (
    <Card className="shadow-sm border border-border" data-testid="card-ip2geo-management">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Globe className="text-primary h-5 w-5" />
              IP2Location API & Proactive Health Monitor
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Monitors quota exhaustion, key validity, and latency with automated fail-safe fallbacks.
            </CardDescription>
          </div>

          <Badge 
            variant={
              currentStatus === 'healthy' ? "default" :
              currentStatus === 'exhausted' ? "destructive" :
              currentStatus === 'invalid_key' ? "destructive" :
              currentStatus === 'degraded' ? "secondary" : "outline"
            }
            className={`text-xs px-2.5 py-0.5 font-medium ${
              currentStatus === 'healthy' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' :
              currentStatus === 'exhausted' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30' :
              currentStatus === 'invalid_key' ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30' :
              currentStatus === 'degraded' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' : ''
            }`}
            data-testid="badge-api-key-status"
          >
            {currentStatus === 'healthy' && (
              <>
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                Active & Healthy
              </>
            )}
            {currentStatus === 'exhausted' && (
              <>
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                Quota Exhausted
              </>
            )}
            {currentStatus === 'invalid_key' && (
              <>
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                Invalid API Key
              </>
            )}
            {currentStatus === 'degraded' && (
              <>
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                Degraded (High Latency)
              </>
            )}
            {currentStatus === 'unconfigured' && (
              <>
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                Not Configured
              </>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Health Alert Banner if degraded or exhausted */}
        {currentStatus === 'exhausted' && (
          <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-200 flex items-start gap-3 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">IP2Location Credit Limit Reached (INSUFFICIENT_CREDIT)</div>
              <p className="mt-0.5 text-muted-foreground leading-relaxed">
                Your IP2Location.io account has depleted its query credits. 
                <strong> CleanTraffic's fail-safe ensures no visitors are blocked</strong>; lookups continue with fallback heuristics. Log in to <a href="https://www.ip2location.io" target="_blank" rel="noreferrer" className="underline font-medium">ip2location.io</a> to replenish credits or update your key below.
              </p>
            </div>
          </div>
        )}

        {currentStatus === 'invalid_key' && (
          <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-200 flex items-start gap-3 text-xs">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Invalid or Expired API Key</div>
              <p className="mt-0.5 text-muted-foreground leading-relaxed">
                The provider returned <code>INVALID_API_KEY</code>. Please generate or copy a valid key from your IP2Location dashboard and save it below.
              </p>
            </div>
          </div>
        )}

        {/* Status Breakdown Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Key className="w-3 h-3" />
              Active Key
            </div>
            <div className="font-mono text-xs font-semibold mt-1 text-foreground">
              {statusData?.keyPreview || "None"}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" />
              API Latency
            </div>
            <div className="text-xs font-semibold mt-1 text-foreground">
              {health?.latencyMs != null ? `${health.latencyMs} ms` : "N/A"}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Activity className="w-3 h-3 text-primary" />
              Provider
            </div>
            <div className="text-xs font-semibold mt-1 text-foreground">
              {health?.provider || "ip2location.io"}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last Verified
            </div>
            <div className="text-xs font-semibold mt-1 text-foreground truncate" title={formatDate(health?.lastChecked)}>
              {health?.lastChecked ? new Date(health.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "N/A"}
            </div>
          </div>
        </div>

        {/* Update Key Form / Action Buttons */}
        {!isEditing ? (
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              data-testid="button-edit-api-key"
            >
              <Key className="w-3.5 h-3.5 mr-1.5 text-primary" />
              {statusData?.hasKey ? "Change API Key" : "Set API Key"}
            </Button>

            <Button
              onClick={() => testKeyMutation.mutate()}
              disabled={testKeyMutation.isPending || !statusData?.hasKey}
              variant="secondary"
              size="sm"
              className="flex-1 text-xs"
              data-testid="button-test-api-key"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${testKeyMutation.isPending ? 'animate-spin' : ''}`} />
              {testKeyMutation.isPending ? "Testing API Key..." : "Test & Verify Key Now"}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleUpdateKey} className="space-y-3 p-3.5 rounded-lg bg-muted/30 border border-border">
            <div className="space-y-1.5">
              <Label htmlFor="apiKey" className="text-xs font-medium">
                New IP2Location / IP2Geolocation API Key
              </Label>
              <Input
                id="apiKey"
                type="password"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder="Paste your 32-character API key here"
                className="font-mono text-xs h-9"
                data-testid="input-new-api-key"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                The key will be tested against live endpoints before saving.
              </p>
            </div>
            
            <div className="flex space-x-2 pt-1">
              <Button
                type="submit"
                size="sm"
                disabled={updateKeyMutation.isPending || !newApiKey.trim()}
                className="flex-1 text-xs"
                data-testid="button-save-api-key"
              >
                {updateKeyMutation.isPending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Validating Key...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                    Verify & Save
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setNewApiKey("");
                }}
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* User Experience & Resiliency Safeguard Explanation */}
        <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-foreground">Fail-Fast User Experience Guarantee:</strong> IP lookups have a hard 1,200ms timeout. If IP2Location experiences downtime, timeouts, or quota exhaustion, CleanTraffic <em>never blocks or errors the visitor</em>. It falls back smoothly to country/ISP heuristics and secondary lookups.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
