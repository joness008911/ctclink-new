import { storage } from "./storage";

export type Ip2LocationErrorType = 
  | 'quota_exhausted' 
  | 'invalid_key' 
  | 'service_down' 
  | 'timeout' 
  | 'network' 
  | 'none';

export type Ip2LocationStatus = 
  | 'healthy' 
  | 'exhausted' 
  | 'invalid_key' 
  | 'degraded' 
  | 'unconfigured';

export interface Ip2LocationHealthState {
  status: Ip2LocationStatus;
  provider: 'ip2location.io' | 'ip2geolocation.io' | 'none';
  lastChecked: string;
  lastSuccess: string | null;
  lastError: {
    code: string | number;
    message: string;
    timestamp: string;
    errorType: Ip2LocationErrorType;
  } | null;
  consecutiveFailures: number;
  latencyMs: number | null;
  totalLookups: number;
  successfulLookups: number;
  failedLookups: number;
  keyPreview: string | null;
  hasKey: boolean;
  alertMessage: string | null;
}

class Ip2LocationHealthMonitor {
  private state: Ip2LocationHealthState = {
    status: 'unconfigured',
    provider: 'ip2location.io',
    lastChecked: new Date().toISOString(),
    lastSuccess: null,
    lastError: null,
    consecutiveFailures: 0,
    latencyMs: null,
    totalLookups: 0,
    successfulLookups: 0,
    failedLookups: 0,
    keyPreview: null,
    hasKey: false,
    alertMessage: null,
  };

  private getEffectiveKeyFn: (() => Promise<string>) | null = null;
  private checkIntervalTimer: NodeJS.Timeout | null = null;
  private isChecking = false;

  constructor() {
    // Attempt to load persisted health snapshot on startup
    this.loadPersistedState().catch((err) => {
      console.warn("[IP2Location Health] Could not load persisted status:", err);
    });
  }

  private async loadPersistedState() {
    try {
      const persisted = await storage.getSetting('ip2location_health_status');
      if (persisted) {
        const parsed = JSON.parse(persisted);
        this.state = {
          ...this.state,
          ...parsed,
          // Retain live in-memory counters
          totalLookups: this.state.totalLookups,
          successfulLookups: this.state.successfulLookups,
          failedLookups: this.state.failedLookups,
        };
      }
    } catch (e) {
      // Non-fatal
    }
  }

  private async persistState() {
    try {
      const snapshot = JSON.stringify({
        status: this.state.status,
        provider: this.state.provider,
        lastChecked: this.state.lastChecked,
        lastSuccess: this.state.lastSuccess,
        lastError: this.state.lastError,
        consecutiveFailures: this.state.consecutiveFailures,
        latencyMs: this.state.latencyMs,
        alertMessage: this.state.alertMessage,
      });
      await storage.setSetting('ip2location_health_status', snapshot);
    } catch (e) {
      // Non-fatal
    }
  }

  public init(getKeyFn: () => Promise<string>) {
    this.getEffectiveKeyFn = getKeyFn;

    // Run first check after 3 seconds so the server finishes boot
    setTimeout(() => {
      this.runPeriodicHealthCheck().catch((err) => {
        console.warn("[IP2Location Health] Initial probe notice:", err);
      });
    }, 3000);

    // Periodic check every 10 minutes
    if (this.checkIntervalTimer) {
      clearInterval(this.checkIntervalTimer);
    }
    this.checkIntervalTimer = setInterval(() => {
      this.runPeriodicHealthCheck().catch((err) => {
        console.warn("[IP2Location Health] Periodic probe notice:", err);
      });
    }, 10 * 60 * 1000);
  }

  public getState(): Ip2LocationHealthState {
    return { ...this.state };
  }

