import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Loader2, Trash2, Upload, Plus } from "lucide-react";
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

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
];

export default function IspWhitelist() {
  const { toast } = useToast();
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [bulkIspText, setBulkIspText] = useState("");
  const [singleIsp, setSingleIsp] = useState("");

  const { data: whitelistedIsps = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/isp-whitelist"],
  });

  const addIspMutation = useMutation({
    mutationFn: async (isp: { ispName: string; countryCode: string | null }) => {
      return apiRequest("POST", "/api/isp-whitelist", isp);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isp-whitelist"] });
      setSingleIsp("");
    },
  });

  const bulkAddMutation = useMutation({
    mutationFn: async (data: { ispNames: string[]; countryCode: string | null }) => {
      return apiRequest("POST", "/api/isp-whitelist/bulk", data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/isp-whitelist"] });
      setBulkIspText("");
      toast({
        title: "Success",
        description: `${data.added} ISPs added to whitelist`,
      });
    },
  });

  const removeIspMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/isp-whitelist/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isp-whitelist"] });
    },
  });

  const handleBulkImport = () => {
    const ispNames = bulkIspText
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    if (ispNames.length === 0) {
      toast({
        title: "Error",
        description: "Please enter at least one ISP name",
        variant: "destructive",
      });
      return;
    }

    bulkAddMutation.mutate({
      ispNames,
      countryCode: selectedCountry === "all" ? null : selectedCountry,
    });
  };

  const handleAddSingleIsp = () => {
    if (!singleIsp.trim()) {
      toast({
        title: "Error",
        description: "Please enter an ISP name",
        variant: "destructive",
      });
      return;
    }

    addIspMutation.mutate({
      ispName: singleIsp.trim(),
      countryCode: selectedCountry === "all" ? null : selectedCountry,
    });
  };

  const filteredIsps = selectedCountry === "all"
    ? whitelistedIsps
    : whitelistedIsps.filter(isp => isp.countryCode === selectedCountry);

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
            <CheckCircle className="h-5 w-5 text-primary" />
            ISP Whitelist (Legitimate ISPs)
          </CardTitle>
          <CardDescription>
            Add legitimate ISPs. Visitors from these ISPs will always be classified as Human.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Filter by Country (Optional)</label>
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                  <SelectTrigger data-testid="select-country-filter">
                    <SelectValue placeholder="All Countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    {COUNTRIES.map(country => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-medium">Bulk Import ISPs</h3>
              <p className="text-sm text-muted-foreground">
                Paste ISP names (one per line) to add multiple ISPs at once
              </p>
              <Textarea
                placeholder="Verizon&#10;AT&T&#10;T-Mobile&#10;Comcast&#10;Spectrum"
                value={bulkIspText}
                onChange={(e) => setBulkIspText(e.target.value)}
                className="min-h-[120px] font-mono text-sm"
                data-testid="textarea-bulk-isp"
              />
              <Button
                onClick={handleBulkImport}
                disabled={bulkAddMutation.isPending}
                data-testid="button-bulk-import"
              >
                {bulkAddMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                <Upload className="h-4 w-4 mr-2" />
                Import ISPs {selectedCountry && `for ${COUNTRIES.find(c => c.code === selectedCountry)?.name}`}
              </Button>
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-medium">Add Single ISP</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="ISP Name (e.g., Verizon)"
                  value={singleIsp}
                  onChange={(e) => setSingleIsp(e.target.value)}
                  data-testid="input-single-isp"
                />
                <Button
                  onClick={handleAddSingleIsp}
                  disabled={addIspMutation.isPending}
                  data-testid="button-add-single-isp"
                >
                  {addIspMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ISP Name</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIsps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No whitelisted ISPs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredIsps.map((isp: any) => (
                    <TableRow key={isp.id} data-testid={`row-isp-${isp.id}`}>
                      <TableCell className="font-medium">{isp.ispName}</TableCell>
                      <TableCell>
                        {isp.countryCode 
                          ? COUNTRIES.find(c => c.code === isp.countryCode)?.name || isp.countryCode
                          : "All Countries"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isp.enabled ? "default" : "secondary"}>
                          {isp.enabled ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeIspMutation.mutate(isp.id)}
                          disabled={removeIspMutation.isPending}
                          data-testid={`button-remove-isp-${isp.id}`}
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

          <div className="text-sm text-muted-foreground">
            📊 {filteredIsps.length} ISPs whitelisted
            {selectedCountry && ` in ${COUNTRIES.find(c => c.code === selectedCountry)?.name}`}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
