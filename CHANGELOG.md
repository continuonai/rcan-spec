# RCAN Spec Changelog

## [2.2.1] - 2026-03-28

### Added
- §21.2.2 Multi-Type Entity Numbering — formal specification of RRN/RCN/RMN/RHN
  numbering scheme; all use `{PREFIX}-{000000000001..999999999999}` format;
  sequential, registry-assigned, globally unique across all entity types


## [1.9.0] - 2026-03-21
### Added
- Castor Credits protocol — full reference for CONTRIBUTE scope (credit grants, badge tiers, payout schema)
- RCAN Foundation governance framework page
- Competition formats reference (Sprint, Threshold Race, Model×Hardware Brackets)
- "See also" link in MessageType section pointing to Credits protocol

---

## v1.6.3 — 2026-03-18

### Summary
Adds §2.8 Multi-Participant Mission Threads (R2R2H) with full multi-human enterprise support. Formalizes the data model, fanout dispatch protocol, scope invariants, @mention handling, human role hierarchy, and audit requirements for multi-robot, multi-human group mission sessions.

### Added

#### §2.8 — Multi-Participant Mission Threads (R2R2H)
- A **Mission** is a scoped conversation context shared by one or more robots and zero or more human principals
- **§2.8.1** Mission commands MUST include `mission_id`, `participants` (RRN list), and `context: "mission_thread"`
- **§2.8.2** Mission scope is `chat` by default; robots MUST NOT escalate scope; P66 invariants apply independently per robot
- **§2.8.3** After processing, robot MUST write response to `missions/{id}/messages/`; fanout is bridge coordinator's responsibility
- **§2.8.4** Robots in `mentions[]` SHOULD prioritize responding; unmentioned robots MAY respond; advisory only
- **§2.8.5** Human Role Hierarchy: `owner > operator > observer`; only owner/operator may dispatch robot commands; observer is read-only; fanout scope capped by sender role (non-escalation §2.7); owner role assigned at creation only
- **§2.8.6** Multi-Human Audit: all messages retained; `from_role` on every human message; deletion requires owner role; `participant_uids` flat array for efficient Firestore queries; `mission_invites` subcollection is permanent audit record
- New Astro doc page: `/docs/missions`
- New Cloud Functions: `inviteToMission`, `joinMission`

---

## v1.6.2 — 2026-03-18

### Summary
Patch release closing the gap between RCAN v1.6 and OpenCastor channel/agent implementation. Adds formal spec for channel-layer scope assignment and multi-hop scope propagation. No changes to message type integers, wire formats, or existing section numbering.

### Added

#### §2.6 — Channel-Layer Scope Assignment
- Implementations receiving commands via messaging channels (WhatsApp, Telegram, Slack, Signal, etc.) MUST assign `rcan_scope` at the channel boundary before command processing
- **Scope resolution table** (priority order): Owner/admin → `chat` (loa=1); Allowlisted → `chat` (loa=0); Robot peer (RRN) → `status` (loa=0); Pairing/unverified → `discover` (loa=0); Unknown → Block
- **§2.6.2** `/api/chat` endpoint MUST enforce `sender_scope` ≤ `chat`; any higher claim silently downgraded and logged
- **§2.6.3** `sender_scope` + `sender_loa` SHOULD be included in inbound message metadata
- New config key: `rcan_protocol.channel_admin_scope` for operator override above `chat`

#### §2.7 — Multi-Hop Scope Propagation
- Formalizes non-escalation invariant for R2R delegation chains: `scope_level(C) ≤ scope_level(B) ≤ scope_level(A)` for any A → B → C chain
- **§2.7.2** Delegated commands MUST carry `originating_scope` + `delegated_scope` fields alongside the existing `delegation_chain` (§12); `delegated_scope` MUST be ≤ `originating_scope`
- **§2.7.3** Reference action allowlist per scope level for sub-agent action filtering (vetoed by safety/guardian layer)
- Scope level ordering: `discover` < `status` < `chat` < `control` < `system` < `safety`

### Notes
- §2.6–2.7 are additive; existing §2.1–2.5 and all other sections are unchanged
- §4 (mDNS Discovery) is unaffected; new sections placed in §2 (RBAC) where scope is defined

---

## v1.6.1 — 2026-03-17

### Summary
Maintenance release finalizing the v1.6 spec. Adds EU AI Act compliance templates, CONFIG_SHARE RFC, and R2RAM implementation reference. No changes to message types, wire formats, or protocol semantics.

