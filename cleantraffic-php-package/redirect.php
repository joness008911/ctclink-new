<?php
/**
 * CleanTraffic PHP Protection - Redirect Engine
 * 
 * Advanced visitor classification and redirection system
 * Integrates with CleanTraffic API for accurate bot detection
 * 
 * Features:
 * - Anti-crawling protection
 * - Real-time visitor classification
 * - Automatic redirection based on visitor type
 * - Comprehensive logging
 */

// Start session for potential admin logging
session_start();

// SECURITY: Prevent any preview generation or crawling
header('X-Robots-Tag: noindex, nofollow, nosnippet, noarchive, noimageindex');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

// Configuration - Dynamic path detection for root OR subfolder installation
$BASE_DIR = dirname($_SERVER['SCRIPT_FILENAME']);
$CLEANTRAFFIC_API_ENDPOINT = 'https://davidnmarx.com/api/classify';
$DEFAULT_BOT_URL = 'https://google.com';
$DEFAULT_HUMAN_URL = 'https://example.com';
$VISITORS_FILE = $BASE_DIR . '/visitors.json';
$REDIRECT_URL_FILE = $BASE_DIR . '/redirect_url.txt';
$BOT_URL_FILE = $BASE_DIR . '/bot_url.txt';
$API_KEY_FILE = $BASE_DIR . '/api_key.txt';
$BOT_RATE_LIMIT_FILE = $BASE_DIR . '/bot_rate_limit.json';
$MAX_RETRIES = 1;  // Reduced for faster performance

// Advanced bot rate limiting configuration
$BOT_RATE_LIMIT_HITS = 2; // Max hits before silent redirect (stricter for bots)
$BOT_RATE_LIMIT_WINDOW = 30; // Initial detection window in seconds
$BOT_BLOCK_DURATION = 3600; // 1-hour blocking duration for confirmed bots
$HUMAN_RATE_LIMIT_HITS = 10; // Much higher threshold for humans (never block legitimate users)
$HUMAN_RATE_LIMIT_WINDOW = 60; // Human protection window

// Pool of thousands of random URLs for bot redirection
$RANDOM_BOT_URLS = [
    // Popular websites
    'https://wikipedia.org', 'https://reddit.com', 'https://stackoverflow.com', 'https://github.com',
    'https://youtube.com', 'https://amazon.com', 'https://twitter.com', 'https://instagram.com',
    'https://linkedin.com', 'https://tiktok.com', 'https://netflix.com', 'https://spotify.com',
    'https://discord.com', 'https://twitch.tv', 'https://pinterest.com', 'https://snapchat.com',
    
    // Search engines & results
    'https://google.com/search?q=technology+news', 'https://bing.com/search?q=weather+today',
    'https://duckduckgo.com/?q=cooking+recipes', 'https://yahoo.com/search?p=sports+updates',
    'https://google.com/search?q=travel+destinations', 'https://bing.com/search?q=health+tips',
    'https://google.com/search?q=business+trends', 'https://duckduckgo.com/?q=education+resources',
    
    // News & media sites
    'https://cnn.com', 'https://bbc.com', 'https://reuters.com', 'https://bloomberg.com',
    'https://techcrunch.com', 'https://theverge.com', 'https://wired.com', 'https://mashable.com',
    'https://engadget.com', 'https://ars-technica.com', 'https://zdnet.com', 'https://cnet.com',
    
    // Educational & reference
    'https://khan-academy.org', 'https://coursera.org', 'https://edx.org', 'https://udemy.com',
    'https://duolingo.com', 'https://quora.com', 'https://medium.com', 'https://wordpress.com',
    
    // Shopping & commerce
    'https://ebay.com', 'https://etsy.com', 'https://alibaba.com', 'https://shopify.com',
    'https://walmart.com', 'https://target.com', 'https://bestbuy.com', 'https://homedepot.com',
    
    // Search variations with random topics
    'https://google.com/search?q=artificial+intelligence', 'https://google.com/search?q=climate+change',
    'https://google.com/search?q=space+exploration', 'https://google.com/search?q=renewable+energy',
    'https://google.com/search?q=digital+marketing', 'https://google.com/search?q=cryptocurrency',
    'https://google.com/search?q=machine+learning', 'https://google.com/search?q=web+development',
    'https://google.com/search?q=mobile+apps', 'https://google.com/search?q=cloud+computing',
    
    // More diverse sites
    'https://stackexchange.com', 'https://archive.org', 'https://mozilla.org', 'https://apache.org',
    'https://w3.org', 'https://ietf.org', 'https://ieee.org', 'https://acm.org',
    'https://nature.com', 'https://science.org', 'https://nationalgeographic.com', 'https://smithsonian.com'
];

