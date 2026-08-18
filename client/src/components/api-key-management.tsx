import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Key, Plus, Trash2, Copy, Eye, EyeOff, Pause, Play, RefreshCw, Calendar, BarChart3, Settings } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ApiKey } from "@shared/schema";

export default function ApiKeyManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [expirationPeriod, setExpirationPeriod] = useState<'10seconds' | '1minute' | '1hour' | 'daily' | 'weekly' | 'monthly' | 'unlimited'>('unlimited');
  const [callLimit, setCallLimit] = useState(1000);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const { data: apiKeys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/api-keys"],
    refetchInterval: 5000, // Refresh more frequently to show real-time updates
  });

  const createKeyMutation = useMutation({
    mutationFn: async (data: { keyName: string; keyValue: string; expirationPeriod: string; callLimit: number }) => {
      const response = await apiRequest("POST", "/api/api-keys", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      resetForm();
      toast({
        title: "Success",
        description: "API key created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create API key",
        variant: "destructive",
      });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/api-keys/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({
        title: "Success",
        description: "API key deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete API key",
        variant: "destructive",
      });
    },
  });

  const pauseKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/api-keys/${id}/pause`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({
        title: "Success",
        description: "API key status updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update API key status",
        variant: "destructive",
      });
    },
  });

  const renewKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/api-keys/${id}/renew`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({
        title: "Success",
        description: "API key renewed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to renew API key",
        variant: "destructive",
      });
    },
  });

  const generateRandomKey = () => {
    const prefix = "ak_";
    const randomPart = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setKeyValue(prefix + randomPart);
  };

  const resetForm = () => {
    setShowForm(false);
    setKeyName("");
    setKeyValue("");
    setExpirationPeriod('unlimited');
    setCallLimit(1000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim() || !keyValue.trim()) {
      toast({
        title: "Error",
        description: "Please provide both key name and value",
        variant: "destructive",
      });
      return;
    }
    createKeyMutation.mutate({ 
      keyName: keyName.trim(), 
      keyValue: keyValue.trim(),
      expirationPeriod,
      callLimit
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    });
  };

  const copyApiUrl = (keyValue: string) => {
    const url = `${window.location.origin}/api/classify?api_key=${keyValue}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied",
      description: "API URL copied to clipboard",
    });
  };

  const toggleKeyVisibility = (keyId: string) => {
    setShowKeys(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return "*".repeat(key.length);
    return key.substring(0, 4) + "*".repeat(key.length - 8) + key.substring(key.length - 4);
  };

  const getStatusBadge = (apiKey: ApiKey) => {
    const now = new Date();
    const isExpired = apiKey.expiresAt && now > new Date(apiKey.expiresAt);
    const isLimitReached = apiKey.callCount >= apiKey.callLimit;
    
    if (isExpired) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (apiKey.status === 'paused') {
      return <Badge variant="secondary">Paused</Badge>;
    }
    if (isLimitReached) {
      return <Badge variant="destructive">Limit Reached</Badge>;
    }
    if (apiKey.status === 'active') {
      return <Badge variant="default">Active</Badge>;
    }
    return <Badge variant="outline">{apiKey.status}</Badge>;
  };

  const getExpirationText = (apiKey: ApiKey) => {
    if (apiKey.expirationPeriod === 'unlimited') return 'Never expires';
    if (!apiKey.expiresAt) return 'No expiration set';
    
    const expiryDate = new Date(apiKey.expiresAt);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Expires today';
    if (diffDays === 1) return 'Expires tomorrow';
    return `Expires in ${diffDays} days`;
  };

  const getUsagePercentage = (apiKey: ApiKey) => {
    return Math.min((apiKey.callCount / apiKey.callLimit) * 100, 100);
  };

  if (isLoading) {
    return (
      <Card className="shadow border border-border">
        <CardHeader>
          <CardTitle>API Key Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow border border-border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          <Key className="text-primary mr-2 inline h-5 w-5" />
          API Key Management
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!showForm ? (
          <Button 
            onClick={() => setShowForm(true)}
            className="w-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            data-testid="button-create-api-key"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create New API Key
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 border border-border rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="keyName" className="block text-sm font-medium text-foreground mb-2">
                  Key Name
                </Label>
                <Input
                  id="keyName"
                  type="text"
                  placeholder="e.g., Production API"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="w-full"
                  data-testid="input-key-name"
                  disabled={createKeyMutation.isPending}
                />
              </div>
              
              <div>
                <Label htmlFor="expirationPeriod" className="block text-sm font-medium text-foreground mb-2">
                  Expiration Period
                </Label>
                <Select value={expirationPeriod} onValueChange={(value: any) => setExpirationPeriod(value)}>
                  <SelectTrigger data-testid="select-expiration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unlimited">Unlimited</SelectItem>
                    <SelectItem value="10seconds">10 Seconds (Testing)</SelectItem>
                    <SelectItem value="1minute">1 Minute (Testing)</SelectItem>
                    <SelectItem value="1hour">1 Hour (Testing)</SelectItem>
                    <SelectItem value="daily">Daily (24 hours)</SelectItem>
                    <SelectItem value="weekly">Weekly (7 days)</SelectItem>
                    <SelectItem value="monthly">Monthly (30 days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="callLimit" className="block text-sm font-medium text-foreground mb-2">
                Call Limit (Custom)
              </Label>
              <Input
                id="callLimit"
                type="number"
                min="1"
                max="100000"
                placeholder="Enter custom call limit (e.g., 3, 10, 30, 1000)"
                value={callLimit}
                onChange={(e) => setCallLimit(parseInt(e.target.value) || 1000)}
                className="w-full"
                data-testid="input-call-limit"
                disabled={createKeyMutation.isPending}
              />
              <div className="text-xs text-muted-foreground mt-1">
                Enter any number between 1 and 100,000 calls
              </div>
            </div>
            
            <div>
              <Label htmlFor="keyValue" className="block text-sm font-medium text-foreground mb-2">
                API Key Value
              </Label>
              <div className="flex space-x-2">
                <Input
                  id="keyValue"
                  type="text"
                  placeholder="ak_example123..."
                  value={keyValue}
                  onChange={(e) => setKeyValue(e.target.value)}
                  className="flex-1"
                  data-testid="input-key-value"
                  disabled={createKeyMutation.isPending}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateRandomKey}
                  disabled={createKeyMutation.isPending}
                  data-testid="button-generate-key"
                >
                  Generate
                </Button>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Button 
                type="submit"
                disabled={createKeyMutation.isPending}
                data-testid="button-save-key"
              >
                {createKeyMutation.isPending ? "Creating..." : "Create Key"}
              </Button>
              <Button 
                type="button"
                variant="outline"
                onClick={resetForm}
                disabled={createKeyMutation.isPending}
                data-testid="button-cancel-key"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Existing API Keys</h4>
          
          {apiKeys.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Key className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>No API keys created yet</p>
              <p className="text-sm">Create your first API key to start using the classification endpoint</p>
            </div>
          ) : (
            apiKeys.map((apiKey) => (
              <div 
                key={apiKey.id} 
                className="border border-border rounded-lg p-4 space-y-3"
                data-testid={`api-key-${apiKey.id}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-medium text-foreground">{apiKey.keyName}</h5>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>Created: {new Date(apiKey.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>{getExpirationText(apiKey)}</span>
                      </div>
                      {apiKey.lastUsed && (
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-3 w-3" />
                          <span>Last used: {new Date(apiKey.lastUsed).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(apiKey)}
                    <Badge variant="outline" className="text-xs">
                      {apiKey.expirationPeriod}
                    </Badge>
                  </div>
                </div>

                {/* Usage Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">API Calls</span>
                    <span className="text-foreground font-medium">
                      {apiKey.callCount.toLocaleString()} / {apiKey.callLimit.toLocaleString()}
                    </span>
                  </div>
                  <Progress value={getUsagePercentage(apiKey)} className="h-2" />
                </div>
                
                <div className="flex items-center space-x-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">
                    {showKeys[apiKey.id] ? apiKey.keyValue : maskKey(apiKey.keyValue)}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleKeyVisibility(apiKey.id)}
                    data-testid={`button-toggle-key-${apiKey.id}`}
                  >
                    {showKeys[apiKey.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(apiKey.keyValue)}
                    data-testid={`button-copy-key-${apiKey.id}`}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyApiUrl(apiKey.keyValue)}
                      className="text-xs"
                      data-testid={`button-copy-url-${apiKey.id}`}
                    >
                      Copy API URL
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => pauseKeyMutation.mutate(apiKey.id)}
                      disabled={pauseKeyMutation.isPending}
                      data-testid={`button-pause-key-${apiKey.id}`}
                    >
                      {apiKey.status === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => renewKeyMutation.mutate(apiKey.id)}
                      disabled={renewKeyMutation.isPending}
                      data-testid={`button-renew-key-${apiKey.id}`}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteKeyMutation.mutate(apiKey.id)}
                    disabled={deleteKeyMutation.isPending}
                    data-testid={`button-delete-key-${apiKey.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}