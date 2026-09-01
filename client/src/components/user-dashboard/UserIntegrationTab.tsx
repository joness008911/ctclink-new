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
  Sparkles,
  Key
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
 * 
 * IMPORTANT:
 * - All Human and Bot destination URLs are dynamically managed from your Dashboard.
 * - No URLs are hardcoded in this script.
 * - Changing URLs in your dashboard takes effect immediately across all domains.
 */
session_start();

$apiKey = '${apiKeyValue || 'ctc_your_api_key_here'}';
$apiEndpoint = '${effectiveEndpoint}';

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

// Session Fast Cache (60-second TTL to ensure instantaneous dashboard sync)
$cacheKey = 'ctc_decision_' . md5($visitorIp . '_' . $apiKey);
$bypassCache = isset($_GET['nocache']) || isset($_GET['preview_test']);
if (!$bypassCache && isset($_SESSION[$cacheKey]) && (time() - $_SESSION[$cacheKey]['time']) < 60) {
    $cached = $_SESSION[$cacheKey];
    $destination = $cached['target'];
    $cachedAction = $cached['action'] ?? 'redirect';
    
    if ($destination === '404' || $destination === '403' || $cachedAction === '404' || $cachedAction === '403') {
        $code = ($destination === '403' || $cachedAction === '403') ? 403 : 404;
        http_response_code($code);
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Content-Type: text/html; charset=utf-8');
        if ($code === 403) {
            echo "<!DOCTYPE html><html><head><title>403 Forbidden</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;}</style></head><body><h1>403 Forbidden</h1><p>Access to this resource on the server is denied.</p></body></html>";
        } else {
            echo "<!DOCTYPE html><html><head><title>404 Not Found</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;}</style></head><body><h1>404 Not Found</h1><p>The requested URL was not found on this server.</p></body></html>";
        }
        exit;
    }

    if (!empty($_SERVER['QUERY_STRING'])) {
        $sep = (strpos($destination, '?') !== false) ? '&' : '?';
        $destination .= $sep . $_SERVER['QUERY_STRING'];
    }
    header('Location: ' . $destination);
    exit;
}

// Communicate with central classification endpoint
$ch = curl_init(rtrim($apiEndpoint, '/') . '/api/classify');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 5);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $apiKey,
    'x-api-key: ' . $apiKey
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'apiKey' => $apiKey,
    'ip' => $visitorIp,
    'userAgent' => $visitorUserAgent,
    'acceptLanguage' => $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '',
    'accept' => $_SERVER['HTTP_ACCEPT'] ?? '',
    'email' => $email,
    'queryString' => $_SERVER['QUERY_STRING'] ?? ''
]));

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$destination = null;
$statusAction = 'redirect';

if ($httpCode === 200 && $response) {
    $data = json_decode($response, true);
    if (is_array($data)) {
        $destination = $data['redirectUrl'] ?? $data['redirect_url'] ?? null;
        $statusAction = $data['statusAction'] ?? ($data['status_action'] ?? 'redirect');
    }
} elseif ($httpCode === 401 || $httpCode === 403) {
    // API key is invalid, revoked, expired, or disabled
    $data = json_decode($response, true);
    $errorMsg = is_array($data) ? ($data['message'] ?? 'API key authorization failed.') : 'API key authorization failed.';
    http_response_code($httpCode);
    header('Content-Type: text/html; charset=utf-8');
    echo "<!DOCTYPE html><html><head><title>Access Denied</title><style>body{font-family:sans-serif;padding:40px;background:#0f172a;color:#f8fafc;}h2{color:#ef4444;}p{color:#94a3b8;}</style></head><body><h2>Security Cloak Error</h2><p>" . htmlspecialchars($errorMsg) . "</p></body></html>";
    exit;
}

// Check if destination is configured as an HTTP status error (404 or 403)
if ($destination === '404' || $destination === '403' || $statusAction === '404' || $statusAction === '403') {
    $_SESSION[$cacheKey] = ['target' => $destination, 'action' => $destination, 'time' => time()];
    $code = ($destination === '403' || $statusAction === '403') ? 403 : 404;
    http_response_code($code);
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Content-Type: text/html; charset=utf-8');
    if ($code === 403) {
        echo "<!DOCTYPE html><html><head><title>403 Forbidden</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;}</style></head><body><h1>403 Forbidden</h1><p>Access to this resource on the server is denied.</p></body></html>";
    } else {
        echo "<!DOCTYPE html><html><head><title>404 Not Found</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;}</style></head><body><h1>404 Not Found</h1><p>The requested URL was not found on this server.</p></body></html>";
    }
    exit;
}

// If no destination URL is configured on the dashboard or system default
if (empty($destination)) {
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    echo "<!DOCTYPE html><html><head><title>Routing Unconfigured</title><style>body{font-family:sans-serif;padding:40px;background:#0f172a;color:#f8fafc;}h2{color:#f59e0b;}p{color:#94a3b8;}</style></head><body><h2>Routing Notice</h2><p>No destination redirect URL has been configured in the dashboard for this account.</p></body></html>";
    exit;
}

// Store decision in session cache
$_SESSION[$cacheKey] = ['target' => $destination, 'action' => 'redirect', 'time' => time()];

// Append query string parameters seamlessly
if (!empty($_SERVER['QUERY_STRING'])) {
    $sep = (strpos($destination, '?') !== false) ? '&' : '?';
    $destination .= $sep . $_SERVER['QUERY_STRING'];
}

// Execute redirection
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

      {/* Architecture Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#101726] border border-[#1c2638] rounded-xl p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs">
            <Key className="h-4 w-4" />
            1. Dedicated API Key
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Your unique API key ties all requests directly to your account. No other user can access or modify your routing settings.
          </p>
        </div>

        <div className="bg-[#101726] border border-[#1c2638] rounded-xl p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
            <Shield className="h-4 w-4" />
            2. Dashboard Controlled URLs
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            No destination URLs are stored inside the script. Update Human or Bot URLs in your dashboard, and they update live instantly.
          </p>
        </div>

        <div className="bg-[#101726] border border-[#1c2638] rounded-xl p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-purple-400 font-semibold text-xs">
            <Layers className="h-4 w-4" />
            3. Multi-Domain Deployment
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Deploy this exact script across unlimited campaign domains. They all sync dynamically with your single dashboard configuration.
          </p>
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
