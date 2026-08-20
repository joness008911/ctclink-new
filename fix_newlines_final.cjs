const fs = require('fs');
let code = fs.readFileSync('client/src/pages/user-dashboard.tsx', 'utf8');

// Find the phpContent assignment and fix its newlines
const startIdx = code.indexOf('const phpContent = `<?php');
const endIdx = code.indexOf('?>`;', startIdx);
if (startIdx !== -1 && endIdx !== -1) {
    const section = code.substring(startIdx, endIdx + 4);
    const fixedSection = section.replace(/\\n/g, '\n');
    code = code.substring(0, startIdx) + fixedSection + code.substring(endIdx + 4);
    fs.writeFileSync('client/src/pages/user-dashboard.tsx', code);
    console.log('Fixed newlines');
} else {
    console.log('Could not find phpContent section');
}
