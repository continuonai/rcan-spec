/**
 * rcan.dev Registration API — POST /api/v1/robots
 * Cloudflare Pages Functions (compatible with Cloudflare Workers)
 *
 * D1 database binding: DB (configured in wrangler.toml or Pages dashboard)
 *
 * Endpoints:
 *   POST   /api/v1/robots          Register a new robot (mint RRN)
 *   GET    /api/v1/robots          List robots (paginated, optional search)
 *   GET    /api/v1/robots/:rrn     Get single robot by RRN
 *   PATCH  /api/v1/robots/:rrn     Update robot metadata (auth required)
 *   DELETE /api/v1/robots/:rrn     Soft-delete (auth required)
 */

interface Env {
  DB: D1Database;
  RCAN_API_KEY_SALT?: string;     // for hashing API keys
  RCAN_ADMIN_TOKEN?: string;      // for admin operations
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Cache-Control": status === 200 && typeof data === "object" && (data as any).rrn
        ? "public, max-age=60, stale-while-revalidate=300"
        : "no-store",
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
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

/** Generate a 12-digit padded RRN from sequential id */
function formatRRN(id: number): string {
  return `RRN-${String(id).padStart(12, "0")}`;
}

/** SHA-256 hex of a string (for API key hashing) */
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Generate a random API key token */
function generateApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return "rcan_" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Normalize a slug (lowercase, alphanumeric + hyphens) */
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 64);
}

/** Validate RCAN URI format */
function validateUri(manufacturer: string, model: string, version: string, deviceId: string): string {
  return `rcan://registry.rcan.dev/${slugify(manufacturer)}/${slugify(model)}/${slugify(version)}/${slugify(deviceId)}`;
}

/** Extract Bearer token from Authorization header */
function bearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

// ── DB Schema (applied via D1 migration) ──────────────────────────────────────
// CREATE TABLE IF NOT EXISTS robots (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   rrn TEXT UNIQUE NOT NULL,
//   manufacturer TEXT NOT NULL,
//   model TEXT NOT NULL,
//   version TEXT NOT NULL,
//   device_id TEXT NOT NULL,
//   rcan_uri TEXT NOT NULL,
//   verification_tier TEXT NOT NULL DEFAULT 'community',
//   description TEXT DEFAULT '',
//   contact_email TEXT DEFAULT '',
//   source TEXT DEFAULT '',
//   api_key_hash TEXT,
//   registered_at TEXT NOT NULL,
//   updated_at TEXT NOT NULL,
//   deleted INTEGER NOT NULL DEFAULT 0
// );
// CREATE INDEX IF NOT EXISTS idx_robots_manufacturer ON robots(manufacturer);
// CREATE INDEX IF NOT EXISTS idx_robots_tier ON robots(verification_tier);

// ── Route handlers ─────────────────────────────────────────────────────────────