// ANTI-CRAWLING: Immediate bot detection for obvious social media crawlers only
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$obviousBots = [
    // Social media crawlers
    'TelegramBot', 'facebookexternalhit', 'Twitterbot', 'WhatsApp',
    'LinkedInBot', 'SkypeUriPreview', 'SlackBot', 'DiscordBot',
    
    // Search engines (block ALL search engine crawling)
    'Googlebot', 'Bingbot', 'Slurp', 'YahooSeeker', 'DuckDuckBot',
    'Baiduspider', 'YandexBot', 'SogouSpider', 'facebot', 'ia_archiver',
    
    // Other known crawlers and bots
    'MJ12bot', 'DotBot', 'AhrefsBot', 'SemrushBot', 'MajesticSEO',
    'BLEXBot', 'UptimeRobot', 'StatusCake', 'GTmetrix', 'PageSpeed',
    'applebot', 'CCBot', 'ChatGPT', 'GPTBot', 'Claude-Web'
];

// Block ALL known crawlers, bots, and search engines for maximum stealth
foreach ($obviousBots as $bot) {
    if (stripos($userAgent, $bot) !== false) {
        // Immediate redirect to random bot URL
        $randomBotUrl = getRandomBotUrl();
        header('Location: ' . $randomBotUrl, true, 301);
        exit();
    }
}

/**
 * Extract visitor's real IP address using multiple fallback methods
 */
function getVisitorIP() {
    $headers = [
        'HTTP_CF_CONNECTING_IP',     // Cloudflare
        'HTTP_X_FORWARDED_FOR',      // Load balancer/proxy
        'HTTP_X_FORWARDED',          // Proxy
        'HTTP_X_CLUSTER_CLIENT_IP',  // Cluster
        'HTTP_CLIENT_IP',            // Proxy
        'HTTP_FORWARDED_FOR',        // Proxy
        'HTTP_FORWARDED',            // Proxy
        'REMOTE_ADDR'                // Direct connection
    ];
    
    foreach ($headers as $header) {
        if (!empty($_SERVER[$header])) {
            $ips = explode(',', $_SERVER[$header]);
            $ip = trim($ips[0]);
            
            // Validate IP address
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return $ip;
            }
        }
    }
    
    // Fallback to REMOTE_ADDR even if private
    return $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
}

/**
 * Parse and validate behavioral data from client-side detection
 */
function parseBehavioralData($rawData) {
    if (empty($rawData)) {
        return [
            'botScore' => 50, // Neutral score if no data
            'isBot' => false,
            'behaviorAnalyzed' => false,
            'reason' => 'No behavioral data provided'
        ];
    }
    
    $data = json_decode($rawData, true);
    if (!$data) {
        return [
            'botScore' => 60, // Slightly suspicious if invalid data
            'isBot' => false,
            'behaviorAnalyzed' => false,
            'reason' => 'Invalid behavioral data format'
        ];
    }
    
    // Validate and sanitize behavioral data
    return [
        'botScore' => max(0, min(100, intval($data['botScore'] ?? 50))),
        'isBot' => (bool)($data['isBot'] ?? false),
        'mouseMovements' => max(0, intval($data['mouseMovements'] ?? 0)),
        'keystrokes' => max(0, intval($data['keystrokes'] ?? 0)),
        'scrollEvents' => max(0, intval($data['scrollEvents'] ?? 0)),
        'totalInteractions' => max(0, intval($data['totalInteractions'] ?? 0)),
        'suspiciousActivities' => max(0, intval($data['suspiciousActivities'] ?? 0)),
        'browserFingerprint' => $data['browserFingerprint'] ?? [],
        'behaviorAnalyzed' => true,
        'reason' => 'Behavioral analysis completed'
    ];
}

/**
 * Quick header-based behavioral analysis (instant, no delays)
 */