  public recordSuccess(latencyMs: number, provider: 'ip2location.io' | 'ip2geolocation.io' = 'ip2location.io') {
    this.state.totalLookups++;
    this.state.successfulLookups++;
    this.state.consecutiveFailures = 0;
    this.state.latencyMs = latencyMs;
    this.state.lastSuccess = new Date().toISOString();
    this.state.provider = provider;
    
    // If previously in error/degraded due to transient failures, restore healthy
    if (this.state.status === 'degraded' || this.state.status === 'exhausted' || this.state.status === 'invalid_key') {
      this.state.status = 'healthy';
      this.state.alertMessage = null;
      this.persistState();
    }
  }

  public recordError(
    errorType: Ip2LocationErrorType, 
    code: string | number, 
    message: string,
    provider: 'ip2location.io' | 'ip2geolocation.io' = 'ip2location.io'
  ) {
    this.state.totalLookups++;
    this.state.failedLookups++;
    this.state.consecutiveFailures++;
    this.state.provider = provider;
    this.state.lastError = {
      code,
      message,
      timestamp: new Date().toISOString(),
      errorType,
    };

    if (errorType === 'quota_exhausted') {
      this.state.status = 'exhausted';
      this.state.alertMessage = `IP2Location API quota limit reached: ${message || 'INSUFFICIENT_CREDIT'}. Geolocation fallback is active.`;
      console.error(`🚨 [IP2Location Health Alert] QUOTA EXHAUSTED: ${message} (Code: ${code})`);
      this.persistState();
    } else if (errorType === 'invalid_key') {
      this.state.status = 'invalid_key';
      this.state.alertMessage = `IP2Location API key is invalid or expired: ${message || 'INVALID_API_KEY'}. Please update your key.`;
      console.error(`🚨 [IP2Location Health Alert] INVALID KEY: ${message} (Code: ${code})`);
      this.persistState();
    } else if (this.state.consecutiveFailures >= 3) {
      this.state.status = 'degraded';
      this.state.alertMessage = `IP2Location upstream connection degraded: ${message}. Failovers active.`;
      console.warn(`⚠️ [IP2Location Health Alert] Service Degraded: ${message} (Consecutive failures: ${this.state.consecutiveFailures})`);
      this.persistState();
    }
  }

