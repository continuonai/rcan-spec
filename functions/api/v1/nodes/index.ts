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
  RCAN_NODE_URL?: string;  // self URL, defaults to https://rcan.dev
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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
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

// ── Main handler ──────────────────────────────────────────────────────────────

export async function onRequest(context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
}): Promise<Response> {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") return cors();
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