function analyzeVisitorWithBehavior($userAgent, $behavioralData) {
    $uaAnalysis = analyzeUserAgent($userAgent);
    $botScore = 50; // Neutral starting score
    
    // Header-based bot detection (instant)
    if (empty($behavioralData['acceptLanguage'])) {
        $botScore += 15; // Missing Accept-Language header
    }
    
    if (empty($behavioralData['acceptEncoding'])) {
        $botScore += 10; // Missing Accept-Encoding header
    }
    
    if (!$behavioralData['hasReferrer'] && $behavioralData['requestMethod'] === 'GET') {
        $botScore += 5; // Direct access without referrer
    }
    
    // User agent analysis boost
    if ($uaAnalysis['isBot']) {
        $botScore += 25; // Suspicious user agent
    }
    
    // Check for minimal headers (bot pattern)
    $headerCount = 0;
    foreach (['HTTP_ACCEPT', 'HTTP_ACCEPT_LANGUAGE', 'HTTP_ACCEPT_ENCODING', 'HTTP_CACHE_CONTROL'] as $header) {
        if (!empty($_SERVER[$header])) $headerCount++;
    }
    
    if ($headerCount < 2) {
        $botScore += 20; // Too few headers
    }
    
    return [
        'botScore' => min(100, $botScore),
        'isBot' => $botScore > 70,
        'reason' => 'Header-based + User-Agent analysis',
        'browser' => $uaAnalysis['browser'],
        'device' => $uaAnalysis['device'],
        'headerCount' => $headerCount
    ];
}

/**
 * Local bot detection using User-Agent analysis
 */
function analyzeUserAgent($userAgent) {
    $userAgent = strtolower($userAgent);
    
    // Browser detection
    $browser = 'Unknown';
    if (strpos($userAgent, 'chrome') !== false && strpos($userAgent, 'edg') === false) {
        $browser = 'Chrome';
    } elseif (strpos($userAgent, 'firefox') !== false) {
        $browser = 'Firefox';
    } elseif (strpos($userAgent, 'safari') !== false && strpos($userAgent, 'chrome') === false) {
        $browser = 'Safari';
    } elseif (strpos($userAgent, 'edg') !== false) {
        $browser = 'Edge';
    } elseif (strpos($userAgent, 'trident') !== false || strpos($userAgent, 'msie') !== false) {
        $browser = 'Internet Explorer';
    }
    
    // Device type detection
    $device = 'Unknown';
    if (strpos($userAgent, 'mobile') !== false || strpos($userAgent, 'android') !== false || 
        strpos($userAgent, 'iphone') !== false || strpos($userAgent, 'ipad') !== false) {
        $device = 'Mobile';
    } elseif (strpos($userAgent, 'windows') !== false || strpos($userAgent, 'macintosh') !== false || 
             strpos($userAgent, 'linux') !== false) {
        $device = 'Desktop';
    }
    
    // Bot detection logic
    $isBot = ($browser === 'Unknown' || $device === 'Unknown');
    
    return [
        'browser' => $browser,
        'device' => $device,
        'isBot' => $isBot
    ];
}

/**
 * Classify visitor using CleanTraffic API with enhanced behavioral data
 */
