import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { XCircle, Loader2, Trash2, Plus, Download } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function IspBlacklist() {
  const { toast } = useToast();
  const [filterCategory, setFilterCategory] = useState("all");
  const [newIspName, setNewIspName] = useState("");
  const [newIspCategory, setNewIspCategory] = useState("Datacenter");
  const [bulkIspText, setBulkIspText] = useState("");
  const [bulkCategory, setBulkCategory] = useState("Datacenter");

  const { data: blacklistedIsps = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/isp-blacklist"],
  });

  const loadDefaultsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/isp-blacklist/load-defaults");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/isp-blacklist"] });
      toast({
        title: "Success",
        description: `${data.loaded} bot ISPs loaded into blacklist`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to load default blacklist",
        variant: "destructive",
      });
    },
  });

  const addIspMutation = useMutation({
    mutationFn: async (isp: { ispName: string; category: string }) => {
      return apiRequest("POST", "/api/isp-blacklist", isp);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isp-blacklist"] });
      setNewIspName("");
      toast({
        title: "Success",
        description: "ISP added to blacklist",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add ISP to blacklist",
        variant: "destructive",
      });
    },
  });

  const removeIspMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/isp-blacklist/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isp-blacklist"] });
      toast({
        title: "Success",
        description: "ISP removed from blacklist",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove ISP from blacklist",
        variant: "destructive",
      });
    },
  });

  const bulkAddMutation = useMutation({
    mutationFn: async (data: { ispNames: string[]; category: string }) => {
      return apiRequest("POST", "/api/isp-blacklist/bulk", data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/isp-blacklist"] });
      setBulkIspText("");
      toast({
        title: "Success",
        description: `${data.added} ISPs added to blacklist`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to bulk add ISPs",
        variant: "destructive",
      });
    },
  });

  const handleAddIsp = () => {
    if (!newIspName.trim()) {
      toast({
        title: "Error",
        description: "Please enter an ISP name",
        variant: "destructive",
      });
      return;
    }

    addIspMutation.mutate({
      ispName: newIspName.trim(),
      category: newIspCategory,
    });
  };

  const handleBulkAdd = () => {
    if (!bulkIspText.trim()) {
      toast({
        title: "Error",
        description: "Please enter ISP names (one per line)",
        variant: "destructive",
      });
      return;
    }

    const ispNames = bulkIspText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (ispNames.length === 0) {
      toast({
        title: "Error",
        description: "No valid ISP names found",
        variant: "destructive",
      });
      return;
    }

    bulkAddMutation.mutate({
      ispNames,
      category: bulkCategory,
    });
  };

  const filteredIsps = filterCategory === "all"
    ? blacklistedIsps
    : blacklistedIsps.filter(isp => isp.category === filterCategory);

  const categoryStats = blacklistedIsps.reduce((acc: any, isp: any) => {
    acc[isp.category] = (acc[isp.category] || 0) + 1;
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            ISP Blacklist (Known Bots)
          </CardTitle>
          <CardDescription>
            Block known datacenter, VPN, and proxy ISPs. Visitors from these ISPs will be classified as Bots.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => loadDefaultsMutation.mutate()}
              disabled={loadDefaultsMutation.isPending}
              variant="outline"
              className="bg-primary/10"
              data-testid="button-load-defaults"
            >
              {loadDefaultsMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              <Download className="h-4 w-4 mr-2" />
              Load Default Blacklist (50+ Bot ISPs)
            </Button>

            <div className="flex-1">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger data-testid="select-category-filter">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories ({blacklistedIsps.length})</SelectItem>
                  {Object.entries(categoryStats).map(([category, count]) => (
                    <SelectItem key={category} value={category}>
                      {category} ({count as number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-medium">Add Custom Blacklist Entry</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                placeholder="ISP Name (e.g., Amazon.com)"
                value={newIspName}
                onChange={(e) => setNewIspName(e.target.value)}
                className="md:col-span-2"
                data-testid="input-blacklist-isp-name"
              />
              <Select value={newIspCategory} onValueChange={setNewIspCategory}>
                <SelectTrigger data-testid="select-blacklist-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Datacenter">Datacenter</SelectItem>
                  <SelectItem value="VPN">VPN</SelectItem>
                  <SelectItem value="Proxy">Proxy</SelectItem>
                  <SelectItem value="Tor">Tor</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleAddIsp}
              disabled={addIspMutation.isPending}
              data-testid="button-add-to-blacklist"
            >
              {addIspMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              <Plus className="h-4 w-4 mr-2" />
              Add to Blacklist
            </Button>
          </div>

          <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
            <h3 className="font-medium">Bulk Upload ISPs</h3>
            <p className="text-sm text-muted-foreground">
              Enter multiple ISP names (one per line) to add them all at once
            </p>
            <textarea
              placeholder={"Example:\nAmazon.com\nGoogle LLC\nMicrosoft Corporation\nDigitalOcean"}
              value={bulkIspText}
              onChange={(e) => setBulkIspText(e.target.value)}
              className="w-full h-32 p-3 border rounded-md resize-none font-mono text-sm"
              data-testid="textarea-bulk-upload"
            />
            <div className="flex items-center gap-4">
              <Select value={bulkCategory} onValueChange={setBulkCategory}>
                <SelectTrigger className="w-48" data-testid="select-bulk-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Datacenter">Datacenter</SelectItem>
                  <SelectItem value="VPN">VPN</SelectItem>
                  <SelectItem value="Proxy">Proxy</SelectItem>
                  <SelectItem value="Tor">Tor</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleBulkAdd}
                disabled={bulkAddMutation.isPending}
                variant="default"
                data-testid="button-bulk-upload"
              >
                {bulkAddMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                <Plus className="h-4 w-4 mr-2" />
                Bulk Add ISPs
              </Button>
            </div>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ISP Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIsps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      {blacklistedIsps.length === 0 
                        ? "No blacklisted ISPs. Click 'Load Default Blacklist' to start."
                        : "No ISPs in this category"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredIsps.map((isp: any) => (
                    <TableRow key={isp.id} data-testid={`row-blacklist-${isp.id}`}>
                      <TableCell className="font-medium">{isp.ispName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{isp.category || "Uncategorized"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={isp.enabled ? "destructive" : "secondary"}>
                          {isp.enabled ? "🔴 Blocking" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeIspMutation.mutate(isp.id)}
                          disabled={removeIspMutation.isPending}
                          data-testid={`button-remove-blacklist-${isp.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="text-muted-foreground">
              🚫 {filteredIsps.length} ISPs blacklisted
              {filterCategory && ` in ${filterCategory} category`}
            </div>
            {Object.keys(categoryStats).length > 0 && (
              <div className="flex gap-2">
                {Object.entries(categoryStats).map(([category, count]) => (
                  <Badge key={category} variant="outline">
                    {category}: {count as number}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
