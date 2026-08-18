<?php
/**
 * CleanTraffic PHP Protection - Authentication Handler
 * Manages admin login/logout functionality
 */

session_start();

header('Content-Type: application/json');
header('X-Robots-Tag: noindex, nofollow');

$BASE_DIR = dirname($_SERVER['SCRIPT_FILENAME']);
$PASSWORD_FILE = $BASE_DIR . '/admin_password.txt';
$BRUTE_FORCE_FILE = $BASE_DIR . '/login_attempts.json';
$MAX_ATTEMPTS = 5;
$LOCKOUT_DURATION = 15 * 60; // 15 minutes

/**
 * Get current admin password hash.
 * On first run (no password file), generates a random password and stores it hashed.
 */
function getAdminPasswordHash() {
    global $PASSWORD_FILE;

    if (file_exists($PASSWORD_FILE)) {
        $stored = trim(file_get_contents($PASSWORD_FILE));
        if (!empty($stored)) {
            return $stored;
        }
    }

    // First-run: generate a secure random password, store it hashed, print it once
    $randomPassword = bin2hex(random_bytes(12));
    $hash = password_hash($randomPassword, PASSWORD_BCRYPT, ['cost' => 10]);
    file_put_contents($PASSWORD_FILE, $hash, LOCK_EX);
    @chmod($PASSWORD_FILE, 0600);

    // Log to server error log so the operator can retrieve it
    error_log("[CleanTraffic] First-run admin password (save this, it will not be shown again): " . $randomPassword);

    return $hash;
}

/**
 * Set new admin password (stored as bcrypt hash).
 */
function setAdminPassword($newPassword) {
    global $PASSWORD_FILE;

    if (strlen($newPassword) < 8) {
        return false;
    }

    $hash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 10]);
    $result = file_put_contents($PASSWORD_FILE, $hash, LOCK_EX) !== false;
    if ($result) {
        @chmod($PASSWORD_FILE, 0600);
    }
    return $result;
}

/**
 * Brute-force protection: check and record login attempts.
 */
function checkBruteForce($ip) {
    global $BRUTE_FORCE_FILE, $MAX_ATTEMPTS, $LOCKOUT_DURATION;

    $now = time();
    $data = [];

    if (file_exists($BRUTE_FORCE_FILE)) {
        $content = file_get_contents($BRUTE_FORCE_FILE);
        if ($content) {
            $decoded = json_decode($content, true);
            if (is_array($decoded)) {
                $data = $decoded;
            }
        }
    }

    // Clean up stale entries
    foreach (array_keys($data) as $key) {
        if (($now - ($data[$key]['first_attempt'] ?? 0)) > $LOCKOUT_DURATION) {
            unset($data[$key]);
        }
    }

    $entry = $data[$ip] ?? ['count' => 0, 'first_attempt' => $now, 'locked_until' => 0];

    // Check if currently locked out
    if (isset($entry['locked_until']) && $entry['locked_until'] > $now) {
        $remaining = ceil(($entry['locked_until'] - $now) / 60);
        return ['allowed' => false, 'message' => "Too many failed attempts. Try again in {$remaining} minute(s)."];
    }

    return ['allowed' => true, 'data' => $data, 'entry' => $entry, 'ip' => $ip];
}

function recordFailedAttempt($ip, $data, $entry) {
    global $BRUTE_FORCE_FILE, $MAX_ATTEMPTS, $LOCKOUT_DURATION;

    $now = time();
    $entry['count'] = ($entry['count'] ?? 0) + 1;
    if (!isset($entry['first_attempt'])) {
        $entry['first_attempt'] = $now;
    }

    if ($entry['count'] >= $MAX_ATTEMPTS) {
        $entry['locked_until'] = $now + $LOCKOUT_DURATION;
        $entry['count'] = 0;
        $entry['first_attempt'] = $now;
    }

    $data[$ip] = $entry;
    file_put_contents($BRUTE_FORCE_FILE, json_encode($data), LOCK_EX);
    @chmod($BRUTE_FORCE_FILE, 0600);
}

function clearAttempts($ip, $data) {
    global $BRUTE_FORCE_FILE;
    unset($data[$ip]);
    file_put_contents($BRUTE_FORCE_FILE, json_encode($data), LOCK_EX);
}

// Handle different actions
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';

// Get real client IP
$clientIp = $_SERVER['HTTP_CF_CONNECTING_IP']
    ?? $_SERVER['HTTP_X_FORWARDED_FOR']
    ?? $_SERVER['REMOTE_ADDR']
    ?? '0.0.0.0';
$clientIp = trim(explode(',', $clientIp)[0]);

switch ($action) {
    case 'login':
        $password = $input['password'] ?? '';

        // Brute-force check
        $bfCheck = checkBruteForce($clientIp);
        if (!$bfCheck['allowed']) {
            http_response_code(429);
            echo json_encode(['success' => false, 'error' => $bfCheck['message']]);
            break;
        }

        $storedHash = getAdminPasswordHash();

        if (password_verify($password, $storedHash)) {
            clearAttempts($clientIp, $bfCheck['data']);
            $_SESSION['admin_authenticated'] = true;
            $_SESSION['login_time'] = time();
            echo json_encode(['success' => true]);
        } else {
            recordFailedAttempt($clientIp, $bfCheck['data'], $bfCheck['entry']);
            // Constant-time sleep to prevent timing attacks
            usleep(200000);
            echo json_encode(['success' => false, 'error' => 'Invalid password']);
        }
        break;

    case 'logout':
        $_SESSION['admin_authenticated'] = false;
        session_destroy();
        echo json_encode(['success' => true]);
        break;

    case 'change_password':
        if (!isset($_SESSION['admin_authenticated']) || $_SESSION['admin_authenticated'] !== true) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Unauthorized']);
            break;
        }

        $currentPassword = $input['currentPassword'] ?? '';
        $newPassword = $input['newPassword'] ?? '';

        $storedHash = getAdminPasswordHash();
        if (!password_verify($currentPassword, $storedHash)) {
            echo json_encode(['success' => false, 'error' => 'Current password is incorrect']);
            break;
        }

        if (strlen($newPassword) < 8) {
            echo json_encode(['success' => false, 'error' => 'New password must be at least 8 characters']);
            break;
        }

        if (setAdminPassword($newPassword)) {
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to update password']);
        }
        break;

    default:
        echo json_encode(['success' => false, 'error' => 'Invalid action']);
        break;
}
?>
