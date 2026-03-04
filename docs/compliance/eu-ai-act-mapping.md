# RCAN Protocol — EU AI Act Compliance Mapping

**Document type:** Regulatory compliance mapping  
**RCAN spec version:** 1.1 (rcan.dev/spec)  
**Regulation:** Regulation (EU) 2024/1689 of the European Parliament and of the Council laying down harmonised rules on artificial intelligence (Artificial Intelligence Act)  
**Classification focus:** High-risk AI systems — Annex III, Category 3 (safety components of products)  
**Target audience:** Robot OEMs, compliance teams, system integrators operating in EU markets  
**Status:** Informative  
**Last updated:** 2026-03-03  

---

## Overview

The EU AI Act (Regulation (EU) 2024/1689), in force since August 2024, classifies AI systems embedded in or operating as safety components of machinery and industrial robots as **high-risk AI systems** under Annex III. This classification covers autonomous robots operating in safety-critical or human-proximate environments — including industrial robots, collaborative robots (cobots), mobile platforms, and service robots deployed in contexts where malfunction could endanger persons.

The obligations applicable to high-risk AI systems under Chapter III, Section 2 of the EU AI Act apply from **2 August 2026**. Providers and deployers of in-scope robot AI systems must implement technical controls addressing risk management, record-keeping, transparency, and human oversight by that date.

RCAN (Robot Communication and Addressing Network) provides protocol-level implementations for several mandatory technical requirements of the EU AI Act. This document maps RCAN provisions to the applicable articles, identifies coverage scope, and specifies gaps that remain the responsibility of the provider or deployer organization.

This document does not constitute legal advice. Compliance determination for any specific product or deployment requires qualified legal and technical assessment.

---

## Annex III Classification Basis

Autonomous robots are classified as high-risk AI systems under Annex III, point 3(a), as AI systems intended to be used as safety components of machinery within the scope of the Machinery Regulation (EU) 2023/1230, or as AI systems that themselves constitute such machinery. Where an AI system makes decisions that control robot motion, manipulator operation, or autonomous navigation in environments shared with or proximate to humans, this classification applies.

Deployers bear primary compliance obligations under Article 26 for the duration of the system's operation. Providers bear obligations under Articles 9–17 for the system's design and documentation.

---

## Article Mapping Table

