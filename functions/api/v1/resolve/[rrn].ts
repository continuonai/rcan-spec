/**
 * rcan.dev Federated Resolver — GET /api/v1/resolve/:rrn
 * Cloudflare Pages Functions (compatible with Cloudflare Workers)
 *
 * D1 database binding: DB (configured in wrangler.toml or Pages dashboard)
 *
 * Resolution algorithm:
 *   RRN-XXXXXXXX        → root namespace (local D1 query)
 *   RRN-PREFIX-XXXXXXXX → delegated namespace (fan-out to authoritative node)
 *
 * Query params:
 *   no_cache=true   — bypass resolve_cache, always fetch fresh
 *   verify=true     — (future) verify node signature
 *
 * Response headers:
 *   X-Resolved-By   — which node answered
 *   X-Cache         — HIT | MISS | STALE
 *   X-RRN-Namespace — root | <PREFIX>
 */

interface Env {
  DB: D1Database;
  RCAN_NODE_URL?: string;   // self URL, defaults to https://rcan.dev
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      ...extra,
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

/** Parse RRN and return namespace info or null if invalid */
function parseRRN(rrn: string): { namespace: "root"; serial: string } | { namespace: string; prefix: string; serial: string } | null {
  // RRN-BD-00000001 → delegated
  const delegated = rrn.match(/^RRN-([A-Z]{2,6})-(\d{8})$/);
  if (delegated) {
    return { namespace: delegated[1], prefix: delegated[1], serial: delegated[2] };
  }
  // RRN-00000001 → root
  const root = rrn.match(/^RRN-(\d{8})$/);
  if (root) {
    return { namespace: "root", serial: root[1] };
  }
  return null;
}

/** Ensure namespace_delegations and resolve_cache tables exist */
async function ensureTables(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS namespace_delegations (
        prefix TEXT PRIMARY KEY,
        operator TEXT NOT NULL,
        node_url TEXT NOT NULL,
        node_pubkey TEXT,
        delegated_at TEXT DEFAULT (datetime('now')),
        expires_at TEXT
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS resolve_cache (
        rrn TEXT PRIMARY KEY,
        record_json TEXT NOT NULL,
        resolved_by TEXT NOT NULL,
        cached_at TEXT DEFAULT (datetime('now')),
        ttl_seconds INTEGER DEFAULT 3600,
        expires_at TEXT
      )
    `),
  ]);
}

/** Fetch from an authoritative node with a 5s timeout */
async function fetchFromNode(nodeUrl: string, rrn: string): Promise<{ ok: boolean; status: number; data?: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const resp = await fetch(`${nodeUrl}/api/v1/robots/${rrn}`, {
      signal: controller.signal,
      headers: { "Accept": "application/json", "User-Agent": "rcan-resolver/1.0" },
    });
    clearTimeout(timer);

    if (resp.ok) {
      const data = await resp.json();
      return { ok: true, status: resp.status, data };
    }
    return { ok: false, status: resp.status };
  } catch {
    clearTimeout(timer);
    return { ok: false, status: 0 };
  }
}

// ── Resolution handlers ───────────────────────────────────────────────────────

async function resolveRoot(rrn: string, env: Env, noCache: boolean): Promise<Response> {
  const selfUrl = env.RCAN_NODE_URL ?? "https://rcan.dev";
  const now = new Date().toISOString();

  const row = await env.DB.prepare(
    `SELECT rrn, manufacturer, model, version, device_id, rcan_uri,
            verification_tier, description, registered_at, updated_at
     FROM robots WHERE rrn = ? AND deleted = 0`
  ).bind(rrn).first();

  if (!row) {
    return json({ error: "NOT_FOUND", rrn }, 404, {
      "X-Resolved-By": selfUrl,
      "X-Cache": "MISS",
      "X-RRN-Namespace": "root",
    });
  }

  return json(
    {
      rrn,
      resolved_by: selfUrl,
      namespace: "root",
      record: row,
      cache_status: "MISS",
      resolved_at: now,
    },
    200,
    {
      "X-Resolved-By": selfUrl,
      "X-Cache": "MISS",
      "X-RRN-Namespace": "root",
    }
  );
}

async function resolveDelegated(
  rrn: string,
  prefix: string,
  env: Env,
  noCache: boolean
): Promise<Response> {
  const selfUrl = env.RCAN_NODE_URL ?? "https://rcan.dev";
  const now = new Date().toISOString();

  // Look up delegation
  const delegation = await env.DB.prepare(
    `SELECT prefix, operator, node_url, node_pubkey, expires_at
     FROM namespace_delegations WHERE prefix = ?`
  ).bind(prefix).first<{
    prefix: string;
    operator: string;
    node_url: string;
    node_pubkey: string | null;
    expires_at: string | null;
  }>();

  if (!delegation) {
    return json(
      { error: "NODE_DELEGATION_NOT_FOUND", prefix, rrn },
      404,
      {
        "X-Resolved-By": selfUrl,
        "X-Cache": "MISS",
        "X-RRN-Namespace": prefix,
      }
    );
  }

  // Check if delegation has expired
  if (delegation.expires_at && new Date(delegation.expires_at) < new Date()) {
    return json(
      { error: "NODE_DELEGATION_EXPIRED", prefix, rrn, expired_at: delegation.expires_at },
      404,
      {
        "X-Resolved-By": selfUrl,
        "X-Cache": "MISS",
        "X-RRN-Namespace": prefix,
      }
    );
  }

  const nodeUrl = delegation.node_url;

  // Check resolve_cache (unless no_cache)
  if (!noCache) {
    const cached = await env.DB.prepare(
      `SELECT record_json, resolved_by, cached_at, ttl_seconds, expires_at
       FROM resolve_cache WHERE rrn = ?`
    ).bind(rrn).first<{
      record_json: string;
      resolved_by: string;
      cached_at: string;
      ttl_seconds: number;
      expires_at: string | null;
    }>();

    if (cached) {
      const notExpired = !cached.expires_at || new Date(cached.expires_at) > new Date();
      if (notExpired) {
        return json(
          {
            rrn,
            resolved_by: cached.resolved_by,
            namespace: prefix,
            record: JSON.parse(cached.record_json),
            cache_status: "HIT",
            resolved_at: cached.cached_at,
          },
          200,
          {
            "X-Resolved-By": cached.resolved_by,
            "X-Cache": "HIT",
            "X-RRN-Namespace": prefix,
          }
        );
      }
    }
  }

  // Fan-out to authoritative node
  const result = await fetchFromNode(nodeUrl, rrn);

  if (result.ok && result.data) {
    // Cache the result
    const ttl = 3600;
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    await env.DB.prepare(
      `INSERT OR REPLACE INTO resolve_cache
         (rrn, record_json, resolved_by, cached_at, ttl_seconds, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(rrn, JSON.stringify(result.data), nodeUrl, now, ttl, expiresAt).run();

    return json(
      {
        rrn,
        resolved_by: nodeUrl,
        namespace: prefix,
        record: result.data,
        cache_status: "MISS",
        resolved_at: now,
      },
      200,
      {
        "X-Resolved-By": nodeUrl,
        "X-Cache": "MISS",
        "X-RRN-Namespace": prefix,
      }
    );
  }

  // Node returned 404
  if (result.status === 404) {
    return json(
      { error: "NODE_NOT_FOUND", node_url: nodeUrl, rrn },
      404,
      {
        "X-Resolved-By": nodeUrl,
        "X-Cache": "MISS",
        "X-RRN-Namespace": prefix,
      }
    );
  }

  // Network error or non-200/404 — check stale cache
  const stale = await env.DB.prepare(
    `SELECT record_json, resolved_by, cached_at FROM resolve_cache WHERE rrn = ?`
  ).bind(rrn).first<{ record_json: string; resolved_by: string; cached_at: string }>();

  if (stale) {
    return json(
      {
        rrn,
        resolved_by: stale.resolved_by,
        namespace: prefix,
        record: JSON.parse(stale.record_json),
        cache_status: "STALE",
        resolved_at: stale.cached_at,
        warning: "Authoritative node unavailable; serving stale cached record",
      },
      200,
      {
        "X-Resolved-By": stale.resolved_by,
        "X-Cache": "STALE",
        "X-RRN-Namespace": prefix,
      }
    );
  }

  // Nothing available
  return json(
    { error: "NODE_UNAVAILABLE", node_url: nodeUrl, rrn },
    503,
    {
      "X-Resolved-By": selfUrl,
      "X-Cache": "MISS",
      "X-RRN-Namespace": prefix,
    }
  );
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function onRequest(context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
}): Promise<Response> {
  const { request, env, params } = context;
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") return cors();
  if (method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const url = new URL(request.url);
  const noCache = url.searchParams.get("no_cache") === "true";
  // verify=true is reserved for future signature verification
  // const verify = url.searchParams.get("verify") !== "false";

  // params.rrn comes from the [rrn] filename pattern
  const rawRrn = (params.rrn ?? "").toUpperCase();

  const parsed = parseRRN(rawRrn);
  if (!parsed) {
    return json(
      { error: "INVALID_RRN_FORMAT", rrn: rawRrn },
      400,
      { "X-Resolved-By": env.RCAN_NODE_URL ?? "https://rcan.dev" }
    );
  }

  try {
    // Ensure tables exist (idempotent)
    await ensureTables(env.DB);

    if (parsed.namespace === "root") {
      return await resolveRoot(rawRrn, env, noCache);
    } else {
      return await resolveDelegated(rawRrn, (parsed as { prefix: string }).prefix, env, noCache);
    }
  } catch (e) {
    console.error("Resolver error:", e);
    return json({ error: "INTERNAL_ERROR", message: String(e) }, 500);
  }
}
