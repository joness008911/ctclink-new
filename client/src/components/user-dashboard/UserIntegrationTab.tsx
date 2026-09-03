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
  Layers, 
  Key,
  ShieldCheck,
  Zap,
  Globe
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

  const handleCopyCode = () => {
    navigator.clipboard.writeText(phpIntegrationCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast({ title: "PHP Code Copied", description: "Integration script copied to clipboard" });
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

// Extract Visitor IP with Cloudflare, Akamai, Fastly, AWS ALB & Reverse Proxy awareness
$visitorIp = $_SERVER['HTTP_CF_CONNECTING_IP'] 
    ?? $_SERVER['HTTP_TRUE_CLIENT_IP'] 
    ?? $_SERVER['HTTP_X_REAL_IP'] 
    ?? $_SERVER['HTTP_FASTLY_CLIENT_IP'] 
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

// Communicate with central classification endpoint with resilient, fast cURL execution
$postPayload = json_encode([
    'apiKey' => $apiKey,
    'ip' => $visitorIp,
    'userAgent' => $visitorUserAgent,
    'acceptLanguage' => $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '',
    'accept' => $_SERVER['HTTP_ACCEPT'] ?? '',
    'secChUa' => $_SERVER['HTTP_SEC_CH_UA'] ?? '',
    'secChUaMobile' => $_SERVER['HTTP_SEC_CH_UA_MOBILE'] ?? '',
    'secChUaPlatform' => $_SERVER['HTTP_SEC_CH_UA_PLATFORM'] ?? '',
    'secFetchSite' => $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '',
    'secFetchMode' => $_SERVER['HTTP_SEC_FETCH_MODE'] ?? '',
    'email' => $email,
    'queryString' => $_SERVER['QUERY_STRING'] ?? ''
]);

$curlHeaders = [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $apiKey,
    'x-api-key: ' . $apiKey
];

$performClassificationRequest = function() use ($apiEndpoint, $postPayload, $curlHeaders) {
    $ch = curl_init(rtrim($apiEndpoint, '/') . '/api/classify');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $postPayload,
        CURLOPT_HTTPHEADER => $curlHeaders,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
        CURLOPT_TCP_NODELAY => 1,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_FOLLOWLOCATION => true
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $httpCode, 'response' => $response];
};

$result = $performClassificationRequest();
$httpCode = $result['code'];
$response = $result['response'];

// 1-shot instantaneous micro-retry if a transient connection hiccup occurs on cold start
if (($httpCode === 0 || empty($response)) && $httpCode !== 401 && $httpCode !== 403) {
    usleep(150000); // 150ms backoff
    $result = $performClassificationRequest();
    $httpCode = $result['code'];
    $response = $result['response'];
}

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

// Fallback safety: If no destination received, default to safe 404
if (!$destination) {
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    echo "<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1></body></html>";
    exit;
}

$_SESSION[$cacheKey] = ['target' => $destination, 'action' => $statusAction, 'time' => time()];
if (!empty($_SERVER['QUERY_STRING'])) {
    $sep = (strpos($destination, '?') !== false) ? '&' : '?';
    $destination .= $sep . $_SERVER['QUERY_STRING'];
}

header('Location: ' . $destination);
exit;
`;

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
            <Label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Your Assigned API Key</Label>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold text-[#0A5C48] truncate">
                {apiKeyValue || "Loading key..."}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyKey}
                disabled={!apiKeyValue}
                className="h-7 px-2 text-[#64748B] hover:text-[#0F172A]"
              >
                {copiedKey ? <Check className="h-3.5 w-3.5 text-[#0A5C48]" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            2. Dashboard Controlled URLs
          </div>
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            No destination URLs are stored inside the script. Update Human or Bot URLs in your dashboard, and they update live instantly.
          </p>
        </div>

        <div className="bg-white border border-[#E5EAE7] rounded-xl p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 text-[#0A5C48] font-bold text-xs">
            <Layers className="h-4 w-4" />
            3. Multi-Domain Deployment
          </div>
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            Deploy this exact script across unlimited campaign domains. They all sync dynamically with your single dashboard configuration.
          </p>
        </div>
      </div>

      {/* Code Preview Box */}
      <div className="bg-white border border-[#E5EAE7] rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-[#0A5C48]" />
            <span className="text-sm font-bold text-[#0F172A]">index.php Source Code</span>
          </div>
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

        <div className="bg-[#051C15] border border-[#0F382B] rounded-xl p-4 overflow-x-auto shadow-inner">
          <pre className="font-mono text-xs text-[#C8E0D7] leading-relaxed whitespace-pre">
            {phpIntegrationCode}
          </pre>
        </div>
      </div>
    </div>
  );
}
