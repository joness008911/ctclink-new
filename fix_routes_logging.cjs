const fs = require('fs');
let code = fs.readFileSync('server/routes.ts', 'utf8');

// 1. Update GET /api/classify
const getOld = `  // Classification endpoint (GET with API key support)
  app.get("/api/classify", classifyLimiter, async (req, res) => {
    const apiKey = extractApiKeyFromRequest(req);
    
    if (!apiKey) {
      return res.redirect(301, 'https://www.google.com');
    }
    
    let limitReached = false;
    let apiKeyId: string | null = null;
    
    // Validate API key
    const validKey = await storage.getApiKey(apiKey);
    if (!validKey || !validKey.enabled) {
      return res.status(200).json({ 
         visitorType: "Bot",
        redirectUrl: "https://google.com",
        redirectVersion: 0,
        status: "unauthorized",
        message: "Invalid or disabled API key"
      });
    }
    
    // Store API key ID for classification tracking
    apiKeyId = validKey.id;
    
    // Check subscription status for the API key owner — expired trials get bot fallback
    const keyOwner = await storage.getClientUserByApiKey(apiKeyId);
    if (keyOwner) {
      const now = new Date();
      const subActive =
        keyOwner.subscriptionStatus === 'active' ||
        (keyOwner.subscriptionStatus === 'trialing' && (!keyOwner.trialEndsAt || keyOwner.trialEndsAt > now));
      if (!subActive) limitReached = true;
    }

    // Check and increment usage count
    const usageAllowed = await storage.incrementApiKeyUsage(apiKey);
    if (!usageAllowed) {
      limitReached = true;
    }
    
    // Continue with classification logic, passing API key ID
    return handleClassification(req, res, limitReached, apiKeyId);
  });`;

const getNew = `  // Classification endpoint (GET with API key support)
  app.get("/api/classify", classifyLimiter, async (req, res) => {
    const apiKey = extractApiKeyFromRequest(req);
    
    let limitReached = false;
    let apiKeyId: string | null = null;
    let authError: string | null = null;
    
    if (!apiKey) {
      authError = "API key is required";
    } else {
      // Validate API key
      const validKey = await storage.getApiKey(apiKey);
      if (!validKey || !validKey.enabled) {
        authError = "Invalid or disabled API key";
      } else {
        // Store API key ID for classification tracking
        apiKeyId = validKey.id;
        
        // Check subscription status for the API key owner — expired trials get bot fallback
        const keyOwner = await storage.getClientUserByApiKey(apiKeyId);
        if (keyOwner) {
          const now = new Date();
          const subActive =
            keyOwner.subscriptionStatus === 'active' ||
            (keyOwner.subscriptionStatus === 'trialing' && (!keyOwner.trialEndsAt || keyOwner.trialEndsAt > now));
          if (!subActive) limitReached = true;
        }

        // Check and increment usage count
        const usageAllowed = await storage.incrementApiKeyUsage(apiKey);
        if (!usageAllowed) {
          limitReached = true;
        }
      }
    }
    
    // Continue with classification logic, passing API key ID and authError
    return handleClassification(req, res, limitReached, apiKeyId, authError);
  });`;

code = code.replace(getOld, getNew);

// 2. Update POST /api/classify
const postOld = `  // Public classification endpoint (POST) - with API key support for PHP scripts
  app.post("/api/classify", classifyLimiter, async (req, res) => {
    const apiKey = extractApiKeyFromRequest(req);
    
    if (!apiKey) {
      return res.status(200).json({ 
         visitorType: "Bot",
        redirectUrl: "https://google.com",
        redirectVersion: 0,
        status: "unauthorized",
        message: "API key is required"
      });
    }
    
    let limitReached = false;
    let apiKeyId: string | null = null;
    
    // Validate API key
    const validKey = await storage.getApiKey(apiKey);
    if (!validKey || !validKey.enabled) {
      return res.status(200).json({ 
         visitorType: "Bot",
        redirectUrl: "https://google.com",
        redirectVersion: 0,
        status: "unauthorized",
        message: "Invalid or disabled API key"
      });
    }
    
    // Store API key ID for classification tracking and redirect URL lookup
    apiKeyId = validKey.id;

    // Check subscription status for the API key owner — expired trials get bot fallback
    const postKeyOwner = await storage.getClientUserByApiKey(apiKeyId);
    if (postKeyOwner) {
      const now = new Date();
      const subActive =
        postKeyOwner.subscriptionStatus === 'active' ||
        (postKeyOwner.subscriptionStatus === 'trialing' && (!postKeyOwner.trialEndsAt || postKeyOwner.trialEndsAt > now));
      if (!subActive) limitReached = true;
    }
    
    // Check and increment usage count
    const usageAllowed = await storage.incrementApiKeyUsage(apiKey);
    if (!usageAllowed) {
      limitReached = true;
    }
    
    return handleClassification(req, res, limitReached, apiKeyId);
  });`;

