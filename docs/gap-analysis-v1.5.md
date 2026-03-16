# RCAN v1.4 → v1.5 Gap Analysis
**Protocol Architect Review — March 2026**
**Reviewer:** Protocol Architecture Subagent  
**Spec sources reviewed:** `~/rcan-spec/src/pages/docs/`, `~/rcan-py/rcan/`, `~/OpenCastor/castor/`  
**Scope:** Every communication scenario in the RCAN ecosystem — human↔robot, robot↔robot, human↔human-via-robot, cloud↔robot, multi-party consent flows

---

## Executive Summary

RCAN v1.4 has a solid foundation: Ed25519 message signing, Protocol 66 safety invariants, mDNS discovery, JWT role-based access, and an HMAC-chained audit trail. However, **12 critical or high-risk gaps** exist that would prevent safe, correct deployment of 100+ robots in real environments. The most dangerous are:

1. **No robot identity revocation** — a stolen or compromised robot has no path to invalidation
2. **No command delegation chain** — Robot B cannot prove a command came from Human A via Robot A
3. **No replay attack window** — timestamps exist but no freshness bound is enforced
4. **Consent wire protocol is not spec'd** — the consent manager exists but has no on-wire RCAN messages
5. **Offline auth is broken** — JWT validation requires registry connectivity; disconnected robots can't authenticate

These five alone represent deployment blockers for any safety-critical environment.

---

## Gap Inventory

Sorted by priority: **CRITICAL → HIGH → MEDIUM → LOW**

---

### GAP-01: Command Delegation Chain (Chain of Custody)
| Field | Value |
|---|---|
| **Scenario** | Robot A commands Robot B on behalf of Human A |
| **Status** | MISSING |
| **Risk** | CRITICAL |
| **Spec complexity** | M (3 pages) |

**Problem:** When Robot A delegates a task to Robot B, Robot B receives a command from Robot A's RURI. There is no mechanism to prove that Human A authorized this — Robot B can only verify that Robot A is an authenticated peer. If Robot A is compromised, it can issue arbitrary commands to Robot B claiming to act on behalf of Human A. The audit trail shows `operator: robot-A` but has no provenance back to the originating human. In a hospital deployment, a rogue robot could command a medication-delivery robot without any human ever being in the chain.

**Proposed spec text:**  
Every RCAN command message MUST carry a `delegation_chain` array when the sender is acting on behalf of another principal. Each entry in the chain is an `{issuer_ruri, human_subject, timestamp, scope, signature}` record, signed by the issuing principal's private key. Receivers MUST verify each signature in the chain and MUST reject any command where the human subject in the chain does not hold at least the requested scope on the target robot per R2RAM §11. The chain is limited to a maximum depth of 4 hops. Commands reaching max depth MUST be rejected with `DELEGATION_CHAIN_EXCEEDED`. The commitment record for any delegated command MUST serialize the full delegation chain for audit purposes.

**Recommended addition:** New field `delegation_chain: DelegationHop[]` on `RCANMessage`; new `§12 — Command Delegation and Chain of Custody`

---

### GAP-02: Robot Identity Revocation
| Field | Value |
|---|---|
| **Scenario** | Robot is stolen, hacked, or decommissioned — all trust must be invalidated |
| **Status** | MISSING |
| **Risk** | CRITICAL |
| **Spec complexity** | M (3 pages) |

**Problem:** An RRN is permanent and sequential; the spec explicitly says "never reused." But there is no mechanism to revoke a robot's identity, invalidate its signing keys, or broadcast that a robot should no longer be trusted. A stolen robot retains full cryptographic identity. Peers that have cached consent records or public keys continue to trust it. In a factory with 50 robots, a single compromised unit can command its peers indefinitely.

**Proposed spec text:**  
Registries MUST expose a `GET /api/v1/robots/{rrn}/revocation-status` endpoint returning `{status: "active"|"revoked"|"suspended", revoked_at, reason, authority}`. Robots MUST check revocation status on startup and SHOULD cache results with a 1-hour TTL. A new `ROBOT_REVOCATION` message type SHALL be broadcast by the registry to all reachable peers when a robot is revoked; peers receiving this message MUST invalidate all cached consent and public key material for the revoked RRN. ESTOP remains valid from any identified source per §6, but subsequent RESUME commands from a revoked robot MUST be rejected. Offline operation (§offline) may continue for up to `max_revocation_staleness_s` (default: 3600s) before entering quarantine mode.

**Recommended addition:** New `§13 — Robot Identity Revocation`; new `ROBOT_REVOCATION` message type; registry API extension

---

### GAP-03: Replay Attack Prevention
| Field | Value |
|---|---|
| **Scenario** | Attacker captures a valid signed command and replays it later |
| **Status** | MISSING |
| **Risk** | CRITICAL |
| **Spec complexity** | S (1 page) |

