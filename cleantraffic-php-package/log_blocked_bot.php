<?php
/**
 * Lightweight bot logging - NO API calls, just local file logging
 * Tracks bots blocked by .htaccess before they reach main classification
 */

// Get visitor details
function getVisitorIP() {
    $headers = [
        'HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_FORWARDED',
        'HTTP_X_CLUSTER_CLIENT_IP', 'HTTP_CLIENT_IP', 'HTTP_FORWARDED_FOR',
        'HTTP_FORWARDED', 'REMOTE_ADDR'
    ];
    
    foreach ($headers as $header) {
        if (!empty($_SERVER[$header])) {
            $ips = explode(',', $_SERVER[$header]);
            $ip = trim($ips[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return $ip;
            }
        }
    }
    return $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
}

// Simple bot detection for logging
function detectBotType($userAgent) {
    $userAgent = strtolower($userAgent);
    
    $botTypes = [
        'social' => ['facebookexternalhit', 'twitterbot', 'telegrambot', 'whatsapp', 'linkedinbot', 'slackbot', 'discordbot'],
        'search' => ['googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider', 'yandexbot', 'applebot'],
        'scraper' => ['curl', 'wget', 'python', 'scrapy', 'beautifulsoup', 'selenium', 'phantomjs', 'headless', 'puppeteer'],
        'generic' => ['bot', 'crawl', 'spider', 'scraper', 'preview', 'fetch', 'parser', 'extractor', 'monitor', 'check', 'test']
    ];
    
    foreach ($botTypes as $type => $patterns) {
        foreach ($patterns as $pattern) {
            if (strpos($userAgent, $pattern) !== false) {
                return $type;
            }
        }
    }
    
    return 'unknown';
}

// Log blocked bot (lightweight - no API calls)
function logBlockedBot() {
    $ip = getVisitorIP();
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    $botType = detectBotType($userAgent);
    $timestamp = date('Y-m-d H:i:s');
    $referrer = $_SERVER['HTTP_REFERER'] ?? '';
    
    $logEntry = [
        'timestamp' => $timestamp,
        'ip' => $ip,
        'user_agent' => $userAgent,
        'bot_type' => $botType,
        'referrer' => $referrer,
        'blocked_by' => 'htaccess'
    ];
    
    // Save to blocked bots log file
    $blockedBotsFile = dirname(__FILE__) . '/blocked_bots.json';
    $blockedBots = [];
    
    if (file_exists($blockedBotsFile)) {
        $content = file_get_contents($blockedBotsFile);
        $blockedBots = json_decode($content, true) ?: [];
    }
    
    // Keep only last 1000 entries to prevent file from growing too large
    if (count($blockedBots) >= 1000) {
        $blockedBots = array_slice($blockedBots, -500); // Keep last 500
    }
    
    $blockedBots[] = $logEntry;
    file_put_contents($blockedBotsFile, json_encode($blockedBots, JSON_PRETTY_PRINT));
}

// Log the blocked bot and redirect
logBlockedBot();

// Redirect to bot URL (same as .htaccess would do)
header('Location: https://google.com', true, 302);
exit();
?>