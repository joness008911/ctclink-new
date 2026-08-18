import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Globe, Key, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface KeyStatus {
  hasKey: boolean;
  keyPreview: string | null;
  lastUpdated: string;
}

export default function Ip2GeoKeyManagement() {
  const [newApiKey, setNewApiKey] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: keyStatus, isLoading } = useQuery<KeyStatus>({
    queryKey: ["/api/ip2geo-api-key/status"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const updateKeyMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      const response = await apiRequest("PUT", "/api/ip2geo-api-key", { apiKey });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "API key updated successfully",
        variant: "default",
      });
      setNewApiKey("");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/ip2geo-api-key/status"] });
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

  const formatDate = (dateString: string) => {
    if (dateString === "Never") return dateString;
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow border border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            <Globe className="text-primary mr-2 inline h-5 w-5" />
            IP2Location API
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow border border-border" data-testid="card-ip2geo-management">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          <Globe className="text-primary mr-2 inline h-5 w-5" />
          IP2Location API
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Status:</span>
            <Badge 
              variant={keyStatus?.hasKey ? "default" : "destructive"} 
              className="text-xs"
              data-testid="badge-api-key-status"
            >
              {keyStatus?.hasKey ? (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Active
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Not Set
                </>
              )}
            </Badge>
          </div>

          {keyStatus?.hasKey && keyStatus.keyPreview && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Key:</span>
              <code 
                className="text-xs font-mono bg-muted px-2 py-1 rounded text-muted-foreground"
                data-testid="text-api-key-preview"
              >
                {keyStatus.keyPreview}
              </code>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Last Updated:</span>
            <span 
              className="text-xs text-muted-foreground"
              data-testid="text-last-updated"
            >
              {formatDate(keyStatus?.lastUpdated || "Never")}
            </span>
          </div>
        </div>

        {/* Update Form */}
        {!isEditing ? (
          <Button
            onClick={() => setIsEditing(true)}
            variant="outline"
            size="sm"
            className="w-full"
            data-testid="button-edit-api-key"
          >
            <Key className="w-4 h-4 mr-2" />
            {keyStatus?.hasKey ? "Update API Key" : "Set API Key"}
          </Button>
        ) : (
          <form onSubmit={handleUpdateKey} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="apiKey" className="text-sm font-medium">
                New API Key
              </Label>
              <Input
                id="apiKey"
                type="password"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder="Enter your IP2Location API key"
                className="font-mono text-sm"
                data-testid="input-new-api-key"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                The key will be validated before saving
              </p>
            </div>
            
            <div className="flex space-x-2">
              <Button
                type="submit"
                size="sm"
                disabled={updateKeyMutation.isPending || !newApiKey.trim()}
                className="flex-1"
                data-testid="button-save-api-key"
              >
                {updateKeyMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Save
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
                className="flex-1"
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* Info */}
        <div className="bg-muted/50 p-3 rounded-md">
          <p className="text-xs text-muted-foreground">
            <strong>Seamless Rotation:</strong> Update your API key anytime without affecting 
            backend operations. Perfect for trial renewals or account changes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}