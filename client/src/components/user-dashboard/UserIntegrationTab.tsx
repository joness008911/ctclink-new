import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Code, 
  Download, 
  Copy, 
  Check, 
  FileCode, 
  Layers, 
  Key,
  ShieldCheck,
  Zap,
  BookOpen,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  Smartphone,
  Monitor,
  Palette,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  SlidersHorizontal,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import JSZip from "jszip";
import { 
  DEFAULT_INTERSTITIAL_THEMES, 
  generatePhpIntegrationScript,
  type InterstitialTheme 
} from "@shared/interstitialThemes";

interface UserIntegrationTabProps {
  apiKeyValue: string | null;
  customEndpoint: string;
  setCustomEndpoint: (val: string) => void;
}

export function UserIntegrationTab({
  apiKeyValue,
  customEndpoint,
  setCustomEndpoint,
}: UserIntegrationTabProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Themes state
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedThemeId, setSelectedThemeId] = useState<string>("clean_light");
  const [customHeading, setCustomHeading] = useState<string>("Verifying your connection...");
  const [customSubnote, setCustomSubnote] = useState<string>("Please wait while we secure your session.");
  const [previewTheme, setPreviewTheme] = useState<InterstitialTheme | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [hasUnsavedThemeChanges, setHasUnsavedThemeChanges] = useState<boolean>(false);

  // Fetch available themes (admin pushed or default)
  const { data: themes = DEFAULT_INTERSTITIAL_THEMES, isLoading: themesLoading } = useQuery<InterstitialTheme[]>({
    queryKey: ["/api/user/themes"],
  });

  // Fetch current user redirect URLs and theme preferences
  const { data: userSettings, isLoading: settingsLoading } = useQuery<any>({
    queryKey: ["/api/user/redirect-urls"],
  });

  // Sync state once user settings are loaded
  useEffect(() => {
    if (userSettings) {
      if (userSettings.interstitialThemeId) {
        setSelectedThemeId(userSettings.interstitialThemeId);
      }
      if (userSettings.interstitialHeading) {
        setCustomHeading(userSettings.interstitialHeading);
      }
      if (userSettings.interstitialSubnote) {
        setCustomSubnote(userSettings.interstitialSubnote);
      }
      setHasUnsavedThemeChanges(false);
    }
  }, [userSettings]);

  // Current selected theme object
  const activeTheme = themes.find((t) => t.id === selectedThemeId) || themes[0] || DEFAULT_INTERSTITIAL_THEMES[0];

  const maskKey = (key: string | null) => {
    if (!key) return "••••••••••••••••";
    if (key.length <= 8) return "•".repeat(Math.max(key.length, 8));
    return `${key.slice(0, 4)}••••••••••••••••${key.slice(-4)}`;
  };

  const effectiveEndpoint = (customEndpoint || (typeof window !== "undefined" ? window.location.origin : ""))
    .trim()
    .replace(/\/+$/, "");

  // Generate dynamic PHP code with active theme and custom copy
  const phpIntegrationCode = generatePhpIntegrationScript({
    apiKeyValue,
    effectiveEndpoint,
    theme: activeTheme,
    heading: customHeading,
    subnote: customSubnote,
  });

  // Mutation to persist theme settings to user's tenant account
  const saveThemeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/user/interstitial-theme", {
        interstitialThemeId: selectedThemeId,
        interstitialHeading: customHeading,
        interstitialSubnote: customSubnote,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Loading Theme Saved",
        description: `Your loading screen is now set to "${activeTheme.name}". The PHP integration code below has been updated.`,
      });
      setHasUnsavedThemeChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/user/redirect-urls"] });
    },
    onError: (err: any) => {
      toast({
        title: "Save Failed",
        description: err.message || "Failed to save theme preferences.",
        variant: "destructive",
      });
    },
  });

  const handleSelectTheme = (themeId: string) => {
    setSelectedThemeId(themeId);
    setHasUnsavedThemeChanges(true);
  };

  const handleHeadingChange = (val: string) => {
    setCustomHeading(val);
    setHasUnsavedThemeChanges(true);
  };

  const handleSubnoteChange = (val: string) => {
    setCustomSubnote(val);
    setHasUnsavedThemeChanges(true);
  };

  const handleCopyKey = () => {
    if (!apiKeyValue) return;
    navigator.clipboard.writeText(apiKeyValue);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    toast({ title: "API Key Copied", description: "Copied to clipboard" });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(phpIntegrationCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast({ 
      title: "PHP Code Copied", 
      description: `Integration script using "${activeTheme.name}" theme copied to clipboard.` 
    });
  };

  const handleDownloadZip = async () => {
    if (!apiKeyValue) {
      toast({
        title: "No API Key",
        description: "Please wait for your active API key to load.",
        variant: "destructive",
      });
      return;
    }

    try {
      const zip = new JSZip();
      zip.file("index.php", phpIntegrationCode);
      zip.file(
        "README.txt",
        `CleanTraffic - Drop-in Verification Interstitial & Security Package\n\n` +
        `DEPLOYMENT INSTRUCTIONS:\n` +
        `1. Upload index.php to your web server or campaign root (e.g., public_html/promo/index.php).\n` +
        `2. Active Loading Screen Theme: ${activeTheme.name} (${activeTheme.id})\n` +
        `3. Heading Text: "${customHeading}"\n` +
        `4. Ensure PHP 7.4+ with the standard cURL extension is enabled.\n` +
        `5. When visitors land on your link, they immediately see the clean verification splash (zero blank white screen).\n` +
        `6. Classification executes asynchronously in the background. On success, humans are forwarded to your configured Human Target URL, while bots receive your configured action (404, 403, or Bot URL).\n` +
        `7. If an external service or network timeout occurs, the script safely fails closed with an immediate polished retry state.\n` +
        `8. All rules, geo-fencing, device filters, and target URLs remain dynamically managed in real time from your CleanTraffic Dashboard.\n`
      );

      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cleantraffic-${activeTheme.id}-script.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Started",
        description: `Your customized integration script with "${activeTheme.name}" has been downloaded.`,
      });
    } catch (err: any) {
      toast({
        title: "Download Error",
        description: err.message || "Failed to generate ZIP",
        variant: "destructive",
      });
    }
  };

  // Categories list
  const categories = ["All", "Light", "Minimal", "Corporate", "Security", "Dark"];
  const filteredThemes = selectedCategory === "All"
    ? themes
    : themes.filter((t) => t.category.toLowerCase() === selectedCategory.toLowerCase());

  return (
    <div className="space-y-6">
      {/* Documentation Quick Access Banner */}
      <div className="bg-gradient-to-r from-[#0A3E33] to-[#06241D] rounded-xl p-5 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-[#145343]">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0 text-emerald-300">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Need help integrating? View the complete step-by-step documentation
              </h3>
              <span className="hidden sm:inline-block text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                Setup Guides
              </span>
            </div>
            <p className="text-xs text-emerald-100/80 mt-1 max-w-2xl leading-relaxed">
              Step-by-step setup guides for cPanel, aaPanel, WordPress, custom Nginx/Apache servers, Campaign & Endpoint routing modes, and live verification diagnostics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
          <Button
            onClick={() => navigate("/docs#installation")}
            className="w-full md:w-auto bg-white hover:bg-emerald-50 text-[#06241D] font-bold text-xs h-9 px-4 rounded-lg gap-2 shadow-xs transition-all"
          >
            <span>View Integration Docs</span>
            <ArrowRight className="h-3.5 w-3.5 text-[#0A5C48]" />
          </Button>
          <button
            onClick={() => navigate("/docs")}
            className="hidden sm:inline-flex text-xs font-semibold text-emerald-200 hover:text-white underline underline-offset-4 transition-colors whitespace-nowrap"
          >
            Read All Docs →
          </button>
        </div>
      </div>

      {/* Top Banner & API Key */}
      <div className="bg-white border border-[#E5EAE7] rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2.5 tracking-tight">
              <div className="w-8 h-8 rounded-lg bg-[#E6F2ED] border border-[#CCE5DB] flex items-center justify-center text-[#0A5C48]">
                <Code className="h-4 w-4" />
              </div>
              Integration Script Generator
            </h2>
            <p className="text-xs text-[#64748B] mt-1">
              Select your preferred visitor loading state, customize the copy, and deploy the self-contained PHP file on your landing page.
            </p>
          </div>

          <Button
            onClick={handleDownloadZip}
            disabled={!apiKeyValue}
            className="bg-[#0A5C48] hover:bg-[#07382D] text-white text-xs font-bold px-5 h-10 rounded-lg gap-2 shadow-xs transition-all"
          >
            <Download className="h-4 w-4" />
            Download ZIP ({activeTheme.name})
          </Button>
        </div>

        {/* API Key & Endpoint Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="bg-[#F7FAF8] border border-[#E0E9E4] p-3.5 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Your Assigned API Key</Label>
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="text-[11px] text-[#0A5C48] hover:text-[#06241D] font-semibold flex items-center gap-1 focus:outline-none"
              >
                {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                <span>{showKey ? "Hide key" : "Reveal key"}</span>
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold text-[#0A5C48] truncate tracking-wide">
                {apiKeyValue ? (showKey ? apiKeyValue : maskKey(apiKeyValue)) : "Loading key..."}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowKey(!showKey)}
                  disabled={!apiKeyValue}
                  className="h-7 px-2 text-[#64748B] hover:text-[#0F172A]"
                  title={showKey ? "Hide API key" : "Reveal API key"}
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyKey}
                  disabled={!apiKeyValue}
                  className="h-7 px-2 text-[#64748B] hover:text-[#0F172A]"
                  title="Copy API Key"
                >
                  {copiedKey ? <Check className="h-3.5 w-3.5 text-[#0A5C48]" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-[#F7FAF8] border border-[#E0E9E4] p-3.5 rounded-xl space-y-1">
            <Label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">API Endpoint Host</Label>
            <Input
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              placeholder="https://your-domain.com"
              className="bg-white border-[#D5DFD9] text-[#0F172A] text-xs font-mono h-8 focus:border-[#0A5C48] focus:ring-1 focus:ring-[#0A5C48]"
            />
          </div>
        </div>
      </div>

      {/* ── THEME SELECTION & LOADING SCREEN CUSTOMIZER ── */}
      <div className="bg-white border border-[#E5EAE7] rounded-xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E5EAE7] pb-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <Palette className="h-4 w-4" />
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] tracking-tight">
                Visitor Verification Loading Screen UI
              </h3>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 text-[10px] uppercase font-bold">
                Tenant Isolated
              </Badge>
            </div>
            <p className="text-xs text-[#64748B] mt-1 max-w-2xl">
              Choose the instant splash screen shown to visitors on your PHP link while bot classification runs. Each user can pick a distinct theme, preview it in real-time, and save it directly into their generated script.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {hasUnsavedThemeChanges && (
              <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md font-medium flex items-center gap-1 animate-pulse">
                <Info className="h-3 w-3" /> Unsaved changes
              </span>
            )}
            <Button
              onClick={() => saveThemeMutation.mutate()}
              disabled={saveThemeMutation.isPending || !hasUnsavedThemeChanges}
              className={`h-9 px-4 text-xs font-bold rounded-lg shadow-xs transition-all flex items-center gap-1.5 ${
                hasUnsavedThemeChanges
                  ? "bg-[#0A5C48] hover:bg-[#07382D] text-white"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              {saveThemeMutation.isPending ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Loading Theme</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Custom Text Customization Inputs */}
        <div className="bg-[#F8FAF9] border border-[#E0E9E4] rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-[#0F172A]">Primary Headline Text</Label>
              <span className="text-[11px] text-[#64748B]">Appears as main title</span>
            </div>
            <Input
              value={customHeading}
              onChange={(e) => handleHeadingChange(e.target.value)}
              placeholder="Verifying your connection..."
              className="bg-white border-[#D5DFD9] text-[#0F172A] text-xs h-9 focus:border-[#0A5C48]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-[#0F172A]">Sub-note Description</Label>
              <span className="text-[11px] text-[#64748B]">Supporting message under title</span>
            </div>
            <Input
              value={customSubnote}
              onChange={(e) => handleSubnoteChange(e.target.value)}
              placeholder="Please wait while we secure your session."
              className="bg-white border-[#D5DFD9] text-[#0F172A] text-xs h-9 focus:border-[#0A5C48]"
            />
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <span className="text-xs font-bold text-[#64748B] mr-2 flex items-center gap-1">
              <SlidersHorizontal className="h-3 w-3" /> Filter:
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs px-3 py-1 rounded-lg font-medium transition-all ${
                  selectedCategory === cat
                    ? "bg-[#0A5C48] text-white shadow-xs"
                    : "bg-[#F1F5F3] text-[#475569] hover:bg-[#E5EAE7]"
                }`}
              >
                {cat}
                {cat === "Light" && " (White Themes)"}
              </button>
            ))}
          </div>

          <div className="text-xs text-[#64748B]">
            Showing <strong>{filteredThemes.length}</strong> available UI templates
          </div>
        </div>

        {/* Theme Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredThemes.map((theme) => {
            const isSelected = selectedThemeId === theme.id;
            return (
              <div
                key={theme.id}
                className={`relative rounded-xl border p-4.5 transition-all flex flex-col justify-between ${
                  isSelected
                    ? "border-[#0A5C48] ring-2 ring-[#0A5C48]/20 bg-[#FAFDFB] shadow-sm"
                    : "border-[#E2E8F0] hover:border-[#CBD5E1] bg-white shadow-xs hover:shadow-sm"
                }`}
              >
                <div>
                  {/* Visual Header / Color Swatch Preview */}
                  <div 
                    className="h-24 w-full rounded-lg mb-3 flex items-center justify-center relative overflow-hidden border border-slate-200/80 transition-transform group-hover:scale-[1.01]"
                    style={{ backgroundColor: theme.previewBg }}
                  >
                    {/* Simulated mini card */}
                    <div className="w-40 bg-white/90 backdrop-blur-xs rounded-md p-2 shadow-xs border border-slate-200/70 flex flex-col items-center text-center">
                      <div 
                        className="w-5 h-5 rounded-full flex items-center justify-center mb-1 text-white text-[10px]"
                        style={{ backgroundColor: theme.previewAccent }}
                      >
                        ✓
                      </div>
                      <div className="w-24 h-1.5 bg-slate-300 rounded-full mb-1"></div>
                      <div className="w-16 h-1 bg-slate-200 rounded-full"></div>
                    </div>

                    {/* Category / Badge Tags */}
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/90 text-slate-700 shadow-xs border border-slate-200">
                        {theme.category}
                      </span>
                      {theme.badge && (
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-600 text-white shadow-xs">
                          {theme.badge}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-[#0A5C48] text-white p-1 rounded-full shadow-xs">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-[#0F172A] tracking-tight">
                      {theme.name}
                    </h4>
                  </div>
                  <p className="text-xs text-[#64748B] mt-1 line-clamp-2 leading-relaxed">
                    {theme.description}
                  </p>
                </div>

                {/* Card Actions */}
                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewTheme(theme)}
                    className="flex-1 h-8 text-xs font-semibold border-[#D5DFD9] hover:bg-[#F2F6F4] text-[#2D3B35] gap-1 rounded-lg"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Preview
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleSelectTheme(theme.id)}
                    className={`flex-1 h-8 text-xs font-bold rounded-lg transition-all ${
                      isSelected
                        ? "bg-[#0A5C48] text-white hover:bg-[#07382D]"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {isSelected ? (
                      <span className="flex items-center gap-1">
                        <Check className="h-3 w-3" /> Selected
                      </span>
                    ) : (
                      "Select"
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Architecture Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E5EAE7] rounded-xl p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 text-[#0A5C48] font-bold text-xs">
            <Key className="h-4 w-4" />
            1. Dedicated API Key
          </div>
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            Your unique API key ties all requests directly to your account. No other user can access or modify your routing settings.
          </p>
        </div>

        <div className="bg-white border border-[#E5EAE7] rounded-xl p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 text-[#0A5C48] font-bold text-xs">
            <ShieldCheck className="h-4 w-4" />
            2. Instant Verification Interstitial
          </div>
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            Eliminates blank white screens with an immediate &lt;15ms security splash while verification runs asynchronously in the background.
          </p>
        </div>

        <div className="bg-white border border-[#E5EAE7] rounded-xl p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 text-[#0A5C48] font-bold text-xs">
            <Layers className="h-4 w-4" />
            3. Fail-Closed Resilience
          </div>
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            Never fails open. Network hiccups and external API timeouts trigger a seamless client retry UI with zero raw error leaks.
          </p>
        </div>

        <div className="bg-white border border-[#E5EAE7] rounded-xl p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 text-[#0A5C48] font-bold text-xs">
            <Zap className="h-4 w-4" />
            4. Anti-Bypass & Multi-Domain
          </div>
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            Destination URLs stay hidden on the server until classification passes. Deploy across unlimited campaign domains safely.
          </p>
        </div>
      </div>

      {/* Code Preview Box */}
      <div className="bg-white border border-[#E5EAE7] rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-[#0A5C48]" />
            <span className="text-sm font-bold text-[#0F172A]">index.php Source Code</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-emerald-50 text-emerald-800 border-emerald-200">
              Active Theme: {activeTheme.name}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
              showKey 
                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                : "bg-slate-50 text-slate-600 border-slate-200"
            }`}>
              {showKey ? "Live Key Visible" : "Key Masked in Preview"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowKey(!showKey)}
              className="h-8 text-xs border-[#D5DFD9] bg-white hover:bg-[#F2F6F4] text-[#2D3B35] gap-1.5 rounded-lg font-semibold"
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showKey ? "Mask in Preview" : "Reveal in Preview"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCode}
              className="h-8 text-xs border-[#D5DFD9] bg-white hover:bg-[#F2F6F4] text-[#2D3B35] hover:text-[#0F172A] gap-1.5 rounded-lg shadow-xs font-semibold"
            >
              {copiedCode ? <Check className="h-3.5 w-3.5 text-[#0A5C48]" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedCode ? "Copied" : "Copy Code"}
            </Button>
          </div>
        </div>

        <div className="bg-[#051C15] border border-[#0F382B] rounded-xl p-4 overflow-x-auto shadow-inner">
          <pre className="font-mono text-xs text-[#C8E0D7] leading-relaxed whitespace-pre max-h-96 overflow-y-auto">
            {showKey 
              ? phpIntegrationCode 
              : phpIntegrationCode.replace(
                  `$apiKey = '${apiKeyValue || 'ctc_your_api_key_here'}';`,
                  `$apiKey = '${maskKey(apiKeyValue)}'; // Masked in preview. "Copy Code" & ZIP package export active key.`
                )}
          </pre>
        </div>
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
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-400">
                    Live interactive preview of visitor splash screen
                  </DialogDescription>
                </div>
              </div>

              {/* Viewport switch & actions */}
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

                <Button
                  size="sm"
                  onClick={() => {
                    handleSelectTheme(previewTheme.id);
                    setPreviewTheme(null);
                    toast({
                      title: "Theme Selected",
                      description: `"${previewTheme.name}" selected. Click "Save Loading Theme" to apply.`,
                    });
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-8 rounded-lg"
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Select this Theme
                </Button>
              </div>
            </DialogHeader>

            {/* Preview Frame Container */}
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
                  src={`/api/user/themes/${previewTheme.id}/preview-html?heading=${encodeURIComponent(customHeading)}&subnote=${encodeURIComponent(customSubnote)}`}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-900 border-t border-slate-800 text-center text-xs text-slate-400">
              This screen displays for ~15ms - 1.5s while IP intelligence and anti-bot verification run asynchronously in the background.
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
