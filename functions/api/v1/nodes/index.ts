/**
 * rcan.dev Node Directory — GET /api/v1/nodes
 * Cloudflare Pages Functions (compatible with Cloudflare Workers)
 *
 * D1 database binding: DB (configured in wrangler.toml or Pages dashboard)
 *
 * Endpoints:
 *   GET /api/v1/nodes           List all known authoritative nodes
 *   GET /api/v1/nodes?prefix=BD Filter to specific namespace prefix (always includes root)
 *
 * No authentication required — public directory.
 */

interface Env {
  DB: D1Database;
  RCAN_NODE_URL?: string;    // self URL, defaults to https://rcan.dev
  RCAN_API_KEY_SALT?: string; // required for write (admin) operations
}

interface NodeEntry {
  prefix: string;
  operator: string;
  node_url: string;
  node_type: "root" | "delegated";
  manifest_url: string;
  node_pubkey?: string | null;
  delegated_at?: string | null;
  expires_at?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
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

function isAdminAuthorized(request: Request, env: Env): boolean {
  if (!env.RCAN_API_KEY_SALT) return false;
  const auth = request.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7).trim();
  // Simple constant-time comparison: token must equal the salt value itself
  // (in production, hash+compare; here salt doubles as the key for simplicity)
  return token.length === env.RCAN_API_KEY_SALT.length &&
    token === env.RCAN_API_KEY_SALT;
}

/** Ensure namespace_delegations table exists */
async function ensureTable(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS namespace_delegations (
      prefix TEXT PRIMARY KEY,
      operator TEXT NOT NULL,
      node_url TEXT NOT NULL,
      node_pubkey TEXT,
      delegated_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT
    )
  `).run();
}

// ── POST handler: register a new namespace delegation ─────────────────────────

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // Admin auth required
  if (!env.RCAN_API_KEY_SALT) {
    return json({ error: "AUTH_REQUIRED", message: "Write operations are not enabled on this node" }, 503);
  }
  if (!isAdminAuthorized(request, env)) {
    return json({ error: "AUTH_INVALID", message: "Bearer token invalid or missing" }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ error: "INVALID_REQUEST", message: "Request body must be valid JSON" }, 400);
  }

  const prefix = (typeof body.prefix === "string" ? body.prefix : "").toUpperCase().trim();
  const operator = typeof body.operator === "string" ? body.operator.trim() : "";
  const node_url = typeof body.node_url === "string" ? body.node_url.trim() : "";
  const node_pubkey = typeof body.node_pubkey === "string" ? body.node_pubkey.trim() : null;
  const contact = typeof body.contact === "string" ? body.contact.trim() : null;

  // Validate prefix: [A-Z0-9]{2,8}
  if (!/^[A-Z0-9]{2,8}$/.test(prefix)) {
    return json({
      error: "INVALID_PREFIX",
      message: "prefix must be 2–8 uppercase alphanumeric characters (e.g. BD, ACME)",
    }, 400);
  }

  // Validate operator
  if (!operator) {
    return json({ error: "INVALID_REQUEST", message: "operator is required" }, 400);
  }

  // Validate node_url must be https://
  if (!node_url.startsWith("https://")) {
    return json({
      error: "INVALID_NODE_URL",
      message: "node_url must start with https://",
    }, 400);
  }

  try {
    await ensureTable(env.DB);

    // Check if prefix already taken
    const existing = await env.DB.prepare(
      "SELECT prefix FROM namespace_delegations WHERE prefix = ?"
    ).bind(prefix).first<{ prefix: string }>();

    if (existing) {
      return json({
        error: "DELEGATION_EXISTS",
        message: `Prefix '${prefix}' is already registered`,
        prefix,
      }, 409);
    }

    const delegated_at = new Date().toISOString();
    const delegation_id = `del-${prefix.toLowerCase()}-${Date.now()}`;

    await env.DB.prepare(
      `INSERT INTO namespace_delegations
         (prefix, operator, node_url, node_pubkey, delegated_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(prefix, operator, node_url, node_pubkey, delegated_at).run();

    return json({
      success: true,
      prefix,
      operator,
      node_url,
      delegation_id,
      delegated_at,
      ...(contact ? { contact } : {}),
    }, 201);
  } catch (e) {
    console.error("POST /api/v1/nodes error:", e);
    return json({ error: "INTERNAL_ERROR", message: String(e) }, 500);
  }
};

// ── Main GET handler ───────────────────────────────────────────────────────────

export async function onRequest(context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
}): Promise<Response> {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") return cors();
  if (method === "POST") return onRequestPost(context as Parameters<typeof onRequestPost>[0]);
  if (method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const url = new URL(request.url);
  const prefixFilter = url.searchParams.get("prefix")?.toUpperCase().trim() ?? "";
  const selfUrl = env.RCAN_NODE_URL ?? "https://rcan.dev";

  // Root node is always included
  const rootNode: NodeEntry = {
    prefix: "RRN",
    operator: "Robot Registry Foundation",
    node_url: selfUrl,
    node_type: "root",
    manifest_url: `${selfUrl}/.well-known/rcan-node.json`,
  };

  try {
    // Ensure table exists
    await ensureTable(env.DB);

    let delegations: NodeEntry[] = [];

    if (prefixFilter) {
      // Return root + specific prefix if it matches a delegation
      const row = await env.DB.prepare(
        `SELECT prefix, operator, node_url, node_pubkey, delegated_at, expires_at
         FROM namespace_delegations WHERE prefix = ?`
      ).bind(prefixFilter).first<{
        prefix: string;
        operator: string;
        node_url: string;
        node_pubkey: string | null;
        delegated_at: string | null;
        expires_at: string | null;
      }>();

      if (row) {
        delegations = [{
          prefix: row.prefix,
          operator: row.operator,
          node_url: row.node_url,
          node_type: "delegated",
          manifest_url: `${row.node_url}/.well-known/rcan-node.json`,
          node_pubkey: row.node_pubkey,
          delegated_at: row.delegated_at,
          expires_at: row.expires_at,
        }];
      }
    } else {
      // Return all delegations
      const rows = await env.DB.prepare(
        `SELECT prefix, operator, node_url, node_pubkey, delegated_at, expires_at
         FROM namespace_delegations
         ORDER BY prefix ASC`
      ).all<{
        prefix: string;
        operator: string;
        node_url: string;
        node_pubkey: string | null;
        delegated_at: string | null;
        expires_at: string | null;
      }>();

      delegations = (rows.results ?? []).map(row => ({
        prefix: row.prefix,
        operator: row.operator,
        node_url: row.node_url,
        node_type: "delegated" as const,
        manifest_url: `${row.node_url}/.well-known/rcan-node.json`,
        node_pubkey: row.node_pubkey,
        delegated_at: row.delegated_at,
        expires_at: row.expires_at,
      }));
    }

    const nodes: NodeEntry[] = [rootNode, ...delegations];

    return json({ nodes, total: nodes.length });
  } catch (e) {
    console.error("Nodes directory error:", e);
    return json({ error: "INTERNAL_ERROR", message: String(e) }, 500);
  }
}
