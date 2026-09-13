import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { userAuthApi } from "@/lib/user-auth";
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
  Key,
  Eye,
  EyeOff,
  Check,
  X,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { evaluatePassword } from "@/components/password-strength";

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
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

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

  // Real-time password evaluation
  const newPasswordEvaluation = evaluatePassword(newPassword);
  const isSameAsCurrent = currentPassword.length > 0 && newPassword.length > 0 && currentPassword === newPassword;
  const hasConfirm = confirmPassword.length > 0;
  const isConfirmMatch = hasConfirm && newPassword === confirmPassword;
  const isConfirmMismatch = hasConfirm && newPassword !== confirmPassword;
  const isFormValid =
    currentPassword.length > 0 &&
    newPasswordEvaluation.isSatisfied &&
    !isSameAsCurrent &&
    isConfirmMatch;

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
      return await userAuthApi.changePassword(data);
    },
    onSuccess: (data) => {
      toast({
        title: "Password Changed",
        description: data.message || "Your account password has been updated securely. A security notification was sent to your email.",
      });
      setIsPasswordDialogOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setServerError(null);
    },
    onError: (error: any) => {
      let msg = "Failed to update password. Please check your credentials.";
      try {
        if (error.message) {
          const parsed = JSON.parse(error.message.replace(/^\d+:\s*/, ""));
          msg = parsed.message || msg;
        }
      } catch {
        msg = error.message || msg;
      }
      setServerError(msg);
      toast({
        title: "Password Change Failed",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const handleChangePassword = () => {
    setServerError(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setServerError("Please fill out all required password fields.");
      toast({
        title: "Incomplete Fields",
        description: "Please fill out all password fields.",
        variant: "destructive",
      });
      return;
    }
    if (isSameAsCurrent) {
      setServerError("Your new password must be different from your current password.");
      toast({
        title: "Password Reused",
        description: "Your new password must be different from your current password.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 8) {
      setServerError("Password must be at least 8 characters long.");
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }
    if (!newPasswordEvaluation.isSatisfied) {
      setServerError("Password must include uppercase, lowercase, and a number or symbol.");
      toast({
        title: "Complexity Requirements",
        description: "Password must include uppercase, lowercase, and a number or symbol.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setServerError("New password and confirmation password do not match.");
      toast({
        title: "Passwords Mismatch",
        description: "New password and confirmation must match.",
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword, confirmPassword });
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
            <DialogContent className="bg-white border-[#E5EAE7] text-[#0F172A] shadow-xl sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-[#0F172A] font-bold text-base flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#0A5C48]" />
                  Update Password
                </DialogTitle>
                <DialogDescription className="text-[#64748B] text-xs">
                  Enter your current password and create a new secure password. All existing sessions on other devices will be invalidated for your security.
                </DialogDescription>
              </DialogHeader>

              {serverError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <div className="flex-1 font-medium">{serverError}</div>
                </div>
              )}

              <div className="space-y-3.5 py-2">
                {/* Current Password */}
                <div className="space-y-1">
                  <Label htmlFor="currentPassword" className="text-xs font-bold text-[#2D3B35]">
                    Current Password <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        if (serverError) setServerError(null);
                      }}
                      placeholder="Enter your existing password"
                      autoComplete="current-password"
                      className="bg-white border-[#D5DFD9] text-[#0F172A] text-xs focus:border-[#0A5C48] focus:ring-1 focus:ring-[#0A5C48] pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-1">
                  <Label htmlFor="newPassword" className="text-xs font-bold text-[#2D3B35]">
                    New Password <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (serverError) setServerError(null);
                      }}
                      placeholder="Enter a new secure password"
                      autoComplete="new-password"
                      className={`bg-white border-[#D5DFD9] text-[#0F172A] text-xs focus:border-[#0A5C48] focus:ring-1 focus:ring-[#0A5C48] pr-10 ${
                        isSameAsCurrent ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500" : ""
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Immediate password reuse feedback */}
                  {isSameAsCurrent && (
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium mt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                      <span>Your new password must be different from your current password.</span>
                    </div>
                  )}

                  {/* Too short warning */}
                  {newPassword.length > 0 && newPassword.length < 8 && !isSameAsCurrent && (
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium mt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                      <span>Password must be at least 8 characters long ({newPassword.length}/8).</span>
                    </div>
                  )}

                  {/* Real-time Requirements Checklist */}
                  {newPassword.length > 0 && (
                    <div className="p-3 bg-[#F8FAFC] border border-slate-200/90 rounded-lg space-y-1.5 text-xs mt-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                        <span>Password Requirements</span>
                        {newPasswordEvaluation.isSatisfied && !isSameAsCurrent && (
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" /> Satisfied
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                        <div className={`flex items-center gap-1.5 text-[11px] ${newPasswordEvaluation.lengthValid ? "text-emerald-700 font-medium" : "text-slate-500"}`}>
                          {newPasswordEvaluation.lengthValid ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                          <span>At least 8 characters</span>
                        </div>
                        <div className={`flex items-center gap-1.5 text-[11px] ${newPasswordEvaluation.hasLower ? "text-emerald-700 font-medium" : "text-slate-500"}`}>
                          {newPasswordEvaluation.hasLower ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                          <span>One lowercase (a-z)</span>
                        </div>
                        <div className={`flex items-center gap-1.5 text-[11px] ${newPasswordEvaluation.hasUpper ? "text-emerald-700 font-medium" : "text-slate-500"}`}>
                          {newPasswordEvaluation.hasUpper ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                          <span>One uppercase (A-Z)</span>
                        </div>
                        <div className={`flex items-center gap-1.5 text-[11px] ${(newPasswordEvaluation.hasNumber || newPasswordEvaluation.hasSpecial) ? "text-emerald-700 font-medium" : "text-slate-500"}`}>
                          {(newPasswordEvaluation.hasNumber || newPasswordEvaluation.hasSpecial) ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                          <span>Number or special symbol</span>
                        </div>
                        {currentPassword.length > 0 && (
                          <div className={`flex items-center gap-1.5 text-[11px] sm:col-span-2 ${!isSameAsCurrent ? "text-emerald-700 font-medium" : "text-rose-600 font-semibold"}`}>
                            {!isSameAsCurrent ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                            <span>Different from current password</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm New Password */}
                <div className="space-y-1">
                  <Label htmlFor="confirmPassword" className="text-xs font-bold text-[#2D3B35]">
                    Confirm New Password <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (serverError) setServerError(null);
                      }}
                      placeholder="Re-enter your new password"
                      autoComplete="new-password"
                      className={`bg-white border-[#D5DFD9] text-[#0F172A] text-xs focus:border-[#0A5C48] focus:ring-1 focus:ring-[#0A5C48] pr-10 ${
                        isConfirmMismatch ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500" : ""
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {isConfirmMismatch && (
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium mt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                      <span>New password and confirmation password do not match.</span>
                    </div>
                  )}

                  {isConfirmMatch && (
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium mt-1">
                      <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                      <span>Passwords match.</span>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsPasswordDialogOpen(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setServerError(null);
                  }}
                  className="text-xs border-[#D5DFD9] text-[#2D3B35] hover:bg-[#F2F6F4]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleChangePassword}
                  disabled={
                    changePasswordMutation.isPending ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword ||
                    isSameAsCurrent ||
                    isConfirmMismatch ||
                    !newPasswordEvaluation.isSatisfied
                  }
                  className="bg-[#0A5C48] hover:bg-[#07382D] text-white font-bold text-xs rounded-lg shadow-xs"
                >
                  {changePasswordMutation.isPending ? "Updating..." : "Save New Password"}
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
