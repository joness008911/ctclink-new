/**
 * Safe Multi-Layer Classification Engine for VPN & Proxy Visitors
 * 
 * Protects against:
 * 1. Malicious botnets & vulnerability scanners hiding on proxy pools
 * 2. Rotating residential proxies rented by commercial scrapers (BrightData, Oxylabs, etc.)
 * 3. Headless automation & synthetic browser sessions running through VPNs
 * 
 * While safely permitting:
 * 1. Legitimate consumer privacy users (Apple iCloud Private Relay, Google One VPN)
 * 2. Real human buyers using trusted commercial VPNs (NordVPN, ExpressVPN, Mullvad, etc.)
 * 3. Clean enterprise private networks with authentic browser telemetry
 */

export interface Ip2ProxyData {
  last_seen?: number | string;
  proxy_type?: string;
  threat?: string;
  provider?: string;
  is_vpn?: boolean;
  is_tor?: boolean;
  is_data_center?: boolean;
  is_public_proxy?: boolean;
  is_web_proxy?: boolean;
  is_web_crawler?: boolean;
  is_ai_crawler?: boolean;
  is_residential_proxy?: boolean;
  is_consumer_privacy_network?: boolean;
  is_enterprise_private_network?: boolean;
  is_spammer?: boolean;
  is_scanner?: boolean;
  is_botnet?: boolean;
  is_bogon?: boolean;
}

export interface VpnClassificationPolicy {
  blockVpn: 'block' | 'allow';
  allowVpn: boolean;
  blockDatacenter: 'block' | 'allow';
  blockTor: 'block' | 'allow';
  allowSearchCrawlers?: 'block' | 'allow';
  blockAiCrawlers?: 'block' | 'allow';
  allowSocialPreviews?: 'block' | 'allow';
}

export interface VpnClassificationResult {
  verdict: 'Human' | 'Bot';
  detectionMethod: string;
  blockReason: string;
  riskScore: number; // 0 - 100
  subType: string;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  signals: string[];
}

/**
 * Normalizes boolean values from string/boolean representations in upstream APIs
 */
function toBool(val: any): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;
  if (typeof val === 'string') {
    const s = val.toLowerCase().trim();
    return s === 'true' || s === '1' || s === 'yes';
  }
  return false;
}

/**
 * Evaluates a visitor detected on a VPN or Proxy with multi-factor risk scoring
 */
