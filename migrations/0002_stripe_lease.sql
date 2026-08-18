-- Upgrade Stripe event idempotency table to a crash-recoverable lease model.
--
-- claimed_at: when processing began (lease timestamp, default = now for existing rows).
-- processed_at: set ONLY after successful DB mutation; NULL = in-flight/not-yet-done.
--
-- Logic:
--   Fresh claim   : INSERT succeeds (rowCount = 1)             → true
--   True duplicate: conflict, processed_at IS NOT NULL         → rowCount = 0  → false
--   In-progress   : conflict, NULL, claimed_at < 5 min ago     → rowCount = 0  → false
--   Stale lease   : conflict, NULL, claimed_at ≥ 5 min ago     → UPDATE reclaim → true
--
-- Safe to re-run (ADD COLUMN IF NOT EXISTS, DROP NOT NULL is idempotent in Postgres).

ALTER TABLE "stripe_processed_events"
  ADD COLUMN IF NOT EXISTS "claimed_at" timestamp DEFAULT now() NOT NULL;

-- Make processed_at nullable (NULL = in-flight, set only after successful processing)
ALTER TABLE "stripe_processed_events"
  ALTER COLUMN "processed_at" DROP NOT NULL;

ALTER TABLE "stripe_processed_events"
  ALTER COLUMN "processed_at" DROP DEFAULT;
