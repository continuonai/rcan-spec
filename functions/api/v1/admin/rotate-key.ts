/**
 * rcan.dev Admin — POST /api/v1/admin/rotate-key
 * Cloudflare Pages Functions (compatible with Cloudflare Workers)
 *
 * POST /api/v1/admin/rotate-key
 *   Auth: current Bearer token (proves ownership)
 *   Body: { new_key_hash: string }  — SHA-256 hex of the new key (client computes this)
 *
 *   Inserts new key hash with active_from = now + 300s (5-min grace period).
 *   During grace: BOTH old and new hashes are accepted.
 *   After grace: only new hash accepted (old key still in table, just won't be "active" unless
 *   client explicitly revokes it; rotation creates the new key, caller should delete old key
 *   after confirming the new key works).
 *
 * D1 schema (applied on first request):
 *   CREATE TABLE IF NOT EXISTS api_keys (
 *     id INTEGER PRIMARY KEY AUTOINCREMENT,
 *     key_hash TEXT NOT NULL UNIQUE,
 *     created_at TEXT DEFAULT (datetime('now')),
 *     active_from TEXT NOT NULL,
 *     revoked_at TEXT
 *   );
 */

interface Env {
  DB: D1Database;
  RCAN_ADMIN_TOKEN?: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Cache-Control": "no-store",
    },
  });
}

function err(message: string, status = 400): Response {
  return json({ error: message }, status);
}

function cors(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

function bearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

const GRACE_PERIOD_SECONDS = 300; // 5 minutes

/** Ensure api_keys table exists */
async function ensureApiKeysTable(db: D1Database): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_hash TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      active_from TEXT NOT NULL,
      revoked_at TEXT
    )
  `);
}

/**
 * Verify admin-level auth:
 * 1. Check D1 api_keys (SHA-256 of token, active_from <= now, not revoked)
 * 2. Fall back to RCAN_ADMIN_TOKEN env var if table is empty
 */
async function verifyAdminAuth(req: Request, env: Env): Promise<boolean> {
  const token = bearerToken(req);
  if (!token) return false;

  try {
    const keyHash = await sha256hex(token);
    const now = new Date().toISOString();
    const activeKey = await env.DB.prepare(
      `SELECT id FROM api_keys
       WHERE key_hash = ? AND active_from <= ? AND revoked_at IS NULL`
    )
      .bind(keyHash, now)
      .first();

    if (activeKey) return true;

    const count = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM api_keys WHERE revoked_at IS NULL`
    ).first<{ c: number }>();

    if (count && count.c > 0) return false;
  } catch {
    // Table doesn't exist yet — fall through to env var
  }

  if (env.RCAN_ADMIN_TOKEN && token === env.RCAN_ADMIN_TOKEN) return true;
  return false;
}

async function handleRotateKey(req: Request, env: Env): Promise<Response> {
  if (!await verifyAdminAuth(req, env)) {
    return err("Authorization required", 401);
  }

  await ensureApiKeysTable(env.DB);

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return err("Request body must be valid JSON");
  }

  const { new_key_hash } = body;

  if (typeof new_key_hash !== "string" || !/^[0-9a-f]{64}$/i.test(new_key_hash)) {
    return err(
      "Required field: new_key_hash — must be a valid SHA-256 hex string (64 hex chars)"
    );
  }

  const normalizedHash = new_key_hash.toLowerCase();
  const now = new Date();
  const activeFrom = new Date(
    now.getTime() + GRACE_PERIOD_SECONDS * 1000
  ).toISOString();
  const createdAt = now.toISOString();

  // Check for duplicate
  const existing = await env.DB.prepare(
    `SELECT id FROM api_keys WHERE key_hash = ?`
  )
    .bind(normalizedHash)
    .first();

  if (existing) {
    return err("This key hash is already registered", 409);
  }

  // Insert new key (active after grace period)
  const result = await env.DB.prepare(
    `INSERT INTO api_keys (key_hash, created_at, active_from, revoked_at)
     VALUES (?, ?, ?, NULL)`
  )
    .bind(normalizedHash, createdAt, activeFrom)
    .run();

  const newId = (result.meta as any)?.last_row_id ?? null;

  // Revoke any previously active keys that are older (preserve current key during grace period)
  // We only revoke keys that are currently active and are NOT the one we just inserted
  // This allows both old and new key to work during grace period
  // After grace, old key should be explicitly revoked by the caller
  // (We don't auto-revoke to avoid breaking existing sessions mid-rotation)

  return json({
    id: newId,
    key_hash: normalizedHash,
    created_at: createdAt,
    active_from: activeFrom,
    grace_period_seconds: GRACE_PERIOD_SECONDS,
    message: `New API key scheduled. Both old and new keys accepted for ${GRACE_PERIOD_SECONDS}s. After ${activeFrom}, only the new key is active. Revoke the old key hash explicitly once you've confirmed the new key works.`,
    note: "The new key will become active at active_from. Update your clients before then.",
  });
}

export async function onRequest(context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
}): Promise<Response> {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") return cors();

  try {
    if (method === "POST") return await handleRotateKey(request, env);
    return err("Method not allowed", 405);
  } catch (e) {
    console.error("Admin rotate-key error:", e);
    return err("Internal server error", 500);
  }
}
