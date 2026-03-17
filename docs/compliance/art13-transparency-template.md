# Article 13 — Transparency to Users: RCAN Disclosure Template

**Regulation:** EU AI Act (Regulation 2024/1689), Article 13  
**RCAN spec version:** 1.6  
**Document type:** Compliance template (fill in robot-specific fields)  
**Status:** Normative guidance  
**Applies from:** 2 August 2026  

---

## Purpose

Article 13 requires that high-risk AI systems be designed and developed to allow deployers to fulfill their obligation to inform natural persons that they are interacting with or subject to decisions made by a high-risk AI system.

This template provides RCAN-compatible disclosure text that robot OEMs and deployers can adapt to their product. Sections marked `[FILL]` must be completed by the responsible organization.

---

## Section 1 — System Identity Disclosure

> **RCAN mapping:** `metadata.robot_name`, `metadata.rrn`, `rcan_protocol.capabilities`

**Disclosure text (adapt as needed):**

```
This device is an AI-assisted robotic system.

System name: [FILL: product name]
Model:        [FILL: hardware model]
AI provider:  [FILL: e.g., Anthropic Claude, Google Gemini, Ollama/local model]
RCAN version: [FILL: e.g., 1.6]
Registry ID:  [FILL: RRN — e.g., RRN-000000000001]
Operator:     [FILL: organization or individual deployer name]
Contact:      [FILL: email or URL for questions]
```

**Integration note:** The RCAN `metadata` block in your robot's `.rcan.yaml` config provides these identifiers. The `robot_name` and `rrn` fields can be read via the `/status` endpoint at runtime.

---

## Section 2 — Capabilities and Limitations

> **RCAN mapping:** `agent.capabilities`, `rcan_protocol.capabilities`, `multimodal`

**Disclosure text:**

```
AI capabilities:
  - [FILL: e.g., natural language instruction following]
  - [FILL: e.g., visual scene understanding via camera]
  - [FILL: e.g., autonomous navigation in mapped environments]

Known limitations:
  - This system may make errors in ambiguous or out-of-distribution situations
  - Performance may degrade in low-light, high-noise, or network-degraded conditions
  - The system does not have awareness of [FILL: e.g., legal obligations, property rights]
  - Unsupported tasks: [FILL: list explicitly out-of-scope tasks]
```

---

## Section 3 — Human Oversight Statement

> **RCAN mapping:** `loa`, `consent`, `p66`

**Disclosure text:**

```
Human oversight:
  This system operates under Level of Autonomy (LoA) [FILL: 0-3] as defined in the
  RCAN specification. At this level:

  LoA 0 (Fully supervised): All actions require explicit human approval.
  LoA 1 (Status-only autonomous): Robot reports status; humans approve all commands.
  LoA 2 (Supervised autonomous): Robot acts autonomously within defined scope; 
         humans can override at any time.
  LoA 3 (High autonomy): Robot acts autonomously with human oversight mechanisms
         via physical controls.

  Emergency stop: This system implements an unconditional emergency stop [FILL: describe
  physical mechanism — e.g., hardware kill switch on left panel, voice command "STOP"].
  The emergency stop cannot be overridden by software or AI model output.
```

---

## Section 4 — Data and Logging Disclosure

> **RCAN mapping:** `audit_log`, `thought_log_enabled`, `trajectory_logging`

**Disclosure text:**

```
Data collection:
  This system logs the following data during operation:
  - Command history: all instructions received and executed [FILL: retention period]
  - Decision rationale: AI reasoning traces [FILL: if thought_log_enabled: true]
  - Sensor data: [FILL: describe — e.g., camera frames, lidar scans, retained for X days]
  - Performance metrics: latency, error rates, skill invocations

  Data location: [FILL: e.g., local SQLite at ~/.castor/memory.db; no cloud transmission]
  Access: [FILL: who can access logs — e.g., system operator only via CLI]
  Retention: [FILL: e.g., 90 days rolling, then auto-deleted]
  GDPR basis: [FILL: if applicable — e.g., legitimate interest, consent]
```

---

## Section 5 — Accuracy, Robustness, and Cybersecurity

> **RCAN mapping:** `security`, `safety.local_safety_wins`, `p66`

**Disclosure text:**

```
Accuracy:
  - Task success rate: [FILL: e.g., >95% on tested scenarios per eval suite]
  - Safety intervention rate: [FILL: e.g., ESTOP triggered in <0.1% of sessions]
  - Confidence gate threshold: [FILL: e.g., 0.7 minimum confidence before physical action]

Robustness:
  - Network failure behavior: [FILL: e.g., halts and waits for reconnection]
  - Sensor failure behavior: [FILL: e.g., enters safe mode, alerts operator]
  - Adversarial input: local_safety_wins=true prevents remote command override of safety

Cybersecurity:
  - Access control: [FILL: e.g., RCAN LoA enforcement, TLS in transit]
  - Authentication: [FILL: e.g., Firebase Auth with UID verification]
  - Security contact: [FILL: security disclosure email]
```

---

## Section 6 — RCAN Conformance Reference

**RCAN specification:** https://rcan.dev/spec  
**Conformance check:** Run `castor validate --config your-robot.rcan.yaml` to confirm all Art. 13 fields are populated.

**Relevant RCAN v1.6 conformance checks that verify Art. 13 readiness:**
- `safety.local_safety_wins` — ensures local safety cannot be overridden
- `rcan_v15.consent_declared` — verifies consent block exists
- `rcan_v15.loa_enforcement` — verifies LoA scopes are defined
- `rcan_v16.human_identity_loa` — verifies LoA 3 human identity requirements
- `hardware.emergency_stop_configured` — verifies ESTOP distance/mechanism declared

---

## Checklist

Before August 2026:

- [ ] System identity disclosure posted where users interact with the robot
- [ ] Capabilities and limitations document available to deployers and operators
- [ ] Human oversight statement incorporated into user manual
- [ ] Data logging disclosure included in privacy notice
- [ ] Accuracy and robustness figures measured and documented
- [ ] Security contact designated and published
- [ ] RCAN conformance score ≥80/100 (run `castor validate`)
