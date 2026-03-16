# RCAN Spec Changelog

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
