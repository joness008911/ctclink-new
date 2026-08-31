import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  Code, 
  Download, 
  Copy, 
  Check, 
  Shield, 
  FileCode, 
  Terminal, 
  Cpu,
  Layers,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import JSZip from "jszip";

interface UserIntegrationTabProps {
  apiKeyValue: string | null;
  customEndpoint: string;
  setCustomEndpoint: (val: string) => void;
  humanUrl?: string;
  botUrl?: string;
}

export function UserIntegrationTab({
  apiKeyValue,
  customEndpoint,
  setCustomEndpoint,
  humanUrl,
  botUrl,
}: UserIntegrationTabProps) {
  const { toast } = useToast();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

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

  const phpIntegrationCode = `<?php
/**
 * CleanTraffic Cloak - High-Performance Traffic Defense Integration Script
 * Auto-generated for API Key: ${apiKeyValue || 'ctc_your_api_key_here'}
 */
session_start();

$apiKey = '${apiKeyValue || 'ctc_your_api_key_here'}';
$apiEndpoint = '${effectiveEndpoint}';
$configuredBotUrl = '${botUrl || ''}';
$configuredHumanUrl = '${humanUrl || ''}';

// Extract Visitor IP with Cloudflare / Proxy awareness
$visitorIp = $_SERVER['HTTP_CF_CONNECTING_IP'] 
    ?? $_SERVER['HTTP_X_FORWARDED_FOR'] 
    ?? $_SERVER['REMOTE_ADDR'] 
    ?? '127.0.0.1';

if (strpos($visitorIp, ',') !== false) {
    $visitorIp = trim(explode(',', $visitorIp)[0]);
}

$visitorUserAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$email = null;
if (!empty($_SERVER['QUERY_STRING'])) {
    parse_str($_SERVER['QUERY_STRING'], $queryParams);
    $email = $queryParams['e'] ?? $queryParams['email'] ?? null;
}

// Session Fast Cache (short 60-second TTL to ensure instantaneous URL update sync)
$cacheKey = 'ctc_decision_' . md5($visitorIp . '_' . $apiKey);
$bypassCache = isset($_GET['nocache']) || isset($_GET['preview_test']);
if (!$bypassCache && isset($_SESSION[$cacheKey]) && (time() - $_SESSION[$cacheKey]['time']) < 60) {
    $destination = $_SESSION[$cacheKey]['target'];
    if (!empty($_SERVER['QUERY_STRING'])) {
        $sep = (strpos($destination, '?') !== false) ? '&' : '?';
        $destination .= $sep . $_SERVER['QUERY_STRING'];
    }
    header('Location: ' . $destination);
    exit;
}

// Evaluate with CleanTraffic Cloak Engine
$ch = curl_init(rtrim($apiEndpoint, '/') . '/api/classify');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 4);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $apiKey,
    'x-api-key: ' . $apiKey
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'apiKey' => $apiKey,
    'ip' => $visitorIp,
    'userAgent' => $visitorUserAgent,
    'email' => $email,
    'queryString' => $_SERVER['QUERY_STRING'] ?? ''
]));

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$destination = null;

if ($httpCode === 200 && $response) {
    $data = json_decode($response, true);
    if (is_array($data)) {
        // Priority 1: Exact dynamic redirect URL resolved by server for this API key
        if (!empty($data['redirectUrl'])) {
            $destination = $data['redirectUrl'];
        } elseif (!empty($data['redirect_url'])) {
            $destination = $data['redirect_url'];
        } elseif (!empty($data['destination'])) {
            $destination = $data['destination'];
        } elseif (!empty($data['url'])) {
            $destination = $data['url'];
        }
        
        // Priority 2: Fallback to role-specific URL returned by server
        if (empty($destination)) {
            $isHuman = (!empty($data['isHuman']) && $data['isHuman'] === true) 
                || (!empty($data['is_human']) && $data['is_human'] === true)
                || (isset($data['visitorType']) && $data['visitorType'] === 'Human')
                || (isset($data['visitor_type']) && $data['visitor_type'] === 'Human');
                
            if ($isHuman) {
                $destination = $data['humanUrl'] ?? $data['human_url'] ?? $configuredHumanUrl;
            } else {
                $destination = $data['botUrl'] ?? $data['bot_url'] ?? $configuredBotUrl;
            }
        }
    }
}

// Fail-secure fallback: if destination could not be determined, defer to configured Bot URL
if (empty($destination)) {
    $destination = !empty($configuredBotUrl) ? $configuredBotUrl : 'about:blank';
}

// Store session cache
$_SESSION[$cacheKey] = ['target' => $destination, 'time' => time()];

// Forward original query parameters to destination
if (!empty($_SERVER['QUERY_STRING']) && $destination !== 'about:blank') {
    $sep = (strpos($destination, '?') !== false) ? '&' : '?';
    $destination .= $sep . $_SERVER['QUERY_STRING'];
}

// Execute redirect
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Location: ' . $destination);
exit;
`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(phpIntegrationCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast({ title: "Code Copied", description: "PHP script code copied to clipboard" });
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
        `CleanTraffic Cloak - Quick Deployment Guide\n\n1. Upload index.php to your campaign or tracking server webroot.\n2. Ensure PHP 7.4+ with cURL extension is enabled.\n3. Test the link from your browser.\n4. Change Human and Bot redirect targets from your CleanTraffic Dashboard at any time!\n`
      );

      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cleantraffic-cloak-script.zip`;
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
      {/* Top Banner */}
      <div className="bg-[#101726] border border-[#1c2638] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <Code className="h-5 w-5 text-blue-500" />
              Integration Script Generator
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Download and deploy the zero-footprint PHP script to host on your landing pages or tracking servers.
            </p>
          </div>

          <Button
            onClick={handleDownloadZip}
            disabled={!apiKeyValue}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-5 gap-2"
          >
            <Download className="h-4 w-4" />
            Download ZIP Package
          </Button>
        </div>

        {/* API Key & Endpoint Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="bg-[#141d2e] border border-[#212e45] p-3.5 rounded-xl space-y-1">
            <Label className="text-[11px] text-slate-400">Your Assigned API Key</Label>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-blue-400 truncate">
                {apiKeyValue || "Loading key..."}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyKey}
                disabled={!apiKeyValue}
                className="h-7 px-2 text-slate-400 hover:text-white"
              >
                {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          <div className="bg-[#141d2e] border border-[#212e45] p-3.5 rounded-xl space-y-1">
            <Label className="text-[11px] text-slate-400">API Endpoint Host</Label>
            <Input
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              placeholder="https://your-domain.com"
              className="bg-[#0e1422] border-[#25344f] text-white text-xs font-mono h-8"
            />
          </div>
        </div>
      </div>

      {/* Code Preview Box */}
      <div className="bg-[#101726] border border-[#1c2638] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-bold text-white">index.php Source Code</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyCode}
            className="h-7 text-xs border-[#25344f] bg-[#141d2e] text-slate-300 hover:text-white gap-1.5"
          >
            {copiedCode ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            {copiedCode ? "Copied" : "Copy Code"}
          </Button>
        </div>

        <div className="bg-[#0b0f19] border border-[#1a2333] rounded-xl p-4 overflow-x-auto">
          <pre className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre">
            {phpIntegrationCode}
          </pre>
        </div>
      </div>
    </div>
  );
}
