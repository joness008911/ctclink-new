import { 
  type User, 
  type InsertUser, 
  type Classification, 
  type InsertClassification,
  type DetectionRules,
  type InsertDetectionRules,
  type ApiKey,
  type InsertApiKey,
  type CountryWhitelist,
  type InsertCountryWhitelist,
  type IspWhitelist,
  type InsertIspWhitelist,
  type IspBlacklist,
  type InsertIspBlacklist,
  type IpBlocklist,
  type InsertIpBlocklist,
  type CidrBlocklist,
  type InsertCidrBlocklist,
  type ClientIpWhitelist,
  type InsertClientIpWhitelist,
  type ClientUser,
  type InsertClientUser,
  type UserRedirectUrls,
  type InsertUserRedirectUrls,
  type DomainPool,
  type InsertDomainPool,
  type UserDomainGeneration,
  type InsertUserDomainGeneration,
  type AuditLog,
  type InsertAuditLog,
  users,
  classifications,
  detectionRules,
  apiKeys,
  countryWhitelist,
  ispWhitelist,
  ispBlacklist,
  ipBlocklist,
  cidrBlocklist,
  clientIpWhitelist,
  clientUsers,
  userRedirectUrls,
  settings,
  domainPool,
  userDomainGenerations,
  stripeProcessedEvents,
  auditLogs,
} from "@shared/schema";
import { randomUUID } from "crypto";
import * as ipaddr from "ipaddr.js";
import bcrypt from "bcrypt";
import { db, isDatabaseConfigured } from "./db";
import { isFirestoreAvailable } from "./firebase";
import { FirestoreStorage } from "./firestoreStorage";
import { eq, desc, sql, count, lt, or, inArray } from "drizzle-orm";

// IP2Geo Cache for performance optimization
interface CachedIPData {
  data: any;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class IP2GeoCache {
  private cache = new Map<string, CachedIPData>();
  private readonly DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes
  
  set(ip: string, data: any, ttl = this.DEFAULT_TTL): void {
    this.cache.set(ip, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  get(ip: string): any | null {
    const cached = this.cache.get(ip);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(ip);
      return null;
    }
    
    return cached.data;
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  size(): number {
    return this.cache.size;
  }
}

export const ip2geoCache = new IP2GeoCache();

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createClassification(classification: InsertClassification): Promise<Classification>;
  getRecentClassifications(limit?: number): Promise<Classification[]>;
  getClassificationStats(): Promise<{
    totalClassifications: number;
    humanVisitors: number;
    botTraffic: number;
    apiRequests: number;
  }>;
  
  getDetectionRules(): Promise<DetectionRules | undefined>;
  updateDetectionRules(rules: InsertDetectionRules): Promise<DetectionRules>;
  
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  getApiKeys(): Promise<ApiKey[]>;
  getApiKey(keyValue: string): Promise<ApiKey | undefined>; // Get by key value
  getApiKeyById(id: string): Promise<ApiKey | undefined>; // Get by ID
  getApiKeyByValue(keyValue: string): Promise<ApiKey | undefined>; // Alias for getApiKey
  deleteApiKey(id: string): Promise<boolean>;
  updateApiKey(id: string, updates: Partial<ApiKey>): Promise<ApiKey | undefined>;
  incrementApiKeyUsage(keyValue: string): Promise<boolean>;
  pauseApiKey(id: string): Promise<boolean>;
  renewApiKey(id: string): Promise<ApiKey | undefined>;
  
  // Country Whitelist methods
  getCountryWhitelist(): Promise<CountryWhitelist[]>;
  addCountryToWhitelist(country: InsertCountryWhitelist): Promise<CountryWhitelist>;
  removeCountryFromWhitelist(id: string): Promise<boolean>;
  toggleCountryWhitelist(id: string, enabled: boolean): Promise<boolean>;
  isCountryAllowed(countryCode: string): Promise<boolean>;
  
  // ISP Whitelist methods
  getIspWhitelist(countryCode?: string): Promise<IspWhitelist[]>;
  addIspToWhitelist(isp: InsertIspWhitelist): Promise<IspWhitelist>;
  removeIspFromWhitelist(id: string): Promise<boolean>;
  toggleIspWhitelist(id: string, enabled: boolean): Promise<boolean>;
  isIspWhitelisted(ispName: string): Promise<boolean>;
  
  // ISP Blacklist methods
  getIspBlacklist(): Promise<IspBlacklist[]>;
  addIspToBlacklist(isp: InsertIspBlacklist): Promise<IspBlacklist>;
  bulkAddIspsToBlacklist(ispNames: string[], category: string): Promise<{ added: number; skipped: number; errors: string[] }>;
  removeIspFromBlacklist(id: string): Promise<boolean>;
  toggleIspBlacklist(id: string, enabled: boolean): Promise<boolean>;
  isIspBlacklisted(ispName: string): Promise<boolean>;
  
  // IP Blocklist methods
  getIpBlocklist(): Promise<IpBlocklist[]>;
  addIpToBlocklist(ip: InsertIpBlocklist): Promise<IpBlocklist>;
  removeIpFromBlocklist(id: string): Promise<boolean>;
  toggleIpBlocklist(id: string, enabled: boolean): Promise<boolean>;
  isIpBlocked(ipAddress: string): Promise<boolean>;
  
  // CIDR Blocklist methods
  getCidrBlocklist(): Promise<CidrBlocklist[]>;
  addCidrToBlocklist(cidr: InsertCidrBlocklist): Promise<CidrBlocklist>;
  removeCidrFromBlocklist(id: string): Promise<boolean>;
  toggleCidrBlocklist(id: string, enabled: boolean): Promise<boolean>;
  isIpInBlockedCidrRange(ipAddress: string): Promise<boolean>;
  
  // Client IP Whitelist methods (for /user dashboard access control)
  getClientIpWhitelist(): Promise<ClientIpWhitelist[]>;
  addIpToWhitelist(ip: InsertClientIpWhitelist): Promise<ClientIpWhitelist>;
  removeIpFromWhitelist(id: string): Promise<boolean>;
  toggleIpWhitelist(id: string, enabled: boolean): Promise<boolean>;
  isIpWhitelisted(ipAddress: string): Promise<boolean>;
  isClientWhitelistEnabled(): Promise<boolean>;
  setClientWhitelistEnabled(enabled: boolean): Promise<void>;
  
  // Client User methods (for end-user customers)
  createClientUser(user: InsertClientUser): Promise<ClientUser>;
  getClientUser(id: string): Promise<ClientUser | undefined>;
  getClientUserByUsername(username: string): Promise<ClientUser | undefined>;
  getClientUserByEmail(email: string): Promise<ClientUser | undefined>;
  getClientUserByUsernameOrEmail(identifier: string): Promise<ClientUser | undefined>;
  updateClientUser(id: string, updates: Partial<ClientUser>): Promise<ClientUser | undefined>;
  getClientUserByApiKey(apiKeyId: string): Promise<ClientUser | undefined>;
  getAllClientUsers(): Promise<ClientUser[]>;
  getClientUserByStripeCustomerId(stripeCustomerId: string): Promise<ClientUser | undefined>;
  // Atomically claims an event lease; returns true (new claim or stale-lease reclaim) or
  // false (true duplicate with processedAt set, or concurrent in-flight within 5 min).
  claimStripeEvent(eventId: string): Promise<boolean>;
  // Marks the event as permanently processed (called after successful DB mutation).
  markStripeEventProcessed(eventId: string): Promise<void>;
  // Deletes the claim entirely so Stripe can retry immediately after a caught error.
  releaseStripeEvent(eventId: string): Promise<void>;
  
  // User Redirect URLs methods
  getUserRedirectUrls(userId: string): Promise<UserRedirectUrls | undefined>;
  setUserRedirectUrls(userId: string, urls: { 
    humanUrl: string; 
    botUrl: string; 
    allowedCountries?: string; 
    allowedDevices?: string;
    desktopOsFilter?: string;
    blockVpn?: string;
    blockDatacenter?: string;
    blockTor?: string;
    fingerprintActivate?: string;
    wildcardSubdomains?: string;
    allowVpn?: boolean;
  }): Promise<UserRedirectUrls>;
  
  // Classification methods for users
  getUserClassifications(apiKeyId: string, limit?: number): Promise<Classification[]>;
  getUserStats(apiKeyId: string): Promise<{
    totalClassifications: number;
    humanVisitors: number;
    botTraffic: number;
  }>;
  
  // Settings methods
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  
  // Domain Pool methods (admin manages available domains)
  getDomainPool(): Promise<DomainPool[]>;
  addDomainToPool(domain: InsertDomainPool): Promise<DomainPool>;
  removeDomainFromPool(id: string): Promise<boolean>;
  toggleDomainInPool(id: string, enabled: boolean): Promise<boolean>;
  getDomainFromPool(id: string): Promise<DomainPool | undefined>;
  
  // User Domain Generations (track user's generated domains for daily limits)
  getUserDomainGenerations(userId: string): Promise<UserDomainGeneration[]>;
  getUserDomainGenerationsToday(userId: string): Promise<UserDomainGeneration[]>;
  createUserDomainGeneration(generation: InsertUserDomainGeneration): Promise<UserDomainGeneration>;
  getDailyGenerationLimit(): Promise<number>;
  setDailyGenerationLimit(limit: number): Promise<void>;

  // Audit Log methods
  createAuditLog(entry: InsertAuditLog): Promise<AuditLog>;
  getRecentAuditLogs(limit?: number): Promise<AuditLog[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private classifications: Map<string, Classification>;
  private detectionRules: DetectionRules | undefined;
  private apiKeys: Map<string, ApiKey>;
  private countryWhitelist: Map<string, CountryWhitelist>;
  private ispWhitelist: Map<string, IspWhitelist>;
  private ispBlacklist: Map<string, IspBlacklist>;
  private ipBlocklist: Map<string, IpBlocklist>;
  private cidrBlocklist: Map<string, CidrBlocklist>;
  private clientIpWhitelist: Map<string, ClientIpWhitelist>;
  private clientUsers: Map<string, ClientUser>;
  private redirectUrls: Map<string, UserRedirectUrls>;
  private settings: Map<string, string>;
  private auditLogsData: AuditLog[];

  constructor() {
    this.users = new Map();
    this.classifications = new Map();
    this.apiKeys = new Map();
    this.countryWhitelist = new Map();
    this.ispWhitelist = new Map();
    this.ispBlacklist = new Map();
    this.clientIpWhitelist = new Map();
    this.clientUsers = new Map();
    this.redirectUrls = new Map();
    this.settings = new Map();
    this.auditLogsData = [];
    this.ipBlocklist = new Map();
    this.cidrBlocklist = new Map();
    
    // Initialize default detection rules
    this.detectionRules = {
      id: randomUUID(),
      name: "Default Rules",
      enabled: true,
      rules: {
        isp: true,
        mobile: true,
        vpn: true,
        proxy: true,
        tor: true,
        datacenter: true
      },
      updatedAt: new Date()
    };

    // Seed default admin user (admin / admin123)
    const adminPasswordHash = bcrypt.hashSync("admin123", 10);
    const adminId = randomUUID();
    this.users.set(adminId, {
      id: adminId,
      username: "admin",
      password: adminPasswordHash
    });

    // Seed default demo API key
    const demoApiKeyId = randomUUID();
    const demoApiKey: ApiKey = {
      id: demoApiKeyId,
      keyName: "Demo API Key",
      keyValue: "ctc_demo_key_2026",
      callLimit: 100000,
      callCount: 0,
      status: "active",
      enabled: true,
      expirationPeriod: "unlimited",
      expiresAt: null,
      lastUsed: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.apiKeys.set(demoApiKeyId, demoApiKey);

    // Also seed legacy ak_ and ct_live_ keys for backward compatibility
    const legacyApiKeyId1 = randomUUID();
    this.apiKeys.set(legacyApiKeyId1, {
      ...demoApiKey,
      id: legacyApiKeyId1,
      keyName: "Legacy ct_live API Key",
      keyValue: "ct_live_demo_key_2026",
    });
    const legacyApiKeyId2 = randomUUID();
    this.apiKeys.set(legacyApiKeyId2, {
      ...demoApiKey,
      id: legacyApiKeyId2,
      keyName: "Legacy ak_ API Key",
      keyValue: "ak_demo_key_2026",
    });

    // Seed default client user (demo / demo123)
    const clientUserId = randomUUID();
    this.clientUsers.set(clientUserId, {
      id: clientUserId,
      username: "demo",
      password: bcrypt.hashSync("demo123", 10),
      fullName: "Demo User",
      email: "demo@cleantraffic.io",
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: "active",
      apiKeyId: demoApiKeyId,
      tosAccepted: new Date(),
      complianceStatus: "compliant",
      newsletter: false,
      subscriptionStatus: "active",
      trialEndsAt: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createClassification(insertClassification: InsertClassification): Promise<Classification> {
    // Auto-cleanup: Delete records older than 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for (const [id, classification] of this.classifications.entries()) {
      if (new Date(classification.timestamp) < twentyFourHoursAgo) {
        this.classifications.delete(id);
      }
    }
    
    // Auto-cleanup: Keep only last 100 classifications
    if (this.classifications.size >= 100) {
      const sorted = Array.from(this.classifications.entries())
        .sort((a, b) => new Date(a[1].timestamp).getTime() - new Date(b[1].timestamp).getTime());
      
      const toDelete = this.classifications.size - 99; // Keep 99, add 1 new = 100 total
      for (let i = 0; i < toDelete; i++) {
        this.classifications.delete(sorted[i][0]);
      }
    }
    
    const id = randomUUID();
    const classification: Classification = { 
      ...insertClassification,
      location: insertClassification.location || null,
      country: insertClassification.country || null,
      city: insertClassification.city || null,
      countryCode: insertClassification.countryCode || null,
      region: insertClassification.region || null,
      connectionType: insertClassification.connectionType || null,
      isp: insertClassification.isp || null,
      browser: insertClassification.browser || null,
      deviceType: insertClassification.deviceType || null,
      apiKeyId: insertClassification.apiKeyId ?? null,
      id, 
      timestamp: new Date() 
    };
    this.classifications.set(id, classification);
    return classification;
  }

  async getRecentClassifications(limit: number = 10): Promise<Classification[]> {
    const classifications = Array.from(this.classifications.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
    return classifications;
  }

  async getClassificationStats(): Promise<{
    totalClassifications: number;
    humanVisitors: number;
    botTraffic: number;
    apiRequests: number;
  }> {
    const allClassifications = Array.from(this.classifications.values());
    const totalClassifications = allClassifications.length;
    const humanVisitors = allClassifications.filter(c => c.visitorType === 'Human').length;
    const botTraffic = allClassifications.filter(c => c.visitorType === 'Bot').length;
    
    return {
      totalClassifications,
      humanVisitors,
      botTraffic,
      apiRequests: totalClassifications // Same as total classifications for this implementation
    };
  }

  async getDetectionRules(): Promise<DetectionRules | undefined> {
    return this.detectionRules;
  }

  async updateDetectionRules(rules: InsertDetectionRules): Promise<DetectionRules> {
    this.detectionRules = {
      ...this.detectionRules!,
      ...rules,
      updatedAt: new Date()
    };
    return this.detectionRules;
  }

  async createApiKey(insertApiKey: InsertApiKey): Promise<ApiKey> {
    const id = randomUUID();
    
    // Calculate expiration date
    let expiresAt: Date | null = null;
    if (insertApiKey.expirationPeriod !== 'unlimited') {
      const now = new Date();
      switch (insertApiKey.expirationPeriod) {
        case '10seconds':
          expiresAt = new Date(now.getTime() + 10 * 1000);
          break;
        case '1minute':
          expiresAt = new Date(now.getTime() + 60 * 1000);
          break;
        case '1hour':
          expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
          break;
        case 'daily':
          expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          break;
        case 'weekly':
          expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          break;
      }
    }
    
    const apiKey: ApiKey = {
      ...insertApiKey,
      enabled: insertApiKey.enabled ?? true,
      status: insertApiKey.status ?? 'active',
      expirationPeriod: insertApiKey.expirationPeriod ?? 'unlimited',
      expiresAt,
      callLimit: insertApiKey.callLimit ?? 1000,
      callCount: 0,
      lastUsed: null,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.apiKeys.set(id, apiKey);
    return apiKey;
  }

  async getApiKeys(): Promise<ApiKey[]> {
    return Array.from(this.apiKeys.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getApiKey(keyValue: string): Promise<ApiKey | undefined> {
    return Array.from(this.apiKeys.values()).find(key => key.keyValue === keyValue);
  }

  async deleteApiKey(id: string): Promise<boolean> {
    return this.apiKeys.delete(id);
  }

  async updateApiKey(id: string, updates: Partial<ApiKey>): Promise<ApiKey | undefined> {
    const apiKey = this.apiKeys.get(id);
    if (apiKey) {
      const updatedKey = { ...apiKey, ...updates, updatedAt: new Date() };
      this.apiKeys.set(id, updatedKey);
      return updatedKey;
    }
    return undefined;
  }

  async incrementApiKeyUsage(keyValue: string): Promise<boolean> {
    const apiKey = await this.getApiKey(keyValue);
    if (apiKey) {
      // Check if key is expired
      if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
        await this.updateApiKey(apiKey.id, { status: 'expired' });
        return false;
      }
      
      // Check if call limit reached
      if (apiKey.callCount >= apiKey.callLimit) {
        return false;
      }
      
      // Check if key is paused or inactive
      if (apiKey.status !== 'active') {
        return false;
      }
      
      // Increment usage
      apiKey.callCount += 1;
      apiKey.lastUsed = new Date();
      apiKey.updatedAt = new Date();
      this.apiKeys.set(apiKey.id, apiKey);
      return true;
    }
    return false;
  }

  async pauseApiKey(id: string): Promise<boolean> {
    const apiKey = this.apiKeys.get(id);
    if (apiKey) {
      apiKey.status = apiKey.status === 'paused' ? 'active' : 'paused';
      apiKey.updatedAt = new Date();
      this.apiKeys.set(id, apiKey);
      return true;
    }
    return false;
  }

  async renewApiKey(id: string): Promise<ApiKey | undefined> {
    const apiKey = this.apiKeys.get(id);
    if (apiKey) {
      let expiresAt: Date | null = null;
      if (apiKey.expirationPeriod !== 'unlimited') {
        const now = new Date();
        switch (apiKey.expirationPeriod) {
          case '10seconds':
            expiresAt = new Date(now.getTime() + 10 * 1000);
            break;
          case '1minute':
            expiresAt = new Date(now.getTime() + 60 * 1000);
            break;
          case '1hour':
            expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
            break;
          case 'daily':
            expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            break;
          case 'weekly':
            expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            break;
          case 'monthly':
            expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            break;
        }
      }
      
      apiKey.expiresAt = expiresAt;
      apiKey.callCount = 0; // Reset usage count
      apiKey.status = 'active';
      apiKey.updatedAt = new Date();
      this.apiKeys.set(id, apiKey);
      return apiKey;
    }
    return undefined;
  }

  async getApiKeyById(id: string): Promise<ApiKey | undefined> {
    return this.apiKeys.get(id);
  }

  async getApiKeyByValue(keyValue: string): Promise<ApiKey | undefined> {
    return this.getApiKey(keyValue);
  }

  // Country Whitelist methods
  async getCountryWhitelist(): Promise<CountryWhitelist[]> {
    return Array.from(this.countryWhitelist.values())
      .sort((a, b) => a.countryName.localeCompare(b.countryName));
  }

  async addCountryToWhitelist(country: InsertCountryWhitelist): Promise<CountryWhitelist> {
    const id = randomUUID();
    const newCountry: CountryWhitelist = {
      ...country,
      id,
      enabled: country.enabled ?? true,
      addedAt: new Date()
    };
    this.countryWhitelist.set(id, newCountry);
    return newCountry;
  }

  async removeCountryFromWhitelist(id: string): Promise<boolean> {
    return this.countryWhitelist.delete(id);
  }

  async toggleCountryWhitelist(id: string, enabled: boolean): Promise<boolean> {
    const country = this.countryWhitelist.get(id);
    if (country) {
      country.enabled = enabled;
      this.countryWhitelist.set(id, country);
      return true;
    }
    return false;
  }

  async isCountryAllowed(countryCode: string): Promise<boolean> {
    const country = Array.from(this.countryWhitelist.values())
      .find(c => c.countryCode === countryCode && c.enabled);
    return !!country;
  }

  // ISP Whitelist methods
  async getIspWhitelist(countryCode?: string): Promise<IspWhitelist[]> {
    let isps = Array.from(this.ispWhitelist.values());
    if (countryCode) {
      isps = isps.filter(isp => isp.countryCode === countryCode);
    }
    return isps.sort((a, b) => a.ispName.localeCompare(b.ispName));
  }

  async addIspToWhitelist(isp: InsertIspWhitelist): Promise<IspWhitelist> {
    const id = randomUUID();
    const newIsp: IspWhitelist = {
      ...isp,
      id,
      enabled: isp.enabled ?? true,
      countryCode: isp.countryCode ?? null,
      addedAt: new Date()
    };
    this.ispWhitelist.set(id, newIsp);
    return newIsp;
  }

  async removeIspFromWhitelist(id: string): Promise<boolean> {
    return this.ispWhitelist.delete(id);
  }

  async toggleIspWhitelist(id: string, enabled: boolean): Promise<boolean> {
    const isp = this.ispWhitelist.get(id);
    if (isp) {
      isp.enabled = enabled;
      this.ispWhitelist.set(id, isp);
      return true;
    }
    return false;
  }

  async isIspWhitelisted(ispName: string): Promise<boolean> {
    const isp = Array.from(this.ispWhitelist.values())
      .find(i => i.ispName.toLowerCase() === ispName.toLowerCase() && i.enabled);
    return !!isp;
  }

  // ISP Blacklist methods
  async getIspBlacklist(): Promise<IspBlacklist[]> {
    return Array.from(this.ispBlacklist.values())
      .sort((a, b) => a.ispName.localeCompare(b.ispName));
  }

  async addIspToBlacklist(isp: InsertIspBlacklist): Promise<IspBlacklist> {
    const id = randomUUID();
    const newIsp: IspBlacklist = {
      ...isp,
      id,
      enabled: isp.enabled ?? true,
      category: isp.category ?? null,
      addedAt: new Date()
    };
    this.ispBlacklist.set(id, newIsp);
    return newIsp;
  }

  async bulkAddIspsToBlacklist(ispNames: string[], category: string): Promise<{ added: number; skipped: number; errors: string[] }> {
    const existingIsps = await this.getIspBlacklist();
    const existingNames = new Set(existingIsps.map(isp => isp.ispName.toLowerCase()));
    
    let added = 0;
    let skipped = 0;
    const errors: string[] = [];
    
    for (const ispName of ispNames) {
      const trimmedName = ispName.trim();
      
      if (trimmedName.length === 0) {
        skipped++;
        continue;
      }
      
      if (existingNames.has(trimmedName.toLowerCase())) {
        skipped++;
        continue;
      }
      
      try {
        await this.addIspToBlacklist({
          ispName: trimmedName,
          category,
          enabled: true
        });
        existingNames.add(trimmedName.toLowerCase());
        added++;
      } catch (error) {
        errors.push(`Failed to add "${trimmedName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return { added, skipped, errors };
  }

  async removeIspFromBlacklist(id: string): Promise<boolean> {
    return this.ispBlacklist.delete(id);
  }

  async toggleIspBlacklist(id: string, enabled: boolean): Promise<boolean> {
    const isp = this.ispBlacklist.get(id);
    if (isp) {
      isp.enabled = enabled;
      this.ispBlacklist.set(id, isp);
      return true;
    }
    return false;
  }

  async isIspBlacklisted(ispName: string): Promise<boolean> {
    const isp = Array.from(this.ispBlacklist.values())
      .find(i => i.ispName.toLowerCase() === ispName.toLowerCase() && i.enabled);
    return !!isp;
  }

  // Client User methods
  async createClientUser(user: InsertClientUser): Promise<ClientUser> {
    const id = randomUUID();
    const newUser: ClientUser = {
      ...user,
      id,
      fullName: user.fullName ?? null,
      newsletter: user.newsletter ?? false,
      status: user.status ?? "active",
      email: user.email ?? null,
      emailVerified: user.emailVerified ?? false,
      emailVerifiedAt: user.emailVerifiedAt ?? null,
      apiKeyId: user.apiKeyId ?? null,
      tosAccepted: user.tosAccepted ?? null,
      complianceStatus: user.complianceStatus ?? "pending",
      subscriptionStatus: user.subscriptionStatus ?? "trialing",
      trialEndsAt: user.trialEndsAt ?? null,
      stripeCustomerId: user.stripeCustomerId ?? null,
      stripeSubscriptionId: user.stripeSubscriptionId ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.clientUsers.set(id, newUser);
    return newUser;
  }

  async getClientUser(id: string): Promise<ClientUser | undefined> {
    return this.clientUsers.get(id);
  }

  async getClientUserByUsername(username: string): Promise<ClientUser | undefined> {
    return Array.from(this.clientUsers.values())
      .find(user => user.username.toLowerCase() === username.toLowerCase());
  }

  async getClientUserByEmail(email: string): Promise<ClientUser | undefined> {
    return Array.from(this.clientUsers.values())
      .find(user => user.email && user.email.toLowerCase() === email.toLowerCase());
  }

  async getClientUserByUsernameOrEmail(identifier: string): Promise<ClientUser | undefined> {
    const cleanId = identifier.trim().toLowerCase();
    return Array.from(this.clientUsers.values())
      .find(user => 
        user.username.toLowerCase() === cleanId || 
        (user.email && user.email.toLowerCase() === cleanId)
      );
  }

  async updateClientUser(id: string, updates: Partial<ClientUser>): Promise<ClientUser | undefined> {
    const user = this.clientUsers.get(id);
    if (user) {
      const updatedUser = { ...user, ...updates, updatedAt: new Date() };
      this.clientUsers.set(id, updatedUser);
      return updatedUser;
    }
    return undefined;
  }

  async getClientUserByApiKey(apiKeyId: string): Promise<ClientUser | undefined> {
    const keyObj = (await this.getApiKeyById(apiKeyId)) || (await this.getApiKey(apiKeyId));
    const candidateIds = [apiKeyId];
    if (keyObj) {
      if (keyObj.id) candidateIds.push(keyObj.id);
      if (keyObj.keyValue) candidateIds.push(keyObj.keyValue);
    }
    const found = Array.from(this.clientUsers.values())
      .find(user => candidateIds.includes(user.apiKeyId || ''));
    if (found) return found;
    const all = Array.from(this.clientUsers.values());
    if (all.length === 1) return all[0];
    return undefined;
  }

  async getAllClientUsers(): Promise<ClientUser[]> {
    return Array.from(this.clientUsers.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getClientUserByStripeCustomerId(stripeCustomerId: string): Promise<ClientUser | undefined> {
    return Array.from(this.clientUsers.values())
      .find(user => user.stripeCustomerId === stripeCustomerId);
  }

  // Single-threaded Node.js: Map operations are atomic within the event loop tick.
  private _stripeEvents = new Map<string, { claimedAt: Date; processedAt: Date | null }>();
  private static readonly LEASE_MS = 5 * 60 * 1000; // 5-minute lease window

  async claimStripeEvent(eventId: string): Promise<boolean> {
    const existing = this._stripeEvents.get(eventId);
    const now = new Date();
    if (!existing) {
      this._stripeEvents.set(eventId, { claimedAt: now, processedAt: null });
      return true;
    }
    if (existing.processedAt !== null) return false; // true duplicate — already processed
    const leaseAge = now.getTime() - existing.claimedAt.getTime();
    if (leaseAge >= MemStorage.LEASE_MS) {
      // Stale lease: previous holder crashed — reclaim
      this._stripeEvents.set(eventId, { claimedAt: now, processedAt: null });
      return true;
    }
    return false; // concurrent in-flight delivery
  }

  async markStripeEventProcessed(eventId: string): Promise<void> {
    const existing = this._stripeEvents.get(eventId);
    if (existing) {
      this._stripeEvents.set(eventId, { ...existing, processedAt: new Date() });
    }
  }

  async releaseStripeEvent(eventId: string): Promise<void> {
    this._stripeEvents.delete(eventId);
  }

  // User Redirect URLs methods
  async getUserRedirectUrls(userId: string): Promise<UserRedirectUrls | undefined> {
    return this.redirectUrls.get(userId);
  }

  async setUserRedirectUrls(userId: string, urls: { 
    humanUrl: string; 
    botUrl: string; 
    allowedCountries?: string; 
    allowedDevices?: string;
    desktopOsFilter?: string;
    blockVpn?: string;
    blockDatacenter?: string;
    blockTor?: string;
    fingerprintActivate?: string;
    wildcardSubdomains?: string;
    allowVpn?: boolean;
  }): Promise<UserRedirectUrls> {
    const existing = this.redirectUrls.get(userId);
    const redirectUrl: UserRedirectUrls = {
      id: existing?.id || randomUUID(),
      userId,
      humanUrl: urls.humanUrl,
      botUrl: urls.botUrl,
      allowedCountries: urls.allowedCountries !== undefined ? urls.allowedCountries : (existing?.allowedCountries || "ALL"),
      allowedDevices: urls.allowedDevices !== undefined ? urls.allowedDevices : (existing?.allowedDevices || "all"),
      desktopOsFilter: urls.desktopOsFilter !== undefined ? urls.desktopOsFilter : (existing?.desktopOsFilter || "both"),
      blockVpn: urls.blockVpn !== undefined ? urls.blockVpn : (existing?.blockVpn || "block"),
      blockDatacenter: urls.blockDatacenter !== undefined ? urls.blockDatacenter : (existing?.blockDatacenter || "block"),
      blockTor: urls.blockTor !== undefined ? urls.blockTor : (existing?.blockTor || "block"),
      fingerprintActivate: urls.fingerprintActivate !== undefined ? urls.fingerprintActivate : (existing?.fingerprintActivate || "enabled"),
      wildcardSubdomains: urls.wildcardSubdomains !== undefined ? urls.wildcardSubdomains : (existing?.wildcardSubdomains || "disabled"),
      allowVpn: urls.allowVpn !== undefined ? urls.allowVpn : (urls.blockVpn === "allow" ? true : (existing?.allowVpn ?? false)),
      updatedAt: new Date()
    };
    this.redirectUrls.set(userId, redirectUrl);
    return redirectUrl;
  }

  // Classification methods for users
  async getUserClassifications(apiKeyId: string, limit: number = 10): Promise<Classification[]> {
    return Array.from(this.classifications.values())
      .filter(c => c.apiKeyId === apiKeyId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getUserStats(apiKeyId: string): Promise<{
    totalClassifications: number;
    humanVisitors: number;
    botTraffic: number;
  }> {
    const userClassifications = Array.from(this.classifications.values())
      .filter(c => c.apiKeyId === apiKeyId);
    
    return {
      totalClassifications: userClassifications.length,
      humanVisitors: userClassifications.filter(c => c.visitorType === 'Human').length,
      botTraffic: userClassifications.filter(c => c.visitorType === 'Bot').length
    };
  }

  // Settings methods
  async getSetting(key: string): Promise<string | null> {
    return this.settings.get(key) || null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    this.settings.set(key, value);
  }

  // Client IP Whitelist methods
  async getClientIpWhitelist(): Promise<ClientIpWhitelist[]> {
    return Array.from(this.clientIpWhitelist.values())
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  async addIpToWhitelist(ip: InsertClientIpWhitelist): Promise<ClientIpWhitelist> {
    const id = randomUUID();
    const newIp: ClientIpWhitelist = {
      ...ip,
      id,
      enabled: ip.enabled ?? true,
      createdAt: new Date()
    };
    this.clientIpWhitelist.set(id, newIp);
    return newIp;
  }

  async removeIpFromWhitelist(id: string): Promise<boolean> {
    return this.clientIpWhitelist.delete(id);
  }

  async toggleIpWhitelist(id: string, enabled: boolean): Promise<boolean> {
    const ip = this.clientIpWhitelist.get(id);
    if (ip) {
      ip.enabled = enabled;
      this.clientIpWhitelist.set(id, ip);
      return true;
    }
    return false;
  }

  async isIpWhitelisted(ipAddress: string): Promise<boolean> {
    const whitelistEnabled = await this.isClientWhitelistEnabled();
    
    if (!whitelistEnabled) {
      return true;
    }
    
    const enabledEntries = Array.from(this.clientIpWhitelist.values())
      .filter(entry => entry.enabled);
    
    if (enabledEntries.length === 0) {
      return false;
    }
    
    for (const entry of enabledEntries) {
      if (entry.cidr === ipAddress) {
        return true;
      }
      
      if (entry.cidr.includes('/')) {
        const cidrPrefix = entry.cidr.split('/')[0];
        if (ipAddress.startsWith(cidrPrefix.substring(0, cidrPrefix.lastIndexOf('.')))) {
          return true;
        }
      }
    }
    
    return false;
  }

  async isClientWhitelistEnabled(): Promise<boolean> {
    const setting = this.settings.get('clientWhitelistEnabled');
    return setting === 'true';
  }

  async setClientWhitelistEnabled(enabled: boolean): Promise<void> {
    this.settings.set('clientWhitelistEnabled', enabled ? 'true' : 'false');
  }

  // IP Blocklist methods
  async getIpBlocklist(): Promise<IpBlocklist[]> {
    return Array.from(this.ipBlocklist.values())
      .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  }

  async addIpToBlocklist(ip: InsertIpBlocklist): Promise<IpBlocklist> {
    const id = randomUUID();
    const newIp: IpBlocklist = {
      ...ip,
      id,
      reason: ip.reason ?? null,
      enabled: ip.enabled ?? true,
      addedAt: new Date(),
    };
    this.ipBlocklist.set(id, newIp);
    return newIp;
  }

  async removeIpFromBlocklist(id: string): Promise<boolean> {
    return this.ipBlocklist.delete(id);
  }

  async toggleIpBlocklist(id: string, enabled: boolean): Promise<boolean> {
    const entry = this.ipBlocklist.get(id);
    if (entry) {
      entry.enabled = enabled;
      this.ipBlocklist.set(id, entry);
      return true;
    }
    return false;
  }

  async isIpBlocked(ipAddress: string): Promise<boolean> {
    const entry = Array.from(this.ipBlocklist.values()).find(e => e.ipAddress === ipAddress);
    return entry ? entry.enabled : false;
  }

  // CIDR Blocklist methods
  async getCidrBlocklist(): Promise<CidrBlocklist[]> {
    return Array.from(this.cidrBlocklist.values())
      .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  }

  async addCidrToBlocklist(cidr: InsertCidrBlocklist): Promise<CidrBlocklist> {
    const id = randomUUID();
    const newCidr: CidrBlocklist = {
      ...cidr,
      id,
      reason: cidr.reason ?? null,
      enabled: cidr.enabled ?? true,
      addedAt: new Date(),
    };
    this.cidrBlocklist.set(id, newCidr);
    return newCidr;
  }

  async removeCidrFromBlocklist(id: string): Promise<boolean> {
    return this.cidrBlocklist.delete(id);
  }

  async toggleCidrBlocklist(id: string, enabled: boolean): Promise<boolean> {
    const entry = this.cidrBlocklist.get(id);
    if (entry) {
      entry.enabled = enabled;
      this.cidrBlocklist.set(id, entry);
      return true;
    }
    return false;
  }

  async isIpInBlockedCidrRange(ipAddress: string): Promise<boolean> {
    const enabledRanges = Array.from(this.cidrBlocklist.values()).filter(e => e.enabled);
    if (enabledRanges.length === 0) return false;

    let parsedIp: ReturnType<typeof ipaddr.parse>;
    try {
      parsedIp = ipaddr.parse(ipAddress);
    } catch {
      return false;
    }

    for (const entry of enabledRanges) {
      try {
        const [rangeAddr, prefixLength] = ipaddr.parseCIDR(entry.cidrRange);
        if (parsedIp.kind() === rangeAddr.kind() && parsedIp.match(rangeAddr, prefixLength)) {
          return true;
        }
      } catch {
        // Skip invalid CIDR
      }
    }
    return false;
  }

  // Domain Pool methods (in-memory implementation)
  private domainPool: Map<string, DomainPool> = new Map();
  private userDomainGenerations: Map<string, UserDomainGeneration> = new Map();

  async getDomainPool(): Promise<DomainPool[]> {
    return Array.from(this.domainPool.values());
  }

  async addDomainToPool(domain: InsertDomainPool): Promise<DomainPool> {
    const newDomain: DomainPool = {
      id: randomUUID(),
      domain: domain.domain,
      description: domain.description || null,
      enabled: domain.enabled ?? true,
      createdAt: new Date(),
    };
    this.domainPool.set(newDomain.id, newDomain);
    return newDomain;
  }

  async removeDomainFromPool(id: string): Promise<boolean> {
    return this.domainPool.delete(id);
  }

  async toggleDomainInPool(id: string, enabled: boolean): Promise<boolean> {
    const domain = this.domainPool.get(id);
    if (domain) {
      domain.enabled = enabled;
      this.domainPool.set(id, domain);
      return true;
    }
    return false;
  }

  async getDomainFromPool(id: string): Promise<DomainPool | undefined> {
    return this.domainPool.get(id);
  }

  async getUserDomainGenerations(userId: string): Promise<UserDomainGeneration[]> {
    return Array.from(this.userDomainGenerations.values())
      .filter(g => g.userId === userId);
  }

  async getUserDomainGenerationsToday(userId: string): Promise<UserDomainGeneration[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from(this.userDomainGenerations.values())
      .filter(g => g.userId === userId && g.generatedAt >= today);
  }

  async createUserDomainGeneration(generation: InsertUserDomainGeneration): Promise<UserDomainGeneration> {
    const newGeneration: UserDomainGeneration = {
      id: randomUUID(),
      userId: generation.userId,
      domainId: generation.domainId,
      domain: generation.domain,
      generatedAt: new Date(),
    };
    this.userDomainGenerations.set(newGeneration.id, newGeneration);
    return newGeneration;
  }

  async getDailyGenerationLimit(): Promise<number> {
    const limit = this.settings.get('dailyGenerationLimit');
    return limit ? parseInt(limit, 10) : 3;
  }

  async setDailyGenerationLimit(limit: number): Promise<void> {
    this.settings.set('dailyGenerationLimit', limit.toString());
  }

  async createAuditLog(entry: InsertAuditLog): Promise<AuditLog> {
    const log: AuditLog = {
      id: randomUUID(),
      actorId: entry.actorId ?? null,
      actorType: entry.actorType,
      action: entry.action,
      targetId: entry.targetId ?? null,
      targetType: entry.targetType ?? null,
      metadata: entry.metadata ?? null,
      ipAddress: entry.ipAddress ?? null,
      createdAt: new Date(),
    };
    this.auditLogsData.unshift(log);
    return log;
  }

  async getRecentAuditLogs(limit = 100): Promise<AuditLog[]> {
    return this.auditLogsData.slice(0, limit);
  }
}

export class DatabaseStorage {
  constructor() {
    // Initialization removed to prevent connection pool exhaustion
    // Defaults should already exist from previous runs
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    const [user] = result || [];
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.username, username));
      const [user] = result || [];
      return user;
    } catch (error) {
      // Neon HTTP can throw while processing an empty result set.
      if (error instanceof TypeError && error.message.includes("reading 'map'")) {
        return undefined;
      }
      throw error;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async createClassification(classification: InsertClassification): Promise<Classification> {
    // Auto-cleanup: Delete records older than 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await db.delete(classifications).where(lt(classifications.timestamp, twentyFourHoursAgo));
    
    // Auto-cleanup: Keep only last 100 classifications
    const countResult = await db.select({ count: count() }).from(classifications);
    const total = countResult[0]?.count || 0;
    
    if (total >= 100) {
      // Delete oldest entries to maintain 100 records max
      const toDelete = total - 99; // Keep 99, add 1 new = 100 total
      const oldestRecords = await db
        .select({ id: classifications.id })
        .from(classifications)
        .orderBy(classifications.timestamp)
        .limit(toDelete);
      
      for (const record of oldestRecords) {
        await db.delete(classifications).where(eq(classifications.id, record.id));
      }
    }
    
    const [newClassification] = await db.insert(classifications).values(classification).returning();
    return newClassification;
  }

  async getRecentClassifications(limit: number = 10): Promise<Classification[]> {
    const results = await db
      .select()
      .from(classifications)
      .orderBy(desc(classifications.timestamp))
      .limit(limit);
    return results;
  }

  async getClassificationStats(): Promise<{
    totalClassifications: number;
    humanVisitors: number;
    botTraffic: number;
    apiRequests: number;
  }> {
    const [stats] = await db
      .select({
        total: count(),
        humans: sql<number>`count(case when ${classifications.visitorType} = 'Human' then 1 end)`,
        bots: sql<number>`count(case when ${classifications.visitorType} = 'Bot' then 1 end)`
      })
      .from(classifications);

    return {
      totalClassifications: stats.total,
      humanVisitors: stats.humans || 0,
      botTraffic: stats.bots || 0,
      apiRequests: stats.total
    };
  }

  async getDetectionRules(): Promise<DetectionRules | undefined> {
    const [rules] = await db.select().from(detectionRules).limit(1);
    return rules;
  }

  async updateDetectionRules(rules: InsertDetectionRules): Promise<DetectionRules> {
    // Delete existing rules and insert new ones (simple approach for single rule set)
    await db.delete(detectionRules);
    const [newRules] = await db.insert(detectionRules).values(rules).returning();
    return newRules;
  }

  async createApiKey(apiKey: InsertApiKey): Promise<ApiKey> {
    // Calculate expiration date
    let expiresAt: Date | null = null;
    if (apiKey.expirationPeriod !== 'unlimited') {
      const now = new Date();
      switch (apiKey.expirationPeriod) {
        case '10seconds':
          expiresAt = new Date(now.getTime() + 10 * 1000);
          break;
        case '1minute':
          expiresAt = new Date(now.getTime() + 60 * 1000);
          break;
        case '1hour':
          expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
          break;
        case 'daily':
          expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          break;
        case 'weekly':
          expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          break;
      }
    }

    const [newApiKey] = await db.insert(apiKeys).values({
      ...apiKey,
      expiresAt
    }).returning();
    return newApiKey;
  }

  async getApiKeys(): Promise<ApiKey[]> {
    return await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
  }

  async getApiKey(keyValue: string): Promise<ApiKey | undefined> {
    const [apiKey] = await db.select().from(apiKeys).where(eq(apiKeys.keyValue, keyValue));
    return apiKey;
  }

  async getApiKeyById(id: string): Promise<ApiKey | undefined> {
    const [apiKey] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    return apiKey;
  }

  async getApiKeyByValue(keyValue: string): Promise<ApiKey | undefined> {
    return this.getApiKey(keyValue);
  }

  async deleteApiKey(id: string): Promise<boolean> {
    const result = await db.delete(apiKeys).where(eq(apiKeys.id, id));
    return (result.rowCount || 0) > 0;
  }

  async updateApiKey(id: string, updates: Partial<ApiKey>): Promise<ApiKey | undefined> {
    const [updatedKey] = await db
      .update(apiKeys)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(apiKeys.id, id))
      .returning();
    return updatedKey;
  }

  async incrementApiKeyUsage(keyValue: string): Promise<boolean> {
    const apiKey = await this.getApiKey(keyValue);
    if (!apiKey) {
      return false;
    }
    
    // Check if key is expired
    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      await this.updateApiKey(apiKey.id, { status: 'expired' });
      return false;
    }
    
    // Check if call limit reached
    if (apiKey.callCount >= apiKey.callLimit) {
      await this.updateApiKey(apiKey.id, { status: 'expired' });
      return false;
    }
    
    // Check if key is paused or inactive
    if (apiKey.status !== 'active') {
      return false;
    }
    
    // Increment usage count
    const result = await db
      .update(apiKeys)
      .set({
        callCount: sql`${apiKeys.callCount} + 1`,
        lastUsed: new Date()
      })
      .where(eq(apiKeys.keyValue, keyValue));
    return (result.rowCount || 0) > 0;
  }

  async pauseApiKey(id: string): Promise<boolean> {
    const [apiKey] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    if (apiKey) {
      const newStatus = apiKey.status === 'active' ? 'paused' : 'active';
      await db
        .update(apiKeys)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(apiKeys.id, id));
      return true;
    }
    return false;
  }

  async renewApiKey(id: string): Promise<ApiKey | undefined> {
    const [apiKey] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    if (apiKey) {
      let expiresAt: Date | null = null;
      if (apiKey.expirationPeriod !== 'unlimited') {
        const now = new Date();
        switch (apiKey.expirationPeriod) {
          case '10seconds':
            expiresAt = new Date(now.getTime() + 10 * 1000);
            break;
          case '1minute':
            expiresAt = new Date(now.getTime() + 60 * 1000);
            break;
          case '1hour':
            expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
            break;
          case 'daily':
            expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            break;
          case 'weekly':
            expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            break;
          case 'monthly':
            expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            break;
        }
      }

      const [renewed] = await db
        .update(apiKeys)
        .set({
          expiresAt,
          callCount: 0,
          status: 'active',
          updatedAt: new Date()
        })
        .where(eq(apiKeys.id, id))
        .returning();
      return renewed;
    }
    return undefined;
  }

  // Country Whitelist methods
  async getCountryWhitelist(): Promise<CountryWhitelist[]> {
    const countries = await db.select().from(countryWhitelist);
    return countries;
  }

  async addCountryToWhitelist(country: InsertCountryWhitelist): Promise<CountryWhitelist> {
    const [newCountry] = await db.insert(countryWhitelist).values(country).returning();
    return newCountry;
  }

  async removeCountryFromWhitelist(id: string): Promise<boolean> {
    const result = await db.delete(countryWhitelist).where(eq(countryWhitelist.id, id));
    return (result.rowCount || 0) > 0;
  }

  async toggleCountryWhitelist(id: string, enabled: boolean): Promise<boolean> {
    const result = await db
      .update(countryWhitelist)
      .set({ enabled })
      .where(eq(countryWhitelist.id, id));
    return (result.rowCount || 0) > 0;
  }

  async isCountryAllowed(countryCode: string): Promise<boolean> {
    const [country] = await db
      .select()
      .from(countryWhitelist)
      .where(eq(countryWhitelist.countryCode, countryCode));
    return country ? country.enabled : false;
  }

  // ISP Whitelist methods
  async getIspWhitelist(countryCode?: string): Promise<IspWhitelist[]> {
    if (countryCode) {
      const isps = await db
        .select()
        .from(ispWhitelist)
        .where(eq(ispWhitelist.countryCode, countryCode));
      return isps;
    }
    const isps = await db.select().from(ispWhitelist);
    return isps;
  }

  async addIspToWhitelist(isp: InsertIspWhitelist): Promise<IspWhitelist> {
    const [newIsp] = await db.insert(ispWhitelist).values(isp).returning();
    return newIsp;
  }

  async removeIspFromWhitelist(id: string): Promise<boolean> {
    const result = await db.delete(ispWhitelist).where(eq(ispWhitelist.id, id));
    return (result.rowCount || 0) > 0;
  }

  async toggleIspWhitelist(id: string, enabled: boolean): Promise<boolean> {
    const result = await db
      .update(ispWhitelist)
      .set({ enabled })
      .where(eq(ispWhitelist.id, id));
    return (result.rowCount || 0) > 0;
  }

  async isIspWhitelisted(ispName: string): Promise<boolean> {
    const [isp] = await db
      .select()
      .from(ispWhitelist)
      .where(eq(ispWhitelist.ispName, ispName));
    return isp ? isp.enabled : false;
  }

  // ISP Blacklist methods
  async getIspBlacklist(): Promise<IspBlacklist[]> {
    const isps = await db.select().from(ispBlacklist);
    return isps;
  }

  async addIspToBlacklist(isp: InsertIspBlacklist): Promise<IspBlacklist> {
    const [newIsp] = await db.insert(ispBlacklist).values(isp).returning();
    return newIsp;
  }

  async bulkAddIspsToBlacklist(ispNames: string[], category: string): Promise<{ added: number; skipped: number; errors: string[] }> {
    const existingIsps = await this.getIspBlacklist();
    const existingNames = new Set(existingIsps.map(isp => isp.ispName.toLowerCase()));
    
    let added = 0;
    let skipped = 0;
    const errors: string[] = [];
    
    // Limit to 1000 ISPs per request to avoid performance issues
    const maxBulkSize = 1000;
    if (ispNames.length > maxBulkSize) {
      return {
        added: 0,
        skipped: 0,
        errors: [`Too many ISPs in one request. Maximum is ${maxBulkSize}, received ${ispNames.length}`]
      };
    }
    
    for (const ispName of ispNames) {
      const trimmedName = ispName.trim();
      
      if (trimmedName.length === 0) {
        skipped++;
        continue;
      }
      
      if (trimmedName.length > 255) {
        errors.push(`ISP name too long (max 255 chars): "${trimmedName.substring(0, 50)}..."`);
        continue;
      }
      
      if (existingNames.has(trimmedName.toLowerCase())) {
        skipped++;
        continue;
      }
      
      try {
        await this.addIspToBlacklist({
          ispName: trimmedName,
          category,
          enabled: true
        });
        existingNames.add(trimmedName.toLowerCase());
        added++;
      } catch (error) {
        errors.push(`Failed to add "${trimmedName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return { added, skipped, errors };
  }

  async removeIspFromBlacklist(id: string): Promise<boolean> {
    const result = await db.delete(ispBlacklist).where(eq(ispBlacklist.id, id));
    return (result.rowCount || 0) > 0;
  }

  async toggleIspBlacklist(id: string, enabled: boolean): Promise<boolean> {
    const result = await db
      .update(ispBlacklist)
      .set({ enabled })
      .where(eq(ispBlacklist.id, id));
    return (result.rowCount || 0) > 0;
  }

  async isIspBlacklisted(ispName: string): Promise<boolean> {
    const [isp] = await db
      .select()
      .from(ispBlacklist)
      .where(eq(ispBlacklist.ispName, ispName));
    return isp ? isp.enabled : false;
  }

  // Client User methods (for end-user customers)
  async createClientUser(user: InsertClientUser): Promise<ClientUser> {
    const [newUser] = await db.insert(clientUsers).values(user).returning();
    if (newUser) return newUser;
    // Neon HTTP driver can return an empty array from .returning() even on success.
    // Fall back to fetching the just-inserted row by username.
    const fetched = await this.getClientUserByUsername(user.username);
    if (fetched) return fetched;
    throw new Error(`createClientUser: insert appeared to succeed but row not found for username "${user.username}"`);
  }

  async getClientUser(id: string): Promise<ClientUser | undefined> {
    const result = await db
      .select()
      .from(clientUsers)
      .where(eq(clientUsers.id, id));
    const [user] = result || [];
    return user;
  }

  async getClientUserByUsername(username: string): Promise<ClientUser | undefined> {
    try {
      const result = await db
        .select()
        .from(clientUsers)
        .where(eq(clientUsers.username, username));
      const [user] = result || [];
      return user;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("reading 'map'")) {
        return undefined;
      }
      throw error;
    }
  }

  async getClientUserByEmail(email: string): Promise<ClientUser | undefined> {
    try {
      const result = await db
        .select()
        .from(clientUsers)
        .where(eq(clientUsers.email, email));
      const [user] = result || [];
      return user;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("reading 'map'")) {
        return undefined;
      }
      throw error;
    }
  }

  async getClientUserByUsernameOrEmail(identifier: string): Promise<ClientUser | undefined> {
    try {
      const cleanId = identifier.trim();
      const result = await db
        .select()
        .from(clientUsers)
        .where(or(eq(clientUsers.username, cleanId), eq(clientUsers.email, cleanId)));
      const [user] = result || [];
      return user;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("reading 'map'")) {
        return undefined;
      }
      throw error;
    }
  }

  async updateClientUser(id: string, updates: Partial<ClientUser>): Promise<ClientUser | undefined> {
    const [updated] = await db
      .update(clientUsers)
      .set(updates)
      .where(eq(clientUsers.id, id))
      .returning();
    return updated;
  }

  async getClientUserByApiKey(apiKeyId: string): Promise<ClientUser | undefined> {
    const keyObj = (await this.getApiKeyById(apiKeyId)) || (await this.getApiKey(apiKeyId));
    const candidateIds = [apiKeyId];
    if (keyObj) {
      if (keyObj.id) candidateIds.push(keyObj.id);
      if (keyObj.keyValue) candidateIds.push(keyObj.keyValue);
    }
    const [user] = await db
      .select()
      .from(clientUsers)
      .where(inArray(clientUsers.apiKeyId, candidateIds));
    if (user) return user;
    const allUsers = await db.select().from(clientUsers);
    if (allUsers.length === 1) return allUsers[0];
    return undefined;
  }

  async getAllClientUsers(): Promise<ClientUser[]> {
    const allUsers = await db.select().from(clientUsers);
    return allUsers;
  }

  async getClientUserByStripeCustomerId(stripeCustomerId: string): Promise<ClientUser | undefined> {
    try {
      const result = await db
        .select()
        .from(clientUsers)
        .where(eq(clientUsers.stripeCustomerId, stripeCustomerId));
      return Array.isArray(result) ? result[0] : undefined;
    } catch (err: any) {
      // Only swallow the specific neon-http driver bug where an empty SELECT result is
      // surfaced as "Cannot read properties of null (reading 'map')".  All other errors
      // (connection failures, permission errors, etc.) must propagate so the webhook
      // processing catch can release the event claim and return 5xx for Stripe to retry.
      const msg: string = err?.message ?? "";
      if (msg.includes("Cannot read properties of null") && msg.includes("map")) {
        return undefined;
      }
      throw err;
    }
  }

  // Atomically claims an event for processing using a crash-recoverable lease model.
  //
  // Returns true  : new claim (INSERT) or stale-lease reclaim (UPDATE after >5 min)
  // Returns false : true duplicate (processed_at IS NOT NULL) OR concurrent in-flight
  //
  // The atomic INSERT … ON CONFLICT DO UPDATE WHERE handles all four cases in a single
  // round-trip. rowCount = 1 means we hold the lease; 0 means rejected.
  async claimStripeEvent(eventId: string): Promise<boolean> {
    const result = await db.execute(sql`
      INSERT INTO stripe_processed_events (event_id, claimed_at, processed_at)
      VALUES (${eventId}, now(), NULL)
      ON CONFLICT (event_id) DO UPDATE
        SET claimed_at = now()
      WHERE stripe_processed_events.processed_at IS NULL
        AND stripe_processed_events.claimed_at < now() - INTERVAL '5 minutes'
    `);
    return (result.rowCount ?? 0) > 0;
  }

  // Marks the event as permanently processed (called after successful DB mutation).
  // Once set, all future Stripe retries are deduplicated without reprocessing.
  async markStripeEventProcessed(eventId: string): Promise<void> {
    await db.execute(
      sql`UPDATE stripe_processed_events SET processed_at = now() WHERE event_id = ${eventId}`
    );
  }

  // Deletes the claim entirely so Stripe can retry immediately after a caught error.
  async releaseStripeEvent(eventId: string): Promise<void> {
    await db.execute(
      sql`DELETE FROM stripe_processed_events WHERE event_id = ${eventId}`
    );
  }

  // User Redirect URLs methods
  async getUserRedirectUrls(userId: string): Promise<UserRedirectUrls | undefined> {
    const [urls] = await db
      .select()
      .from(userRedirectUrls)
      .where(eq(userRedirectUrls.userId, userId));
    return urls;
  }

  async setUserRedirectUrls(userId: string, urls: { 
    humanUrl: string; 
    botUrl: string; 
    allowedCountries?: string; 
    allowedDevices?: string;
    desktopOsFilter?: string;
    blockVpn?: string;
    blockDatacenter?: string;
    blockTor?: string;
    fingerprintActivate?: string;
    wildcardSubdomains?: string;
    allowVpn?: boolean;
  }): Promise<UserRedirectUrls> {
    // Check if user has existing redirect URLs
    const existing = await this.getUserRedirectUrls(userId);
    const updatePayload: any = {
      humanUrl: urls.humanUrl,
      botUrl: urls.botUrl,
      updatedAt: sql`now()`,
    };
    if (urls.allowedCountries !== undefined) updatePayload.allowedCountries = urls.allowedCountries;
    if (urls.allowedDevices !== undefined) updatePayload.allowedDevices = urls.allowedDevices;
    if (urls.desktopOsFilter !== undefined) updatePayload.desktopOsFilter = urls.desktopOsFilter;
    if (urls.blockVpn !== undefined) updatePayload.blockVpn = urls.blockVpn;
    if (urls.blockDatacenter !== undefined) updatePayload.blockDatacenter = urls.blockDatacenter;
    if (urls.blockTor !== undefined) updatePayload.blockTor = urls.blockTor;
    if (urls.fingerprintActivate !== undefined) updatePayload.fingerprintActivate = urls.fingerprintActivate;
    if (urls.wildcardSubdomains !== undefined) updatePayload.wildcardSubdomains = urls.wildcardSubdomains;
    if (urls.allowVpn !== undefined) {
      updatePayload.allowVpn = urls.allowVpn;
    } else if (urls.blockVpn !== undefined) {
      updatePayload.allowVpn = urls.blockVpn === "allow";
    }
    
    if (existing) {
      // Update existing
      const [updated] = await db
        .update(userRedirectUrls)
        .set(updatePayload)
        .where(eq(userRedirectUrls.userId, userId))
        .returning();
      return updated;
    } else {
      // Create new
      const [created] = await db
        .insert(userRedirectUrls)
        .values({
          userId,
          humanUrl: urls.humanUrl,
          botUrl: urls.botUrl,
          allowedCountries: urls.allowedCountries || "ALL",
          allowedDevices: urls.allowedDevices || "all",
          desktopOsFilter: urls.desktopOsFilter || "both",
          blockVpn: urls.blockVpn || "block",
          blockDatacenter: urls.blockDatacenter || "block",
          blockTor: urls.blockTor || "block",
          fingerprintActivate: urls.fingerprintActivate || "enabled",
          wildcardSubdomains: urls.wildcardSubdomains || "disabled",
          allowVpn: urls.allowVpn !== undefined ? urls.allowVpn : (urls.blockVpn === "allow"),
        })
        .returning();
      return created;
    }
  }

  // Classification methods for users (filtered by API key)
  async getUserClassifications(apiKeyId: string, limit: number = 100): Promise<Classification[]> {
    const userClassifications = await db
      .select()
      .from(classifications)
      .where(eq(classifications.apiKeyId, apiKeyId))
      .orderBy(desc(classifications.timestamp))
      .limit(limit);
    return userClassifications;
  }

  async getUserStats(apiKeyId: string): Promise<{
    totalClassifications: number;
    humanVisitors: number;
    botTraffic: number;
  }> {
    const [stats] = await db
      .select({
        total: count(),
        humans: sql<number>`count(*) filter (where ${classifications.visitorType} = 'Human')`,
        bots: sql<number>`count(*) filter (where ${classifications.visitorType} = 'Bot')`,
      })
      .from(classifications)
      .where(eq(classifications.apiKeyId, apiKeyId));

    return {
      totalClassifications: Number(stats?.total || 0),
      humanVisitors: Number(stats?.humans || 0),
      botTraffic: Number(stats?.bots || 0),
    };
  }
  
  // Settings methods
  async getSetting(key: string): Promise<string | null> {
    const [setting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key));
    return setting?.value || null;
  }
  
  async setSetting(key: string, value: string): Promise<void> {
    const existing = await this.getSetting(key);
    
    if (existing !== null) {
      // Update existing setting
      await db
        .update(settings)
        .set({ value, updatedAt: sql`now()` })
        .where(eq(settings.key, key));
    } else {
      // Create new setting
      await db
        .insert(settings)
        .values({ key, value });
    }
  }

  // Client IP Whitelist methods
  async getClientIpWhitelist(): Promise<ClientIpWhitelist[]> {
    const results = await db
      .select()
      .from(clientIpWhitelist)
      .orderBy(clientIpWhitelist.label);
    return results;
  }

  async addIpToWhitelist(ip: InsertClientIpWhitelist): Promise<ClientIpWhitelist> {
    const [newIp] = await db
      .insert(clientIpWhitelist)
      .values({
        ...ip,
        enabled: ip.enabled ?? true
      })
      .returning();
    return newIp;
  }

  async removeIpFromWhitelist(id: string): Promise<boolean> {
    const result = await db
      .delete(clientIpWhitelist)
      .where(eq(clientIpWhitelist.id, id))
      .returning();
    return result.length > 0;
  }

  async toggleIpWhitelist(id: string, enabled: boolean): Promise<boolean> {
    const result = await db
      .update(clientIpWhitelist)
      .set({ enabled })
      .where(eq(clientIpWhitelist.id, id))
      .returning();
    return result.length > 0;
  }

  async isIpWhitelisted(ipAddress: string): Promise<boolean> {
    const whitelistEnabled = await this.isClientWhitelistEnabled();
    
    if (!whitelistEnabled) {
      return true;
    }
    
    const enabledEntries = await db
      .select()
      .from(clientIpWhitelist)
      .where(eq(clientIpWhitelist.enabled, true));
    
    if (enabledEntries.length === 0) {
      return false;
    }
    
    for (const entry of enabledEntries) {
      if (entry.cidr === ipAddress) {
        return true;
      }
      
      if (entry.cidr.includes('/')) {
        const cidrPrefix = entry.cidr.split('/')[0];
        if (ipAddress.startsWith(cidrPrefix.substring(0, cidrPrefix.lastIndexOf('.')))) {
          return true;
        }
      }
    }
    
    return false;
  }

  async isClientWhitelistEnabled(): Promise<boolean> {
    const setting = await this.getSetting('clientWhitelistEnabled');
    return setting === 'true';
  }

  async setClientWhitelistEnabled(enabled: boolean): Promise<void> {
    await this.setSetting('clientWhitelistEnabled', enabled ? 'true' : 'false');
  }

  // IP Blocklist methods
  async getIpBlocklist(): Promise<IpBlocklist[]> {
    return await db.select().from(ipBlocklist).orderBy(desc(ipBlocklist.addedAt));
  }

  async addIpToBlocklist(ip: InsertIpBlocklist): Promise<IpBlocklist> {
    const [newIp] = await db.insert(ipBlocklist).values(ip).returning();
    return newIp;
  }

  async removeIpFromBlocklist(id: string): Promise<boolean> {
    const result = await db.delete(ipBlocklist).where(eq(ipBlocklist.id, id)).returning();
    return result.length > 0;
  }

  async toggleIpBlocklist(id: string, enabled: boolean): Promise<boolean> {
    const result = await db
      .update(ipBlocklist)
      .set({ enabled })
      .where(eq(ipBlocklist.id, id))
      .returning();
    return result.length > 0;
  }

  async isIpBlocked(ipAddress: string): Promise<boolean> {
    const [entry] = await db
      .select()
      .from(ipBlocklist)
      .where(eq(ipBlocklist.ipAddress, ipAddress));
    return entry ? entry.enabled : false;
  }

  // CIDR Blocklist methods
  async getCidrBlocklist(): Promise<CidrBlocklist[]> {
    return await db.select().from(cidrBlocklist).orderBy(desc(cidrBlocklist.addedAt));
  }

  async addCidrToBlocklist(cidr: InsertCidrBlocklist): Promise<CidrBlocklist> {
    const [newCidr] = await db.insert(cidrBlocklist).values(cidr).returning();
    return newCidr;
  }

  async removeCidrFromBlocklist(id: string): Promise<boolean> {
    const result = await db.delete(cidrBlocklist).where(eq(cidrBlocklist.id, id)).returning();
    return result.length > 0;
  }

  async toggleCidrBlocklist(id: string, enabled: boolean): Promise<boolean> {
    const result = await db
      .update(cidrBlocklist)
      .set({ enabled })
      .where(eq(cidrBlocklist.id, id))
      .returning();
    return result.length > 0;
  }

  async isIpInBlockedCidrRange(ipAddress: string): Promise<boolean> {
    const enabledRanges = await db
      .select()
      .from(cidrBlocklist)
      .where(eq(cidrBlocklist.enabled, true));

    if (enabledRanges.length === 0) return false;

    let parsedIp: ReturnType<typeof ipaddr.parse>;
    try {
      parsedIp = ipaddr.parse(ipAddress);
    } catch {
      return false;
    }

    for (const entry of enabledRanges) {
      try {
        const [rangeAddr, prefixLength] = ipaddr.parseCIDR(entry.cidrRange);
        if (parsedIp.kind() === rangeAddr.kind() && parsedIp.match(rangeAddr, prefixLength)) {
          return true;
        }
      } catch {
        // Invalid CIDR in DB — skip
      }
    }
    return false;
  }

  // Domain Pool methods (database implementation)
  async getDomainPool(): Promise<DomainPool[]> {
    return await db.select().from(domainPool).orderBy(desc(domainPool.createdAt));
  }

  async addDomainToPool(domain: InsertDomainPool): Promise<DomainPool> {
    const [newDomain] = await db.insert(domainPool).values(domain).returning();
    return newDomain;
  }

  async removeDomainFromPool(id: string): Promise<boolean> {
    const result = await db.delete(domainPool).where(eq(domainPool.id, id)).returning();
    return result.length > 0;
  }

  async toggleDomainInPool(id: string, enabled: boolean): Promise<boolean> {
    const result = await db.update(domainPool).set({ enabled }).where(eq(domainPool.id, id)).returning();
    return result.length > 0;
  }

  async getDomainFromPool(id: string): Promise<DomainPool | undefined> {
    const [domain] = await db.select().from(domainPool).where(eq(domainPool.id, id));
    return domain;
  }

  async getUserDomainGenerations(userId: string): Promise<UserDomainGeneration[]> {
    return await db.select().from(userDomainGenerations)
      .where(eq(userDomainGenerations.userId, userId))
      .orderBy(desc(userDomainGenerations.generatedAt));
  }

  async getUserDomainGenerationsToday(userId: string): Promise<UserDomainGeneration[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return await db.select().from(userDomainGenerations)
      .where(eq(userDomainGenerations.userId, userId))
      .orderBy(desc(userDomainGenerations.generatedAt));
  }

  async createUserDomainGeneration(generation: InsertUserDomainGeneration): Promise<UserDomainGeneration> {
    const [newGeneration] = await db.insert(userDomainGenerations).values(generation).returning();
    return newGeneration;
  }

  async getDailyGenerationLimit(): Promise<number> {
    const limit = await this.getSetting('dailyGenerationLimit');
    return limit ? parseInt(limit, 10) : 3;
  }

  async setDailyGenerationLimit(limit: number): Promise<void> {
    await this.setSetting('dailyGenerationLimit', limit.toString());
  }

  async createAuditLog(entry: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values(entry).returning();
    return log;
  }

  async getRecentAuditLogs(limit = 100): Promise<AuditLog[]> {
    return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
  }
}

// Primary storage: Cloud Firestore for persistent storage, fallback to SQL database or MemStorage
export const storage: IStorage = isFirestoreAvailable
  ? new FirestoreStorage()
  : (isDatabaseConfigured && db !== null)
  ? new DatabaseStorage()
  : new MemStorage();
