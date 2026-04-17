/**
 * rcan.dev / robotregistryfoundation.org — /api/v1/robots/:rrn/manifest
 *
 * Stores and serves a robot's signed ROBOT.md file.
 *
 * STATUS: Scaffolded placeholder (v0.1 — 2026-04-17).
 *
 * This endpoint is the registry-side half of the `robot-md register` CLI
 * flow planned for ROBOT.md v0.2 (see https://github.com/RobotRegistryFoundation/robot-md
 * SECURITY.md → "Known v0.1 Limitations" for the full trust model).
 *
 * Planned v0.2 behaviour:
 *   GET   /api/v1/robots/:rrn/manifest
 *     → 200 with the raw ROBOT.md body (Content-Type: text/markdown) plus
 *       X-Manifest-Signature header (Ed25519 or pqc-hybrid-v1 base64).
 *     → 404 if no manifest has been uploaded for this RRN.
 *     → Response includes CORS so third-party validators can fetch it.
 *
 *   PUT   /api/v1/robots/:rrn/manifest
 *     → Body: raw ROBOT.md text.
 *     → Headers:
 *         Content-Type: text/markdown
 *         X-Manifest-Signature: base64(sig)
 *         X-Manifest-Key-Fingerprint: sha256:<hex>
 *         Authorization: Bearer <rrn-owner-token>
 *     → Server validates: (1) schema pass, (2) signature valid under the
 *       public key registered for this RRN, (3) caller owns the RRN.
 *     → 201 Created on first upload, 200 OK on update, 401/403 on auth
 *       failure, 422 on schema/signature failure.
 *
 * The v0.2 commit that replaces this placeholder ships together with the
 * `robot-md sign` CLI verb, the `robot_manifests` D1 table, and the spec
 * update that adds `metadata.signature` and `metadata.key_fingerprint`
 * fields to the ROBOT.md frontmatter.
 */

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface Env {}

function cors(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Manifest-Signature, X-Manifest-Key-Fingerprint",
    },
  });
}

function notImplemented(method: string): Response {
  return new Response(
    JSON.stringify({
      error: "not_implemented",
      method,
      status: "planned",
      target_release: "robot-md v0.2",
      spec: "https://robotmd.dev/spec/v1",
      security_model:
        "https://github.com/RobotRegistryFoundation/robot-md/blob/main/SECURITY.md#known-v01-limitations",
      repo: "https://github.com/RobotRegistryFoundation/robot-md",
      note:
        "Manifest storage + signed retrieval ships in ROBOT.md v0.2. " +
        "Until then, publish your ROBOT.md at a URL you control and reference " +
        "it from the registry's robot record. See the v0.2 design plan in the repo.",
    }),
    {
      status: 501,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "X-Robot-Md-Status": "v0.1-placeholder",
      },
    }
  );
}

export async function onRequest(
  context: EventContext<Env, "rrn", unknown>
): Promise<Response> {
  const method = context.request.method;

  if (method === "OPTIONS") return cors();
  if (method === "GET" || method === "PUT") return notImplemented(method);

  return new Response(
    JSON.stringify({ error: "method_not_allowed", method, allowed: ["GET", "PUT", "OPTIONS"] }),
    {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Allow": "GET, PUT, OPTIONS",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
