<?php
/**
 * CleanTraffic PHP Protection - Configuration Getter
 * Returns current configuration settings
 */

session_start();

header('Content-Type: application/json');
header('X-Robots-Tag: noindex, nofollow');

// Check authentication
if (!isset($_SESSION['admin_authenticated']) || $_SESSION['admin_authenticated'] !== true) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$BASE_DIR = dirname($_SERVER['SCRIPT_FILENAME']);
$REDIRECT_URL_FILE = $BASE_DIR . '/redirect_url.txt';
$BOT_URL_FILE = $BASE_DIR . '/bot_url.txt';
$API_KEY_FILE = $BASE_DIR . '/api_key.txt';

$config = [
    'humanUrl' => '',
    'botUrl' => '',
    'hasApiKey' => false
];

// Get human redirect URL
if (file_exists($REDIRECT_URL_FILE)) {
    $config['humanUrl'] = trim(file_get_contents($REDIRECT_URL_FILE));
}

// Get bot redirect URL
if (file_exists($BOT_URL_FILE)) {
    $config['botUrl'] = trim(file_get_contents($BOT_URL_FILE));
}

// Check if API key exists (don't return the actual key)
if (file_exists($API_KEY_FILE)) {
    $apiKey = trim(file_get_contents($API_KEY_FILE));
    $config['hasApiKey'] = !empty($apiKey);
}

echo json_encode($config);
?>