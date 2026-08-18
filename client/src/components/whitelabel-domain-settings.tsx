import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Globe, Save, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";

interface WhitelabelDomainResponse {
  domain: string | null;
}

export default function WhitelabelDomainSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [domain, setDomain] = useState("");

  const { data: currentDomain, isLoading } = useQuery<WhitelabelDomainResponse>({
    queryKey: ["/api/interface/whitelabel-domain"],
  });

  useEffect(() => {
    if (currentDomain?.domain) {
      setDomain(currentDomain.domain);
    }
  }, [currentDomain]);

  const updateDomainMutation = useMutation({
    mutationFn: async (newDomain: string) => {
      return apiRequest("POST", "/api/interface/whitelabel-domain", { domain: newDomain });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/interface/whitelabel-domain"] });
      toast({
        title: "Success",
        description: "White-label domain updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update white-label domain",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!domain.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid domain URL",
        variant: "destructive",
      });
      return;
    }

    if (!domain.startsWith("http://") && !domain.startsWith("https://")) {
      toast({
        title: "Validation Error",
        description: "Domain must start with http:// or https://",
        variant: "destructive",
      });
      return;
    }

    updateDomainMutation.mutate(domain);
  };

  return (
    <Card className="shadow border border-border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground flex items-center">
          <Globe className="text-primary mr-2 h-5 w-5" />
          White-Label Domain Configuration
        </CardTitle>
        <CardDescription>
          Set a custom subdomain for your white-label API endpoint. This domain will be used in all generated PHP scripts for client users.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Domain Status */}
        {currentDomain?.domain && (
          <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  White-Label Domain Active
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1 font-mono">
                  {currentDomain.domain}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Domain Input */}
        <div className="space-y-2">
          <Label htmlFor="whitelabel-domain" className="text-sm font-medium">
            API Subdomain URL
          </Label>
          <Input
            id="whitelabel-domain"
            type="text"
            placeholder="https://api.yourbusiness.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={isLoading || updateDomainMutation.isPending}
            className="font-mono text-sm"
            data-testid="input-whitelabel-domain"
          />
          <p className="text-xs text-muted-foreground">
            Example: https://api.yourbusiness.com (must include https://)
          </p>
        </div>

        {/* Setup Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Important Setup Steps:
              </p>
              <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
                <li>First, set up your subdomain DNS to point to this Replit deployment</li>
                <li>Configure the subdomain in Replit's Deployments → Settings → Link domain</li>
                <li>Wait for DNS propagation (5 minutes to 48 hours)</li>
                <li>Then enter the domain above and click Save</li>
                <li>Your subdomain will show a blank page (this is correct!)</li>
                <li>The API endpoint /api/classify will still work normally</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={isLoading || updateDomainMutation.isPending || !domain.trim()}
          className="w-full bg-primary text-primary-foreground hover:opacity-90"
          data-testid="button-save-whitelabel-domain"
        >
          <Save className="mr-2 h-4 w-4" />
          {updateDomainMutation.isPending ? "Saving..." : "Save White-Label Domain"}
        </Button>

        {/* Example */}
        <div className="border-t border-border pt-4">
          <p className="text-sm font-medium text-foreground mb-2">What happens after setup:</p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>Client users download PHP scripts with YOUR domain</span>
            </div>
            <div className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>Visiting your subdomain shows blank page (white-label)</span>
            </div>
            <div className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>API classification endpoint works normally at /api/classify</span>
            </div>
            <div className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>Complete white-label experience for your clients</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