export function evaluateSafeProxyClassification(
  proxyData: Ip2ProxyData | null | undefined,
  fraudScore: number,
  usageType: string,
  ispName: string,
  headers: Record<string, string | string[] | undefined>,
  userAgent: string,
  policy: VpnClassificationPolicy,
  isDatacenterAsn: boolean
): VpnClassificationResult {
  const p = proxyData || {};
  const isVpn = toBool(p.is_vpn);
  const isTor = toBool(p.is_tor);
  const isDataCenter = toBool(p.is_data_center) || usageType === 'DCH' || isDatacenterAsn;
  const isPublicProxy = toBool(p.is_public_proxy);
  const isWebProxy = toBool(p.is_web_proxy);
  const isWebCrawler = toBool(p.is_web_crawler);
  const isAiCrawler = toBool(p.is_ai_crawler);
  const isResidentialProxy = toBool(p.is_residential_proxy);
  const isConsumerPrivacyNet = toBool(p.is_consumer_privacy_network);
  const isEnterprisePrivateNet = toBool(p.is_enterprise_private_network);
  const isSpammer = toBool(p.is_spammer);
  const isScanner = toBool(p.is_scanner);
  const isBotnet = toBool(p.is_botnet);
  const isBogon = toBool(p.is_bogon);
  const threat = (p.threat || '-').toLowerCase();
  const provider = (p.provider || '').toLowerCase();

  const signals: string[] = [];

  // =========================================================================
  // RULE 1: STRICT USER POLICY (If user has configured "Block VPN & Proxies")
  // =========================================================================
  const isVpnExplicitlyAllowed = policy.blockVpn === 'allow' || policy.allowVpn === true;

  if (!isVpnExplicitlyAllowed) {
    return {
      verdict: 'Bot',
      detectionMethod: isTor ? 'TOR Exit Node' : (isVpn ? 'VPN Detected (Blocked by Policy)' : 'Proxy Detected (Blocked by Policy)'),
      blockReason: 'VPN & Proxy visitors blocked by your routing policy',
      riskScore: 78,
      subType: isTor ? 'Tor Exit Node' : (isVpn ? 'Commercial VPN' : 'Proxy Anonymizer'),
      threatLevel: isTor ? 'high' : 'medium',
      signals: ['User routing rule enforces strict VPN/Proxy deflection']
    };
  }

  // =========================================================================
  // RULE 2: CLIENT-SIDE HTTP TELEMETRY & HARDWARE PLATFORM PARSING
  // =========================================================================
  const getHeader = (key: string): string => {
    const val = headers[key] || headers[key.toLowerCase()] || '';
    return Array.isArray(val) ? val.join(', ') : (val || '');
  };

  const acceptLang = getHeader('accept-language') || getHeader('accept_language');
  const acceptHeader = getHeader('accept');
  const secChUa = getHeader('sec-ch-ua');
  const rawPlatform = getHeader('sec-ch-ua-platform') || '';
  const secChUaPlatform = rawPlatform.replace(/['"]/g, '').trim();
  const secFetchSite = getHeader('sec-fetch-site');

  const lowerUa = (userAgent || '').toLowerCase();
  const isAppleDevice = lowerUa.includes('iphone') || lowerUa.includes('ipad') || lowerUa.includes('ipod') || lowerUa.includes('macintosh') || lowerUa.includes('mac os x') || lowerUa.includes('darwin');
  const isWindowsDevice = lowerUa.includes('windows') || lowerUa.includes('win64') || lowerUa.includes('win32') || lowerUa.includes('wow64');
  const isAndroidDevice = lowerUa.includes('android');
  const isLinuxDevice = (lowerUa.includes('linux') || lowerUa.includes('x11')) && !isAndroidDevice;

  // Detect automated scraping frameworks & headless libraries
  const automationKeywords = [
    'headless', 'phantomjs', 'puppeteer', 'playwright', 'selenium', 
    'webdriver', 'python', 'curl', 'wget', 'go-http', 'axios', 'postman',
    'aiohttp', 'scrapy', 'node-fetch', 'insomnia', 'httpclient', 'undici'
  ];
  const hasAutomationUa = automationKeywords.some(kw => lowerUa.includes(kw));

  // Platform client hint mismatch (e.g., UA claims Windows, but client hint sends Linux)
  let hasPlatformMismatch = false;
  if (secChUaPlatform) {
    const normPlatform = secChUaPlatform.toLowerCase();
    if (normPlatform.includes('windows') && !isWindowsDevice) {
      hasPlatformMismatch = true;
    } else if (normPlatform.includes('mac') && !isAppleDevice) {
      hasPlatformMismatch = true;
    } else if (normPlatform.includes('android') && !isAndroidDevice) {
      hasPlatformMismatch = true;
    } else if (normPlatform.includes('linux') && !isLinuxDevice && !isAndroidDevice) {
      hasPlatformMismatch = true;
    }
  }

  // =========================================================================
  // RULE 3: ABSOLUTE MALICIOUS KILLSWITCHES (Always Bot, Even If VPN is Allowed)
  // Real humans never browse from botnets, vulnerability scanners, or spam networks.
  // =========================================================================
  if (isBotnet) {
    return {
      verdict: 'Bot',
      detectionMethod: 'Botnet Node Detected',
      blockReason: 'Active botnet zombie/control node identified',
      riskScore: 99,
      subType: 'Botnet Drone',
      threatLevel: 'critical',
      signals: ['Identified active botnet IP address', 'Zero-trust policy killswitch triggered']
    };
  }

  if (isSpammer) {
    return {
      verdict: 'Bot',
      detectionMethod: 'Spam Network Proxy',
      blockReason: 'Known automated spam-generating source IP',
      riskScore: 96,
      subType: 'Spam Network Proxy',
      threatLevel: 'high',
      signals: ['High-frequency spam telemetry detected', 'Blacklisted spam proxy pool']
    };
  }

  if (isScanner) {
    return {
      verdict: 'Bot',
      detectionMethod: 'Vulnerability Scanner IP',
      blockReason: 'Automated vulnerability / port scanner detected',
      riskScore: 98,
      subType: 'Network Scanner',
      threatLevel: 'critical',
      signals: ['Port scan & vulnerability probe activity', 'Security researcher or exploit bot']
    };
  }

  if (isBogon) {
    return {
      verdict: 'Bot',
      detectionMethod: 'Bogon / Spoofed Address',
      blockReason: 'Unallocated or bogon IP address detected',
      riskScore: 95,
      subType: 'Bogon IP',
      threatLevel: 'high',
      signals: ['Unrouted / bogon IP address space', 'Packet spoofing suspect']
    };
  }

  // Automation / Headless engine killswitch
  if (hasAutomationUa) {
    return {
      verdict: 'Bot',
      detectionMethod: 'Automated Headless Engine (Blocked)',
      blockReason: 'Headless browser automation tool or scraping library identified',
      riskScore: 99,
      subType: 'Headless Scraper Bot',
      threatLevel: 'critical',
      signals: ['Automated framework keyword detected in User-Agent', 'Zero-trust scraper killswitch']
    };
  }

  // Platform client-hint spoofing killswitch (scraper running in Linux container claiming Windows/Mac)
  if (hasPlatformMismatch) {
    return {
      verdict: 'Bot',
      detectionMethod: 'Platform Fingerprint Spoofing (Blocked)',
      blockReason: 'Cryptographic client hint platform directly contradicts User-Agent',
      riskScore: 98,
      subType: 'Fingerprint Spoofed Bot',
      threatLevel: 'critical',
      signals: [
        'Sec-CH-UA-Platform contradicts declared OS User-Agent',
        `Client Hint: "${secChUaPlatform}", Declared OS: ${isWindowsDevice ? 'Windows' : isAppleDevice ? 'macOS/iOS' : isAndroidDevice ? 'Android' : 'Linux'}`
      ]
    };
  }

  // Public / Web proxies are free anonymizers used almost exclusively for fraud/scraping
  if (isPublicProxy || isWebProxy) {
    return {
      verdict: 'Bot',
      detectionMethod: isPublicProxy ? 'Public Open Proxy (Blocked)' : 'Web Proxy Anonymizer (Blocked)',
      blockReason: 'Public open proxy or web anonymizer detected - proxy access restricted by policy',
      riskScore: 95,
      subType: isPublicProxy ? 'Public Open Proxy' : 'Web Proxy',
      threatLevel: 'high',
      signals: ['Public open proxy detected from threat intelligence feeds', 'High risk of automated scraping/abuse']
    };
  }

  if (isAiCrawler) {
    if (policy.blockAiCrawlers === 'allow') {
      return {
        verdict: 'Human',
        detectionMethod: 'Authorized AI Crawler',
        blockReason: '',
        riskScore: 20,
        subType: 'AI Crawler',
        threatLevel: 'low',
        signals: ['AI crawler allowed by user policy']
      };
    } else {
      return {
        verdict: 'Bot',
        detectionMethod: 'AI Scraper via Proxy',
        blockReason: 'Automated AI scraper traversing proxy pool',
        riskScore: 94,
        subType: 'AI Training Scraper',
        threatLevel: 'high',
        signals: ['AI Crawler signature confirmed by threat intelligence', 'Automated scraping bot']
      };
    }
  }

  if (isWebCrawler || usageType === 'SES') {
    const isSes = usageType === 'SES';
    if (policy.allowSearchCrawlers !== 'block') {
      return {
        verdict: 'Human',
        detectionMethod: isSes ? 'Verified Search Engine Spider (SES)' : 'Web Crawler (Allowed by Policy)',
        blockReason: '',
        riskScore: 10,
        subType: 'Search Engine Spider',
        threatLevel: 'low',
        signals: [isSes ? 'SES usage type confirmed' : 'Web crawler signature allowed by SEO policy']
      };
    } else {
      return {
        verdict: 'Bot',
        detectionMethod: isSes ? 'Search Engine Spider (Blocked by Policy)' : 'Proxy Web Crawler (Blocked by Policy)',
        blockReason: isSes ? 'Search engine spider network address identified' : 'Automated crawler traversing proxy pool',
        riskScore: 94,
        subType: isSes ? 'Search Engine Spider' : 'Web Crawler Proxy',
        threatLevel: 'high',
        signals: [isSes ? 'SES usage type confirmed by IP threat intelligence' : 'Crawler signature confirmed by IP intelligence', 'Automated indexing bot']
      };
    }
  }

  if (isTor && policy.blockTor !== 'allow') {
    return {
      verdict: 'Bot',
      detectionMethod: 'TOR Exit Node',
      blockReason: 'Tor anonymity network exit node detected',
      riskScore: 95,
      subType: 'Tor Anonymity Node',
      threatLevel: 'high',
      signals: ['Tor cryptographic relay exit node', 'High-risk anonymity proxy']
    };
  }

  if (isDataCenter && policy.blockDatacenter !== 'allow') {
    return {
      verdict: 'Bot',
      detectionMethod: 'Datacenter VPN (DCH)',
      blockReason: 'Datacenter / cloud hosting server VPN detected',
      riskScore: 88,
      subType: 'Datacenter Server',
      threatLevel: 'high',
      signals: ['Hosting facility / server farm IP', 'Cloud infrastructure exit']
    };
  }

  // =========================================================================
  // RULE 4: APPLE ICLOUD PRIVATE RELAY STRICT OS INTEGRITY CHECK
  // Apple iCloud Private Relay strictly operates on Apple iOS, iPadOS, and macOS Safari.
  // If an Apple Relay IP arrives with Windows, Android, or Linux OS signatures, it is fraudulent.
  // =========================================================================
  if (isConsumerPrivacyNet) {
    const isNonAppleOs = isWindowsDevice || isAndroidDevice || isLinuxDevice ||
      ['windows', 'android', 'linux'].some(p => secChUaPlatform.toLowerCase().includes(p));

    if (isNonAppleOs) {
      return {
        verdict: 'Bot',
        detectionMethod: 'Spoofed Apple Relay Signature (Blocked)',
        blockReason: 'Non-Apple operating system signature detected on Apple iCloud Private Relay egress IP',
        riskScore: 98,
        subType: 'Spoofed Privacy Relay',
        threatLevel: 'critical',
        signals: [
          'Apple iCloud Private Relay IP detected with non-Apple OS User-Agent or Client Hint',
          `Declared OS: ${isWindowsDevice ? 'Windows' : isAndroidDevice ? 'Android' : 'Linux'}, Platform Hint: "${secChUaPlatform || 'None'}"`
        ]
      };
    }
  }

  // Normalized fraud score from IP intelligence (0 to 100)
  const normalizedFraud = Math.max(0, Math.min(100, fraudScore || 0));
  const uType = (usageType || '').toUpperCase().trim();
  const isHomeOrMobileIsp = ['ISP', 'MOB', 'ISP/MOB'].includes(uType);

  // =========================================================================
  // RULE 5: HARDENED RESIDENTIAL PROXY DEFENSE
  // Protects genuine home Wi-Fi / mobile dynamic IPs while stopping commercial scraping pools
  // =========================================================================
  if (isResidentialProxy) {
    // Case A: Residential proxy signature on non-consumer infrastructure (DCH, COM, ORG, unknown)
    if (!isHomeOrMobileIsp && uType !== '') {
      return {
        verdict: 'Bot',
        detectionMethod: 'Commercial Residential Proxy Scraping Pool',
        blockReason: 'Commercial rotating residential proxy pool detected on server infrastructure',
        riskScore: 96,
        subType: 'Residential Scraping Proxy',
        threatLevel: 'high',
        signals: [
          'Commercial residential proxy network node identified',
          `Non-residential network usage type: ${uType || 'Unknown'}`
        ]
      };
    }

    // Case B: Residential proxy on home/mobile Wi-Fi, but with elevated fraud score (> 20) or threat level
    if (normalizedFraud > 20 || threat === 'high' || threat === 'extreme') {
      return {
        verdict: 'Bot',
        detectionMethod: 'Abuse-Flagged Residential Proxy (Blocked)',
        blockReason: `Residential IP with active abuse or elevated fraud score (${normalizedFraud}/100)`,
        riskScore: Math.max(85, normalizedFraud),
        subType: 'Abuse-Flagged Residential Proxy',
        threatLevel: 'high',
        signals: [
          'Residential proxy flagged with active malicious or scraping history',
          `Fraud score: ${normalizedFraud}/100, Threat level: ${threat}`
        ]
      };
    }

    // Case C: Missing human browser headers (scrapers cannot pass without legitimate headers)
    if (!acceptLang || acceptLang.trim().length < 2) {
      return {
        verdict: 'Bot',
        detectionMethod: 'Residential Proxy Scraper (Missing Headers)',
        blockReason: 'Residential proxy connection lacks authentic human Accept-Language header',
        riskScore: 92,
        subType: 'Residential Proxy Scraper',
        threatLevel: 'high',
        signals: ['Missing or stripped Accept-Language header on residential proxy connection']
      };
    }
  }

  // =========================================================================
  // RULE 6: COMMERCIAL CONSUMER VPN VERIFICATION (NordVPN, ExpressVPN, etc.)
  // Eliminates blind trust; blocks VPNs with elevated fraud history or missing telemetry
  // =========================================================================
  const trustedVpnKeywords = ['nord', 'express', 'proton', 'mullvad', 'surfshark', 'pia', 'private internet access', 'cloudflare'];
  const isRecognizedConsumerVpn = trustedVpnKeywords.some(k => provider.includes(k) || ispName.toLowerCase().includes(k));

  if (isVpn || isRecognizedConsumerVpn) {
    // If a commercial VPN has elevated fraud score (> 25) or high threat, block it!
    // Scrapers frequently rent NordVPN/Surfshark accounts for automated rotation.
    if (normalizedFraud > 25 || threat === 'high' || threat === 'extreme') {
      return {
        verdict: 'Bot',
        detectionMethod: 'Abuse-Flagged Commercial VPN (Blocked)',
        blockReason: `Commercial VPN tunnel with elevated threat or fraud score (${normalizedFraud}/100)`,
        riskScore: Math.max(82, normalizedFraud),
        subType: 'High-Risk Commercial VPN',
        threatLevel: 'high',
        signals: [
          'Commercial VPN with active abuse telemetry or elevated fraud history',
          `Fraud score: ${normalizedFraud}/100, Provider: ${provider || ispName}`
        ]
      };
    }

    // Commercial VPNs must provide authentic human browser headers
    if (!acceptLang || acceptLang.trim().length < 2) {
      return {
        verdict: 'Bot',
        detectionMethod: 'Automated VPN Scraper (Missing Headers)',
        blockReason: 'VPN tunnel connection missing standard human browser Accept-Language header',
        riskScore: 90,
        subType: 'Automated VPN Client',
        threatLevel: 'high',
        signals: ['Commercial VPN connection lacking standard human browser headers']
      };
    }
  }

  // =========================================================================
  // RULE 7: MULTI-DIMENSIONAL RISK SCORING FOR VERIFIED CONSUMER TRAFFIC
  // =========================================================================
  let riskScore = 25; // Base starting risk for proxy/VPN candidate

  // 1. IP2Location Fraud Score contribution (0 to 100)
  if (normalizedFraud > 0) {
    const fraudContribution = Math.round(normalizedFraud * 0.4); // Max +40 points
    riskScore += fraudContribution;
    if (normalizedFraud > 40) {
      signals.push(`Elevated fraud score: ${normalizedFraud}/100 (+${fraudContribution} risk)`);
    }
  }

  // 2. Threat Level Penalties
  if (threat === 'extreme') {
    riskScore += 45;
    signals.push('Extreme threat categorization by IP reputation (+45 risk)');
  } else if (threat === 'high') {
    riskScore += 30;
    signals.push('High threat categorization by IP reputation (+30 risk)');
  } else if (threat === 'medium') {
    riskScore += 15;
  }

  // 3. Proxy Sub-Type Deductions & Penalties
  if (isConsumerPrivacyNet) {
    // Apple iCloud Private Relay (pre-verified for Apple hardware above)
    riskScore -= 35;
    signals.push('Consumer Privacy Network verified (Apple iCloud Relay / Google One) (-35 risk)');
  } else if (isEnterprisePrivateNet) {
    riskScore -= 15;
    signals.push('Enterprise Private Network verified (corporate VPN) (-15 risk)');
  }

  if (isResidentialProxy) {
    // Strict baseline penalty for residential proxy on clean ISP/MOB.
    // It requires authentic browser language + modern client hints + clean fraud to pass.
    riskScore += 45;
    signals.push('Residential proxy flag present on home ISP/MOB network (+45 risk)');
  }

  // Conditional trust for recognized consumer VPNs ONLY when headers are authentic
  if (isRecognizedConsumerVpn && !isResidentialProxy && acceptLang && secChUa) {
    riskScore -= 10;
    signals.push(`Recognized consumer privacy VPN provider with valid client hints: ${provider || ispName} (-10 risk)`);
  }

  // 4. Granular IP2Location Usage Type Trust Adjustments
  if (uType === 'EDU') {
    riskScore -= 12;
    signals.push('Academic/University campus network verified (EDU) (-12 risk)');
  } else if (uType === 'GOV' || uType === 'MIL') {
    riskScore -= 15;
    signals.push('Government/Military network verified (GOV/MIL) (-15 risk)');
  } else if (uType === 'COM' || uType === 'ORG') {
    riskScore -= 10;
    signals.push('Corporate/Commercial enterprise network verified (COM/ORG) (-10 risk)');
  } else if (uType === 'LIB') {
    riskScore -= 8;
    signals.push('Public library institutional network verified (LIB) (-8 risk)');
  } else if (uType === 'MOB' || uType === 'ISP/MOB') {
    riskScore -= 5;
    signals.push('Mobile cellular carrier network verified (MOB) (-5 risk)');
  } else if (uType === 'ISP') {
    riskScore -= 5;
    signals.push('Residential fixed-line broadband ISP verified (ISP) (-5 risk)');
  } else if (uType === 'CDN') {
    if (isConsumerPrivacyNet) {
      signals.push('CDN-hosted consumer privacy relay verified (Apple Relay / Cloudflare)');
    } else {
      signals.push('CDN reverse-proxy edge node detected (CDN)');
    }
  }

  // 5. Client-Side HTTP & Header Consistency Checks
  if (acceptLang && acceptLang.trim().length >= 2) {
    riskScore -= 15;
    signals.push('Legitimate Accept-Language header present (-15 risk)');
  } else {
    riskScore += 25;
    signals.push('Missing or stripped Accept-Language header (+25 risk)');
  }

  // Modern browsers (Chrome, Edge, Opera, Samsung) provide Sec-CH-UA
  if (secChUa && secChUa.trim().length > 0) {
    riskScore -= 10;
    signals.push('Modern Sec-CH-UA client hint signature present (-10 risk)');
  }

  if (secFetchSite) {
    riskScore -= 5;
    signals.push('Valid Fetch metadata header present (-5 risk)');
  }

  // Clamp risk score to [5, 98]
  riskScore = Math.max(5, Math.min(98, riskScore));

  // =========================================================================
  // RULE 8: FINAL SAFE VERDICT BASED ON COMPOSITE RISK SCORE
  // Threshold: Score < 50 => Verified Human
  //            Score >= 50 => Bot / Scraper
  // =========================================================================
  if (riskScore < 50) {
    let subType = 'Verified Consumer VPN';
    let detectionMethod = `Verified Consumer VPN (Allowed, Risk: ${riskScore})`;

    if (isConsumerPrivacyNet) {
      subType = 'Consumer Privacy Network';
      detectionMethod = `Consumer Privacy Network (Apple/Google Relay, Risk: ${riskScore})`;
    } else if (isEnterprisePrivateNet) {
      subType = 'Enterprise Network';
      detectionMethod = `Enterprise Private Network (Allowed, Risk: ${riskScore})`;
    } else if (isResidentialProxy && isHomeOrMobileIsp) {
      subType = 'Verified Residential Home User';
      detectionMethod = `Verified Residential ISP (Dynamic IP Passed, Risk: ${riskScore})`;
    } else if (isVpn) {
      subType = 'Clean Residential VPN';
      detectionMethod = `Clean Consumer VPN (Allowed by User Policy, Risk: ${riskScore})`;
    } else {
      subType = 'Low-Risk Proxy';
      detectionMethod = `Low-Risk Proxy (Allowed, Risk: ${riskScore})`;
    }

    return {
      verdict: 'Human',
      detectionMethod,
      blockReason: '',
      riskScore,
      subType,
      threatLevel: riskScore < 25 ? 'low' : 'medium',
      signals: [
        ...signals,
        'Multi-vector verification passed: authentic browser headers, clean reputation, low fraud score'
      ]
    };
  }

  // High-Risk Proxy / Scraping Pool: Classify as Bot
  let subType = 'Suspicious Proxy';
  let detectionMethod = `Suspicious Proxy Pattern (Risk: ${riskScore})`;

  if (isResidentialProxy) {
    subType = 'Residential Proxy Pool';
    detectionMethod = `Residential Proxy Scraping Pool (Blocked, Risk: ${riskScore})`;
  } else if (threat === 'high' || threat === 'extreme' || normalizedFraud >= 70) {
    subType = 'High-Threat Anonymizer';
    detectionMethod = `High-Threat Anonymizer (Risk: ${riskScore}, Fraud: ${normalizedFraud})`;
  } else if (isPublicProxy || isWebProxy) {
    subType = 'Public Open Proxy';
    detectionMethod = `Public Open Proxy (Blocked, Risk: ${riskScore})`;
  }

  return {
    verdict: 'Bot',
    detectionMethod,
    blockReason: `Proxy failed multi-vector human integrity validation (Risk Score: ${riskScore}/100)`,
    riskScore,
    subType,
    threatLevel: riskScore >= 75 ? 'high' : 'medium',
    signals: [
      ...signals,
      'Multi-vector integrity check failed: suspicious proxy pool, high fraud score, or automation indicators'
    ]
  };
}

/**
 * Returns a human-friendly label for IP2Location usage_type codes
 */
export function formatUsageTypeDescription(usageType: string): string {
  const u = (usageType || '').toUpperCase().trim();
  switch (u) {
    case 'ISP': return 'Residential Fixed-Line Broadband (ISP)';
    case 'MOB': return 'Mobile Cellular Network (MOB)';
    case 'ISP/MOB': return 'Fixed-Line / Mobile Carrier (ISP/MOB)';
    case 'COM': return 'Commercial / Corporate Enterprise (COM)';
    case 'EDU': return 'Academic / University Campus (EDU)';
    case 'GOV': return 'Government Network (GOV)';
    case 'MIL': return 'Military Facility Network (MIL)';
    case 'ORG': return 'Non-Profit / Organization Network (ORG)';
    case 'LIB': return 'Public / University Library (LIB)';
    case 'CDN': return 'Content Delivery Network Edge (CDN)';
    case 'DCH': return 'Data Center / Cloud Hosting (DCH)';
    case 'SES': return 'Search Engine Spider (SES)';
    default: return usageType || 'Residential Broadband';
  }
}