### Added
- **EU AI Act compliance templates**: conformance checklists and documentation templates for RCAN deployments subject to EU AI Act requirements.
- **CONFIG_SHARE RFC**: formal specification for the CONFIG_SHARE protocol used by OpenCastor Community Hub (robot profile sharing, version pinning, config discovery).
- **R2RAM implementation reference**: reference implementation notes for Robot-to-Robot Access Model (R2RAM) — covers role mapping, scope enforcement, and cross-registry consent flows.
- **OpenCastor 2026.3.17.13 conformance**: verified 100/100 conformance score against v1.6 spec; referenced in ecosystem registry.

### Metadata
- `package.json`: `version` bumped from `1.0.0` → `1.6.1`
- Ecosystem registry (`opencastor-ops/config/repos.json`): `rcan_spec_version` updated to `"1.6"`

---

## v1.6.0 — 2026-03-16

### Summary
4 gaps addressed from the v1.6 backlog (all deferred from v1.5 due to complexity). No breaking changes to existing v1.5 features. No new MessageType integers (types remain 1–31). Three existing message types gain extended payload schemas.

### New Spec Pages

#### §5.4 — Multi-Modal Payloads (GAP-18) `multimodal.astro`
- `media_chunks[]` array field on `RCANMessage` envelope: `{chunk_id, mime_type, encoding, hash_sha256, size_bytes, data_b64?, ref_url?, ref_expires?}`
- **Inline mode** (base64): for payloads < 64 KB; data embedded in message JSON
- **Reference mode** (ref_url): for large payloads; robot hosts at `GET /api/v1/media/{chunk_id}`; URL is HMAC-signed, 5-minute TTL
- **CommitmentRecord extension**: `media_hashes: {chunk_id: sha256}` included in HMAC chain — audit trail proves exactly what binary data was sent
- **Streaming mode**: `SENSOR_DATA` gains `stream_id`, `chunk_index`, `is_final` fields for continuous video streams
- **TRAINING_DATA deprecation**: JSON-only binary in `payload` deprecated in v1.6; triggers WARNING audit event. All image/video/audio training data MUST use `media_chunks[]`. JSON-only rejection planned for v1.7.
- **Size limits by transport**: HTTP=64MB, Compact=512KB (ref only), Minimal=not supported

#### §8.7 — Registry Trust Anchors and Identity Verification (GAP-14) `identity.astro`
- **Level of Assurance (LoA)**: 1 (anonymous/pseudonymous), 2 (email verified), 3 (government ID / hardware token)
- `loa: 1|2|3` required field in all JWT claims from v1.6; backward compat defaults: authoritative→2, community→1
- `registry_tier: "root"|"authoritative"|"community"` on registry identity records
- Root registry: manages trust anchors; signs authoritative registry keys; example: RRF (rcan.dev)
- Authoritative registry: verified by root; can issue LoA 2/3 JWTs; must pass annual audit
- Community registry: self-signed; can only issue LoA 1 JWTs; robots MAY reject LoA 1 for control commands
- **Trust anchor discovery**: `_rcan-registry.<domain>` DNSSEC TXT → `v=rcan1; tier=...; kfp=sha256:...`
- **Recommended enforcement**: require LoA ≥ 2 for `control` scope, LoA ≥ 3 for `safety` scope
- **Hardware token support**: FIDO2/WebAuthn binding to JWT; `fido2_credential_id` field on identity records
- **Protocol 66 integration**: `min_loa_for_control: int` field in P66 manifest; default 1 (backward compat)

#### §18 — Registry Federation Protocol (GAP-16) `federation.astro`
- **FEDERATION_SYNC (type 12) full payload spec**: `{source_registry, target_registry, sync_type: "consent"|"revocation"|"key", payload, signature, federation_id, timestamp, expires_at}`
- `sync_type: "consent"`: portable ConsentRecord format accepted by both registries; `owner_signature` self-verifying
- `sync_type: "revocation"`: cross-registry ROBOT_REVOCATION propagation
- `sync_type: "key"`: JWKS key sync for cross-registry JWT verification
- **Cross-registry JWT trust chains**: DNSSEC → JWKS → root signature → JWT verification (7-step flow documented)
- **Trust anchor discovery**: `_rcan.<registry-domain>` DNSSEC TXT → registry public key fingerprint + root signature
- **Registry tiers** on registry records: `"root" | "authoritative" | "community"`
- **Cross-registry ESTOP propagation**: ESTOP always accepted; RESUME requires verified consent + local owner ack
- **12-step federation flow**: Alice (reg-1) → consent request → Robot B (reg-2) → complete sequence diagram
- **Protocol 66 integration**: `federation_enabled: bool`, `trusted_registries: []`, `min_loa_for_control: int` in manifest