const postNew = `  // Public classification endpoint (POST) - with API key support for PHP scripts
  app.post("/api/classify", classifyLimiter, async (req, res) => {
    const apiKey = extractApiKeyFromRequest(req);
    
    let limitReached = false;
    let apiKeyId: string | null = null;
    let authError: string | null = null;
    
    if (!apiKey) {
      authError = "API key is required";
    } else {
      // Validate API key
      const validKey = await storage.getApiKey(apiKey);
      if (!validKey || !validKey.enabled) {
        authError = "Invalid or disabled API key";
      } else {
        // Store API key ID for classification tracking and redirect URL lookup
        apiKeyId = validKey.id;

        // Check subscription status for the API key owner — expired trials get bot fallback
        const postKeyOwner = await storage.getClientUserByApiKey(apiKeyId);
        if (postKeyOwner) {
          const now = new Date();
          const subActive =
            postKeyOwner.subscriptionStatus === 'active' ||
            (postKeyOwner.subscriptionStatus === 'trialing' && (!postKeyOwner.trialEndsAt || postKeyOwner.trialEndsAt > now));
          if (!subActive) limitReached = true;
        }
        
        // Check and increment usage count
        const usageAllowed = await storage.incrementApiKeyUsage(apiKey);
        if (!usageAllowed) {
          limitReached = true;
        }
      }
    }
    
    return handleClassification(req, res, limitReached, apiKeyId, authError);
  });`;

code = code.replace(postOld, postNew);

// 3. Update handleClassification Signature
const handleSigOld = `async function handleClassification(req: any, res: any, limitReached: boolean = false, apiKeyId: string | null = null) {`;
const handleSigNew = `async function handleClassification(req: any, res: any, limitReached: boolean = false, apiKeyId: string | null = null, authError: string | null = null) {`;
code = code.replace(handleSigOld, handleSigNew);

// 4. Update the bot URL default in handleClassification
const urlOld = `      let botUrl = 'https://google.com';`;
const urlNew = `      let botUrl = 'https://example.com/blocked';`;
code = code.replace(urlOld, urlNew);

// 5. Add authError block inside handleClassification
const blockOld = `      try {
        // PRIORITY 0: RATE LIMITS & SUBSCRIPTION
        if (limitReached) {
          visitorType = 'Bot';
          detectionMethod = 'Rate Limit / Subscription Expired';`;
          
const blockNew = `      try {
        // PRIORITY 0: RATE LIMITS & SUBSCRIPTION
        if (authError) {
          visitorType = 'Bot';
          detectionMethod = 'Authentication Failed';
          blockReason = authError;
          console.log(\`🚫 BLOCKED (Priority 0 - Auth Error): \${clientIp} - \${authError}\`);
        } else if (limitReached) {
          visitorType = 'Bot';
          detectionMethod = 'Rate Limit / Subscription Expired';`;
          
code = code.replace(blockOld, blockNew);

// 6. Update catch block hardcodes
const catchOld = `    } catch (error) {
      console.error("Classification error:", error);
      res.status(200).json({ 
         visitorType: "Bot",
        redirectUrl: "https://google.com",
        redirectVersion: 0,
        message: "Classification failed - fail secure", 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }`;
const catchNew = `    } catch (error) {
      console.error("Classification error:", error);
      res.status(200).json({ 
         visitorType: "Bot",
        redirectUrl: typeof botUrl !== "undefined" ? botUrl : "https://example.com/blocked",
        redirectVersion: typeof redirectVersion !== "undefined" ? redirectVersion : 0,
        message: "Classification failed - fail secure", 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }`;
code = code.replace(catchOld, catchNew);

fs.writeFileSync('server/routes.ts', code);
console.log('done');
