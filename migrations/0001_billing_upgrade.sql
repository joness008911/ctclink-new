-- Billing upgrade migration
-- Safe for both fresh databases (columns already exist from 0000) and existing
-- production databases (client_users table exists but billing columns are absent).
--
-- ADD COLUMN IF NOT EXISTS is idempotent: no-op if column already present.

ALTER TABLE "client_users"
  ADD COLUMN IF NOT EXISTS "subscription_status" text DEFAULT 'trialing' NOT NULL;

ALTER TABLE "client_users"
  ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp;

ALTER TABLE "client_users"
  ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;

ALTER TABLE "client_users"
  ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text;

-- Webhook event idempotency table (safe to re-run)
CREATE TABLE IF NOT EXISTS "stripe_processed_events" (
  "event_id" text PRIMARY KEY,
  "processed_at" timestamp DEFAULT now() NOT NULL
);