| EU AI Act Article | Requirement Summary | RCAN Provision | Coverage |
|---|---|---|---|
| **Art. 9** — Risk management system | Providers must establish, document, and maintain a risk management system for the AI system's lifecycle, including identification of known and reasonably foreseeable risks, and implementation of risk management measures | §8 RCAN config: `agent.safety_stop` flag and `latency_budget_ms` constraint; §16.2 confidence gates: per-scope minimum confidence thresholds that prevent command dispatch when model confidence falls below defined limits | **Partial** — RCAN provides protocol-level risk controls (confidence gating, safety stop integration) that constitute technical risk management measures. However, Art. 9 requires a comprehensive system-level risk management process including documentation, testing, and lifecycle review. RCAN protocol controls are evidence of technical measures within that process, not a substitute for the process itself. |
| **Art. 12** — Record keeping | High-risk AI systems must automatically log events during operation to enable post-deployment reconstruction of events. Logs must include: operational periods, reference database checks, input data summary, identity of natural persons involved in verification | §6 Audit trail: COMMAND and CONFIG messages logged with principal identity, RURI, timestamp (ms), message_id, outcome (`ok`/`blocked`/`error`); §16.1 AI block in every audit record: model provider, model identifier, inference confidence, inference latency (ms), thought_id, escalation flag; QuantumLink-Sim: HKDF-SHA256 + BB84 QKD simulation commitment chain providing tamper-evident log integrity | **Full (for the logging requirement)** — RCAN's §6 audit trail satisfies the record-keeping requirement. The QuantumLink-Sim commitment chain directly addresses the "reconstruction" requirement by providing cryptographically chained records that cannot be altered without detection. §16.1 extends logging to include AI model identity and confidence — information Art. 12 implicitly requires but does not specify at this level of detail. Deployers must ensure log retention periods comply with applicable requirements (Art. 12(1) specifies a minimum of 6 months, or longer if sector-specific rules apply). |
| **Art. 13** — Transparency and provision of information to deployers | High-risk AI systems must be sufficiently transparent to enable deployers to interpret output and use the system appropriately. Technical documentation must describe system purpose, performance, limitations, and decision logic to the extent possible | §16.4 Thought log: AI reasoning records (prompt, reasoning chain, action taken, confidence, thought_id) accessible via `GET /api/thoughts/<id>` with role-gated access; OWNER+ role required to retrieve the `reasoning` field | **Partial** — RCAN's thought log provides a queryable technical transparency mechanism that enables deployers to inspect AI decision reasoning on a per-command basis. This satisfies the technical capability requirement. However, Art. 13 also imposes disclosure obligations — active provision of information to deployers and users — which remain the responsibility of the provider. RCAN enables compliance with the technical layer; the disclosure process must be implemented by the organization. |
| **Art. 14** — Human oversight | High-risk AI systems must be designed to enable effective human oversight during operation. Measures must allow natural persons to monitor, understand, intervene in, override, or halt the AI system. Where appropriate, the system must implement human-machine interface tools | §16.3 HiTL Gates: action types declared as requiring human authorization MUST NOT be dispatched until an AUTHORIZE message is received from a principal with OWNER or higher role; pending actions emit `PENDING_AUTH` status; the gate is enforced at the protocol layer and cannot be bypassed by the AI agent | **Full (for the protocol mechanism)** — RCAN's §16.3 HiTL gates implement Art. 14's human oversight requirement at the protocol layer. The authorization requirement is not an application-layer check that the AI can reason around — it is a structural protocol constraint. The `PENDING_AUTH` → `AUTHORIZE` flow provides the human-machine interface tool. Deployers must configure HiTL gates for action types appropriate to their deployment context; the protocol enforces whatever gate configuration is declared. |
| **Art. 17** — Quality management system | Providers must implement a quality management system covering: AI system design and development methodology, testing and validation procedures, performance monitoring, change management | §16.2 Confidence gates: minimum confidence thresholds per action scope enforce a protocol-level performance floor; §16.1 `inference_latency_ms` logged in every audit record provides latency performance data for monitoring | **Partial** — RCAN provides protocol-level performance controls and monitoring data that constitute technical inputs to a quality management system. Art. 17 requires a broader organizational quality management process (documented procedures, staff responsibilities, post-market monitoring integration) that RCAN supports but does not constitute. |
| **Art. 26** — Obligations of deployers | Deployers must use high-risk AI systems according to instructions, assign human oversight, ensure input data relevance, monitor system operation, and report serious incidents. Deployers must take appropriate technical and organizational measures | §2 RBAC: LEASEE role defines the deployer's operational authority scope in the protocol — LEASEE principals have control and monitoring permissions but cannot modify safety configuration (requires OWNER) or system configuration (requires CREATOR); the protocol enforces this authority boundary | **Partial** — RCAN's RBAC system encodes deployer authority boundaries in the protocol layer, ensuring that deployers operate within their defined scope. This supports the Art. 26 obligation to use systems according to instructions by making scope violations structurally impossible at the protocol layer. Organizational obligations (incident reporting, human oversight assignment, input data governance) remain the deployer's responsibility. |

---

## Gaps: What the EU AI Act Requires That RCAN Does Not Address

RCAN is a protocol specification. The following EU AI Act requirements are organizational, procedural, or regulatory in nature and are outside the scope of any protocol:

| EU AI Act Requirement | Gap Description |
|---|---|
| **Art. 43 — Conformity assessment** | High-risk AI systems must undergo conformity assessment before market placement. RCAN audit records and thought logs provide technical evidence for the assessment, but RCAN does not conduct assessments and does not issue declarations of conformity. The conformity assessment must be performed by the provider (and in many cases a notified body). |
| **Art. 49 — Registration in EU AI database** | Providers and deployers of high-risk AI systems must register the system in the EU AI public database established under Art. 71. This is an organizational and regulatory obligation with no protocol-level analogue. RCAN provides the robot identity (RURI) that should be referenced in the registration, but registration itself is outside RCAN scope. |
| **Art. 72 — Post-market monitoring** | Providers must implement a post-market monitoring system to actively collect and review operational data from deployed high-risk AI systems. RCAN's audit trail and thought logs provide the data infrastructure that feeds such a system, but a post-market monitoring system also requires data collection pipelines, analysis procedures, incident escalation processes, and feedback loops into the quality management system. RCAN supports this but does not constitute it. |
| **CE marking** | High-risk AI systems embedded in machinery must bear CE marking under the Machinery Regulation before EU market placement. CE marking is a regulatory process requiring conformity assessment and technical file preparation. RCAN has no role in this process. |
| **Art. 9(4) — Risk estimation for unintended uses** | Art. 9 requires risk assessment to address reasonably foreseeable misuse scenarios. This requires human-led risk analysis beyond protocol controls. |
| **Art. 53 — AI regulatory sandboxes** | Participation in regulatory sandboxes is an organizational decision and process. RCAN provides useful audit infrastructure for sandbox evaluation but has no direct role. |

