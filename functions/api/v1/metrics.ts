/**
 * rcan.dev Registry Stats — GET /api/v1/metrics
 * Cloudflare Pages Functions
 *
 * Returns aggregate robot counts by tier and status.
 * Used by rcan.dev index page stats counter.
 *
 * Response shape:
 *   {
 *     total_robots: number,
 *     by_tier: { community: N, verified: N, manufacturer: N, certified: N },
 *     by_status: { active: N, deleted: N },
 *     registered_today: N
 *   }
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
      // Cache for 60s; metrics don't need real-time accuracy
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
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

  try {
    const db = env.DB;

    // Total robots (non-deleted)
    const totalResult = await db
      .prepare("SELECT COUNT(*) as n FROM robots WHERE deleted = 0")
      .first<{ n: number }>();
    const totalRobots = totalResult?.n ?? 0;

    // By tier
    const tierRows = await db
      .prepare(
        "SELECT verification_tier, COUNT(*) as n FROM robots WHERE deleted = 0 GROUP BY verification_tier"
      )
      .all<{ verification_tier: string; n: number }>();

    const byTier: Record<string, number> = {
      community: 0,
      verified: 0,
      manufacturer: 0,
      certified: 0,
    };
    for (const row of tierRows.results ?? []) {
      const tier = row.verification_tier ?? "community";
      byTier[tier] = (byTier[tier] ?? 0) + row.n;
    }

    // By status (active vs deleted)
    const statusRows = await db
      .prepare("SELECT deleted, COUNT(*) as n FROM robots GROUP BY deleted")
      .all<{ deleted: number; n: number }>();

    const byStatus = { active: 0, deleted: 0 };
    for (const row of statusRows.results ?? []) {
      if (row.deleted === 0) byStatus.active = row.n;
      else byStatus.deleted = row.n;
    }

    // Registered today (UTC date prefix match)
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const todayResult = await db
      .prepare(
        "SELECT COUNT(*) as n FROM robots WHERE registered_at LIKE ? AND deleted = 0"
      )
      .bind(`${today}%`)
      .first<{ n: number }>();
    const registeredToday = todayResult?.n ?? 0;

    return json({
      total_robots: totalRobots,
      by_tier: byTier,
      by_status: byStatus,
      registered_today: registeredToday,
    });
  } catch (err) {
    console.error("metrics error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};
