import { BarChart3, Code, Cog, List, LogOut, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi, type User as AuthUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function Sidebar() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: user } = useQuery<AuthUser>({
    queryKey: ["/api/auth/user"],
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.clear();
      toast({
        title: "Success",
        description: "Logged out successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Logout failed",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const navItems = [
    { icon: BarChart3, label: "Dashboard", active: true },
    { icon: List, label: "Classifications", active: false },
    { icon: Cog, label: "Detection Rules", active: false },
    { icon: Code, label: "API Endpoints", active: false },
    { icon: BarChart3, label: "Analytics", active: false },
  ];

  return (
    <div className="bg-gradient-to-b from-blue-700 to-blue-800 text-white w-64 flex-shrink-0 hidden lg:block h-full">
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-white bg-opacity-20 rounded-lg p-2">
            <Shield className="text-xl h-6 w-6" />
          </div>
        </div>
      </div>
      
      <nav className="mt-8">
        <div className="space-y-2 px-4">
          {navItems.map((item, index) => (
            <button
              key={index}
              data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                item.active 
                  ? 'bg-white bg-opacity-20' 
                  : 'hover:bg-white hover:bg-opacity-10'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        
        <div className="absolute bottom-0 w-64 p-4">
          <div className="bg-white bg-opacity-10 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white bg-opacity-30 rounded-full flex items-center justify-center">
                <User className="text-sm h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm">{user?.username}</p>
                <p className="text-xs opacity-80">Administrator</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-3 text-sm hover:text-gray-200 transition-colors text-white hover:bg-white/10 p-0 h-auto"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {logoutMutation.isPending ? "Logging out..." : "Logout"}
            </Button>
          </div>
        </div>
      </nav>
    </div>
  );
}
