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
 * ARCHITECTURE:
 * - Real-time visitor classification & threat defense.
 * - Dynamic Dashboard URLs (no URLs hardcoded in this script).
 * - Per-visitor sliding window rate limiting (10 requests / 60 seconds).
 * - Clean, standard HTTP status codes (429, 403, 404, 503) with plain styling.
 * - Granular API key diagnostics for resource owners and visitors.
 */
session_start();

$apiKey = '${apiKeyValue || 'ctc_your_api_key_here'}';
$apiEndpoint = '${effectiveEndpoint}';

// 1. Extract Visitor IP with Cloudflare, Akamai, Fastly, AWS ALB & Reverse Proxy awareness
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

// 2. High-Frequency Visitor Velocity Rate Limiting (10 requests / 60 seconds per IP)
$now = time();
$rlSessionKey = 'ctc_rl_' . md5($visitorIp);
if (!isset($_SESSION[$rlSessionKey]) || !is_array($_SESSION[$rlSessionKey])) {
    $_SESSION[$rlSessionKey] = [];
}
// Clean timestamps older than 60 seconds
$_SESSION[$rlSessionKey] = array_filter($_SESSION[$rlSessionKey], function($ts) use ($now) {
    return ($now - $ts) < 60;
});
$_SESSION[$rlSessionKey][] = $now;
$sessionHitCount = count($_SESSION[$rlSessionKey]);

// Also track via transient file token in /tmp to enforce limits even if visitor or bot disables cookies
$fsHitCount = 0;
$fsBucket = sys_get_temp_dir() . '/ctc_rl_' . md5($visitorIp . '_' . date('YmdHi'));
if (file_exists($fsBucket)) {
    $fsHitCount = (int)@file_get_contents($fsBucket);
}
$fsHitCount++;
@file_put_contents($fsBucket, (string)$fsHitCount, LOCK_EX);

$totalRecentHits = max($sessionHitCount, $fsHitCount);

if ($totalRecentHits > 10) {
    http_response_code(429);
    header('Retry-After: 60');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Content-Type: text/html; charset=utf-8');
    echo "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>429 Too Many Requests</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;line-height:1.6;max-width:500px;margin:0 auto 8px auto;}</style></head><body><h1>429 Too Many Requests</h1><p>You have made too many requests in a short period of time.</p><p>Please wait a moment and try again.</p></body></html>";
    exit;
}

$visitorUserAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$email = null;
if (!empty($_SERVER['QUERY_STRING'])) {
    parse_str($_SERVER['QUERY_STRING'], $queryParams);
    $email = $queryParams['e'] ?? $queryParams['email'] ?? null;
}

