# RCAN MessageType Numbering Plan

> **Version**: v1.10.0 | **Updated**: 2026-03-24 | **Status**: Canonical

This document is the **single source of truth** for RCAN MessageType integer assignments.
Both `rcan-py` and `rcan-ts` SDKs **MUST** use these exact values.

## Canonical MessageType Table

| Value | Name | Group | Section | Direction | Since |
|------:|------|-------|---------|-----------|-------|
| 1 | COMMAND | Core protocol | §3 | operator → robot | v1.0 |
| 2 | RESPONSE | Core protocol | §3 | robot → operator | v1.0 |
| 3 | STATUS | Core protocol | §3 | robot → operator | v1.0 |
| 4 | HEARTBEAT | Core protocol | §3 | bidirectional | v1.0 |
| 5 | CONFIG | Core protocol | §8 | operator → robot | v1.0 |
| 6 | SAFETY | Core protocol | §6 | bidirectional | v1.0 |
| 7 | AUTH | Core protocol | §5 | bidirectional | v1.0 |
| 8 | ERROR | Core protocol | §3 | bidirectional | v1.0 |
| 9 | DISCOVER | Discovery & auth | §4 | broadcast | v1.0 |
| 10 | PENDING_AUTH | Discovery & auth | §5 | robot → operator | v1.2 |
| 11 | INVOKE | Skill invocation | §19.2 | operator → robot | v1.2 |
| 12 | INVOKE_RESULT | Skill invocation | §19.3 | robot → operator | v1.2 |
| 13 | INVOKE_CANCEL | Skill invocation | §19.4 | operator → robot | v1.2 |
| 14 | REGISTRY_REGISTER | Registry | §21.4 | robot → registry | v1.3 |
| 15 | REGISTRY_RESOLVE | Registry | §21.5 | any → registry | v1.3 |
| 16 | TRANSPARENCY | Audit & transparency | §16 | robot → audit log | v1.2 |
| 17 | COMMAND_ACK | Acknowledgement & QoS | §3 | robot → operator | v1.5 |
| 18 | COMMAND_NACK | Acknowledgement & QoS | §3 | robot → operator | v1.5 |
| 19 | ROBOT_REVOCATION | Identity & consent | §13 | broadcast | v1.5 |
| 20 | CONSENT_REQUEST | Identity & consent | §11.2 | robot → robot | v1.5 |
| 21 | CONSENT_GRANT | Identity & consent | §11.2 | owner → requester | v1.5 |
| 22 | CONSENT_DENY | Identity & consent | §11.2 | owner → requester | v1.5 |
| 23 | FLEET_COMMAND | Fleet & telemetry | §15 | operator → fleet | v1.5 |
| 24 | SUBSCRIBE | Fleet & telemetry | §20 | any → robot | v1.5 |
| 25 | UNSUBSCRIBE | Fleet & telemetry | §20 | any → robot | v1.5 |
| 26 | FAULT_REPORT | Diagnostics | §16 | robot → operator | v1.5 |
| 27 | KEY_ROTATION | Diagnostics | §8.6 | broadcast | v1.5 |
| 28 | COMMAND_COMMIT | Diagnostics | §5.3 | bidirectional | v1.5 |
| 29 | SENSOR_DATA | Sensor & training | §20 | robot → subscriber | v1.5 |
| 30 | TRAINING_CONSENT_REQUEST | Sensor & training | §17 | operator → owner | v1.5 |
| 31 | TRAINING_CONSENT_GRANT | Sensor & training | §17 | owner → requester | v1.5 |
| 32 | TRAINING_CONSENT_DENY | Sensor & training | §17 | owner → requester | v1.5 |
| 33 | CONTRIBUTE_REQUEST | Idle compute | §credits | coordinator → robot | v1.7 |
| 34 | CONTRIBUTE_RESULT | Idle compute | §credits | robot → coordinator | v1.7 |
| 35 | CONTRIBUTE_CANCEL | Idle compute | §credits | robot → coordinator | v1.7 |
| 36 | TRAINING_DATA | Multimodal training | §3 | robot → data pipeline | v1.8 |
| 37 | COMPETITION_ENTER | Competition | §competitions | robot → fleet | v1.10 |
| 38 | COMPETITION_SCORE | Competition | §competitions | robot → fleet | v1.10 |
| 39 | SEASON_STANDING | Competition | §competitions | cloud → robot | v1.10 |
| 40 | PERSONAL_RESEARCH_RESULT | Competition | §competitions | robot → local gateway | v1.10 |

## Numbering Rules

1. **Values are permanent.** Once assigned, a MessageType value MUST NOT be reassigned or reused.
2. **New types append.** New MessageTypes are assigned the next available integer.
3. **Gaps are allowed.** If a type is deprecated, its value is retired — not reclaimed.
4. **Cross-SDK consistency.** Both `rcan-py` and `rcan-ts` MUST use identical integer assignments.
5. **Protobuf compatibility.** Values correspond to the `MessageType` enum in `message_envelope.proto`.

## Groups

| Range | Group | Description |
|-------|-------|-------------|
| 1–8 | Core protocol | Fundamental message types present since v1.0 |
| 9–10 | Discovery & authorization | Network discovery and HiTL pending auth |
| 11–13 | Skill invocation | INVOKE / INVOKE_RESULT / INVOKE_CANCEL |
| 14–15 | Registry | Robot registration and RRN resolution |
| 16 | Audit & transparency | EU AI Act Art. 13 audit records |
| 17–18 | Acknowledgement & QoS | Command ack/nack for exactly-once delivery |
| 19–22 | Identity & consent | Revocation and cross-robot consent flow |
| 23–25 | Fleet & telemetry | Fleet commands and telemetry subscriptions |
| 26–28 | Diagnostics | Fault reporting, key rotation, commit phase |
| 29–32 | Sensor & training | Sensor data and training data consent |
| 33–35 | Idle compute contribution | Castor Credits work unit protocol |
| 36 | Multimodal training data | Multi-modal training data payloads |
| 37–40 | Competition | Fleet competition events and personal research |

## Reserved Ranges

| Range | Purpose |
|-------|---------|
| 41–50 | Reserved for future competition/research extensions |
| 51–99 | Reserved for future protocol extensions |
| 100+ | Available for vendor-specific extensions (non-standard) |

## Version History

| Version | Types Added | Range |
|---------|-------------|-------|
| v1.0 | COMMAND, RESPONSE, STATUS, HEARTBEAT, CONFIG, SAFETY, AUTH, ERROR, DISCOVER | 1–9 |
| v1.2 | PENDING_AUTH, INVOKE, INVOKE_RESULT, INVOKE_CANCEL, TRANSPARENCY | 10–13, 16 |
| v1.3 | REGISTRY_REGISTER, REGISTRY_RESOLVE | 14–15 |
| v1.5 | COMMAND_ACK through TRAINING_CONSENT_DENY | 17–32 |
| v1.7 | CONTRIBUTE_REQUEST, CONTRIBUTE_RESULT, CONTRIBUTE_CANCEL | 33–35 |
| v1.8 | TRAINING_DATA | 36 |
| v1.10 | COMPETITION_ENTER, COMPETITION_SCORE, SEASON_STANDING, PERSONAL_RESEARCH_RESULT | 37–40 |