#### §19 — Constrained Transport Encoding (GAP-17) `constrained-transport.astro`
- **Three transport tiers**: RCAN-HTTP (full JSON, 64KB), RCAN-Compact (CBOR, 512B), RCAN-Minimal (32-byte binary)
- **RCAN-Compact**: CBOR encoding, mandatory field abbreviations (`t`=type, `i`=msg_id, `ts`=timestamp, `f`=from, `to`=to, `s`=scope bitmask, `p`=payload, `sig`=signature, `q`=qos, `pr`=priority); scope as bitmask; Content-Type: `application/rcan+cbor`
- **Byte budgets**: ESTOP < 200 bytes, STATUS < 512 bytes
- **RCAN-Minimal**: Fixed 32-byte binary frame — `[2B type][8B RRN-from compressed][8B RRN-to compressed][4B timestamp-unix32][8B sig-truncated][2B CRC-16]`
- Only ESTOP (type 6) and ACK (type 17) supported in RCAN-Minimal
- **LoRa SF12**: ~250 bps → 32 bytes = ~1s transmit time; fits in single LoRa frame at all standard SF settings
- **BLE L2CAP framing**: MTU 251 bytes; 4-byte fragment header `[flags][frag_index][total_length_uint16]`; RCAN service UUID defined
- **Transport negotiation**: DISCOVER response gains `supported_transports: ["http", "compact", "minimal", "ble"]`
- **Security note**: RCAN-Minimal truncated 8-byte signature is NOT for high-value commands; ESTOP only
- **Protocol 66 integration**: `supported_transports: string[]` in P66 manifest

### Updates to Existing Pages
- **`messages.astro`**: FEDERATION_SYNC (type 12) updated with full protocol reference and corrected QoS=1; TRAINING_DATA (type 10) notes v1.6 deprecation of JSON-only binary; DISCOVER (type 9) notes `supported_transports` field; v1.6 changes callout added
- **`index.astro`**: New "v1.6 Features" navigation section with links to all 4 new pages + v1.6 badges
- **`safety.astro`**: Protocol 66 manifest gains 3 new v1.6 fields: `min_loa_for_control` (default 1), `federation_enabled` (default false), `supported_transports` (default ["http"]); complete v1.6 manifest example

### Metadata
- `public/sdk-status.json`: spec_version updated to "1.6"; SDK versions updated to 0.6.0
- `public/compatibility.json`: v1.6 entry added; v1.5 status updated to "maintained"

### No New MessageType Integers
v1.6 extends existing types without adding new integers. The canonical v1.5 table (types 1–31) remains unchanged.

### SDK Compatibility
- rcan-py >= 0.6.0
- rcan-ts >= 0.6.0
- OpenCastor >= 2026.4.x

---

## v1.5.0 — 2026-03-16

### Summary
18 gaps addressed from the v1.5 gap analysis (12 MUST + 6 SHOULD). Resolves MessageType enum mismatch between spec and rcan-py, SPEC_VERSION drift in registry.py, and adds production-safety-critical features required for deployments of >5 robots.

### Breaking Changes
- **MessageType integer table canonicalized** — the v1.4 spec had a different integer table than rcan-py. v1.5 defines one canonical table. Old spec integers: DISCOVER=1, STATUS=2, COMMAND=3 are retired. New canonical: COMMAND=1, STATUS=3, DISCOVER=9, TRANSPARENCY=11. Code using hardcoded integers must migrate to named enum constants.
- **SPEC_VERSION drift fixed** — `rcan-py/rcan/registry.py` was sending `rcan_version: "1.2"`. Now imports `SPEC_VERSION` from `rcan/message.py` (single source of truth).

### New Sections

