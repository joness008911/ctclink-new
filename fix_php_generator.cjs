const fs = require('fs');
let code = fs.readFileSync('client/src/pages/user-dashboard.tsx', 'utf8');

// 1. Add isLoading to apiKeyValue
code = code.replace(
`  const { data: apiKeyValue } = useQuery<{ keyValue: string | null }>({`,
`  const { data: apiKeyValue, isLoading: keyLoading } = useQuery<{ keyValue: string | null }>({`
);

// 2. Add loading state to Download Script Button
const btnOld = `<Button
                    onClick={handleDownloadScript}
                    className="gap-2"
                    data-testid="button-download-script"
                  >
                    <Download className="h-4 w-4" />
                    Download Script (ZIP)
                  </Button>`;
                  
const btnNew = `<Button
                    onClick={handleDownloadScript}
                    className="gap-2"
                    disabled={urlsLoading || keyLoading || !apiKeyValue?.keyValue}
                    data-testid="button-download-script"
                  >
                    <Download className="h-4 w-4" />
                    {urlsLoading || keyLoading ? "Loading Configuration..." : "Download Script (ZIP)"}
                  </Button>`;
                  
code = code.replace(btnOld, btnNew);

// 3. Fix the google.com fallback in PHP Content
const phpOld = `// Fail-secure fallback if classification API is unreachable
if (!$redirectUrl) {
    $redirectUrl = '\${botUrl || 'https://google.com'}';
}`;

const phpNew = `// Fail-secure fallback if classification API is unreachable
if (!$redirectUrl) {
    $redirectUrl = '\${botUrl || 'https://example.com/blocked'}';
}`;

code = code.replace(phpOld, phpNew);

// Also check for google.com in the input placeholder
code = code.replace(`placeholder="https://google.com"`, `placeholder="https://example.com/blocked"`);

fs.writeFileSync('client/src/pages/user-dashboard.tsx', code);
console.log('done');
