# RCAN Protocol — ISO 10218-1:2025 Alignment

**Document type:** Compliance alignment  
**RCAN spec version:** 1.1 (rcan.dev/spec)  
**Standard:** ISO 10218-1:2025 — Robotics: Safety requirements for industrial robots — Part 1: Robots  
**Status:** Informative  
**Last updated:** 2026-03-03  

---

## Purpose

RCAN (Robot Communication and Addressing Network) and ISO 10218-1:2025 address complementary layers of robot safety and are designed to coexist without conflict. ISO 10218-1:2025 governs the hardware, mechanical, and system-level safety of industrial robots, including physical safeguarding, risk assessment, and collaborative operation parameters. RCAN governs the AI agent governance and networking layer: how robot commands are originated, authorized, routed, audited, and constrained at the protocol level.

This document maps the points where the two frameworks align, where RCAN extends ISO 10218-1:2025 requirements with additional AI-specific controls, and where RCAN fills gaps that the 2025 revision of the standard does not yet address — in particular, the absence of any AI model accountability requirements.

This document is intended for robot manufacturers, system integrators, and conformity assessment bodies evaluating compliance with both frameworks simultaneously.

---

## Document Scope

| Framework | Scope |
|-----------|-------|
| **RCAN** | AI agent governance, robot networking, access control, audit trail, AI decision accountability, human-in-the-loop authorization, federated robot communication |
| **ISO 10218-1:2025** | Hardware safety of industrial robots: mechanical design, protective stops, speed and force limits for collaborative operation, risk assessment methodology, safety functions, software integrity at the controller level |

These are not competing standards. A robot system can and should be compliant with both. ISO 10218-1:2025 addresses the physical layer; RCAN addresses the AI and networking layer above it. Compliance with one does not imply compliance with the other.

---

## Clause-by-Clause Alignment Table

| RCAN Provision | ISO 10218-1:2025 Requirement | Relationship |
|---|---|---|
| **§6 Audit trail** — All `COMMAND` and `CONFIG` messages MUST be logged with principal identity, RURI, timestamp (ms), message_id, and outcome (`ok` / `blocked` / `error`) | Clause 5.4.x — Cybersecurity requirements for industrial robots: event logging and audit records for control system access | **Aligned** — RCAN's audit trail requirement directly satisfies and extends the cybersecurity logging requirement. RCAN specifies finer-grained fields (principal RURI, message_id, millisecond timestamp, per-message outcome) than the ISO clause requires. |
| **§2 RBAC — 5-tier role hierarchy** (GUEST → USER → LEASEE → OWNER → CREATOR) with protocol-enforced scope restrictions and rate limits per role | Clause 5.4.x — Cybersecurity access control: authentication and authorization requirements for robot control systems | **Aligned** — RCAN's role hierarchy satisfies the access control requirement. RCAN extends it by making roles protocol-native (JWT-embedded, verified at message layer) rather than application-layer controls, and by specifying rate limits per role. |
| **§6 Prompt injection defense** — Implementations forwarding natural-language instructions to a language model MUST scan for injection patterns before model invocation. A `ScanVerdict.BLOCK` result MUST return an error without calling the model. | Clause 5.4.x — Software integrity requirements for the robot control system | **RCAN Fills Gap** — ISO 10218-1:2025 addresses software integrity in the context of firmware and controller software. It has no provision for AI prompt injection, which is a distinct attack vector specific to LLM-driven control systems. RCAN is the first robot networking specification to address this threat at the protocol layer. |
| **§16.1 Model identity in audit records** — Every AI-generated command audit record MUST include: model provider, model identifier, inference confidence score, inference latency (ms), thought_id, and whether the action was escalated from a lower-confidence provider | No equivalent in ISO 10218-1:2025 | **RCAN Fills Gap** — ISO 10218-1:2025 has no requirement to record which AI model produced a command, at what confidence level, or whether a fallback model was invoked. Without this information, forensic investigation of an AI-caused incident is impossible. RCAN's §16.1 makes AI model identity a first-class audit field. |
| **§16.2 Confidence gates** — Minimum confidence thresholds MUST be declared per action scope in robot configuration. A command MUST be rejected before dispatch if the model's reported confidence falls below the threshold for that scope. | No equivalent in ISO 10218-1:2025 | **RCAN Fills Gap** — ISO 10218-1:2025 defines speed, force, and power limits for collaborative robots but has no mechanism to gate command execution on AI model confidence. Confidence miscalibration is a known AI failure mode with no analogue in mechanical systems. RCAN's confidence gates address this directly at the protocol layer. |
| **§16.3 Human-in-the-Loop (HiTL) gates** — Action types declared as requiring human authorization in robot configuration MUST NOT be dispatched until an `AUTHORIZE` message from a principal with OWNER or higher role has been received. Pending actions MUST emit `PENDING_AUTH` status. | No equivalent in ISO 10218-1:2025 | **RCAN Fills Gap** — ISO 10218-1:2025 does not address AI-specific human oversight requirements. The standard's safety functions (protective stop, speed monitoring) are reactive hardware controls. RCAN's HiTL gates are proactive, protocol-enforced authorization requirements for defined action types — a control ISO 10218 has no mechanism to express. This provision directly addresses the EU AI Act Article 14 human oversight requirement. |
| **§16.4 Thought log** — AI reasoning records (thought_id, prompt, reasoning, action taken, confidence) MUST be stored and accessible via `GET /api/thoughts/<id>` with scope-gated access. The `reasoning` field MUST require OWNER or higher scope to retrieve. | No equivalent in ISO 10218-1:2025 | **RCAN Fills Gap** — ISO 10218-1:2025 has no concept of AI reasoning transparency. The thought log is a forensic and oversight primitive specific to LLM-driven systems. It enables post-incident reconstruction of AI decision chains — a capability required by the EU AI Act Article 12 but absent from ISO 10218-1:2025. |
| **§6 Local safety always wins** — No remote command can bypass on-device safety checks, bounds checking, or emergency-stop state | Clause 5.x — Protective stop and safety function requirements; safety functions must remain operative regardless of control system state | **Aligned** — The RCAN invariant and ISO 10218-1:2025's protective stop requirements express the same principle from different layers. ISO 10218-1 specifies the hardware mechanism; RCAN specifies that the protocol layer must not be able to defeat it. |
| **§6 Safe-stop on network loss** — Robot MUST enter a safe stop state if the control connection is lost beyond the session TTL; implicit session renewal MUST NOT occur | Clause 5.x — Control system reliability requirements; robot must reach a safe state on loss of control signal | **Aligned** — RCAN's session TTL and explicit renewal requirement implements the same principle as ISO 10218-1:2025's control system reliability requirements at the networking layer. |
| **§3 SAFETY priority messages** — `Priority.SAFETY` messages MUST be processed first regardless of queue state and MUST NOT be rate-limited | Clause 5.x — Emergency stop requirements; safety-critical signals must be processed with priority and without delay | **Aligned** — RCAN's `Priority.SAFETY` enum value and its processing guarantee directly correspond to the ISO 10218-1:2025 emergency stop signal priority requirement at the protocol layer. |

