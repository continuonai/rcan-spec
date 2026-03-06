/**
 * rcan.dev Sync API — GET/POST /api/v1/sync
 * Cloudflare Pages Functions (compatible with Cloudflare Workers)
 *
 * GET  /api/v1/sync?since=<ISO>&prefix=<NS_PREFIX>&limit=<N>
 *   Returns changed robot records since `since`, optionally filtered by namespace prefix.
 *   Auth: Bearer token (admin key or RCAN_ADMIN_TOKEN)
 *
 * POST /api/v1/sync
 *   Accept a sync payload pushed from an authoritative node.
 *   Body: { protocol, from_node, records, since, signature? }
 *   Auth: Bearer token
 *   Conflict resolution: root record wins — reject records for RRNs that exist locally.
 */

interface Env {
  DB: D1Database;
  RCAN_API_KEY_SALT?: string;
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
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify admin-level auth:
 * 1. Check D1 api_keys table (SHA-256 of token, active_from <= now, not revoked)
 * 2. Fall back to RCAN_ADMIN_TOKEN env var if D1 table is empty
 */
async function verifyAdminAuth(req: Request, env: Env): Promise<boolean> {
  const token = bearerToken(req);
  if (!token) return false;

  // Check D1 api_keys table first
  try {
    const keyHash = await sha256hex(token);
    const now = new Date().toISOString();
    const activeKey = await env.DB.prepare(
      `SELECT id FROM api_keys
       WHERE key_hash = ? AND active_from <= ? AND revoked_at IS NULL`
    ).bind(keyHash, now).first();

    if (activeKey) return true;

    // Check if table has any keys at all
    const count = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM api_keys WHERE revoked_at IS NULL`
    ).first<{ c: number }>();

    // If there are active keys in the table but none matched, deny
    if (count && count.c > 0) return false;

    // Table is empty — fall through to env var check
  } catch {
    // Table doesn't exist yet — fall through to env var check
  }

  // Fallback: check RCAN_ADMIN_TOKEN env var
  if (env.RCAN_ADMIN_TOKEN && token === env.RCAN_ADMIN_TOKEN) return true;

  return false;
}

/**
 * Apply schema migrations for sync support.
 * Adds updated_at column to robots if not present.
 * Idempotent — safe to call on every request.
 */
async function ensureSyncSchema(db: D1Database): Promise<void> {
  // Add updated_at to robots (gracefully handle if already exists)
  try {
    await db.exec(
      `ALTER TABLE robots ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))`
    );
  } catch {
    // Column already exists — ignore
  }
  try {
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_robots_updated_at ON robots(updated_at)`
    );
  } catch {
    // Index may already exist
  }
}

// ── GET /api/v1/sync ──────────────────────────────────────────────────────────

async function handleGet(req: Request, env: Env): Promise<Response> {
  if (!await verifyAdminAuth(req, env)) {
    return err("Authorization required", 401);
  }

  await ensureSyncSchema(env.DB);

  const url = new URL(req.url);
  const sinceRaw = url.searchParams.get("since") ?? "1970-01-01T00:00:00Z";
  const prefix = url.searchParams.get("prefix")?.toUpperCase().trim() ?? "";
  const rawLimit = parseInt(url.searchParams.get("limit") ?? "100");
  const limit = Math.min(1000, Math.max(1, isNaN(rawLimit) ? 100 : rawLimit));

  // Validate `since`
  const sinceDate = new Date(sinceRaw);
  if (isNaN(sinceDate.getTime())) {
    return err("Invalid `since` timestamp; expected ISO 8601 format");
  }

  const until = new Date().toISOString();
  const selfUrl = env.RCAN_NODE_URL ?? "https://rcan.dev";

  let whereClause = "deleted = 0 AND updated_at > ?";
  const params: (string | number)[] = [sinceDate.toISOString()];

  if (prefix) {
    whereClause += " AND rrn LIKE ?";
    params.push(`RRN-${prefix}-%`);
  }

  // Fetch limit+1 to detect has_more
  const rows = await env.DB.prepare(
    `SELECT rrn, manufacturer, model, version, device_id, rcan_uri,
            verification_tier, description, registered_at, updated_at
     FROM robots WHERE ${whereClause}
     ORDER BY updated_at ASC LIMIT ?`
  )
    .bind(...params, limit + 1)
    .all();

  const allResults = rows.results as Array<Record<string, unknown>>;
  const hasMore = allResults.length > limit;
  const records = hasMore ? allResults.slice(0, limit) : allResults;

  // next_since = updated_at of the last returned record (or `until` if no results)
  const nextSince =
    records.length > 0
      ? String(records[records.length - 1].updated_at ?? until)
      : until;

  return json({
    protocol: "rcan-sync/1.0",
    from_node: selfUrl,
    since: sinceDate.toISOString(),
    until,
    count: records.length,
    has_more: hasMore,
    next_since: nextSince,
    records,
  });
}

