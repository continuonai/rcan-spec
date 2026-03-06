export const onRequestGet = () => Response.json({
  protocol: "rcan-sync/1.0",
  endpoint: "/api/v1/sync",
  methods: ["GET"],
  description: "RCAN registry sync endpoint — full implementation pending §17 spec",
  spec_ref: "https://rcan.dev/spec/#section-17"
});
