# Conformity Assessment Template for RCAN-Based Robot AI Systems

**Regulation:** EU AI Act (Regulation 2024/1689), Article 43  
**RCAN spec version:** 1.6  
**Document type:** Conformity assessment template  
**Status:** Normative guidance  
**Applies from:** 2 August 2026  

---

## Overview

Article 43 specifies conformity assessment procedures for high-risk AI systems. For AI systems under Annex III (including autonomous robots), providers must follow either:
- **Annex VI** — Internal control (self-assessment by provider), OR
- **Annex VII** — Assessment by a notified body (required when no harmonised standard covers the system)

This template supports **Annex VI internal control**, which is the default path for RCAN-compliant systems that follow the harmonised technical requirements.

---

## Section 1 — System Identification

| Field | Value |
|---|---|
| Product / system name | [FILL] |
| Model designation | [FILL] |
| RCAN config identifier | [FILL: e.g., config/arm.rcan.yaml] |
| RRN | [FILL] |
| Software version | [FILL: e.g., OpenCastor v2026.3.x] |
| RCAN spec version | [FILL: e.g., 1.6] |
| Provider (legal entity) | [FILL] |
| Provider address | [FILL] |
| EU representative (if non-EU provider) | [FILL or N/A] |
| Assessment date | [FILL] |
| Assessor | [FILL: name + role] |

---

## Section 2 — Intended Purpose Declaration

```
This AI system is intended to:
  [FILL: describe primary intended use — e.g., "perform pick-and-place manipulation
  tasks on a tabletop work surface under operator supervision, in an indoor
  environment without public access"]

Intended users:
  [FILL: e.g., trained operators with robotics background; no untrained public access]

Intended operating environment:
  [FILL: e.g., laboratory, workshop, domestic; indoor; stable lighting]

Foreseeable misuse addressed in risk assessment:
  [FILL: reference to art9-risk-assessment-template.md completion]
```

---

## Section 3 — Technical Documentation Checklist

Per Article 11 + Annex IV, the technical file must contain:

| Document | Location | Status |
|---|---|---|
| System description and intended purpose | `docs/system-description.md` | [FILL: ✅/❌] |
| Risk assessment (Art. 9) | `docs/compliance/art9-risk-assessment-template.md` (filled) | [FILL] |
| Data governance (training data provenance) | `docs/training-provenance.md` | [FILL] |
| Design specification | `config/<robot>.rcan.yaml` (git-versioned) | [FILL] |
| Conformance report | `castor validate --json` output | [FILL] |
| Test and validation results | CI artifacts + `castor test` output | [FILL] |
| Monitoring and logging description | `docs/compliance/art17-qms-template.md` §3 | [FILL] |
| Transparency disclosure (Art. 13) | `docs/compliance/art13-transparency-template.md` (filled) | [FILL] |
| QMS description (Art. 17) | `docs/compliance/art17-qms-template.md` (filled) | [FILL] |
| Instructions for use | `docs/instructions-for-use.md` | [FILL] |
| EU Declaration of Conformity | `docs/compliance/declaration-of-conformity.md` | [FILL] |
| Post-market monitoring plan | `docs/compliance/art17-qms-template.md` §3 | [FILL] |

---

## Section 4 — Standards and Specifications Applied

| Standard / specification | Relevance | Applied? |
|---|---|---|
| RCAN v1.6 | Robot communication + AI control protocol | [FILL] |
| ISO 12100:2010 | Risk assessment methodology | [FILL] |
| IEC 62443-4-1 | Secure development lifecycle | [FILL — see iec-62443-alignment.md] |
| ISO 10218-1/2 | Industrial robot safety | [FILL — see iso-10218-alignment.md] |
| ISO/IEC 23894 | AI risk management | [FILL] |
| NIST AI RMF | AI risk management framework | [FILL — see nist-ai-rmf-alignment.md] |
| IEC 61508 / SIL | Functional safety (if applicable) | [FILL — see sil-ple-declarations.md] |

---

## Section 5 — RCAN Conformance Evidence

