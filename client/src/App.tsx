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

function UserRouter() {
  const [location] = useLocation();

  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/user/me"],
    queryFn: userAuthApi.getCurrentUser,
    retry: false,
  });

  if (isLoading && location === "/dashboard") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const isUserAuthenticated = !!user && !error;

  return (
    <Switch>
      <Route path="/">
        <Landing />
      </Route>
      <Route path="/api-verify" component={ApiVerify} />
      <Route path="/user">
        {isUserAuthenticated ? <UserDashboard /> : <UserLogin />}
      </Route>
      <Route path="/interface" nest>
        <AdminRouter />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AdminRouter() {
  const [location] = useLocation();
  
  const { data: adminUser, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading admin...</p>
        </div>
      </div>
    );
  }

  const isAdminAuthenticated = !!adminUser && !error;

  return (
    <Switch>
      {!isAdminAuthenticated ? (
        <>
          <Route path="/" component={Login} />
          <Route path="/login" component={Login} />
          <Route component={() => <Login />} />
        </>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route component={NotFound} />
        </>
      )}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <UserRouter />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
