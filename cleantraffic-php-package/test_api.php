<?php
/**
 * CleanTraffic PHP Protection - API Connection Tester
 * Tests connection to CleanTraffic API service
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

// Test CleanTraffic API directly
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
    
    // Test original CleanTraffic API using POST method
    $testUrl = 'https://davidnmarx.com/api/classify';
    $postData = [
        'api_key' => $apiKey,
        'ip' => '8.8.8.8',  // Test IP
        'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    ];
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $testUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($postData),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/x-www-form-urlencoded',
            'Accept: application/json',
            'Cache-Control: no-cache'
        ],
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_FOLLOWLOCATION => false
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($response === false) {
        echo json_encode([
            'success' => false, 
            'error' => 'Connection failed: ' . $error
        ]);
        exit();
    }
    
    if ($httpCode === 401) {
        echo json_encode([
            'success' => false, 
            'error' => 'Invalid API key'
        ]);
        exit();
    }
    
    if ($httpCode !== 200) {
        echo json_encode([
            'success' => false, 
            'error' => 'API returned HTTP ' . $httpCode
        ]);
        exit();
    }
    
    $data = json_decode($response, true);
    if (!$data) {
        echo json_encode([
            'success' => false, 
            'error' => 'Invalid API response format'
        ]);
        exit();
    }
    
    // Success - API is working
    echo json_encode([
        'success' => true,
        'message' => 'CleanTraffic API connection successful!',
        'test_result' => [
            'visitor_type' => $data['visitor_type'] ?? 'Unknown',
            'location' => $data['location'] ?? 'Unknown',
            'browser' => $data['browser'] ?? 'Unknown',
            'device_type' => $data['device_type'] ?? 'Unknown',
            'isp' => $data['isp'] ?? 'Unknown'
        ]
    ]);
    
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Test failed: ' . $e->getMessage()]);
}
?>