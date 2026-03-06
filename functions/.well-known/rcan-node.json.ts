export const onRequest = () => {
  const manifest = {
    rcan_node_version: "1.0",
    node_type: "root",
    operator: "Robot Registry Foundation",
    namespace_prefix: "RRN",
    public_key: "ed25519:placeholder-will-be-set-when-keypair-generated",
    api_base: "https://rcan.dev/api/v1",
    registry_ui: "https://rcan.dev/registry/",
    spec_version: "1.2",
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
