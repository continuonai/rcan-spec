# RCAN Profile Freeze — 2026-05-04

**Status:** Accepted.
**Drives:** Section 8 of the OpenCastor Ecosystem Direction Design (2026-05-04).
**Closes drift:** rcan.dev "v1.3 Stable" / spec body "v3.2.0" / RRF docs "v2.2 §21" / various READMEs.

## Decision 1 — Canonical `protocol_version`

**Decision:** `protocol_version = 3.2.0`. Single canonical value for the matrix tuple field. `2.x` and `1.x` references retired.

**Rationale:** Memory-frozen ecosystem policy: "All new robot-md/RRF/ecosystem work must depend on RCAN 3.0+; 2.x frozen out." 3.2 is the highest minor with a published spec body and shipped SDKs (rcan-py 3.3.0, rcan-ts 3.4.1).

## Decision 2 — Message-type enum

**Decision:** Authoritative enum lives in `spec/§5/message-types.md`. The set is: `INVOKE | INVOKE_RESULT | TELEMETRY | COMMITMENT | SAFE_STOP | ESTOP_PREEMPT | HEARTBEAT | KEY_ROTATE | REGISTRY_RESOLVE | REGISTRY_REGISTER`. SDK enums must round-trip-test against this list; CI fails if drift.

**Rationale:** Eliminates the rcan-py vs rcan-ts vs spec divergence flagged by the deep research report.

## Decision 3 — Crypto profile

**Decision:** `crypto_profile = hybrid-ed25519-mldsa65-2026` for v3.2 freeze. Every entity identity record (RRN/RCN/RMN/RHN/RAN) carries both `signing_pub` (Ed25519, raw public key bytes base64-encoded — matches rcan-ts convention) and `pq_signing_pub` (ML-DSA-65, raw base64). Every signed envelope (matrix, version-tuple, attestation) carries both `signature_ed25519` and `signature_mldsa65`. A verifier accepts when at least one signature verifies against the corresponding registered public key.

**Rationale:** Empirical reality (2026-05-01 RRF probe): the deployed registry already uses ML-DSA-65 for entity identity (e.g. `RMN-000000000004` exposes `pq_signing_pub` of ~600 chars). Locking Ed25519-only would either contradict deployed RRF or force a registry-side downgrade. Hybrid satisfies both: classic for back-compat with verifiers that don't have liboqs/quantcrypt yet, post-quantum for the long arc the RCAN spec is committing to (per spec §3 charter promising public-key infrastructure that outlives the company). Cost is ~2KB extra per entity record + ~3KB per signature envelope, which is negligible.

**Implementation pointers:**
- Python signers: `cryptography` (Ed25519) + `quantcrypt` (ML-DSA-65, pure Python, easy install).
- Cloudflare Workers / RRF: `@noble/post-quantum` for ML-DSA-65; native `crypto.subtle` for Ed25519.
- Schema: every signed envelope (`version-tuple.schema.json`, matrix payload, attestation payload) exposes dual signature fields.
- Verification policy: at least one signature must verify; both verifying is preferred and recorded in the verification result for downstream observability.
- New namespace: RAN (Robot Authority Number) covers non-robot, non-component, non-model identities (aggregators, release-signing tools, attestation services, policy authorities). Endpoints: `/v2/authorities/<ran>`, `/v2/authorities`, `/v2/authorities/register`. Defined in RRF PR #78 (merge tracker).

## Decision 4 — JSON Schema draft

**Decision:** All RCAN-spec-owned schemas (including the new `version-tuple.json` for the compatibility matrix) target **JSON Schema 2020-12**. Existing `schemas/*.json` files using draft-07 are migrated in a follow-up issue (out of scope for this freeze).

**Rationale:** JSON Schema 2020-12 is the latest stable; mixing drafts in a single repo is a known source of validator-disagreement bugs.

## Decision 5 — §6 vs Safety Conformance invariant count

**Decision:** Spec §6 lists 18 Protocol-66 invariants; Safety Conformance test suite must run all 18. The "12 invariants" reference in §11.4 (or wherever the older count appears) is a draft remnant — replaced with a cross-reference to §6's table.

**Rationale:** Closes the count-discrepancy flagged by the research report.
