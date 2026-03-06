/**
 * rcan.dev Webhooks API — GET/POST /api/v1/webhooks
 * Cloudflare Pages Functions (compatible with Cloudflare Workers)
 *
 * POST /api/v1/webhooks/register  (routed via [id].ts when id="register")
 *   Auth: Bearer token (admin)
 *   Body: { node_prefix, webhook_url, secret? }
 *   Registers a webhook URL for a namespace delegation.
 *   The root POSTs to this URL when records in the prefix namespace change.
 *
 * GET /api/v1/webhooks
 *   Auth: Bearer token (admin)
 *   Returns list of registered webhooks.
 *
 * DELETE /api/v1/webhooks/:id   (in [id].ts)
 *   Auth: Bearer token (admin)
 *   Removes webhook registration.
 *
 * D1 schema (applied on first request):
 *   CREATE TABLE IF NOT EXISTS webhooks (
 *     id INTEGER PRIMARY KEY AUTOINCREMENT,
 *     node_prefix TEXT NOT NULL,
 *     webhook_url TEXT NOT NULL,
 *     secret_hash TEXT,
 *     created_at TEXT DEFAULT (datetime('now')),
 *     last_delivered_at TEXT,
 *     failure_count INTEGER DEFAULT 0
 *   );
 */

interface Env {
  DB: D1Database;
  RCAN_ADMIN_TOKEN?: string;
  RCAN_NODE_URL?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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

/**
 * Verify admin-level auth:
 * 1. Check D1 api_keys table (SHA-256 of token, active_from <= now, not revoked)
 * 2. Fall back to RCAN_ADMIN_TOKEN env var if D1 table is empty / doesn't exist
 */
export async function verifyAdminAuth(req: Request, env: Env): Promise<boolean> {
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

    // Active keys exist in table but none matched — deny
    if (count && count.c > 0) return false;
  } catch {
    // api_keys table doesn't exist yet — fall through to env var
  }

  // Fallback to RCAN_ADMIN_TOKEN
  if (env.RCAN_ADMIN_TOKEN && token === env.RCAN_ADMIN_TOKEN) return true;
  return false;
}

/** Ensure webhooks table exists */
async function ensureWebhooksTable(db: D1Database): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_prefix TEXT NOT NULL,
      webhook_url TEXT NOT NULL,
      secret_hash TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      last_delivered_at TEXT,
      failure_count INTEGER DEFAULT 0
    )
  `);
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhooks_prefix ON webhooks(node_prefix)`
  );
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function handleRegister(req: Request, env: Env): Promise<Response> {
  if (!await verifyAdminAuth(req, env)) {
    return err("Authorization required", 401);
  }

  await ensureWebhooksTable(env.DB);

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return err("Request body must be valid JSON");
  }

  const { node_prefix, webhook_url, secret } = body;

  if (typeof node_prefix !== "string" || !node_prefix.trim()) {
    return err("Required field: node_prefix");
  }
  if (typeof webhook_url !== "string" || !webhook_url.startsWith("http")) {
    return err("Required field: webhook_url (must be a valid HTTP/HTTPS URL)");
  }

  const prefix = node_prefix.toUpperCase().trim();

  // Validate that a namespace delegation exists for this prefix
  const delegation = await env.DB.prepare(
    `SELECT prefix FROM namespace_delegations WHERE prefix = ?`
  )
    .bind(prefix)
    .first();

  if (!delegation) {
    return err(
      `No namespace delegation found for prefix: ${prefix}. Register the node first.`,
      422
    );
  }

  // Hash the secret if provided
  let secretHash: string | null = null;
  if (typeof secret === "string" && secret.trim()) {
    secretHash = await sha256hex(secret.trim());
  }

  const result = await env.DB.prepare(
    `INSERT INTO webhooks (node_prefix, webhook_url, secret_hash)
     VALUES (?, ?, ?)`
  )
    .bind(prefix, webhook_url, secretHash)
    .run();

  const newId = (result.meta as any)?.last_row_id ?? null;

  return json(
    {
      id: newId,
      node_prefix: prefix,
      webhook_url,
      has_secret: secretHash !== null,
      created_at: new Date().toISOString(),
      message: "Webhook registered successfully",
    },
    201
  );
}

async function handleList(req: Request, env: Env): Promise<Response> {
  if (!await verifyAdminAuth(req, env)) {
    return err("Authorization required", 401);
  }

  await ensureWebhooksTable(env.DB);

  const rows = await env.DB.prepare(
    `SELECT id, node_prefix, webhook_url,
            (secret_hash IS NOT NULL) as has_secret,
            created_at, last_delivered_at, failure_count
     FROM webhooks
     ORDER BY created_at DESC`
  ).all();

  return json({ webhooks: rows.results, count: rows.results.length });
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function onRequest(context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
}): Promise<Response> {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") return cors();

  try {
    if (method === "GET") return await handleList(request, env);
    // Allow POST /api/v1/webhooks directly as alias for register
    if (method === "POST") return await handleRegister(request, env);
    return err("Method not allowed", 405);
  } catch (e) {
    console.error("Webhooks API error:", e);
    return err("Internal server error", 500);
  }
}
