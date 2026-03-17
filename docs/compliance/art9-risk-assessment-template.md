# Article 9 — Risk Assessment Template for RCAN-Based Robots

**Regulation:** EU AI Act (Regulation 2024/1689), Article 9  
**Aligned standard:** ISO 12100:2010 (Safety of Machinery — Risk Assessment)  
**RCAN spec version:** 1.6  
**Document type:** Risk assessment template  
**Status:** Normative guidance  
**Applies from:** 2 August 2026  

---

## Purpose

Article 9 requires providers of high-risk AI systems to establish, implement, document, and maintain a risk management system covering the full lifecycle. This template provides an ISO 12100-aligned structure with RCAN-specific controls mapped to each risk element.

**Complete one instance of this template per robot model/deployment configuration.**

---

## Part 1 — System Description

| Field | Value |
|---|---|
| Product name | [FILL] |
| RCAN config file | [FILL: e.g., config/bob-pi4-oakd.rcan.yaml] |
| RRN | [FILL: e.g., RRN-000000000001] |
| RCAN version | [FILL: e.g., 1.6] |
| AI provider | [FILL: e.g., Anthropic Claude Sonnet] |
| Hardware platform | [FILL: e.g., Raspberry Pi 4, SO-ARM101 manipulator] |
| Intended use | [FILL: brief description] |
| Reasonably foreseeable misuse | [FILL: e.g., operating near children, outdoor use beyond rated conditions] |
| Operating environment | [FILL: e.g., indoor, tabletop, shared with humans] |
| Assessment date | [FILL: YYYY-MM-DD] |
| Assessor | [FILL: name, role] |
| Review due | [FILL: date of next review — at minimum annually] |

---

## Part 2 — Hazard Identification

Use this table to enumerate hazards. Add rows as needed.

| ID | Hazard | Source | Affected persons | Severity (1-5) | Probability (1-5) | Risk = S×P |
|---|---|---|---|---|---|---|
| H-01 | Unexpected motion during AI inference | LLM output interpreted as movement command | Operator, bystanders | [FILL] | [FILL] | [FILL] |
| H-02 | Failure to stop on ESTOP command | Software fault or network latency | Operator | [FILL] | [FILL] | [FILL] |
| H-03 | Hallucinated tool call (e.g., motor command with wrong params) | LLM provider error | Hardware | [FILL] | [FILL] | [FILL] |
| H-04 | Unauthorized remote command execution | Compromised API key or token | All | [FILL] | [FILL] | [FILL] |
| H-05 | Privacy breach via camera/sensor data | Unintended data capture or transmission | Bystanders | [FILL] | [FILL] | [FILL] |
| H-06 | Over-reach beyond physical workspace limits | Missing geofence or wrong calibration | Adjacent objects/persons | [FILL] | [FILL] | [FILL] |
| H-07 | Operation in degraded/unsafe environment | Sensor failure not detected | Operator | [FILL] | [FILL] | [FILL] |
| H-08 | [FILL additional hazard] | | | | | |

**Severity scale:** 1=Negligible, 2=Minor injury, 3=Moderate injury, 4=Severe injury, 5=Fatal/catastrophic  
**Probability scale:** 1=Remote, 2=Unlikely, 3=Possible, 4=Likely, 5=Near-certain  
**Risk threshold:** Score ≥12 = unacceptable; 6–11 = ALARP required; ≤5 = acceptable

---

## Part 3 — Risk Controls

Map each hazard to RCAN controls and any additional measures.

### H-01 — Unexpected Motion

| Control layer | RCAN mechanism | Implementation status |
|---|---|---|
| Inherently safe design | `safety.local_safety_wins: true` | [FILL: ✅/❌] |
| Confidence gate | `safety.confidence_gate_threshold: 0.7` | [FILL] |
| Human-in-the-loop | `loa.control.required_consent: true` at LoA <3 | [FILL] |
| Physical safeguard | Hardware ESTOP button / kill switch | [FILL: describe] |
| Residual risk | [FILL: describe remaining risk after controls] | |

### H-02 — ESTOP Failure