// ── POST /api/v1/sync ─────────────────────────────────────────────────────────

async function handlePost(req: Request, env: Env): Promise<Response> {
  if (!await verifyAdminAuth(req, env)) {
    return err("Authorization required", 401);
  }

  await ensureSyncSchema(env.DB);

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return err("Request body must be valid JSON");
  }

  const { protocol, from_node, records } = body;

  if (protocol !== "rcan-sync/1.0") {
    return err("Unsupported protocol; expected rcan-sync/1.0");
  }
  if (typeof from_node !== "string" || !from_node) {
    return err("Missing or invalid `from_node`");
  }
  if (!Array.isArray(records)) {
    return err("Missing or invalid `records` array");
  }

  // Validate from_node is a registered authoritative node
  const delegation = await env.DB.prepare(
    `SELECT prefix FROM namespace_delegations WHERE node_url = ? LIMIT 1`
  )
    .bind(from_node)
    .first();

  if (!delegation) {
    return err(
      `Unknown node: ${from_node}. Register via namespace delegation first.`,
      403
    );
  }

  let accepted = 0;
  let rejected = 0;
  let conflicts = 0;

  for (const record of records) {
    if (typeof record !== "object" || record === null) {
      rejected++;
      continue;
    }

    const r = record as Record<string, unknown>;
    const rrn = typeof r.rrn === "string" ? r.rrn.toUpperCase() : null;

    if (!rrn) {
      rejected++;
      continue;
    }

    // Root record wins: if RRN exists locally, it's a conflict — skip
    const existing = await env.DB.prepare(
      `SELECT id FROM robots WHERE rrn = ? AND deleted = 0`
    )
      .bind(rrn)
      .first<{ id: number }>();

    if (existing) {
      conflicts++;
      continue;
    }

    // Insert the record from the remote node
    const now = new Date().toISOString();
    const manufacturer =
      typeof r.manufacturer === "string" ? r.manufacturer : "";
    const model = typeof r.model === "string" ? r.model : "";
    const version = typeof r.version === "string" ? r.version : "";
    const device_id = typeof r.device_id === "string" ? r.device_id : "";
    const rcan_uri = typeof r.rcan_uri === "string" ? r.rcan_uri : "";
    const verification_tier =
      typeof r.verification_tier === "string"
        ? r.verification_tier
        : "community";
    const description =
      typeof r.description === "string" ? r.description : "";
    const contact_email =
      typeof r.contact_email === "string" ? r.contact_email : "";
    const source = typeof r.source === "string" ? r.source : "";
    const registered_at =
      typeof r.registered_at === "string" ? r.registered_at : now;
    const updated_at =
      typeof r.updated_at === "string" ? r.updated_at : now;

    if (!manufacturer || !model || !version || !device_id || !rcan_uri) {
      rejected++;
      continue;
    }

    try {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO robots
           (rrn, manufacturer, model, version, device_id, rcan_uri,
            verification_tier, description, contact_email, source,
            registered_at, updated_at, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
      )
        .bind(
          rrn,
          manufacturer,
          model,
          version,
          device_id,
          rcan_uri,
          verification_tier,
          description,
          contact_email,
          source,
          registered_at,
          updated_at
        )
        .run();
      accepted++;
    } catch {
      rejected++;
    }
  }

  return json({ accepted, rejected, conflicts });
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
    if (method === "GET") return await handleGet(request, env);
    if (method === "POST") return await handlePost(request, env);
    return err("Method not allowed", 405);
  } catch (e) {
    console.error("Sync API error:", e);
    return err("Internal server error", 500);
  }
}
