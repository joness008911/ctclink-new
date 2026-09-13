import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, ArrowLeft, Loader2, Lock, User, ArrowRight } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (data) => {
      if (data?.user) {
        queryClient.setQueryData(["/api/auth/user"], data.user);
      }
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Admin Authenticated",
        description: "Welcome to CleanTraffic Admin Control Center",
      });
      navigate("/interface");
    },
    onError: (error: Error) => {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid username or password",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({
        title: "Missing Information",
        description: "Please enter both username and password",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900 relative">
      {/* Background ambient accents */}
      <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-40" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-teal-100/30 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5 cursor-pointer group select-none"
          >
            <div className="w-9 h-9 rounded-xl bg-[#064E3B] border border-[#047857] flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
              CleanTraffic
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#064E3B] via-emerald-600 to-teal-500" />

          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold uppercase tracking-wider mb-4">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              Administrative Portal
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Control Center</h1>
            <p className="text-sm text-slate-600 mt-1.5">
              Sign in with administrative credentials to manage system rules and audit logs.
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Admin Username
              </Label>
              <div className="relative">
                <Input 
                  type="text" 
                  id="username"
                  data-testid="input-username"
                  placeholder="Enter admin username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 h-11 rounded-xl text-sm pl-10 shadow-xs"
                  disabled={loginMutation.isPending}
                  autoComplete="username"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Admin Password
              </Label>
              <div className="relative">
                <Input 
                  type="password" 
                  id="password"
                  data-testid="input-password"
                  placeholder="Enter admin password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 h-11 rounded-xl text-sm pl-10 shadow-xs"
                  disabled={loginMutation.isPending}
                  autoComplete="current-password"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
            
            <Button 
              type="submit" 
              data-testid="button-login"
              className="w-full h-12 mt-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl text-sm transition-all duration-150 flex items-center justify-center gap-2 shadow-xs hover:shadow disabled:opacity-50 cursor-pointer"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Authenticating Admin...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Admin Center</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center space-y-1.5 text-xs text-slate-500">
            <p className="flex items-center justify-center gap-1.5 font-medium text-slate-600">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Restricted Administrative Gateway
            </p>
            <p className="text-[11px] text-slate-400">
              Authorized personnel only. All access attempts are logged and monitored.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 py-6 px-4 text-center text-xs text-slate-500 bg-white/50 relative z-10">
        <p>© {new Date().getFullYear()} CleanTraffic Inc. All rights reserved. Enterprise Bot Mitigation & Geofencing Platform.</p>
      </footer>
    </div>
  );
}
