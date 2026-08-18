import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Trash2, Shield, AlertTriangle, CheckCircle, Clock } from "lucide-react";

export default function ClientUserManagement() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [selectedApiKeyId, setSelectedApiKeyId] = useState("");

  const { data: clientUsers = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/interface/client-users"],
  });

  const { data: apiKeys = [], isLoading: isLoadingApiKeys } = useQuery<any[]>({
    queryKey: ["/api/api-keys"],
  });

  const { data: complianceStats } = useQuery<{
    totalUsers: number;
    pending: number;
    cleared: number;
    flagged: number;
    suspended: number;
  }>({
    queryKey: ["/api/interface/compliance/stats"],
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const response = await apiRequest("POST", "/api/interface/client-users", userData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User Created",
        description: "Client user has been created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/interface/client-users"] });
      setIsCreateDialogOpen(false);
      setNewUsername("");
      setNewPassword("");
      setNewEmail("");
      setSelectedApiKeyId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const updateComplianceMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/interface/client-users/${userId}/compliance`, { complianceStatus: status });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Compliance Updated", description: "User compliance status has been updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/interface/client-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/interface/compliance/stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Update Failed", description: error.message || "Failed to update compliance", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("DELETE", `/api/interface/client-users/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User Deleted",
        description: "Client user has been removed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/interface/client-users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const handleCreateUser = () => {
    if (!newUsername || !newPassword) {
      toast({
        title: "Missing Information",
        description: "Username and password are required",
        variant: "destructive",
      });
      return;
    }

    createUserMutation.mutate({
      username: newUsername,
      password: newPassword,
      email: newEmail || null,
      apiKeyId: selectedApiKeyId && selectedApiKeyId !== "none" ? selectedApiKeyId : null,
    });
  };

  if (isLoading) {
    return <div>Loading client users...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Client User Management
            </CardTitle>
            <CardDescription>
              Manage client users who access the service
            </CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-client-user">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Client User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Client User</DialogTitle>
                <DialogDescription>
                  Create a new user account for accessing the service
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    data-testid="input-new-username"
                    placeholder="Enter username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    data-testid="input-new-password"
                    type="password"
                    placeholder="Enter password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input
                    id="email"
                    data-testid="input-new-email"
                    type="email"
                    placeholder="user@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">Assign API Key (optional)</Label>
                  {isLoadingApiKeys ? (
                    <div className="text-sm text-muted-foreground">Loading API keys...</div>
                  ) : (
                    <Select value={selectedApiKeyId} onValueChange={setSelectedApiKeyId}>
                      <SelectTrigger data-testid="select-api-key">
                        <SelectValue placeholder="Select an API key" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {apiKeys.map((key: any) => (
                          <SelectItem key={key.id} value={key.id}>
                            {key.keyName} ({key.status})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-muted-foreground">
                    You can assign an API key now or later
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  data-testid="button-create-user"
                  onClick={handleCreateUser}
                  disabled={createUserMutation.isPending}
                >
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {complianceStats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <div className="bg-muted/50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold">{complianceStats.totalUsers}</div>
              <div className="text-xs text-muted-foreground">Total Users</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-600">{complianceStats.pending}</div>
              <div className="text-xs text-yellow-600">Pending</div>
            </div>
            <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{complianceStats.cleared}</div>
              <div className="text-xs text-green-600">Cleared</div>
            </div>
            <div className="bg-orange-50 dark:bg-orange-950 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-orange-600">{complianceStats.flagged}</div>
              <div className="text-xs text-orange-600">Flagged</div>
            </div>
            <div className="bg-red-50 dark:bg-red-950 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-600">{complianceStats.suspended}</div>
              <div className="text-xs text-red-600">Suspended</div>
            </div>
          </div>
        )}
        {clientUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No client users yet</p>
            <p className="text-sm mt-2">Click "Add Client User" to create one</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Compliance</TableHead>
                <TableHead>ToS</TableHead>
                <TableHead>API Key</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientUsers.map((user: any) => {
                const assignedKey = apiKeys.find((k: any) => k.id === user.apiKeyId);
                const complianceStatus = (user.complianceStatus || 'pending') as 'pending' | 'cleared' | 'flagged' | 'suspended';
                const complianceIcon = {
                  pending: <Clock className="w-3 h-3" />,
                  cleared: <CheckCircle className="w-3 h-3" />,
                  flagged: <AlertTriangle className="w-3 h-3" />,
                  suspended: <AlertTriangle className="w-3 h-3" />
                }[complianceStatus];
                const complianceVariant = {
                  pending: 'secondary',
                  cleared: 'default',
                  flagged: 'destructive',
                  suspended: 'destructive'
                }[complianceStatus] as any;
                return (
                  <TableRow key={user.id} data-testid={`row-client-user-${user.id}`}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={complianceVariant} className="gap-1">
                        {complianceIcon}
                        {user.complianceStatus || 'pending'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.tosAccepted ? (
                        <span className="text-xs text-green-600">Accepted</span>
                      ) : (
                        <span className="text-xs text-yellow-600">Not Accepted</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {assignedKey ? assignedKey.keyName : <span className="text-muted-foreground">No API key</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Select
                          value={user.complianceStatus || 'pending'}
                          onValueChange={(status) => updateComplianceMutation.mutate({ userId: user.id, status })}
                        >
                          <SelectTrigger className="w-28 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="cleared">Cleared</SelectItem>
                            <SelectItem value="flagged">Flagged</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-delete-user-${user.id}`}
                          onClick={() => {
                            if (confirm(`Delete user ${user.username}?`)) {
                              deleteUserMutation.mutate(user.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
