import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from "@shared/schema";
import dotenv from "dotenv";
import { resolve } from "path";
import * as fs from "fs";

// Manually load .env file from the current working directory in production
dotenv.config({ path: resolve(process.cwd(), ".env") });

if (!process.env.DATABASE_URL) {
  // Fallback to reading the file directly if dotenv fails
  try {
    const envFile = fs.readFileSync(resolve(process.cwd(), ".env"), "utf8");
    const match = envFile.match(/DATABASE_URL=(.*)/);
    if (match && match[1]) {
      process.env.DATABASE_URL = match[1].trim().replace(/^['"]|['"]$/g, "");
    }
  } catch (e) {
    // Ignore FS errors
  }
}

export function isValidDatabaseUrl(url: string | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (
    trimmed === "" ||
    trimmed === "your_postgresql_url_here" ||
    trimmed.includes("your_postgresql_url") ||
    trimmed === "base" ||
    trimmed.startsWith("base")
  ) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "postgres:" || parsed.protocol === "postgresql:";
  } catch {
    return false;
  }
}

export const isDatabaseConfigured = isValidDatabaseUrl(process.env.DATABASE_URL);

let dbInstance: any = null;
if (isDatabaseConfigured && process.env.DATABASE_URL) {
  try {
    const sql = neon(process.env.DATABASE_URL.trim());
    dbInstance = drizzle(sql, { schema });
  } catch (err) {
    console.warn("Failed to initialize Neon database connection:", err);
  }
}

export const db = dbInstance;
