/**
 * rcan.dev Node Directory — Single namespace prefix endpoints
 * Cloudflare Pages Functions
 *
 * GET    /api/v1/nodes/:prefix   — get single delegation by prefix
 * DELETE /api/v1/nodes/:prefix   — revoke delegation (admin only)
 */

interface Env {
  DB: D1Database;
  RCAN_NODE_URL?: string;
  RCAN_API_KEY_SALT?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

function cors(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

function isAdminAuthorized(request: Request, env: Env): boolean {
  if (!env.RCAN_API_KEY_SALT) return false;
  const auth = request.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7).trim();
  return token.length === env.RCAN_API_KEY_SALT.length &&
    token === env.RCAN_API_KEY_SALT;
}

// ── GET /api/v1/nodes/:prefix ─────────────────────────────────────────────────

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const prefix = (params.prefix as string ?? "").toUpperCase().trim();

  if (!prefix) {
    return json({ error: "INVALID_REQUEST", message: "prefix is required" }, 400);
  }

  // Root node is a special case
  const selfUrl = env.RCAN_NODE_URL ?? "https://rcan.dev";
  if (prefix === "RRN" || prefix === "ROOT") {
    return json({
      success: true,
      node: {
        prefix: "RRN",
        operator: "Robot Registry Foundation",
        node_url: selfUrl,
        node_type: "root",
        manifest_url: `${selfUrl}/.well-known/rcan-node.json`,
      },
    });
  }

  try {
    const row = await env.DB.prepare(
      `SELECT prefix, operator, node_url, node_pubkey, delegated_at, expires_at
       FROM namespace_delegations WHERE prefix = ?`
    ).bind(prefix).first<{
      prefix: string;
      operator: string;
      node_url: string;
      node_pubkey: string | null;
      delegated_at: string | null;
      expires_at: string | null;
    }>();

    if (!row) {
      return json({
        success: false,
        error: "DELEGATION_NOT_FOUND",
        message: `No delegation found for prefix '${prefix}'`,
        prefix,
      }, 404);
    }

    return json({
      success: true,
      node: {
        prefix: row.prefix,
        operator: row.operator,
        node_url: row.node_url,
        node_type: "delegated",
        manifest_url: `${row.node_url}/.well-known/rcan-node.json`,
        node_pubkey: row.node_pubkey ?? undefined,
        delegated_at: row.delegated_at,
        expires_at: row.expires_at ?? undefined,
      },
    });
  } catch (e) {
    console.error("GET /api/v1/nodes/:prefix error:", e);
    return json({ error: "INTERNAL_ERROR", message: String(e) }, 500);
  }
};

// ── DELETE /api/v1/nodes/:prefix ──────────────────────────────────────────────

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const prefix = (params.prefix as string ?? "").toUpperCase().trim();

  if (!prefix) {
    return json({ error: "INVALID_REQUEST", message: "prefix is required" }, 400);
  }

  // Admin auth required
  if (!env.RCAN_API_KEY_SALT) {
    return json({ error: "AUTH_REQUIRED", message: "Write operations are not enabled on this node" }, 503);
  }
  if (!isAdminAuthorized(request, env)) {
    return json({ error: "AUTH_INVALID", message: "Bearer token invalid or missing" }, 403);
  }

  // Disallow deleting root
  if (prefix === "RRN" || prefix === "ROOT") {
    return json({ error: "INVALID_REQUEST", message: "Cannot revoke the root node delegation" }, 400);
  }

  try {
    const existing = await env.DB.prepare(
      "SELECT prefix FROM namespace_delegations WHERE prefix = ?"
    ).bind(prefix).first<{ prefix: string }>();

    if (!existing) {
      return json({
        success: false,
        error: "DELEGATION_NOT_FOUND",
        message: `No delegation found for prefix '${prefix}'`,
        prefix,
      }, 404);
    }

    await env.DB.prepare(
      "DELETE FROM namespace_delegations WHERE prefix = ?"
    ).bind(prefix).run();

    return json({
      success: true,
      message: `Delegation for prefix '${prefix}' revoked`,
      prefix,
      revoked_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("DELETE /api/v1/nodes/:prefix error:", e);
    return json({ error: "INTERNAL_ERROR", message: String(e) }, 500);
  }
};

// ── Main router ───────────────────────────────────────────────────────────────

export async function onRequest(context: EventContext<Env, "prefix", Record<string, string>>): Promise<Response> {
  const method = context.request.method.toUpperCase();
  if (method === "OPTIONS") return cors();
  if (method === "GET") return onRequestGet(context);
  if (method === "DELETE") return onRequestDelete(context);
  return json({ error: "Method not allowed" }, 405);
}
