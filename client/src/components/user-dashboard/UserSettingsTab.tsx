import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings, 
  Lock, 
  User, 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Key,
  ShieldAlert
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

export function UserSettingsTab({ user, billing, apiKeyDetails }: UserSettingsTabProps) {
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

  const isTrial = billing?.subscriptionStatus === "trialing";
  const isExpired = isTrial && (billing?.trialDaysRemaining ?? 0) <= 0;

  return (
    <div className="space-y-6">
      {/* Account Info */}
      <div className="bg-[#101726] border border-[#1c2638] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <User className="h-5 w-5 text-blue-500" />
              Account & Credentials
            </h2>
            <p className="text-xs text-slate-400 mt-1">Manage your username and account authentication security</p>
          </div>

          <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="text-xs bg-[#141d2e] border-[#212e45] text-slate-200 hover:text-white gap-2">
                <Lock className="h-3.5 w-3.5" />
                Change Password
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#101726] border-[#1c2638] text-white">
              <DialogHeader>
                <DialogTitle className="text-white">Update Password</DialogTitle>
                <DialogDescription className="text-slate-400 text-xs">
                  Enter your current password and a new secure password (min 8 characters).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Current Password</Label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="bg-[#0e1422] border-[#212e45] text-white text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">New Password</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-[#0e1422] border-[#212e45] text-white text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Confirm New Password</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-[#0e1422] border-[#212e45] text-white text-xs"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleChangePassword}
                  disabled={changePasswordMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs"
                >
                  {changePasswordMutation.isPending ? "Updating..." : "Save Password"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1">
            <Label className="text-xs text-slate-400">Username / Client Handle</Label>
            <Input
              value={user?.username || ""}
              disabled
              className="bg-[#141d2e] border-[#212e45] text-slate-300 text-xs font-medium"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-400">Registered Email</Label>
            <Input
              value={user?.email || "No email attached"}
              disabled
              className="bg-[#141d2e] border-[#212e45] text-slate-300 text-xs font-medium"
            />
          </div>
        </div>
      </div>

      {/* Subscription Card */}
      <div className="bg-[#101726] border border-[#1c2638] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-400" />
              Subscription & License Tier
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">High-volume traffic plan & license billing</p>
          </div>

          {billing?.subscriptionStatus !== "active" && (
            <Button
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
            >
              {checkoutMutation.isPending ? "Redirecting..." : "Upgrade to Pro"}
            </Button>
          )}
        </div>

        <div className="bg-[#141d2e] border border-[#212e45] p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExpired ? (
              <XCircle className="h-5 w-5 text-rose-400" />
            ) : isTrial ? (
              <Clock className="h-5 w-5 text-blue-400" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            )}
            <div>
              <div className="text-sm font-bold text-white">
                {billing?.subscriptionStatus === "active"
                  ? "Pro Tier (Active)"
                  : isTrial
                  ? `Free Trial — ${billing?.trialDaysRemaining ?? 0} days left`
                  : "Standard Plan"}
              </div>
              <div className="text-xs text-slate-400">
                {billing?.subscriptionStatus === "active"
                  ? "Unlimited high-frequency classification & multi-ASN defense active"
                  : "Upgrade for unlimited traffic classification and priority residential filtering."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
