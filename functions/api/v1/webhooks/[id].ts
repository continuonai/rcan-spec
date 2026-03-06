/**
 * rcan.dev Webhooks API — /api/v1/webhooks/:id
 *
 * POST /api/v1/webhooks/register  (id = "register")
 *   Delegates to handleRegister in index.ts
 *
 * DELETE /api/v1/webhooks/:id
 *   Auth: Bearer token (admin)
 *   Removes webhook registration by ID.
 */

import { verifyAdminAuth, handleRegister } from "./index.js";

interface Env {
  DB: D1Database;
  RCAN_ADMIN_TOKEN?: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
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
      "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

async function handleDelete(
  id: string,
  req: Request,
  env: Env
): Promise<Response> {
  if (!await verifyAdminAuth(req, env)) {
    return err("Authorization required", 401);
  }

  const numId = parseInt(id);
  if (isNaN(numId) || numId <= 0) {
    return err("Invalid webhook ID", 400);
  }

  const existing = await env.DB.prepare(
    `SELECT id, node_prefix, webhook_url FROM webhooks WHERE id = ?`
  )
    .bind(numId)
    .first<{ id: number; node_prefix: string; webhook_url: string }>();

  if (!existing) {
    return err(`Webhook not found: ${id}`, 404);
  }

  await env.DB.prepare(`DELETE FROM webhooks WHERE id = ?`)
    .bind(numId)
    .run();

  return json({
    message: "Webhook removed",
    id: numId,
    node_prefix: existing.node_prefix,
    webhook_url: existing.webhook_url,
  });
}

export async function onRequest(context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
}): Promise<Response> {
  const { request, env, params } = context;
  const method = request.method.toUpperCase();
  const id = params.id ?? "";

  if (method === "OPTIONS") return cors();

  try {
    // POST /api/v1/webhooks/register
    if (method === "POST" && id.toLowerCase() === "register") {
      return await handleRegister(request, env);
    }

    if (method === "DELETE") return await handleDelete(id, request, env);

    return err("Method not allowed", 405);
  } catch (e) {
    console.error("Webhooks [id] API error:", e);
    return err("Internal server error", 500);
  }
}
