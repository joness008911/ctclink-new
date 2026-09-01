import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const classifications = pgTable("classifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ipAddress: text("ip_address").notNull(),
  location: text("location"),
  country: text("country"),
  countryCode: text("country_code"),
  city: text("city"),
  region: text("region"),
  visitorType: text("visitor_type").notNull(), // 'Human' or 'Bot'
  detectionMethod: text("detection_method").notNull(),
  connectionType: text("connection_type"),
  isp: text("isp"),
  browser: text("browser"),
  deviceType: text("device_type"),
  apiKeyId: varchar("api_key_id").references(() => apiKeys.id, { onDelete: 'set null' }), // Link to which API key was used
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const detectionRules = pgTable("detection_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  rules: jsonb("rules").notNull(), // JSON object with rule configuration
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  keyName: text("key_name").notNull(),
  keyValue: text("key_value").notNull().unique(),
  enabled: boolean("enabled").default(true).notNull(),
  status: text("status").default("active").notNull(), // active, paused, expired
  expirationPeriod: text("expiration_period").default("unlimited").notNull(), // daily, weekly, monthly, unlimited
  expiresAt: timestamp("expires_at"),
  callLimit: integer("call_limit").default(1000).notNull(),
  callCount: integer("call_count").default(0).notNull(),
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const countryWhitelist = pgTable("country_whitelist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  countryCode: varchar("country_code", { length: 2 }).notNull().unique(),
  countryName: varchar("country_name", { length: 100 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export const ispWhitelist = pgTable("isp_whitelist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ispName: varchar("isp_name", { length: 255 }).notNull(),
  countryCode: varchar("country_code", { length: 2 }),
  enabled: boolean("enabled").default(true).notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export const ispBlacklist = pgTable("isp_blacklist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ispName: varchar("isp_name", { length: 255 }).notNull().unique(),
  category: varchar("category", { length: 50 }),
  enabled: boolean("enabled").default(true).notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

// IP Blocklist (Block specific IPs or IP ranges)
export const ipBlocklist = pgTable("ip_blocklist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ipAddress: varchar("ip_address", { length: 45 }).notNull().unique(), // Supports both IPv4 and IPv6
  reason: varchar("reason", { length: 255 }),
  enabled: boolean("enabled").default(true).notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

// CIDR Blocklist (Block IP ranges using CIDR notation)
export const cidrBlocklist = pgTable("cidr_blocklist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cidrRange: varchar("cidr_range", { length: 50 }).notNull().unique(), // e.g., "192.168.1.0/24"
  reason: varchar("reason", { length: 255 }),
  enabled: boolean("enabled").default(true).notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

// Client IP Whitelist (IPs/CIDR ranges allowed to access /user dashboard)
export const clientIpWhitelist = pgTable("client_ip_whitelist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  label: varchar("label", { length: 255 }).notNull(), // e.g., "Office Network", "Home IP"
  cidr: varchar("cidr", { length: 50 }).notNull(), // e.g., "192.168.1.100" or "10.0.0.0/24"
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Client Users (End-user customers who use the CleanTraffic service)
export const clientUsers = pgTable("client_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  email: text("email"),
  emailVerified: boolean("email_verified").default(false).notNull(),
  emailVerifiedAt: timestamp("email_verified_at"),
  apiKeyId: varchar("api_key_id").references(() => apiKeys.id, { onDelete: 'set null' }),
  status: text("status").default("active").notNull(), // active, suspended, expired
  tosAccepted: timestamp("tos_accepted"), // Terms of service acceptance timestamp
  complianceStatus: text("compliance_status").default("pending").notNull(), // pending, cleared, flagged, suspended
  newsletter: boolean("newsletter").default(false),
  // Billing fields
  subscriptionStatus: text("subscription_status").default("trialing").notNull(), // trialing, active, past_due, cancelled
  trialEndsAt: timestamp("trial_ends_at"), // null = no trial configured yet
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User Redirect URLs (Custom redirect URLs & traffic rules per user)
export const userRedirectUrls = pgTable("user_redirect_urls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => clientUsers.id, { onDelete: 'cascade' }),
  humanUrl: text("human_url").notNull().default(""),
  botUrl: text("bot_url").notNull().default(""),
  allowedCountries: text("allowed_countries").default("ALL"), // "ALL" or comma-separated ISO codes e.g. "AU,US,GB"
  allowedDevices: text("allowed_devices").default("all"), // "all" | "desktop" | "mobile" | "mobile_tablet"
  desktopOsFilter: text("desktop_os_filter").default("both"), // "both" | "windows" | "mac"
  blockVpn: text("block_vpn").default("block"), // "block" | "allow"
  blockDatacenter: text("block_datacenter").default("block"), // "block" | "allow"
  blockTor: text("block_tor").default("block"), // "block" | "allow"
  fingerprintActivate: text("fingerprint_activate").default("enabled"), // "enabled" | "disabled"
  wildcardSubdomains: text("wildcard_subdomains").default("disabled"), // "disabled" | "enabled"
  allowVpn: boolean("allow_vpn").default(false).notNull(), // backwards-compatibility boolean
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Domain Pool (Domains available for client users to generate links)
export const domainPool = pgTable("domain_pool", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domain: text("domain").notNull().unique(), // e.g., "example.com", "mytracker.io"
  description: text("description"), // Optional description for admin reference
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User Domain Generations (Track which domains users have generated, for daily limits)
export const userDomainGenerations = pgTable("user_domain_generations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => clientUsers.id, { onDelete: 'cascade' }),
  domainId: varchar("domain_id").notNull().references(() => domainPool.id, { onDelete: 'cascade' }),
  domain: text("domain").notNull(), // Store domain name for easy access even if pool entry is deleted
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertClassificationSchema = createInsertSchema(classifications).omit({
  id: true,
  timestamp: true,
});

export const insertDetectionRulesSchema = createInsertSchema(detectionRules).omit({
  id: true,
  updatedAt: true,
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastUsed: true,
  callCount: true,
}).extend({
  expirationPeriod: z.enum(["10seconds", "1minute", "1hour", "daily", "weekly", "monthly", "unlimited"]).default("unlimited"),
  callLimit: z.number().min(1).max(100000).default(1000),
});

export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
});

export const insertCountryWhitelistSchema = createInsertSchema(countryWhitelist).omit({
  id: true,
  addedAt: true,
});

export const insertIspWhitelistSchema = createInsertSchema(ispWhitelist).omit({
  id: true,
  addedAt: true,
});

export const insertIspBlacklistSchema = createInsertSchema(ispBlacklist).omit({
  id: true,
  addedAt: true,
});

export const insertIpBlocklistSchema = createInsertSchema(ipBlocklist).omit({
  id: true,
  addedAt: true,
});

export const insertCidrBlocklistSchema = createInsertSchema(cidrBlocklist).omit({
  id: true,
  addedAt: true,
});

export const insertClientIpWhitelistSchema = createInsertSchema(clientIpWhitelist).omit({
  id: true,
  createdAt: true,
});

export const insertClientUserSchema = createInsertSchema(clientUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  tosAccepted: z.date().nullable().optional(),
  complianceStatus: z.string().optional(),
});

export const insertUserRedirectUrlsSchema = createInsertSchema(userRedirectUrls).omit({
  id: true,
  updatedAt: true,
});

export const insertDomainPoolSchema = createInsertSchema(domainPool).omit({
  id: true,
  createdAt: true,
});

export const insertUserDomainGenerationSchema = createInsertSchema(userDomainGenerations).omit({
  id: true,
  generatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertClassification = z.infer<typeof insertClassificationSchema>;
export type Classification = typeof classifications.$inferSelect;
export type InsertDetectionRules = z.infer<typeof insertDetectionRulesSchema>;
export type DetectionRules = typeof detectionRules.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertCountryWhitelist = z.infer<typeof insertCountryWhitelistSchema>;
export type CountryWhitelist = typeof countryWhitelist.$inferSelect;
export type InsertIspWhitelist = z.infer<typeof insertIspWhitelistSchema>;
export type IspWhitelist = typeof ispWhitelist.$inferSelect;
export type InsertIspBlacklist = z.infer<typeof insertIspBlacklistSchema>;
export type IspBlacklist = typeof ispBlacklist.$inferSelect;
export type InsertIpBlocklist = z.infer<typeof insertIpBlocklistSchema>;
export type IpBlocklist = typeof ipBlocklist.$inferSelect;
export type InsertCidrBlocklist = z.infer<typeof insertCidrBlocklistSchema>;
export type CidrBlocklist = typeof cidrBlocklist.$inferSelect;
export type InsertClientIpWhitelist = z.infer<typeof insertClientIpWhitelistSchema>;
export type ClientIpWhitelist = typeof clientIpWhitelist.$inferSelect;
export type InsertClientUser = z.infer<typeof insertClientUserSchema>;
export type ClientUser = typeof clientUsers.$inferSelect;
export type InsertUserRedirectUrls = z.infer<typeof insertUserRedirectUrlsSchema>;
export type UserRedirectUrls = typeof userRedirectUrls.$inferSelect;
export type InsertDomainPool = z.infer<typeof insertDomainPoolSchema>;
export type DomainPool = typeof domainPool.$inferSelect;
export type InsertUserDomainGeneration = z.infer<typeof insertUserDomainGenerationSchema>;
export type UserDomainGeneration = typeof userDomainGenerations.$inferSelect;

// Tracks Stripe webhook events that have already been processed (idempotency guard)
export const stripeProcessedEvents = pgTable("stripe_processed_events", {
  eventId: text("event_id").primaryKey(),
  // claimed_at: when processing began (lease timestamp). Stale leases (>5 min) are reclaimable.
  claimedAt: timestamp("claimed_at").defaultNow().notNull(),
  // processed_at: set only after successful DB mutation. NULL means in-flight (not yet done).
  processedAt: timestamp("processed_at"),
});

// Audit Logs — immutable record of sensitive admin actions
// No secrets are stored here; only structural metadata.
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorId: text("actor_id"),           // admin user ID; null for system events
  actorType: text("actor_type").notNull(), // 'admin' | 'system'
  action: text("action").notNull(),    // e.g. 'admin.login', 'api_key.created'
  targetId: text("target_id"),         // affected entity ID, if applicable
  targetType: text("target_type"),     // 'api_key' | 'client_user' | 'detection_rules' | ...
  metadata: jsonb("metadata"),         // extra context (no secrets)
  ipAddress: text("ip_address"),       // client IP, primarily for auth events
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