---

## What ISO 10218-1:2025 Covers That RCAN Does Not

RCAN is a protocol specification for the AI and networking layer. It does not address and does not replace the following ISO 10218-1:2025 requirements:

| ISO 10218-1:2025 Domain | Description |
|---|---|
| **Hardware safety certification** | Mechanical design requirements, material specifications, joint limits, structural integrity |
| **Physical safeguarding** | Guards, interlocks, safety barriers, and light curtains |
| **Risk assessment methodology** | Structured risk assessment process (ISO 12100), hazard identification and risk estimation for the complete robot system |
| **Collaborative operation parameters** | Speed and separation monitoring (SSM), hand guiding, power and force limiting (PFL), safety-rated monitored stop — all defined in ISO 10218-1:2025 and ISO/TS 15066 |
| **Safety-rated control architecture** | Hardware safety integrity levels (SIL/PLe), safety controller design, hardware fault detection |
| **Validation and verification** | System-level safety validation testing procedures |

Robot manufacturers seeking compliance with both frameworks must satisfy ISO 10218-1:2025 for all physical and controller-level requirements, and must additionally implement RCAN for AI agent command provenance, audit, and accountability.

---

## Integration Path

A robot system can be simultaneously ISO 10218-1:2025 compliant and RCAN-compliant. The two frameworks operate at different layers of the system stack and impose no conflicting requirements.

**Layered integration model:**

```
┌─────────────────────────────────────────────────────┐
│         RCAN Layer (AI governance & networking)      │
│  §2 RBAC · §6 Audit · §16 AI Accountability         │
├─────────────────────────────────────────────────────┤
│         Robot Control System                         │
│  Motion planning · Kinematics · Sensor fusion        │
├─────────────────────────────────────────────────────┤
│  ISO 10218-1:2025 Safety Layer                       │
│  Protective stop · Speed/force limits · E-stop       │
└─────────────────────────────────────────────────────┘
```

**Key integration points:**

1. **Audit trail integration:** RCAN's §6 audit log SHOULD include a reference to the robot's ISO 10218-1:2025 safety function state at the time of each COMMAND. This links the AI decision record to the physical safety record.

2. **Safety signal passthrough:** RCAN's `Priority.SAFETY` message type MUST map to the robot's ISO 10218-1:2025 protective stop mechanism. The RCAN layer must not interpose any latency or queuing on SAFETY messages reaching the hardware safety layer.

3. **HiTL gate compliance:** When §16.3 HiTL authorization is pending, the robot MUST NOT proceed — this is an additive constraint on top of ISO 10218-1:2025 safety functions, not a replacement. Both must be satisfied before motion.

4. **Access control continuity:** RCAN's JWT-based RBAC (§2) governs network-layer command authorization. ISO 10218-1:2025 cybersecurity requirements govern controller-level access. Implementations SHOULD propagate RCAN role information to the controller access control system to maintain a unified authorization posture.

No provision of RCAN overrides or supersedes any ISO 10218-1:2025 safety requirement. RCAN's §6 invariant "Local safety always wins" explicitly preserves ISO 10218-1:2025 protective functions from remote override.

---

## Relation to ISO 10218-2 and ANSI/A3 R15.06-2025

**ISO 10218-2:2011 (system integration)** extends the scope of Part 1 to the integrated robot system, including the task environment, workpiece, and ancillary equipment. The AI accountability gap identified in ISO 10218-1:2025 is equally present in ISO 10218-2, which similarly has no provisions for AI model identity, confidence gating, or human-in-the-loop authorization. RCAN's §16 provisions apply to the integrated system and fill this gap in both parts.

**ANSI/A3 R15.06-2025** is the US national adoption of ISO 10218-1 and ISO 10218-2. It incorporates the same cybersecurity requirements and contains the same AI-layer gap. RCAN-compliant implementations satisfy the AI accountability provisions that R15.06-2025 does not address, providing US manufacturers with a clear path to EU AI Act compliance alongside R15.06-2025 hardware compliance.

The gap analysis in this document applies equally to ISO 10218-2:2011 and ANSI/A3 R15.06-2025. A separate alignment document for ISO 10218-2 is anticipated.

---

*For questions regarding this alignment document, contact: [rcan.dev](https://rcan.dev) | [github.com/continuonai/rcan-spec](https://github.com/continuonai/rcan-spec)*
