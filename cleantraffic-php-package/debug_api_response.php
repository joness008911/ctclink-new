<?php
/**
 * Debug API Response - Shows raw response from CleanTraffic API
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

$CLEANTRAFFIC_API_ENDPOINT = 'https://b5c9b90c-2b1a-4515-8f6e-08614985a083-00-1nd7hrl46szbn.worf.replit.dev/api/classify';
$BASE_DIR = dirname($_SERVER['SCRIPT_FILENAME']);
$API_KEY_FILE = $BASE_DIR . '/api_key.txt';

try {
    // Check if API key exists
    if (!file_exists($API_KEY_FILE)) {
        echo json_encode(['success' => false, 'error' => 'API key not configured']);
        exit();
    }
    
    $apiKey = trim(file_get_contents($API_KEY_FILE));
    if (empty($apiKey)) {
        echo json_encode(['success' => false, 'error' => 'API key is empty']);
        exit();
    }
    
    // Test API connection
    $testData = json_encode([
        'ip' => '8.8.8.8',
        'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    ]);
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $CLEANTRAFFIC_API_ENDPOINT,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $testData,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'X-API-Key: ' . $apiKey,
            'User-Agent: CleanTraffic-PHP-Test/1.0',
            'Accept: application/json'
        ],
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_FOLLOWLOCATION => false
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);
    
    // Show detailed debug information
    echo json_encode([
        'success' => ($response !== false && $httpCode === 200),
        'http_code' => $httpCode,
        'curl_error' => $error,
        'response_length' => strlen($response),
        'response_raw' => $response,
        'response_preview' => substr($response, 0, 500) . (strlen($response) > 500 ? '...' : ''),
        'content_type' => $info['content_type'] ?? 'unknown',
        'api_endpoint' => $CLEANTRAFFIC_API_ENDPOINT,
        'api_key_preview' => substr($apiKey, 0, 10) . '***'
    ]);
    
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Debug failed: ' . $e->getMessage()]);
}
?>