function classifyVisitorAPI($ip, $userAgent, $behavioralData = null, $enhancedAnalysis = null) {
    global $CLEANTRAFFIC_API_ENDPOINT, $API_KEY_FILE, $MAX_RETRIES;
    
    // Force fresh file reads by clearing any PHP file cache
    if (function_exists('opcache_invalidate')) {
        @opcache_invalidate($API_KEY_FILE, true);
    }
    
    // Check if API key file exists
    if (!file_exists($API_KEY_FILE)) {
        return [
            'error' => true,
            'error_message' => 'API key not configured',
            'visitor_type' => 'bot',
            'location' => 'Unknown',
            'browser' => 'Unknown',
            'device_type' => 'Unknown',
            'isp' => 'Unknown'
        ];
    }
    
    // Clear any file cache to ensure fresh API key read
    clearstatcache(true, $API_KEY_FILE);
    $apiKey = trim(file_get_contents($API_KEY_FILE));
    if (empty($apiKey)) {
        return [
            'error' => true,
            'error_message' => 'API key is empty',
            'visitor_type' => 'bot',
            'location' => 'Unknown',
            'browser' => 'Unknown',
            'device_type' => 'Unknown',
            'isp' => 'Unknown'
        ];
    }
    
    // Build POST data with visitor information (original API format)
    $postData = [
        'api_key' => $apiKey,
        'ip' => $ip,
        'user_agent' => $userAgent
    ];
    
    for ($attempt = 1; $attempt <= $MAX_RETRIES; $attempt++) {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $CLEANTRAFFIC_API_ENDPOINT,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,  // Use POST method for original API
            CURLOPT_POSTFIELDS => http_build_query($postData),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/x-www-form-urlencoded',
                'Accept: application/json',
                'Cache-Control: no-cache'
            ],
            CURLOPT_TIMEOUT => 2,  // Reduced timeout for performance
            CURLOPT_CONNECTTIMEOUT => 1,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_MAXREDIRS => 0
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($response !== false && $httpCode === 200) {
            $result = json_decode($response, true);
            if ($result && isset($result['visitor_type'])) {
                return $result;
            }
        }
        
        // Handle specific error codes
        if ($httpCode === 401) {
            return [
                'error' => true,
                'error_message' => 'Invalid or expired API key',
                'visitor_type' => 'bot',
                'location' => 'Unknown',
                'browser' => 'Unknown',
                'device_type' => 'Unknown',
                'isp' => 'Unknown'
            ];
        }
        
        if ($httpCode === 403) {
            return [
                'error' => true,
                'error_message' => 'API key disabled or quota exceeded',
                'visitor_type' => 'bot',
                'location' => 'Unknown',
                'browser' => 'Unknown',
                'device_type' => 'Unknown',
                'isp' => 'Unknown'
            ];
        }
        
        if ($httpCode === 429) {
            return [
                'error' => true,
                'error_message' => 'API key paused or rate limit exceeded',
                'visitor_type' => 'bot',
                'location' => 'Unknown',
                'browser' => 'Unknown',
                'device_type' => 'Unknown',
                'isp' => 'Unknown'
            ];
        }
        
        // If this is the last attempt or a non-retriable error, break
        if ($attempt === $MAX_RETRIES || $httpCode === 401 || $httpCode === 403 || $httpCode === 429) {
            break;
        }
        
        // Wait before retry (shorter for faster response)
        usleep(50000); // 0.05 second
    }
    
    // If all attempts failed, use fast local detection instead of logging "Unknown"
    return performFastLocalDetection($userAgent, $ip);
}

/**
 * Get random bot URL from the pool
 */
function getRandomBotUrl() {
    global $RANDOM_BOT_URLS, $BOT_URL_FILE, $DEFAULT_BOT_URL;
    
    // Use configured bot URL if available, otherwise random from pool
    if (file_exists($BOT_URL_FILE)) {
        $configuredBotUrl = trim(file_get_contents($BOT_URL_FILE));
        if (!empty($configuredBotUrl) && $configuredBotUrl !== $DEFAULT_BOT_URL) {
            return $configuredBotUrl; // Use admin-configured URL
        }
    }
    
    // Return random URL from pool
    return $RANDOM_BOT_URLS[array_rand($RANDOM_BOT_URLS)];
}

/**
 * Advanced rate limiting: Check if IP is blocked (bots only, never humans)
 */
