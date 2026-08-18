-- Migration: 0003_audit_logs
-- Idempotent: safe to run against a database that already contains this table.

CREATE TABLE IF NOT EXISTS audit_logs (
  id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    TEXT,
  actor_type  TEXT NOT NULL,
  action      TEXT NOT NULL,
  target_id   TEXT,
  target_type TEXT,
  metadata    JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Index for efficient recent-first retrieval in the admin dashboard
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
