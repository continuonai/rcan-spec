# RRF Compliance API Design

**Date:** 2026-04-11
**Repo:** continuonai/rcan-spec
**Status:** Approved — pending implementation plan

---

## Goal

Add three compliance endpoints to the Cloudflare Workers API layer of the Robot Registry Foundation (RRF):

- `POST /api/v1/robots/[rrn]/fria` — submit a signed FRIA document
- `GET  /api/v1/robots/[rrn]/fria` — retrieve FRIA (latest or full history)
- `GET  /api/v1/robots/[rrn]/compliance` — compliance status summary

---

## Architecture

Option A: two new focused endpoint files + one D1 migration.

```
functions/api/v1/robots/[rrn]/
├── verify.ts          # existing
├── fria.ts            # new — POST + GET
└── compliance.ts      # new — GET

migrations/
└── 004_fria_documents.sql   # new
```

ML-DSA-65 signature verification uses `@noble/post-quantum` — no native deps, runs in Cloudflare Workers.

---

## Section 1: Data Model

New table in D1:

```sql
CREATE TABLE IF NOT EXISTS fria_documents (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  rrn                 TEXT    NOT NULL,
  submitted_at        TEXT    NOT NULL,
  schema_version      TEXT    NOT NULL,        -- "rcan-fria-v1"
  annex_iii_basis     TEXT    NOT NULL,
  overall_pass        INTEGER NOT NULL,        -- 0 or 1
  prerequisite_waived INTEGER NOT NULL,        -- 0 or 1
  sig_verified        INTEGER NOT NULL,        -- 0 or 1
  document            TEXT    NOT NULL         -- full JSON blob
);

CREATE INDEX IF NOT EXISTS idx_fria_rrn_submitted
  ON fria_documents (rrn, submitted_at DESC);
```

No changes to the `robots` table. The `compliance` endpoint joins `robots` (for `verification_tier`) with the latest `fria_documents` row.

---

## Section 2: POST /api/v1/robots/[rrn]/fria

**Auth:** Bearer token matching the robot's `api_key_hash`. No admin override — only the robot owner can submit.

**Request body:** Full `rcan-fria-v1` JSON document.

**Validation (in order):**

1. Robot exists and is not deleted → 404 if missing
2. Bearer token matches `api_key_hash` → 401 if invalid
3. Body parses as valid JSON → 400 if malformed
4. `schema === "rcan-fria-v1"` → 400 `INVALID_SCHEMA`
5. Required fields present: `deployment.annex_iii_basis`, `sig`, `signing_key.public_key` → 400 `MISSING_FIELDS` with list
6. ML-DSA-65 signature verification: canonical JSON (JSON.stringify with sorted keys, no whitespace, `sig` field omitted) verified against `signing_key.public_key` (base64url) → 400 `INVALID_SIGNATURE`
7. Insert row into `fria_documents`

**Success response (201):**
```json
{
  "id": 42,
  "rrn": "RRN-000000000001",
  "submitted_at": "2026-04-12T09:00:00.000Z",
  "sig_verified": true,
  "annex_iii_basis": "safety_component",
  "overall_pass": true
}
```

---

## Section 3: GET /api/v1/robots/[rrn]/fria

**Auth:** None — public read.

**Query params:**
- Default: return the latest submission with full `document` blob
- `?all=true`: return all submissions in reverse chronological order, omitting `document` blobs

**Latest response (200):**
```json
{
  "id": 42,
  "rrn": "RRN-000000000001",
  "submitted_at": "2026-04-12T09:00:00.000Z",
  "sig_verified": true,
  "annex_iii_basis": "safety_component",
  "overall_pass": true,
  "document": { }
}
```

**`?all=true` response (200):**
```json
{
  "rrn": "RRN-000000000001",
  "count": 3,
  "fria_documents": [
    { "id": 42, "submitted_at": "...", "sig_verified": true, "annex_iii_basis": "...", "overall_pass": true },
    { "id": 31, "submitted_at": "...", "sig_verified": true, "annex_iii_basis": "...", "overall_pass": true },
    { "id": 12, "submitted_at": "...", "sig_verified": true, "annex_iii_basis": "...", "overall_pass": false }
  ]
}
```

**404** if no FRIA has been submitted for this RRN.

**Cache-Control:** `public, max-age=60, stale-while-revalidate=300`

---

## Section 4: GET /api/v1/robots/[rrn]/compliance

**Auth:** None — public read.

**Purpose:** Single summary for notified bodies, the Flutter app, and SDK status checks. Joins `robots` + latest `fria_documents`.

**Response (200):**
```json
{
  "rrn": "RRN-000000000001",
  "robot_name": "my-robot",
  "verification_tier": "verified",
  "rcan_version": "3.0",
  "fria": {
    "submitted_at": "2026-04-12T09:00:00.000Z",
    "sig_verified": true,
    "annex_iii_basis": "safety_component",
    "overall_pass": true,
    "prerequisite_waived": false
  },
  "compliance_status": "compliant",
  "checked_at": "2026-04-12T09:05:00.000Z"
}
```

**`compliance_status` rules:**

| Status | Condition |
|--------|-----------|
| `"compliant"` | FRIA exists, `sig_verified: true`, `overall_pass: true`, `prerequisite_waived: false` |
| `"provisional"` | FRIA exists, `prerequisite_waived: true` |
| `"non_compliant"` | FRIA exists, `overall_pass: false` |
| `"no_fria"` | No FRIA submitted yet |

When `compliance_status` is `"no_fria"`, the `fria` field is `null`.

**404** if robot does not exist or is deleted.

**Cache-Control:** `public, max-age=60, stale-while-revalidate=300`

---

## Section 5: Testing

Framework: Vitest. Pattern: in-memory D1 mock, pure function extraction, no live network.

**`fria.ts` POST tests:**
- Valid FRIA + valid sig → 201, row inserted
- Missing `sig` field → 400 `MISSING_FIELDS`
- Invalid ML-DSA-65 signature → 400 `INVALID_SIGNATURE`
- Wrong `schema` field → 400 `INVALID_SCHEMA`
- Bad/missing Bearer token → 401
- Non-existent RRN → 404

**`fria.ts` GET tests:**
- GET latest → 200 with `document` blob
- GET `?all=true` → 200 with array, no `document` blobs
- GET with no submissions → 404

**`compliance.ts` GET tests:**
- FRIA present, all good → 200, `compliance_status: "compliant"`
- `prerequisite_waived: true` → 200, `compliance_status: "provisional"`
- `overall_pass: false` → 200, `compliance_status: "non_compliant"`
- No FRIA submitted → 200, `compliance_status: "no_fria"`, `fria: null`
- Non-existent RRN → 404

**ML-DSA-65 unit tests:**
Extract `verifyFriaSignature(doc, publicKeyB64): Promise<boolean>` as a pure function and test it directly with known good and bad key/signature pairs.

---

## Out of Scope

- rcan-py / rcan-ts SDK types (Sub-projects C, D)
- Flutter app compliance UI (Sub-project E)
- FRIA retrieval by `id` (GET /robots/[rrn]/fria/[id]) — not needed for v1
- Pagination for `?all=true` — document count per robot will be small
