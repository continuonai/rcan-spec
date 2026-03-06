/**
 * rcan.dev — PATCH /api/v1/robots/:rrn/verify
 * Cloudflare Pages Functions (compatible with Cloudflare Workers)
 *
 * D1 database binding: DB (configured in wrangler.toml or Pages dashboard)
 *
 * Upgrades a robot's verification tier through the trust ladder:
 *   community → verified → certified → accredited
 *
 * Rules:
 *   - Must upgrade exactly one tier (no skipping)
 *   - All upgrades require evidence_url
 *   - certified → accredited is auto-approved (no manual review yet)
 *   - Authentication via Bearer token (same API key as robot owner)
 */

interface Env {
  DB: D1Database;
  RCAN_API_KEY_SALT?: string;
  RCAN_ADMIN_TOKEN?: string;
}

// Tier order — index defines rank
const TIERS = ["community", "verified", "certified", "accredited"] as const;
type Tier = (typeof TIERS)[number];

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
      "Access-Control-Allow-Methods": "PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

/** Extract Bearer token from Authorization header */
function bearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

/** SHA-256 hex of a string (for API key verification) */
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isTier(value: unknown): value is Tier {
  return typeof value === "string" && (TIERS as readonly string[]).includes(value);
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ── Schema setup ──────────────────────────────────────────────────────────────

async function ensureSchema(db: D1Database): Promise<void> {
  // Create verification_log if not exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS verification_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rrn TEXT NOT NULL,
      old_tier TEXT NOT NULL,
      new_tier TEXT NOT NULL,
      evidence_url TEXT NOT NULL,
      notes TEXT,
      verified_at TEXT DEFAULT (datetime('now')),
      verified_by TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_vlog_rrn ON verification_log(rrn);
  `);

  // Add columns to robots if they don't already exist (ALTER TABLE is idempotent via try/catch)
  for (const ddl of [
    "ALTER TABLE robots ADD COLUMN verification_tier TEXT DEFAULT 'community'",
    "ALTER TABLE robots ADD COLUMN evidence_url TEXT",
    "ALTER TABLE robots ADD COLUMN verified_at TEXT",
  ]) {
    try {
      await db.exec(ddl);
    } catch (e: any) {
      // SQLite: "duplicate column name" — column already exists, ignore
      if (!String(e).toLowerCase().includes("duplicate column")) throw e;
    }
  }
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
  if (method !== "PATCH") return err("Method not allowed — use PATCH /api/v1/robots/:rrn/verify", 405);

  // Auth
  const token = bearerToken(request);
  if (!token) return err("Authorization required — Bearer <api_key>", 401);

  const rawRrn = (params.rrn ?? "").toUpperCase();
  if (!rawRrn) return err("Missing RRN parameter", 400);

  // Parse request body
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return err("Request body must be valid JSON");
  }

  const { tier, evidence_url, notes } = body as {
    tier?: unknown;
    evidence_url?: unknown;
    notes?: unknown;
  };

  if (!isTier(tier)) {
    return err(`Invalid tier — must be one of: ${TIERS.join(", ")}`);
  }
  if (!evidence_url || typeof evidence_url !== "string" || !isValidUrl(evidence_url)) {
    return err("evidence_url is required and must be a valid URL");
  }
  if (notes !== undefined && typeof notes !== "string") {
    return err("notes must be a string if provided");
  }

  try {
    await ensureSchema(env.DB);

    // Look up the robot
    const robot = await env.DB.prepare(
      `SELECT id, rrn, api_key_hash, verification_tier
       FROM robots WHERE rrn = ? AND deleted = 0`
    )
      .bind(rawRrn)
      .first<{ id: number; rrn: string; api_key_hash: string; verification_tier: string | null }>();

    if (!robot) return err(`Robot not found: ${rawRrn}`, 404);

    // Verify API key (owner or admin)
    const keyHash = await sha256(token + (env.RCAN_API_KEY_SALT ?? "rcan-dev"));
    const isOwner = robot.api_key_hash === keyHash;
    const isAdmin = env.RCAN_ADMIN_TOKEN && token === env.RCAN_ADMIN_TOKEN;

    if (!isOwner && !isAdmin) return err("Invalid API key", 403);

    // Determine current tier (default to community if not set)
    const currentTierStr = robot.verification_tier ?? "community";
    const currentTier: Tier = isTier(currentTierStr) ? currentTierStr : "community";

    const currentIdx = TIERS.indexOf(currentTier);
    const targetIdx = TIERS.indexOf(tier);

    // Validate tier transition
    if (targetIdx <= currentIdx) {
      return err(
        `Cannot downgrade or re-verify same tier. Current: ${currentTier}, requested: ${tier}`,
        422
      );
    }
    if (targetIdx !== currentIdx + 1) {
      return err(
        `Tier skipping not allowed. Current: ${currentTier} → next valid tier: ${TIERS[currentIdx + 1]}`,
        422
      );
    }

    const now = new Date().toISOString();
    const verifiedBy = request.headers.get("CF-Connecting-IP") ?? "unknown";

    // For certified → accredited, flag as auto-approved (future: require manual review)
    // Currently auto-approves immediately.

    // Update robot record
    await env.DB.prepare(
      `UPDATE robots
       SET verification_tier = ?, evidence_url = ?, verified_at = ?, updated_at = ?
       WHERE id = ?`
    )
      .bind(tier, evidence_url, now, now, robot.id)
      .run();

    // Log the upgrade
    await env.DB.prepare(
      `INSERT INTO verification_log (rrn, old_tier, new_tier, evidence_url, notes, verified_at, verified_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(rawRrn, currentTier, tier, evidence_url, notes ?? null, now, verifiedBy)
      .run();

    // Fetch the updated robot record to return
    const updated = await env.DB.prepare(
      `SELECT rrn, manufacturer, model, version, device_id, rcan_uri,
              verification_tier, evidence_url, verified_at, description, registered_at, updated_at
       FROM robots WHERE id = ?`
    )
      .bind(robot.id)
      .first();

    return json({
      message: `Verification tier upgraded: ${currentTier} → ${tier}`,
      robot: updated,
    });
  } catch (e) {
    console.error("Verify error:", e);
    return err("Internal server error", 500);
  }
}
