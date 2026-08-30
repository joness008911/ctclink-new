import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { userAuthApi } from "@/lib/user-auth";
import { loginWithGooglePopup } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck,
  Zap,
  CheckCircle2,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  Globe,
  FileCode2,
  Sparkles,
  Layers,
  HelpCircle,
} from "lucide-react";

export default function UserLogin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mode: "signup" (default for new trial) or "signin"
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");

  // Form states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newsletter, setNewsletter] = useState(true);
  const [tosAccepted, setTosAccepted] = useState(true);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Load saved credentials for remember me (signin mode)
  useEffect(() => {
    const saved = localStorage.getItem("app_user_saved_email");
    if (saved) {
      setEmail(saved);
    }
  }, []);

  // Registration mutation
  const registerMutation = useMutation({
    mutationFn: userAuthApi.register,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/me"] });
      toast({
        title: "Trial Activated!",
        description: data.message || "Your 7-day free trial has been created.",
      });
      // Directly reload/navigate to user dashboard
      window.location.href = "/user";
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
        title: "Welcome back!",
        description: data.message || "Logged in successfully.",
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

  // Google Auth mutation
  const googleAuthMutation = useMutation({
    mutationFn: userAuthApi.googleAuth,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/me"] });
      toast({
        title: "Google Authentication Successful",
        description: data.message || "Welcome to CleanTraffic!",
      });
      window.location.href = "/user";
    },
    onError: (error: any) => {
      toast({
        title: "Google Sign-In Failed",
        description: error.message || "Could not complete Google sign-in.",
        variant: "destructive",
      });
    },
  });

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      const googleUser = await loginWithGooglePopup();
      await googleAuthMutation.mutateAsync({
        email: googleUser.email,
        name: googleUser.name,
        googleId: googleUser.googleId,
        idToken: googleUser.idToken,
      });
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user") {
        toast({
          title: "Google Auth Error",
          description: err.message || "Failed to authenticate with Google",
          variant: "destructive",
        });
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      toast({
        title: "Required Fields Missing",
        description: "Please fill in your email address and password.",
        variant: "destructive",
      });
      return;
    }

    if (authMode === "signup") {
      if (password.length < 8) {
        toast({
          title: "Password Too Short",
          description: "Password must be at least 8 characters long.",
          variant: "destructive",
        });
        return;
      }
      if (!tosAccepted) {
        toast({
          title: "Terms of Service Required",
          description: "You must accept the terms of service to start your trial.",
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
    } else {
      loginMutation.mutate({
        username: email.trim(),
        password,
      });
    }
  };

  const isPending =
    registerMutation.isPending || loginMutation.isPending || googleAuthMutation.isPending || isGoogleLoading;

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

          <div className="flex items-center gap-4">
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
                onClick={() => setAuthMode("signup")}
                className={`text-xs sm:text-sm font-medium px-3.5 py-1.5 rounded-md transition-all ${
                  authMode === "signup"
                    ? "bg-white text-black shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Sign Up Trial
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("signin")}
                className={`text-xs sm:text-sm font-medium px-3.5 py-1.5 rounded-md transition-all ${
                  authMode === "signin"
                    ? "bg-white text-black shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Auth Card Section ────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12 md:py-16">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Left Column: Product Value & Free Trial Benefits */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#1a1a1a] via-[#161616] to-[#121212] border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden shadow-2xl">
            {/* Subtle background glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div>
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
            </div>

            <div className="pt-8 mt-8 border-t border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-300">
                  CT
                </div>
                <div className="text-xs text-neutral-400">
                  <span className="font-medium text-neutral-200">256-bit Encrypted Session</span>
                  <p className="text-neutral-500">Strict tenant isolation & data privacy</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Form */}
          <div className="lg:col-span-7 bg-[#181818] border border-white/10 rounded-2xl p-6 sm:p-8 lg:p-10 shadow-2xl flex flex-col justify-center">
            
            {/* Header */}
            <div className="mb-6">
              <h3 className="text-2xl font-bold tracking-tight text-white">
                {authMode === "signup" ? "Start Your 7-Day Free Trial" : "Sign In to CleanTraffic"}
              </h3>
              <p className="text-sm text-neutral-400 mt-1">
                {authMode === "signup"
                  ? "Create your self-serve client account in seconds."
                  : "Enter your registered email or username to access your dashboard."}
              </p>
            </div>

            {/* Google One-Click Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isPending}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#242424] hover:bg-[#2e2e2e] active:bg-[#1f1f1f] text-white border border-white/10 rounded-xl font-medium text-sm transition-all duration-200 shadow-sm disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isGoogleLoading ? "Connecting Google..." : authMode === "signup" ? "Sign up with Google" : "Sign in with Google"}</span>
            </button>

            {/* Divider */}
            <div className="relative my-6 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <span className="relative bg-[#181818] px-3 text-xs uppercase tracking-wider text-neutral-500 font-medium">
                Or with work email
              </span>
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
                  {authMode === "signup" ? "Work Email Address" : "Email or Username"}
                </Label>
                <Input
                  id="email"
                  type={authMode === "signup" ? "email" : "text"}
                  placeholder={authMode === "signup" ? "you@company.com" : "you@company.com or username"}
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
                  {authMode === "signin" && (
                    <span className="text-xs text-neutral-500">
                      Need help? Support 24/7
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={authMode === "signup" ? "Minimum 8 characters" : "Enter password"}
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
              </div>

              {authMode === "signup" && (
                <div className="pt-2 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id="newsletter"
                      checked={newsletter}
                      onCheckedChange={(checked) => setNewsletter(!!checked)}
                      className="mt-0.5 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 border-white/20"
                    />
                    <Label htmlFor="newsletter" className="text-xs text-neutral-400 font-normal leading-relaxed cursor-pointer">
                      Send me email updates on newly detected bot ranges, traffic anomalies, and feature releases.
                    </Label>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id="tos"
                      checked={tosAccepted}
                      onCheckedChange={(checked) => setTosAccepted(!!checked)}
                      className="mt-0.5 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 border-white/20"
                    />
                    <Label htmlFor="tos" className="text-xs text-neutral-400 font-normal leading-relaxed cursor-pointer">
                      I agree to the{" "}
                      <span className="text-white underline underline-offset-2">Terms of Service</span> and{" "}
                      <span className="text-white underline underline-offset-2">Acceptable Use Policy</span>.
                    </Label>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isPending}
                className="w-full h-12 mt-2 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-black font-semibold rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>{authMode === "signup" ? "Creating Your Trial..." : "Signing In..."}</span>
                  </div>
                ) : (
                  <>
                    <span>{authMode === "signup" ? "Start 7-Day Free Trial" : "Sign In to Dashboard"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Bottom Mode Switcher */}
            <div className="mt-6 text-center text-xs text-neutral-400">
              {authMode === "signup" ? (
                <p>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setAuthMode("signin")}
                    className="text-emerald-400 hover:text-emerald-300 font-medium underline underline-offset-2 ml-1"
                  >
                    Sign In
                  </button>
                </p>
              ) : (
                <p>
                  Don't have an account yet?{" "}
                  <button
                    type="button"
                    onClick={() => setAuthMode("signup")}
                    className="text-emerald-400 hover:text-emerald-300 font-medium underline underline-offset-2 ml-1"
                  >
                    Start 7-Day Free Trial
                  </button>
                </p>
              )}
            </div>

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