**Problem:** RCAN messages carry a `timestamp` field and are Ed25519 signed. But the spec defines no maximum message age (replay window). A captured `move_forward` command signed by the owner is valid forever — an attacker with passive network access can replay it indefinitely. The `msg_id` (UUID) could prevent replays if receivers maintain a seen-set, but no such requirement exists in the spec. This is a deployment blocker for any robot accessible over a network.

**Proposed spec text:**  
Robots MUST reject any incoming command message where `timestamp` is more than `replay_window_s` seconds in the past (default: 30s; configurable range 5–300s). Robots MUST maintain a sliding-window seen-set of `msg_id` values covering the replay window and MUST reject duplicate `msg_id` values within that window. For safety messages (MessageType 6), the replay window MUST be reduced to 10s. The replay window MUST be applied before signature verification to prevent denial-of-service via replay storms. Clock drift is addressed by the NTS/NTP requirement in §time-sync (see GAP-04).

**Recommended addition:** New `§8.3 — Replay Attack Prevention`; new config fields `security.replay_window_s`, `security.msg_id_cache_size`

---

### GAP-04: Time Synchronization
| Field | Value |
|---|---|
| **Scenario** | Robot clocks drift; replay attacks or false timestamp rejections |
| **Status** | MISSING |
| **Risk** | CRITICAL |
| **Spec complexity** | S (1 page) |

**Problem:** Replay prevention (GAP-03) depends on comparing timestamps, but RCAN has no requirement for clock synchronization. A Raspberry Pi without NTP sync can drift 10+ seconds per hour. A factory robot that has been offline for 48 hours may have a clock 2 minutes off. This causes legitimate commands to be rejected as replays, or creates a window for actual replay attacks. Medical or industrial robots making time-sensitive decisions are especially vulnerable.

**Proposed spec text:**  
All RCAN-compliant robots MUST synchronize their system clocks using NTP or Network Time Security (NTS, RFC 8915) before entering operational mode. Robots MUST expose `GET /api/safety/manifest` with a `clock_synchronized: bool` field. Robots with `clock_synchronized: false` MUST restrict accepted commands to same-network, same-owner sources only and MUST log a WARNING-level audit event. The spec-recommended time source is `pool.ntp.org` with a maximum drift tolerance of ±5 seconds; implementations on embedded hardware with no RTC SHOULD use RCAN time beacons (see `HEARTBEAT` extension in §time-beacon).

**Recommended addition:** New `§8.4 — Clock Synchronization Requirements`; add `clock_synchronized` to Protocol 66 manifest

---

### GAP-05: Consent Wire Protocol
| Field | Value |
|---|---|
| **Scenario** | Robot A requests access to Robot B; owner of B approves/denies |
| **Status** | PARTIAL — Firestore-backed implementation exists in OpenCastor, but no RCAN wire protocol is defined |
| **Risk** | CRITICAL |
| **Spec complexity** | M (3 pages) |

**Problem:** The task prompt lists `CONSENT_REQUEST=16`, `CONSENT_GRANT=17`, `CONSENT_DENY=18` as message types, but these do NOT appear in the actual RCAN spec or rcan-py SDK. `TRANSPARENCY=18` is the highest type defined. OpenCastor's `consent_manager.py` implements consent via Firestore, with no on-wire RCAN message format. This means the consent protocol is entirely cloud-dependent and non-interoperable: a robot running a non-OpenCastor runtime cannot participate in the consent ecosystem at all. The consent message types are referenced in ecosystem documentation but have zero spec coverage.

**Proposed spec text:**  
Three new message types are added to the RCAN wire format: `CONSENT_REQUEST (20)`, `CONSENT_GRANT (21)`, `CONSENT_DENY (22)`. A `CONSENT_REQUEST` carries `{requester_ruri, requester_owner, target_ruri, requested_scopes[], duration_hours, justification, request_id}` and is delivered to the target robot, which forwards it to its owner's notification channel. `CONSENT_GRANT` and `CONSENT_DENY` carry `{request_id, granted_scopes[], expires_at, reason}` and are signed by the target robot's owner JWT. Receiving a `CONSENT_GRANT` or `CONSENT_DENY` without a valid owner-level JWT signature MUST be rejected. All consent events MUST be written to the audit trail. Offline fallback: consent records MUST be exportable as signed JSON blobs for use without registry connectivity.

**Recommended addition:** New `§11.2 — Consent Wire Protocol`; formalize MessageType 20/21/22; add `ConsentRequest`, `ConsentGrant`, `ConsentDeny` to rcan-py

---

### GAP-06: Offline Operation Mode
| Field | Value |
|---|---|
| **Scenario** | Robot loses internet connectivity but must accept local commands safely |
| **Status** | PARTIAL — mDNS works offline, but JWT validation requires registry; consent requires Firestore |
| **Risk** | HIGH |
| **Spec complexity** | M (3 pages) |

