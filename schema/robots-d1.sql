-- rcan.dev Robot Registry — D1 schema
-- Apply via: wrangler d1 execute rcan-registry --file=schema/robots-d1.sql

CREATE TABLE IF NOT EXISTS robots (
  id                 INTEGER  PRIMARY KEY AUTOINCREMENT,
  rrn                TEXT     UNIQUE,               -- set after insert: RRN-00000001
  manufacturer       TEXT     NOT NULL,
  model              TEXT     NOT NULL,
  version            TEXT     NOT NULL,
  device_id          TEXT     NOT NULL,
  rcan_uri           TEXT     NOT NULL,
  verification_tier  TEXT     NOT NULL DEFAULT 'community',
  description        TEXT     DEFAULT '',
  contact_email      TEXT     DEFAULT '',
  source             TEXT     DEFAULT '',           -- 'wizard' | 'api' | 'web'
  api_key_hash       TEXT,                          -- SHA-256(rawKey + salt)
  registered_at      TEXT     NOT NULL,             -- ISO-8601
  updated_at         TEXT     NOT NULL,
  deleted            INTEGER  NOT NULL DEFAULT 0    -- soft delete
);

-- Unique constraint: one RRN per (manufacturer, model, version, device_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_robots_uri
  ON robots(manufacturer, model, version, device_id)
  WHERE deleted = 0;

CREATE INDEX IF NOT EXISTS idx_robots_rrn        ON robots(rrn);
CREATE INDEX IF NOT EXISTS idx_robots_manufacturer ON robots(manufacturer);
CREATE INDEX IF NOT EXISTS idx_robots_tier         ON robots(verification_tier);
CREATE INDEX IF NOT EXISTS idx_robots_active       ON robots(deleted, registered_at DESC);

-- Verification tiers
-- ⬜ community   — self-attested, no verification
-- 🟡 verified    — email + domain verified  
-- 🔵 manufacturer — legal entity + DUNS/registration verified
-- ✅ certified   — third-party conformance cert (ISO 10218, CE, UL)
