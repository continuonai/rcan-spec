/**
 * rcan.dev Admin API — GET /api/v1/admin/status
 * Cloudflare Pages Functions (compatible with Cloudflare Workers)
 *
 * GET /api/v1/admin/status
 *   Auth: Bearer token (admin)
 *   Returns current API key count, last rotation time, and node health summary.
 */

interface Env {
  DB: D1Database;
  RCAN_ADMIN_TOKEN?: string;
  RCAN_NODE_URL?: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
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
    // api_keys table doesn't exist yet
  }

  if (env.RCAN_ADMIN_TOKEN && token === env.RCAN_ADMIN_TOKEN) return true;
  return false;
}

async function handleStatus(req: Request, env: Env): Promise<Response> {
  if (!await verifyAdminAuth(req, env)) {
    return err("Authorization required", 401);
  }

  const now = new Date().toISOString();
  const selfUrl = env.RCAN_NODE_URL ?? "https://rcan.dev";

  // API key stats
  let keyCount = 0;
  let lastRotatedAt: string | null = null;
  let usingEnvFallback = false;

  try {
    const keyStats = await env.DB.prepare(
      `SELECT COUNT(*) as c, MAX(created_at) as last_created
       FROM api_keys WHERE revoked_at IS NULL`
    ).first<{ c: number; last_created: string | null }>();

    keyCount = keyStats?.c ?? 0;
    lastRotatedAt = keyStats?.last_created ?? null;
    usingEnvFallback = keyCount === 0;
  } catch {
    usingEnvFallback = true;
  }

  // Robot count
  let robotCount = 0;
  try {
    const rc = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM robots WHERE deleted = 0`
    ).first<{ c: number }>();
    robotCount = rc?.c ?? 0;
  } catch {
    // robots table may not exist in edge cases
  }

  // Webhook count
  let webhookCount = 0;
  try {
    const wc = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM webhooks`
    ).first<{ c: number }>();
    webhookCount = wc?.c ?? 0;
  } catch {
    // webhooks table may not exist yet
  }

  // Namespace delegation count
  let delegationCount = 0;
  try {
    const dc = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM namespace_delegations`
    ).first<{ c: number }>();
    delegationCount = dc?.c ?? 0;
  } catch {
    // table may not exist
  }

  return json({
    node: selfUrl,
    status: "ok",
    checked_at: now,
    auth: {
      key_count: keyCount,
      last_rotated_at: lastRotatedAt,
      using_env_fallback: usingEnvFallback,
    },
    registry: {
      robot_count: robotCount,
      delegation_count: delegationCount,
      webhook_count: webhookCount,
    },
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
    if (method === "GET") return await handleStatus(request, env);
    return err("Method not allowed", 405);
  } catch (e) {
    console.error("Admin API error:", e);
    return err("Internal server error", 500);
  }
}