**Problem:** JWT tokens are validated by checking the issuer's public key, which requires either caching the key locally or fetching it from the registry. The spec says `local_supremacy` ensures local discovery always works, but there is no spec for what happens to auth when the registry is unreachable. OpenCastor's consent manager returns `None` (blocks) when Firestore is unreachable. A robot in a factory basement that loses WiFi for 30 minutes becomes uncontrollable — the owner cannot send ESTOP through the local interface because JWT validation fails. This is a safety regression.

**Proposed spec text:**  
Robots MUST cache the registry's public key(s) locally and refresh them when connectivity is available (max TTL: 24h). Tokens issued for `role: owner` MUST be accepted from the local network even when the registry is unreachable, provided the token is within its `exp` window and the issuer public key is cached. Consent records MUST be persisted locally (sqlite or JSON) and MAY operate from this local cache for up to `offline_grace_period_s` (default: 86400s) before requiring re-sync. In offline mode, the Protocol 66 manifest MUST include `"offline_mode": true` and `"offline_since_s": <elapsed>`. Cross-owner control commands (non-same-owner) MUST be blocked in offline mode after `offline_cross_owner_grace_s` (default: 3600s).

**Recommended addition:** New `§14 — Offline Operation Mode`; extend Protocol 66 manifest; add local key cache spec

---

### GAP-07: CONFIG_UPDATE Protocol
| Field | Value |
|---|---|
| **Scenario** | Firmware/config updates sent over RCAN (OTA, parameter changes) |
| **Status** | PARTIAL — MessageType CONFIG(5) exists in rcan-py but protocol is undefined |
| **Risk** | HIGH |
| **Spec complexity** | M (3 pages) |

**Problem:** `MessageType.CONFIG = 5` appears in the rcan-py SDK but has no payload schema, authentication requirements, or safety constraints defined anywhere in the spec. In practice, this means anyone with a `config` JWT scope can send arbitrary config payloads to a robot. Config changes can include AI model endpoints (man-in-the-middle attack), safety envelope values (disable proximity detection), or watchdog timeouts (extend to 300s, allowing uncontrolled motion). The confidence gate for CONFIG is 0.65 (spec §6) but there is no transport-level signature requirement above the JWT auth check.

**Proposed spec text:**  
CONFIG_UPDATE messages (MessageType 5) MUST carry: `{config_hash: sha256, config_version: semver, diff_only: bool, payload_b64: base64, requires_restart: bool, safety_overrides: bool}`. Any `CONFIG_UPDATE` that modifies safety envelope parameters (max_linear_speed_mps, emergency_stop_distance, watchdog timeout) MUST have `safety_overrides: true` and MUST be signed by a `role: creator` JWT — `role: owner` is insufficient for safety parameter changes. Receiving robots MUST validate `config_hash` before applying. If `config_hash` does not match the decoded payload, the update MUST be rejected and an audit event MUST be written. Robots MUST maintain the previous config version for rollback via `CONFIG_ROLLBACK` command.

**Recommended addition:** New `§9.2 — CONFIG_UPDATE Wire Protocol`; formalize ConfigUpdate payload schema; add `CONFIG_ROLLBACK` command

---

### GAP-08: Cloud Relay Identity
| Field | Value |
|---|---|
| **Scenario** | Cloud Function (no robot identity) sends command to robot |
| **Status** | MISSING |
| **Risk** | HIGH |
| **Spec complexity** | S (1 page) |