async function handleRegister(req: Request, env: Env): Promise<Response> {
  let body: Record<string, string>;
  try {
    body = await req.json() as Record<string, string>;
  } catch {
    return err("Request body must be valid JSON");
  }

  const { manufacturer, model, version, device_id, description = "", contact_email = "", source = "" } = body;

  if (!manufacturer || !model || !version || !device_id) {
    return err("Required fields: manufacturer, model, version, device_id");
  }

  // Slug-validate
  const sluggedManufacturer = slugify(manufacturer);
  const sluggedModel = slugify(model);
  const sluggedVersion = slugify(version);
  const sluggedDeviceId = slugify(device_id);

  if (!sluggedManufacturer || !sluggedModel || !sluggedVersion || !sluggedDeviceId) {
    return err("Fields must contain valid characters (a-z, 0-9, hyphens)");
  }

  const rcanUri = validateUri(sluggedManufacturer, sluggedModel, sluggedVersion, sluggedDeviceId);
  const now = new Date().toISOString();

  // Check for duplicate device
  const existing = await env.DB.prepare(
    "SELECT rrn FROM robots WHERE manufacturer = ? AND model = ? AND version = ? AND device_id = ? AND deleted = 0"
  ).bind(sluggedManufacturer, sluggedModel, sluggedVersion, sluggedDeviceId).first<{ rrn: string }>();

  if (existing) {
    return json({
      rrn: existing.rrn,
      rcan_uri: rcanUri,
      message: "Robot already registered",
      already_existed: true,
    }, 200);
  }

  // Generate API key
  const rawApiKey = generateApiKey();
  const apiKeyHash = await sha256(rawApiKey + (env.RCAN_API_KEY_SALT ?? "rcan-dev"));

  // Insert
  const result = await env.DB.prepare(
    `INSERT INTO robots
      (manufacturer, model, version, device_id, rcan_uri, verification_tier,
       description, contact_email, source, api_key_hash, registered_at, updated_at, deleted)
     VALUES (?, ?, ?, ?, ?, 'community', ?, ?, ?, ?, ?, ?, 0)`
  ).bind(
    sluggedManufacturer, sluggedModel, sluggedVersion, sluggedDeviceId,
    rcanUri, description, contact_email, source, apiKeyHash, now, now
  ).run();

  if (!result.success) {
    return err("Registration failed — please try again", 500);
  }

  // Get the new row id to format RRN
  const newRow = await env.DB.prepare(
    "SELECT id FROM robots WHERE rcan_uri = ? ORDER BY id DESC LIMIT 1"
  ).bind(rcanUri).first<{ id: number }>();

  const rrn = formatRRN(newRow!.id);

  // Update RRN now that we have the id
  await env.DB.prepare("UPDATE robots SET rrn = ? WHERE id = ?").bind(rrn, newRow!.id).run();

  return json({
    rrn,
    rcan_uri: rcanUri,
    manufacturer: sluggedManufacturer,
    model: sluggedModel,
    version: sluggedVersion,
    device_id: sluggedDeviceId,
    verification_tier: "community",
    registered_at: now,
    api_key: rawApiKey,   // shown once — not stored in plaintext
    message: "Robot registered successfully",
  }, 201);
}

async function handleList(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);

  // Support both offset-based (?limit=&offset=) and page-based (?page=&limit=) pagination.
  // Offset takes precedence when supplied explicitly.
  const rawLimit = parseInt(url.searchParams.get("limit") ?? "20");
  const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 20 : rawLimit));

  let offset: number;
  if (url.searchParams.has("offset")) {
    // Explicit offset param (v1.2 offset-based pagination)
    const rawOffset = parseInt(url.searchParams.get("offset") ?? "0");
    offset = Math.max(0, isNaN(rawOffset) ? 0 : rawOffset);
  } else {
    // Legacy page-based pagination — backwards-compatible default
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
    offset = (page - 1) * limit;
  }

  const search = url.searchParams.get("q")?.trim() ?? "";
  const tier = url.searchParams.get("tier")?.trim() ?? "";
  const manufacturer = url.searchParams.get("manufacturer")?.trim() ?? "";

  let whereClause = "deleted = 0";
  const params: (string | number)[] = [];

  if (search) {
    whereClause += " AND (manufacturer LIKE ? OR model LIKE ? OR rrn LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (tier) {
    whereClause += " AND verification_tier = ?";
    params.push(tier);
  }
  if (manufacturer) {
    whereClause += " AND manufacturer = ?";
    params.push(slugify(manufacturer));
  }

  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM robots WHERE ${whereClause}`
  ).bind(...params).first<{ total: number }>();

  const rows = await env.DB.prepare(
    `SELECT rrn, manufacturer, model, version, device_id, rcan_uri,
            verification_tier, description, registered_at
     FROM robots WHERE ${whereClause}
     ORDER BY id DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  const total = countResult?.total ?? 0;
  const nextOffset = offset + limit < total ? offset + limit : null;
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return json({
    robots: rows.results,
    total,
    limit,
    offset,
    next_offset: nextOffset,
    // Legacy pagination fields preserved for backwards compatibility
    pagination: {
      page,
      limit,
      total,
      total_pages: totalPages,
      has_next: nextOffset !== null,
      has_prev: offset > 0,
    },
  });
}

