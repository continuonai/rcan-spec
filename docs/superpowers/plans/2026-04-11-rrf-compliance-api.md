# RRF Compliance API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three compliance endpoints to the rcan-spec Cloudflare Workers API: POST/GET `/robots/:rrn/fria` and GET `/robots/:rrn/compliance`.

**Architecture:** Two new Cloudflare Pages Function files in `functions/api/v1/robots/[rrn]/` (alongside existing `verify.ts`) plus one D1 migration. ML-DSA-65 signature verification uses `@noble/post-quantum` — pure JS, no native deps, runs in CF Workers. Tests are pure-function unit tests added to `tests/functions.test.ts` using the existing in-memory D1 mock pattern.

**Tech Stack:** TypeScript, Cloudflare Pages Functions, D1 (SQLite), `@noble/post-quantum`, Vitest

---

## File Structure

**Create:**
- `migrations/004_fria_documents.sql` — new D1 table
- `functions/api/v1/robots/[rrn]/fria.ts` — POST + GET handler
- `functions/api/v1/robots/[rrn]/compliance.ts` — GET handler

**Modify:**
- `package.json` — add `@noble/post-quantum` dependency
- `pnpm-lock.yaml` — updated automatically by pnpm
- `tests/functions.test.ts` — add new test cases

---

## Task 1: D1 Migration + Install Dependency

**Files:**
- Create: `migrations/004_fria_documents.sql`
- Modify: `package.json` (add `@noble/post-quantum`)

- [ ] **Step 1: Create the migration file**

```sql
-- migrations/004_fria_documents.sql
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
```

- [ ] **Step 2: Install `@noble/post-quantum`**

```bash
cd /home/craigm26/rcan-spec && pnpm add @noble/post-quantum
```

Expected: `@noble/post-quantum` added to `dependencies` in `package.json` and `pnpm-lock.yaml` updated.

- [ ] **Step 3: Verify installation**

```bash
node -e "import('@noble/post-quantum/ml-dsa').then(m => console.log('ml_dsa65 keys:', Object.keys(m)))"
```

Expected output includes `ml_dsa65`.

- [ ] **Step 4: Run existing tests to confirm no regressions**

```bash
cd /home/craigm26/rcan-spec && npx vitest run tests/functions.test.ts 2>&1 | tail -5
```

Expected: `122 passed`.

- [ ] **Step 5: Commit**

```bash
git add migrations/004_fria_documents.sql package.json pnpm-lock.yaml
git commit -m "feat: add fria_documents migration and @noble/post-quantum dependency"
```

---

## Task 2: Pure Helper Functions + Tests

**Files:**
- Create: `functions/api/v1/robots/[rrn]/fria.ts` (pure functions only — no handlers yet)
- Modify: `tests/functions.test.ts`

These pure functions are exported for testability and used by handlers in Tasks 3 and 4.

- [ ] **Step 1: Write failing tests**

Add to the bottom of `tests/functions.test.ts`:

```typescript
// ── Imports for fria.ts pure functions ───────────────────────────────────────
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa";

// ── Pure functions mirrored from fria.ts ──────────────────────────────────────

/** Recursively stringify with sorted keys — matches Python json.dumps(sort_keys=True) */
function sortedJsonStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(sortedJsonStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const pairs = Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${sortedJsonStringify(obj[k])}`);
    return `{${pairs.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Decode base64url string to Uint8Array */
function base64urlToBytes(b64: string): Uint8Array {
  const b64standard = b64.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64standard + "=".repeat((4 - (b64standard.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Encode Uint8Array to base64url string */
function bytesToBase64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Verify ML-DSA-65 signature on a FRIA document (sig field excluded from canonical form) */
async function verifyMlDsa65Signature(
  doc: Record<string, unknown>,
  sigValueB64: string,
  publicKeyB64: string
): Promise<boolean> {
  try {
    const { sig: _, ...docWithoutSig } = doc;
    const canonical = sortedJsonStringify(docWithoutSig);
    const message = new TextEncoder().encode(canonical);
    const sigBytes = base64urlToBytes(sigValueB64);
    const pubKeyBytes = base64urlToBytes(publicKeyB64);
    return ml_dsa65.verify(pubKeyBytes, message, sigBytes);
  } catch {
    return false;
  }
}

/** Derive compliance_status from the latest fria_documents row */
type ComplianceStatus = "compliant" | "provisional" | "non_compliant" | "no_fria";

function deriveComplianceStatus(
  fria: { overall_pass: number; prerequisite_waived: number } | null
): ComplianceStatus {
  if (!fria) return "no_fria";
  if (!fria.overall_pass) return "non_compliant";
  if (fria.prerequisite_waived) return "provisional";
  return "compliant";
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("sortedJsonStringify", () => {
  it("sorts top-level keys alphabetically", () => {
    const result = sortedJsonStringify({ z: 1, a: 2, m: 3 });
    expect(result).toBe('{"a":2,"m":3,"z":1}');
  });

  it("sorts nested object keys recursively", () => {
    const result = sortedJsonStringify({ b: { y: 1, x: 2 }, a: 3 });
    expect(result).toBe('{"a":3,"b":{"x":2,"y":1}}');
  });

  it("preserves arrays without sorting elements", () => {
    const result = sortedJsonStringify({ arr: [3, 1, 2] });
    expect(result).toBe('{"arr":[3,1,2]}');
  });

  it("handles null values", () => {
    const result = sortedJsonStringify({ a: null });
    expect(result).toBe('{"a":null}');
  });

  it("handles primitives", () => {
    expect(sortedJsonStringify(42)).toBe("42");
    expect(sortedJsonStringify("hello")).toBe('"hello"');
    expect(sortedJsonStringify(true)).toBe("true");
  });
});

describe("base64urlToBytes / bytesToBase64url", () => {
  it("round-trips arbitrary bytes", () => {
    const original = new Uint8Array([1, 2, 3, 255, 0, 128]);
    const encoded = bytesToBase64url(original);
    const decoded = base64urlToBytes(encoded);
    expect(decoded).toEqual(original);
  });

  it("uses URL-safe characters (no + or /)", () => {
    const bytes = new Uint8Array(64).fill(255);
    const encoded = bytesToBase64url(bytes);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
  });
});

describe("verifyMlDsa65Signature", () => {
  // Generate real test vectors using @noble/post-quantum
  let publicKeyB64: string;
  let validSigB64: string;
  let testDoc: Record<string, unknown>;

  beforeAll(async () => {
    const keys = ml_dsa65.keygen();
    publicKeyB64 = bytesToBase64url(keys.publicKey);

    testDoc = {
      schema: "rcan-fria-v1",
      generated_at: "2026-04-11T09:00:00.000Z",
      system: { rrn: "RRN-000000000001", robot_name: "test-bot" },
      deployment: { annex_iii_basis: "safety_component", prerequisite_waived: false },
    };

    const { sig: _, ...docWithoutSig } = testDoc;
    const canonical = sortedJsonStringify(docWithoutSig);
    const message = new TextEncoder().encode(canonical);
    const sigBytes = ml_dsa65.sign(keys.secretKey, message);
    validSigB64 = bytesToBase64url(sigBytes);
  });

  it("returns true for a valid ML-DSA-65 signature", async () => {
    const result = await verifyMlDsa65Signature(testDoc, validSigB64, publicKeyB64);
    expect(result).toBe(true);
  });

  it("returns false for a tampered document", async () => {
    const tampered = { ...testDoc, deployment: { annex_iii_basis: "biometric" } };
    const result = await verifyMlDsa65Signature(tampered, validSigB64, publicKeyB64);
    expect(result).toBe(false);
  });

  it("returns false for an invalid signature string", async () => {
    const result = await verifyMlDsa65Signature(testDoc, "aW52YWxpZA", publicKeyB64);
    expect(result).toBe(false);
  });

  it("returns false for a wrong public key", async () => {
    const otherKeys = ml_dsa65.keygen();
    const otherPubB64 = bytesToBase64url(otherKeys.publicKey);
    const result = await verifyMlDsa65Signature(testDoc, validSigB64, otherPubB64);
    expect(result).toBe(false);
  });

  it("excludes the sig field from canonical form", async () => {
    // Document with sig field present — sig field must be excluded for verification
    const docWithSig = {
      ...testDoc,
      sig: { alg: "ml-dsa-65", kid: "key-001", value: validSigB64 },
    };
    const result = await verifyMlDsa65Signature(docWithSig, validSigB64, publicKeyB64);
    expect(result).toBe(true);
  });
});

describe("deriveComplianceStatus", () => {
  it("returns no_fria when fria is null", () => {
    expect(deriveComplianceStatus(null)).toBe("no_fria");
  });

  it("returns compliant when overall_pass and not waived", () => {
    expect(deriveComplianceStatus({ overall_pass: 1, prerequisite_waived: 0 })).toBe("compliant");
  });

  it("returns provisional when overall_pass but waived", () => {
    expect(deriveComplianceStatus({ overall_pass: 1, prerequisite_waived: 1 })).toBe("provisional");
  });

  it("returns non_compliant when overall_pass is 0", () => {
    expect(deriveComplianceStatus({ overall_pass: 0, prerequisite_waived: 0 })).toBe("non_compliant");
  });

  it("returns non_compliant even if waived when overall_pass is 0", () => {
    expect(deriveComplianceStatus({ overall_pass: 0, prerequisite_waived: 1 })).toBe("non_compliant");
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd /home/craigm26/rcan-spec && npx vitest run tests/functions.test.ts 2>&1 | tail -10
```