| Control layer | RCAN mechanism | Implementation status |
|---|---|---|
| ESTOP bypass invariant | `p66.enabled: true`; SAFETY messages bypass consent | [FILL] |
| Watchdog | `safety.watchdog.timeout_s: 10` | [FILL] |
| Hardware killswitch | Independent of software stack | [FILL: describe] |
| Test frequency | ESTOP tested at [FILL: e.g., start of each session] | [FILL] |
| Residual risk | | |

### H-03 — Hallucinated Tool Call

| Control layer | RCAN mechanism | Implementation status |
|---|---|---|
| Output validation | `safety.confidence_gate_threshold` | [FILL] |
| Forbidden params | `_FORBIDDEN_KEYS` enforced in optimizer | [FILL] |
| Dual-model review | `brain.secondary_model` drift detection | [FILL] |
| Audit trail | `audit_log.enabled: true` | [FILL] |
| Residual risk | | |

### H-04 — Unauthorized Remote Command

| Control layer | RCAN mechanism | Implementation status |
|---|---|---|
| Authentication | Firebase Auth UID verification | [FILL] |
| LOA enforcement | `loa.control.required_loa: 3` for physical commands | [FILL] |
| R2RAM consent | `consent.require_consent_above_scope: control` | [FILL] |
| TLS in transit | `security.tls_required: true` | [FILL] |
| Residual risk | | |

### H-05 — Privacy Breach

| Control layer | RCAN mechanism | Implementation status |
|---|---|---|
| Opt-in data sharing | `metadata.public_profile: false` (default) | [FILL] |
| Local-only inference | `agent.provider: ollama` option | [FILL] |
| Retention policy | `audit_log.retention_days: 90` | [FILL] |
| Consent disclosure | Art. 13 transparency template | [FILL] |
| Residual risk | | |

### H-06 — Workspace Overreach

| Control layer | RCAN mechanism | Implementation status |
|---|---|---|
| Geofence | `geofence.enabled: true`; bounds defined | [FILL] |
| ESTOP distance | `safety.emergency_stop_distance: 0.3` | [FILL] |
| Physical limits | Hardware endstops / joint limits | [FILL: describe] |
| Residual risk | | |

### H-07 — Degraded Environment

| Control layer | RCAN mechanism | Implementation status |
|---|---|---|
| Offline mode | `offline_mode.enabled: true`; safe behavior defined | [FILL] |
| Sensor health check | `hardware.camera_configured`; health monitoring | [FILL] |
| Safe-state behavior | `offline_mode.safe_behavior: halt` | [FILL] |
| Residual risk | | |

---

## Part 4 — Residual Risk Summary

After all controls applied:

| Hazard | Pre-control risk | Post-control risk | Acceptable? |
|---|---|---|---|
| H-01 Unexpected motion | [FILL] | [FILL] | [FILL] |
| H-02 ESTOP failure | [FILL] | [FILL] | [FILL] |
| H-03 Hallucinated tool call | [FILL] | [FILL] | [FILL] |
| H-04 Unauthorized command | [FILL] | [FILL] | [FILL] |
| H-05 Privacy breach | [FILL] | [FILL] | [FILL] |
| H-06 Workspace overreach | [FILL] | [FILL] | [FILL] |
| H-07 Degraded environment | [FILL] | [FILL] | [FILL] |

**Overall residual risk determination:** [FILL: Acceptable / ALARP / Unacceptable]

If any residual risk is unacceptable, document corrective actions and re-assess before deployment.

---

## Part 5 — RCAN Conformance as Risk Evidence

Run `castor validate --config <robot.rcan.yaml> --json` and attach output. A score ≥80/100 with 0 safety failures is required as a prerequisite for deployment.

**Required passing checks:**
- `safety.local_safety_wins` ✅
- `safety.emergency_stop_configured` ✅
- `safety.watchdog_configured` ✅
- `safety.confidence_gates_configured` ✅
- `rcan_v15.estop_qos_bypass` ✅
- `rcan_v15.consent_declared` ✅
- `p66` block present ✅

**Last conformance run:**

```
Date:    [FILL]
Score:   [FILL]/100
Passed:  [FILL]
Warned:  [FILL]
Failed:  [FILL]
```

---

## Part 6 — Review and Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Technical assessor | [FILL] | | [FILL] |
| Safety officer | [FILL] | | [FILL] |
| Product owner | [FILL] | | [FILL] |

**Next review date:** [FILL — at minimum 12 months, or on any major software/hardware change]
