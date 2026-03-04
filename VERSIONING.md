# RCAN Spec Versioning Policy

## Version Format

RCAN spec versions follow `MAJOR.MINOR.PATCH`:

| Component | Meaning | Example trigger |
|-----------|---------|-----------------|
| **MAJOR** | Breaking wire-format or semantic changes | Removing a message type, changing role level numbers, restructuring RURI format |
| **MINOR** | Additive, backwards-compatible changes | New optional message fields, new conformance level, new §16 sub-provision |
| **PATCH** | Clarifications, editorial fixes, no behaviour change | Fixing ambiguous prose, correcting a table, adding examples |

Current version: **v1.2** (MAJOR.MINOR; PATCH omitted when 0)

## Backwards Compatibility Guarantee

**Within a MAJOR version:** A v1.x implementation MUST be able to communicate with any other v1.y implementation.

Specifically:
- A v1.2 sender MUST produce messages that a v1.0 receiver can parse without error (it may ignore unknown optional fields)
- A v1.0 sender MUST produce messages that a v1.2 receiver accepts (it will apply defaults for new optional fields)
- New required fields are never added in MINOR versions — only in MAJOR

**Across MAJOR versions:** No compatibility guarantee. A v2.x implementation SHOULD be able to negotiate down to v1.x via the existing `rcan_version` field in manifests.

## Stability Tiers

| Tier | Guarantee | Current provisions |
|------|-----------|-------------------|
| **Stable** | No breaking changes without a MAJOR version bump; minimum 12 months deprecation notice | §1–§6 (RURI, RBAC, safety invariants, messaging, audit), §16 AI accountability |
| **Experimental** | May change in MINOR versions with 1 release notice | Federation protocol (v1.2), registry API format |
| **Deprecated** | Scheduled for removal; migration guide published | *(none currently)* |

## Deprecation Process

1. A provision is marked `[DEPRECATED as of vX.Y]` in the spec text
2. A migration guide is published in `docs/migration/`
3. The provision remains **Stable** (no breaking change) for a minimum of **2 minor versions** or **12 months**, whichever is longer
4. Removal only occurs in a MAJOR version bump

## Long-Term Support (LTS)

Every MAJOR version is supported with security fixes for a minimum of **3 years** from its initial release date.

| Version | Release | LTS Until | Status |
|---------|---------|-----------|--------|
| v1.x | 2026-01 | 2029-01 | ✅ Active LTS |

## What Changes Between Versions

### What will never change without a MAJOR bump
- Message type integer values (COMMAND=1, CONFIG=2, etc.)
- Role level numbers (GUEST=1 through CREATOR=5)
- RURI format (`rcan://registry/manufacturer/model/device-id`)
- Safety invariant semantics (local safety wins, graceful degradation, mandatory audit)
- §16.1 model identity fields in audit records
- Commitment chain HMAC structure

### What may change in MINOR versions (additive only)
- New optional message fields
- New message types (new integer values; old values never reused)
- New conformance test cases
- New optional RCAN YAML fields
- New robot profiles
- Federation protocol refinements (Experimental tier)

### What may change in PATCH versions
- Spec prose clarifications
- Example corrections
- Typo fixes
- Table formatting

## Version Discovery

A running RCAN implementation declares its spec version via:
- mDNS TXT record: `version=1.2.0`
- RCAN manifest: `rcan_version: "1.2.0"`
- Registry API: `api_version: "1.0"` (registry API versioned independently)

## Changelog

The full changelog is at [CHANGELOG.md](./CHANGELOG.md) in the spec repository.
The spec revision history is at [rcan.dev/spec/changelog](https://rcan.dev/spec).
