/**
 * Generates the production PHP integration script with the "Loading state first" architecture.
 *
 * Sequence:
 * 1. Visitor opens PHP link -> Immediately returns HTTP 200 Loading & Verification page (<1ms).
 * 2. Background verification -> Executes full visitor security checks (IP, headers, telemetry,
 *    threat intelligence, VPN/proxy, device/geo routing) via /api/classify.
 * 3. Log & Classify -> Result recorded in traffic logs and broadcasted to client dashboard.
 * 4. Client Rule Enforcement -> Applies configured custom redirect URL or HTTP 404/403 status.
 */
export function generatePhpIntegrationCode(apiKeyValue: string | null, effectiveEndpoint: string): string {
  const key = apiKeyValue || 'ctc_your_api_key_here';
  const endpoint = effectiveEndpoint || window.location.origin;

  return `<?php
/**
 * CleanTraffic - High-Performance Bot Defense & Traffic Acceleration Integration Script
 * Auto-generated for API Key: ${key}
 *
 * ARCHITECTURE & EXECUTION FLOW:
 * 1. Immediate Loading Presentation: Returns an instant HTTP 200 verification page to the visitor in <1ms.
 *    Eliminates blank-screen hangs, bounce drops, and avoids premature error messages.
 * 2. Asynchronous Background Verification: Runs the full visitor-detection and threat classification
 *    pipeline in the background while the visitor views the loading state.
 * 3. Central Rule Evaluation: Evaluates client-configured routing policies (Human Offer URL,
 *    Bot Destination, or HTTP 404 / 403 status deflection) strictly AFTER verification completes.
 * 4. High-Speed Decision Cache: Caches verified decisions (APCu / local temp storage) to optimize repeat hits.
 */
session_start();

$apiKey = '${key}';
$apiEndpoint = '${endpoint}';

// ============================================================================
// PHASE A: SERVE CONFIGURED HTTP STATUS CODE RESPONSES (404 / 403 / 429)
// ============================================================================
if (isset($_GET['ctc_res'])) {
    $resCode = $_GET['ctc_res'];
    if ($resCode === '404') {
        http_response_code(404);
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Content-Type: text/html; charset=utf-8');
        echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>404 Not Found</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;line-height:1.6;max-width:500px;margin:0 auto;}</style></head><body><h1>404 Not Found</h1><p>The requested URL was not found on this server.</p></body></html>';
        exit;
    }
    if ($resCode === '403') {
        http_response_code(403);
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Content-Type: text/html; charset=utf-8');
        echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>403 Forbidden</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:60px 20px;text-align:center;background:#fff;color:#1e293b;}h1{font-size:2rem;font-weight:700;margin-bottom:8px;color:#0f172a;}p{color:#64748b;font-size:1rem;line-height:1.6;max-width:500px;margin:0 auto;}</style></head><body><h1>403 Forbidden</h1><p>Access to this resource is denied.</p></body></html>';
        exit;
    }
}

// ============================================================================
// PHASE B: BACKGROUND VERIFICATION HANDLER (Runs while visitor sees loading state)
// ============================================================================
$isVerifyRequest = isset($_GET['ctc_verify']) || isset($_POST['ctc_verify']) || 
    (isset($_SERVER['HTTP_X_CTC_VERIFY']) && $_SERVER['HTTP_X_CTC_VERIFY'] === '1');

if ($isVerifyRequest) {
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

    // 2. High-Frequency Visitor Velocity Rate Limiting (8 requests / 10 seconds per IP)
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
    if ($totalRecentHits >= 8) {
        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'action' => '429',
            'destination' => '429',
            'visitorType' => 'Bot'
        ]);
        exit;
    }

    // 3. Parse Client Telemetry & Browser Headers
    $visitorUserAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $acceptHeader = $_SERVER['HTTP_ACCEPT'] ?? '';
    $acceptLanguage = $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '';

    $rawPost = @file_get_contents('php://input');
    $postData = $rawPost ? @json_decode($rawPost, true) : [];
    if (!is_array($postData)) {
        $postData = [];
    }

    $clientReferrer = $postData['referrer'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
    $clientQuery = $postData['queryString'] ?? ($_SERVER['QUERY_STRING'] ?? '');

    // Extract email from query string if present
    $email = null;
    if (!empty($clientQuery)) {
        parse_str(ltrim($clientQuery, '?'), $queryMap);
        $email = $queryMap['e'] ?? $queryMap['email'] ?? null;
    }

    // 4. Check Fast Local Cache (APCu & File Cache with 12-Hour TTL)
    $cacheKey = 'ctc_ip_' . md5($visitorIp . '_' . $apiKey);
    $skipCache = isset($_GET['nocache']) || isset($_GET['preview_test']);
    $cacheTtl = 43200; // 12 hours
    $cachedData = null;

    if (!$skipCache) {
        if (function_exists('apcu_fetch')) {
            $apcuVal = apcu_fetch($cacheKey);
            if ($apcuVal && is_array($apcuVal) && (time() - $apcuVal['time']) < $cacheTtl) {
                $cachedData = $apcuVal;
            }
        }
        if (!$cachedData) {
            $ipCacheFile = sys_get_temp_dir() . '/' . $cacheKey . '.json';
            if (file_exists($ipCacheFile)) {
                $rawCache = @file_get_contents($ipCacheFile);
                if ($rawCache) {
                    $fileVal = json_decode($rawCache, true);
                    if (is_array($fileVal) && isset($fileVal['time']) && (time() - $fileVal['time']) < $cacheTtl) {
                        $cachedData = $fileVal;
                        if (function_exists('apcu_store')) {
                            apcu_store($cacheKey, $cachedData, $cacheTtl);
                        }
                    }
                }
            }
        }
    }

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

    // If cache hits, apply decision immediately
    if ($cachedData) {
        $destination = $cachedData['target'];
        $action = $cachedData['action'] ?? 'redirect';
        $visitorType = !empty($cachedData['is_bot']) ? 'Bot' : 'Human';

        // Append query string if destination is a URL
        if (!empty($clientQuery) && strpos($destination, 'http') === 0) {
            parse_str(ltrim($clientQuery, '?'), $forwardParams);
            unset($forwardParams['ctc_verify'], $forwardParams['ctc_res'], $forwardParams['ctc_format']);
            $rebuilt = http_build_query($forwardParams);
            if (!empty($rebuilt)) {
                $sep = (strpos($destination, '?') !== false) ? '&' : '?';
                $destination .= $sep . $rebuilt;
            }
        }

        if (isset($_GET['ctc_format']) && $_GET['ctc_format'] === 'html') {
            if ($action === '404' || $destination === '404') {
                http_response_code(404);
                echo '404 Not Found';
                exit;
            }
            if ($action === '403' || $destination === '403') {
                http_response_code(403);
                echo '403 Forbidden';
                exit;
            }
            header('Location: ' . $destination);
            exit;
        }

        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'action' => $action,
            'destination' => $destination,
            'visitorType' => $visitorType
        ]);
        exit;
    }

    // 5. Execute Full Cascading Verification via Central Engine
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
        'referer' => $clientReferrer,
        'email' => $email,
        'queryString' => $clientQuery,
        'telemetry' => [
            'screen' => $postData['screen'] ?? '',
            'timezone' => $postData['timezone'] ?? ''
        ]
    ]);

    $ch = curl_init(rtrim($apiEndpoint, '/') . '/api/classify');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $postPayload,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
            'x-api-key: ' . $apiKey
        ],
        CURLOPT_TIMEOUT => 6,
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

    // 6. Handle Verification Response
    $destination = null;
    $statusAction = 'redirect';
    $visitorType = 'Human';
    $isBot = false;

    if ($httpCode === 200 && $response) {
        $data = json_decode($response, true);
        if (is_array($data)) {
            $destination = $data['redirectUrl'] ?? $data['redirect_url'] ?? $data['destination'] ?? null;
            $statusAction = $data['statusAction'] ?? ($data['status_action'] ?? 'redirect');
            $visitorType = $data['visitorType'] ?? ($data['visitor_type'] ?? 'Human');
            $isBot = ($visitorType === 'Bot');
        }
    }

    // Handle transient upstream network dropouts gracefully without failing hard
    if (!$destination && ($httpCode === 0 || $httpCode >= 500 || !$response)) {
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'retry' => true,
            'message' => 'Verification in progress'
        ]);
        exit;
    }

    // Evaluate client's configured rules (404, 403, or destination URL)
    if ($destination === '404' || $destination === '403' || $statusAction === '404' || $statusAction === '403') {
        $statusAction = ($destination === '403' || $statusAction === '403') ? '403' : '404';
        $destination = $statusAction;
    } else if ($destination && strpos($destination, 'http') === 0 && !empty($clientQuery)) {
        // Forward tracking query parameters
        parse_str(ltrim($clientQuery, '?'), $forwardParams);
        unset($forwardParams['ctc_verify'], $forwardParams['ctc_res'], $forwardParams['ctc_format']);
        $rebuilt = http_build_query($forwardParams);
        if (!empty($rebuilt)) {
            $sep = (strpos($destination, '?') !== false) ? '&' : '?';
            $destination .= $sep . $rebuilt;
        }
    }

    // Fallback if no destination configured
    if (!$destination) {
        $destination = '404';
        $statusAction = '404';
    }

    // Cache the verified decision
    $saveDecisionCache($destination, $statusAction, $isBot);

    // Non-JS crawler fallback handler
    if (isset($_GET['ctc_format']) && $_GET['ctc_format'] === 'html') {
        if ($statusAction === '404') {
            http_response_code(404);
            echo '404 Not Found';
            exit;
        }
        if ($statusAction === '403') {
            http_response_code(403);
            echo '403 Forbidden';
            exit;
        }
        header('Location: ' . $destination);
        exit;
    }

    // Return decision to waiting loading screen
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'action' => $statusAction,
        'destination' => $destination,
        'visitorType' => $visitorType
    ]);
    exit;
}

// ============================================================================
// PHASE C: IMMEDIATE VISITOR LOADING & VERIFICATION PAGE (HTTP 200)
// ============================================================================
// Returns immediately in <1ms. Never hangs or throws premature errors.
http_response_code(200);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
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
    background: #09120e;
    color: #f1f5f9;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .card {
    text-align: center;
    padding: 40px 28px;
    max-width: 400px;
    width: 90%;
    background: rgba(13, 27, 21, 0.85);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 16px;
    box-shadow: 0 20px 40px -15px rgba(0,0,0,0.5);
  }
  .spinner-box {
    position: relative;
    width: 58px; height: 58px;
    margin: 0 auto 22px;
  }
  .spinner {
    width: 100%; height: 100%;
    border: 3px solid rgba(16, 185, 129, 0.15);
    border-top: 3px solid #10b981;
    border-radius: 50%;
    animation: ct-spin 0.85s linear infinite;
  }
  .shield-icon {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    color: #10b981;
    display: flex; align-items: center; justify-content: center;
  }
  .shield-icon svg {
    width: 22px; height: 22px;
    fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
  }
  h1 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 8px;
    color: #ffffff;
    letter-spacing: -0.01em;
  }
  p {
    font-size: 0.88rem;
    color: #94a3b8;
    margin: 0 0 20px;
    line-height: 1.5;
  }
  .progress-wrap {
    width: 100%;
    height: 4px;
    background: rgba(255,255,255,0.08);
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: 8px;
  }
  .progress-bar {
    height: 100%;
    width: 0%;
    background: #10b981;
    border-radius: 999px;
    animation: ct-fill 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }
  .btn-retry {
    display: none;
    margin-top: 16px;
    padding: 10px 24px;
    background: #0f766e;
    color: #ffffff;
    border: none;
    border-radius: 8px;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .btn-retry:hover { background: #115e59; }
  @keyframes ct-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes ct-fill {
    0% { width: 0%; }
    50% { width: 70%; }
    100% { width: 100%; }
  }
</style>
<noscript>
  <meta http-equiv="refresh" content="2;url=?ctc_verify=1&ctc_format=html">
</noscript>
</head>
<body>
<div class="card">
  <div class="spinner-box">
    <div class="spinner"></div>
    <div class="shield-icon">
      <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    </div>
  </div>
  <h1 id="ctc-title">Securing Connection...</h1>
  <p id="ctc-desc">Verifying connection authenticity. You will be redirected momentarily.</p>
  <div class="progress-wrap" id="ctc-pwrap">
    <div class="progress-bar"></div>
  </div>
  <button id="ctc-btn" class="btn-retry" onclick="performVerification(1);">Continue</button>
</div>

<script>
(function() {
  var startTime = Date.now();
  var minDisplayMs = 1200; // Smooth transition duration to prevent visual flicker

  function getVerifyUrl() {
    var loc = window.location;
    var search = loc.search ? loc.search + '&ctc_verify=1' : '?ctc_verify=1';
    return loc.pathname + search;
  }

  window.performVerification = function(attempt) {
    var btn = document.getElementById('ctc-btn');
    var pwrap = document.getElementById('ctc-pwrap');
    if (btn) btn.style.display = 'none';
    if (pwrap) pwrap.style.display = 'block';

    var xhr = new XMLHttpRequest();
    xhr.open('POST', getVerifyUrl(), true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-CTC-Verify', '1');
    xhr.timeout = 7000;

    xhr.onload = function() {
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          if (data && data.success) {
            applyDecision(data);
            return;
          }
        } catch (e) {}
      }
      handleRetry(attempt);
    };

    xhr.onerror = function() { handleRetry(attempt); };
    xhr.ontimeout = function() { handleRetry(attempt); };

    var payload = {
      screen: window.screen ? (window.screen.width + 'x' + window.screen.height) : '',
      timezone: (Intl && Intl.DateTimeFormat) ? Intl.DateTimeFormat().resolvedOptions().timeZone : '',
      referrer: document.referrer || '',
      queryString: window.location.search || ''
    };
    xhr.send(JSON.stringify(payload));
  };

  function handleRetry(attempt) {
    if (attempt < 2) {
      setTimeout(function() { window.performVerification(attempt + 1); }, 600);
    } else {
      // Graceful fallback without alarming errors
      var pwrap = document.getElementById('ctc-pwrap');
      var desc = document.getElementById('ctc-desc');
      var btn = document.getElementById('ctc-btn');
      if (pwrap) pwrap.style.display = 'none';
      if (desc) desc.textContent = 'Connection check completed. Click continue to proceed.';
      if (btn) btn.style.display = 'inline-block';
    }
  }

  function applyDecision(data) {
    var elapsed = Date.now() - startTime;
    var delay = Math.max(0, minDisplayMs - elapsed);

    setTimeout(function() {
      // Apply client-configured 404 response
      if (data.action === '404' || data.destination === '404') {
        var sep = window.location.search ? '&' : '?';
        window.location.replace(window.location.pathname + window.location.search + sep + 'ctc_res=404');
        return;
      }

      // Apply client-configured 403 response
      if (data.action === '403' || data.destination === '403') {
        var sep = window.location.search ? '&' : '?';
        window.location.replace(window.location.pathname + window.location.search + sep + 'ctc_res=403');
        return;
      }

      // Apply configured destination URL redirect
      if (data.destination && data.destination !== '404' && data.destination !== '403') {
        try {
          window.location.replace(data.destination);
        } catch (e) {
          window.location.href = data.destination;
        }
        return;
      }

      // Safe fallback
      var sep = window.location.search ? '&' : '?';
      window.location.replace(window.location.pathname + window.location.search + sep + 'ctc_res=404');
    }, delay);
  }

  // Initiate background verification immediately
  window.performVerification(1);
})();
</script>
</body>
</html>
<?php
exit;
`;
}
