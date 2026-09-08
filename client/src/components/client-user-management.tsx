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
import { UserPlus, Trash2, Shield, AlertTriangle, CheckCircle, Clock, CreditCard, Edit, Sparkles, XCircle, Key } from "lucide-react";
import { computeEffectiveAccountStatus, SubscriptionTier, SubscriptionStatus } from "@shared/subscription";

export default function ClientUserManagement() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [selectedApiKeyId, setSelectedApiKeyId] = useState("");
  const [newSubscriptionTier, setNewSubscriptionTier] = useState<SubscriptionTier>("Pro");
  const [newSubscriptionStatus, setNewSubscriptionStatus] = useState<SubscriptionStatus>("trialing");
  const [newTrialDays, setNewTrialDays] = useState<number>(7);

  // Edit Subscription Dialog State
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState<string>("trialing");
  const [editTier, setEditTier] = useState<string>("Pro");
  const [editTrialDays, setEditTrialDays] = useState<number>(7);

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

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({
      userId,
      subscriptionStatus,
      subscriptionTier,
      trialDays,
    }: {
      userId: string;
      subscriptionStatus: string;
      subscriptionTier: string;
      trialDays?: number;
    }) => {
      const response = await apiRequest("PATCH", `/api/interface/client-users/${userId}/subscription`, {
        subscriptionStatus,
        subscriptionTier,
        trialDays,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Subscription Updated",
        description: "User subscription status and tier have been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/interface/client-users"] });
      setEditingUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update user subscription",
        variant: "destructive",
      });
    },
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

  const provisionApiKeyMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("POST", `/api/interface/client-users/${userId}/api-key`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "API Key Provisioned",
        description: "API key generated and linked to client user",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/interface/client-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Provisioning Failed",
        description: error.message || "Failed to provision API key",
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
      subscriptionTier: newSubscriptionTier,
      subscriptionStatus: newSubscriptionStatus,
      trialDays: newSubscriptionStatus === "trialing" ? newTrialDays : undefined,
    });
  };

  const handleOpenEditSubscription = (user: any) => {
    setEditingUser(user);
    setEditStatus(user.subscriptionStatus || "trialing");
    setEditTier(user.subscriptionTier || "Pro");
    setEditTrialDays(7);
  };

  const handleSaveSubscription = () => {
    if (!editingUser) return;
    updateSubscriptionMutation.mutate({
      userId: editingUser.id,
      subscriptionStatus: editStatus,
      subscriptionTier: editTier,
      trialDays: editStatus === "trialing" ? editTrialDays : undefined,
    });
  };

  if (isLoading) {
    return <div className="p-8 text-center text-[#64748B]">Loading client users & subscription states...</div>;
  }

  const activeSubsCount = clientUsers.filter((u) => {
    const s = u.statusSummary || computeEffectiveAccountStatus(u);
    return s.isActive && !s.isTrial;
  }).length;

  const trialingCount = clientUsers.filter((u) => {
    const s = u.statusSummary || computeEffectiveAccountStatus(u);
    return s.isTrial;
  }).length;

  const expiredCount = clientUsers.filter((u) => {
    const s = u.statusSummary || computeEffectiveAccountStatus(u);
    return s.isTrialExpired;
  }).length;

  return (
    <Card className="border-[#E5EAE7] shadow-xs">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl font-bold text-[#0F172A]">
              <Shield className="w-5 h-5 text-[#0A5C48]" />
              Client User Management & Subscriptions
            </CardTitle>
            <CardDescription className="text-xs text-[#64748B]">
              Authoritative management of user accounts, subscription tiers, trial statuses, and compliance
            </CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-client-user" className="bg-[#0A5C48] hover:bg-[#07382D] text-white">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Client User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Client User</DialogTitle>
                <DialogDescription>
                  Provision a new account with trial or active license tier
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    data-testid="input-new-username"
                    placeholder="e.g. client_portal"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
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
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input
                    id="email"
                    data-testid="input-new-email"
                    type="email"
                    placeholder="client@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <Label>Subscription Tier</Label>
                    <Select value={newSubscriptionTier} onValueChange={(v) => setNewSubscriptionTier(v as SubscriptionTier)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Basic">Basic ($49/mo)</SelectItem>
                        <SelectItem value="Pro">Pro ($99/mo)</SelectItem>
                        <SelectItem value="Premium">Premium ($249/mo)</SelectItem>
                        <SelectItem value="Enterprise">Enterprise ($499/mo)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Initial Status</Label>
                    <Select value={newSubscriptionStatus} onValueChange={(v) => setNewSubscriptionStatus(v as SubscriptionStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trialing">Free Trial</SelectItem>
                        <SelectItem value="active">Active (Paid)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {newSubscriptionStatus === "trialing" && (
                  <div className="space-y-1.5">
                    <Label>Trial Duration (Days)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={newTrialDays}
                      onChange={(e) => setNewTrialDays(parseInt(e.target.value) || 7)}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="apiKey">Assign API Key (optional)</Label>
                  {isLoadingApiKeys ? (
                    <div className="text-xs text-muted-foreground">Loading API keys...</div>
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
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  data-testid="button-create-user"
                  className="bg-[#0A5C48] hover:bg-[#07382D] text-white"
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
      <CardContent className="space-y-6">
        {/* Metric & Subscription Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-center">
            <div className="text-2xl font-bold text-slate-800">{clientUsers.length}</div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">Total Users</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-center">
            <div className="text-2xl font-bold text-emerald-700">{activeSubsCount}</div>
            <div className="text-xs font-medium text-emerald-600 mt-0.5">Active Paid</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl text-center">
            <div className="text-2xl font-bold text-blue-700">{trialingCount}</div>
            <div className="text-xs font-medium text-blue-600 mt-0.5">Trialing</div>
          </div>
          <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl text-center">
            <div className="text-2xl font-bold text-rose-700">{expiredCount}</div>
            <div className="text-xs font-medium text-rose-600 mt-0.5">Trial Expired</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-center">
            <div className="text-2xl font-bold text-slate-700">{complianceStats?.cleared ?? 0}</div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">Compliance Cleared</div>
          </div>
        </div>
        {clientUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No client users yet</p>
            <p className="text-sm mt-2">Click "Add Client User" to create one</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Account Status</TableHead>
                <TableHead>Subscription & Entitlement</TableHead>
                <TableHead>API Key & Quota</TableHead>
                <TableHead>Authorization</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientUsers.map((user: any) => {
                const assignedKey = user.apiKey || apiKeys.find((k: any) => k.id === user.apiKeyId);
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

                const statusSummary = user.statusSummary || computeEffectiveAccountStatus({
                  subscriptionStatus: user.subscriptionStatus,
                  subscriptionTier: user.subscriptionTier,
                  trialEndsAt: user.trialEndsAt,
                });

                const entitlementType = user.entitlementType || (
                  user.adminGrantedPro || user.subscriptionStatus === 'admin_promoted'
                    ? 'admin_promoted'
                    : user.subscriptionStatus === 'active'
                    ? 'stripe_paid'
                    : statusSummary.isTrial
                    ? 'free_trial'
                    : 'inactive'
                );

                const isAuthorized = user.isAuthorized !== undefined ? user.isAuthorized : statusSummary.isActive && !!assignedKey;
                const authReason = user.authReason || (isAuthorized ? "Active" : "Not authorized");

                return (
                  <TableRow key={user.id} data-testid={`row-client-user-${user.id}`}>
                    <TableCell>
                      <div className="font-semibold text-[#0F172A]">{user.username}</div>
                      <div className="text-xs text-[#64748B]">{user.email || '—'}</div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant={user.status === 'suspended' ? 'destructive' : user.status === 'inactive' ? 'outline' : 'default'} className="text-[11px] py-0">
                          {user.status === 'suspended' ? 'Suspended' : user.status === 'inactive' ? 'Inactive' : 'Active'}
                        </Badge>
                        <Badge variant={complianceVariant} className="gap-1 text-[10px] py-0">
                          {complianceIcon}
                          {complianceStatus}
                        </Badge>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                            statusSummary.isActive
                              ? statusSummary.isTrial
                                ? "bg-blue-50 text-blue-800 border-blue-200"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-rose-50 text-rose-800 border-rose-200"
                          }`}>
                            {statusSummary.isActive ? (
                              statusSummary.isTrial ? (
                                <>
                                  <Clock className="w-2.5 h-2.5 text-blue-600" />
                                  Trialing ({statusSummary.trialDaysRemaining}d)
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                                  Active Paid
                                </>
                              )
                            ) : (
                              <>
                                <XCircle className="w-2.5 h-2.5 text-rose-600" />
                                {statusSummary.isTrialExpired ? "Trial Expired" : statusSummary.statusLabel}
                              </>
                            )}
                          </span>

                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {statusSummary.tier}
                          </span>
                        </div>

                        {/* Entitlement Origin / Mode */}
                        <div className="text-[11px]">
                          {entitlementType === 'admin_promoted' ? (
                            <span className="inline-flex items-center gap-1 text-purple-700 font-medium">
                              <Shield className="w-3 h-3 text-purple-600" /> Admin Granted Pro
                            </span>
                          ) : entitlementType === 'stripe_paid' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <CreditCard className="w-3 h-3 text-emerald-600" /> Stripe Paid
                            </span>
                          ) : entitlementType === 'free_trial' ? (
                            <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
                              <Clock className="w-3 h-3 text-blue-600" /> Free Trial
                            </span>
                          ) : (
                            <span className="text-slate-400">No Active Entitlement</span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      {assignedKey ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-xs font-mono text-slate-800">
                            <Key className="w-3 h-3 text-slate-500" />
                            <span>{assignedKey.keyName}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <span className={`px-1.5 py-0.2 rounded font-semibold uppercase text-[9px] ${
                              assignedKey.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : assignedKey.status === 'paused'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {assignedKey.status}
                            </span>
                            <span>{assignedKey.callCount || 0} / {assignedKey.callLimit > 0 ? assignedKey.callLimit : 'unlimited'}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-rose-600 font-medium">Missing Key</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-1.5 text-[10px] text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                            onClick={() => provisionApiKeyMutation.mutate(user.id)}
                            disabled={provisionApiKeyMutation.isPending}
                          >
                            Generate
                          </Button>
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      {isAuthorized ? (
                        <div className="flex items-center gap-1 text-xs text-emerald-700 font-medium">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Authorized</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-rose-700 font-medium" title={authReason}>
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span className="max-w-[120px] truncate">{authReason}</span>
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-xs font-semibold gap-1 text-slate-700 hover:text-[#0A5C48] hover:border-[#0A5C48]"
                          onClick={() => handleOpenEditSubscription(user)}
                          title="Edit Subscription & Tier"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          Plan
                        </Button>

                        {!assignedKey && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs font-semibold text-[#0A5C48] border-[#0A5C48]/30 hover:bg-[#0A5C48]/10"
                            onClick={() => provisionApiKeyMutation.mutate(user.id)}
                            title="Provision API Key"
                            disabled={provisionApiKeyMutation.isPending}
                          >
                            <Key className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        <Select
                          value={user.complianceStatus || 'pending'}
                          onValueChange={(status) => updateComplianceMutation.mutate({ userId: user.id, status })}
                        >
                          <SelectTrigger className="w-24 h-8 text-xs">
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
                          className="h-8 w-8 p-0"
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

      {/* Edit Subscription Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#0F172A]">
              <CreditCard className="h-4 w-4 text-[#0A5C48]" />
              Manage Subscription — {editingUser?.username}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Update authoritative subscription tier, trial duration, or account status
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Subscription Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active (Paid Account)</SelectItem>
                  <SelectItem value="trialing">Trialing (Free Trial)</SelectItem>
                  <SelectItem value="trial_expired">Trial Expired</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Subscription Tier</Label>
              <Select value={editTier} onValueChange={setEditTier}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Basic">Basic ($49/mo - 50k req)</SelectItem>
                  <SelectItem value="Pro">Pro ($99/mo - 250k req)</SelectItem>
                  <SelectItem value="Premium">Premium ($249/mo - 1M req)</SelectItem>
                  <SelectItem value="Enterprise">Enterprise ($499/mo - Unlimited)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editStatus === "trialing" && (
              <div className="space-y-1.5">
                <Label>Set / Extend Trial Period (Days from now)</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={editTrialDays}
                  onChange={(e) => setEditTrialDays(parseInt(e.target.value) || 7)}
                />
                <p className="text-[11px] text-[#64748B]">
                  Sets the trial expiration date to {editTrialDays} day{editTrialDays === 1 ? "" : "s"} in the future.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button
              className="bg-[#0A5C48] hover:bg-[#07382D] text-white"
              onClick={handleSaveSubscription}
              disabled={updateSubscriptionMutation.isPending}
            >
              {updateSubscriptionMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
