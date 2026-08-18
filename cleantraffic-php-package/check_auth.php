<?php
/**
 * CleanTraffic PHP Protection - Authentication Check
 * Verifies if admin is currently logged in
 */

session_start();

header('Content-Type: application/json');
header('X-Robots-Tag: noindex, nofollow');

// Check if admin is authenticated
$authenticated = isset($_SESSION['admin_authenticated']) && $_SESSION['admin_authenticated'] === true;

// Optional: Check session timeout (24 hours)
if ($authenticated && isset($_SESSION['login_time'])) {
    $sessionTimeout = 24 * 60 * 60; // 24 hours
    if (time() - $_SESSION['login_time'] > $sessionTimeout) {
        $_SESSION['admin_authenticated'] = false;
        session_destroy();
        $authenticated = false;
    }
}

echo json_encode(['authenticated' => $authenticated]);
?>