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
  Globe
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
  const { data: detectedLocation } = useQuery<{
    ip: string;
    countryCode: string;
    countryName: string;
    city?: string;
  }>({
    queryKey: ["/api/client/current-location"],
    staleTime: 1000 * 60 * 10,
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
    const upper = code.toUpperCase();
    const updated = selectedCountries.filter((c) => c !== upper);
    if (updated.length === 0) {
      setSelectedCountries(detectedLocation?.countryCode ? [detectedLocation.countryCode.toUpperCase()] : ["ALL"]);
    } else {
      setSelectedCountries(updated);
    }
  };

  const setAutoDetectedCountry = () => {
    if (detectedLocation?.countryCode) {
      setHasUserModifiedCountries(true);
      setSelectedCountries([detectedLocation.countryCode.toUpperCase()]);
      toast({
        title: "Geo-Targeting Set to Your Location",
        description: `Configured allowed traffic to ${detectedLocation.countryName} (${detectedLocation.countryCode}).`,
      });
    }
  };

  const filteredCountryOptions = useMemo(() => {
    const search = countrySearch.toLowerCase().trim();
    if (!search) return COUNTRIES_LIST;
    return COUNTRIES_LIST.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.code.toLowerCase().includes(search)
    );
  }, [countrySearch]);

  const handleSave = () => {
    if (!humanUrl.trim() || !botUrl.trim()) {
      toast({
        title: "Missing Destination Configuration",
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
    <div className="space-y-6 w-full">
      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: BLOCKING CONTROLS (VPN & PROXIES)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#E5EAE7] rounded-xl p-6 space-y-5 shadow-xs">
        <div className="flex items-center gap-2.5 border-b border-[#E5EAE7] pb-3.5">
          <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#0F172A] tracking-tight">
              VPN & Proxies Policy
            </h3>
            <p className="text-xs text-[#64748B]">
              Configure filtering and deflection rules for anonymizers, proxies, and VPN tunnels
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
          {/* Block VPN and Proxies Select */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-[#2D3B35]">
              VPN & Proxies Enforcement
            </Label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-rose-600 pointer-events-none">
                <Shield className="h-4 w-4" />
              </div>
              <select
                value={blockVpn}
                onChange={(e) => setBlockVpn(e.target.value as "block" | "allow")}
                className="w-full h-11 pl-11 pr-10 bg-white border border-[#D5DFD9] rounded-lg text-xs font-semibold text-[#0F172A] appearance-none focus:outline-none focus:ring-1 focus:ring-[#0A5C48] focus:border-[#0A5C48] transition-all cursor-pointer hover:border-[#82928A]"
              >
                <option value="block">Block VPN & Proxies (Deflect to Bot Action / Error)</option>
                <option value="allow">Allow VPN & Proxies (Permit residential VPNs)</option>
              </select>
              <ChevronDown className="h-4 w-4 text-[#64748B] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <p className="text-[11px] text-[#64748B] leading-relaxed">
              When set to <span className="text-rose-600 font-bold">"Block"</span>, visitors detected using VPNs, Tor exit nodes, residential proxies, or datacenter IPs are automatically deflected.
            </p>
          </div>

          {/* Quick Info Box */}
          <div className="bg-[#F7FAF8] border border-[#E0E9E4] rounded-xl p-4 flex items-start gap-3">
            <div className="w-6 h-6 rounded-md bg-[#E6F2ED] border border-[#CCE5DB] flex items-center justify-center text-[#0A5C48] shrink-0 mt-0.5">
              <HelpCircle className="h-3.5 w-3.5" />
            </div>
            <div className="space-y-1 text-xs text-[#2D3B35]">
              <p className="font-bold text-[#0F172A]">Multi-Layer Threat Inspection</p>
              <p className="text-[11px] text-[#64748B] leading-relaxed">
                Traffic is evaluated against IP reputation feeds, datacenter ASNs, open proxy ports, and headless browser attributes in sub-millisecond response times.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: DEVICE FILTERING RULES (MOBILE & DESKTOP)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#E5EAE7] rounded-xl p-6 space-y-5 shadow-xs">
        <div className="flex items-center gap-2.5 border-b border-[#E5EAE7] pb-3.5">
          <div className="w-8 h-8 rounded-lg bg-[#EBF5F1] border border-[#CCE5DB] flex items-center justify-center text-[#0A5C48]">
            <Laptop className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#0F172A] tracking-tight">
              Device Filtering & Targeting
            </h3>
            <p className="text-xs text-[#64748B]">
              Control which devices are allowed to access your Target Offer. Restricted devices are deflected to your Bot Action.
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
                ? "bg-[#EBF5F1] border-[#0A5C48] ring-1 ring-[#0A5C48] shadow-xs"
                : "bg-white border-[#E5EAE7] hover:border-[#D5DFD9] hover:bg-[#F7FAF8]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-[#E6F2ED] text-[#0A5C48] flex items-center justify-center">
                <Globe className="h-4 w-4" />
              </div>
              {allowedDevices === "all" && (
                <span className="w-5 h-5 rounded-full bg-[#0A5C48] text-white flex items-center justify-center text-[10px] font-bold">
                  ✓
                </span>
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-[#0F172A]">All Devices</div>
              <div className="text-[11px] text-[#64748B] mt-0.5">Desktop, Mobile & Tablet allowed</div>
            </div>
          </button>

          {/* Option 2: Desktop Only */}
          <button
            type="button"
            onClick={() => setAllowedDevices("desktop")}
            className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between space-y-3 ${
              allowedDevices === "desktop"
                ? "bg-[#EBF5F1] border-[#0A5C48] ring-1 ring-[#0A5C48] shadow-xs"
                : "bg-white border-[#E5EAE7] hover:border-[#D5DFD9] hover:bg-[#F7FAF8]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Laptop className="h-4 w-4" />
              </div>
              {allowedDevices === "desktop" && (
                <span className="w-5 h-5 rounded-full bg-[#0A5C48] text-white flex items-center justify-center text-[10px] font-bold">
                  ✓
                </span>
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-[#0F172A]">Desktop Only</div>
              <div className="text-[11px] text-[#64748B] mt-0.5">Deflect mobile visitors to error page</div>
            </div>
          </button>

          {/* Option 3: Mobile Only */}
          <button
            type="button"
            onClick={() => setAllowedDevices("mobile")}
            className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between space-y-3 ${
              allowedDevices === "mobile"
                ? "bg-[#EBF5F1] border-[#0A5C48] ring-1 ring-[#0A5C48] shadow-xs"
                : "bg-white border-[#E5EAE7] hover:border-[#D5DFD9] hover:bg-[#F7FAF8]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-[#E6F2ED] text-[#0A5C48] flex items-center justify-center">
                <Smartphone className="h-4 w-4" />
              </div>
              {allowedDevices === "mobile" && (
                <span className="w-5 h-5 rounded-full bg-[#0A5C48] text-white flex items-center justify-center text-[10px] font-bold">
                  ✓
                </span>
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-[#0F172A]">Mobile Only</div>
              <div className="text-[11px] text-[#64748B] mt-0.5">Deflect desktop visitors to error page</div>
            </div>
          </button>

          {/* Option 4: Mobile & Tablet Only */}
          <button
            type="button"
            onClick={() => setAllowedDevices("mobile_tablet")}
            className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between space-y-3 ${
              allowedDevices === "mobile_tablet"
                ? "bg-[#EBF5F1] border-[#0A5C48] ring-1 ring-[#0A5C48] shadow-xs"
                : "bg-white border-[#E5EAE7] hover:border-[#D5DFD9] hover:bg-[#F7FAF8]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Tablet className="h-4 w-4" />
              </div>
              {allowedDevices === "mobile_tablet" && (
                <span className="w-5 h-5 rounded-full bg-[#0A5C48] text-white flex items-center justify-center text-[10px] font-bold">
                  ✓
                </span>
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-[#0F172A]">Mobile & Tablet</div>
              <div className="text-[11px] text-[#64748B] mt-0.5">Deflect desktop visitors to error page</div>
            </div>
          </button>
        </div>

        {/* Secondary OS Filter */}
        {allowedDevices === "desktop" && (
          <div id="desktop-os-filter-container" className="bg-[#F7FAF8] border border-[#E0E9E4] rounded-xl p-4 space-y-3 shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-[#0F172A] flex items-center gap-2">
                  <Laptop className="h-3.5 w-3.5 text-[#0A5C48]" />
                  <span className="text-[#0A5C48] font-bold uppercase tracking-wide">Required OS:</span>
                  Desktop Operating System
                </h4>
                <p className="text-[11px] text-[#64748B]">Choose which desktop platforms are permitted to access your Target Offer</p>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md bg-[#E6F2ED] text-[#07382D] border border-[#CCE5DB] w-fit">
                Active: {desktopOsFilter === "windows" ? "Windows Only" : desktopOsFilter === "mac" ? "Mac (macOS) Only" : "Both (Windows & Mac)"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <button
                id="os-btn-both"
                type="button"
                onClick={() => setDesktopOsFilter("both")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  desktopOsFilter === "both"
                    ? "bg-[#EBF5F1] border-[#0A5C48] text-[#07382D] font-bold"
                    : "bg-white border-[#E5EAE7] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F7FAF8]"
                }`}
              >
                <div className="text-xs font-bold">Both (Windows & Mac)</div>
                <div className="text-[10px] text-[#64748B] mt-0.5">All standard desktop systems</div>
              </button>

              <button
                id="os-btn-windows"
                type="button"
                onClick={() => setDesktopOsFilter("windows")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  desktopOsFilter === "windows"
                    ? "bg-[#EBF5F1] border-[#0A5C48] text-[#07382D] font-bold"
                    : "bg-white border-[#E5EAE7] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F7FAF8]"
                }`}
              >
                <div className="text-xs font-bold">Windows Only</div>
                <div className="text-[10px] text-[#64748B] mt-0.5">Deflect Mac & Linux to Bot Action</div>
              </button>

              <button
                id="os-btn-mac"
                type="button"
                onClick={() => setDesktopOsFilter("mac")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  desktopOsFilter === "mac"
                    ? "bg-[#EBF5F1] border-[#0A5C48] text-[#07382D] font-bold"
                    : "bg-white border-[#E5EAE7] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F7FAF8]"
                }`}
              >
                <div className="text-xs font-bold">Mac (macOS) Only</div>
                <div className="text-[10px] text-[#64748B] mt-0.5">Deflect Windows & Linux to Bot Action</div>
              </button>
            </div>
          </div>
        )}

        <div className="bg-[#F7FAF8] border border-[#E0E9E4] rounded-xl p-3.5 flex items-center gap-3 text-xs text-[#2D3B35]">
          <div className="w-6 h-6 rounded-md bg-[#E6F2ED] text-[#0A5C48] flex items-center justify-center shrink-0">
            <HelpCircle className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="font-bold text-[#0F172A]">Device Routing Mode: </span>
            {allowedDevices === "all" && "All humans on any device are routed normally to your Target Offer."}
            {allowedDevices === "desktop" && desktopOsFilter === "both" && "All desktop humans (Windows & Mac) reach your Target Offer. Mobile & tablet visitors are deflected to your Bot Action."}
            {allowedDevices === "desktop" && desktopOsFilter === "windows" && "Only Windows desktop humans reach your Target Offer. Mac, Linux, mobile, and tablet visitors are deflected."}
            {allowedDevices === "desktop" && desktopOsFilter === "mac" && "Only Mac (macOS) desktop humans reach your Target Offer. Windows, Linux, mobile, and tablet visitors are deflected."}
            {allowedDevices === "mobile" && "Mobile humans reach your Target Offer. Desktop visitors are deflected."}
            {allowedDevices === "mobile_tablet" && "Mobile & tablet humans reach your Target Offer. Desktop visitors are deflected."}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: MANAGE COUNTRIES (GEO-FENCING & AUTO-DETECT)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#E5EAE7] rounded-xl p-6 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5EAE7] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E6F2ED] border border-[#CCE5DB] flex items-center justify-center text-[#0A5C48]">
              <Flag className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A] tracking-tight">
                Manage Countries (Geo-Fencing)
              </h3>
              <p className="text-xs text-[#64748B]">
                Allow specific countries and deflect unapproved regions to your Bot Action
              </p>
            </div>
          </div>

          {/* Auto-detected IP indicator */}
          {detectedCountryCode && (
            <div className="flex items-center gap-2 bg-[#F7FAF8] border border-[#E0E9E4] px-3 py-1.5 rounded-lg shadow-xs">
              <LocateFixed className="h-3.5 w-3.5 text-[#0A5C48]" />
              <span className="text-xs text-[#2D3B35]">
                Your IP: <strong className="text-[#0F172A]">{detectedFlag} {detectedCountryName} ({detectedCountryCode})</strong>
              </span>
              <button
                type="button"
                onClick={setAutoDetectedCountry}
                title="Default to your detected country"
                className="ml-1 text-[11px] font-bold text-[#0A5C48] hover:text-[#07382D] underline underline-offset-2 transition-colors"
              >
                Use Default
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2 relative" ref={countryDropdownRef}>
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold text-[#2D3B35]">
              Allowed Countries
            </Label>
            <span className="text-[11px] text-[#64748B]">
              Click search to add more • Click ✕ on a badge to remove
            </span>
          </div>
          
          {/* Tag Input Container */}
          <div 
            onClick={() => setIsCountryDropdownOpen(true)}
            className="min-h-[48px] w-full p-2 bg-white border border-[#D5DFD9] rounded-lg flex flex-wrap items-center gap-2 focus-within:ring-1 focus-within:ring-[#0A5C48] focus-within:border-[#0A5C48] transition-all cursor-text hover:border-[#82928A]"
          >
            {selectedCountries.map((code) => {
              const item = COUNTRIES_LIST.find((c) => c.code === code);
              const flag = item?.flag || getCountryFlag(code);
              const name = item?.name || code;
              return (
                <span
                  key={code}
                  className="inline-flex items-center gap-1.5 bg-[#F2F6F4] border border-[#DEE7E2] text-[#0F172A] text-xs font-semibold px-2.5 py-1 rounded-md transition-colors"
                >
                  <span className="text-sm leading-none">{flag}</span>
                  <span className="text-[#0F172A]">{name}</span>
                  <button
                    type="button"
                    onClick={(e) => removeCountry(code, e)}
                    className="border-l border-[#D5DFD9] pl-1.5 ml-1 text-[#64748B] hover:text-[#DC2626]"
                  >
                    <X className="h-3 w-3" />
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
              className="flex-1 min-w-[160px] bg-transparent border-0 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none px-2 py-1"
            />
          </div>

          <p className="text-[11px] text-[#64748B]">
            Only visitors from approved countries can view your Target Offer. All other countries are instantly deflected to your Bot Action (404/403 or Safe Page). Select "All Countries" for global allowance.
          </p>

          {/* Country Dropdown Options Menu */}
          {isCountryDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-[#E5EAE7] rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto p-2 space-y-1 animate-in fade-in-50 duration-150">
              {filteredCountryOptions.map((c) => {
                const isSelected = selectedCountries.includes(c.code);
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleCountrySelect(c.code)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                      isSelected 
                        ? "bg-[#EBF5F1] text-[#07382D] font-bold border border-[#CCE5DB]" 
                        : "text-[#2D3B35] hover:bg-[#F7FAF8] hover:text-[#0F172A]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base leading-none">{c.flag}</span>
                      <span className="text-[#0F172A] font-semibold">{c.name}</span>
                      <span className="text-[10px] text-[#64748B] uppercase font-mono">({c.code})</span>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-[#0A5C48]" />}
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
      <div className="bg-white border border-[#E5EAE7] rounded-xl p-6 space-y-5 shadow-xs">
        <div className="flex items-center gap-2.5 border-b border-[#E5EAE7] pb-3.5">
          <div className="w-8 h-8 rounded-lg bg-[#E6F2ED] border border-[#CCE5DB] flex items-center justify-center text-[#0A5C48]">
            <LinkIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#0F172A] tracking-tight">
              Traffic Destinations & Bot Deflection Controls
            </h3>
            <p className="text-xs text-[#64748B]">
              Define destination addresses for verified human visitors, and choose an error page or URL for blocked traffic
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Target Offer (Human URL) */}
          <div className="bg-[#F7FAF8] border border-[#E0E9E4] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#E6F2ED] border border-[#CCE5DB] text-[#0A5C48] flex items-center justify-center">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">Target Offer (Human Visitors)</h4>
                  <p className="text-[11px] text-[#64748B]">Approved users passing country, device & VPN rules</p>
                </div>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[#E6F2ED] text-[#07382D] border border-[#CCE5DB]">
                Money Page
              </span>
            </div>

            <div className="space-y-1.5 pt-1">
              <Input
                type="url"
                value={humanUrl}
                onChange={(e) => setHumanUrl(e.target.value)}
                placeholder="https://myoffer.com/landing-page"
                className="bg-white border-[#D5DFD9] text-xs font-mono text-[#0F172A] h-10 placeholder:text-[#94A3B8] focus:border-[#0A5C48] focus:ring-1 focus:ring-[#0A5C48]"
              />
              <p className="text-[11px] text-[#64748B]">
                Query parameters and tracking tokens are forwarded automatically.
              </p>
            </div>
          </div>

          {/* Safe Landing & Bot Error Code Action */}
          <div className="bg-[#F7FAF8] border border-[#E0E9E4] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">Bot & Filtered Traffic Action</h4>
                  <p className="text-[11px] text-[#64748B]">Enter 404, 403, or a Safe Page URL</p>
                </div>
              </div>
              {isBot404 ? (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  HTTP 404 NOT FOUND
                </span>
              ) : isBot403 ? (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  HTTP 403 FORBIDDEN
                </span>
              ) : isBotUrl ? (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  SAFE REDIRECT URL
                </span>
              ) : (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  BOT ACTION
                </span>
              )}
            </div>

            {/* Quick Action Presets (404, 403, URL) */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setBotUrl("404")}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-md border transition-all ${
                  isBot404
                    ? "bg-rose-50 text-rose-700 border-rose-300"
                    : "bg-white text-[#64748B] border-[#D5DFD9] hover:text-[#0F172A] hover:border-[#82928A]"
                }`}
              >
                404 Not Found
              </button>
              <button
                type="button"
                onClick={() => setBotUrl("403")}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-md border transition-all ${
                  isBot403
                    ? "bg-amber-50 text-amber-700 border-amber-300"
                    : "bg-white text-[#64748B] border-[#D5DFD9] hover:text-[#0F172A] hover:border-[#82928A]"
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
                className={`text-[11px] font-bold px-2.5 py-1 rounded-md border transition-all ${
                  isBotUrl
                    ? "bg-blue-50 text-blue-700 border-blue-300"
                    : "bg-white text-[#64748B] border-[#D5DFD9] hover:text-[#0F172A] hover:border-[#82928A]"
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
                className="bg-white border-[#D5DFD9] text-xs font-mono text-[#0F172A] h-10 placeholder:text-[#94A3B8] focus:border-[#0A5C48] focus:ring-1 focus:ring-[#0A5C48]"
              />
              <p className="text-[11px] text-[#64748B]">
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white border border-[#E5EAE7] rounded-xl shadow-xs">
        <div className="text-xs text-[#64748B] flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#0A5C48] shrink-0" />
          <span>Rules take effect in real time across all integrated tracking links.</span>
        </div>
        <Button
          onClick={handleSave}
          disabled={updateUrlsMutation.isPending || isLoadingUrls}
          className="w-full sm:w-auto bg-[#0A5C48] hover:bg-[#07382D] text-white text-xs font-bold px-6 h-10 rounded-lg shadow-xs transition-all flex items-center justify-center gap-2"
        >
          <Save className="h-4 w-4" />
          {updateUrlsMutation.isPending ? "Saving Rules..." : "Save Configuration"}
        </Button>
      </div>
    </div>
  );
}