  public async testKey(apiKey: string): Promise<{
    success: boolean;
    health: Ip2LocationHealthState;
    details?: any;
    message: string;
  }> {
    if (!apiKey || apiKey.trim().length === 0) {
      this.state.status = 'unconfigured';
      this.state.hasKey = false;
      this.state.keyPreview = null;
      this.state.alertMessage = 'No IP2Location API key configured.';
      await this.persistState();
      return {
        success: false,
        health: this.getState(),
        message: 'No API key provided',
      };
    }

    const trimmedKey = apiKey.trim();
    this.state.hasKey = true;
    this.state.keyPreview = trimmedKey.length > 8 
      ? `${trimmedKey.substring(0, 4)}*****${trimmedKey.substring(trimmedKey.length - 4)}` 
      : '****';
    this.state.lastChecked = new Date().toISOString();

    const startTime = Date.now();

    // 1. Test IP2Location.io first
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const testUrl = `https://api.ip2location.io/?key=${encodeURIComponent(trimmedKey)}&ip=8.8.8.8`;
      
      const res = await fetch(testUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'User-Agent': 'CleanTraffic-HealthCheck/1.0' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;
      this.state.latencyMs = latency;

      let body: any = null;
      try {
        body = await res.json();
      } catch (parseErr) {
        body = null;
      }

      if (res.ok && body && !body.error && (body.country_name || body.country_code)) {
        this.state.status = 'healthy';
        this.state.provider = 'ip2location.io';
        this.state.alertMessage = null;
        this.state.lastSuccess = new Date().toISOString();
        this.state.consecutiveFailures = 0;
        await this.persistState();

        return {
          success: true,
          health: this.getState(),
          details: {
            provider: 'ip2location.io',
            country: body.country_name,
            city: body.city_name,
            isp: body.as || body.isp,
            latencyMs: latency,
          },
          message: `IP2Location API verified successfully (${latency}ms latency).`,
        };
      }

      // Check specific error codes from IP2Location.io
      if (body?.error) {
        const errCode = body.error.error_code;
        const errMsg = body.error.error_message || 'API error';

        if (errCode === 10001 || errMsg.toUpperCase().includes('INSUFFICIENT') || errMsg.toUpperCase().includes('CREDIT') || errMsg.toUpperCase().includes('QUOTA')) {
          this.recordError('quota_exhausted', errCode, errMsg, 'ip2location.io');
          return {
            success: false,
            health: this.getState(),
            message: `Quota Exhausted: ${errMsg} (Code ${errCode}). Please replenish credits or renew plan.`,
          };
        } else if (errCode === 10000 || errMsg.toUpperCase().includes('INVALID_API_KEY')) {
          this.recordError('invalid_key', errCode, errMsg, 'ip2location.io');
          return {
            success: false,
            health: this.getState(),
            message: `Invalid API Key: ${errMsg} (Code ${errCode}). Check your key in the IP2Location dashboard.`,
          };
        } else {
          this.recordError('service_down', errCode, errMsg, 'ip2location.io');
          return {
            success: false,
            health: this.getState(),
            message: `IP2Location error: ${errMsg} (Code ${errCode}).`,
          };
        }
      }

      if (res.status === 429) {
        this.recordError('service_down', 429, 'Rate limit exceeded', 'ip2location.io');
        return {
          success: false,
          health: this.getState(),
          message: 'IP2Location rate limit exceeded (HTTP 429).',
        };
      }

      if (res.status >= 500) {
        this.recordError('service_down', res.status, `Server error HTTP ${res.status}`, 'ip2location.io');
      }
    } catch (e: any) {
      const isTimeout = e.name === 'AbortError';
      const msg = isTimeout ? 'Request timed out after 5000ms' : (e.message || 'Network error');
      this.recordError(isTimeout ? 'timeout' : 'network', isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR', msg, 'ip2location.io');
    }

    // 2. Secondary fallback test: IP2Geolocation.io
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const testUrl = `https://api.ip2geolocation.io/ipgeo?apiKey=${encodeURIComponent(trimmedKey)}&ip=8.8.8.8`;
      
      const res = await fetch(testUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'User-Agent': 'CleanTraffic-HealthCheck/1.0' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;
      this.state.latencyMs = latency;

      let body: any = null;
      try {
        body = await res.json();
      } catch (parseErr) {
        body = null;
      }

      if (res.ok && body && (body.country_name || body.country_code2)) {
        this.state.status = 'healthy';
        this.state.provider = 'ip2geolocation.io';
        this.state.alertMessage = null;
        this.state.lastSuccess = new Date().toISOString();
        this.state.consecutiveFailures = 0;
        await this.persistState();

        return {
          success: true,
          health: this.getState(),
          details: {
            provider: 'ip2geolocation.io',
            country: body.country_name,
            city: body.city,
            isp: body.isp,
            latencyMs: latency,
          },
          message: `Verified successfully via secondary provider ip2geolocation.io (${latency}ms latency).`,
        };
      }
    } catch (e) {
      // Ignored
    }

    await this.persistState();
    return {
      success: false,
      health: this.getState(),
      message: this.state.alertMessage || 'Failed to verify API key with IP2Location or IP2Geolocation.',
    };
  }

  public async runPeriodicHealthCheck(): Promise<void> {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      if (!this.getEffectiveKeyFn) return;
      const apiKey = await this.getEffectiveKeyFn();
      if (!apiKey || !apiKey.trim()) {
        this.state.status = 'unconfigured';
        this.state.hasKey = false;
        this.state.keyPreview = null;
        this.state.alertMessage = 'No API key configured for geolocation services.';
        await this.persistState();
        return;
      }

      await this.testKey(apiKey);
    } catch (err) {
      console.warn("[IP2Location Health Monitor] Periodic check notice:", err);
    } finally {
      this.isChecking = false;
    }
  }
}

export const ip2LocationHealth = new Ip2LocationHealthMonitor();