// 3. Session Fast Cache (60-second TTL to ensure instantaneous dashboard sync)
$cacheKey = 'ctc_decision_' . md5($visitorIp . '_' . $apiKey);
$bypassCache = isset($_GET['nocache']) || isset($_GET['preview_test']);
if (!$bypassCache && isset($_SESSION[$cacheKey]) && (time() - $_SESSION[$cacheKey]['time']) < 60) {
    $cached = $_SESSION[$cacheKey];
    $destination = $cached['target'];
    $cachedAction = $cached['action'] ?? 'redirect';
    $isAutomatedBot = !empty($cached['is_bot']);
    
    if ($destination === '404' || $destination === '403' || $cachedAction === '404' || $cachedAction === '403') {
        $code = ($destination === '403' || $cachedAction === '403') ? 403 : 404;
        http_response_code($code);
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Content-Type: text/html; charset=utf-8');
        if ($code === 403) {
            $reasonMsg = $isAutomatedBot 
                ? "This resource is not available to automated requests." 
                : "Access to this resource is denied.";
            echo "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>403 Forbidden</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;line-height:1.6;max-width:500px;margin:0 auto;}</style></head><body><h1>403 Forbidden</h1><p>" . htmlspecialchars($reasonMsg) . "</p></body></html>";
        } else {
            echo "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>404 Not Found</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;line-height:1.6;max-width:500px;margin:0 auto;}</style></head><body><h1>404 Not Found</h1><p>The requested URL was not found on this server.</p></body></html>";
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

// 4. Communicate with central classification endpoint with resilient, fast cURL execution
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
if (($httpCode === 0 || empty($response)) && $httpCode !== 401 && $httpCode !== 403 && $httpCode !== 429) {
    usleep(150000); // 150ms backoff
    $result = $performClassificationRequest();
    $httpCode = $result['code'];
    $response = $result['response'];
}

$destination = null;
$statusAction = 'redirect';

// 5. Handle Rate Limiting from Central Server (HTTP 429)
if ($httpCode === 429) {
    http_response_code(429);
    header('Retry-After: 60');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Content-Type: text/html; charset=utf-8');
    echo "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>429 Too Many Requests</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;line-height:1.6;max-width:500px;margin:0 auto 8px auto;}</style></head><body><h1>429 Too Many Requests</h1><p>You have made too many requests in a short period of time.</p><p>Please wait a moment and try again.</p></body></html>";
    exit;
}

// 6. Handle API Key Statuses & Access Denials (HTTP 401 / 403)
if ($httpCode === 401 || $httpCode === 403) {
    $data = json_decode($response, true);
    $errCode = is_array($data) ? ($data['code'] ?? '') : '';
    $errMsg = is_array($data) ? ($data['message'] ?? 'API key authorization failed.') : 'API key authorization failed.';

    http_response_code($httpCode);
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Content-Type: text/html; charset=utf-8');

    $title = "403 Forbidden";
    $heading = "Access Denied";
    $desc = htmlspecialchars($errMsg);
    $ownerInst = "";
    $visitorInst = "";

    if ($errCode === 'API_KEY_EXPIRED' || stripos($errMsg, 'expired') !== false) {
        $title = "API Key Expired";
        $heading = "API Key Expired";
        $desc = "Your API key has expired and can no longer be used.";
        $ownerInst = "Generate or renew your API key and update the application configuration.";
        $visitorInst = "Please contact the resource owner.";
    } elseif ($errCode === 'API_KEY_REVOKED' || stripos($errMsg, 'revoked') !== false || stripos($errMsg, 'disabled') !== false) {
        $title = "API Key Revoked";
        $heading = "API Key Revoked";
        $desc = "This API key has been disabled by the resource owner.";
        $ownerInst = "Generate a new active API key from your CleanTraffic dashboard settings.";
        $visitorInst = "Please contact the resource owner.";
    } elseif ($errCode === 'API_KEY_PAUSED' || stripos($errMsg, 'paused') !== false) {
        $title = "Campaign Paused";
        $heading = "Campaign Paused";
        $desc = "This campaign has been temporarily paused by the resource owner.";
        $ownerInst = "Resume this campaign in your CleanTraffic dashboard to start accepting traffic.";
        $visitorInst = "Please check back later or contact the resource owner.";
    } elseif ($httpCode === 401 || $errCode === 'INVALID_API_KEY' || stripos($errMsg, 'invalid') !== false) {
        $title = "Invalid API Key";
        $heading = "Invalid API Key";
        $desc = "The API key provided with this request could not be verified.";
        $ownerInst = "Check that the key in index.php matches your active key in your dashboard and has not been modified or truncated.";
        $visitorInst = "Please contact the resource owner.";
    } else {
        $title = "403 Forbidden";
        $heading = "Access Denied";
        $ownerInst = "Log in to your CleanTraffic dashboard to review your account or campaign settings.";
        $visitorInst = "Please contact the resource owner.";
    }

    echo "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>" . htmlspecialchars($title) . "</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;line-height:1.6;max-width:540px;margin:0 auto 12px auto;}.guide{margin:28px auto 0 auto;max-width:520px;padding:18px 22px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;text-align:left;font-size:0.92rem;color:#334155;line-height:1.6;}.guide strong{display:block;color:#0f172a;margin-top:10px;font-size:0.9rem;}.guide strong:first-child{margin-top:0;}.guide span{display:block;color:#64748b;margin-top:2px;}</style></head><body><h1>" . htmlspecialchars($heading) . "</h1><p>" . htmlspecialchars($desc) . "</p>";

    if (!empty($ownerInst)) {
        echo "<div class=\"guide\"><strong>If you are the resource owner:</strong><span>" . htmlspecialchars($ownerInst) . "</span><strong>If you are a visitor:</strong><span>" . htmlspecialchars($visitorInst) . "</span></div>";
    }

    echo "</body></html>";
    exit;
}

// 7. Handle Server Errors or Network Failures (HTTP 500 / 503 / cURL Failure)
if ($httpCode >= 500 || $httpCode === 0 || empty($response)) {
    http_response_code(503);
    header('Retry-After: 30');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Content-Type: text/html; charset=utf-8');
    echo "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>503 Service Temporarily Unavailable</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;line-height:1.6;max-width:500px;margin:0 auto 8px auto;}</style></head><body><h1>503 Service Temporarily Unavailable</h1><p>The service is temporarily unavailable. Please try again in a few moments.</p></body></html>";
    exit;
}

// 8. Process Classification Result
$isAutomatedBot = false;
if ($httpCode === 200 && $response) {
    $data = json_decode($response, true);
    if (is_array($data)) {
        $destination = $data['redirectUrl'] ?? $data['redirect_url'] ?? null;
        $statusAction = $data['statusAction'] ?? ($data['status_action'] ?? 'redirect');
        $isBot = ($data['visitorType'] ?? $data['visitor_type'] ?? '') === 'Bot';
        $blockReason = $data['block_reason'] ?? '';
        $detectionMethod = $data['detection_method'] ?? '';
        $isAutomatedBot = $isBot && (stripos($blockReason, 'crawler') !== false || stripos($detectionMethod, 'crawler') !== false || stripos($blockReason, 'bot') !== false);
    }
}

// 9. Check if destination is configured as an HTTP status error (404 or 403)
if ($destination === '404' || $destination === '403' || $statusAction === '404' || $statusAction === '403') {
    $_SESSION[$cacheKey] = [
        'target' => $destination, 
        'action' => $destination, 
        'is_bot' => $isAutomatedBot, 
        'time' => time()
    ];
    $code = ($destination === '403' || $statusAction === '403') ? 403 : 404;
    http_response_code($code);
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Content-Type: text/html; charset=utf-8');
    if ($code === 403) {
        $reasonMsg = $isAutomatedBot 
            ? "This resource is not available to automated requests." 
            : "Access to this resource is denied.";
        echo "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>403 Forbidden</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;line-height:1.6;max-width:500px;margin:0 auto;}</style></head><body><h1>403 Forbidden</h1><p>" . htmlspecialchars($reasonMsg) . "</p></body></html>";
    } else {
        echo "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>404 Not Found</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;line-height:1.6;max-width:500px;margin:0 auto;}</style></head><body><h1>404 Not Found</h1><p>The requested URL was not found on this server.</p></body></html>";
    }
    exit;
}

// 10. Fallback safety: If no destination received, default to safe 404
if (!$destination) {
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    echo "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>404 Not Found</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;line-height:1.6;max-width:500px;margin:0 auto;}</style></head><body><h1>404 Not Found</h1><p>The requested URL was not found on this server.</p></body></html>";
    exit;
}

// 11. Cache positive decision & execute redirect to Human destination URL
$_SESSION[$cacheKey] = [
    'target' => $destination, 
    'action' => $statusAction, 
    'is_bot' => false, 
    'time' => time()
];
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

        <div className="bg-white border border-[#E5EAE7] rounded-xl p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 text-[#0A5C48] font-bold text-xs">
            <Zap className="h-4 w-4" />
            4. Rate Limiting & Stealth Pages
          </div>
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            Built-in 10 req/60s velocity protection per IP with clean, standard 404, 403, and 429 response templates for visitors and bots.
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
