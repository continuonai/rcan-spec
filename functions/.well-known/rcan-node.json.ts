export const onRequest = () => {
  const manifest = {
    rcan_node_version: "1.0",
    node_type: "root",
    operator: "Robot Registry Foundation",
    namespace_prefix: "RRN",
    // In production, set this to your robot node's actual Ed25519 public key (e.g. "ed25519:<base58-encoded-key>").
    // For demo/reference deployments this is left null. Configure via environment variable or deployment config.
    public_key: null,
    // PQC profile fields (RCAN v2.3+)
    crypto_profile: "pqc-hybrid-v1",
    pqc_public_key: null,      // base64url-encoded ML-DSA-65 public key (1952 bytes). Null in demo deployments.
    ed25519_public_key: null,  // base64url-encoded Ed25519 public key (32 bytes). Null in demo deployments.
    api_base: "https://rcan.dev/api/v1",
    registry_ui: "https://rcan.dev/registry/",
    spec_version: "2.3",
    capabilities: ["register", "resolve", "verify", "delegate"],
    sync_endpoint: "https://rcan.dev/api/v1/sync",
    last_sync: new Date().toISOString(),
    ttl_seconds: 3600,
    contact: "registry@rcan.dev",
    governance: "https://rcan.dev/governance/",
    federation_protocol: "https://rcan.dev/federation/"
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*"
    }
  });
};
