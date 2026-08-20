const fs = require('fs');
let code = fs.readFileSync('server/routes.ts', 'utf8');

// Replace the catch block to just use google.com
const catchTarget = `    } catch (error) {
      console.error("Classification error:", error);
      res.status(200).json({ 
         visitorType: "Bot",
        redirectUrl: typeof botUrl !== "undefined" ? botUrl : "https://google.com",
        redirectVersion: typeof redirectVersion !== "undefined" ? redirectVersion : 0,
        message: "Classification failed - fail secure", 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }`;
    
const catchReplacement = `    } catch (error) {
      console.error("Classification error:", error);
      res.status(200).json({ 
         visitorType: "Bot",
        redirectUrl: "https://google.com",
        redirectVersion: 0,
        message: "Classification failed - fail secure", 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }`;

code = code.replace(catchTarget, catchReplacement);
fs.writeFileSync('server/routes.ts', code);