---

## Timing and Urgency

**2 August 2026** is the application date for obligations applicable to high-risk AI systems under Chapter III, Section 2 of the EU AI Act. This includes Articles 9, 12, 13, 14, 15, 16, and 17.

Robot OEMs and integrators deploying AI-driven systems in EU markets must have compliant technical controls in place by this date for systems placed on the market after 2 August 2026. Systems already on the market before that date have a transitional period.

**RCAN adoption timeline relative to this deadline:**

- RCAN v1.1 is available now. §16 AI accountability provisions (model identity, confidence gates, HiTL gates, thought log) are defined in the specification.
- The reference implementation (OpenCastor, github.com/craigm26/OpenCastor) demonstrates RCAN §16 compliance on production hardware (Hailo-8, OAK-D, Raspberry Pi 5).
- QuantumLink-Sim tamper-evident audit chain is implemented in OpenCastor v2026.3.1.16.
- OEMs integrating RCAN today have sufficient lead time to achieve EU AI Act Art. 12 and Art. 14 technical compliance before the August 2026 deadline.

The Art. 43 conformity assessment process, regulatory registration, and quality management system implementation require organizational lead time beyond the protocol integration. OEMs should begin these processes immediately.

---

## How to Cite RCAN in a Conformity Assessment

For compliance teams preparing technical documentation and conformity assessment files, the following guidance applies:

**Article 12 (Record keeping):**
> "The system implements the RCAN v1.1 audit trail specification (rcan.dev/spec §6). All COMMAND and CONFIG messages are logged with principal identity, timestamp (millisecond precision), message_id, and outcome. Each AI-generated command audit record includes model provider, model identifier, inference confidence score, and thought_id per RCAN §16.1. Log integrity is maintained via QuantumLink-Sim HKDF-SHA256 + BB84 QKD simulation commitment chain (OpenCastor v[version]). Logs are retained for [period] and are tamper-evident."

**Article 13 (Transparency):**
> "AI decision reasoning is accessible to authorized principals via the RCAN thought log (rcan.dev/spec §16.4), `GET /api/thoughts/<id>`. The reasoning field is scope-gated to OWNER-level principals or higher. This mechanism satisfies the technical transparency requirement. Disclosure procedures for deployers are documented in [deployer documentation reference]."

**Article 14 (Human oversight):**
> "The system implements RCAN §16.3 Human-in-the-Loop Gates. Action types [list configured action types] are declared as requiring human authorization. The protocol enforces that these actions cannot be dispatched without a signed AUTHORIZE message from a principal holding OWNER or higher role. The authorization gate is structural at the protocol layer and cannot be bypassed by the AI agent. The PENDING_AUTH status message provides the human operator interface for pending authorization requests."

**Key references for technical file:**
- RCAN Protocol Specification v1.1: [rcan.dev/spec](https://rcan.dev/spec)
- §6 Safety Invariants (audit trail, prompt injection defense)
- §16.1 AI Block (model identity in audit records)
- §16.2 Confidence Gates
- §16.3 HiTL Gates
- §16.4 Thought Log
- QuantumLink-Sim specification: [github.com/craigm26/OpenCastor](https://github.com/craigm26/OpenCastor)
- OpenCastor reference implementation: v2026.3.1.16

---

*For questions regarding this compliance mapping, contact: [rcan.dev](https://rcan.dev) | [github.com/continuonai/rcan-spec](https://github.com/continuonai/rcan-spec)*
