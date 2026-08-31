import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Link as LinkIcon, 
  Save, 
  Users, 
  Bot, 
  Sparkles, 
  ExternalLink, 
  ShieldCheck, 
  ArrowRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function UserRoutingTab() {
  const { toast } = useToast();
  const [humanUrl, setHumanUrl] = useState("");
  const [botUrl, setBotUrl] = useState("");

  const { data: redirectUrls, isLoading } = useQuery<{
    humanUrl: string;
    botUrl: string;
  }>({
    queryKey: ["/api/user/redirect-urls"],
    refetchOnMount: true,
  });

  useEffect(() => {
    if (redirectUrls) {
      setHumanUrl(redirectUrls.humanUrl || "");
      setBotUrl(redirectUrls.botUrl || "");
    }
  }, [redirectUrls]);

  const updateUrlsMutation = useMutation({
    mutationFn: async (urls: { humanUrl: string; botUrl: string }) => {
      const response = await apiRequest("PUT", "/api/user/redirect-urls", urls);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Routing Configuration Saved",
        description: "Your human and bot redirect destinations are live instantly.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/redirect-urls"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update redirect URLs",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!humanUrl || !botUrl) {
      toast({
        title: "Missing Destination URLs",
        description: "Please specify both Human Target and Bot Safe URLs",
        variant: "destructive",
      });
      return;
    }
    updateUrlsMutation.mutate({ humanUrl, botUrl });
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#101726] border border-[#1c2638] rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <LinkIcon className="h-5 w-5 text-blue-500" />
            Dynamic Redirect Routing
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure dynamic redirection endpoints without modifying your deployed PHP scripts or website files.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Human Route Card */}
          <div className="bg-[#131b2c] border border-[#202d44] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Target Offer (Human Visitors)</h4>
                  <p className="text-[11px] text-slate-400">Where legitimate visitors get routed</p>
                </div>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Money Page
              </span>
            </div>

            <div className="space-y-1.5 pt-2">
              <Label className="text-xs text-slate-300">Target Destination URL</Label>
              <Input
                type="url"
                value={humanUrl}
                onChange={(e) => setHumanUrl(e.target.value)}
                placeholder="https://myoffer.com/landing-page"
                className="bg-[#0e1422] border-[#223049] text-white text-xs font-mono h-10"
              />
              <p className="text-[11px] text-slate-500">
                Query parameters and tracking tokens (e.g. UTM tags, ?email=) are passed along automatically.
              </p>
            </div>
          </div>

          {/* Bot Safe Route Card */}
          <div className="bg-[#131b2c] border border-[#202d44] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Safe Landing (Bots & Crawlers)</h4>
                  <p className="text-[11px] text-slate-400">Where bots, ad reviewers & crawlers land</p>
                </div>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                Safe Page
              </span>
            </div>

            <div className="space-y-1.5 pt-2">
              <Label className="text-xs text-slate-300">Safe Article / Neutral URL</Label>
              <Input
                type="url"
                value={botUrl}
                onChange={(e) => setBotUrl(e.target.value)}
                placeholder="https://mywebsite.com/news-article"
                className="bg-[#0e1422] border-[#223049] text-white text-xs font-mono h-10"
              />
              <p className="text-[11px] text-slate-500">
                Shown to automated datacenter crawlers, VPN proxies, and search engine inspection robots.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#1c2638]">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-blue-400" />
            Changes take effect across all integrated scripts in under 2 seconds.
          </div>
          <Button
            onClick={handleSave}
            disabled={updateUrlsMutation.isPending || isLoading}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-6 gap-2"
          >
            <Save className="h-4 w-4" />
            {updateUrlsMutation.isPending ? "Saving..." : "Save Routing Config"}
          </Button>
        </div>
      </div>
    </div>
  );
}
