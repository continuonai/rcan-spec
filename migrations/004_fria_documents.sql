-- Migration 004: FRIA compliance document storage
-- Idempotent — safe to run multiple times.

CREATE TABLE IF NOT EXISTS fria_documents (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  rrn                 TEXT    NOT NULL,
  submitted_at        TEXT    NOT NULL,
  schema_version      TEXT    NOT NULL,        -- "rcan-fria-v1"
  annex_iii_basis     TEXT    NOT NULL,
  overall_pass        INTEGER NOT NULL,        -- 1 = pass, 0 = fail
  prerequisite_waived INTEGER NOT NULL,        -- 1 = waived, 0 = not waived
  sig_verified        INTEGER NOT NULL,        -- 1 = verified, 0 = not verified
  document            TEXT    NOT NULL         -- full JSON blob
);

CREATE INDEX IF NOT EXISTS idx_fria_rrn_submitted
  ON fria_documents (rrn, submitted_at DESC);
