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

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });
