import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import UserLogin from "@/pages/user-login";
import ApiVerify from "@/pages/api-verify";
import UserDashboard from "@/pages/user-dashboard";
import Landing from "@/pages/landing";
import { userAuthApi } from "@/lib/user-auth";
import { authApi } from "@/lib/auth";

// Standalone Client User Portal
function UserPortal() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/user/me"],
    queryFn: userAuthApi.getCurrentUser,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading Client Portal...</p>
        </div>
      </div>
    );
  }

  const isUserAuthenticated = !!user && !error;

  return isUserAuthenticated ? <UserDashboard /> : <UserLogin />;
}

// Standalone Admin Control Center
function AdminPortal() {
  const { data: adminUser, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: authApi.getCurrentUser,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading Admin Control Center...</p>
        </div>
      </div>
    );
  }

  const isAdminAuthenticated = !!adminUser && !error;

  return isAdminAuthenticated ? <Dashboard /> : <Login />;
}

function MainRouter() {
  return (
    <Switch>
      {/* Public Landing Page */}
      <Route path="/" component={Landing} />

      {/* Client User Portal Endpoints */}
      <Route path="/api-verify" component={ApiVerify} />
      <Route path="/user" component={UserPortal} />
      <Route path="/user/:rest*" component={UserPortal} />

      {/* Admin Control Center Endpoints */}
      <Route path="/interface" component={AdminPortal} />
      <Route path="/interface/:rest*" component={AdminPortal} />
      <Route path="/login" component={AdminPortal} />
      <Route path="/admin" component={AdminPortal} />

      {/* 404 Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <MainRouter />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
