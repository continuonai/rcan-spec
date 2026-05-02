# emit-version-tuple

Composite action that builds a version-tuple payload, hybrid-signs it (ML-DSA-65 required + optional Ed25519 per RCAN v3.2 Decision 3), wraps as an envelope, and uploads to the current GitHub release.

## Usage (hybrid — recommended)

```yaml
- uses: continuonai/rcan-spec/.github/actions/emit-version-tuple@v3.2.0
  with:
    project: robot-md
    ran: ${{ secrets.ROBOT_MD_RAN }}
    field: cli_version
    value: ${{ github.ref_name }}
    depends_on: '{"protocol_version":">=3.2.0","manifest_spec_version":"==1.5.0"}'
    pq_signing_key: ${{ secrets.ROBOT_MD_MLDSA65_PRIV }}
    pq_kid: ${{ secrets.ROBOT_MD_PQ_KID }}
    ed25519_signing_key: ${{ secrets.ROBOT_MD_ED25519_PRIV }}
    ed25519_kid: ${{ secrets.ROBOT_MD_KID }}
    release_tag: ${{ github.ref_name }}
```

## Usage (PQ-only)

Drop `ed25519_signing_key` and `ed25519_kid`. Envelope ships PQ-only; verifiers resolve `signing_pub: null` on the RAN and skip classical verification.

## Output

For each call, attaches `version-tuple-envelope-<field>.json` to the GitHub release (e.g. `version-tuple-envelope-cli_version.json` for a `cli_version` assertion). Aggregated daily by `opencastor-ops/monitor/version_matrix.py` after PQ verification (and classical if present) against `/v2/authorities/<ran>`.

A project that asserts multiple fields (e.g. `cli_version` + `manifest_spec_version`) calls the action once per field; each call produces its own file.

Schemas:
- Payload: `schemas/version-tuple.json`
- Envelope: `schemas/version-tuple-envelope.json`
