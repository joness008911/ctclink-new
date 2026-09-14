import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  Eye, 
  Check, 
  Star, 
  Sliders, 
  Layers, 
  Palette, 
  RefreshCw,
  Info,
  Shield,
  Monitor,
  Smartphone,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InterstitialTheme } from "@shared/interstitialThemes";

export default function ThemeManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<InterstitialTheme | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  // New theme form state
  const [newTheme, setNewTheme] = useState({
    name: "",
    description: "",
    category: "Light",
    badge: "New",
    previewBg: "#f8fafc",
    previewAccent: "#059669",
    htmlHead: `body {
  background-color: #f8fafc;
  color: #0f172a;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  margin: 0;
  padding: 20px;
}
.card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 40px 32px;
  max-width: 440px;
  width: 100%;
  text-align: center;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
}
h1 { font-size: 20px; font-weight: 600; margin: 0 0 8px; color: #0f172a; }
p { font-size: 14px; color: #64748b; margin: 0 0 24px; line-height: 1.5; }
.pulse-bar {
  width: 100%; height: 4px; background: #f1f5f9; border-radius: 9999px; overflow: hidden; position: relative;
}
.pulse-fill {
  width: 40%; height: 100%; background: #059669; border-radius: 9999px; position: absolute;
  animation: indeterminate 1.5s infinite ease-in-out;
}
@keyframes indeterminate {
  0% { left: -40%; }
  50% { left: 40%; }
  100% { left: 100%; }
}
.error-box { display: none; margin-top: 16px; padding: 12px; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; color: #991b1b; font-size: 12px; }
.retry-btn { margin-top: 8px; padding: 6px 14px; background: #dc2626; color: #fff; border: 0; border-radius: 6px; font-size: 12px; cursor: pointer; }`,
    htmlBody: `<div class="card">
  <div style="width:48px;height:48px;background:#ecfdf5;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  </div>
  <h1>{{HEADING}}</h1>
  <p>{{SUBNOTE}}</p>
  <div class="pulse-bar" id="ctc-progress"><div class="pulse-fill"></div></div>
  <div style="font-size:12px;color:#94a3b8;margin-top:16px;" id="ctc-status">Checking connection security...</div>
  
  <div class="error-box" id="ctc-error">
    <span id="ctc-error-msg">Verification timed out.</span><br>
    <button type="button" class="retry-btn" onclick="location.reload()">Retry Connection</button>
  </div>
</div>`,
    scriptJs: "",
    isDefault: false,
    enabled: true,
  });

  // Fetch admin themes
  const { data: themes = [], isLoading, refetch } = useQuery<InterstitialTheme[]>({
    queryKey: ["/api/admin/themes"],
  });

  // Create theme mutation
  const createMutation = useMutation({
    mutationFn: async (themeData: typeof newTheme) => {
      const res = await apiRequest("POST", "/api/admin/themes", themeData);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Theme Created & Deployed",
        description: `Theme "${data.name}" has been published and is now available to all users.`,
      });
      setCreateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/themes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/themes"] });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to Create Theme",
        description: err.message || "An error occurred while creating the theme.",
        variant: "destructive",
      });
    },
  });

  // Toggle enabled status
  const toggleEnabledMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await apiRequest("PUT", `/api/admin/themes/${id}`, { enabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/themes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/themes"] });
    },
    onError: (err: any) => {
      toast({
        title: "Update Failed",
        description: err.message || "Failed to update theme status",
        variant: "destructive",
      });
    },
  });

  // Set default theme
  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/themes/${id}/set-default`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Default Theme Updated",
        description: "New client accounts and reset configurations will default to this theme.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/themes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/themes"] });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to Set Default",
        description: err.message || "Failed to set default theme",
        variant: "destructive",
      });
    },
  });

  // Delete theme
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/themes/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Theme Deleted",
        description: "The theme has been removed from the platform catalogue.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/themes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/themes"] });
    },
    onError: (err: any) => {
      toast({
        title: "Delete Failed",
        description: err.message || "Failed to delete theme",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTheme.name.trim() || !newTheme.htmlHead.trim() || !newTheme.htmlBody.trim()) {
      toast({
        title: "Missing Fields",
        description: "Name, CSS styles, and HTML structure are required.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(newTheme);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border border-emerald-800/40 rounded-xl p-6 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              Loading State Themes & UI Designer
            </h2>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] uppercase font-bold">
              Weekly UI Pushes
            </Badge>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Manage the catalogue of instant verification splash screens. As an administrator, you can push new UI templates, set the platform default, and empower users to choose their preferred loading style.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-9 text-xs gap-1.5 shadow-xs">
                <Plus className="h-4 w-4" />
                Push New UI Design
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <Palette className="h-5 w-5 text-emerald-600" />
                  Push New Loading Screen UI Design
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Create a new self-contained interstitial template. It will instantly appear in all client dashboards under their Integration tab.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Theme Name *</Label>
                    <Input
                      value={newTheme.name}
                      onChange={(e) => setNewTheme({ ...newTheme, name: e.target.value })}
                      placeholder="e.g., Ultra Clean White, Glassmorphic Emerald"
                      className="text-xs h-8"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Category</Label>
                    <Select
                      value={newTheme.category}
                      onValueChange={(val) => setNewTheme({ ...newTheme, category: val })}
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Light">Light (White Theme)</SelectItem>
                        <SelectItem value="Minimal">Minimal</SelectItem>
                        <SelectItem value="Corporate">Corporate</SelectItem>
                        <SelectItem value="Security">Security</SelectItem>
                        <SelectItem value="Dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Badge Label</Label>
                    <Input
                      value={newTheme.badge}
                      onChange={(e) => setNewTheme({ ...newTheme, badge: e.target.value })}
                      placeholder="e.g., New, Popular, White Theme"
                      className="text-xs h-8"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Preview BG Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newTheme.previewBg}
                        onChange={(e) => setNewTheme({ ...newTheme, previewBg: e.target.value })}
                        className="w-8 h-8 rounded border cursor-pointer"
                      />
                      <Input
                        value={newTheme.previewBg}
                        onChange={(e) => setNewTheme({ ...newTheme, previewBg: e.target.value })}
                        className="text-xs h-8 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Preview Accent Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newTheme.previewAccent}
                        onChange={(e) => setNewTheme({ ...newTheme, previewAccent: e.target.value })}
                        className="w-8 h-8 rounded border cursor-pointer"
                      />
                      <Input
                        value={newTheme.previewAccent}
                        onChange={(e) => setNewTheme({ ...newTheme, previewAccent: e.target.value })}
                        className="text-xs h-8 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">Description</Label>
                  <Input
                    value={newTheme.description}
                    onChange={(e) => setNewTheme({ ...newTheme, description: e.target.value })}
                    placeholder="Briefly describe the aesthetic and presentation..."
                    className="text-xs h-8"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold">CSS Style Rules (Inside &lt;style&gt;) *</Label>
                    <span className="text-[10px] text-slate-500">Pure CSS, zero external files</span>
                  </div>
                  <Textarea
                    value={newTheme.htmlHead}
                    onChange={(e) => setNewTheme({ ...newTheme, htmlHead: e.target.value })}
                    rows={6}
                    className="font-mono text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold">HTML Markup Body *</Label>
                    <span className="text-[10px] text-emerald-600 font-semibold">
                      Use {"{{HEADING}}"} and {"{{SUBNOTE}}"} placeholders
                    </span>
                  </div>
                  <Textarea
                    value={newTheme.htmlBody}
                    onChange={(e) => setNewTheme({ ...newTheme, htmlBody: e.target.value })}
                    rows={6}
                    className="font-mono text-xs"
                    required
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isDefaultSwitch"
                      checked={newTheme.isDefault}
                      onCheckedChange={(checked) => setNewTheme({ ...newTheme, isDefault: checked })}
                    />
                    <Label htmlFor="isDefaultSwitch" className="text-xs font-medium cursor-pointer">
                      Make platform global default
                    </Label>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={createMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      {createMutation.isPending ? "Deploying..." : "Push & Publish Theme"}
                    </Button>
                  </DialogFooter>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Themes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {themes.map((theme) => (
          <Card key={theme.id} className="relative flex flex-col justify-between border-slate-200">
            <CardHeader className="p-4 pb-2">
              <div 
                className="h-28 w-full rounded-lg mb-3 flex items-center justify-center relative overflow-hidden border border-slate-200"
                style={{ backgroundColor: theme.previewBg }}
              >
                <div className="w-36 bg-white/90 backdrop-blur-xs rounded-md p-2 shadow-xs border border-slate-200 flex flex-col items-center text-center">
                  <div 
                    className="w-5 h-5 rounded-full flex items-center justify-center mb-1 text-white text-[10px]"
                    style={{ backgroundColor: theme.previewAccent }}
                  >
                    ✓
                  </div>
                  <div className="w-20 h-1.5 bg-slate-300 rounded-full mb-1"></div>
                  <div className="w-12 h-1 bg-slate-200 rounded-full"></div>
                </div>

                <div className="absolute top-2 left-2 flex items-center gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/95 text-slate-800 shadow-xs border border-slate-200">
                    {theme.category}
                  </span>
                  {theme.badge && (
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-600 text-white shadow-xs">
                      {theme.badge}
                    </span>
                  )}
                </div>

                {theme.isDefault && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                    <Star className="h-3 w-3 fill-white" />
                    Default
                  </div>
                )}
              </div>

              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    {theme.name}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {theme.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 pt-2">
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center space-x-1.5">
                  <Switch
                    id={`toggle-${theme.id}`}
                    checked={theme.enabled}
                    onCheckedChange={(checked) => 
                      toggleEnabledMutation.mutate({ id: theme.id, enabled: checked })
                    }
                  />
                  <Label htmlFor={`toggle-${theme.id}`} className="text-[11px] font-medium text-slate-600 cursor-pointer">
                    {theme.enabled ? "Active" : "Disabled"}
                  </Label>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewTheme(theme)}
                    className="h-8 px-2 text-xs text-slate-600 hover:text-slate-900"
                    title="Live Preview"
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Preview
                  </Button>

                  {!theme.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDefaultMutation.mutate(theme.id)}
                      className="h-8 px-2 text-xs text-amber-600 hover:text-amber-700"
                      title="Set as platform default"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {!theme.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Delete theme "${theme.name}"?`)) {
                          deleteMutation.mutate(theme.id);
                        }
                      }}
                      className="h-8 px-2 text-xs text-red-500 hover:text-red-700"
                      title="Delete Theme"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── LIVE INTERACTIVE PREVIEW MODAL ── */}
      {previewTheme && (
        <Dialog open={!!previewTheme} onOpenChange={(open) => !open && setPreviewTheme(null)}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden bg-slate-900 text-white border-slate-700">
            <DialogHeader className="p-4 bg-slate-800/90 border-b border-slate-700 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-3">
                <div 
                  className="w-4 h-4 rounded-full border border-white/40"
                  style={{ backgroundColor: previewTheme.previewAccent }}
                />
                <div>
                  <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                    {previewTheme.name}
                    <Badge variant="outline" className="text-slate-300 border-slate-600 text-[10px]">
                      {previewTheme.category}
                    </Badge>
                    {previewTheme.isDefault && (
                      <Badge className="bg-amber-500 text-white text-[10px]">Platform Default</Badge>
                    )}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-400">
                    Live interactive sandbox preview of interstitial
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-2 mr-6">
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-0.5 flex items-center">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("desktop")}
                    className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all ${
                      previewDevice === "desktop"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("mobile")}
                    className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all ${
                      previewDevice === "mobile"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    Mobile
                  </button>
                </div>

                {!previewTheme.isDefault && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setDefaultMutation.mutate(previewTheme.id);
                      setPreviewTheme(null);
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold h-8 rounded-lg"
                  >
                    <Star className="h-3.5 w-3.5 mr-1 fill-white" />
                    Set as Default
                  </Button>
                )}
              </div>
            </DialogHeader>

            <div className="bg-slate-950 p-6 flex items-center justify-center min-h-[480px]">
              <div 
                className={`transition-all duration-300 rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-white ${
                  previewDevice === "mobile"
                    ? "w-[360px] h-[640px]"
                    : "w-full h-[520px]"
                }`}
              >
                <iframe
                  title="Theme Preview"
                  src={`/api/user/themes/${previewTheme.id}/preview-html`}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts"
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
