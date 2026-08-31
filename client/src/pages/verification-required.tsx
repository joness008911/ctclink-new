import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { userAuthApi } from "@/lib/user-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Zap,
  Sparkles,
  Inbox,
  Clock,
  ArrowLeft,
  KeyRound,
  ExternalLink,
} from "lucide-react";

export default function VerificationRequired() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Extract query parameters from URL
  const getQueryParams = () => {
    if (typeof window === "undefined") return { email: "", token: "", status: "", error: "" };
    const params = new URLSearchParams(window.location.search);
    return {
      email: params.get("email") || localStorage.getItem("pending_verification_email") || "",
      token: params.get("token") || "",
      status: params.get("status") || "",
      error: params.get("error") || "",
    };
  };

  const initialParams = getQueryParams();
  const [email, setEmail] = useState(initialParams.email);
  const [code, setCode] = useState("");
  const [isVerified, setIsVerified] = useState(initialParams.status === "success");
  const [cooldown, setCooldown] = useState(0);

  // Sync email to localStorage
  useEffect(() => {
    if (email) {
      localStorage.setItem("pending_verification_email", email);
    }
  }, [email]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Verify mutation
  const verifyMutation = useMutation({
    mutationFn: userAuthApi.verifyEmail,
    onSuccess: (data) => {
      setIsVerified(true);
      queryClient.invalidateQueries({ queryKey: ["/api/user/me"] });
      toast({
        title: "Email Verified!",
        description: data.message || "Your email has been verified and your account is active.",
      });
    },
    onError: (error: any) => {
      let msg = "Failed to verify email. Please verify the code or request a new one.";
      try {
        if (error.message) {
          const parsed = JSON.parse(error.message.replace(/^\d+:\s*/, ""));
          msg = parsed.message || msg;
        }
      } catch {
        msg = error.message || msg;
      }
      toast({
        title: "Verification Failed",
        description: msg,
        variant: "destructive",
      });
    },
  });

  // Resend verification mutation
  const resendMutation = useMutation({
    mutationFn: userAuthApi.resendVerification,
    onSuccess: (data) => {
      setCooldown(60);
      if (data.alreadyVerified) {
        setIsVerified(true);
        toast({
          title: "Already Verified",
          description: data.message || "Your email is already verified. You can sign in now.",
        });
      } else {
        toast({
          title: "Verification Email Sent",
          description: data.message || `A new verification email has been sent to ${email}.`,
        });
      }
    },
    onError: (error: any) => {
      let msg = "Failed to resend verification email.";
      try {
        if (error.message) {
          const parsed = JSON.parse(error.message.replace(/^\d+:\s*/, ""));
          msg = parsed.message || msg;
          if (parsed.retryAfter) {
            setCooldown(parsed.retryAfter);
          }
        }
      } catch {
        msg = error.message || msg;
      }
      toast({
        title: "Resend Failed",
        description: msg,
        variant: "destructive",
      });
    },
  });

  // Auto-verify if token is present in the URL on mount
  useEffect(() => {
    const params = getQueryParams();
    if (params.token && !isVerified) {
      verifyMutation.mutate({ token: params.token, email: params.email || undefined });
    }
  }, []);

  const handleVerifySubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!code.trim()) {
      toast({
        title: "Code Required",
        description: "Please enter the 6-digit confirmation code.",
        variant: "destructive",
      });
      return;
    }
    verifyMutation.mutate({
      code: code.trim(),
      email: email.trim() || undefined,
    });
  };

  const handleResend = () => {
    if (cooldown > 0) return;
    if (!email.trim()) {
      toast({
        title: "Email Required",
        description: "Please specify your email address to resend verification.",
        variant: "destructive",
      });
      return;
    }
    resendMutation.mutate({ email: email.trim() });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Ambient background glows */}
      <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] bg-emerald-600/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
              CleanTraffic <span className="text-blue-400">Cloak</span>
            </span>
            <span className="text-xs text-slate-400 block -mt-1 font-mono">
              Account Security & Verification
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/signin")}
          className="text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-700/60"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Sign In
        </Button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10 my-8">
        <div className="w-full max-w-lg">
          {/* Card Container */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            {/* Top decorative gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400" />

            {isVerified ? (
              /* Verified Success State */
              <div className="text-center py-4 space-y-6">
                <div className="w-20 h-20 bg-emerald-500/15 border-2 border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10 animate-in zoom-in-95 duration-300">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    Email Verified Successfully!
                  </h1>
                  <p className="text-slate-300 text-sm leading-relaxed max-w-md mx-auto">
                    Your CleanTraffic account is now verified and your 7-day free trial has been fully activated.
                  </p>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 text-left space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                    <Sparkles className="w-4 h-4" /> Ready to Use
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1.5">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      5,000 cloaked trial requests included
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Real-time AI bot detection & threat telemetry
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Instant API integration snippet ready in dashboard
                    </li>
                  </ul>
                </div>

                <Button
                  onClick={() => {
                    window.location.href = "/user";
                  }}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium py-3 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
                >
                  Continue to User Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              /* Verification Required / Pending State */
              <div className="space-y-6">
                {/* Visual Icon & Headline */}
                <div className="text-center space-y-3">
                  <div className="relative inline-block">
                    <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto text-blue-400 shadow-inner">
                      <Mail className="w-8 h-8" />
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500"></span>
                    </span>
                  </div>

                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    Verify Your Email Address
                  </h1>

                  <p className="text-slate-300 text-sm leading-relaxed">
                    We sent a verification link and a 6-digit confirmation code to:
                  </p>

                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-950/60 border border-blue-800/60 rounded-full text-blue-200 text-sm font-mono font-medium max-w-full overflow-hidden text-ellipsis">
                    <Inbox className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span className="truncate">{email || "your registered email"}</span>
                  </div>
                </div>

                {/* 6-Digit Code Confirmation Form */}
                <form onSubmit={handleVerifySubmit} className="space-y-4 pt-1">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-blue-400" /> Enter 6-Digit Code
                      </span>
                      <span className="text-slate-400 text-[11px] font-normal normal-case">
                        Check Spam / Promotions
                      </span>
                    </label>

                    <div className="flex gap-2">
                      <Input
                        type="text"
                        maxLength={6}
                        placeholder="123456"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                        className="bg-slate-950/80 border-slate-700 text-white text-center text-xl font-mono tracking-widest placeholder:tracking-normal placeholder:text-slate-600 h-12 focus-visible:ring-blue-500 focus-visible:border-blue-500 rounded-xl"
                      />
                      <Button
                        type="submit"
                        disabled={verifyMutation.isPending || code.length < 4}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-5 h-12 rounded-xl font-medium shadow-md shadow-blue-600/20 flex-shrink-0"
                      >
                        {verifyMutation.isPending ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          "Confirm Code"
                        )}
                      </Button>
                    </div>
                  </div>
                </form>

                {/* Resend & Secondary Actions */}
                <div className="border-t border-slate-800/80 pt-4 space-y-3 text-center">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">
                      Didn't receive the email?
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResend}
                      disabled={resendMutation.isPending || cooldown > 0}
                      className="border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 w-full sm:w-auto text-xs"
                    >
                      {resendMutation.isPending ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Sending...
                        </>
                      ) : cooldown > 0 ? (
                        <>
                          <Clock className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                          Resend in {cooldown}s
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                          Resend Verification Email
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center justify-center gap-4 text-xs text-slate-400 pt-2">
                    <button
                      type="button"
                      onClick={() => navigate("/signup")}
                      className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
                    >
                      Change email address
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => navigate("/signin")}
                      className="text-slate-400 hover:text-slate-300 underline underline-offset-2 transition-colors"
                    >
                      Return to sign in
                    </button>
                  </div>
                </div>

                {/* Helpful instructions footer */}
                <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3.5 text-xs text-slate-400 space-y-1.5">
                  <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-blue-400" />
                    Troubleshooting Tips:
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed text-slate-400">
                    <li>Verification codes and links expire after 24 hours.</li>
                    <li>If you don't see the email after 2 minutes, check your junk or spam folder.</li>
                    <li>Ensure you clicked the most recently requested verification link.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 px-6 py-4 text-center text-xs text-slate-500 z-10">
        <p>© {new Date().getFullYear()} CleanTraffic Cloak Enterprise Security. All rights reserved.</p>
      </footer>
    </div>
  );
}
