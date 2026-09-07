import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { computeEffectiveAccountStatus, SubscriptionTier } from "@shared/subscription";
import { 
  Lock, 
  User, 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  XCircle,
  ShieldCheck,
  Zap,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Key
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface UserSettingsTabProps {
  user: any;
  billing: any;
  apiKeyDetails: any;
}

export function UserSettingsTab({ user, billing }: UserSettingsTabProps) {
  const { toast } = useToast();
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/billing/create-checkout-session");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (error: Error) => {
      toast({
        title: "Upgrade Failed",
        description: error.message || "Could not initialize checkout",
        variant: "destructive",
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await apiRequest("POST", "/api/user/change-password", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password Changed",
        description: "Your account password has been updated securely.",
      });
      setIsPasswordDialogOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: Error) => {
      toast({
        title: "Password Change Failed",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Incomplete Fields",
        description: "Please fill out all password fields",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords Mismatch",
        description: "New password and confirmation must match",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const upgradeMutation = useMutation({
    mutationFn: async (tier: SubscriptionTier) => {
      const response = await apiRequest("POST", "/api/user/upgrade", { tier });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Account Upgraded!",
        description: `Your account has been successfully updated to the ${data.user?.subscriptionTier || "Pro"} tier.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/billing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-key-details"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upgrade Failed",
        description: error.message || "Could not complete account upgrade.",
        variant: "destructive",
      });
    },
  });

  const statusSummary = computeEffectiveAccountStatus({
    subscriptionStatus: billing?.subscriptionStatus ?? user?.subscriptionStatus,
    subscriptionTier: (billing as any)?.subscriptionTier ?? (user as any)?.subscriptionTier,
    trialEndsAt: billing?.trialEndsAt ?? user?.trialEndsAt,
  });

  const tiers: Array<{
    id: SubscriptionTier;
    name: string;
    price: string;
    period: string;
    requests: string;
    features: string[];
    popular?: boolean;
  }> = [
    {
      id: "Basic",
      name: "Basic",
      price: "$49",
      period: "/month",
      requests: "50,000 req/mo",
      features: ["Standard IP2 lookup", "User-Agent bot rules", "Email support"],
    },
    {
      id: "Pro",
      name: "Pro",
      price: "$99",
      period: "/month",
      requests: "250,000 req/mo",
      features: ["Multi-ASN Residential Defense", "Zero-latency cache", "Priority IP2 quota", "Real-time analytics"],
      popular: true,
    },
    {
      id: "Premium",
      name: "Premium",
      price: "$249",
      period: "/month",
      requests: "1,000,000 req/mo",
      features: ["Dedicated ASN filtering", "High-frequency classification", "Custom whitelabel domain", "24/7 SLA Support"],
    },
    {
      id: "Enterprise",
      name: "Enterprise",
      price: "$499",
      period: "/month",
      requests: "Unlimited",
      features: ["Custom infrastructure", "Dedicated proxy nodes", "Account manager", "Custom contracts"],
    },
  ];

  return (
    <div className="space-y-6 w-full max-w-5xl">
      {/* Account Info */}
      <div className="bg-white border border-[#E5EAE7] rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2.5 tracking-tight">
              <div className="w-8 h-8 rounded-lg bg-[#E6F2ED] border border-[#CCE5DB] flex items-center justify-center text-[#0A5C48]">
                <User className="h-4 w-4" />
              </div>
              Account & Credentials
            </h2>
            <p className="text-xs text-[#64748B] mt-1">Manage your username and account authentication security</p>
          </div>

          <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="text-xs bg-white border-[#D5DFD9] text-[#2D3B35] hover:bg-[#F2F6F4] hover:text-[#0F172A] gap-2 rounded-lg shadow-xs font-semibold h-9">
                <Lock className="h-3.5 w-3.5 text-[#0A5C48]" />
                Change Password
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white border-[#E5EAE7] text-[#0F172A] shadow-xl">
              <DialogHeader>
                <DialogTitle className="text-[#0F172A] font-bold">Update Password</DialogTitle>
                <DialogDescription className="text-[#64748B] text-xs">
                  Enter your current password and a new secure password (min 8 characters).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-[#2D3B35]">Current Password</Label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="bg-white border-[#D5DFD9] text-[#0F172A] text-xs focus:border-[#0A5C48] focus:ring-1 focus:ring-[#0A5C48]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-[#2D3B35]">New Password</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-white border-[#D5DFD9] text-[#0F172A] text-xs focus:border-[#0A5C48] focus:ring-1 focus:ring-[#0A5C48]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-[#2D3B35]">Confirm New Password</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-white border-[#D5DFD9] text-[#0F172A] text-xs focus:border-[#0A5C48] focus:ring-1 focus:ring-[#0A5C48]"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleChangePassword}
                  disabled={changePasswordMutation.isPending}
                  className="bg-[#0A5C48] hover:bg-[#07382D] text-white font-bold text-xs rounded-lg shadow-xs"
                >
                  {changePasswordMutation.isPending ? "Updating..." : "Save Password"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Username / Client Handle</Label>
            <Input
              value={user?.username || ""}
              disabled
              className="bg-[#F7FAF8] border-[#E0E9E4] text-[#0F172A] text-xs font-medium cursor-not-allowed"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Registered Email</Label>
            <Input
              value={user?.email || "No email attached"}
              disabled
              className="bg-[#F7FAF8] border-[#E0E9E4] text-[#0F172A] text-xs font-medium cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Subscription & Tier Management */}
      <div className="bg-white border border-[#E5EAE7] rounded-xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5EAE7] pb-4">
          <div>
            <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2 tracking-tight">
              <CreditCard className="h-4 w-4 text-[#0A5C48]" />
              Account Status & Subscription Tier
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">Authoritative plan status, request quota, and tier management</p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              statusSummary.isActive
                ? statusSummary.isTrial
                  ? "bg-blue-50 text-blue-800 border-blue-200"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}>
              {statusSummary.isActive ? (
                statusSummary.isTrial ? (
                  <>
                    <Clock className="h-3 w-3 text-blue-600" />
                    Trial ({statusSummary.trialDaysRemaining ?? 0} days remaining)
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    {statusSummary.tier} Tier (Active)
                  </>
                )
              ) : (
                <>
                  <XCircle className="h-3 w-3 text-rose-600" />
                  {statusSummary.isTrialExpired ? "Trial Expired" : statusSummary.statusLabel}
                </>
              )}
            </span>
          </div>
        </div>

        {/* Status Callout Banner */}
        {statusSummary.isTrialExpired ? (
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-rose-950">Your trial has expired.</div>
              <div className="text-xs text-rose-800 mt-0.5">
                Your free trial has ended. Incoming classification requests are blocked until upgraded. Choose any plan below to instantly reactivate your account.
              </div>
            </div>
          </div>
        ) : statusSummary.isExpiringSoon ? (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-amber-950">Your trial is expiring soon.</div>
              <div className="text-xs text-amber-800 mt-0.5">
                You have {statusSummary.trialDaysRemaining} day{statusSummary.trialDaysRemaining === 1 ? "" : "s"} remaining on your trial. Upgrade below to prevent any interruption to your live traffic filters.
              </div>
            </div>
          </div>
        ) : statusSummary.isActive && !statusSummary.isTrial ? (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-[#0A5C48] shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-emerald-950">Active Subscription: {statusSummary.tier} Tier</div>
              <div className="text-xs text-emerald-800 mt-0.5">
                Your account has full continuous access to the CleanTraffic defense engine with {statusSummary.tier} priority bandwidth.
              </div>
            </div>
          </div>
        ) : null}

        {/* Tier Upgrade Grid */}
        <div>
          <div className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">
            {statusSummary.isActive && !statusSummary.isTrial ? "Change or Switch Subscription Plan" : "Select Subscription Plan"}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tiers.map((tier) => {
              const isCurrent = statusSummary.isActive && !statusSummary.isTrial && statusSummary.tier === tier.id;
              const isPendingThis = upgradeMutation.isPending && (upgradeMutation.variables as string) === tier.id;

              return (
                <div
                  key={tier.id}
                  className={`rounded-xl p-4 flex flex-col justify-between border transition-all ${
                    isCurrent
                      ? "border-[#0A5C48] bg-[#F2F8F5] ring-2 ring-[#0A5C48]/20 shadow-xs"
                      : tier.popular
                      ? "border-emerald-200 bg-white hover:border-emerald-400 shadow-xs"
                      : "border-[#E5EAE7] bg-white hover:border-slate-300 shadow-2xs"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[#0F172A]">{tier.name}</span>
                      {tier.popular && !isCurrent && (
                        <span className="text-[10px] font-bold bg-[#E6F2ED] text-[#0A5C48] px-2 py-0.5 rounded-full">
                          POPULAR
                        </span>
                      )}
                      {isCurrent && (
                        <span className="text-[10px] font-bold bg-[#0A5C48] text-white px-2 py-0.5 rounded-full">
                          CURRENT
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-[#0F172A]">{tier.price}</span>
                      <span className="text-xs text-[#64748B]">{tier.period}</span>
                    </div>

                    <div className="text-xs font-semibold text-[#0A5C48] bg-emerald-50/80 px-2 py-1 rounded-md">
                      {tier.requests}
                    </div>

                    <ul className="text-xs text-[#64748B] space-y-1.5 pt-1">
                      {tier.features.map((f, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#0A5C48] shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4 mt-4 border-t border-[#E5EAE7]">
                    {isCurrent ? (
                      <Button
                        disabled
                        className="w-full text-xs font-semibold bg-[#E6F2ED] text-[#0A5C48] cursor-default border border-[#CCE5DB]"
                      >
                        Active Plan
                      </Button>
                    ) : (
                      <Button
                        onClick={() => upgradeMutation.mutate(tier.id)}
                        disabled={upgradeMutation.isPending}
                        className={`w-full text-xs font-bold rounded-lg shadow-xs transition-all ${
                          tier.popular || statusSummary.isTrialExpired
                            ? "bg-[#0A5C48] hover:bg-[#07382D] text-white"
                            : "bg-slate-900 hover:bg-slate-800 text-white"
                        }`}
                      >
                        {isPendingThis ? "Updating..." : `Upgrade to ${tier.name}`}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
