const fs = require('fs');
let code = fs.readFileSync('client/src/pages/user-dashboard.tsx', 'utf8');

const oldRegex = /\/\/ Display error if completely failed\\nhttp_response_code\(503\);\\necho "Classification Service Unavailable\. Error logged\.";\\nexit;/;

const newBlock = `// Display error if completely failed
http_response_code(503);
echo "<div style='font-family: sans-serif; padding: 20px; border: 1px solid #ff4444; background: #ffeeee; border-radius: 5px; max-width: 800px; margin: 20px auto;'>";
echo "<h2 style='color: #cc0000; margin-top: 0;'>Classification Service Connection Failed</h2>";
echo "<p>Your web server was unable to reach the API endpoint.</p>";
echo "<p><strong>API Endpoint:</strong> <code>" . htmlspecialchars($apiEndpoint) . "</code></p>";
echo "<p><strong>cURL Error:</strong> <code>" . htmlspecialchars($errorMsg) . "</code></p>";
echo "<p><em>Note: If you see 'Could not resolve host' or 'Connection timed out', your web hosting provider's firewall might be blocking outgoing connections.</em></p>";
echo "</div>";
exit;`;

code = code.replace(oldRegex, newBlock);

fs.writeFileSync('client/src/pages/user-dashboard.tsx', code);
console.log('done');