RCAN v1.6 conformance is the primary technical evidence of compliance with the harmonised requirements of Articles 9–17.

**Required minimum score:** 80/100, with 0 `fail`-level findings on safety checks.

```
RCAN conformance report:
  Date:         [FILL]
  Tool version: castor validate [version]
  Config:       [FILL path]
  Score:        [FILL]/100
  Passed:       [FILL]
  Warned:       [FILL]
  Failed:       0  ← required

Key passing checks (must all pass for conformity):
  ✅ safety.local_safety_wins
  ✅ safety.emergency_stop_configured
  ✅ safety.watchdog_configured
  ✅ safety.confidence_gates_configured
  ✅ rcan_v15.estop_qos_bypass
  ✅ rcan_v15.consent_declared
  ✅ rcan_v15.loa_enforcement
  ✅ rcan_v16.hardware_safety_core
  ✅ p66 block present
```

---

## Section 6 — Human Oversight Measures

Per Article 14, describe the human oversight measures implemented:

```
Oversight mechanism 1 — Level of Autonomy controls:
  LoA [FILL: 0-3] configured. At this level:
  [FILL: describe what requires human approval and what is autonomous]

Oversight mechanism 2 — Emergency stop:
  [FILL: describe physical ESTOP — location, mechanism, test frequency]
  Software ESTOP: castor ESTOP command; P66 invariant (cannot be overridden by AI)

Oversight mechanism 3 — Confidence gates:
  Minimum confidence threshold: [FILL: e.g., 0.7]
  Behavior below threshold: [FILL: e.g., prompt operator for confirmation]

Oversight mechanism 4 — Audit trail:
  All commands logged with timestamp, session_id, AI reasoning trace
  Retention: [FILL: days]
  Access: [FILL: who can review]
```

---

## Section 7 — Accuracy, Robustness, Cybersecurity Declaration

```
Accuracy:
  Tested task types: [FILL]
  Success rate on test suite: [FILL]%
  Evaluation dataset: [FILL: describe or reference]

Robustness:
  Adversarial input handling: local_safety_wins prevents remote override
  Network failure behavior: [FILL]
  Sensor failure behavior: [FILL]

Cybersecurity:
  Authentication: [FILL]
  Encryption in transit: [FILL]
  Security review date: [FILL]
  Penetration test: [FILL or N/A]
  Known vulnerabilities: [FILL: none / list CVEs]
```

---

## Section 8 — Post-Market Monitoring Commitment

```
Monitoring system: OpenCastor trajectory logging (trajectories.db)
KPIs monitored: ESTOP rate, P66 block rate, error rate, model drift score
Review cadence: [FILL: e.g., monthly]
Serious incident reporting: Within 15 days to [FILL: national authority]
Contact for incident reports: [FILL: email]
```

---

## Section 9 — Conformity Declaration

> By signing below, the provider declares that the AI system described in this document conforms to the requirements of Regulation (EU) 2024/1689 (EU AI Act), Articles 9–17, as applicable to high-risk AI systems under Annex III.

| Role | Name | Signature | Date |
|---|---|---|---|
| Legal representative | [FILL] | | [FILL] |
| Technical responsible | [FILL] | | [FILL] |

**This document does not constitute a CE marking or formal notified body assessment. It records the provider's internal conformity determination under Annex VI.**

---

## Appendix — RCAN Alignment to EU AI Act Articles

| Article | Requirement | RCAN control |
|---|---|---|
| Art. 9 | Risk management system | `castor validate`; P66; confidence gates; ESTOP |
| Art. 10 | Data governance | Training data provenance doc; audit log |
| Art. 11 | Technical documentation | RCAN config (git-versioned); this template |
| Art. 12 | Record keeping | `audit_log`; trajectory logging |
| Art. 13 | Transparency | Art. 13 template; `metadata` fields |
| Art. 14 | Human oversight | LoA enforcement; R2RAM consent; ESTOP invariant |
| Art. 15 | Accuracy, robustness, cybersecurity | Conformance suite; dual-model review; security block |
| Art. 17 | Quality management | QMS template; CI/CD; post-market monitoring |
