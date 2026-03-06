/**
 * rcan.dev — Cloudflare Pages Middleware
 * D1-backed sliding-window rate limiting on all API requests.
 *
 * Rate limits (per IP, per window):
 *   write   — POST/PATCH/DELETE  →  10 req / 60 s
 *   read    — GET                → 100 req / 60 s
 *   resolve — GET /resolve       → 200 req / 60 s
 */

interface Env {
  DB: D1Database;
  RCAN_API_KEY_SALT?: string;
}

// Rate limits by endpoint type
const RATE_LIMITS = {
  write:   { requests: 10,  windowSeconds: 60 }, // POST/PATCH/DELETE
  read:    { requests: 100, windowSeconds: 60 }, // GET
  resolve: { requests: 200, windowSeconds: 60 }, // GET /resolve
} as const;

type LimitType = keyof typeof RATE_LIMITS;

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;

  // Skip rate limiting if no DB binding (e.g. local dev without D1)
  if (!env.DB) return next();

  const method = request.method.toUpperCase();
  const url = new URL(request.url);

  // Determine limit type
  const limitType: LimitType = url.pathname.includes("/resolve")
    ? "resolve"
    : ["POST", "PATCH", "DELETE"].includes(method)
    ? "write"
    : "read";

  // Key: IP + endpoint type
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "unknown";
  const key = `${ip}:${limitType}`;
  const limit = RATE_LIMITS[limitType];
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - limit.windowSeconds;

  try {
    // Ensure rate_limit_buckets table exists (idempotent)
    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS rate_limit_buckets (
        key TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rate_limit_key_ts ON rate_limit_buckets(key, timestamp);
    `);

    // Count requests in the current window
    const { results } = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM rate_limit_buckets WHERE key = ? AND timestamp > ?"
    )
      .bind(key, windowStart)
      .all();

    const count = (results[0] as any)?.count ?? 0;

    if (count >= limit.requests) {
      return new Response(
        JSON.stringify({ error: "RATE_LIMITED", retry_after: limit.windowSeconds }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(limit.windowSeconds),
            "X-RateLimit-Limit": String(limit.requests),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(now + limit.windowSeconds),
          },
        }
      );
    }

    // Record this request
    await env.DB.prepare(
      "INSERT INTO rate_limit_buckets (key, timestamp) VALUES (?, ?)"
    )
      .bind(key, now)
      .run();

    // Cleanup old entries (fire-and-forget — don't block the response)
    env.DB.prepare("DELETE FROM rate_limit_buckets WHERE timestamp < ?")
      .bind(windowStart)
      .run();

    // Pass through and attach rate-limit headers to the response
    const response = await next();
    const remaining = limit.requests - count - 1;
    const newHeaders = new Headers(response.headers);
    newHeaders.set("X-RateLimit-Limit", String(limit.requests));
    newHeaders.set("X-RateLimit-Remaining", String(Math.max(0, remaining)));
    newHeaders.set("X-RateLimit-Reset", String(now + limit.windowSeconds));

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  } catch {
    // If rate limiting itself fails, don't block legitimate traffic
    return next();
  }
};