**Problem:** The Flutter→Cloud Functions→Firestore→castor bridge pipeline allows a Cloud Function with no RURI to send commands to a robot. The current JWT auth covers this (Cloud Function uses a human's JWT), but there is no way to distinguish "human sent this from their phone" from "Cloud Function sent this autonomously." This matters for the audit trail (audit shows only the JWT subject, not the execution path), for incident investigation, and for consent enforcement (a Cloud Function could generate consent requests that appear to come from a human). The spec has no concept of a "service identity."

**Proposed spec text:**  
Senders that are not robots (cloud services, intermediary brokers, mobile apps) MUST include a `sender_type: "human"|"robot"|"service"` field in the message envelope. Service senders MUST additionally include a `service_id` (string, max 128 chars) that identifies the cloud service or application. JWT claims for service senders MUST include `"sender_type": "service"` in the custom claims block. Robots MUST record `sender_type` and `service_id` in the commitment record. Consent requests received with `sender_type: "service"` MUST be presented to the owner with the service name highlighted to prevent social engineering ("cloud service X is requesting access" not just "human Y"). 

**Recommended addition:** New `§8.5 — Sender Type and Service Identity`; add `sender_type`, `service_id` to message envelope

---

### GAP-09: Key Rotation
| Field | Value |
|---|---|
| **Scenario** | Operator rotates signing keys without breaking existing trust |
| **Status** | MISSING |
| **Risk** | HIGH |
| **Spec complexity** | M (3 pages) |

**Problem:** The Ed25519 signing system uses a single key pair per operator with an 8-char `kid` derived from the public key hash. There is no mechanism to rotate keys — if a private key is compromised, there is no way to invalidate it short of changing the entire RURI. Robots that cache public keys will continue to trust the compromised key. The spec has no key expiry, no multi-key validation (trust set), and no key revocation certificate format. In a production fleet, keys must be rotated at least annually (many compliance frameworks require 90-day rotation).

**Proposed spec text:**  
Each robot and operator SHOULD maintain a JSON Web Key Set (JWKS) at `/.well-known/rcan-keys.json` containing all currently valid public keys with `{kid, alg, use, exp, key_ops, n/x/y}` per RFC 7517. Robots MUST accept signatures from any non-expired key in the trusted JWKS of the sender's registry. Keys MUST include an `exp` field (Unix timestamp) with a maximum validity of 365 days. Key rotation is performed by adding a new key to the JWKS and setting `exp` on the old key. Old keys MUST be retained in the JWKS for at least `replay_window_s * 2` seconds after expiry to validate in-flight messages. Compromised keys SHOULD be revoked via `revoked_at` timestamp in the JWKS entry.

**Recommended addition:** New `§8.6 — Key Lifecycle and Rotation`; JWKS endpoint spec; extend `KeyPair` in rcan-py

---

### GAP-10: Training Data Consent
| Field | Value |
|---|---|
| **Scenario** | Robot collects data involving human faces/voices; consent required |
| **Status** | PARTIAL — `TRAINING_DATA` message type exists, no consent mechanism |
| **Risk** | HIGH |
| **Spec complexity** | M (3 pages) |

**Problem:** RCAN defines `TRAINING_DATA` (type 10 in the task context enum) but there is no consent framework for biometric data collection. A robot with a camera collecting faces for training is processing special-category data under GDPR Article 9 and California CPRA. The confidence gate for TRAINING is 0.60 (lowest of all scopes), meaning the AI can decide to collect data with low confidence. There is no mechanism for a human to consent to, revoke consent for, or audit what training data has been collected about them. EU AI Act Annex III §5 makes this a high-risk AI use case.

**Proposed spec text:**  
Any `TRAINING_DATA` collection involving biometric, audio, or visual data MUST first obtain a `DATA_CONSENT` token from the subject. The `DATA_CONSENT` flow uses a `CONSENT_REQUEST (20)` message with `consent_type: "training_data"` and `data_categories: ["biometric"|"audio"|"video"|"location"]`. Robots MUST NOT begin biometric data collection until a `CONSENT_GRANT (21)` is received. The consent token MUST be attached to every `TRAINING_DATA` message as `consent_token`. Training data collections MUST be logged to the audit trail with subject identity, data categories, and consent token ID. Subjects MUST be able to query `GET /api/training-data/consent/{subject_id}` to see all consent records, and `DELETE` to invoke right-to-erasure.

**Recommended addition:** New `§17 — Biometric and Training Data Consent`; new `consent_type` field on CONSENT_REQUEST; audit trail extension

---

### GAP-11: QoS and Delivery Guarantees
| Field | Value |
|---|---|
| **Scenario** | Critical commands must be acknowledged; streaming telemetry is best-effort |
| **Status** | MISSING |
| **Risk** | HIGH |
| **Spec complexity** | M (3 pages) |

**Problem:** RCAN uses HTTP as its primary transport with no delivery guarantee semantics. A `SAFETY_ESTOP` sent over a congested WiFi link may be silently dropped. A `COMMAND_ACK` exists but is not required — the spec does not mandate that safety messages be acknowledged or retried. Conversely, `SENSOR_DATA` and `STATUS` messages are fire-and-forget, which is correct, but there is no way to specify this in the message itself. The spec has no concept of QoS levels: fire-and-forget, at-least-once, or exactly-once. A robot receiving a command it has already executed has no standard way to detect this (the `msg_id` replay cache helps, but is focused on security not reliability).

**Proposed spec text:**  
RCAN messages MUST carry a `qos: 0|1|2` field with semantics: `0 = fire-and-forget` (no ack required), `1 = at-least-once` (sender retries until COMMAND_ACK received), `2 = exactly-once` (two-phase commit using COMMAND_ACK + COMMAND_COMMIT). Safety messages (MessageType 6) MUST use `qos: 1` minimum; ESTOP messages MUST use `qos: 2`. TELEOP stream messages MUST use `qos: 0`. For `qos: 1`, senders MUST retry up to `max_retries` (default: 3) times with exponential backoff starting at 100ms. Receivers MUST send COMMAND_ACK within `ack_timeout_ms` (default: 500ms) for `qos >= 1`. Failure to receive ACK for safety messages after max retries MUST trigger a local safety halt.

**Recommended addition:** New `§5.3 — Quality of Service`; add `qos` field to message envelope; define retry semantics

---

### GAP-12: Message Format Versioning
| Field | Value |
|---|---|
| **Scenario** | Robot running RCAN v1.3 receives message from v1.4 sender |
| **Status** | PARTIAL — `rcan_version` field exists in messages; no compatibility rules defined |
| **Risk** | HIGH |
| **Spec complexity** | S (1 page) |

**Problem:** Messages carry `rcan_version: "1.4"` but there are no defined rules for how receivers should handle version mismatches. Should a v1.3 robot reject, warn, or silently accept a v1.4 message? The `delegation_chain` field (GAP-01) added in v1.5 won't exist on v1.4 messages — should v1.5 robots reject all v1.4 messages, accept them without delegation verification, or quarantine them? Without compatibility rules, a fleet upgrade creates a split-brain window where some robots enforce new features and others don't.

**Proposed spec text:**  
RCAN version strings follow semantic versioning (MAJOR.MINOR.PATCH). Receivers MUST accept messages from senders with matching MAJOR version and lower-or-equal MINOR version (i.e., a v1.5 robot MUST accept v1.3 messages). Receivers MUST reject messages from senders with a different MAJOR version with error `VERSION_INCOMPATIBLE`. For new fields added in a minor version (e.g., `delegation_chain` in v1.5), receivers on lower versions MUST ignore unknown fields (forward compatibility). Receivers on higher versions receiving messages missing required new fields MUST apply the default behavior defined in the spec for that field (e.g., missing `delegation_chain` → treat as no delegation). The `rcan_version` field MUST be the first field validated before any other processing.

**Recommended addition:** New `§3.5 — Protocol Version Compatibility`; add to rcan-py `from_dict` validation

---

### GAP-13: Fleet Broadcast / Group Commands
| Field | Value |
|---|---|
| **Scenario** | "All robots in group X, pause immediately" |
| **Status** | PARTIAL — JWT `fleet` claim and `aud` wildcards exist; no broadcast routing |
| **Risk** | MEDIUM |
| **Spec complexity** | M (3 pages) |

**Problem:** The JWT spec allows `"fleet": ["rrn1", "rrn2"]` and `aud: rcan://*/model/*` wildcards, suggesting fleet operations are intended. OpenCastor has a `FleetManager` with group policies. However, there is no RCAN message type for fleet broadcast, no addressing scheme for "send to group X," and no guarantee that all group members received a command. In an emergency, an operator cannot reliably send "pause all robots" without individually addressing each one — and the sequential HTTP calls take O(n) time, which is unacceptable for safety-critical fleet stops.

**Recommended addition:** New `FLEET_COMMAND (23)` message type with `{group_id, rrn_list[], command, params, require_ack_all: bool}`; new `§15 — Fleet Operations`; multicast semantics via UDP broadcast on local network with TCP fallback

---

### GAP-14: Human Identity Verification
| Field | Value |
|---|---|
| **Scenario** | How does the robot verify the human is who they claim to be? |
| **Status** | PARTIAL — JWT `sub` claim identifies the human; no verification of JWT issuance |
| **Risk** | MEDIUM |
| **Spec complexity** | M (3 pages) |

**Problem:** JWT tokens identify a `sub` (user UUID) and are issued by a registry. But there is no spec for how the registry verified the human's identity before issuing the token. A JWT could be issued by a rogue registry to anyone. The `iss` claim names the registry but robots have no mechanism to verify that the issuer is a legitimate RCAN registry vs. an attacker-controlled server. For home robots this may be acceptable; for hospital or factory robots, impersonation of a supervisor could have life-safety implications.

**Recommended addition:** New `§8.7 — Registry Trust Anchors`; define a trust root (public key pinning or DNSSEC-signed registry discovery); add `registry_tier: "root"|"authoritative"|"community"` to JWT claims; add identity verification levels (`loa: 1|2|3` — Level of Assurance)

---

### GAP-15: Observer Mode (Read-Only Telemetry Streaming)
| Field | Value |
|---|---|
| **Scenario** | Safety officer watches robot telemetry without any command authority |
| **Status** | MISSING |
| **Risk** | MEDIUM |
| **Spec complexity** | S (1 page) |

**Problem:** RCAN has no spec for read-only telemetry subscription. A GUEST role can read status, but there is no streaming subscription mechanism — the observer must poll. For safety monitoring of a fleet of 100 robots, polling 100 `/status` endpoints every second is not practical. More critically, there is no architectural separation between "can read status" and "can issue commands" in the transport layer — a GUEST role JWT could theoretically be upgraded through a vulnerability, and the spec provides no sandboxing guarantee.

**Recommended addition:** New `SUBSCRIBE (24)` / `UNSUBSCRIBE (25)` message types; new `observer` JWT scope (read-only, cannot be combined with `control`); WebSocket or SSE streaming endpoint spec at `GET /api/stream/{scope}`

---

### GAP-16: Federated Consent (Cross-Registry Permissions)
| Field | Value |
|---|---|
| **Scenario** | Robot A on registry-1 requests access to Robot B on registry-2 |
| **Status** | MISSING — FEDERATION_SYNC message type exists but federation protocol undefined |
| **Risk** | MEDIUM |
| **Spec complexity** | L (10+ pages) |

**Problem:** RCAN mentions federation ("registries federate like email") but provides no protocol for cross-registry trust, consent propagation, or identity verification. The `FEDERATION_SYNC` message type is listed but has no payload spec. In the real world, a hospital might run registry-1 and a medical device supplier runs registry-2 — their robots need to interact but neither registry should have full control over the other's consent records.

**Recommended addition:** New `§18 — Registry Federation Protocol`; define FEDERATION_SYNC payload; specify cross-registry JWT trust chains; address consent record portability across registries

---

### GAP-17: Bandwidth-Constrained Transports
| Field | Value |
|---|---|
| **Scenario** | RCAN over BLE, LoRa, SMS (robot in building with no WiFi) |
| **Status** | MISSING |
| **Risk** | MEDIUM |
| **Spec complexity** | L (10+ pages) |

**Problem:** RCAN is entirely HTTP-based. A robot using BLE (max ~250 bytes/packet), LoRa (max 255 bytes/frame), or SMS cannot exchange RCAN messages in their current form. A typical RCAN message with JWT auth and Ed25519 signature is 400–800 bytes before payload. An ESTOP message on a LoRa network is impossible under the current spec. As robotics moves into remote and constrained environments (agricultural robots, disaster response, remote facilities), this becomes a serious limitation.

**Recommended addition:** New `§19 — Constrained Transport Encoding`; define RCAN-Compact (CBOR encoding, mandatory field abbreviations); define RCAN-Minimal (ESTOP-only 32-byte message format for LoRa/SMS); specify BLE L2CAP framing

---

### GAP-18: Multi-Modal Payload Support
| Field | Value |
|---|---|
| **Scenario** | Robot sends image from camera in response to status query; receives audio commands |
| **Status** | MISSING |
| **Risk** | MEDIUM |
| **Spec complexity** | M (3 pages) |

**Problem:** RCAN message payloads are JSON dicts with no support for binary or multi-part content. `SENSOR_DATA` and `TRAINING_DATA` message types imply data transfer but there is no standard for including image/audio/video. The audit trail cannot prove what data was transmitted. Ad-hoc solutions (base64 in JSON, separate HTTP endpoints) break the signed message model — if binary data is sent outside the RCAN envelope, it's outside the trust boundary.

**Recommended addition:** New `§5.4 — Multi-Modal Payloads`; define `media_chunks[]` field with `{chunk_id, mime_type, encoding: "base64"|"ref", hash_sha256, data_b64?|ref_url?}`; extend CommitmentRecord to hash media content

---

### GAP-19: Physical Presence Verification
| Field | Value |
|---|---|
| **Scenario** | "Human is physically co-located with robot" as a security primitive |
| **Status** | MISSING |
| **Risk** | MEDIUM |
| **Spec complexity** | S (1 page) |

**Problem:** Some high-risk robot operations should only be permitted when an authorized human is physically present (e.g., clearing an ESTOP, executing a `training` data collection, performing maintenance). The current spec has no concept of physical proximity as an authorization factor. A remote attacker who has compromised a JWT can issue ESTOP_CLEAR commands from anywhere in the world.

**Recommended addition:** New `physical_presence_required: bool` flag on JWT scope definitions; new `§8.8 — Physical Presence Verification`; define proof-of-presence methods (QR code scan, BLE proximity beacon, UWB challenge-response); ESTOP_CLEAR MUST require physical presence when `physical_presence_required: true`

---

### GAP-20: Structured Fault Reporting
| Field | Value |
|---|---|
| **Scenario** | Robot reports motor fault, sensor failure, or low battery to owner |
| **Status** | PARTIAL — generic `ERROR` message type exists; no fault taxonomy |
| **Risk** | MEDIUM |
| **Spec complexity** | S (1 page) |

**Problem:** The `ERROR` message type carries a string message. There is no standard fault code taxonomy, no severity levels, no recommended owner notification patterns, and no integration with the safety manifest (Protocol 66). When a robot's proximity sensor fails silently, there is no spec-defined way to report this such that a monitoring system could detect that the `local_safety_wins` invariant is degraded.

**Recommended addition:** New `FAULT_REPORT` message type with `{fault_code: string, severity: "info"|"warning"|"error"|"critical", subsystem: string, affects_safety: bool, safe_to_continue: bool}`; define standard fault code taxonomy; require safety-affecting faults to update Protocol 66 manifest

---

### GAP-21: Audit Trail Export Protocol
| Field | Value |
|---|---|
| **Scenario** | Regulator requests audit log for all robot actions in past 30 days |
| **Status** | PARTIAL — CommitmentRecord chain exists locally; no export protocol |
| **Risk** | LOW |
| **Spec complexity** | S (1 page) |

**Problem:** The HMAC-chained `AuditChain` is well-designed for tamper evidence, but there is no standard API for exporting it. EU AI Act Article 17 requires audit log retention and accessibility. The Protocol 66 manifest includes `audit_enabled: bool` but no endpoint or format for audit export. Compliance auditors need a signed, portable export format.

**Recommended addition:** `GET /api/v1/audit?from=&to=&format=jsonl|csv` endpoint; define signed audit export format (JSONL with chain root hash and issuer signature); add audit retention policy fields to Protocol 66 manifest

---

### GAP-22: Human A → Robot B (Third-Party Control)
| Field | Value |
|---|---|
| **Scenario** | Human A wants to command Robot B (owned by Human B) — consent exists, but flow is not fully defined |
| **Status** | PARTIAL — consent records exist; no complete message flow documented |
| **Risk** | LOW |
| **Spec complexity** | S (1 page) |

**Problem:** The consent manager enforces scope after consent is granted, but the full flow (Human A discovers Robot B → requests access → Human B approves → Human A receives credentials → Human A commands Robot B → audit shows chain back to Human A) is not spec'd as a complete sequence. Implementations must piece this together from auth, consent, and message sections. This leads to implementation divergence across runtimes.

**Recommended addition:** New `§11.3 — Third-Party Human Control Flow`; sequence diagram + normative text for the complete 7-step flow; define how Human A's JWT for Robot B is issued (scoped token minted by Robot B's registry on consent grant)

