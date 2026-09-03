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
  // RULE 2: ABSOLUTE MALICIOUS KILLSWITCHES (Always Bot, Even If VPN is Allowed)
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

  if (isWebCrawler || isAiCrawler) {
    return {
      verdict: 'Bot',
      detectionMethod: isAiCrawler ? 'AI Scraper via Proxy' : 'Proxy Web Crawler',
      blockReason: 'Automated crawler traversing proxy pool',
      riskScore: 94,
      subType: isAiCrawler ? 'AI Training Scraper' : 'Web Crawler Proxy',
      threatLevel: 'high',
      signals: ['Crawler signature confirmed by IP intelligence', 'Automated indexing bot']
    };
  }

  if (isTor && policy.blockTor !== 'allow') {
    return {
      verdict: 'Bot',
      detectionMethod: 'TOR Exit Node',
      blockReason: 'Tor anonymity network exit node detected',
      riskScore: 95,
      subType: 'Tor Anonymity Node',
      threatLevel: 'high',
      signals: ['Tor cryptographic relay exit node', 'High-risk anonymity bypass']
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
  // RULE 3: MULTI-DIMENSIONAL RISK SCORING FOR AMBIGUOUS & CLEAN VPNS
  // =========================================================================
  let riskScore = 25; // Base starting risk for any proxy/VPN

  // 1. IP2Location Fraud Score contribution (0 to 100)
  const normalizedFraud = Math.max(0, Math.min(100, fraudScore || 0));
  if (normalizedFraud > 0) {
    const fraudContribution = Math.round(normalizedFraud * 0.4); // Max +40 points
    riskScore += fraudContribution;
    if (normalizedFraud > 60) {
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
    // Apple iCloud Private Relay, Google One VPN, etc.
    riskScore -= 35;
    signals.push('Consumer Privacy Network verified (Apple iCloud Relay / Google One) (-35 risk)');
  } else if (isEnterprisePrivateNet) {
    riskScore -= 15;
    signals.push('Enterprise Private Network verified (corporate VPN) (-15 risk)');
  }

  if (isResidentialProxy) {
    // Commercial scraping proxies (BrightData, Oxylabs, Smartproxy)
    riskScore += 35;
    signals.push('Commercial rotating residential proxy pool detected (+35 risk)');
  }

  if (isPublicProxy || isWebProxy) {
    riskScore += 30;
    signals.push('Public / open web proxy detected (+30 risk)');
  }

  // Known trusted consumer VPN brands (NordVPN, ExpressVPN, ProtonVPN, Mullvad, Surfshark)
  const trustedVpnKeywords = ['nord', 'express', 'proton', 'mullvad', 'surfshark', 'pia', 'private internet access', 'cloudflare'];
  const isRecognizedConsumerVpn = trustedVpnKeywords.some(k => provider.includes(k) || ispName.toLowerCase().includes(k));
  if (isRecognizedConsumerVpn && !isResidentialProxy && threat !== 'high' && threat !== 'extreme') {
    riskScore -= 20;
    signals.push(`Recognized consumer privacy VPN provider: ${provider || ispName} (-20 risk)`);
  }

  // 4. Client-Side HTTP & Header Consistency Checks
  const getHeader = (key: string): string => {
    const val = headers[key] || headers[key.toLowerCase()] || '';
    return Array.isArray(val) ? val.join(', ') : (val || '');
  };

  const acceptLang = getHeader('accept-language') || getHeader('accept_language');
  const acceptHeader = getHeader('accept');
  const secChUa = getHeader('sec-ch-ua');
  const secChUaPlatform = getHeader('sec-ch-ua-platform');
  const secFetchSite = getHeader('sec-fetch-site');

  // Human browsers almost always provide Accept-Language
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

  // User-Agent inspection for automation tools
  const lowerUa = (userAgent || '').toLowerCase();
  const automationKeywords = [
    'headless', 'phantomjs', 'puppeteer', 'playwright', 'selenium', 
    'webdriver', 'python', 'curl', 'wget', 'go-http', 'axios', 'postman'
  ];
  const hasAutomationUa = automationKeywords.some(kw => lowerUa.includes(kw));
  if (hasAutomationUa) {
    riskScore += 50;
    signals.push('Automated headless browser or HTTP library in User-Agent (+50 risk)');
  }

  // Clamp risk score to [5, 98]
  riskScore = Math.max(5, Math.min(98, riskScore));

  // =========================================================================
  // RULE 4: FINAL SAFE VERDICT BASED ON COMPOSITE RISK SCORE
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
