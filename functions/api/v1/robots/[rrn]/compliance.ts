/**
 * rcan.dev — GET /api/v1/robots/:rrn/compliance
 * Cloudflare Pages Functions
 */

interface Env {
  DB: D1Database;
}

type ComplianceStatus = "compliant" | "provisional" | "non_compliant" | "no_fria";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}

function err(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
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

export function deriveComplianceStatus(
  fria: { overall_pass: number; prerequisite_waived: number } | null
): ComplianceStatus {
  if (!fria) return "no_fria";
  if (!fria.overall_pass) return "non_compliant";
  if (fria.prerequisite_waived) return "provisional";
  return "compliant";
}

export async function handleCompliance(
  rrn: string,
  _req: Request,
  env: Env
): Promise<Response> {
  const robot = await env.DB.prepare(
    `SELECT rrn, verification_tier FROM robots WHERE rrn = ? AND deleted = 0`
  )
    .bind(rrn)
    .first<{ rrn: string; verification_tier: string }>();

  if (!robot) return err(`Robot not found: ${rrn}`, 404);

  let friaRow: {
    submitted_at: string;
    sig_verified: number;
    annex_iii_basis: string;
    overall_pass: number;
    prerequisite_waived: number;
  } | null = null;

  try {
    friaRow = await env.DB.prepare(
      `SELECT submitted_at, sig_verified, annex_iii_basis, overall_pass, prerequisite_waived
       FROM fria_documents WHERE rrn = ? ORDER BY submitted_at DESC LIMIT 1`
    )
      .bind(rrn)
      .first();
  } catch {
    // fria_documents table may not exist yet
  }

  const complianceStatus = deriveComplianceStatus(friaRow);

  return json({
    rrn: robot.rrn,
    verification_tier: robot.verification_tier,
    fria: friaRow
      ? {
          submitted_at: friaRow.submitted_at,
          sig_verified: Boolean(friaRow.sig_verified),
          annex_iii_basis: friaRow.annex_iii_basis,
          overall_pass: Boolean(friaRow.overall_pass),
          prerequisite_waived: Boolean(friaRow.prerequisite_waived),
        }
      : null,
    compliance_status: complianceStatus,
    checked_at: new Date().toISOString(),
  });
}

export async function onRequest(context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
}): Promise<Response> {
  const { request, env, params } = context;
  const method = request.method.toUpperCase();
  const rrn = (params.rrn ?? "").toUpperCase();

  if (method === "OPTIONS") return cors();
  if (method !== "GET") return err("Method not allowed", 405);
  if (!rrn) return err("Missing RRN parameter", 400);

  try {
    return await handleCompliance(rrn, request, env);
  } catch (e) {
    console.error("Compliance handler error:", e);
    return err("Internal server error", 500);
  }
}
