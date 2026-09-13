import { useState, useMemo } from "react";
import { generatePhpIntegrationCode } from "./phpTemplate";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  Code, 
  Download, 
  Copy, 
  Check, 
  Shield, 
  FileCode, 
  Layers, 
  Key,
  ShieldCheck,
  Zap,
  Globe,
  BookOpen,
  ArrowRight,
  ExternalLink,
  Eye,
  EyeOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import JSZip from "jszip";

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
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const maskKey = (key: string | null) => {
    if (!key) return "••••••••••••••••";
    if (key.length <= 8) return "•".repeat(Math.max(key.length, 8));
    return `${key.slice(0, 4)}••••••••••••••••${key.slice(-4)}`;
  };

  const effectiveEndpoint = (customEndpoint || (typeof window !== "undefined" ? window.location.origin : ""))
    .trim()
    .replace(/\/+$/, "");

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
    toast({ title: "PHP Code Copied", description: "Integration script copied to clipboard" });
  };

  const phpIntegrationCode = useMemo(() => generatePhpIntegrationCode(apiKeyValue, effectiveEndpoint), [apiKeyValue, effectiveEndpoint]);

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
        `CleanTraffic - Quick Deployment Guide\n\n1. Upload index.php to your application or web server root.\n2. Ensure PHP 7.4+ with cURL extension is enabled.\n3. Test the link from your browser.\n4. Configure routing and mitigation policies from your CleanTraffic Dashboard at any time!\n`
      );

      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cleantraffic-security-script.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Started",
        description: "Your customized integration script package has been downloaded.",
      });
    } catch (err: any) {
      toast({
        title: "Download Error",
        description: err.message || "Failed to generate ZIP",
        variant: "destructive",
      });
    }
  };

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

      {/* Top Banner */}
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
              Download and deploy the zero-footprint PHP script to host on your landing pages or tracking servers.
            </p>
          </div>

          <Button
            onClick={handleDownloadZip}
            disabled={!apiKeyValue}
            className="bg-[#0A5C48] hover:bg-[#07382D] text-white text-xs font-bold px-5 h-10 rounded-lg gap-2 shadow-xs transition-all"
          >
            <Download className="h-4 w-4" />
            Download ZIP Package
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

      {/* Architecture Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E5EAE7] rounded-xl p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 text-[#0A5C48] font-bold text-xs">
            <Zap className="h-4 w-4" />
            1. Loading State First
          </div>
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            Immediately serves a valid HTTP 200 verification screen in &lt;1ms. Eliminates white-screen hangs and avoids premature error pages.
          </p>
        </div>

        <div className="bg-white border border-[#E5EAE7] rounded-xl p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 text-[#0A5C48] font-bold text-xs">
            <Layers className="h-4 w-4" />
            2. Background Verification
          </div>
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            Runs the full cascading detection, threat intelligence, and geo/device rules in the background while the visitor views the loading state.
          </p>
        </div>

        <div className="bg-white border border-[#E5EAE7] rounded-xl p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 text-[#0A5C48] font-bold text-xs">
            <ShieldCheck className="h-4 w-4" />
            3. Live Classification Logs
          </div>
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            Visitor decisions are classified accurately and recorded into your analytics stream and live dashboard feed in real time.
          </p>
        </div>

        <div className="bg-white border border-[#E5EAE7] rounded-xl p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 text-[#0A5C48] font-bold text-xs">
            <Shield className="h-4 w-4" />
            4. Automatic Transition
          </div>
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            Transitions to "Done" automatically upon verification and executes the client-configured routing rule without requiring any button clicks.
          </p>
        </div>
      </div>

      {/* Code Preview Box */}
      <div className="bg-white border border-[#E5EAE7] rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-[#0A5C48]" />
            <span className="text-sm font-bold text-[#0F172A]">index.php Source Code</span>
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
          <pre className="font-mono text-xs text-[#C8E0D7] leading-relaxed whitespace-pre">
            {showKey 
              ? phpIntegrationCode 
              : phpIntegrationCode.replace(
                  `$apiKey = '${apiKeyValue || 'ctc_your_api_key_here'}';`,
                  `$apiKey = '${maskKey(apiKeyValue)}'; // Masked in preview. "Copy Code" & ZIP package export active key.`
                )}
          </pre>
        </div>
      </div>
    </div>
  );
}