#### MUST (deployment blockers)
- **§8.3 Replay Attack Prevention** (`replay-prevention.astro`) — 30s sliding window, msg_id seen-set, apply before signature verification (anti-DoS). Safety messages: 10s max window.
- **§8.4 Clock Synchronization** (`safety.astro`) — NTP/NTS required before operational mode; `clock_synchronized` in P66 manifest; ±5s drift tolerance; restricted mode when unsynced.
- **§8.5 Cloud Relay Identity** (`cloud-relay.astro`) — `sender_type` enum: "human"|"robot"|"cloud_function"|"system"; cloud functions MUST include `cloud_provider`; audit trail records sender_type.
- **§3.5 Message Format Versioning** (`messages.astro`) — `rcan_version` validated first; MAJOR mismatch rejected; unknown fields ignored; missing required fields get spec-defined defaults.
- **§13 Robot Identity Revocation** (`revocation.astro`) — GET /api/v1/robots/{rrn}/revocation-status; ROBOT_REVOCATION broadcast (type 19); 1h TTL cache; offline quarantine after max_revocation_staleness_s.
- **§11.2 Consent Wire Protocol** (`consent.astro`) — CONSENT_REQUEST(20)/GRANT(21)/DENY(22) on-wire format; JSON schema; sequence diagram; offline consent blobs.
- **§8.6 Key Rotation** (`key-rotation.astro`) — JWKS at /.well-known/rcan-keys.json; `key_id` on signed messages; grace period (overlap_s=3600); KEY_ROTATION broadcast (type 27).
- **§17 Training Data Consent** (`training-consent.astro`) — TRAINING_CONSENT_REQUEST(28)/GRANT(29)/DENY(30); EU AI Act Article 10; `consent_token` required on TRAINING_DATA; right-to-erasure API.
- **§5.3 QoS / Delivery Guarantees** (`qos.astro`) — QoS 0/1/2; ESTOP MUST use QoS 2; ACK timeout 500ms; retry with exponential backoff; safety halt on ACK timeout; COMMAND_NACK(31).
- **§14 Offline Operation** (`offline.astro`) — offline_grace_s=300 trigger; local key cache; local SQLite consent store; cross-owner grace period; reconnection re-auth.
- **§9.2 CONFIG_UPDATE Protocol** (`messages.astro`) — required payload schema; creator JWT for safety_overrides; config_hash validation; rollback grace period 300s; confidence gates immutable.
- **§12 Command Delegation Chain** (`delegation.astro`) — `delegation_chain` array; DelegationHop structure; max 4 hops; signature verification per hop; DELEGATION_CHAIN_EXCEEDED error.

#### SHOULD (operational improvements)
- **§15 Fleet Broadcast** (`messages.astro`) — FLEET_COMMAND(23); UDP multicast 239.255.66.0/24:6600; TCP fallback; fleet ESTOP SLA 500ms for ≤100 robots.
- **§8.8 Observer Mode** (`messages.astro`) — SUBSCRIBE(24)/UNSUBSCRIBE(25); observer JWT scope (read-only); SSE streaming endpoints.
- **§8.9 Physical Presence** (`delegation.astro`) — `presence_verified`, `proximity_m`, `presence_token` on ESTOP_CLEAR; QR/BLE/UWB proof-of-presence; 300s token TTL.
- **§16 Structured Fault Reporting** (`messages.astro`) — FAULT_REPORT(26); severity levels; standard fault code taxonomy; P66 manifest integration.
- **§20 Audit Trail Export** (`safety.astro`) — GET /api/v1/audit endpoint; signed JSONL export; root hash + issuer signature; P66 manifest audit fields.
- **§11.3 Third-Party Control Flow** (`consent.astro`) — normative 7-step sequence; scoped JWT minting at step 5.

### New MessageType Integers
| Integer | Name | Source |
|---------|------|--------|
| 19 | ROBOT_REVOCATION | GAP-02 |
| 20 | CONSENT_REQUEST | GAP-05 |
| 21 | CONSENT_GRANT | GAP-05 |
| 22 | CONSENT_DENY | GAP-05 |
| 23 | FLEET_COMMAND | GAP-13 |
| 24 | SUBSCRIBE | GAP-15 |
| 25 | UNSUBSCRIBE | GAP-15 |
| 26 | FAULT_REPORT | GAP-20 |
| 27 | KEY_ROTATION | GAP-09 |
| 28 | TRAINING_CONSENT_REQUEST | GAP-10 |
| 29 | TRAINING_CONSENT_GRANT | GAP-10 |
| 30 | TRAINING_CONSENT_DENY | GAP-10 |
| 31 | COMMAND_NACK | GAP-11 |

### Deferred to v1.6
- GAP-14: Human Identity Verification (trust anchor architecture)
- GAP-16: Federated Consent (multi-org, 10+ pages)
- GAP-17: Bandwidth-Constrained Transports (LoRa/BLE)
- GAP-18: Multi-Modal Payloads (binary framing)

### SDK Compatibility
- rcan-py >= 0.5.0
- rcan-ts >= 0.5.0
- OpenCastor >= 2026.3.17.0

---

## v1.4 — 2026-03-14

57-page spec; §1–§16 fully expanded; REGISTRY_REGISTER_RESULT (§21.6) MessageType=16; REGISTRY_RESOLVE_RESULT (§21.7) MessageType=17; structured RRN URI rrn://[org]/[category]/[model]/[id]; Appendix F.

## v1.3 — 2026-03-13

§18-20 + Appendix B stable; §21 Registry Integration; conformance L4; INVOKE_CANCEL (§19.4) MessageType=15; REGISTRY_REGISTER (§21.4) MessageType=13; REGISTRY_RESOLVE (§21.5) MessageType=14.

## v1.2 — 2026-03-07

Adds §17–§20 + Appendix B (Distributed Registry, Capability Advertisement, INVOKE, Telemetry Fields, WebSocket).

## v1.1

AI Accountability Layer (§16).

## v1.0

Initial release.
