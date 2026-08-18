/**
 * One-time admin seed script.
 * Run with: npx tsx scripts/seed-admin.ts
 *
 * Creates the initial admin account if it does not already exist.
 * Set ADMIN_USERNAME and ADMIN_PASSWORD env vars before running,
 * or it will error out rather than use defaults.
 */

import { storage } from "../server/storage";
import bcrypt from "bcrypt";

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error(
      "❌ ADMIN_USERNAME and ADMIN_PASSWORD must be set as environment variables."
    );
    process.exit(1);
  }

  const existing = await storage.getUserByUsername(username);
  if (existing) {
    console.log(`✅ Admin user "${username}" already exists — nothing to do.`);
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await storage.createUser({ username, password: hashedPassword });
  console.log(`✅ Admin user "${username}" created successfully.`);
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
