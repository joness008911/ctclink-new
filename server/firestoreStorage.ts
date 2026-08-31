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
  type DomainPool,
  type InsertDomainPool,
  type UserDomainGeneration,
  type InsertUserDomainGeneration,
  type AuditLog,
  type InsertAuditLog,
} from "@shared/schema";
import { type IStorage } from "./storage";
import { firestore } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import * as ipaddr from "ipaddr.js";

export class FirestoreStorage implements IStorage {
  private db = firestore!;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.bootstrapDefaults();
  }

  private async bootstrapDefaults() {
    try {
      // Ensure default admin user exists
      const adminQ = query(collection(this.db, "users"), where("username", "==", "admin"), limit(1));
      const adminSnap = await getDocs(adminQ);
      if (adminSnap.empty) {
        const adminId = "default-admin-id";
        const passwordHash = bcrypt.hashSync("admin123", 10);
        await setDoc(doc(this.db, "users", adminId), {
          id: adminId,
          username: "admin",
          password: passwordHash,
        });
        console.log("🔥 Created default admin user in Firestore");
      }

      // Ensure default detection rules exist
      const rulesSnap = await getDoc(doc(this.db, "detection_rules", "global"));
      if (!rulesSnap.exists()) {
        await setDoc(doc(this.db, "detection_rules", "global"), {
          id: "global",
          name: "Default Rules",
          enabled: true,
          rules: {
            blockVpn: true,
            blockTor: true,
            blockDataCenter: true,
            blockPublicProxy: true,
            blockWebCrawler: true,
          },
          updatedAt: new Date().toISOString(),
        });
      }

      // Ensure demo API key exists
      const keyQ = query(collection(this.db, "api_keys"), where("keyValue", "==", "ctc_demo_key_2026"), limit(1));
      const keySnap = await getDocs(keyQ);
      let demoKeyId = "demo-api-key-id";
      if (keySnap.empty) {
        await setDoc(doc(this.db, "api_keys", demoKeyId), {
          id: demoKeyId,
          keyName: "Demo API Key",
          keyValue: "ctc_demo_key_2026",
          callLimit: 100000,
          callCount: 142,
          status: "active",
          enabled: true,
          expirationPeriod: "unlimited",
          expiresAt: null,
          lastUsed: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        demoKeyId = keySnap.docs[0].id;
      }

      // Ensure demo client user exists
      const clientQ = query(collection(this.db, "client_users"), where("username", "==", "demo"), limit(1));
      const clientSnap = await getDocs(clientQ);
      if (clientSnap.empty) {
        const clientUserId = "demo-client-user-id";
        await setDoc(doc(this.db, "client_users", clientUserId), {
          id: clientUserId,
          username: "demo",
          password: bcrypt.hashSync("demo123", 10),
          email: "demo@cleantraffic.io",
          status: "active",
          apiKeyId: demoKeyId,
          tosAccepted: new Date().toISOString(),
          complianceStatus: "compliant",
          subscriptionStatus: "active",
          trialEndsAt: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn("Firestore bootstrap error (non-fatal):", e);
    }
  }

  // ── Users (Admin) ──────────────────────────────────────────────────────────
  async getUser(id: string): Promise<User | undefined> {
    try {
      const snap = await getDoc(doc(this.db, "users", id));
      if (!snap.exists()) return undefined;
      return snap.data() as User;
    } catch (e) {
      console.error("Firestore getUser error:", e);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const q = query(collection(this.db, "users"), where("username", "==", username), limit(1));
      const snaps = await getDocs(q);
      if (snaps.empty) return undefined;
      return snaps.docs[0].data() as User;
    } catch (e) {
      console.error("Firestore getUserByUsername error:", e);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      username: insertUser.username,
      password: insertUser.password,
    };
    await setDoc(doc(this.db, "users", id), user);
    return user;
  }

  // ── Classifications ────────────────────────────────────────────────────────
  async createClassification(classification: InsertClassification): Promise<Classification> {
    const id = randomUUID();
    const now = new Date();
    const record: Classification = {
      id,
      ipAddress: classification.ipAddress,
      location: classification.location || "Unknown",
      country: classification.country || "Unknown",
      countryCode: classification.countryCode || "Unknown",
      city: classification.city || "Unknown",
      region: classification.region || "",
      visitorType: classification.visitorType || "Human",
      detectionMethod: classification.detectionMethod || "IP Analysis",
      connectionType: classification.connectionType || null,
      isp: classification.isp || "Unknown",
      browser: classification.browser || "Unknown",
      deviceType: classification.deviceType || "desktop",
      apiKeyId: classification.apiKeyId || null,
      timestamp: now,
    };

    try {
      await setDoc(doc(this.db, "classifications", id), {
        ...record,
        timestamp: now.toISOString(),
      });
    } catch (e) {
      console.error("Firestore createClassification error:", e);
    }
    return record;
  }

  async getRecentClassifications(limitCount = 10): Promise<Classification[]> {
    try {
      const q = query(
        collection(this.db, "classifications"),
        orderBy("timestamp", "desc"),
        limit(limitCount)
      );
      const snaps = await getDocs(q);
      return snaps.docs.map((d) => {
        const data = d.data();
        return {
          ...data,
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        } as Classification;
      });
    } catch (e) {
      console.error("Firestore getRecentClassifications error:", e);
      return [];
    }
  }

  async getClassificationStats(): Promise<{
    totalClassifications: number;
    humanVisitors: number;
    botTraffic: number;
    apiRequests: number;
  }> {
    try {
      const snaps = await getDocs(collection(this.db, "classifications"));
      let humanCount = 0;
      let botCount = 0;
      snaps.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.visitorType === "Human") humanCount++;
        else botCount++;
      });
      return {
        totalClassifications: snaps.size,
        humanVisitors: humanCount,
        botTraffic: botCount,
        apiRequests: snaps.size,
      };
    } catch (e) {
      console.error("Firestore getClassificationStats error:", e);
      return { totalClassifications: 0, humanVisitors: 0, botTraffic: 0, apiRequests: 0 };
    }
  }

  // ── Detection Rules ────────────────────────────────────────────────────────
  async getDetectionRules(): Promise<DetectionRules | undefined> {
    try {
      const snap = await getDoc(doc(this.db, "detection_rules", "global"));
      if (!snap.exists()) {
        const defaultRules: DetectionRules = {
          id: "global",
          name: "Default Rules",
          enabled: true,
          rules: {
            blockVpn: true,
            blockTor: true,
            blockDataCenter: true,
            blockPublicProxy: true,
            blockWebCrawler: true,
          },
          updatedAt: new Date(),
        };
        await setDoc(doc(this.db, "detection_rules", "global"), {
          ...defaultRules,
          updatedAt: defaultRules.updatedAt.toISOString(),
        });
        return defaultRules;
      }
      const data = snap.data();
      return {
        ...data,
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
      } as DetectionRules;
    } catch (e) {
      console.error("Firestore getDetectionRules error:", e);
      return undefined;
    }
  }

  async updateDetectionRules(rules: InsertDetectionRules): Promise<DetectionRules> {
    const updated: DetectionRules = {
      id: "global",
      name: rules.name || "Default Rules",
      enabled: rules.enabled ?? true,
      rules: rules.rules,
      updatedAt: new Date(),
    };
    await setDoc(doc(this.db, "detection_rules", "global"), {
      ...updated,
      updatedAt: updated.updatedAt.toISOString(),
    });
    return updated;
  }

  // ── API Keys & Licenses ────────────────────────────────────────────────────
  async createApiKey(apiKey: InsertApiKey): Promise<ApiKey> {
    const id = randomUUID();
    const now = new Date();
    const newApiKey: ApiKey = {
      id,
      keyName: apiKey.keyName,
      keyValue: apiKey.keyValue,
      enabled: apiKey.enabled ?? true,
      status: apiKey.status || "active",
      expirationPeriod: apiKey.expirationPeriod || "unlimited",
      expiresAt: apiKey.expiresAt ? new Date(apiKey.expiresAt) : null,
      callLimit: apiKey.callLimit ?? 1000,
      callCount: 0,
      lastUsed: null,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(this.db, "api_keys", id), {
      ...newApiKey,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: newApiKey.expiresAt ? newApiKey.expiresAt.toISOString() : null,
    });
    return newApiKey;
  }

  async getApiKeys(): Promise<ApiKey[]> {
    try {
      const snaps = await getDocs(collection(this.db, "api_keys"));
      return snaps.docs.map((d) => {
        const data = d.data();
        return {
          ...data,
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
          updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          lastUsed: data.lastUsed ? new Date(data.lastUsed) : null,
        } as ApiKey;
      });
    } catch (e) {
      console.error("Firestore getApiKeys error:", e);
      return [];
    }
  }

  async getApiKey(keyValue: string): Promise<ApiKey | undefined> {
    try {
      const q = query(collection(this.db, "api_keys"), where("keyValue", "==", keyValue), limit(1));
      const snaps = await getDocs(q);
      if (snaps.empty) return undefined;
      const data = snaps.docs[0].data();
      return {
        ...data,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        lastUsed: data.lastUsed ? new Date(data.lastUsed) : null,
      } as ApiKey;
    } catch (e) {
      console.error("Firestore getApiKey error:", e);
      return undefined;
    }
  }

  async getApiKeyById(id: string): Promise<ApiKey | undefined> {
    try {
      const snap = await getDoc(doc(this.db, "api_keys", id));
      if (!snap.exists()) return undefined;
      const data = snap.data();
      return {
        ...data,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        lastUsed: data.lastUsed ? new Date(data.lastUsed) : null,
      } as ApiKey;
    } catch (e) {
      console.error("Firestore getApiKeyById error:", e);
      return undefined;
    }
  }

  async getApiKeyByValue(keyValue: string): Promise<ApiKey | undefined> {
    return this.getApiKey(keyValue);
  }

  async deleteApiKey(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(this.db, "api_keys", id));
      return true;
    } catch (e) {
      console.error("Firestore deleteApiKey error:", e);
      return false;
    }
  }

  async updateApiKey(id: string, updates: Partial<ApiKey>): Promise<ApiKey | undefined> {
    try {
      const ref = doc(this.db, "api_keys", id);
      const updateData: any = { ...updates, updatedAt: new Date().toISOString() };
      if (updates.expiresAt instanceof Date) {
        updateData.expiresAt = updates.expiresAt.toISOString();
      }
      if (updates.lastUsed instanceof Date) {
        updateData.lastUsed = updates.lastUsed.toISOString();
      }
      await updateDoc(ref, updateData);
      return this.getApiKeyById(id);
    } catch (e) {
      console.error("Firestore updateApiKey error:", e);
      return undefined;
    }
  }

  async incrementApiKeyUsage(keyValue: string): Promise<boolean> {
    try {
      const apiKey = await this.getApiKey(keyValue);
      if (!apiKey) return false;
      const newCount = (apiKey.callCount || 0) + 1;
      await updateDoc(doc(this.db, "api_keys", apiKey.id), {
        callCount: newCount,
        lastUsed: new Date().toISOString(),
      });
      return true;
    } catch (e) {
      console.error("Firestore incrementApiKeyUsage error:", e);
      return false;
    }
  }

  async pauseApiKey(id: string): Promise<boolean> {
    try {
      await updateDoc(doc(this.db, "api_keys", id), {
        status: "paused",
        updatedAt: new Date().toISOString(),
      });
      return true;
    } catch (e) {
      console.error("Firestore pauseApiKey error:", e);
      return false;
    }
  }

  async renewApiKey(id: string): Promise<ApiKey | undefined> {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      await updateDoc(doc(this.db, "api_keys", id), {
        status: "active",
        expiresAt: expiresAt.toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return this.getApiKeyById(id);
    } catch (e) {
      console.error("Firestore renewApiKey error:", e);
      return undefined;
    }
  }

  // ── Country Whitelist ──────────────────────────────────────────────────────
  async getCountryWhitelist(): Promise<CountryWhitelist[]> {
    try {
      const snaps = await getDocs(collection(this.db, "country_whitelist"));
      return snaps.docs.map((d) => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          addedAt: data.addedAt ? new Date(data.addedAt) : new Date(),
        } as CountryWhitelist;
      });
    } catch (e) {
      console.error("Firestore getCountryWhitelist error:", e);
      return [];
    }
  }

  async addCountryToWhitelist(country: InsertCountryWhitelist): Promise<CountryWhitelist> {
    const id = randomUUID();
    const now = new Date();
    const record: CountryWhitelist = {
      id,
      countryCode: country.countryCode.toUpperCase(),
      countryName: country.countryName,
      enabled: country.enabled ?? true,
      addedAt: now,
    };
    await setDoc(doc(this.db, "country_whitelist", id), {
      ...record,
      addedAt: now.toISOString(),
    });
    return record;
  }

  async removeCountryFromWhitelist(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(this.db, "country_whitelist", id));
      return true;
    } catch (e) {
      return false;
    }
  }

  async toggleCountryWhitelist(id: string, enabled: boolean): Promise<boolean> {
    try {
      await updateDoc(doc(this.db, "country_whitelist", id), { enabled });
      return true;
    } catch (e) {
      return false;
    }
  }

  async isCountryAllowed(countryCode: string): Promise<boolean> {
    try {
      const countries = await this.getCountryWhitelist();
      const activeCountries = countries.filter((c) => c.enabled !== false);
      if (activeCountries.length === 0) return true; // Geo-fencing disabled
      return activeCountries.some((c) => c.countryCode.toUpperCase() === countryCode.toUpperCase());
    } catch (e) {
      return true;
    }
  }

  // ── ISP Whitelist ──────────────────────────────────────────────────────────
  async getIspWhitelist(countryCode?: string): Promise<IspWhitelist[]> {
    try {
      const snaps = await getDocs(collection(this.db, "isp_whitelist"));
      const list = snaps.docs.map((d) => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          addedAt: data.addedAt ? new Date(data.addedAt) : new Date(),
        } as IspWhitelist;
      });
      if (countryCode) {
        return list.filter((i) => i.countryCode?.toUpperCase() === countryCode.toUpperCase());
      }
      return list;
    } catch (e) {
      return [];
    }
  }

  async addIspToWhitelist(isp: InsertIspWhitelist): Promise<IspWhitelist> {
    const id = randomUUID();
    const now = new Date();
    const record: IspWhitelist = {
      id,
      ispName: isp.ispName,
      countryCode: isp.countryCode?.toUpperCase() || null,
      enabled: isp.enabled ?? true,
      addedAt: now,
    };
    await setDoc(doc(this.db, "isp_whitelist", id), {
      ...record,
      addedAt: now.toISOString(),
    });
    return record;
  }

  async removeIspFromWhitelist(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(this.db, "isp_whitelist", id));
      return true;
    } catch (e) {
      return false;
    }
  }

  async toggleIspWhitelist(id: string, enabled: boolean): Promise<boolean> {
    try {
      await updateDoc(doc(this.db, "isp_whitelist", id), { enabled });
      return true;
    } catch (e) {
      return false;
    }
  }

  async isIspWhitelisted(ispName: string): Promise<boolean> {
    try {
      const list = await this.getIspWhitelist();
      return list.some(
        (i) => i.enabled !== false && ispName.toLowerCase().includes(i.ispName.toLowerCase())
      );
    } catch (e) {
      return false;
    }
  }

  // ── ISP Blacklist ──────────────────────────────────────────────────────────
  async getIspBlacklist(): Promise<IspBlacklist[]> {
    try {
      const snaps = await getDocs(collection(this.db, "isp_blacklist"));
      return snaps.docs.map((d) => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          addedAt: data.addedAt ? new Date(data.addedAt) : new Date(),
        } as IspBlacklist;
      });
    } catch (e) {
      return [];
    }
  }

  async addIspToBlacklist(isp: InsertIspBlacklist): Promise<IspBlacklist> {
    const id = randomUUID();
    const now = new Date();
    const record: IspBlacklist = {
      id,
      ispName: isp.ispName,
      category: isp.category || "vpn",
      enabled: isp.enabled ?? true,
      addedAt: now,
    };
    await setDoc(doc(this.db, "isp_blacklist", id), {
      ...record,
      addedAt: now.toISOString(),
    });
    return record;
  }

  async bulkAddIspsToBlacklist(ispNames: string[], category: string): Promise<{ added: number; skipped: number; errors: string[] }> {
    let added = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const name of ispNames) {
      try {
        await this.addIspToBlacklist({ ispName: name.trim(), category });
        added++;
      } catch (err: any) {
        errors.push(err.message || String(err));
      }
    }
    return { added, skipped, errors };
  }

  async removeIspFromBlacklist(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(this.db, "isp_blacklist", id));
      return true;
    } catch (e) {
      return false;
    }
  }

  async toggleIspBlacklist(id: string, enabled: boolean): Promise<boolean> {
    try {
      await updateDoc(doc(this.db, "isp_blacklist", id), { enabled });
      return true;
    } catch (e) {
      return false;
    }
  }

  async isIspBlacklisted(ispName: string): Promise<boolean> {
    try {
      const list = await this.getIspBlacklist();
      return list.some(
        (i) => i.enabled !== false && ispName.toLowerCase().includes(i.ispName.toLowerCase())
      );
    } catch (e) {
      return false;
    }
  }

  // ── IP & CIDR Blocklists ───────────────────────────────────────────────────
  async getIpBlocklist(): Promise<IpBlocklist[]> {
    try {
      const snaps = await getDocs(collection(this.db, "ip_blocklist"));
      return snaps.docs.map((d) => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          addedAt: data.addedAt ? new Date(data.addedAt) : new Date(),
        } as IpBlocklist;
      });
    } catch (e) {
      return [];
    }
  }

  async addIpToBlocklist(ip: InsertIpBlocklist): Promise<IpBlocklist> {
    const id = randomUUID();
    const now = new Date();
    const record: IpBlocklist = {
      id,
      ipAddress: ip.ipAddress,
      reason: ip.reason || null,
      enabled: ip.enabled ?? true,
      addedAt: now,
    };
    await setDoc(doc(this.db, "ip_blocklist", id), {
      ...record,
      addedAt: now.toISOString(),
    });
    return record;
  }

  async removeIpFromBlocklist(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(this.db, "ip_blocklist", id));
      return true;
    } catch (e) {
      return false;
    }
  }

  async toggleIpBlocklist(id: string, enabled: boolean): Promise<boolean> {
    try {
      await updateDoc(doc(this.db, "ip_blocklist", id), { enabled });
      return true;
    } catch (e) {
      return false;
    }
  }

  async isIpBlocked(ipAddress: string): Promise<boolean> {
    try {
      const list = await this.getIpBlocklist();
      return list.some((i) => i.enabled !== false && i.ipAddress === ipAddress);
    } catch (e) {
      return false;
    }
  }

  async getCidrBlocklist(): Promise<CidrBlocklist[]> {
    try {
      const snaps = await getDocs(collection(this.db, "cidr_blocklist"));
      return snaps.docs.map((d) => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          addedAt: data.addedAt ? new Date(data.addedAt) : new Date(),
        } as CidrBlocklist;
      });
    } catch (e) {
      return [];
    }
  }

  async addCidrToBlocklist(cidr: InsertCidrBlocklist): Promise<CidrBlocklist> {
    const id = randomUUID();
    const now = new Date();
    const record: CidrBlocklist = {
      id,
      cidrRange: cidr.cidrRange,
      reason: cidr.reason || null,
      enabled: cidr.enabled ?? true,
      addedAt: now,
    };
    await setDoc(doc(this.db, "cidr_blocklist", id), {
      ...record,
      addedAt: now.toISOString(),
    });
    return record;
  }

  async removeCidrFromBlocklist(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(this.db, "cidr_blocklist", id));
      return true;
    } catch (e) {
      return false;
    }
  }

  async toggleCidrBlocklist(id: string, enabled: boolean): Promise<boolean> {
    try {
      await updateDoc(doc(this.db, "cidr_blocklist", id), { enabled });
      return true;
    } catch (e) {
      return false;
    }
  }

  async isIpInBlockedCidrRange(ipAddress: string): Promise<boolean> {
    try {
      const list = await this.getCidrBlocklist();
      const clientIp = ipaddr.parse(ipAddress.replace(/^::ffff:/, ""));
      for (const item of list) {
        if (item.enabled === false) continue;
        try {
          const parsedCidr = ipaddr.parseCIDR(item.cidrRange);
          if (clientIp.match(parsedCidr)) return true;
        } catch (e) {}
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  // ── Client IP Whitelist (/user dashboard access) ───────────────────────────
  async getClientIpWhitelist(): Promise<ClientIpWhitelist[]> {
    try {
      const snaps = await getDocs(collection(this.db, "client_ip_whitelist"));
      return snaps.docs.map((d) => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        } as ClientIpWhitelist;
      });
    } catch (e) {
      return [];
    }
  }

  async addIpToWhitelist(ip: InsertClientIpWhitelist): Promise<ClientIpWhitelist> {
    const id = randomUUID();
    const now = new Date();
    const record: ClientIpWhitelist = {
      id,
      label: ip.label,
      cidr: ip.cidr,
      enabled: ip.enabled ?? true,
      createdAt: now,
    };
    await setDoc(doc(this.db, "client_ip_whitelist", id), {
      ...record,
      createdAt: now.toISOString(),
    });
    return record;
  }

  async removeIpFromWhitelist(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(this.db, "client_ip_whitelist", id));
      return true;
    } catch (e) {
      return false;
    }
  }

  async toggleIpWhitelist(id: string, enabled: boolean): Promise<boolean> {
    try {
      await updateDoc(doc(this.db, "client_ip_whitelist", id), { enabled });
      return true;
    } catch (e) {
      return false;
    }
  }

  async isIpWhitelisted(ipAddress: string): Promise<boolean> {
    try {
      const enabled = await this.isClientWhitelistEnabled();
      if (!enabled) return true; // Whitelist disabled
      const list = await this.getClientIpWhitelist();
      const active = list.filter((i) => i.enabled !== false);
      if (active.length === 0) return true;

      const clientIp = ipaddr.parse(ipAddress.replace(/^::ffff:/, ""));
      for (const item of active) {
        try {
          if (item.cidr.includes("/")) {
            const parsedCidr = ipaddr.parseCIDR(item.cidr);
            if (clientIp.match(parsedCidr)) return true;
          } else {
            if (item.cidr === ipAddress.replace(/^::ffff:/, "")) return true;
          }
        } catch (e) {}
      }
      return false;
    } catch (e) {
      return true;
    }
  }

  async isClientWhitelistEnabled(): Promise<boolean> {
    const val = await this.getSetting("client_whitelist_enabled");
    return val === "true";
  }

  async setClientWhitelistEnabled(enabled: boolean): Promise<void> {
    await this.setSetting("client_whitelist_enabled", enabled ? "true" : "false");
  }

  // ── Client Users (End Users) ───────────────────────────────────────────────
  async createClientUser(user: InsertClientUser): Promise<ClientUser> {
    const id = randomUUID();
    const now = new Date();
    const record: ClientUser = {
      id,
      username: user.username,
      password: user.password,
      fullName: user.fullName || null,
      email: user.email || null,
      emailVerified: user.emailVerified ?? false,
      emailVerifiedAt: user.emailVerifiedAt ? new Date(user.emailVerifiedAt) : null,
      apiKeyId: user.apiKeyId || null,
      status: user.status || "active",
      tosAccepted: user.tosAccepted ? new Date(user.tosAccepted) : null,
      complianceStatus: user.complianceStatus || "cleared",
      newsletter: user.newsletter ?? false,
      subscriptionStatus: user.subscriptionStatus || "trialing",
      trialEndsAt: user.trialEndsAt ? new Date(user.trialEndsAt) : null,
      stripeCustomerId: user.stripeCustomerId || null,
      stripeSubscriptionId: user.stripeSubscriptionId || null,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(this.db, "client_users", id), {
      ...record,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      emailVerifiedAt: record.emailVerifiedAt ? record.emailVerifiedAt.toISOString() : null,
      trialEndsAt: record.trialEndsAt ? record.trialEndsAt.toISOString() : null,
      tosAccepted: record.tosAccepted ? record.tosAccepted.toISOString() : null,
    });
    return record;
  }

  async getClientUser(id: string): Promise<ClientUser | undefined> {
    try {
      const snap = await getDoc(doc(this.db, "client_users", id));
      if (!snap.exists()) return undefined;
      const data = snap.data();
      return {
        ...data,
        emailVerified: data.emailVerified ?? false,
        emailVerifiedAt: data.emailVerifiedAt ? new Date(data.emailVerifiedAt) : null,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
        trialEndsAt: data.trialEndsAt ? new Date(data.trialEndsAt) : null,
        tosAccepted: data.tosAccepted ? new Date(data.tosAccepted) : null,
      } as ClientUser;
    } catch (e) {
      return undefined;
    }
  }

  async getClientUserByUsername(username: string): Promise<ClientUser | undefined> {
    try {
      const q = query(collection(this.db, "client_users"), where("username", "==", username), limit(1));
      const snaps = await getDocs(q);
      if (snaps.empty) return undefined;
      const data = snaps.docs[0].data();
      return {
        ...data,
        emailVerified: data.emailVerified ?? false,
        emailVerifiedAt: data.emailVerifiedAt ? new Date(data.emailVerifiedAt) : null,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
        trialEndsAt: data.trialEndsAt ? new Date(data.trialEndsAt) : null,
        tosAccepted: data.tosAccepted ? new Date(data.tosAccepted) : null,
      } as ClientUser;
    } catch (e) {
      return undefined;
    }
  }

  async getClientUserByEmail(email: string): Promise<ClientUser | undefined> {
    try {
      const q = query(collection(this.db, "client_users"), where("email", "==", email), limit(1));
      const snaps = await getDocs(q);
      if (snaps.empty) return undefined;
      const data = snaps.docs[0].data();
      return {
        ...data,
        emailVerified: data.emailVerified ?? false,
        emailVerifiedAt: data.emailVerifiedAt ? new Date(data.emailVerifiedAt) : null,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
        trialEndsAt: data.trialEndsAt ? new Date(data.trialEndsAt) : null,
        tosAccepted: data.tosAccepted ? new Date(data.tosAccepted) : null,
      } as ClientUser;
    } catch (e) {
      return undefined;
    }
  }

  async getClientUserByUsernameOrEmail(identifier: string): Promise<ClientUser | undefined> {
    try {
      const cleanId = identifier.trim();
      const byUser = await this.getClientUserByUsername(cleanId);
      if (byUser) return byUser;
      return await this.getClientUserByEmail(cleanId);
    } catch (e) {
      return undefined;
    }
  }

  async updateClientUser(id: string, updates: Partial<ClientUser>): Promise<ClientUser | undefined> {
    try {
      const updateData: any = { ...updates, updatedAt: new Date().toISOString() };
      if (updates.trialEndsAt instanceof Date) updateData.trialEndsAt = updates.trialEndsAt.toISOString();
      if (updates.tosAccepted instanceof Date) updateData.tosAccepted = updates.tosAccepted.toISOString();
      if (updates.emailVerifiedAt instanceof Date) updateData.emailVerifiedAt = updates.emailVerifiedAt.toISOString();
      await updateDoc(doc(this.db, "client_users", id), updateData);
      return this.getClientUser(id);
    } catch (e) {
      return undefined;
    }
  }

  async getClientUserByApiKey(apiKeyId: string): Promise<ClientUser | undefined> {
    try {
      const q = query(collection(this.db, "client_users"), where("apiKeyId", "==", apiKeyId), limit(1));
      const snaps = await getDocs(q);
      if (!snaps.empty) {
        const data = snaps.docs[0].data();
        return {
          ...data,
          emailVerified: data.emailVerified ?? false,
          emailVerifiedAt: data.emailVerifiedAt ? new Date(data.emailVerifiedAt) : null,
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
          updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
          trialEndsAt: data.trialEndsAt ? new Date(data.trialEndsAt) : null,
          tosAccepted: data.tosAccepted ? new Date(data.tosAccepted) : null,
        } as ClientUser;
      }
      const all = await this.getAllClientUsers();
      return all.find(u => u.apiKeyId === apiKeyId);
    } catch (e) {
      try {
        const all = await this.getAllClientUsers();
        return all.find(u => u.apiKeyId === apiKeyId);
      } catch (err) {
        return undefined;
      }
    }
  }

  async getAllClientUsers(): Promise<ClientUser[]> {
    try {
      const snaps = await getDocs(collection(this.db, "client_users"));
      return snaps.docs.map((d) => {
        const data = d.data();
        return {
          ...data,
          emailVerified: data.emailVerified ?? false,
          emailVerifiedAt: data.emailVerifiedAt ? new Date(data.emailVerifiedAt) : null,
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
          updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
          trialEndsAt: data.trialEndsAt ? new Date(data.trialEndsAt) : null,
          tosAccepted: data.tosAccepted ? new Date(data.tosAccepted) : null,
        } as ClientUser;
      });
    } catch (e) {
      return [];
    }
  }

  async getClientUserByStripeCustomerId(stripeCustomerId: string): Promise<ClientUser | undefined> {
    try {
      const q = query(
        collection(this.db, "client_users"),
        where("stripeCustomerId", "==", stripeCustomerId),
        limit(1)
      );
      const snaps = await getDocs(q);
      if (snaps.empty) return undefined;
      const data = snaps.docs[0].data();
      return {
        ...data,
        emailVerified: data.emailVerified ?? false,
        emailVerifiedAt: data.emailVerifiedAt ? new Date(data.emailVerifiedAt) : null,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
        trialEndsAt: data.trialEndsAt ? new Date(data.trialEndsAt) : null,
        tosAccepted: data.tosAccepted ? new Date(data.tosAccepted) : null,
      } as ClientUser;
    } catch (e) {
      return undefined;
    }
  }

  async claimStripeEvent(eventId: string): Promise<boolean> {
    try {
      const ref = doc(this.db, "stripe_events", eventId);
      const snap = await getDoc(ref);
      if (snap.exists()) return false;
      await setDoc(ref, { claimedAt: new Date().toISOString() });
      return true;
    } catch (e) {
      return true;
    }
  }

  async markStripeEventProcessed(eventId: string): Promise<void> {
    try {
      await updateDoc(doc(this.db, "stripe_events", eventId), { processedAt: new Date().toISOString() });
    } catch (e) {}
  }

  async releaseStripeEvent(eventId: string): Promise<void> {
    try {
      await deleteDoc(doc(this.db, "stripe_events", eventId));
    } catch (e) {}
  }

  // ── User Redirect URLs ─────────────────────────────────────────────────────
  async getUserRedirectUrls(userId: string): Promise<UserRedirectUrls | undefined> {
    try {
      const snap = await getDoc(doc(this.db, "user_redirect_urls", userId));
      if (!snap.exists()) return undefined;
      const data = snap.data();
      return {
        ...data,
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
      } as UserRedirectUrls;
    } catch (e) {
      return undefined;
    }
  }

  async setUserRedirectUrls(userId: string, urls: { humanUrl: string; botUrl: string }): Promise<UserRedirectUrls> {
    const now = new Date();
    const record: UserRedirectUrls = {
      id: userId,
      userId,
      humanUrl: urls.humanUrl,
      botUrl: urls.botUrl,
      updatedAt: now,
    };
    await setDoc(doc(this.db, "user_redirect_urls", userId), {
      ...record,
      updatedAt: now.toISOString(),
    });
    return record;
  }

  // ── Classification for Users ───────────────────────────────────────────────
  async getUserClassifications(apiKeyId: string, limitCount = 100): Promise<Classification[]> {
    try {
      const q = query(
        collection(this.db, "classifications"),
        where("apiKeyId", "==", apiKeyId),
        orderBy("timestamp", "desc"),
        limit(limitCount)
      );
      const snaps = await getDocs(q);
      return snaps.docs.map((d) => {
        const data = d.data();
        return {
          ...data,
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        } as Classification;
      });
    } catch (e) {
      return [];
    }
  }

  async getUserStats(apiKeyId: string): Promise<{
    totalClassifications: number;
    humanVisitors: number;
    botTraffic: number;
  }> {
    try {
      const q = query(collection(this.db, "classifications"), where("apiKeyId", "==", apiKeyId));
      const snaps = await getDocs(q);
      let humanCount = 0;
      let botCount = 0;
      snaps.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.visitorType === "Human") humanCount++;
        else botCount++;
      });
      return {
        totalClassifications: snaps.size,
        humanVisitors: humanCount,
        botTraffic: botCount,
      };
    } catch (e) {
      return { totalClassifications: 0, humanVisitors: 0, botTraffic: 0 };
    }
  }

  // ── Global Settings (e.g. IP2Geo API Key) ──────────────────────────────────
  async getSetting(key: string): Promise<string | null> {
    try {
      const snap = await getDoc(doc(this.db, "settings", key));
      if (!snap.exists()) return null;
      return snap.data().value || null;
    } catch (e) {
      console.error(`Firestore getSetting(${key}) error:`, e);
      return null;
    }
  }

  async setSetting(key: string, value: string): Promise<void> {
    try {
      await setDoc(doc(this.db, "settings", key), {
        key,
        value,
        updatedAt: new Date().toISOString(),
      });
      console.log(`🔥 Persisted setting '${key}' to Firestore`);
    } catch (e) {
      console.error(`Firestore setSetting(${key}) error:`, e);
    }
  }

  // ── Domain Pool & Generators ───────────────────────────────────────────────
  async getDomainPool(): Promise<DomainPool[]> {
    try {
      const snaps = await getDocs(collection(this.db, "domain_pool"));
      return snaps.docs.map((d) => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        } as DomainPool;
      });
    } catch (e) {
      return [];
    }
  }

  async addDomainToPool(domain: InsertDomainPool): Promise<DomainPool> {
    const id = randomUUID();
    const now = new Date();
    const record: DomainPool = {
      id,
      domain: domain.domain,
      description: domain.description || null,
      enabled: domain.enabled ?? true,
      createdAt: now,
    };
    await setDoc(doc(this.db, "domain_pool", id), {
      ...record,
      createdAt: now.toISOString(),
    });
    return record;
  }

  async removeDomainFromPool(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(this.db, "domain_pool", id));
      return true;
    } catch (e) {
      return false;
    }
  }

  async toggleDomainInPool(id: string, enabled: boolean): Promise<boolean> {
    try {
      await updateDoc(doc(this.db, "domain_pool", id), { enabled });
      return true;
    } catch (e) {
      return false;
    }
  }

  async getDomainFromPool(id: string): Promise<DomainPool | undefined> {
    try {
      const snap = await getDoc(doc(this.db, "domain_pool", id));
      if (!snap.exists()) return undefined;
      const data = snap.data();
      return {
        ...data,
        id: snap.id,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      } as DomainPool;
    } catch (e) {
      return undefined;
    }
  }

  async getUserDomainGenerations(userId: string): Promise<UserDomainGeneration[]> {
    try {
      const q = query(
        collection(this.db, "user_domain_generations"),
        where("userId", "==", userId),
        orderBy("generatedAt", "desc")
      );
      const snaps = await getDocs(q);
      return snaps.docs.map((d) => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          generatedAt: data.generatedAt ? new Date(data.generatedAt) : new Date(),
        } as UserDomainGeneration;
      });
    } catch (e) {
      return [];
    }
  }

  async getUserDomainGenerationsToday(userId: string): Promise<UserDomainGeneration[]> {
    return this.getUserDomainGenerations(userId);
  }

  async createUserDomainGeneration(generation: InsertUserDomainGeneration): Promise<UserDomainGeneration> {
    const id = randomUUID();
    const now = new Date();
    const record: UserDomainGeneration = {
      id,
      userId: generation.userId,
      domainId: generation.domainId,
      domain: generation.domain,
      generatedAt: now,
    };
    await setDoc(doc(this.db, "user_domain_generations", id), {
      ...record,
      generatedAt: now.toISOString(),
    });
    return record;
  }

  async getDailyGenerationLimit(): Promise<number> {
    const val = await this.getSetting("daily_generation_limit");
    return val ? parseInt(val, 10) : 3;
  }

  async setDailyGenerationLimit(limitCount: number): Promise<void> {
    await this.setSetting("daily_generation_limit", limitCount.toString());
  }

  // ── Audit Logs ─────────────────────────────────────────────────────────────
  async createAuditLog(entry: InsertAuditLog): Promise<AuditLog> {
    const id = randomUUID();
    const now = new Date();
    const record: AuditLog = {
      id,
      actorId: entry.actorId || null,
      actorType: entry.actorType || "admin",
      action: entry.action,
      targetType: entry.targetType || null,
      targetId: entry.targetId || null,
      metadata: entry.metadata || null,
      ipAddress: entry.ipAddress || null,
      createdAt: now,
    };
    try {
      await setDoc(doc(this.db, "audit_logs", id), {
        ...record,
        createdAt: now.toISOString(),
      });
    } catch (e) {}
    return record;
  }

  async getRecentAuditLogs(limitCount = 100): Promise<AuditLog[]> {
    try {
      const q = query(
        collection(this.db, "audit_logs"),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );
      const snaps = await getDocs(q);
      return snaps.docs.map((d) => {
        const data = d.data();
        return {
          ...data,
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        } as AuditLog;
      });
    } catch (e) {
      return [];
    }
  }
}
