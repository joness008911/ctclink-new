import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Settings } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { DetectionRules } from "@shared/schema";

export default function DetectionRules() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: rules, isLoading } = useQuery<DetectionRules>({
    queryKey: ["/api/detection-rules"],
  });

  const [localRules, setLocalRules] = useState({
    isp: true,
    mobile: true,
    vpn: true,
    proxy: true,
    tor: true,
    datacenter: true
  });

  useEffect(() => {
    if (rules?.rules && typeof rules.rules === 'object') {
      setLocalRules(rules.rules as any);
    }
  }, [rules]);

  const updateRulesMutation = useMutation({
    mutationFn: async (updatedRules: any) => {
      const response = await apiRequest("PUT", "/api/detection-rules", {
        name: rules?.name || "Default Rules",
        enabled: true,
        rules: updatedRules
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/detection-rules"] });
      toast({
        title: "Success",
        description: "Detection rules updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update detection rules",
        variant: "destructive",
      });
    },
  });

  const handleRuleChange = (ruleKey: string, checked: boolean) => {
    setLocalRules(prev => ({
      ...prev,
      [ruleKey]: checked
    }));
  };

  const handleSave = () => {
    updateRulesMutation.mutate(localRules);
  };

  if (isLoading) {
    return (
      <Card className="shadow border border-border">
        <CardHeader>
          <CardTitle>Detection Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-6 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow border border-border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          <Settings className="text-primary mr-2 inline h-5 w-5" />
          Detection Rules
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-medium text-foreground mb-2">Human Classification</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isp"
                checked={localRules.isp}
                onCheckedChange={(checked) => handleRuleChange('isp', checked as boolean)}
                data-testid="checkbox-isp"
              />
              <label htmlFor="isp" className="text-muted-foreground cursor-pointer">
                ISP Connections
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="mobile"
                checked={localRules.mobile}
                onCheckedChange={(checked) => handleRuleChange('mobile', checked as boolean)}
                data-testid="checkbox-mobile"
              />
              <label htmlFor="mobile" className="text-muted-foreground cursor-pointer">
                Mobile Networks
              </label>
            </div>
          </div>
        </div>
        
        <div className="border-t border-border pt-4">
          <h4 className="font-medium text-foreground mb-2">Bot Classification</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="vpn"
                checked={localRules.vpn}
                onCheckedChange={(checked) => handleRuleChange('vpn', checked as boolean)}
                data-testid="checkbox-vpn"
              />
              <label htmlFor="vpn" className="text-muted-foreground cursor-pointer">
                VPN Services
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="proxy"
                checked={localRules.proxy}
                onCheckedChange={(checked) => handleRuleChange('proxy', checked as boolean)}
                data-testid="checkbox-proxy"
              />
              <label htmlFor="proxy" className="text-muted-foreground cursor-pointer">
                Proxy Servers
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="tor"
                checked={localRules.tor}
                onCheckedChange={(checked) => handleRuleChange('tor', checked as boolean)}
                data-testid="checkbox-tor"
              />
              <label htmlFor="tor" className="text-muted-foreground cursor-pointer">
                Tor Networks
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="datacenter"
                checked={localRules.datacenter}
                onCheckedChange={(checked) => handleRuleChange('datacenter', checked as boolean)}
                data-testid="checkbox-datacenter"
              />
              <label htmlFor="datacenter" className="text-muted-foreground cursor-pointer">
                Datacenter IPs
              </label>
            </div>
          </div>
        </div>
        
        <Button 
          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md transition-colors text-sm font-medium mt-4"
          onClick={handleSave}
          disabled={updateRulesMutation.isPending}
          data-testid="button-save-rules"
        >
          <Save className="mr-2 h-4 w-4" />
          {updateRulesMutation.isPending ? "Saving..." : "Save Rules"}
        </Button>
      </CardContent>
    </Card>
  );
}
