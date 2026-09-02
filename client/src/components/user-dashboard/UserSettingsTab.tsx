import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Lock, 
  User, 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  XCircle,
  ShieldCheck,
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

  const isTrial = billing?.subscriptionStatus === "trialing";
  const isExpired = isTrial && (billing?.trialDaysRemaining ?? 0) <= 0;

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

      {/* Subscription Card */}
      <div className="bg-white border border-[#E5EAE7] rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2 tracking-tight">
              <CreditCard className="h-4 w-4 text-[#0A5C48]" />
              Subscription & License Tier
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">High-volume traffic plan & license billing</p>
          </div>

          {billing?.subscriptionStatus !== "active" && (
            <Button
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
              className="bg-[#0A5C48] hover:bg-[#07382D] text-white text-xs font-bold rounded-lg shadow-xs"
            >
              {checkoutMutation.isPending ? "Redirecting..." : "Upgrade to Pro"}
            </Button>
          )}
        </div>

        <div className="bg-[#F7FAF8] border border-[#E0E9E4] p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExpired ? (
              <XCircle className="h-5 w-5 text-rose-600" />
            ) : isTrial ? (
              <Clock className="h-5 w-5 text-[#0A5C48]" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-[#0A5C48]" />
            )}
            <div>
              <div className="text-sm font-bold text-[#0F172A]">
                {billing?.subscriptionStatus === "active"
                  ? "Pro Tier (Active)"
                  : isTrial
                  ? `Free Trial — ${billing?.trialDaysRemaining ?? 0} days left`
                  : "Standard Plan"}
              </div>
              <div className="text-xs text-[#64748B]">
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