function isIpBlocked($ip, $isLikelyHuman = false) {
    global $BOT_RATE_LIMIT_FILE, $BOT_RATE_LIMIT_HITS, $BOT_RATE_LIMIT_WINDOW, $BOT_BLOCK_DURATION, $HUMAN_RATE_LIMIT_HITS, $HUMAN_RATE_LIMIT_WINDOW;
    
    $currentTime = time();
    $rateLimitData = [];
    
    // Load existing rate limit data
    if (file_exists($BOT_RATE_LIMIT_FILE)) {
        $content = file_get_contents($BOT_RATE_LIMIT_FILE);
        if ($content) {
            $decodedData = json_decode($content, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decodedData)) {
                $rateLimitData = $decodedData;
            }
        }
    }
    
    // Clean old entries (older than rate limit window)
    $cleanedData = [];
    foreach ($rateLimitData as $recordedIp => $timestamps) {
        // Ensure timestamps is an array (fix for corrupted data)
        if (!is_array($timestamps)) {
            continue; // Skip corrupted entries
        }
        
        $recentTimestamps = array_filter($timestamps, function($timestamp) use ($currentTime) {
            global $BOT_RATE_LIMIT_WINDOW;
            return ($currentTime - $timestamp) <= $BOT_RATE_LIMIT_WINDOW;
        });
        
        if (!empty($recentTimestamps)) {
            $cleanedData[$recordedIp] = array_values($recentTimestamps);
        }
    }
    
    // Check for existing blocking status (1-hour blocks)
    $blockedData = [];
    if (isset($cleanedData[$ip . '_blocked'])) {
        $blockTime = $cleanedData[$ip . '_blocked'];
        if (($currentTime - $blockTime) < $BOT_BLOCK_DURATION) {
            return ['blocked' => true, 'reason' => 'Confirmed bot - 1 hour block active'];
        } else {
            // Block expired, remove it
            unset($cleanedData[$ip . '_blocked']);
        }
    }
    
    // Determine rate limits based on visitor type
    $maxHits = $isLikelyHuman ? $HUMAN_RATE_LIMIT_HITS : $BOT_RATE_LIMIT_HITS;
    $window = $isLikelyHuman ? $HUMAN_RATE_LIMIT_WINDOW : $BOT_RATE_LIMIT_WINDOW;
    
    // Count recent visits within appropriate window
    $recentVisits = [];
    if (isset($cleanedData[$ip])) {
        foreach ($cleanedData[$ip] as $timestamp) {
            if (($currentTime - $timestamp) <= $window) {
                $recentVisits[] = $timestamp;
            }
        }
    }
    
    $visitCount = count($recentVisits);
    
    // For humans: Use very high threshold, never block legitimate users
    if ($isLikelyHuman) {
        if ($visitCount >= $maxHits) {
            // Even if human exceeds limit, don't block - just log for monitoring
            error_log("High traffic from likely human IP: $ip ($visitCount visits)");
        }
        // Record visit but never block humans
        $cleanedData[$ip][] = $currentTime;
        file_put_contents($BOT_RATE_LIMIT_FILE, json_encode($cleanedData));
        return ['blocked' => false, 'reason' => 'Human traffic - never blocked'];
    }
    
    // For bots: Apply strict rate limiting
    if ($visitCount >= $maxHits) {
        // Block this IP for 1 hour
        $cleanedData[$ip . '_blocked'] = $currentTime;
        $cleanedData[$ip][] = $currentTime; // Record the triggering visit
        file_put_contents($BOT_RATE_LIMIT_FILE, json_encode($cleanedData));
        return ['blocked' => true, 'reason' => 'Bot rate limit exceeded - 1 hour block activated'];
    }
    
    // Record visit for bot tracking
    if (!isset($cleanedData[$ip])) {
        $cleanedData[$ip] = [];
    }
    $cleanedData[$ip][] = $currentTime;
    
    // Save updated rate limit data
    file_put_contents($BOT_RATE_LIMIT_FILE, json_encode($cleanedData));
    
    return ['blocked' => false, 'reason' => 'Within rate limits'];
}

/**
 * Advanced human detection to prevent false positives
 */
function isLikelyHuman($userAgent, $headers) {
    $userAgentLower = strtolower($userAgent);
    
    // Strong human indicators
    $humanBrowsers = ['chrome', 'firefox', 'safari', 'edge', 'opera'];
    $hasHumanBrowser = false;
    foreach ($humanBrowsers as $browser) {
        if (strpos($userAgentLower, $browser) !== false) {
            $hasHumanBrowser = true;
            break;
        }
    }
    
    // Check for human-typical headers
    $humanHeaders = [
        'accept-language' => !empty($headers['HTTP_ACCEPT_LANGUAGE']),
        'accept-encoding' => !empty($headers['HTTP_ACCEPT_ENCODING']),
        'accept' => !empty($headers['HTTP_ACCEPT']),
        'dnt' => !empty($headers['HTTP_DNT']), // Do Not Track
        'cache-control' => !empty($headers['HTTP_CACHE_CONTROL'])
    ];
    
    $humanHeaderCount = array_sum($humanHeaders);
    
    // Mobile device indicators (humans)
    $isMobile = (strpos($userAgentLower, 'mobile') !== false || 
                strpos($userAgentLower, 'android') !== false || 
                strpos($userAgentLower, 'iphone') !== false);
    
    // Bot indicators (exclude these from human classification)
    $botPatterns = ['bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 
                   'python', 'java', 'php', 'ruby', 'perl', 'go-http', 
                   'nodejs', 'axios', 'postman', 'headless'];
    
    $hasBotPattern = false;
    foreach ($botPatterns as $pattern) {
        if (strpos($userAgentLower, $pattern) !== false) {
            $hasBotPattern = true;
            break;
        }
    }
    
    // Human scoring system
    $humanScore = 0;
    if ($hasHumanBrowser && !$hasBotPattern) $humanScore += 40;
    if ($humanHeaderCount >= 3) $humanScore += 30;
    if ($isMobile) $humanScore += 20;
    if (!empty($headers['HTTP_REFERER'])) $humanScore += 10;
    
    // Deduct points for bot indicators
    if ($hasBotPattern) $humanScore -= 50;
    if ($humanHeaderCount < 2) $humanScore -= 20;
    if (empty($headers['HTTP_ACCEPT_LANGUAGE'])) $humanScore -= 15;
    
    // Return true if likely human (score > 70)
    return $humanScore > 70;
}

