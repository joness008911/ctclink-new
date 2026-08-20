import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Shield } from "lucide-react";
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
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-purple-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <div className="bg-primary rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Shield className="text-primary-foreground text-2xl h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Admin Control Center</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in with administrative credentials
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="username" className="block text-sm font-medium text-foreground mb-2">
                Admin Username
              </Label>
              <Input 
                type="text" 
                id="username"
                data-testid="input-username"
                placeholder="Enter admin username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full"
                disabled={loginMutation.isPending}
                autoComplete="username"
              />
            </div>
            
            <div>
              <Label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                Password
              </Label>
              <Input 
                type="password" 
                id="password"
                data-testid="input-password"
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
                disabled={loginMutation.isPending}
                autoComplete="current-password"
              />
            </div>
            
            <Button 
              type="submit" 
              data-testid="button-login"
              className="w-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Authenticating...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Sign In to Admin
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t text-center">
            <p className="text-xs text-muted-foreground">
              Protected Administrative Interface
            </p>
          </div>
          
        </CardContent>
      </Card>
    </div>
  );
}
