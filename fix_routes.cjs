const fs = require('fs');
let code = fs.readFileSync('server/routes.ts', 'utf8');

// 1. Fetch URLs early
const urlFetchLogic = `      // Fetch user configured redirect URLs early so we have them for fallback
      let humanUrl = 'https://example.com/human';
      let botUrl = 'https://google.com';
      let redirectVersion = 0;

      if (apiKeyId) {
        try {
          const user = await storage.getClientUserByApiKey(apiKeyId);
          if (user) {
            const redirectUrls = await storage.getUserRedirectUrls(user.id);
            if (redirectUrls) {
              humanUrl = redirectUrls.humanUrl || humanUrl;
              botUrl = redirectUrls.botUrl || botUrl;
              redirectVersion = redirectUrls.updatedAt ? new Date(redirectUrls.updatedAt).getTime() : 0;
            }
          }
        } catch (urlErr) {
          console.error("Error fetching user redirect URLs:", urlErr);
        }
      }

      // Cascading Classification Pipeline`;

code = code.replace('      // Cascading Classification Pipeline', urlFetchLogic);

// 2. Add limitReached check
const limitCheck = `      try {
        // PRIORITY 0: RATE LIMITS & SUBSCRIPTION
        if (limitReached) {
          visitorType = 'Bot';
          detectionMethod = 'Rate Limit / Subscription Expired';
          blockReason = 'Account limit reached or subscription expired';
          console.log(\`🚫 BLOCKED (Priority 0 - Limit Reached): \${clientIp}\`);
        } else if (!userAgent || userAgent.trim() === '') {`;

code = code.replace(`      try {
        // SECURITY CHECK 1: User Agent Validation
        if (!userAgent || userAgent.trim() === '') {`, limitCheck);

// 3. Remove old URL fetch logic
const oldUrlFetch = `      // Default redirect URLs
      let humanUrl = 'https://example.com/human';
      let botUrl = 'https://google.com';
      let redirectVersion = 0;

      // If API key is provided, look up the user's specific configured redirect URLs
      if (apiKeyId) {
        try {
          const apiKeyDetails = await storage.getApiKeyById(apiKeyId);
          const user = await storage.getClientUserByApiKey(apiKeyId);
          
          if (user) {
            const redirectUrls = await storage.getUserRedirectUrls(user.id);
            if (redirectUrls) {
              humanUrl = redirectUrls.humanUrl || humanUrl;
              botUrl = redirectUrls.botUrl || botUrl;
              redirectVersion = redirectUrls.updatedAt ? new Date(redirectUrls.updatedAt).getTime() : 0;
            }
          }

          // If API key is paused or expired, force redirect to bot URL
          if (apiKeyDetails && (apiKeyDetails.status === 'paused' || apiKeyDetails.status === 'expired')) {
            visitorType = 'Bot';
            classification.visitorType = 'Bot';
            console.log(\`⚠️ License \${apiKeyDetails.status.toUpperCase()}: Redirecting visitor to bot URL\`);
          }
        } catch (urlErr) {
          console.error("Error fetching user redirect URLs:", urlErr);
        }
      }`;

const newUrlFetch = `      // If API key is paused or expired, force redirect to bot URL
      if (apiKeyId) {
        try {
          const apiKeyDetails = await storage.getApiKeyById(apiKeyId);
          if (apiKeyDetails && (apiKeyDetails.status === 'paused' || apiKeyDetails.status === 'expired')) {
            visitorType = 'Bot';
            classification.visitorType = 'Bot';
            console.log(\`⚠️ License \${apiKeyDetails.status.toUpperCase()}: Redirecting visitor to bot URL\`);
          }
        } catch (keyErr) {}
      }`;
      
code = code.replace(oldUrlFetch, newUrlFetch);

// 4. Update catch block
const oldCatch = `    } catch (error) {
      console.error("Classification error:", error);
      res.status(200).json({ 
         visitorType: "Bot",
        redirectUrl: "https://google.com",
        redirectVersion: 0,
        message: "Classification failed - fail secure", 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }`;
    
const newCatch = `    } catch (error) {
      console.error("Classification error:", error);
      res.status(200).json({ 
        visitorType: "Bot",
        redirectUrl: typeof botUrl !== 'undefined' ? botUrl : "https://google.com",
        redirectVersion: typeof redirectVersion !== 'undefined' ? redirectVersion : 0,
        message: "Classification failed - fail secure", 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }`;

code = code.replace(oldCatch, newCatch);

// 5. Update /api/classify missing API key defaults
code = code.replace(`        visitorType: "Bot",\n        redirectUrl: "https://google.com",\n        redirectVersion: 0,\n        status: "unauthorized",\n        message: "API key is required"`, `        visitorType: "Bot",\n        redirectUrl: "https://google.com",\n        redirectVersion: 0,\n        status: "unauthorized",\n        message: "API key is required"`);

fs.writeFileSync('server/routes.ts', code);
console.log('done');