/**
 * Fast local detection fallback when API fails
 */
function performFastLocalDetection($userAgent, $ip) {
    // Quick bot detection patterns
    $botPatterns = [
        'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python', 'java',
        'php', 'ruby', 'perl', 'go-http', 'nodejs', 'axios', 'postman'
    ];
    
    $userAgentLower = strtolower($userAgent);
    foreach ($botPatterns as $pattern) {
        if (strpos($userAgentLower, $pattern) !== false) {
            return [
                'visitor_type' => 'bot',
                'location' => 'Local Detection',
                'browser' => 'Bot',
                'device_type' => 'Bot',
                'isp' => 'Local Detection',
                'detection_method' => 'User Agent Pattern'
            ];
        }
    }
    
    // If no bot patterns found, classify as human
    return [
        'visitor_type' => 'human', 
        'location' => 'Local Detection',
        'browser' => 'Human',
        'device_type' => 'desktop',
        'isp' => 'Local Detection',
        'detection_method' => 'Local Fallback'
    ];
}

/**
 * Log visitor data with filtering - only log meaningful classifications
 */
function logVisitorWithDeduplication($ip, $userAgent, $classification, $location, $browser, $device, $isp, $errorMessage = null) {
    global $VISITORS_FILE;
    
    // Skip ALL local detections - only log API classifications
    if ($location === 'Local Detection' || $isp === 'Local Detection' || 
        $errorMessage === 'Local bot detection' || 
        ($location === 'Unknown' && $isp === 'Unknown' && $browser === 'Unknown')) {
        return; // Skip logging local detections and API failures
    }
    
    $currentTime = time();
    $visitorData = [
        'timestamp' => date('Y-m-d H:i:s'),
        'ip' => $ip,
        'user_agent' => $userAgent,
        'classification' => $classification,
        'location' => $location,
        'browser' => $browser,
        'device' => $device,
        'isp' => $isp
    ];
    
    // Add error message if provided
    if ($errorMessage) {
        $visitorData['error'] = $errorMessage;
    }
    
    // Load existing visitors with error handling
    $visitors = [];
    if (file_exists($VISITORS_FILE)) {
        $content = file_get_contents($VISITORS_FILE);
        if ($content) {
            $decodedData = json_decode($content, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decodedData)) {
                $visitors = $decodedData;
            } else {
                // If JSON is corrupted, try to recover from backup
                $backupFile = $VISITORS_FILE . '.backup';
                if (file_exists($backupFile)) {
                    $backupContent = file_get_contents($backupFile);
                    if ($backupContent) {
                        $backupData = json_decode($backupContent, true);
                        if (json_last_error() === JSON_ERROR_NONE && is_array($backupData)) {
                            $visitors = $backupData;
                        }
                    }
                }
            }
        }
    }
    
    // Only prevent duplicate within last 2 seconds (browser quirks protection only)
    $isDuplicate = false;
    foreach ($visitors as $visitor) {
        if ($visitor['ip'] === $ip && $visitor['user_agent'] === $userAgent) {
            $visitorTime = strtotime($visitor['timestamp']);
            if (($currentTime - $visitorTime) < 2) { // Only 2 seconds to prevent browser double-requests
                $isDuplicate = true;
                break;
            }
        }
    }
    
    // Log every visit unless it's a true browser duplicate (within 2 seconds)
    if (!$isDuplicate) {
        // Add new visitor to the beginning of array (newest first)
        array_unshift($visitors, $visitorData);
        
        // Keep only last 10000 visitors to prevent file from growing too large (increased for better history)
        if (count($visitors) > 10000) {
            $visitors = array_slice($visitors, 0, 10000);
        }
        
        // Create backup before saving
        if (file_exists($VISITORS_FILE)) {
            copy($VISITORS_FILE, $VISITORS_FILE . '.backup');
        }
        
        // Save back to file with atomic write for better reliability
        $jsonData = json_encode($visitors, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($jsonData !== false) {
            $tempFile = $VISITORS_FILE . '.tmp';
            if (file_put_contents($tempFile, $jsonData) !== false) {
                rename($tempFile, $VISITORS_FILE);
            }
        }
    }
}