---

## Prioritized Issue List

| # | Gap | Priority | Risk | Complexity | Blocker |
|---|-----|----------|------|------------|---------|
| GAP-01 | Command Delegation Chain | P0 | CRITICAL | M | Factory/hospital R2R deployments |
| GAP-02 | Robot Identity Revocation | P0 | CRITICAL | M | Fleet security |
| GAP-03 | Replay Attack Prevention | P0 | CRITICAL | S | All network deployments |
| GAP-04 | Time Synchronization | P0 | CRITICAL | S | Required by GAP-03 |
| GAP-05 | Consent Wire Protocol | P0 | CRITICAL | M | Multi-runtime interop |
| GAP-06 | Offline Operation Mode | P1 | HIGH | M | Any non-cloud deployment |
| GAP-07 | CONFIG_UPDATE Protocol | P1 | HIGH | M | Safe OTA updates |
| GAP-08 | Cloud Relay Identity | P1 | HIGH | S | Audit trail integrity |
| GAP-09 | Key Rotation | P1 | HIGH | M | Production security |
| GAP-10 | Training Data Consent | P1 | HIGH | M | GDPR/EU AI Act compliance |
| GAP-11 | QoS / Delivery Guarantees | P1 | HIGH | M | ESTOP reliability |
| GAP-12 | Message Format Versioning | P1 | HIGH | S | Fleet upgrade safety |
| GAP-13 | Fleet Broadcast / Group Commands | P2 | MEDIUM | M | Fleet operations |
| GAP-14 | Human Identity Verification | P2 | MEDIUM | M | High-security deployments |
| GAP-15 | Observer Mode | P2 | MEDIUM | S | Monitoring/audit |
| GAP-16 | Federated Consent | P2 | MEDIUM | L | Multi-org deployments |
| GAP-17 | Bandwidth-Constrained Transports | P2 | MEDIUM | L | Remote/IoT deployments |
| GAP-18 | Multi-Modal Payloads | P2 | MEDIUM | M | Sensor data / training |
| GAP-19 | Physical Presence Verification | P2 | MEDIUM | S | ESTOP_CLEAR safety |
| GAP-20 | Structured Fault Reporting | P3 | MEDIUM | S | Fleet health monitoring |
| GAP-21 | Audit Trail Export | P3 | LOW | S | Regulatory compliance |
| GAP-22 | Human A → Robot B Flow | P3 | LOW | S | Documentation completeness |