async function handleGet(rrn: string, env: Env): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT rrn, manufacturer, model, version, device_id, rcan_uri,
            verification_tier, description, registered_at, updated_at
     FROM robots WHERE rrn = ? AND deleted = 0`
  ).bind(rrn.toUpperCase()).first();

  if (!row) return err(`Robot not found: ${rrn}`, 404);
  return json(row);
}

async function handleUpdate(rrn: string, req: Request, env: Env): Promise<Response> {
  const token = bearerToken(req);
  if (!token) return err("Authorization required", 401);

  const keyHash = await sha256(token + (env.RCAN_API_KEY_SALT ?? "rcan-dev"));
  const robot = await env.DB.prepare(
    "SELECT id, api_key_hash FROM robots WHERE rrn = ? AND deleted = 0"
  ).bind(rrn.toUpperCase()).first<{ id: number; api_key_hash: string }>();

  if (!robot) return err(`Robot not found: ${rrn}`, 404);
  if (robot.api_key_hash !== keyHash) return err("Invalid API key", 403);

  let body: Record<string, string>;
  try {
    body = await req.json() as Record<string, string>;
  } catch {
    return err("Request body must be valid JSON");
  }

  const allowedFields = ["description", "contact_email"];
  const updates: string[] = [];
  const values: string[] = [];

  for (const field of allowedFields) {
    if (field in body) {
      updates.push(`${field} = ?`);
      values.push(body[field]);
    }
  }

  if (updates.length === 0) return err("No updatable fields provided");
  updates.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(String(robot.id));

  await env.DB.prepare(
    `UPDATE robots SET ${updates.join(", ")} WHERE id = ?`
  ).bind(...values).run();

  return handleGet(rrn, env);
}

async function handleDelete(rrn: string, req: Request, env: Env): Promise<Response> {
  const token = bearerToken(req);
  if (!token) return err("Authorization required", 401);

  const keyHash = await sha256(token + (env.RCAN_API_KEY_SALT ?? "rcan-dev"));
  const robot = await env.DB.prepare(
    "SELECT id, api_key_hash FROM robots WHERE rrn = ? AND deleted = 0"
  ).bind(rrn.toUpperCase()).first<{ id: number; api_key_hash: string }>();

  if (!robot) return err(`Robot not found: ${rrn}`, 404);
  if (robot.api_key_hash !== keyHash) {
    // Allow admin token too
    const adminToken = env.RCAN_ADMIN_TOKEN;
    if (!adminToken || token !== adminToken) return err("Invalid API key", 403);
  }

  await env.DB.prepare(
    "UPDATE robots SET deleted = 1, updated_at = ? WHERE id = ?"
  ).bind(new Date().toISOString(), robot.id).run();

  return json({ message: "Robot registration removed", rrn });
}

// ── Main handler (Cloudflare Pages Functions format) ────────────────────────

export async function onRequest(context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
}): Promise<Response> {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);

  // CORS preflight
  if (method === "OPTIONS") return cors();

  // Rate limit hint (Cloudflare WAF handles actual rate limiting)
  const path = url.pathname;

  try {
    // /api/v1/robots/:rrn — single robot operations (supports 8-16 digit sequences, optional alphanumeric prefix)
    const rrnMatch = path.match(/\/api\/v1\/robots\/(RRN(?:-[A-Z0-9]{2,8})?-\d{8,16})(?:\/.*)?$/i);
    if (rrnMatch) {
      const rrn = rrnMatch[1].toUpperCase();
      if (method === "GET") return await handleGet(rrn, env);
      if (method === "PATCH") return await handleUpdate(rrn, request, env);
      if (method === "DELETE") return await handleDelete(rrn, request, env);
      return err("Method not allowed", 405);
    }

    // /api/v1/robots — collection operations
    if (path.endsWith("/api/v1/robots") || path.endsWith("/api/v1/robots/")) {
      if (method === "GET") return await handleList(request, env);
      if (method === "POST") return await handleRegister(request, env);
      return err("Method not allowed", 405);
    }

    return err("Not found", 404);
  } catch (e) {
    console.error("API error:", e);
    return err("Internal server error", 500);
  }
}
