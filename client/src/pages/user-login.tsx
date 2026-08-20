import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { userAuthApi } from "@/lib/user-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck } from "lucide-react";

export default function UserLogin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const savedCreds = localStorage.getItem('app_remember_me');
    if (savedCreds) {
      try {
        const { username: savedUsername, password: savedPassword } = JSON.parse(savedCreds);
        if (savedUsername) setUsername(savedUsername);
        if (savedPassword) setPassword(savedPassword);
        setRememberMe(true);
      } catch (e) {
        console.error("Failed to load saved credentials");
      }
    }
  }, []);

  const loginMutation = useMutation({
    mutationFn: userAuthApi.login,
    onSuccess: (data) => {
      if (rememberMe) {
        localStorage.setItem('app_remember_me', JSON.stringify({
          username,
          password
        }));
      } else {
        localStorage.removeItem('app_remember_me');
      }
      
      toast({
        title: "Login Successful",
        description: data.message || "Please verify your API key to continue.",
      });
      navigate("/api-verify");
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Client User Portal</CardTitle>
          <CardDescription className="text-base">
            Step 1 of 2: Sign in with your client credentials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                data-testid="input-username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loginMutation.isPending}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                data-testid="input-password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loginMutation.isPending}
                autoComplete="current-password"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                data-testid="checkbox-remember-me"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              />
              <label
                htmlFor="remember"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Remember me on this device
              </label>
            </div>

            <Button
              type="submit"
              data-testid="button-login"
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Logging in..." : "Continue to API Key"}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t text-center">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-xs text-muted-foreground hover:underline"
            >
              ← Back to CleanTraffic Home
            </button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