---

## Additional Findings: Spec vs. Implementation Discrepancies

### MessageType Enum Mismatch
The task context describes one MessageType numbering (`DISCOVER=1, STATUS=2, CHAT=3, TELEOP=4...`) while `rcan-py/rcan/message.py` implements a completely different set (`COMMAND=1, RESPONSE=2, STATUS=3, HEARTBEAT=4, CONFIG=5, SAFETY=6...`). The spec pages do not canonically define the integer values. **This must be resolved before v1.5**: the spec should define a single authoritative enum with integer values, and all SDKs must implement it.

### Consent Message Types Referenced But Not Implemented
The task context lists `CONSENT_REQUEST=16, CONSENT_GRANT=17, CONSENT_DENY=18` but these values do not appear in the spec or any SDK. `TRANSPARENCY=18` conflicts with the described `CONSENT_DENY=18`. The spec needs to:
1. Resolve the enum conflict (move TRANSPARENCY to 19, add consent types at 20-22)
2. Or fully define consent types in a new section

### R2RAM Scope `transparency` Has Incorrect Value
`SCOPE_HIERARCHY` in `consent_manager.py` defines `"transparency": 0` (same level as `discover`), meaning any robot can request transparency. This may be correct by design (TRANSPARENCY is mandatory per EU AI Act) but it should be explicitly stated in the spec, not implicit in an implementation constant.

