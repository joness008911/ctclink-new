import { useState } from "react";
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

  const phpIntegrationCode = `<?php
/**
 * CleanTraffic - High-Performance Bot Defense & Traffic Acceleration Integration Script
 * Auto-generated for API Key: \${apiKeyValue || 'ctc_your_api_key_here'}
 * 
 * ARCHITECTURE & ZERO-LATENCY PIPELINE:
 * 1. Layer 1 Edge Filter (PHP): Catches automated scrapers, headless emulators, and broken headers locally in <0.5ms (no external API calls).
 * 2. High-Speed Local Cache: Uses APCu memory or fast temp-file storage (12-24h TTL) to eliminate redundant classification requests.
 * 3. Interstitial Smooth Loader: Clean, animated loading spinner (1.5-2s) prevents blank-screen bounces and preserves ad conversion rates.
 * 4. Fail-Safe Closed Protection: Never leaks human offer URLs on network/server failures; renders a user-friendly retry button.
 * 5. Dynamic Dashboard Routing: Human and Bot destination URLs remain centrally managed from your CleanTraffic dashboard.
 */
session_start();

$apiKey = '\${apiKeyValue || 'ctc_your_api_key_here'}';
$apiEndpoint = '\${effectiveEndpoint}';

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

// 2. High-Frequency Visitor Velocity Rate Limiting (5 requests / 10 seconds per IP)
$now = time();
$rlSessionKey = 'ctc_rl_' . md5($visitorIp);
if (!isset($_SESSION[$rlSessionKey]) || !is_array($_SESSION[$rlSessionKey])) {
    $_SESSION[$rlSessionKey] = [];
}
$_SESSION[$rlSessionKey] = array_filter($_SESSION[$rlSessionKey], function($ts) use ($now) {
    return ($now - $ts) < 10;
});
$_SESSION[$rlSessionKey][] = $now;
$sessionHitCount = count($_SESSION[$rlSessionKey]);

$fsHitCount = 0;
$fsFile = sys_get_temp_dir() . '/ctc_rl_' . md5($visitorIp);
$fsHits = [];
if (file_exists($fsFile)) {
    $raw = @file_get_contents($fsFile);
    if ($raw) {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $fsHits = $decoded;
        }
    }
}
$fsHits = array_filter($fsHits, function($ts) use ($now) {
    return ($now - $ts) < 10;
});
$fsHits[] = $now;
@file_put_contents($fsFile, json_encode($fsHits), LOCK_EX);
$fsHitCount = count($fsHits);

$totalRecentHits = max($sessionHitCount, $fsHitCount);
if ($totalRecentHits >= 5) {
    http_response_code(429);
    header('Retry-After: 10');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>429 Too Many Requests</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;line-height:1.6;max-width:500px;margin:0 auto 8px auto;}</style></head><body><h1>429 Too Many Requests</h1><p>You have made too many requests in a short period of time.</p><p>Please wait a moment and try again.</p></body></html>';
    exit;
}

$visitorUserAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$email = null;
if (!empty($_SERVER['QUERY_STRING'])) {
    parse_str($_SERVER['QUERY_STRING'], $queryParams);
    $email = $queryParams['e'] ?? $queryParams['email'] ?? null;
}

// 3. LAYER 1 LOCAL PHP EDGE BOT PRE-FILTER (Instant Deflection - Zero API Latency)
// Intercepts CLI tools, headless automation, search engines, AI scrapers, and missing browser headers
$botSignatures = [
    'curl', 'wget', 'python-requests', 'python-urllib', 'httpx', 'aiohttp', 'scrapy',
    'go-http-client', 'apache-httpclient', 'okhttp', 'node-fetch', 'axios', 'undici',
    'headlesschrome', 'phantomjs', 'selenium', 'puppeteer', 'playwright', 'webdriver',
    'googlebot', 'bingbot', 'yandexbot', 'baiduspider', 'duckduckbot', 'petalbot',
    'applebot', 'facebookexternalhit', 'facebot', 'twitterbot', 'linkedinbot',
    'bytespider', 'gptbot', 'chatgpt-user', 'claudebot', 'perplexitybot', 'ccbot',
    'ahrefsbot', 'semrushbot', 'mj12bot', 'dotbot', 'zoominfobot', 'sqlmap', 'nikto',
    'nuclei', 'masscan', 'censysinspect', 'shodan'
];

$isKnownBot = false;
$lowerUA = strtolower($visitorUserAgent);

if (empty(trim($visitorUserAgent))) {
    $isKnownBot = true;
} else {
    foreach ($botSignatures as $sig) {
        if (strpos($lowerUA, $sig) !== false) {
            $isKnownBot = true;
            break;
        }
    }
}

// Anomaly check: Claims to be modern browser but omits standard Accept-Language and Accept headers
$acceptHeader = $_SERVER['HTTP_ACCEPT'] ?? '';
$acceptLanguage = $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '';
$isClaimingBrowser = (strpos($visitorUserAgent, 'Mozilla/5.0') !== false) && 
    (strpos($visitorUserAgent, 'Chrome') !== false || strpos($visitorUserAgent, 'Safari') !== false || strpos($visitorUserAgent, 'Firefox') !== false);

if ($isClaimingBrowser && empty($acceptLanguage) && (empty($acceptHeader) || $acceptHeader === '*/*')) {
    $isKnownBot = true;
}

// If local bot check flags the request, block or serve safe 403 immediately without waiting for API
if ($isKnownBot) {
    http_response_code(403);
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>403 Forbidden</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;line-height:1.6;max-width:500px;margin:0 auto;}</style></head><body><h1>403 Forbidden</h1><p>This resource is not available to automated requests.</p></body></html>';
    exit;
}

// 4. HIGH-PERFORMANCE LOCAL IP DECISION CACHE (APCu + Temp File with 12-Hour TTL)
$cacheKey = 'ctc_ip_' . md5($visitorIp . '_' . $apiKey);
$skipCache = isset($_GET['nocache']) || isset($_GET['preview_test']);
$cacheTtl = 43200; // 12 hours (43,200 seconds)
$cachedData = null;

if (!$skipCache) {
    // Check APCu in-memory cache first if available
    if (function_exists('apcu_fetch')) {
        $apcuVal = apcu_fetch($cacheKey);
        if ($apcuVal && is_array($apcuVal) && (time() - $apcuVal['time']) < $cacheTtl) {
            $cachedData = $apcuVal;
        }
    }
    
    // Fall back to fast local file cache in sys_get_temp_dir()
    if (!$cachedData) {
        $ipCacheFile = sys_get_temp_dir() . '/' . $cacheKey . '.json';
        if (file_exists($ipCacheFile)) {
            $rawCache = @file_get_contents($ipCacheFile);
            if ($rawCache) {
                $fileVal = json_decode($rawCache, true);
                if (is_array($fileVal) && isset($fileVal['time']) && (time() - $fileVal['time']) < $cacheTtl) {
                    $cachedData = $fileVal;
                    // Seed APCu for next request
                    if (function_exists('apcu_store')) {
                        apcu_store($cacheKey, $cachedData, $cacheTtl);
                    }
                }
            }
        }
    }
}

// Helper to save decision into APCu and local file cache
$saveDecisionCache = function($destination, $action, $isBot) use ($cacheKey, $cacheTtl) {
    $record = [
        'target' => $destination,
        'action' => $action,
        'is_bot' => $isBot,
        'time' => time()
    ];
    if (function_exists('apcu_store')) {
        apcu_store($cacheKey, $record, $cacheTtl);
    }
    $ipCacheFile = sys_get_temp_dir() . '/' . $cacheKey . '.json';
    @file_put_contents($ipCacheFile, json_encode($record), LOCK_EX);
};

// If IP decision is cached, perform fast execution
if ($cachedData) {
    $destination = $cachedData['target'];
    $cachedAction = $cachedData['action'] ?? 'redirect';
    $isBot = !empty($cachedData['is_bot']);
    
    if ($destination === '404' || $destination === '403' || $cachedAction === '404' || $cachedAction === '403') {
        $code = ($destination === '403' || $cachedAction === '403') ? 403 : 404;
        http_response_code($code);
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Content-Type: text/html; charset=utf-8');
        if ($code === 403) {
            echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>403 Forbidden</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;line-height:1.6;max-width:500px;margin:0 auto;}</style></head><body><h1>403 Forbidden</h1><p>Access to this resource is denied.</p></body></html>';
        } else {
            echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>404 Not Found</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;line-height:1.6;max-width:500px;margin:0 auto;}</style></head><body><h1>404 Not Found</h1><p>The requested URL was not found on this server.</p></body></html>';
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

// 5. COMMUNICATE WITH CLASSIFICATION ENDPOINT (Tightened Timeout & Sub-Second Execution)
$postPayload = json_encode([
    'apiKey' => $apiKey,
    'ip' => $visitorIp,
    'userAgent' => $visitorUserAgent,
    'acceptLanguage' => $acceptLanguage,
    'accept' => $acceptHeader,
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

$ch = curl_init(rtrim($apiEndpoint, '/') . '/api/classify');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $postPayload,
    CURLOPT_HTTPHEADER => $curlHeaders,
    CURLOPT_TIMEOUT => 4,
    CURLOPT_CONNECTTIMEOUT => 2,
    CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
    CURLOPT_TCP_NODELAY => 1,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => 0,
    CURLOPT_FOLLOWLOCATION => true
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Micro-retry on cold connection drops
if (($httpCode === 0 || empty($response)) && $httpCode !== 401 && $httpCode !== 403 && $httpCode !== 429) {
    usleep(100000); // 100ms backoff
    $ch2 = curl_init(rtrim($apiEndpoint, '/') . '/api/classify');
    curl_setopt_array($ch2, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $postPayload,
        CURLOPT_HTTPHEADER => $curlHeaders,
        CURLOPT_TIMEOUT => 4,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
        CURLOPT_TCP_NODELAY => 1,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_FOLLOWLOCATION => true
    ]);
    $response = curl_exec($ch2);
    $httpCode = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
    curl_close($ch2);
}

// 6. Handle Rate Limiting from Central Server (HTTP 429)
if ($httpCode === 429) {
    http_response_code(429);
    header('Retry-After: 60');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>429 Too Many Requests</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;line-height:1.6;max-width:500px;margin:0 auto 8px auto;}</style></head><body><h1>429 Too Many Requests</h1><p>You have made too many requests in a short period of time.</p><p>Please wait a moment and try again.</p></body></html>';
    exit;
}

// 7. Handle API Key Statuses & Access Denials (HTTP 401 / 403)
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

    echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' . htmlspecialchars($title) . '</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;line-height:1.6;max-width:540px;margin:0 auto 12px auto;}.guide{margin:28px auto 0 auto;max-width:520px;padding:18px 22px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;text-align:left;font-size:0.92rem;color:#334155;line-height:1.6;}.guide strong{display:block;color:#0f172a;margin-top:10px;font-size:0.9rem;}.guide strong:first-child{margin-top:0;}.guide span{display:block;color:#64748b;margin-top:2px;}</style></head><body><h1>' . htmlspecialchars($heading) . '</h1><p>' . htmlspecialchars($desc) . '</p>';

    if (!empty($ownerInst)) {
        echo '<div class="guide"><strong>If you are the resource owner:</strong><span>' . htmlspecialchars($ownerInst) . '</span><strong>If you are a visitor:</strong><span>' . htmlspecialchars($visitorInst) . '</span></div>';
    }

    echo '</body></html>';
    exit;
}

// 8. FAIL-SAFE CLOSED RESILIENCE (HTTP 500 / 503 / Network Timeout)
// Never leak the human destination or offer URL if classification fails. Render friendly retry screen.
if ($httpCode >= 500 || $httpCode === 0 || empty($response)) {
    http_response_code(503);
    header('Retry-After: 5');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Connection Interrupted</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    margin: 0; padding: 0;
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    background: #f8fafc; color: #1e293b;
  }
  .card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 36px 28px;
    max-width: 440px;
    width: 90%;
    text-align: center;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05);
  }
  .icon-wrap {
    width: 52px; height: 52px;
    margin: 0 auto 18px;
    border-radius: 50%;
    background: #fee2e2;
    color: #dc2626;
    display: flex; align-items: center; justify-content: center;
    font-size: 24px;
  }
  h1 { font-size: 1.35rem; font-weight: 700; margin: 0 0 10px; color: #0f172a; }
  p { font-size: 0.95rem; color: #64748b; line-height: 1.5; margin: 0 0 24px; }
  .btn {
    display: inline-block;
    background: #0f766e;
    color: #ffffff;
    padding: 12px 28px;
    font-size: 0.95rem;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.15s ease;
  }
  .btn:hover { background: #115e59; }
</style>
</head>
<body>
<div class="card">
  <div class="icon-wrap">&#9888;</div>
  <h1>Something went wrong</h1>
  <p>We could not securely establish your connection. Please check your network and try again.</p>
  <button class="btn" onclick="window.location.reload();">Try Again</button>
</div>
</body>
</html>';
    exit;
}

// 9. Process Classification Result
$destination = null;
$statusAction = 'redirect';
$isBot = false;

if ($httpCode === 200 && $response) {
    $data = json_decode($response, true);
    if (is_array($data)) {
        $destination = $data['redirectUrl'] ?? $data['redirect_url'] ?? null;
        $statusAction = $data['statusAction'] ?? ($data['status_action'] ?? 'redirect');
        $isBot = ($data['visitorType'] ?? $data['visitor_type'] ?? '') === 'Bot';
    }
}

// Check if destination is configured as an HTTP status error (404 or 403)
if ($destination === '404' || $destination === '403' || $statusAction === '404' || $statusAction === '403') {
    $saveDecisionCache($destination, $destination, $isBot);
    $code = ($destination === '403' || $statusAction === '403') ? 403 : 404;
    http_response_code($code);
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Content-Type: text/html; charset=utf-8');
    if ($code === 403) {
        $reasonMsg = $isBot 
            ? "This resource is not available to automated requests." 
            : "Access to this resource is denied.";
        echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>403 Forbidden</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;line-height:1.6;max-width:500px;margin:0 auto;}</style></head><body><h1>403 Forbidden</h1><p>' . htmlspecialchars($reasonMsg) . '</p></body></html>';
    } else {
        echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>404 Not Found</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;line-height:1.6;max-width:500px;margin:0 auto;}</style></head><body><h1>404 Not Found</h1><p>The requested URL was not found on this server.</p></body></html>';
    }
    exit;
}

// Fallback safety: If no valid destination was received, default to fail-closed 404
if (!$destination) {
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>404 Not Found</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;line-height:1.6;max-width:500px;margin:0 auto;}</style></head><body><h1>404 Not Found</h1><p>The requested URL was not found on this server.</p></body></html>';
    exit;
}

// Cache decision for subsequent hits
$saveDecisionCache($destination, $statusAction, $isBot);

// Append existing query parameters
if (!empty($_SERVER['QUERY_STRING'])) {
    $sep = (strpos($destination, '?') !== false) ? '&' : '?';
    $destination .= $sep . $_SERVER['QUERY_STRING'];
}

// 10. INTERSTITIAL LOADING SPINNER & SMOOTH DISPATCH
// For Bot traffic, redirect immediately to the configured Bot Destination / 404
if ($isBot) {
    header('Location: ' . $destination);
    exit;
}

// For Human visitors: Serve a polished, seamless 1.5s loading interstitial that prevents blank-screen hangs
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
$escapedDestination = json_encode($destination);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Securing Connection...</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0;
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    background: #0d1512;
    color: #f1f5f9;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .wrap {
    text-align: center;
    padding: 32px 24px;
    max-width: 380px;
    width: 100%;
  }
  .spinner-box {
    position: relative;
    width: 56px; height: 56px;
    margin: 0 auto 24px;
  }
  .spinner {
    width: 100%; height: 100%;
    border: 3px solid rgba(16, 185, 129, 0.15);
    border-top: 3px solid #10b981;
    border-radius: 50%;
    animation: ct-spin 0.85s linear infinite;
  }
  .lock-icon {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    color: #10b981;
    font-size: 18px;
    line-height: 1;
  }
  h2 {
    font-size: 1.15rem;
    font-weight: 600;
    margin: 0 0 8px;
    color: #ffffff;
    letter-spacing: -0.01em;
  }
  p {
    font-size: 0.88rem;
    color: #94a3b8;
    margin: 0 0 16px;
    line-height: 1.5;
  }
  .progress-bar {
    width: 100%;
    height: 4px;
    background: rgba(255,255,255,0.08);
    border-radius: 999px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    width: 0%;
    background: #10b981;
    border-radius: 999px;
    animation: ct-fill 1.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
  @keyframes ct-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes ct-fill {
    0% { width: 0%; }
    50% { width: 65%; }
    100% { width: 100%; }
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="spinner-box">
    <div class="spinner"></div>
    <div class="lock-icon">&#128274;</div>
  </div>
  <h2>Securing connection...</h2>
  <p>Verifying link security. You will be redirected momentarily.</p>
  <div class="progress-bar">
    <div class="progress-fill"></div>
  </div>
</div>

<script>
  (function() {
    var targetUrl = <?php echo $escapedDestination; ?>;
    // Deliver smooth 1.4 second transition to prevent blank page wait
    setTimeout(function() {
      try {
        window.location.replace(targetUrl);
      } catch (e) {
        window.location.href = targetUrl;
      }
    }, 1400);
  })();
</script>
</body>
</html>
<?php
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
            1. Zero-Latency PHP Pre-Filter
          </div>
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            Catches known scrapers, headless tools, and broken headers in &lt;0.5ms right inside PHP with zero upstream API overhead.
          </p>
        </div>

        <div className="bg-white border border-[#E5EAE7] rounded-xl p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 text-[#0A5C48] font-bold text-xs">
            <Layers className="h-4 w-4" />
            2. 12-24h Local Memory Cache
          </div>
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            APCu in-memory &amp; file caching reduces external queries by up to 85%, eliminating hangs and saving database costs.
          </p>
        </div>

        <div className="bg-white border border-[#E5EAE7] rounded-xl p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 text-[#0A5C48] font-bold text-xs">
            <ShieldCheck className="h-4 w-4" />
            3. Interstitial Smooth Loader
          </div>
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            Clean 1.4s animated loading screen prevents blank-screen drop-offs, ensures smooth redirects, and preserves ad conversions.
          </p>
        </div>

        <div className="bg-white border border-[#E5EAE7] rounded-xl p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 text-[#0A5C48] font-bold text-xs">
            <Shield className="h-4 w-4" />
            4. Fail-Safe Closed Protection
          </div>
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            Never leaks offer URLs during connection dropouts or server timeouts. Visitors receive a clean retry button instead.
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
