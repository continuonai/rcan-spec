/**
 * rcan.dev — POST/GET /api/v1/robots/:rrn/fria
 * Cloudflare Pages Functions
 *
 * POST /api/v1/robots/:rrn/fria — Submit a signed rcan-fria-v1 document
 * GET  /api/v1/robots/:rrn/fria — Latest FRIA (default) or full history (?all=true)
 */

import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";

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

/** Encode Uint8Array to base64url string */
export function bytesToBase64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
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
    return ml_dsa65.verify(sigBytes, message, pubKeyBytes);
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

// ── Handlers (exported for testing) ──────────────────────────────────────────

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