### SDK SPEC_VERSION Drift
`rcan-py/rcan/registry.py` sends `"rcan_version": "1.2"` in registration payloads while `rcan-py/rcan/message.py` uses `SPEC_VERSION = "1.4"`. These must be synchronized.

---

## Recommended v1.5 Spec Structure (New Sections)

```
§3.5  — Protocol Version Compatibility (GAP-12)
§5.3  — Quality of Service (GAP-11)
§5.4  — Multi-Modal Payloads (GAP-18)
§8.3  — Replay Attack Prevention (GAP-03)
§8.4  — Clock Synchronization Requirements (GAP-04)
§8.5  — Sender Type and Service Identity (GAP-08)
§8.6  — Key Lifecycle and Rotation (GAP-09)
§8.7  — Registry Trust Anchors (GAP-14)
§8.8  — Physical Presence Verification (GAP-19)
§9.2  — CONFIG_UPDATE Wire Protocol (GAP-07)
§11.2 — Consent Wire Protocol (GAP-05)
§11.3 — Third-Party Human Control Flow (GAP-22)
§12   — Command Delegation and Chain of Custody (GAP-01)
§13   — Robot Identity Revocation (GAP-02)
§14   — Offline Operation Mode (GAP-06)
§15   — Fleet Operations (GAP-13)
§16   — Fault Reporting Taxonomy (GAP-20)
§17   — Biometric and Training Data Consent (GAP-10)
§18   — Registry Federation Protocol (GAP-16)
§19   — Constrained Transport Encoding (GAP-17)
§20   — Audit Trail Export Protocol (GAP-21)
```

