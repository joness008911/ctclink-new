import { useState, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  Flag, 
  Check, 
  X, 
  ChevronDown, 
  Link as LinkIcon, 
  Save, 
  Users, 
  Bot, 
  ShieldCheck,
  LocateFixed,
  HelpCircle,
  Laptop,
  Smartphone,
  Tablet,
  Globe,
  AlertTriangle,
  FileCode2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { COUNTRIES_LIST, getCountryFlag } from "@/lib/countries";

export function UserRoutingTab() {
  const { toast } = useToast();

  // Routing and Cloaking States
  const [blockVpn, setBlockVpn] = useState<"block" | "allow">("block");
  const [allowedDevices, setAllowedDevices] = useState<"all" | "desktop" | "mobile" | "mobile_tablet">("all");
  const [desktopOsFilter, setDesktopOsFilter] = useState<"both" | "windows" | "mac">("both");
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [hasUserModifiedCountries, setHasUserModifiedCountries] = useState(false);
  const [humanUrl, setHumanUrl] = useState("");
  const [botUrl, setBotUrl] = useState("");

  // Country Search Dropdown State
  const [countrySearch, setCountrySearch] = useState("");
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  // 1. Fetch User's Real IP & Auto-Detected Country
  const { data: detectedLocation, isLoading: isLocating } = useQuery<{
    ip: string;
    countryCode: string;
    countryName: string;
    city?: string;
  }>({
    queryKey: ["/api/client/current-location"],
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });

  // 2. Fetch User's Saved Routing Rules from Backend
  const { data: redirectUrls, isLoading: isLoadingUrls } = useQuery<{
    humanUrl: string;
    botUrl: string;
    allowedCountries?: string;
    allowedDevices?: "all" | "desktop" | "mobile" | "mobile_tablet";
    desktopOsFilter?: "both" | "windows" | "mac";
    blockVpn?: "block" | "allow";
    allowVpn?: boolean;
  }>({
    queryKey: ["/api/user/redirect-urls"],
    refetchOnMount: true,
  });

  // Sync state once saved configuration loads or initialize with auto-detected country
  useEffect(() => {
    if (redirectUrls) {
      setHumanUrl(redirectUrls.humanUrl || "");
      setBotUrl(redirectUrls.botUrl || "");
      setBlockVpn(redirectUrls.blockVpn || (redirectUrls.allowVpn ? "allow" : "block"));
      if (redirectUrls.allowedDevices) {
        setAllowedDevices(redirectUrls.allowedDevices);
      }
      if (redirectUrls.desktopOsFilter) {
        setDesktopOsFilter(redirectUrls.desktopOsFilter);
      }

      // Check if user already has saved country rules
      if (redirectUrls.allowedCountries && redirectUrls.allowedCountries.trim()) {
        const raw = redirectUrls.allowedCountries.trim().toUpperCase();
        if (raw === "ALL") {
          setSelectedCountries(["ALL"]);
        } else {
          const parsed = raw.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
          setSelectedCountries(parsed.length > 0 ? parsed : ["ALL"]);
        }
        setHasUserModifiedCountries(true);
      } else if (!hasUserModifiedCountries && detectedLocation?.countryCode) {
        // Default to user's detected country IP if no configuration exists yet
        const defaultCode = detectedLocation.countryCode.toUpperCase();
        setSelectedCountries([defaultCode]);
      }
    } else if (!hasUserModifiedCountries && detectedLocation?.countryCode && selectedCountries.length === 0) {
      const defaultCode = detectedLocation.countryCode.toUpperCase();
      setSelectedCountries([defaultCode]);
    }
  }, [redirectUrls, detectedLocation, hasUserModifiedCountries]);

  // Click outside to close country dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateUrlsMutation = useMutation({
    mutationFn: async (payload: {
      humanUrl: string;
      botUrl: string;
      allowedCountries: string;
      allowedDevices: string;
      desktopOsFilter: string;
      blockVpn: string;
      allowVpn: boolean;
    }) => {
      const response = await apiRequest("PUT", "/api/user/redirect-urls", payload);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Routing Configuration Saved",
        description: "Your VPN policy, allowed devices, OS filtering, geo-fencing, and bot actions are now active across all links.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/redirect-urls"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to update routing configuration",
        variant: "destructive",
      });
    },
  });

  const handleCountrySelect = (code: string) => {
    setHasUserModifiedCountries(true);
    const upper = code.toUpperCase();
    if (upper === "ALL") {
      setSelectedCountries(["ALL"]);
    } else {
      let updated = selectedCountries.filter((c) => c !== "ALL");
      if (updated.includes(upper)) {
        updated = updated.filter((c) => c !== upper);
      } else {
        updated.push(upper);
      }
      if (updated.length === 0) {
        updated = detectedLocation?.countryCode ? [detectedLocation.countryCode.toUpperCase()] : ["ALL"];
      }
      setSelectedCountries(updated);
    }
    setCountrySearch("");
  };

  const removeCountry = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHasUserModifiedCountries(true);
    const updated = selectedCountries.filter((c) => c !== code);
    if (updated.length === 0) {
      setSelectedCountries(["ALL"]);
    } else {
      setSelectedCountries(updated);
    }
  };

  const setAutoDetectedCountry = () => {
    if (detectedLocation?.countryCode) {
      setHasUserModifiedCountries(true);
      setSelectedCountries([detectedLocation.countryCode.toUpperCase()]);
      toast({
        title: "Defaulted to Your Detected IP",
        description: `Set allowed country to ${detectedLocation.countryName} (${detectedLocation.countryCode}).`,
      });
    }
  };

  const filteredCountryOptions = useMemo(() => {
    const term = countrySearch.toLowerCase().trim();
    if (!term) return COUNTRIES_LIST;
    return COUNTRIES_LIST.filter(
      (c) => c.name.toLowerCase().includes(term) || c.code.toLowerCase().includes(term)
    );
  }, [countrySearch]);

  const handleSave = () => {
    if (!humanUrl || !botUrl) {
      toast({
        title: "Missing Configuration",
        description: "Please specify both Target Offer (Human URL) and Bot Action (404, 403, or Safe URL).",
        variant: "destructive",
      });
      return;
    }

    const countriesPayload = selectedCountries.length === 0 || selectedCountries.includes("ALL")
      ? "ALL"
      : selectedCountries.join(",");

    updateUrlsMutation.mutate({
      humanUrl,
      botUrl,
      allowedCountries: countriesPayload,
      allowedDevices,
      desktopOsFilter,
      blockVpn,
      allowVpn: blockVpn === "allow",
    });
  };

  const detectedCountryName = detectedLocation?.countryName || "Detecting...";
  const detectedCountryCode = detectedLocation?.countryCode || "";
  const detectedFlag = getCountryFlag(detectedCountryCode);

  const isBot404 = botUrl.trim() === "404" || botUrl.trim().startsWith("404");
  const isBot403 = botUrl.trim() === "403" || botUrl.trim().startsWith("403");
  const isBotUrl = botUrl.trim().startsWith("http://") || botUrl.trim().startsWith("https://");

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: BLOCKING CONTROLS (VPN & PROXIES)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#101726] border border-[#1c2638] rounded-2xl p-6 space-y-5 shadow-lg">
        <div className="flex items-center gap-2.5 border-b border-[#1c2638] pb-3">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-[#f43f5e]">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              VPN & Proxies Policy
            </h3>
            <p className="text-xs text-slate-400">
              Configure filtering and deflection rules for anonymizers, proxies, and VPN tunnels
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
          {/* Block VPN and Proxies Select */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-200">
              VPN and Proxies Policy
            </Label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-rose-400 pointer-events-none">
                <Shield className="h-4 w-4" />
              </div>
              <select
                value={blockVpn}
                onChange={(e) => setBlockVpn(e.target.value as "block" | "allow")}
                className="w-full h-11 pl-11 pr-10 bg-[#0b0f19] border border-[#223049] rounded-xl text-sm font-medium text-slate-100 appearance-none focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all cursor-pointer hover:border-[#2f4265]"
              >
                <option value="block">Block VPN & Proxies (Deflect to Bot Action / Error)</option>
                <option value="allow">Allow VPN & Proxies (Permit clean residential VPNs)</option>
              </select>
              <ChevronDown className="h-4 w-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              When set to <span className="text-rose-300 font-semibold">"Block"</span>, visitors detected using VPNs, Tor exit nodes, residential proxies, or datacenter IPs are automatically deflected based on your Bot & Filtered Traffic Action.
            </p>
          </div>

          {/* Quick Info Box */}
          <div className="bg-[#0b0f19] border border-[#1e2a3f] rounded-xl p-4 flex items-start gap-3">
            <div className="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
              <HelpCircle className="h-3.5 w-3.5" />
            </div>
            <div className="space-y-1 text-xs text-slate-300">
              <p className="font-semibold text-white">Multi-Layer Threat Inspection</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Traffic is evaluated against IP reputation feeds, datacenter ASNs, open proxy ports, and headless browser attributes in sub-millisecond response times.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: DEVICE FILTERING RULES (MOBILE & DESKTOP)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#101726] border border-[#1c2638] rounded-2xl p-6 space-y-5 shadow-lg">
        <div className="flex items-center gap-2.5 border-b border-[#1c2638] pb-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Laptop className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Device Filtering & Targeting
            </h3>
            <p className="text-xs text-slate-400">
              Control which devices are allowed to access your Target Offer. Restricted devices are deflected to your Bot Action (404/403 or Safe Page).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
          {/* Option 1: All Devices */}
          <button
            type="button"
            onClick={() => setAllowedDevices("all")}
            className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between space-y-3 ${
              allowedDevices === "all"
                ? "bg-[#182338] border-indigo-500 ring-2 ring-indigo-500/20 shadow-md"
                : "bg-[#0b0f19] border-[#1e2a3f] hover:border-[#2b3a55] hover:bg-[#121927]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-300 flex items-center justify-center">
                <Globe className="h-4 w-4" />
              </div>
              {allowedDevices === "all" && (
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                  ✓
                </span>
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-white">All Devices</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Desktop, Mobile & Tablet allowed</div>
            </div>
          </button>

          {/* Option 2: Desktop Only */}
          <button
            type="button"
            onClick={() => setAllowedDevices("desktop")}
            className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between space-y-3 ${
              allowedDevices === "desktop"
                ? "bg-[#182338] border-blue-500 ring-2 ring-blue-500/20 shadow-md"
                : "bg-[#0b0f19] border-[#1e2a3f] hover:border-[#2b3a55] hover:bg-[#121927]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-300 flex items-center justify-center">
                <Laptop className="h-4 w-4" />
              </div>
              {allowedDevices === "desktop" && (
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                  ✓
                </span>
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-white">Desktop Only</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Deflect mobile visitors to error / bot page</div>
            </div>
          </button>

          {/* Option 3: Mobile Only */}
          <button
            type="button"
            onClick={() => setAllowedDevices("mobile")}
            className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between space-y-3 ${
              allowedDevices === "mobile"
                ? "bg-[#182338] border-emerald-500 ring-2 ring-emerald-500/20 shadow-md"
                : "bg-[#0b0f19] border-[#1e2a3f] hover:border-[#2b3a55] hover:bg-[#121927]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-300 flex items-center justify-center">
                <Smartphone className="h-4 w-4" />
              </div>
              {allowedDevices === "mobile" && (
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                  ✓
                </span>
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-white">Mobile Only</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Deflect desktop visitors to error / bot page</div>
            </div>
          </button>

          {/* Option 4: Mobile & Tablet Only */}
          <button
            type="button"
            onClick={() => setAllowedDevices("mobile_tablet")}
            className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between space-y-3 ${
              allowedDevices === "mobile_tablet"
                ? "bg-[#182338] border-purple-500 ring-2 ring-purple-500/20 shadow-md"
                : "bg-[#0b0f19] border-[#1e2a3f] hover:border-[#2b3a55] hover:bg-[#121927]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-300 flex items-center justify-center">
                <Tablet className="h-4 w-4" />
              </div>
              {allowedDevices === "mobile_tablet" && (
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold">
                  ✓
                </span>
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-white">Mobile & Tablet</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Deflect desktop visitors to error / bot page</div>
            </div>
          </button>
        </div>

        {/* Secondary OS Filter: Shown only when "Desktop Only" is selected */}
        {allowedDevices === "desktop" && (
          <div id="desktop-os-filter-container" className="bg-[#0b0f19] border-2 border-blue-500/40 rounded-xl p-4 space-y-3 shadow-lg ring-1 ring-blue-500/20 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Laptop className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-blue-300 font-extrabold uppercase tracking-wide">Required OS:</span>
                  Desktop Operating System
                </h4>
                <p className="text-[11px] text-slate-400">Choose which desktop platforms are permitted to access your Target Offer</p>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 w-fit">
                Active Filter: {desktopOsFilter === "windows" ? "Windows Only" : desktopOsFilter === "mac" ? "Mac (macOS) Only" : "Both (Windows & Mac)"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <button
                id="os-btn-both"
                type="button"
                onClick={() => setDesktopOsFilter("both")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  desktopOsFilter === "both"
                    ? "bg-[#182338] border-blue-500 text-white font-semibold ring-1 ring-blue-500/30"
                    : "bg-[#101726] border-[#1e2a3f] text-slate-400 hover:text-slate-200 hover:bg-[#141d2e]"
                }`}
              >
                <div className="text-xs font-bold">Both (Windows & Mac)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">All standard desktop systems</div>
              </button>

              <button
                id="os-btn-windows"
                type="button"
                onClick={() => setDesktopOsFilter("windows")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  desktopOsFilter === "windows"
                    ? "bg-[#182338] border-blue-500 text-white font-semibold ring-1 ring-blue-500/30"
                    : "bg-[#101726] border-[#1e2a3f] text-slate-400 hover:text-slate-200 hover:bg-[#141d2e]"
                }`}
              >
                <div className="text-xs font-bold">Windows Only</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Deflect Mac & Linux to Bot Action</div>
              </button>

              <button
                id="os-btn-mac"
                type="button"
                onClick={() => setDesktopOsFilter("mac")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  desktopOsFilter === "mac"
                    ? "bg-[#182338] border-blue-500 text-white font-semibold ring-1 ring-blue-500/30"
                    : "bg-[#101726] border-[#1e2a3f] text-slate-400 hover:text-slate-200 hover:bg-[#141d2e]"
                }`}
              >
                <div className="text-xs font-bold">Mac (macOS) Only</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Deflect Windows & Linux to Bot Action</div>
              </button>
            </div>
          </div>
        )}

        <div className="bg-[#0b0f19] border border-[#1e2a3f] rounded-xl p-3.5 flex items-center gap-3 text-xs text-slate-300">
          <div className="w-6 h-6 rounded-md bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
            <HelpCircle className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="font-semibold text-white">Device Behavior: </span>
            {allowedDevices === "all" && "All humans on any device are routed normally to your Target Offer."}
            {allowedDevices === "desktop" && desktopOsFilter === "both" && "All desktop humans (Windows & Mac) reach your Target Offer. Mobile & tablet visitors are deflected to your Bot Action (404/403 or Safe Page)."}
            {allowedDevices === "desktop" && desktopOsFilter === "windows" && "Only Windows desktop humans reach your Target Offer. Mac, Linux, mobile, and tablet visitors are deflected to your Bot Action (404/403 or Safe Page)."}
            {allowedDevices === "desktop" && desktopOsFilter === "mac" && "Only Mac (macOS) desktop humans reach your Target Offer. Windows, Linux, mobile, and tablet visitors are deflected to your Bot Action (404/403 or Safe Page)."}
            {allowedDevices === "mobile" && "Mobile humans reach your Target Offer. Desktop visitors are deflected to your Bot Action (404/403 or Safe Page)."}
            {allowedDevices === "mobile_tablet" && "Mobile & tablet humans reach your Target Offer. Desktop visitors are deflected to your Bot Action (404/403 or Safe Page)."}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: MANAGE COUNTRIES (GEO-FENCING & AUTO-DETECT)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#101726] border border-[#1c2638] rounded-2xl p-6 space-y-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1c2638] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Flag className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Manage Countries (Geo-Fencing)
              </h3>
              <p className="text-xs text-slate-400">
                Allow specific countries and deflect all unapproved regions to your Bot Action
              </p>
            </div>
          </div>

          {/* Auto-detected IP indicator pill with quick reset button */}
          {detectedCountryCode && (
            <div className="flex items-center gap-2 bg-[#0b0f19] border border-[#1e2a3f] px-3 py-1.5 rounded-xl">
              <LocateFixed className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs text-slate-300">
                Your IP Location: <strong className="text-white">{detectedFlag} {detectedCountryName} ({detectedCountryCode})</strong>
              </span>
              <button
                type="button"
                onClick={setAutoDetectedCountry}
                title="Default to your detected country"
                className="ml-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
              >
                Use Default
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2 relative" ref={countryDropdownRef}>
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-slate-200">
              Allowed Countries
            </Label>
            <span className="text-[11px] text-slate-400">
              Click search to add more countries • Click ✕ on a badge to remove
            </span>
          </div>
          
          {/* Tag Input Container with dark background and burgundy pill badges */}
          <div 
            onClick={() => setIsCountryDropdownOpen(true)}
            className="min-h-[48px] w-full p-2 bg-[#0b0f19] border border-[#223049] rounded-xl flex flex-wrap items-center gap-2 focus-within:ring-2 focus-within:ring-rose-500/20 focus-within:border-rose-500 transition-all cursor-text hover:border-[#2f4265]"
          >
            {selectedCountries.map((code) => {
              const item = COUNTRIES_LIST.find((c) => c.code === code);
              const flag = item?.flag || getCountryFlag(code);
              const name = item?.name || code;
              return (
                <span
                  key={code}
                  className="inline-flex items-center gap-1.5 bg-[#9f1239] hover:bg-[#881337] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                >
                  <span className="text-sm leading-none">{flag}</span>
                  <span className="text-white">{name}</span>
                  <button
                    type="button"
                    onClick={(e) => removeCountry(code, e)}
                    className="border-l border-white/20 pl-1.5 ml-1 text-white/80 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              );
            })}

            <input
              type="text"
              value={countrySearch}
              onChange={(e) => {
                setCountrySearch(e.target.value);
                setIsCountryDropdownOpen(true);
              }}
              onFocus={() => setIsCountryDropdownOpen(true)}
              placeholder={selectedCountries.length === 0 ? "Search to choose countries..." : "Search & add more countries..."}
              className="flex-1 min-w-[160px] bg-transparent border-0 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none px-2 py-1"
            />
          </div>

          <p className="text-[11px] text-slate-400">
            Only visitors from approved countries can view your Target Offer. All other countries are instantly deflected to your Bot Action (404/403 or Safe Page). Select "All Countries" for global allowance.
          </p>

          {/* Country Dropdown Options Menu */}
          {isCountryDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-[#0e1422] border border-[#223049] rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto p-2 space-y-1 animate-in fade-in-50 duration-150 backdrop-blur-md">
              {filteredCountryOptions.map((c) => {
                const isSelected = selectedCountries.includes(c.code);
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleCountrySelect(c.code)}
                    className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                      isSelected 
                        ? "bg-[#9f1239]/20 text-rose-300 font-bold border border-[#9f1239]/40" 
                        : "text-slate-200 hover:bg-[#182338] hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base leading-none">{c.flag}</span>
                      <span className="text-slate-100">{c.name}</span>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">({c.code})</span>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-rose-400" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4: DESTINATION ENDPOINTS (HUMAN URL & BOT / ERROR ACTION)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#101726] border border-[#1c2638] rounded-2xl p-6 space-y-5 shadow-lg">
        <div className="flex items-center gap-2.5 border-b border-[#1c2638] pb-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <LinkIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Traffic Destinations & Bot Error Controls
            </h3>
            <p className="text-xs text-slate-400">
              Define the destination addresses for verified human visitors, and choose an error page or URL for blocked traffic
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Target Offer (Human URL) */}
          <div className="bg-[#0b0f19] border border-[#1e2a3f] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Target Offer (Human Visitors)</h4>
                  <p className="text-[11px] text-slate-400">Approved users passing country, device & VPN rules</p>
                </div>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Money Page
              </span>
            </div>

            <div className="space-y-1.5 pt-1">
              <Input
                type="url"
                value={humanUrl}
                onChange={(e) => setHumanUrl(e.target.value)}
                placeholder="https://myoffer.com/landing-page"
                className="bg-[#121927] border-[#223049] text-xs font-mono text-slate-100 h-10 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
              />
              <p className="text-[11px] text-slate-400">
                Query parameters and tracking tokens are forwarded automatically.
              </p>
            </div>
          </div>

          {/* Safe Landing & Bot Error Code Action */}
          <div className="bg-[#0b0f19] border border-[#1e2a3f] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Bot & Filtered Traffic Action</h4>
                  <p className="text-[11px] text-slate-400">Enter 404, 403, or a Safe Page URL</p>
                </div>
              </div>
              {isBot404 ? (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  HTTP 404 NOT FOUND
                </span>
              ) : isBot403 ? (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  HTTP 403 FORBIDDEN
                </span>
              ) : isBotUrl ? (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  SAFE REDIRECT URL
                </span>
              ) : (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-slate-500/15 text-slate-300 border border-slate-500/30">
                  BOT ACTION
                </span>
              )}
            </div>

            {/* Quick Action Presets (404, 403, URL) */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setBotUrl("404")}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                  isBot404
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm"
                    : "bg-[#121927] text-slate-400 border-[#223049] hover:text-white hover:border-[#2f4265]"
                }`}
              >
                404 Not Found
              </button>
              <button
                type="button"
                onClick={() => setBotUrl("403")}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                  isBot403
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm"
                    : "bg-[#121927] text-slate-400 border-[#223049] hover:text-white hover:border-[#2f4265]"
                }`}
              >
                403 Forbidden
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isBot404 || isBot403 || !botUrl) {
                    setBotUrl("https://");
                  }
                }}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                  isBotUrl
                    ? "bg-blue-500/20 text-blue-300 border-blue-500/50 shadow-sm"
                    : "bg-[#121927] text-slate-400 border-[#223049] hover:text-white hover:border-[#2f4265]"
                }`}
              >
                Custom Safe URL
              </button>
            </div>

            <div className="space-y-1.5 pt-1">
              <Input
                type="text"
                value={botUrl}
                onChange={(e) => setBotUrl(e.target.value)}
                placeholder="Enter 404, 403, or https://example.com/safe"
                className="bg-[#121927] border-[#223049] text-xs font-mono text-slate-100 h-10 placeholder:text-slate-500 focus:border-rose-500 focus:ring-rose-500/20"
              />
              <p className="text-[11px] text-slate-400">
                {isBot404 && "Visitors failing checks will see your server's native 404 Not Found error page."}
                {isBot403 && "Visitors failing checks will see your server's native 403 Forbidden error page."}
                {isBotUrl && "Visitors failing checks will be seamlessly redirected to your Safe Landing URL."}
                {!isBot404 && !isBot403 && !isBotUrl && "Enter 404 or 403 to block bots with an error page, or a full URL (https://…) to send them elsewhere."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SAVE ACTION BAR
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-[#101726] border border-[#1c2638] rounded-2xl shadow-lg">
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>Rules are saved permanently and take effect in real time on all tracking links.</span>
        </div>
        <Button
          onClick={handleSave}
          disabled={updateUrlsMutation.isPending || isLoadingUrls}
          className="w-full sm:w-auto bg-[#9f1239] hover:bg-[#be123c] text-white text-xs font-semibold px-7 h-11 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <Save className="h-4 w-4" />
          {updateUrlsMutation.isPending ? "Saving Rules..." : "Save Configuration"}
        </Button>
      </div>
    </div>
  );
}
