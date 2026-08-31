import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { userAuthApi } from "@/lib/user-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { PasswordStrengthIndicator, evaluatePassword } from "@/components/password-strength";
import {
  ShieldCheck,
  Zap,
  CheckCircle2,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  Globe,
  UserPlus,
  LogIn,
  Loader2,
  AlertCircle,
  KeyRound,
  Mail,
  ArrowLeft,
  RefreshCw,
  Sparkles,
} from "lucide-react";

export default function UserLogin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mode: "signup" (default for new trial), "signin", or "forgot"
  const [authMode, setAuthMode] = useState<"signup" | "signin" | "forgot">("signup");

  // Form states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newsletter, setNewsletter] = useState(true);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [formSubmittedAttempt, setFormSubmittedAttempt] = useState(false);

  // Forgot password recovery states
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [simulatedDevCode, setSimulatedDevCode] = useState<string | null>(null);

  // Load saved credentials
  useEffect(() => {
    const saved = localStorage.getItem("app_user_saved_email");
    if (saved) {
      setEmail(saved);
      setRecoveryEmail(saved);
    }
  }, []);

  // Password evaluation for signup
  const passwordEvaluation = evaluatePassword(password);
  // Password evaluation for recovery
  const newPasswordEvaluation = evaluatePassword(newPassword);

  // Registration mutation
  const registerMutation = useMutation({
    mutationFn: userAuthApi.register,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/me"] });
      toast({
        title: "Account Created! Verification Required",
        description: data.message || "Please check your inbox to verify your email and activate your account.",
      });
      const regEmail = data.email || email;
      const devCode = data.devVerificationCode || "";
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("pending_verification_email", regEmail);
        if (devCode) localStorage.setItem("pending_verification_dev_code", devCode);
      }
      setTimeout(() => {
        navigate(`/verification-required?email=${encodeURIComponent(regEmail)}${devCode ? `&devCode=${encodeURIComponent(devCode)}` : ""}`);
      }, 400);
    },
    onError: (error: any) => {
      let msg = "Failed to create account. Please check your details.";
      try {
        if (error.message) {
          const parsed = JSON.parse(error.message.replace(/^\d+:\s*/, ""));
          msg = parsed.message || msg;
        }
      } catch {
        msg = error.message || msg;
      }
      toast({
        title: "Registration Failed",
        description: msg,
        variant: "destructive",
      });
    },
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: userAuthApi.login,
    onSuccess: (data) => {
      localStorage.setItem("app_user_saved_email", email);
      queryClient.invalidateQueries({ queryKey: ["/api/user/me"] });
      toast({
        title: "Welcome Back!",
        description: data.message || "Signed in successfully.",
      });
      if (data.requiresTos) {
        navigate("/api-verify");
      } else {
        window.location.href = "/user";
      }
    },
    onError: (error: any) => {
      let msg = "Invalid email/username or password.";
      try {
        if (error.message) {
          const parsed = JSON.parse(error.message.replace(/^\d+:\s*/, ""));
          msg = parsed.message || msg;
        }
      } catch {
        msg = error.message || msg;
      }
      toast({
        title: "Sign In Failed",
        description: msg,
        variant: "destructive",
      });
    },
  });

  // Forgot password request mutation (Step 1)
  const forgotPasswordMutation = useMutation({
    mutationFn: userAuthApi.forgotPassword,
    onSuccess: (data) => {
      toast({
        title: "Recovery Email Dispatched",
        description: data.message || "A 6-digit verification code has been sent to your email.",
      });
      if (data.devCode) {
        setSimulatedDevCode(data.devCode);
        setRecoveryCode(data.devCode);
      }
      setRecoveryStep(2);
    },
    onError: (error: any) => {
      let msg = "Failed to send password recovery email. Please try again.";
      try {
        if (error.message) {
          const parsed = JSON.parse(error.message.replace(/^\d+:\s*/, ""));
          msg = parsed.message || msg;
        }
      } catch {
        msg = error.message || msg;
      }
      toast({
        title: "Recovery Request Failed",
        description: msg,
        variant: "destructive",
      });
    },
  });

  // Complete password reset mutation (Step 2)
  const resetPasswordMutation = useMutation({
    mutationFn: userAuthApi.resetPassword,
    onSuccess: (data) => {
      toast({
        title: "Password Reset Successful!",
        description: data.message || "Your password has been updated. You can now sign in.",
      });
      // Switch back to sign in mode with email pre-filled
      setEmail(recoveryEmail);
      setPassword("");
      setAuthMode("signin");
      setRecoveryStep(1);
      setRecoveryCode("");
      setNewPassword("");
      setConfirmPassword("");
      setSimulatedDevCode(null);
    },
    onError: (error: any) => {
      let msg = "Failed to reset password. Please check your verification code.";
      try {
        if (error.message) {
          const parsed = JSON.parse(error.message.replace(/^\d+:\s*/, ""));
          msg = parsed.message || msg;
        }
      } catch {
        msg = error.message || msg;
      }
      toast({
        title: "Password Reset Failed",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmittedAttempt(true);

    if (registerMutation.isPending || loginMutation.isPending) {
      return;
    }

    if (!email.trim() || !password) {
      toast({
        title: "Required Fields Missing",
        description: "Please fill in your email address and password.",
        variant: "destructive",
      });
      return;
    }

    if (authMode === "signup") {
      // Validate password strength requirements
      if (!passwordEvaluation.lengthValid) {
        toast({
          title: "Password Too Short",
          description: "Password must be at least 8 characters long.",
          variant: "destructive",
        });
        return;
      }

      if (!passwordEvaluation.hasLower || !passwordEvaluation.hasUpper || (!passwordEvaluation.hasNumber && !passwordEvaluation.hasSpecial)) {
        toast({
          title: "Password Requirements Not Met",
          description: "Please include mixed character types: uppercase, lowercase, and numbers or symbols.",
          variant: "destructive",
        });
        return;
      }

      // Check Terms of Service and Privacy Policy validation
      if (!tosAccepted) {
        toast({
          title: "Terms & Privacy Policy Required",
          description: "You must agree to the Terms of Service and Privacy Policy before creating your account.",
          variant: "destructive",
        });
        return;
      }

      registerMutation.mutate({
        fullName: fullName.trim() || undefined,
        email: email.trim().toLowerCase(),
        password,
        newsletter,
        tosAccepted: true,
      });
    } else if (authMode === "signin") {
      loginMutation.mutate({
        username: email.trim(),
        password,
      });
    }
  };

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter your registered email address.",
        variant: "destructive",
      });
      return;
    }

    forgotPasswordMutation.mutate({
      email: recoveryEmail.trim().toLowerCase(),
    });
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!recoveryCode.trim()) {
      toast({
        title: "Verification Code Required",
        description: "Please enter the 6-digit recovery code sent to your email.",
        variant: "destructive",
      });
      return;
    }

    if (!newPasswordEvaluation.lengthValid || !newPasswordEvaluation.hasLower || !newPasswordEvaluation.hasUpper || (!newPasswordEvaluation.hasNumber && !newPasswordEvaluation.hasSpecial)) {
      toast({
        title: "Weak Password",
        description: "New password must be at least 8 characters and include uppercase, lowercase, and numbers or symbols.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords Do Not Match",
        description: "Please make sure your new password and confirmation match.",
        variant: "destructive",
      });
      return;
    }

    resetPasswordMutation.mutate({
      email: recoveryEmail.trim().toLowerCase(),
      code: recoveryCode.trim(),
      newPassword,
    });
  };

  const isPending = registerMutation.isPending || loginMutation.isPending;

  return (
    <div className="min-h-screen bg-[#111111] text-white flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* ── Top Header Navigation ────────────────────────────────────────── */}
      <header className="border-b border-white/10 bg-[#161616]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black transition-all">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              CleanTraffic
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => navigate("/")}
              className="text-sm text-neutral-400 hover:text-white transition-colors hidden sm:block"
            >
              Back to Home
            </button>
            <div className="h-4 w-px bg-white/10 hidden sm:block" />
            <div className="flex items-center bg-black/40 p-1 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signup");
                  setFormSubmittedAttempt(false);
                }}
                className={`text-xs sm:text-sm font-medium px-3.5 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                  authMode === "signup"
                    ? "bg-white text-black shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Sign Up Trial
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signin");
                  setFormSubmittedAttempt(false);
                }}
                className={`text-xs sm:text-sm font-medium px-3.5 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                  authMode === "signin"
                    ? "bg-white text-black shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Auth Card Section ────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12 md:py-16">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Left Column: Product Value & Platform Highlights */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#1a1a1a] via-[#161616] to-[#121212] border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div>
              {authMode === "forgot" ? (
                <>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-6">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    Account Security
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-4 leading-snug">
                    Secure Password Recovery Flow
                  </h2>

                  <p className="text-neutral-400 text-sm sm:text-[15px] leading-relaxed mb-8">
                    Reset your credentials safely using our cryptographic one-time verification mechanism.
                  </p>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">Encrypted Verification Code</h4>
                        <p className="text-xs text-neutral-400 mt-0.5">A secure 6-digit recovery code is delivered to your registered email.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 mt-0.5">
                        <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">15-Minute Expiry Safety</h4>
                        <p className="text-xs text-neutral-400 mt-0.5">Recovery sessions expire automatically to protect your account against hijacking.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 mt-0.5">
                        <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">Instant API Key Preservation</h4>
                        <p className="text-xs text-neutral-400 mt-0.5">All active API keys and traffic whitelist rules remain fully preserved.</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    7-Day Free Trial
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-4 leading-snug">
                    Stop click fraud & malicious bots in real-time.
                  </h2>

                  <p className="text-neutral-400 text-sm sm:text-[15px] leading-relaxed mb-8">
                    Join performance marketers and webmasters protecting ad budgets and infrastructure with CleanTraffic's 4-layer inspection engine.
                  </p>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">5,000 Free Inspection Quota</h4>
                        <p className="text-xs text-neutral-400 mt-0.5">Full access to live bot heuristics and IP datacenter feeds.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 mt-0.5">
                        <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">Instant API Key Provisioning</h4>
                        <p className="text-xs text-neutral-400 mt-0.5">Ready-to-use PHP snippet and REST API endpoint upon signup.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 mt-0.5">
                        <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">Geofencing & ISP Controls</h4>
                        <p className="text-xs text-neutral-400 mt-0.5">Custom whitelist/blacklist rules for countries, ASN, and cloud hosts.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 mt-0.5">
                        <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">No Credit Card Required</h4>
                        <p className="text-xs text-neutral-400 mt-0.5">Start testing immediately. Upgrade or cancel whenever you choose.</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="pt-6 border-t border-white/10 text-xs text-neutral-500">
              Active protection across Google Ads, Meta, TikTok, and direct affiliate networks.
            </div>
          </div>

          {/* Right Column: Interactive Forms (Sign Up / Sign In / Forgot Password) */}
          <div className="lg:col-span-7 bg-[#181818] border border-white/10 rounded-2xl p-6 sm:p-8 lg:p-10 shadow-2xl flex flex-col justify-center">
            
            {/* ── FORGOT PASSWORD RECOVERY VIEW ────────────────────────────── */}
            {authMode === "forgot" ? (
              <div className="space-y-6">
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("signin");
                      setRecoveryStep(1);
                      setSimulatedDevCode(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium mb-3 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Sign In
                  </button>
                  <h3 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                    <KeyRound className="w-6 h-6 text-emerald-400" />
                    Reset Your Password
                  </h3>
                  <p className="text-sm text-neutral-400 mt-1">
                    {recoveryStep === 1
                      ? "Enter your registered email address to receive a secure 6-digit recovery code."
                      : `Enter the 6-digit recovery code sent to ${recoveryEmail} and choose a new password.`}
                  </p>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center gap-2 py-1">
                  <div
                    className={`flex-1 h-1.5 rounded-full transition-colors ${
                      recoveryStep >= 1 ? "bg-emerald-500" : "bg-white/10"
                    }`}
                  />
                  <div
                    className={`flex-1 h-1.5 rounded-full transition-colors ${
                      recoveryStep >= 2 ? "bg-emerald-500" : "bg-white/10"
                    }`}
                  />
                </div>

                {/* Step 1: Request Reset Code */}
                {recoveryStep === 1 && (
                  <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="recoveryEmail" className="text-xs font-semibold text-neutral-300">
                        Registered Email Address
                      </Label>
                      <div className="relative">
                        <Input
                          id="recoveryEmail"
                          type="email"
                          placeholder="you@domain.com"
                          value={recoveryEmail}
                          onChange={(e) => setRecoveryEmail(e.target.value)}
                          disabled={forgotPasswordMutation.isPending}
                          required
                          autoComplete="email"
                          className="bg-[#222222] border-white/10 text-white placeholder:text-neutral-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 h-11 rounded-xl text-sm pl-10"
                        />
                        <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={forgotPasswordMutation.isPending || !recoveryEmail.trim()}
                      className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                    >
                      {forgotPasswordMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-black" />
                          <span>Sending Recovery Code...</span>
                        </>
                      ) : (
                        <>
                          <span>Send Recovery Code</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </form>
                )}

                {/* Step 2: Enter Code and New Strong Password */}
                {recoveryStep === 2 && (
                  <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                    {/* Simulated code banner for instant preview usability */}
                    {simulatedDevCode && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-400">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 shrink-0" />
                          <span>Simulated Email Code: <strong>{simulatedDevCode}</strong></span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRecoveryCode(simulatedDevCode)}
                          className="text-[11px] underline underline-offset-2 hover:text-white"
                        >
                          Auto-fill
                        </button>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="recoveryCode" className="text-xs font-semibold text-neutral-300">
                          6-Digit Recovery Code
                        </Label>
                        <button
                          type="button"
                          onClick={() => setRecoveryStep(1)}
                          className="text-[11px] text-neutral-400 hover:text-white underline"
                        >
                          Resend Code
                        </button>
                      </div>
                      <Input
                        id="recoveryCode"
                        type="text"
                        maxLength={6}
                        placeholder="e.g. 492815"
                        value={recoveryCode}
                        onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, ""))}
                        disabled={resetPasswordMutation.isPending}
                        required
                        className="bg-[#222222] border-white/10 text-white placeholder:text-neutral-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 h-11 rounded-xl text-sm font-mono tracking-widest text-center"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="newPassword" className="text-xs font-semibold text-neutral-300">
                          New Password
                        </Label>
                        <span className="text-[11px] text-neutral-400">
                          Min 8 chars, mixed types
                        </span>
                      </div>
                      <div className="relative">
                        <Input
                          id="newPassword"
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Enter your new password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          disabled={resetPasswordMutation.isPending}
                          required
                          autoComplete="new-password"
                          className="bg-[#222222] border-white/10 text-white placeholder:text-neutral-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 h-11 rounded-xl text-sm pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Password Strength Indicator */}
                      <PasswordStrengthIndicator password={newPassword} showRequirements={true} />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="confirmPassword" className="text-xs font-semibold text-neutral-300">
                        Confirm New Password
                      </Label>
                      <Input
                        id="confirmPassword"
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Re-enter your new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={resetPasswordMutation.isPending}
                        required
                        autoComplete="new-password"
                        className="bg-[#222222] border-white/10 text-white placeholder:text-neutral-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 h-11 rounded-xl text-sm"
                      />
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          Passwords do not match
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      disabled={
                        resetPasswordMutation.isPending ||
                        !recoveryCode ||
                        !newPasswordEvaluation.isSatisfied ||
                        newPassword !== confirmPassword
                      }
                      className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                    >
                      {resetPasswordMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-black" />
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          <span>Reset Password & Sign In</span>
                        </>
                      )}
                    </Button>
                  </form>
                )}

                <div className="pt-2 text-center text-xs text-neutral-400">
                  Remember your password?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("signin");
                      setRecoveryStep(1);
                    }}
                    className="text-emerald-400 hover:text-emerald-300 font-medium underline underline-offset-2 ml-1"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            ) : (
              /* ── SIGN UP & SIGN IN FORMS ──────────────────────────────────── */
              <>
                {/* Header */}
                <div className="mb-6">
                  <h3 className="text-2xl font-bold tracking-tight text-white">
                    {authMode === "signup" ? "Create Your Trial Account" : "Sign In to CleanTraffic"}
                  </h3>
                  <p className="text-sm text-neutral-400 mt-1">
                    {authMode === "signup"
                      ? "Enter your details to activate your 7-day free trial and API key."
                      : "Enter your registered email and password to access your dashboard."}
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {authMode === "signup" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="fullName" className="text-xs font-semibold text-neutral-300">
                        Full Name <span className="text-neutral-500">(Optional)</span>
                      </Label>
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="e.g. Alex Morgan"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={isPending}
                        className="bg-[#222222] border-white/10 text-white placeholder:text-neutral-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 h-11 rounded-xl text-sm"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold text-neutral-300">
                      {authMode === "signup" ? "Email Address" : "Email or Username"}
                    </Label>
                    <Input
                      id="email"
                      type={authMode === "signup" ? "email" : "text"}
                      placeholder="you@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isPending}
                      required
                      autoComplete="email"
                      className="bg-[#222222] border-white/10 text-white placeholder:text-neutral-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 h-11 rounded-xl text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-xs font-semibold text-neutral-300">
                        Password
                      </Label>
                      {authMode === "signup" ? (
                        <span className="text-[11px] text-neutral-400">
                          Min 8 chars, mixed letters & numbers/symbols
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setRecoveryEmail(email);
                            setAuthMode("forgot");
                            setRecoveryStep(1);
                          }}
                          className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium underline underline-offset-2 transition-colors"
                        >
                          Forgot Password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder={authMode === "signup" ? "Enter a strong password" : "Enter your password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isPending}
                        required
                        autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                        className="bg-[#222222] border-white/10 text-white placeholder:text-neutral-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 h-11 rounded-xl text-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Password Strength Indicator (Sign-Up mode only) */}
                    {authMode === "signup" && (
                      <PasswordStrengthIndicator password={password} showRequirements={true} />
                    )}
                  </div>

                  {authMode === "signup" && (
                    <div className="pt-2 space-y-3">
                      {/* Newsletter opt-in */}
                      <div className="flex items-start gap-2.5">
                        <Checkbox
                          id="newsletter"
                          checked={newsletter}
                          onCheckedChange={(checked) => setNewsletter(!!checked)}
                          disabled={isPending}
                          className="mt-0.5 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 border-white/20"
                        />
                        <Label htmlFor="newsletter" className="text-xs text-neutral-400 font-normal leading-relaxed cursor-pointer">
                          Send me email updates on newly detected bot ranges, traffic anomalies, and feature releases.
                        </Label>
                      </div>

                      {/* Required Terms of Service and Privacy Policy Checkbox */}
                      <div
                        className={`flex items-start gap-2.5 p-2 rounded-lg transition-colors ${
                          formSubmittedAttempt && !tosAccepted
                            ? "bg-rose-500/10 border border-rose-500/30"
                            : "border border-transparent"
                        }`}
                      >
                        <Checkbox
                          id="tos"
                          checked={tosAccepted}
                          onCheckedChange={(checked) => setTosAccepted(!!checked)}
                          disabled={isPending}
                          className={`mt-0.5 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 ${
                            formSubmittedAttempt && !tosAccepted
                              ? "border-rose-400 ring-1 ring-rose-400"
                              : "border-white/30"
                          }`}
                        />
                        <div className="space-y-1">
                          <Label htmlFor="tos" className="text-xs text-neutral-300 font-normal leading-relaxed cursor-pointer block">
                            I agree to the{" "}
                            <span className="text-emerald-400 underline underline-offset-2 font-medium">Terms of Service</span>{" "}
                            and{" "}
                            <span className="text-emerald-400 underline underline-offset-2 font-medium">Privacy Policy</span>.
                            <span className="text-rose-400 ml-1 font-semibold">*</span>
                          </Label>
                          {formSubmittedAttempt && !tosAccepted && (
                            <p className="text-[11px] text-rose-400 flex items-center gap-1 font-medium">
                              <AlertCircle className="w-3 h-3" />
                              You must accept the Terms of Service & Privacy Policy to sign up.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Submit Button with Loading Spinner to prevent multiple submissions */}
                  <Button
                    type="submit"
                    disabled={
                      isPending ||
                      (authMode === "signup" &&
                        (!passwordEvaluation.isSatisfied || !email.trim() || !tosAccepted))
                    }
                    className="w-full h-12 mt-2 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-black font-semibold rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>{authMode === "signup" ? "Creating Your Account..." : "Signing In..."}</span>
                      </div>
                    ) : (
                      <>
                        <span>{authMode === "signup" ? "Sign Up & Start Trial" : "Sign In to Dashboard"}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </form>

                {/* Bottom Mode Switcher & Forgot Password link */}
                <div className="mt-6 text-center text-xs text-neutral-400 space-y-2">
                  {authMode === "signup" ? (
                    <p>
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("signin");
                          setFormSubmittedAttempt(false);
                        }}
                        className="text-emerald-400 hover:text-emerald-300 font-medium underline underline-offset-2 ml-1"
                      >
                        Sign In
                      </button>
                      {" · "}
                      <button
                        type="button"
                        onClick={() => {
                          setRecoveryEmail(email);
                          setAuthMode("forgot");
                          setRecoveryStep(1);
                        }}
                        className="text-neutral-400 hover:text-emerald-400 font-medium transition-colors"
                      >
                        Forgot Password?
                      </button>
                    </p>
                  ) : (
                    <>
                      <p>
                        Don't have an account yet?{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode("signup");
                            setFormSubmittedAttempt(false);
                          }}
                          className="text-emerald-400 hover:text-emerald-300 font-medium underline underline-offset-2 ml-1"
                        >
                          Start 7-Day Free Trial
                        </button>
                      </p>
                      <p>
                        <button
                          type="button"
                          onClick={() => {
                            setRecoveryEmail(email);
                            setAuthMode("forgot");
                            setRecoveryStep(1);
                          }}
                          className="text-xs text-neutral-400 hover:text-emerald-400 transition-colors underline underline-offset-2"
                        >
                          Forgot your password? Reset it here
                        </button>
                      </p>
                    </>
                  )}
                </div>
              </>
            )}

          </div>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-6 px-4 text-center text-xs text-neutral-500">
        <p>© {new Date().getFullYear()} CleanTraffic Inc. All rights reserved. Enterprise Bot Mitigation & Geofencing Platform.</p>
      </footer>
    </div>
  );
}