**New Message Types for v1.5:**
| Type | Name | Purpose |
|------|------|---------|
| 20 | CONSENT_REQUEST | R2RAM consent initiation |
| 21 | CONSENT_GRANT | Owner grants cross-robot access |
| 22 | CONSENT_DENY | Owner denies access request |
| 23 | FLEET_COMMAND | Broadcast command to robot group |
| 24 | SUBSCRIBE | Subscribe to telemetry stream |
| 25 | UNSUBSCRIBE | Cancel telemetry subscription |
| 26 | ROBOT_REVOCATION | Broadcast robot identity invalidation |
| 27 | FAULT_REPORT | Structured robot fault reporting |

---

## Real-World Deployment Test: 100 Robots, Hospital Environment

Applying these gaps to a 100-robot hospital deployment (medication delivery, patient monitoring, disinfection):

**Would fail immediately:**
- Replay attacks possible on any command (GAP-03) — attacker in hospital network captures ESTOP_CLEAR and replays it
- No fleet ESTOP (GAP-13) — emergency stop requires 100 sequential HTTP calls, O(10s) latency
- Offline auth failure (GAP-06) — robot in elevator loses WiFi, can't receive ESTOP from nurse

**Would fail within weeks:**
- No key rotation (GAP-09) — compromised operator laptop means fleet is permanently at risk
- No consent wire protocol (GAP-05) — non-OpenCastor robots (third-party medical devices) can't join ecosystem
- CONFIG_UPDATE exploitable (GAP-07) — attacker with stolen config-scope token disables proximity sensors

**Would create compliance violations:**
- Training data consent (GAP-10) — robot cameras collecting patient faces without GDPR consent
- Audit export (GAP-21) — hospital cannot provide regulators with verified audit logs
- EU AI Act TRANSPARENCY is working ✓ — this is covered

**Would degrade operations:**
- No structured faults (GAP-20) — sensor failures invisible until catastrophic event
- No observer mode (GAP-15) — safety officer must poll 100 robots individually
- No QoS guarantees (GAP-11) — critical commands silently dropped on busy WiFi

---

*Gap analysis generated from direct review of spec source files, rcan-py SDK, and OpenCastor implementation. All findings are based on code as of rcan-py v0.4.2, rcan-ts v0.4.1, OpenCastor current main.*
