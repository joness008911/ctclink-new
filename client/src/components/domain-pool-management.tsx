import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Globe, Trash2, Info, Upload, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";

interface DomainPoolEntry {
  id: string;
  domain: string;
  description: string | null;
  enabled: boolean;
  createdAt: string;
}

interface DailyLimitResponse {
  limit: number;
}

export default function DomainPoolManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [newDomain, setNewDomain] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [bulkDomains, setBulkDomains] = useState("");
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [dailyLimit, setDailyLimit] = useState<number>(3);

  const { data: domains = [], isLoading } = useQuery<DomainPoolEntry[]>({
    queryKey: ["/api/domain-pool"],
  });

  const { data: limitData } = useQuery<DailyLimitResponse>({
    queryKey: ["/api/domain-pool/settings/limit"],
  });

  useEffect(() => {
    if (limitData?.limit) {
      setDailyLimit(limitData.limit);
    }
  }, [limitData?.limit]);

  const addDomainMutation = useMutation({
    mutationFn: async (data: { domain: string; description?: string }) => {
      return await apiRequest("POST", "/api/domain-pool", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domain-pool"] });
      setNewDomain("");
      setNewDescription("");
      toast({
        title: "Success",
        description: "Domain added to pool",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add domain",
        variant: "destructive",
      });
    },
  });

  const bulkAddMutation = useMutation({
    mutationFn: async (domains: string[]) => {
      return await apiRequest("POST", "/api/domain-pool/bulk", { domains });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/domain-pool"] });
      setBulkDomains("");
      setShowBulkUpload(false);
      toast({
        title: "Bulk Upload Complete",
        description: `Added: ${data.added}, Skipped: ${data.skipped}${data.errors?.length ? `, Errors: ${data.errors.length}` : ''}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Bulk upload failed",
        variant: "destructive",
      });
    },
  });

  const deleteDomainMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/domain-pool/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domain-pool"] });
      toast({
        title: "Success",
        description: "Domain removed from pool",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove domain",
        variant: "destructive",
      });
    },
  });

  const toggleDomainMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return await apiRequest("PATCH", `/api/domain-pool/${id}/toggle`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domain-pool"] });
      toast({
        title: "Success",
        description: "Domain status updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update domain status",
        variant: "destructive",
      });
    },
  });

  const updateLimitMutation = useMutation({
    mutationFn: async (limit: number) => {
      return await apiRequest("PUT", "/api/domain-pool/settings/limit", { limit });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domain-pool/settings/limit"] });
      toast({
        title: "Success",
        description: "Daily generation limit updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update limit",
        variant: "destructive",
      });
    },
  });

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) {
      toast({
        title: "Error",
        description: "Domain is required",
        variant: "destructive",
      });
      return;
    }
    addDomainMutation.mutate({ domain: newDomain.trim(), description: newDescription.trim() || undefined });
  };

  const handleBulkUpload = () => {
    const domainList = bulkDomains
      .split('\n')
      .map(d => d.trim())
      .filter(d => d.length > 0);
    
    if (domainList.length === 0) {
      toast({
        title: "Error",
        description: "Please enter at least one domain",
        variant: "destructive",
      });
      return;
    }

    bulkAddMutation.mutate(domainList);
  };

  const handleUpdateLimit = () => {
    if (dailyLimit < 1 || dailyLimit > 100) {
      toast({
        title: "Error",
        description: "Limit must be between 1 and 100",
        variant: "destructive",
      });
      return;
    }
    updateLimitMutation.mutate(dailyLimit);
  };

  return (
    <div className="space-y-6">
      <Card className="shadow border border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            <Globe className="text-primary mr-2 inline h-5 w-5" />
            Domain Pool Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert data-testid="alert-domain-pool-info">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Add domains to the pool for client users to browse and generate tracking links. 
              Client users can generate up to {limitData?.limit || 3} domains per day.
            </AlertDescription>
          </Alert>

          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">Daily Generation Limit</label>
              <p className="text-xs text-muted-foreground">
                Maximum domains a user can generate per day
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={100}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(parseInt(e.target.value) || 3)}
                className="w-20"
                data-testid="input-daily-limit"
              />
              <Button 
                size="sm" 
                onClick={handleUpdateLimit}
                disabled={updateLimitMutation.isPending}
                data-testid="button-update-limit"
              >
                <Settings className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow border border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            Add Domain
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBulkUpload(!showBulkUpload)}
            data-testid="button-toggle-bulk"
          >
            <Upload className="h-4 w-4 mr-1" />
            {showBulkUpload ? 'Single Add' : 'Bulk Upload'}
          </Button>
        </CardHeader>
        <CardContent>
          {showBulkUpload ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Domains (one per line)
                </label>
                <Textarea
                  placeholder="example1.com&#10;example2.com&#10;example3.com"
                  value={bulkDomains}
                  onChange={(e) => setBulkDomains(e.target.value)}
                  rows={6}
                  data-testid="textarea-bulk-domains"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum 1000 domains at once. Duplicates will be skipped.
                </p>
              </div>
              <Button 
                onClick={handleBulkUpload}
                disabled={bulkAddMutation.isPending}
                data-testid="button-bulk-upload"
              >
                {bulkAddMutation.isPending ? 'Uploading...' : 'Upload Domains'}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleAddDomain} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Domain
                  </label>
                  <Input
                    type="text"
                    placeholder="example.com"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    data-testid="input-domain"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Description (optional)
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g., Fast loading, US servers"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    data-testid="input-description"
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                disabled={addDomainMutation.isPending}
                data-testid="button-add-domain"
              >
                {addDomainMutation.isPending ? 'Adding...' : 'Add Domain'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="shadow border border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Domain Pool ({domains.length} domains)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : domains.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No domains in pool. Add some domains above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((domain) => (
                  <TableRow key={domain.id} data-testid={`domain-row-${domain.id}`}>
                    <TableCell className="font-mono text-sm" data-testid={`domain-name-${domain.id}`}>
                      {domain.domain}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {domain.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={domain.enabled}
                        onCheckedChange={() => toggleDomainMutation.mutate({ id: domain.id, enabled: !domain.enabled })}
                        disabled={toggleDomainMutation.isPending}
                        data-testid={`switch-domain-${domain.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteDomainMutation.mutate(domain.id)}
                        disabled={deleteDomainMutation.isPending}
                        data-testid={`button-delete-domain-${domain.id}`}
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
  );
}
