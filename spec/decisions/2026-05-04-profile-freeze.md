# RCAN Profile Freeze — 2026-05-04

**Status:** Accepted.
**Drives:** Section 8 of the OpenCastor Ecosystem Direction Design (2026-05-04).
**Closes drift:** rcan.dev "v1.3 Stable" / spec body "v3.2.0" / RRF docs "v2.2 §21" / various READMEs.

## Decision 1 — Canonical `protocol_version`

**Decision:** `protocol_version = 3.2.0`. Single canonical value for the matrix tuple field. `2.x` and `1.x` references retired.

**Rationale:** Memory-frozen ecosystem policy: "All new robot-md/RRF/ecosystem work must depend on RCAN 3.0+; 2.x frozen out." 3.2 is the highest minor with a published spec body and shipped SDKs (rcan-py 3.3.0, rcan-ts 3.4.1).

## Decision 2 — Message-type enum

**Decision:** Authoritative enum lives in `src/pages/spec/section-5.astro`. The set is: `INVOKE | INVOKE_RESULT | TELEMETRY | COMMITMENT | SAFE_STOP | ESTOP_PREEMPT | HEARTBEAT | KEY_ROTATE | REGISTRY_RESOLVE | REGISTRY_REGISTER`. SDK enums must round-trip-test against this list; CI fails if drift.

**Rationale:** Eliminates the rcan-py vs rcan-ts vs spec divergence flagged by the deep research report.

A pure-markdown mirror at `spec/sections/5-message-types.md` is a follow-up issue — when created, the Astro page imports from it as the source of truth.

## Decision 3 — Crypto profile

**Decision:** Adopt the existing `pqc-hybrid-v1` profile (defined in v2.3, hardened in v3.0) as the v3.2 freeze, with one v3.2-level refinement to verifier policy:

- **Entity identity records** (RRN/RCN/RMN/RHN/RAN): `pq_signing_pub` (ML-DSA-65, raw bytes base64-encoded — NIST FIPS 204) is REQUIRED. `signing_pub` (Ed25519, raw bytes base64-encoded) is OPTIONAL but RECOMMENDED during the migration window.
- **Signed envelopes** (matrix aggregates, version tuples, attestations, INVOKE/COMMITMENT messages): `signature_mldsa65` is REQUIRED. `signature_ed25519` is OPTIONAL.
- **Verifier policy (v3.2):** Verifier MUST verify `signature_mldsa65` against `pq_signing_pub`; reject if absent or invalid. If `signature_ed25519` is present, verifier MUST also verify it against `signing_pub`; reject if invalid. A signed envelope carrying ONLY `signature_mldsa65` is accepted; a signed envelope carrying ONLY `signature_ed25519` is rejected.
- **Registration rituals** (RAN/RCN/RMN/RRN/RHN POST endpoints): unchanged. Registration §2.2 still requires BOTH sig fields (`sig.ed25519`, `sig.ml_dsa`, `sig.ed25519_pub`) and verifies both. Registration is a stricter trust event than runtime envelope verification.

**Rationale:**

- Aligns with the v2.3+v3.0 normative spec (Ed25519-only sunset, ML-DSA-65 mandatory at L2+) rather than inventing a parallel "verify-either" policy.
- Empirical: deployed RRF entity records (e.g., `RMN-000000000004`) already carry only `pq_signing_pub` for the post-quantum field. Existing `verifyBody` (rcan-ts) is verify-both at registration time. Runtime verification of signed envelopes (where this decision applies) was previously unspecified — v3.2 fills that gap with PQ-required-classical-optional.
- Defense-in-depth posture during the transition window: an envelope MAY carry both signatures so verifiers without ML-DSA-65 support (legacy v2.x verifiers) can fall back to Ed25519 verification through the `signature_ed25519` field. This is forward-compat for them, not a verify-either weakening for v3.2 verifiers (who still treat ML-DSA-65 as the trust root).
- Ed25519 sunset path: v3.2 keeps classical optional. A future minor (v3.3 or v3.4) may drop classical entirely once verifiers have migrated.

**Implementation pointers:**

- Python signers: `cryptography` (Ed25519) + `quantcrypt` (ML-DSA-65, pure Python).
- TypeScript / Cloudflare Workers: `@noble/post-quantum` for ML-DSA-65; native `crypto.subtle` for Ed25519.
- Schema: every signed envelope (`version-tuple.schema.json`, matrix payload, attestation payload) declares `signature_mldsa65` REQUIRED, `signature_ed25519` OPTIONAL. Schema validators emit a warning (not an error) when `signature_ed25519` is absent so producers can audit their migration progress.
- Verification policy is enforced in `rcan-py` and `rcan-ts` SDK helpers — do NOT replicate the policy across each consumer. SDKs return a structured result `{ verified: true, pq_ok: true, classic_ok: true | false | "absent" }` so observability tooling can track classical signature attrition over time.
- New namespace: RAN (Robot Authority Number) covers non-robot, non-component, non-model identities (aggregators, release-signing tools, attestation services, policy authorities). Endpoints: `/v2/authorities/<ran>`, `/v2/authorities`, `/v2/authorities/register`. Defined in RRF PR #78.

## Decision 4 — JSON Schema draft

**Decision:** All RCAN-spec-owned schemas (including the new `version-tuple.json` for the compatibility matrix) target **JSON Schema 2020-12**. Existing `schemas/*.json` files using draft-07 are migrated in a follow-up issue (out of scope for this freeze).

**Rationale:** JSON Schema 2020-12 is the latest stable; mixing drafts in a single repo is a known source of validator-disagreement bugs.

## Decision 5 — §6 vs Safety Conformance invariant count

**Decision:** Spec §6 lists 18 Protocol-66 invariants; Safety Conformance test suite must run all 18. The "12 invariants" reference in §11.4 (or wherever the older count appears) is a draft remnant — replaced with a cross-reference to §6's table.

**Rationale:** Closes the count-discrepancy flagged by the research report.
