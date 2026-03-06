/**
 * rcan.dev — GET /api/v1/robots/search
 *
 * Full-text search over the robot registry.
 * Query params:
 *   q       — search string (required, min 2 chars)
 *   limit   — max results (default 10, max 50)
 *   tier    — filter by verification tier
 *
 * This is a static route that takes priority over [rrn].ts for the
 * path /api/v1/robots/search.
 */

interface Env {
  DB: D1Database;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
    },
  });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10")));
  const tier = url.searchParams.get("tier")?.trim() ?? "";

  if (q.length < 2) {
    return json({ error: "Query must be at least 2 characters", results: [] }, 400);
  }

  try {
    const pattern = `%${q}%`;
    const params: (string | number)[] = [pattern, pattern, pattern, pattern];

    let whereClause =
      "(manufacturer LIKE ? OR model LIKE ? OR device_id LIKE ? OR description LIKE ?) AND deleted = 0";

    if (tier) {
      whereClause += " AND verification_tier = ?";
      params.push(tier);
    }

    params.push(limit);

    const rows = await env.DB.prepare(
      `SELECT rrn, manufacturer, model, version, device_id, rcan_uri,
              verification_tier, description, registered_at
       FROM robots
       WHERE ${whereClause}
       ORDER BY registered_at DESC
       LIMIT ?`
    )
      .bind(...params)
      .all<{
        rrn: string;
        manufacturer: string;
        model: string;
        version: string;
        device_id: string;
        rcan_uri: string;
        verification_tier: string;
        description: string;
        registered_at: string;
      }>();

    const results = (rows.results ?? []).map((r) => ({
      rrn: r.rrn,
      manufacturer: r.manufacturer,
      model: r.model,
      version: r.version,
      device_id: r.device_id,
      uri: r.rcan_uri,
      verification_tier: r.verification_tier,
      description: r.description,
      registered_at: r.registered_at,
    }));

    return json({
      q,
      results,
      count: results.length,
    });
  } catch (err) {
    console.error("search error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};