Expected: several tests FAIL because the import doesn't resolve yet and `beforeAll` is not imported.

Note: also add `beforeAll` to the import line at the top of the test file:
```typescript
import { describe, it, expect, vi, beforeAll } from "vitest";
```

- [ ] **Step 3: Create `functions/api/v1/robots/[rrn]/fria.ts` with only the pure functions**

```typescript
/**
 * rcan.dev — POST/GET /api/v1/robots/:rrn/fria
 * Cloudflare Pages Functions
 *
 * POST /api/v1/robots/:rrn/fria — Submit a signed rcan-fria-v1 document
 * GET  /api/v1/robots/:rrn/fria — Latest FRIA (default) or full history (?all=true)
 */

import { ml_dsa65 } from "@noble/post-quantum/ml-dsa";

interface Env {
  DB: D1Database;
  RCAN_API_KEY_SALT?: string;
}

// ── Pure helpers (exported for testing) ───────────────────────────────────────

/** Recursively stringify with sorted keys — matches Python json.dumps(sort_keys=True) */
export function sortedJsonStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(sortedJsonStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const pairs = Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${sortedJsonStringify(obj[k])}`);
    return `{${pairs.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Decode base64url string to Uint8Array */
export function base64urlToBytes(b64: string): Uint8Array {
  const b64standard = b64.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64standard + "=".repeat((4 - (b64standard.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/**
 * Verify an ML-DSA-65 signature over a FRIA document.
 * Canonical form: all fields except `sig`, recursively sorted keys, no whitespace.
 */
export async function verifyMlDsa65Signature(
  doc: Record<string, unknown>,
  sigValueB64: string,
  publicKeyB64: string
): Promise<boolean> {
  try {
    const { sig: _, ...docWithoutSig } = doc;
    const canonical = sortedJsonStringify(docWithoutSig);
    const message = new TextEncoder().encode(canonical);
    const sigBytes = base64urlToBytes(sigValueB64);
    const pubKeyBytes = base64urlToBytes(publicKeyB64);
    return ml_dsa65.verify(pubKeyBytes, message, sigBytes);
  } catch {
    return false;
  }
}

// ── Shared response helpers ───────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Cache-Control": status === 200 ? "public, max-age=60, stale-while-revalidate=300" : "no-store",
    },
  });
}

function err(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function cors(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

function bearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── DB schema (applied lazily) ────────────────────────────────────────────────

async function ensureSchema(db: D1Database): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS fria_documents (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      rrn                 TEXT    NOT NULL,
      submitted_at        TEXT    NOT NULL,
      schema_version      TEXT    NOT NULL,
      annex_iii_basis     TEXT    NOT NULL,
      overall_pass        INTEGER NOT NULL,
      prerequisite_waived INTEGER NOT NULL,
      sig_verified        INTEGER NOT NULL,
      document            TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fria_rrn_submitted
      ON fria_documents (rrn, submitted_at DESC);
  `);
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export async function handlePost(rrn: string, req: Request, env: Env): Promise<Response> {
  // 1. Auth
  const token = bearerToken(req);
  if (!token) return err("Authorization required", 401);

  const keyHash = await sha256(token + (env.RCAN_API_KEY_SALT ?? "rcan-dev"));
  const robot = await env.DB.prepare(
    "SELECT id, api_key_hash FROM robots WHERE rrn = ? AND deleted = 0"
  )
    .bind(rrn)
    .first<{ id: number; api_key_hash: string }>();

  if (!robot) return err(`Robot not found: ${rrn}`, 404);
  if (robot.api_key_hash !== keyHash) return err("Invalid API key", 401);

  // 2. Parse body
  let doc: Record<string, unknown>;
  try {
    doc = (await req.json()) as Record<string, unknown>;
  } catch {
    return err("Request body must be valid JSON");
  }

  // 3. Schema check
  if (doc.schema !== "rcan-fria-v1") {
    return err('INVALID_SCHEMA: schema must be "rcan-fria-v1"');
  }

  // 4. Required fields
  const deployment = doc.deployment as Record<string, unknown> | undefined;
  const sig = doc.sig as Record<string, unknown> | undefined;
  const signingKey = doc.signing_key as Record<string, unknown> | undefined;

  const missing: string[] = [];
  if (!deployment?.annex_iii_basis) missing.push("deployment.annex_iii_basis");
  if (!sig?.value) missing.push("sig.value");
  if (!signingKey?.public_key) missing.push("signing_key.public_key");
  if (missing.length > 0) return err(`MISSING_FIELDS: ${missing.join(", ")}`);

  // 5. ML-DSA-65 verification
  const verified = await verifyMlDsa65Signature(
    doc,
    String(sig!.value),
    String(signingKey!.public_key)
  );
  if (!verified) return err("INVALID_SIGNATURE: ML-DSA-65 signature verification failed");

  // 6. Derive overall_pass from conformance block
  const conformance = doc.conformance as Record<string, unknown> | undefined;
  const overallPass = Number(conformance?.fail ?? 1) === 0 ? 1 : 0;
  const prerequisiteWaived = deployment!.prerequisite_waived ? 1 : 0;
  const annexIiiBasis = String(deployment!.annex_iii_basis);

  await ensureSchema(env.DB);
  const now = new Date().toISOString();

  const result = await env.DB.prepare(
    `INSERT INTO fria_documents
       (rrn, submitted_at, schema_version, annex_iii_basis, overall_pass, prerequisite_waived, sig_verified, document)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
  )
    .bind(rrn, now, "rcan-fria-v1", annexIiiBasis, overallPass, prerequisiteWaived, JSON.stringify(doc))
    .run();

  const id = (result.meta as Record<string, unknown>).last_row_id as number;

  return json(
    {
      id,
      rrn,
      submitted_at: now,
      sig_verified: true,
      annex_iii_basis: annexIiiBasis,
      overall_pass: overallPass === 1,
    },
    201
  );
}

export async function handleGet(rrn: string, req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const allVersions = url.searchParams.get("all") === "true";

  await ensureSchema(env.DB);

  if (allVersions) {
    const { results } = await env.DB.prepare(
      `SELECT id, rrn, submitted_at, schema_version, annex_iii_basis, overall_pass, sig_verified
       FROM fria_documents WHERE rrn = ? ORDER BY submitted_at DESC`
    )
      .bind(rrn)
      .all<{ id: number; rrn: string; submitted_at: string; schema_version: string; annex_iii_basis: string; overall_pass: number; sig_verified: number }>();

    if (!results.length) return err(`No FRIA found for ${rrn}`, 404);

    return json({
      rrn,
      count: results.length,
      fria_documents: results.map((r) => ({
        ...r,
        overall_pass: Boolean(r.overall_pass),
        sig_verified: Boolean(r.sig_verified),
      })),
    });
  }

  const row = await env.DB.prepare(
    `SELECT id, rrn, submitted_at, annex_iii_basis, overall_pass, sig_verified, document
     FROM fria_documents WHERE rrn = ? ORDER BY submitted_at DESC LIMIT 1`
  )
    .bind(rrn)
    .first<{
      id: number;
      rrn: string;
      submitted_at: string;
      annex_iii_basis: string;
      overall_pass: number;
      sig_verified: number;
      document: string;
    }>();

  if (!row) return err(`No FRIA found for ${rrn}`, 404);

  return json({
    id: row.id,
    rrn: row.rrn,
    submitted_at: row.submitted_at,
    sig_verified: Boolean(row.sig_verified),
    annex_iii_basis: row.annex_iii_basis,
    overall_pass: Boolean(row.overall_pass),
    document: JSON.parse(row.document),
  });
}

// ── Route dispatcher ──────────────────────────────────────────────────────────

export async function onRequest(context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
}): Promise<Response> {
  const { request, env, params } = context;
  const method = request.method.toUpperCase();
  const rrn = (params.rrn ?? "").toUpperCase();

  if (method === "OPTIONS") return cors();
  if (!rrn) return err("Missing RRN parameter", 400);

  try {
    if (method === "POST") return await handlePost(rrn, request, env);
    if (method === "GET") return await handleGet(rrn, request, env);
    return err("Method not allowed", 405);
  } catch (e) {
    console.error("FRIA handler error:", e);
    return err("Internal server error", 500);
  }
}
```

- [ ] **Step 4: Run the tests — confirm they now pass**

```bash
cd /home/craigm26/rcan-spec && npx vitest run tests/functions.test.ts 2>&1 | tail -10
```

Expected: all previously passing tests still pass, plus the new `sortedJsonStringify`, `base64urlToBytes`, `verifyMlDsa65Signature`, and `deriveComplianceStatus` tests pass.

- [ ] **Step 5: Commit**

```bash
git add functions/api/v1/robots/\[rrn\]/fria.ts tests/functions.test.ts
git commit -m "feat: fria.ts pure helpers (sortedJsonStringify, base64urlToBytes, verifyMlDsa65Signature) + tests"
```

---

## Task 3: POST /robots/:rrn/fria Handler Tests

**Files:**
- Modify: `tests/functions.test.ts`

Test the POST handler validation logic using mock D1.

- [ ] **Step 1: Add imports to the top of `tests/functions.test.ts`**

After the existing `import { describe, it, expect, vi, beforeAll } from "vitest";` line, add:

```typescript
import { handlePost, handleGet } from "../functions/api/v1/robots/[rrn]/fria.js";
```

- [ ] **Step 2: Add handler-level tests to `tests/functions.test.ts`**

Add after the `deriveComplianceStatus` tests:

```typescript
// ── POST /robots/:rrn/fria handler tests ──────────────────────────────────────

// Inline sha256 for test auth setup (mirrors fria.ts)
async function sha256ForTest(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("POST /robots/:rrn/fria — validation", () => {
  const TEST_RRN = "RRN-000000000001";
  const TEST_TOKEN = "test-api-key";
  const TEST_SALT = "rcan-dev";

  let validApiKeyHash: string;
  let validPublicKeyB64: string;
  let validSigB64: string;
  let validDoc: Record<string, unknown>;

  beforeAll(async () => {
    validApiKeyHash = await sha256ForTest(TEST_TOKEN + TEST_SALT);

    const keys = ml_dsa65.keygen();
    validPublicKeyB64 = bytesToBase64url(keys.publicKey);

    validDoc = {
      schema: "rcan-fria-v1",
      generated_at: "2026-04-11T09:00:00.000Z",
      system: { rrn: TEST_RRN, robot_name: "test-bot", rcan_version: "3.0" },
      deployment: { annex_iii_basis: "safety_component", prerequisite_waived: false },
      conformance: { score: 90, pass: 24, warn: 0, fail: 0 },
      signing_key: { alg: "ml-dsa-65", kid: "key-001", public_key: validPublicKeyB64 },
    };

    const { sig: _, ...docWithoutSig } = validDoc;
    const canonical = sortedJsonStringify(docWithoutSig);
    const message = new TextEncoder().encode(canonical);
    const sigBytes = ml_dsa65.sign(keys.secretKey, message);
    validSigB64 = bytesToBase64url(sigBytes);

    // Add sig field to validDoc
    validDoc.sig = { alg: "ml-dsa-65", kid: "key-001", value: validSigB64 };
  });

  function makeRequest(body: unknown, token?: string): Request {
    return new Request("https://rcan.dev/api/v1/robots/RRN-000000000001/fria", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  function makeEnv(robotRow: { id: number; api_key_hash: string } | null) {
    return {
      DB: {
        exec: async (_sql: string) => {},
        prepare: (sql: string) => {
          const stmt = {
            _args: [] as unknown[],
            bind: (...args: unknown[]) => { stmt._args = args; return stmt; },
            first: async () => {
              if (sql.includes("FROM robots")) return robotRow;
              if (sql.includes("FROM fria_documents")) return null;
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => ({ success: true, meta: { last_row_id: 42 } }),
          };
          return stmt;
        },
      } as unknown as D1Database,
      RCAN_API_KEY_SALT: TEST_SALT,
    };
  }

  it("returns 401 when no Authorization header", async () => {
    const req = makeRequest(validDoc);
    const env = makeEnv({ id: 1, api_key_hash: validApiKeyHash });
    const res = await handlePost(TEST_RRN, req, env);
    expect(res.status).toBe(401);
  });

  it("returns 404 when robot not found", async () => {
    const req = makeRequest(validDoc, TEST_TOKEN);
    const env = makeEnv(null);
    const res = await handlePost(TEST_RRN, req, env);
    expect(res.status).toBe(404);
  });

  it("returns 401 when API key does not match", async () => {
    const req = makeRequest(validDoc, "wrong-key");
    const env = makeEnv({ id: 1, api_key_hash: validApiKeyHash });
    const res = await handlePost(TEST_RRN, req, env);
    expect(res.status).toBe(401);
  });

  it("returns 400 when schema is wrong", async () => {
    const req = makeRequest({ ...validDoc, schema: "wrong-schema" }, TEST_TOKEN);
    const env = makeEnv({ id: 1, api_key_hash: validApiKeyHash });
    const res = await handlePost(TEST_RRN, req, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("INVALID_SCHEMA");
  });

  it("returns 400 when sig.value is missing", async () => {
    const docNoSig = { ...validDoc, sig: { alg: "ml-dsa-65" } };
    const req = makeRequest(docNoSig, TEST_TOKEN);
    const env = makeEnv({ id: 1, api_key_hash: validApiKeyHash });
    const res = await handlePost(TEST_RRN, req, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("MISSING_FIELDS");
    expect(body.error).toContain("sig.value");
  });

  it("returns 400 for invalid ML-DSA-65 signature", async () => {
    const badSigDoc = {
      ...validDoc,
      sig: { alg: "ml-dsa-65", kid: "key-001", value: "aW52YWxpZA" },
    };
    const req = makeRequest(badSigDoc, TEST_TOKEN);
    const env = makeEnv({ id: 1, api_key_hash: validApiKeyHash });
    const res = await handlePost(TEST_RRN, req, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("INVALID_SIGNATURE");
  });

  it("returns 201 for a valid FRIA submission", async () => {
    const req = makeRequest(validDoc, TEST_TOKEN);
    const env = makeEnv({ id: 1, api_key_hash: validApiKeyHash });
    const res = await handlePost(TEST_RRN, req, env);
    expect(res.status).toBe(201);
    const body = await res.json() as { id: number; sig_verified: boolean; overall_pass: boolean };
    expect(body.sig_verified).toBe(true);
    expect(body.overall_pass).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests — confirm they pass**

```bash
cd /home/craigm26/rcan-spec && npx vitest run tests/functions.test.ts 2>&1 | tail -10
```

Expected: all tests pass including the new POST handler tests.

- [ ] **Step 4: Commit**

```bash
git add tests/functions.test.ts
git commit -m "test: POST /robots/:rrn/fria handler validation tests"
```

---

## Task 4: GET /robots/:rrn/fria Handler Tests

**Files:**
- Modify: `tests/functions.test.ts`

- [ ] **Step 1: Add GET handler tests to `tests/functions.test.ts`**

The `handleGet` import was already added in Task 3 Step 1. Add after the POST handler tests:

```typescript
describe("GET /robots/:rrn/fria — handler", () => {
  const TEST_RRN = "RRN-000000000001";

  const friaRow = {
    id: 42,
    rrn: TEST_RRN,
    submitted_at: "2026-04-11T09:00:00.000Z",
    annex_iii_basis: "safety_component",
    overall_pass: 1,
    sig_verified: 1,
    document: JSON.stringify({ schema: "rcan-fria-v1", deployment: { annex_iii_basis: "safety_component" } }),
  };

  function makeGetEnv(rows: typeof friaRow[] | null) {
    return {
      DB: {
        exec: async (_sql: string) => {},
        prepare: (sql: string) => {
          const stmt = {
            _args: [] as unknown[],
            bind: (...args: unknown[]) => { stmt._args = args; return stmt; },
            first: async () => rows && rows.length > 0 ? rows[0] : null,
            all: async () => ({ results: rows ?? [] }),
            run: async () => ({ success: true, meta: { last_row_id: 1 } }),
          };
          return stmt;
        },
      } as unknown as D1Database,
    };
  }

  it("returns 404 when no FRIA exists (latest)", async () => {
    const req = new Request(`https://rcan.dev/api/v1/robots/${TEST_RRN}/fria`);
    const env = makeGetEnv(null);
    const res = await handleGet(TEST_RRN, req, env);
    expect(res.status).toBe(404);
  });

  it("returns 200 with document blob for latest", async () => {
    const req = new Request(`https://rcan.dev/api/v1/robots/${TEST_RRN}/fria`);
    const env = makeGetEnv([friaRow]);
    const res = await handleGet(TEST_RRN, req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { id: number; sig_verified: boolean; document: unknown };
    expect(body.id).toBe(42);
    expect(body.sig_verified).toBe(true);
    expect(body.document).toBeDefined();
  });

  it("returns 200 with array and no document blobs for ?all=true", async () => {
    const req = new Request(`https://rcan.dev/api/v1/robots/${TEST_RRN}/fria?all=true`);
    const env = makeGetEnv([friaRow]);
    const res = await handleGet(TEST_RRN, req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { count: number; fria_documents: { document?: unknown }[] };
    expect(body.count).toBe(1);
    expect(body.fria_documents[0].document).toBeUndefined();
  });

  it("returns 404 for ?all=true when no FRIA exists", async () => {
    const req = new Request(`https://rcan.dev/api/v1/robots/${TEST_RRN}/fria?all=true`);
    const env = makeGetEnv([]);
    const res = await handleGet(TEST_RRN, req, env);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests — confirm they pass**

```bash
cd /home/craigm26/rcan-spec && npx vitest run tests/functions.test.ts 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/functions.test.ts
git commit -m "test: GET /robots/:rrn/fria handler tests (latest + ?all=true)"
```

---

## Task 5: GET /robots/:rrn/compliance — Implementation + Tests

**Files:**
- Create: `functions/api/v1/robots/[rrn]/compliance.ts`
- Modify: `tests/functions.test.ts`

- [ ] **Step 1: Add compliance import to `tests/functions.test.ts`**

Add alongside the existing fria.ts import (Task 3 Step 1):

```typescript
import { handleCompliance } from "../functions/api/v1/robots/[rrn]/compliance.js";
```

This import will fail until `compliance.ts` is created in Step 3 — that is expected and intentional (TDD).

- [ ] **Step 2: Write failing compliance handler tests**

Add to `tests/functions.test.ts`:

```typescript
// ── compliance.ts pure function (mirrored for testing) ────────────────────────

type ComplianceStatus2 = "compliant" | "provisional" | "non_compliant" | "no_fria";

function deriveComplianceStatus2(
  fria: { overall_pass: number; prerequisite_waived: number } | null
): ComplianceStatus2 {
  if (!fria) return "no_fria";
  if (!fria.overall_pass) return "non_compliant";
  if (fria.prerequisite_waived) return "provisional";
  return "compliant";
}

// Import handleCompliance from compliance.ts for handler tests
import { handleCompliance } from "../functions/api/v1/robots/[rrn]/compliance.js";

describe("GET /robots/:rrn/compliance — handler", () => {
  const TEST_RRN = "RRN-000000000001";

  const robotRow = {
    rrn: TEST_RRN,
    manufacturer: "acme",
    model: "r2",
    version: "1",
    verification_tier: "verified",
  };

  const friaRow = {
    submitted_at: "2026-04-11T09:00:00.000Z",
    sig_verified: 1,
    annex_iii_basis: "safety_component",
    overall_pass: 1,
    prerequisite_waived: 0,
  };

  function makeComplianceEnv(
    robot: typeof robotRow | null,
    fria: typeof friaRow | null
  ) {
    return {
      DB: {
        prepare: (sql: string) => {
          const stmt = {
            _args: [] as unknown[],
            bind: (...args: unknown[]) => { stmt._args = args; return stmt; },
            first: async () => {
              if (sql.includes("FROM robots")) return robot;
              if (sql.includes("FROM fria_documents")) return fria;
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => ({ success: true }),
          };
          return stmt;
        },
      } as unknown as D1Database,
    };
  }

  it("returns 404 when robot not found", async () => {
    const req = new Request(`https://rcan.dev/api/v1/robots/${TEST_RRN}/compliance`);
    const env = makeComplianceEnv(null, null);
    const res = await handleCompliance(TEST_RRN, req, env);
    expect(res.status).toBe(404);
  });

  it("returns compliant when FRIA passes with no waiver", async () => {
    const req = new Request(`https://rcan.dev/api/v1/robots/${TEST_RRN}/compliance`);
    const env = makeComplianceEnv(robotRow, friaRow);
    const res = await handleCompliance(TEST_RRN, req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { compliance_status: string; fria: unknown };
    expect(body.compliance_status).toBe("compliant");
    expect(body.fria).not.toBeNull();
  });

  it("returns provisional when prerequisite_waived is true", async () => {
    const req = new Request(`https://rcan.dev/api/v1/robots/${TEST_RRN}/compliance`);
    const env = makeComplianceEnv(robotRow, { ...friaRow, prerequisite_waived: 1 });
    const res = await handleCompliance(TEST_RRN, req, env);
    const body = await res.json() as { compliance_status: string };
    expect(body.compliance_status).toBe("provisional");
  });

  it("returns non_compliant when overall_pass is 0", async () => {
    const req = new Request(`https://rcan.dev/api/v1/robots/${TEST_RRN}/compliance`);
    const env = makeComplianceEnv(robotRow, { ...friaRow, overall_pass: 0 });
    const res = await handleCompliance(TEST_RRN, req, env);
    const body = await res.json() as { compliance_status: string };
    expect(body.compliance_status).toBe("non_compliant");
  });

  it("returns no_fria when no FRIA submitted", async () => {
    const req = new Request(`https://rcan.dev/api/v1/robots/${TEST_RRN}/compliance`);
    const env = makeComplianceEnv(robotRow, null);
    const res = await handleCompliance(TEST_RRN, req, env);
    const body = await res.json() as { compliance_status: string; fria: unknown };
    expect(body.compliance_status).toBe("no_fria");
    expect(body.fria).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests — confirm `handleCompliance` import fails**

```bash
cd /home/craigm26/rcan-spec && npx vitest run tests/functions.test.ts 2>&1 | grep -i "compliance\|error\|fail" | head -5
```

Expected: import error because `compliance.ts` does not exist yet.

- [ ] **Step 4: Create `functions/api/v1/robots/[rrn]/compliance.ts`**

```typescript
/**
 * rcan.dev — GET /api/v1/robots/:rrn/compliance
 * Cloudflare Pages Functions
 *
 * Returns a compliance status summary for a robot, derived from the
 * latest fria_documents row and the robot's verification_tier.
 */

interface Env {
  DB: D1Database;
}

type ComplianceStatus = "compliant" | "provisional" | "non_compliant" | "no_fria";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}

function err(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function cors(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

function deriveComplianceStatus(
  fria: { overall_pass: number; prerequisite_waived: number } | null
): ComplianceStatus {
  if (!fria) return "no_fria";
  if (!fria.overall_pass) return "non_compliant";
  if (fria.prerequisite_waived) return "provisional";
  return "compliant";
}

export async function handleCompliance(
  rrn: string,
  _req: Request,
  env: Env
): Promise<Response> {
  const robot = await env.DB.prepare(
    `SELECT rrn, verification_tier
     FROM robots WHERE rrn = ? AND deleted = 0`
  )
    .bind(rrn)
    .first<{ rrn: string; verification_tier: string }>();

  if (!robot) return err(`Robot not found: ${rrn}`, 404);

  let friaRow: {
    submitted_at: string;
    sig_verified: number;
    annex_iii_basis: string;
    overall_pass: number;
    prerequisite_waived: number;
  } | null = null;

  try {
    friaRow = await env.DB.prepare(
      `SELECT submitted_at, sig_verified, annex_iii_basis, overall_pass, prerequisite_waived
       FROM fria_documents WHERE rrn = ? ORDER BY submitted_at DESC LIMIT 1`
    )
      .bind(rrn)
      .first();
  } catch {
    // fria_documents table may not exist yet — treat as no_fria
  }

  const complianceStatus = deriveComplianceStatus(friaRow);

  return json({
    rrn: robot.rrn,
    verification_tier: robot.verification_tier,
    fria: friaRow
      ? {
          submitted_at: friaRow.submitted_at,
          sig_verified: Boolean(friaRow.sig_verified),
          annex_iii_basis: friaRow.annex_iii_basis,
          overall_pass: Boolean(friaRow.overall_pass),
          prerequisite_waived: Boolean(friaRow.prerequisite_waived),
        }
      : null,
    compliance_status: complianceStatus,
    checked_at: new Date().toISOString(),
  });
}

export async function onRequest(context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
}): Promise<Response> {
  const { request, env, params } = context;
  const method = request.method.toUpperCase();
  const rrn = (params.rrn ?? "").toUpperCase();

  if (method === "OPTIONS") return cors();
  if (method !== "GET") return err("Method not allowed", 405);
  if (!rrn) return err("Missing RRN parameter", 400);

  try {
    return await handleCompliance(rrn, request, env);
  } catch (e) {
    console.error("Compliance handler error:", e);
    return err("Internal server error", 500);
  }
}
```

- [ ] **Step 5: Run all tests — confirm they pass**

```bash
cd /home/craigm26/rcan-spec && npx vitest run tests/functions.test.ts 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add functions/api/v1/robots/\[rrn\]/compliance.ts tests/functions.test.ts
git commit -m "feat: compliance.ts handler + tests (GET /robots/:rrn/compliance)"
```

---

## Task 6: Final Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

```bash
cd /home/craigm26/rcan-spec && npx vitest run tests/functions.test.ts 2>&1 | tail -5
```

Expected: all tests pass (count will be higher than 122 — should be 145+).

- [ ] **Step 2: Run Astro build**

```bash
cd /home/craigm26/rcan-spec && npm run build 2>&1 | tail -5
```

Expected: `98 page(s) built` cleanly (the new `.ts` function files don't affect page count).

- [ ] **Step 3: Spot-check new function files exist**

```bash
ls /home/craigm26/rcan-spec/functions/api/v1/robots/\[rrn\]/
```

Expected output:
```
compliance.ts
fria.ts
verify.ts
```

- [ ] **Step 4: Commit (if any final tweaks needed)**

If Step 1–3 are clean with no uncommitted changes, skip this step. Otherwise:

```bash
git add -A && git commit -m "chore: final build verification pass"
```
