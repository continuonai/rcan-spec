-- Migration 003: Sync protocol, webhook delivery, API key rotation
-- Applied automatically by runtime; safe to run multiple times (idempotent).

-- Add updated_at to robots table for sync protocol (gracefully ignored if exists)
-- Note: The robots table already includes updated_at in the base schema;
-- this ALTER is for any deployments where it may have been omitted.
-- Cloudflare D1 silently errors on duplicate column — handle in application code.

-- Robots: ensure updated_at index for efficient sync queries
CREATE INDEX IF NOT EXISTS idx_robots_updated_at ON robots(updated_at);

-- Webhook registrations
CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_prefix TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  secret_hash TEXT,           -- SHA-256 of shared secret for HMAC signing
  created_at TEXT DEFAULT (datetime('now')),
  last_delivered_at TEXT,
  failure_count INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_webhooks_prefix ON webhooks(node_prefix);

-- API key rotation support
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_hash TEXT NOT NULL UNIQUE,  -- SHA-256 of the actual key
  created_at TEXT DEFAULT (datetime('now')),
  active_from TEXT NOT NULL,       -- key is not valid until this timestamp (grace period)
  revoked_at TEXT                  -- NULL means active
);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(active_from, revoked_at);