/**
 * Render a loading screen while API classification happens
 * Uses output buffering to send HTML immediately, then JS redirect after API call
 */
function renderLoadingScreen() {
    echo '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow, nosnippet, noarchive">
    <title>Verifying...</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
        }
        .spinner {
            width: 48px;
            height: 48px;
            border: 3px solid rgba(255,255,255,0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1.5rem;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
        p { font-size: 0.875rem; opacity: 0.8; }
        .dots::after {
            content: "";
            animation: dots 1.5s steps(4, end) infinite;
        }
        @keyframes dots {
            0% { content: ""; }
            25% { content: "."; }
            50% { content: ".."; }
            75% { content: "..."; }
            100% { content: ""; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <h2>Verifying your browser</h2>
        <p>Please wait while we confirm your access<span class="dots"></span></p>
    </div>
</body>
</html>';
    
    // Flush output buffer to send HTML to browser immediately
    if (ob_get_level() > 0) {
        ob_flush();
    }
    flush();
}

/**
 * Output JavaScript redirect after API call completes
 */
function jsRedirect($url) {
    echo '<script>window.location.replace(' . json_encode($url) . ');</script>';
    exit();
}

/**
 * Get redirect URLs from configuration
 */
function getRedirectUrls() {
    global $DEFAULT_HUMAN_URL, $DEFAULT_BOT_URL, $REDIRECT_URL_FILE, $BOT_URL_FILE;
    
    $humanUrl = $DEFAULT_HUMAN_URL;
    $botUrl = $DEFAULT_BOT_URL;
    
    if (file_exists($REDIRECT_URL_FILE)) {
        $configuredHuman = trim(file_get_contents($REDIRECT_URL_FILE));
        if (!empty($configuredHuman)) {
            $humanUrl = $configuredHuman;
        }
    }
    
    if (file_exists($BOT_URL_FILE)) {
        $configuredBot = trim(file_get_contents($BOT_URL_FILE));
        if (!empty($configuredBot)) {
            $botUrl = $configuredBot;
        }
    }
    
    return [$humanUrl, $botUrl];
}

// Main execution
try {
    // Start output buffering to control when content is sent
    if (ob_get_level() === 0) {
        ob_start();
    }
    
    // Extract visitor information
    $ip = getVisitorIP();
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
    
    // Advanced human detection using headers and user agent
    $isLikelyHuman = isLikelyHuman($userAgent, $_SERVER);
    
    // STEP 1: Check if IP is already blocked (confirmed bots only)
    // Only block IPs that are already confirmed as bots with 1-hour blocks
    if (!$isLikelyHuman) {
        $existingBlockData = [];
        if (file_exists($BOT_RATE_LIMIT_FILE)) {
            $content = file_get_contents($BOT_RATE_LIMIT_FILE);
            if ($content) {
                $decodedData = json_decode($content, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decodedData)) {
                    $existingBlockData = $decodedData;
                }
            }
        }
        
        // Check for existing 1-hour block (confirmed bots only)
        if (isset($existingBlockData[$ip . '_blocked'])) {
            $blockTime = $existingBlockData[$ip . '_blocked'];
            if ((time() - $blockTime) < $BOT_BLOCK_DURATION) {
                // This IP is confirmed blocked bot - silent redirect
                $randomBotUrl = getRandomBotUrl();
                header('Location: ' . $randomBotUrl, true, 302);
                exit();
            }
        }
    }
    
    // Quick behavioral analysis based on request headers and patterns
    $referrer = $_SERVER['HTTP_REFERER'] ?? '';
    $requestTime = microtime(true);
    
    // Instant behavioral analysis from request metadata
    $behavioralData = [
        'botScore' => 50, // Neutral starting score
        'hasReferrer' => !empty($referrer),
        'acceptLanguage' => $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '',
        'acceptEncoding' => $_SERVER['HTTP_ACCEPT_ENCODING'] ?? '',
        'connection' => $_SERVER['HTTP_CONNECTION'] ?? '',
        'requestMethod' => $_SERVER['REQUEST_METHOD'] ?? 'GET',
        'queryString' => $_SERVER['QUERY_STRING'] ?? '',
        'requestTime' => $requestTime,
        'isLikelyHuman' => $isLikelyHuman
    ];
    
    // Enhanced visitor analysis with behavioral data
    $enhancedAnalysis = analyzeVisitorWithBehavior($userAgent, $behavioralData);
    
    // Local pre-screening (now uses enhanced analysis)
    $localAnalysis = $enhancedAnalysis;
    
    // Default values
    $classification = 'bot';
    $location = 'Unknown';
    $browser = $localAnalysis['browser'];
    $device = $localAnalysis['device'];
    $isp = 'Unknown';
    $errorMessage = null;
    $redirectUrl = '';
    
    // If local analysis suggests bot, skip API call and DON'T LOG
    if ($localAnalysis['isBot']) {
        // Redirect silently to random bot URL without logging
        $randomBotUrl = getRandomBotUrl();
        header('Location: ' . $randomBotUrl, true, 302);
        exit();
    } else {
        // Show loading screen before making the API call
        // This sends HTML to the browser immediately so user sees something
        renderLoadingScreen();
        
        // Use CleanTraffic API for detailed analysis with behavioral data
        $apiResult = classifyVisitorAPI($ip, $userAgent, $behavioralData, $enhancedAnalysis);
        
        // Always check if there was an error first
        if (isset($apiResult['error']) && $apiResult['error'] === true) {
            // API error - redirect to random bot URL
            $redirectUrl = getRandomBotUrl();
            jsRedirect($redirectUrl);
        } else {
            // API success - use API results
            $classification = strtolower($apiResult['visitor_type']) ?? 'bot';
            $location = $apiResult['location'] ?? 'Unknown';
            $browser = $apiResult['browser'] ?? $localAnalysis['browser'];
            $device = $apiResult['device_type'] ?? $localAnalysis['device'];
            $isp = $apiResult['isp'] ?? 'Unknown';
            $errorMessage = null;
            
            // Get redirect URLs from config
            list($humanUrl, $botUrl) = getRedirectUrls();
            
            // CRITICAL: If API classified as bot
            if ($classification === 'bot') {
                // Anti-preview headers to block social media crawlers
                header('X-Frame-Options: DENY');
                header('X-Content-Type-Options: nosniff');
                header('X-Robots-Tag: noindex, nofollow, nosnippet, noarchive');
                header('Status: 403 Forbidden', true, 403);
                
                // Log the bot detection for admin monitoring
                logVisitorWithDeduplication($ip, $userAgent, $classification, $location, $browser, $device, $isp, null);
                
                // Redirect to random bot URL
                $redirectUrl = getRandomBotUrl();
                jsRedirect($redirectUrl);
            }
            
            // Only log human visitors (bots already handled above)
            if ($classification === 'human') {
                logVisitorWithDeduplication(
                    $ip, 
                    $userAgent, 
                    $classification, 
                    $location, 
                    $browser, 
                    $device,
                    $isp,
                    $errorMessage
                );
                
                // Apply rate limiting AFTER classification with human thresholds
                $humanRateStatus = isIpBlocked($ip, true); // true = human thresholds
            }
            
            // Perform redirection with safety check - ONLY verified humans get human URL
            if ($classification === 'human' && 
                !empty($location) && $location !== 'Unknown' && 
                !empty($isp) && $isp !== 'Unknown' && 
                $errorMessage === null) {
                // Only redirect to human URL if we have complete API data proving it's human
                $redirectUrl = $humanUrl;
            } else {
                // Everything else goes to random bot URL for safety
                $redirectUrl = getRandomBotUrl();
            }
            
            // Redirect via JavaScript in the already-loaded page
            jsRedirect($redirectUrl);
        }
    }
    
} catch (Exception $e) {
    // Fallback: redirect to random bot URL on any error
    error_log('CleanTraffic Error: ' . $e->getMessage());
    $randomBotUrl = getRandomBotUrl();
    
    // If we've already sent the loading screen, use JS redirect
    if (headers_sent()) {
        jsRedirect($randomBotUrl);
    } else {
        header('Location: ' . $randomBotUrl, true, 302);
    }
}

exit();
?>