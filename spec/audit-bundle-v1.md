# RCAN Audit Bundle v1.0

A single signed envelope wrapping every artifact a robot needs to make a Pattern-4 (Regulated Deployment) compliance claim — cert reports, EU AI Act §22-26 packets, version snapshots — for one robot at one point in time.

## Why nested signatures?

The bundle has two layers of signatures:

1. **Each artifact carries its own signature.** A cert-l1-l4 report is signed by the rcan-spec release key; an eu-act-fria packet is signed by the robot-md release key emitting it; a version-matrix-snapshot is signed by the opencastor-ops aggregator key. **An offline reviewer can replay any single artifact without trusting the bundle aggregator.**
2. **The bundle as a whole is signed by the aggregator.** A reviewer who trusts the aggregator key can verify the bundle's contents without re-resolving every inner signing key against RRF.

This design lets the bundle be replayed in two modes:
- **Strict** — verify every inner artifact against its registered key (slow; offline-replayable).
- **Aggregator-trust** — verify only the bundle signature (fast; assumes the aggregator did the strict work at sign time).

## Canonical JSON serialization

Signatures cover the canonical JSON of the parent object minus the signature field itself.

Canonicalization rules (per `fixtures/canonical-json-v1.json`):
1. UTF-8 encoding.
2. Object keys sorted lexicographically (Unicode code-point order).
3. No unnecessary whitespace.
4. Whole-number floats normalized to integers (e.g. `50.0` → `50`) for cross-language parity with rcan-ts.
5. Strings escaped per RFC 8259, no extra whitespace.
6. Arrays preserve member order.
7. Non-ASCII Unicode emitted as raw UTF-8 bytes (no `\uXXXX` escapes).

This matches RFC 8785 (JSON Canonicalization Scheme) with the rcan-ts/rcan-py whole-number-float normalization. Both SDKs emit byte-identical canonical JSON.

## Artifact-type registry

The `artifact_type` enum is a closed set in v1.0. Adding a type requires a v1.1 MINOR schema bump (which keeps backward compat — old verifiers ignore unknown types).

| Type | Source | Schema version field meaning |
|---|---|---|
| `cert-l1-l4` | continuonai/rcan-spec conformance suite | rcan-spec spec version |
| `cert-gateway-authority` | robot-md-gateway tests/cert/ | gateway-authority report schema |
| `cert-hil-runtime` | rig owner + witness key | hil-runtime report schema |
| `eu-act-fria` | robot-md emit-fria | EU AI Act §22 packet schema |
| `eu-act-safety-benchmark` | robot-md emit-safety-benchmark | §23 |
| `eu-act-ifu` | robot-md emit-ifu | §24 |
| `eu-act-incident-report` | robot-md emit-incident-report | §25 |
| `eu-act-eu-register` | robot-md emit-eu-register | §26 |
| `version-tuple` | per-repo release CI | matrix-version |
| `version-matrix-snapshot` | opencastor-ops aggregator | matrix-version |

## What this bundle is not

- **Not a regulatory filing.** Per spec §10, RRF intake produces *evidence*; per-jurisdiction sufficiency is a separate question.
- **Not a certification.** Conformance is self-asserted; bundles enable independent replay, not third-party audit (spec §10).
- **Not a substitute for the artifacts.** A bundle without intact inner signatures is not a bundle.

## Verifying a bundle (recipe)

```python
from rcan.audit_bundle import VerifyMode, verify_bundle

result = verify_bundle(
    bundle_json,
    mode=VerifyMode.STRICT,
    kid_to_pem={"my-kid": pem_bytes},
)
# result.bundle_signature_ok: bool
# result.artifact_results: list[ArtifactVerificationResult]
# result.all_ok: bool
```

A `STRICT` verify resolves every inner kid against RRF (or a local key cache). An `AGGREGATOR_TRUST` verify only checks the bundle's outer signature.

## Future versions

- v1.1 — adds new `artifact_type` enum values; backward-compatible.
- v2.0 — adds ML-DSA hybrid algorithm in `signature.alg`; coordinates with rcan-spec crypto-profile decision.
