const fs = require('fs');
let code = fs.readFileSync('server/routes.ts', 'utf8');

const target = '        redirectUrl: "https://google.com",\n        redirectVersion: 0,\n        message: "Classification failed - fail secure",';
const replacement = '        redirectUrl: typeof botUrl !== "undefined" ? botUrl : "https://google.com",\n        redirectVersion: typeof redirectVersion !== "undefined" ? redirectVersion : 0,\n        message: "Classification failed - fail secure",';

code = code.replace(target, replacement);
fs.writeFileSync('server/routes.ts', code);
