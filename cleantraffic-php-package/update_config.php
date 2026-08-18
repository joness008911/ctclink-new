<?php
/**
 * CleanTraffic PHP Protection - Configuration Updater
 * Updates system configuration settings
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
$PASSWORD_FILE = $BASE_DIR . '/admin_password.txt';

$input = json_decode(file_get_contents('php://input'), true);

try {
    $updated = false;
    $errors = [];
    
    // Check directory permissions first
    if (!is_writable($BASE_DIR)) {
        @chmod($BASE_DIR, 0755);
        if (!is_writable($BASE_DIR)) {
            http_response_code(500);
            echo json_encode([
                'success' => false, 
                'error' => 'Directory not writable. Please set folder permissions to 755 or contact hosting support about file ownership.',
                'updated' => false
            ]);
            exit();
        }
    }
    
    // Helper function to safely write files with cache clearing
    function safeWriteFile($filename, $content) {
        // If file exists and not writable, try to fix permissions
        if (file_exists($filename) && !is_writable($filename)) {
            @chmod($filename, 0664);
        }
        
        // Clear any existing cache for this file
        clearstatcache(true, $filename);
        if (function_exists('opcache_invalidate')) {
            @opcache_invalidate($filename, true);
        }
        
        // Try to write the file
        $result = file_put_contents($filename, $content, LOCK_EX);
        if ($result !== false) {
            @chmod($filename, 0644);
            // Clear cache again after write
            clearstatcache(true, $filename);
            if (function_exists('opcache_invalidate')) {
                @opcache_invalidate($filename, true);
            }
            return true;
        }
        return false;
    }
    
    // Update API key with enhanced cache clearing
    if (isset($input['apiKey']) && !empty($input['apiKey'])) {
        $newApiKey = trim($input['apiKey']);
        
        // Remove old file first to prevent caching
        if (file_exists($API_KEY_FILE)) {
            @unlink($API_KEY_FILE);
        }
        
        if (safeWriteFile($API_KEY_FILE, $newApiKey)) {
            $updated = true;
            // Verify the write was successful
            clearstatcache(true, $API_KEY_FILE);
            $readBack = file_get_contents($API_KEY_FILE);
            if (trim($readBack) !== $newApiKey) {
                $errors[] = "API key verification failed - file may not have updated properly.";
            }
        } else {
            $errors[] = "Cannot write API key file. Check file permissions or ownership.";
        }
    }
    
    // Update human redirect URL
    if (isset($input['humanUrl']) && !empty($input['humanUrl'])) {
        if (filter_var($input['humanUrl'], FILTER_VALIDATE_URL)) {
            if (safeWriteFile($REDIRECT_URL_FILE, trim($input['humanUrl']))) {
                $updated = true;
            } else {
                $errors[] = "Cannot write redirect URL file. Check file permissions or ownership.";
            }
        }
    }
    
    // Update bot redirect URL
    if (isset($input['botUrl']) && !empty($input['botUrl'])) {
        if (filter_var($input['botUrl'], FILTER_VALIDATE_URL)) {
            if (safeWriteFile($BOT_URL_FILE, trim($input['botUrl']))) {
                $updated = true;
            } else {
                $errors[] = "Cannot write bot URL file. Check file permissions or ownership.";
            }
        }
    }
    
    // Update admin password - stored as bcrypt hash
    if (isset($input['newPassword']) && !empty($input['newPassword'])) {
        $newPassword = trim($input['newPassword']);
        if (strlen($newPassword) >= 8) {
            $hash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 10]);
            if (safeWriteFile($PASSWORD_FILE, $hash)) {
                @chmod($PASSWORD_FILE, 0600);
                $updated = true;
            } else {
                $errors[] = "Cannot write password file. Check file permissions or ownership.";
            }
        } else {
            $errors[] = "Password must be at least 8 characters.";
        }
    }
    
    if (!empty($errors)) {
        http_response_code(500);  // Server-side file permission issues
        echo json_encode(['success' => false, 'error' => implode(', ', $errors), 'updated' => $updated]);
    } else {
        echo json_encode(['success' => true, 'updated' => $updated]);
    }
    
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>