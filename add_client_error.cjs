const fs = require('fs');
let code = fs.readFileSync('server/routes.ts', 'utf8');

const anchor = `  // ========== BILLING ROUTES ==========`;

const newEndpoint = `  // Client error reporting endpoint (from PHP script)
  app.post("/api/client-error", async (req, res) => {
    try {
      const { apiKey, ip, error } = req.body;
      let apiKeyId = null;
      
      if (apiKey) {
        const validKey = await storage.getApiKey(apiKey);
        if (validKey) apiKeyId = validKey.id;
      }
      
      const classification = await storage.createClassification({
        ipAddress: ip || 'Unknown',
        location: 'API Connection Error',
        country: 'Unknown',
        countryCode: '',
        city: '',
        region: '',
        browser: 'PHP Client',
        deviceType: 'Server',
        visitorType: 'Error',
        isp: error ? String(error).substring(0, 100) : 'Unknown Error',
        detectionMethod: 'Client Connection Failure',
        apiKeyId: apiKeyId
      });
      
      if (apiKeyId) {
        broadcastClassification(apiKeyId, {
          id: classification.id || Math.random().toString(),
          timestamp: new Date().toISOString(),
          ipAddress: ip || 'Unknown',
          visitorType: 'Error',
          detectionMethod: 'Client Connection Failure',
          country: 'Unknown',
          isp: error ? String(error).substring(0, 100) : 'Unknown Error',
          action: 'Error'
        });
      }
      
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to log client error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  });

  // ========== BILLING ROUTES ==========`;

code = code.replace(anchor, newEndpoint);
fs.writeFileSync('server/routes.ts', code);
console.log('done');
