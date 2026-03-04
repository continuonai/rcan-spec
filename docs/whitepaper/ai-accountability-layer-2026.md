# AI Decision Accountability at the Protocol Layer: Addressing the Gap in ISO 10218-1:2025

**Document type:** Technical brief  
**Prepared by:** RCAN Working Group / continuonai  
**Target audience:** ISO/TC 299 WG3, A3 standards committee, CEN/CENELEC JTC 21, robot safety engineers, conformity assessment bodies  
**RCAN specification:** v1.1 — [rcan.dev/spec](https://rcan.dev/spec) | [github.com/continuonai/rcan-spec](https://github.com/continuonai/rcan-spec)  
**Reference implementation:** OpenCastor v2026.3.3.0 — [github.com/craigm26/OpenCastor](https://github.com/craigm26/OpenCastor)  
**Date:** March 2026  

---

## Abstract

The 2025 revision of ISO 10218-1 introduced cybersecurity requirements for industrial robots for the first time. These requirements address access control and audit logging at the system level but do not address the AI layer: which model produced a command, at what confidence level, under what authority, and whether human oversight was required before execution. As AI-driven robots move from research to industrial deployment, this gap creates liability and compliance risk — particularly under the EU AI Act's high-risk AI system requirements taking effect August 2026. This brief describes RCAN (Robot Communication and Addressing Network), an open protocol specification that defines AI accountability primitives at the protocol layer. Safety standards state conformity requirements — they do not prescribe how manufacturers achieve them. RCAN's role is to provide the communication infrastructure that makes conformity *verifiable*: a standardized, tamper-evident signal carrying model identity, confidence, and human-oversight state that a conformity assessment body can interrogate. This brief describes how RCAN's provisions relate to the accountability and logging requirements in ISO 10218-1:2025 and EU AI Act Articles 12–14, not as a compliance recipe, but as infrastructure that makes those requirements demonstrable. RCAN is not a competing standard; it is designed for adoption by, or incorporation into, existing standards. It is open, independently implementable, and carries no product dependencies.

---

## 1. The Gap: What ISO 10218-1:2025 Doesn't Address

### 1.1 A Brief History of ISO 10218 Revisions

ISO 10218 was first published in 1992 as a response to early industrial robot deployments. It established foundational hardware safety requirements: protective stops, speed limits, safeguarding, and risk assessment processes. The 2006 and 2011 revisions expanded coverage to include collaborative robot operation — a significant step as robots began operating in proximity to humans rather than behind barriers.

The 2025 revision is notable for a different kind of expansion: for the first time, ISO 10218-1 addresses cybersecurity. Clause 5.4 introduces requirements for access control, software integrity, and audit logging in the robot control system. This reflects the reality that modern industrial robots are networked systems — connected to factory networks, cloud services, and increasingly to AI inference pipelines. The security of the control system has become a safety matter.

### 1.2 What the 2025 Cybersecurity Requirements Cover

The Clause 5.4 cybersecurity requirements in ISO 10218-1:2025 address several important areas:

- **Access control:** Authentication and authorization requirements for access to the robot control system
- **Audit logging:** Recording of access events and control system actions
- **Software integrity:** Requirements for the integrity of controller software and firmware
- **Network security:** Protections for networked robot control systems

These are meaningful additions. They ensure that human operators who access the control system are authenticated, that their actions are logged, and that the control software has not been tampered with.

### 1.3 What the 2025 Revision Does Not Cover

The cybersecurity requirements in ISO 10218-1:2025, as valuable as they are, were developed in the context of traditional control system security — firmware, network access, and operator authentication. They were not designed for, and do not address, the AI layer that is now appearing in robot systems.

Specifically, ISO 10218-1:2025 contains no requirements addressing:

- **AI model identity:** Which AI model produced the command that caused a robot action? Which provider operated that model? If a robot causes harm, this information is essential for forensic investigation — yet current standards create no obligation to record it.
- **Confidence-based command gating:** AI models produce outputs at varying levels of confidence. A model that is 95% confident a path is clear is not the same as one that is 52% confident. Traditional mechanical control systems do not have this failure mode; AI systems do. ISO 10218-1:2025 has no mechanism to gate command execution on model confidence.
- **Human-in-the-loop authorization for AI decisions:** ISO 10218-1:2025 includes requirements for collaborative robot safety — speed and force limits, safety-rated monitored stop. These are reactive, hardware-layer controls. The standard has no concept of requiring human authorization before an AI agent dispatches a command of a defined type, regardless of the action's physical safety parameters.
- **Forensic AI decision accountability:** If an AI-driven robot causes a workplace injury, what was the model's reasoning? What was presented to the model? What did it decide, and why? ISO 10218-1:2025's logging requirements capture operator access events; they do not capture AI decision provenance.

### 1.4 Why This Gap Matters

The failure modes of AI systems are different in kind from the failure modes of mechanical control systems. A servo motor that fails does so in ways that physical engineering can model, test, and bound. An AI language model can hallucinate — produce a plausible-sounding instruction that is entirely wrong. It can be miscalibrated in confidence — highly confident about an action it has no basis for certainty on. It can fail under distribution shift — performing reliably in testing environments and failing in deployment when conditions differ from training data.

These failure modes require different safety controls:

| Mechanical failure mode | AI failure mode | Required control |
|---|---|---|
| Motor overcurrent | Hallucinated command | Prompt injection defense; confidence gating |
| Sensor out of range | Confidence miscalibration | Minimum confidence threshold enforcement |
| Cable break | Distribution shift / model drift | Model identity logging; post-market monitoring |
| Unauthorized access | Prompt injection attack | Input scanning before model invocation |
| Control system tampering | Model substitution | Model identity verification in audit |

ISO 10218-1:2025 addresses the left column. It does not address the right column. As robots become AI-driven, the right column becomes the dominant risk profile.

---

## 2. The Automotive Parallel

### 2.1 SAE J3016 and the Cost of Delay

In 2004, Google began its autonomous vehicle research program. By 2009, it had vehicles driving public roads. The automotive industry and standards bodies moved deliberately: SAE J3016, defining levels of driving automation, was not published until 2014 — five years after the technology was demonstrably deployed.

Those five years were not idle. Automotive manufacturers, technology companies, and regulators each developed their own terminology for automation levels: "autopilot," "self-driving," "autonomous," "highly automated." These terms were used inconsistently, in marketing materials, in media coverage, and in regulatory discussions.

The cost of that semantic fragmentation was not merely academic. Incident investigations in the years that followed revealed that drivers were unclear about the capabilities and limitations of the systems they were using. Regulatory frameworks in different jurisdictions used incompatible definitions. Litigation became complicated by the absence of standardized terms for assigning responsibility. The NTSB's investigation of multiple fatal crashes cited driver misunderstanding of automation levels as a contributing factor — a misunderstanding that standardized, well-communicated definitions of J3016's levels might have reduced.

### 2.2 The Window for Robotics

The robotics industry is at the same inflection point today that automotive was in 2009.

AI-driven robots — systems that receive natural-language instructions, reason about their environment using machine learning models, and take physical actions based on that reasoning — are moving from research to deployment. They are being placed in warehouses, hospitals, elder care facilities, construction sites, and public spaces. The market for AI-enabled robots is expanding rapidly, and the first major deployments are already underway.

The window to define the AI accountability layer at the protocol level is open. Standards committees meet now. The EU AI Act compliance deadline is August 2026. ISO 10218-1:2025 has just been published — the next revision cycle will likely consider AI provisions. The question is not whether AI accountability requirements will be standardized; it is whether the standards will lead or follow the market.

The automotive industry learned that following the market produces fragmentation, confusion, and preventable harm. This brief proposes that the robotics standards community act now.

---

## 3. RCAN: Protocol-Level AI Accountability

RCAN (Robot Communication and Addressing Network) is an open protocol specification that defines how AI-driven robots communicate, identify themselves, authorize commands, and produce auditable records of AI decisions. It operates at the networking and agent governance layer — above the robot control system, below the application.

RCAN is not a product. It is a specification, available at [rcan.dev/spec](https://rcan.dev/spec) and on GitHub at [github.com/continuonai/rcan-spec](https://github.com/continuonai/rcan-spec), published under an open license.

### 3.1 Key Primitives

**Robot URI (RURI) — Global robot identity**

Every RCAN-compliant robot has a globally unique, resolvable identifier: a Robot URI of the form `rcan://registry-domain/manufacturer/model/device-id`. This URI is the robot's address for network communication, its identifier in audit records, and its reference in any regulatory filing or incident report.

Without a globally unique, resolvable robot identity, AI accountability is impossible. You cannot audit the decisions of a robot you cannot identify. RURI is the prerequisite for everything that follows.

**Role-Based Access — Protocol-enforced authority**

RCAN defines five access roles, in ascending order of authority: GUEST, USER, LEASEE, OWNER, and CREATOR. Every command message carries a signed token (JWT) identifying the principal's role. The protocol enforces role permissions at the message layer — not at the application layer, where enforcement can be bypassed by a misconfigured or compromised application.

This maps to ISO 10218-1:2025 Clause 5.4 access control requirements while extending them with AI-specific role semantics: for example, OWNER role is required to authorize human-in-the-loop gates, and CREATOR role is required to modify safety configuration.

**§6 Audit Trail — Conformance requirement**

RCAN makes the audit trail a conformance requirement, not a recommendation. Every COMMAND and CONFIG message MUST produce a log record containing: the principal's identity (RURI), the timestamp in milliseconds, the message_id, and the outcome (accepted, blocked, or error). Implementations that do not produce these records are non-conformant.

This satisfies the spirit of ISO 10218-1:2025 Clause 5.4 audit logging while extending it to the AI command layer, and directly satisfies EU AI Act Article 12 record-keeping requirements.

**§16.1 Model Identity — AI command provenance**

Every audit record for an AI-generated command MUST include:
- The model provider (the organization operating the AI service)
- The model identifier (which specific model produced the output)
- The inference confidence score
- The inference latency in milliseconds
- A thought_id linking to the full reasoning record
- Whether the action was escalated from a fallback model

This is the minimum information needed to investigate an AI-caused incident forensically. No current robot standard requires it. RCAN makes it mandatory.

**§16.2 Confidence Gates — Pre-dispatch AI quality control**

Operators configure a minimum confidence threshold for each action scope (navigation, manipulation, verbal output, etc.) in the robot's configuration file. Before dispatching any AI-generated command, the protocol checks whether the model's reported confidence meets the threshold for that scope. If it does not, the command is rejected — the robot does not act.

This is a structural safety control for an AI-specific failure mode (confidence miscalibration) that has no equivalent in current robot safety standards.

**§16.3 Human-in-the-Loop Gates — Mandatory authorization**

Operators declare, in the robot's configuration file, which action types require explicit human authorization before execution. For declared action types, the protocol enforces a waiting state: the robot cannot proceed until it receives an AUTHORIZE message from a principal holding OWNER or higher role. The pending state is communicated via a PENDING_AUTH message to the human operator's interface.

The AI agent cannot reason around this gate. It is structural at the protocol layer. This directly implements the EU AI Act Article 14 human oversight requirement as a protocol primitive.

**§16.4 Thought Log — Queryable AI reasoning records**

Every AI decision produces a thought record containing: the prompt presented to the model, the model's reasoning output, the action taken, the confidence score, and the thought_id referenced in the audit trail. Thought records are stored and accessible via `GET /api/thoughts/<id>`.

Access to the reasoning field is scope-gated: OWNER or higher role is required to read the model's reasoning. This preserves operator oversight capability while limiting access to sensitive operational data.

Taken together, these primitives define an AI accountability layer that complements ISO 10218-1:2025's hardware safety layer and satisfies the EU AI Act's technical requirements for high-risk AI systems.

---

## 4. Reference Implementation

RCAN's provisions are not theoretical. They are implemented in OpenCastor, an open-source robot firmware and agent runtime available at [github.com/craigm26/OpenCastor](https://github.com/craigm26/OpenCastor).

**Hardware platform:** Hailo-8 neural processing unit, OAK-D depth camera, Raspberry Pi 5 — a commercially available, cost-accessible configuration running on commodity components.

**Test coverage:** 4,665+ automated tests across RCAN protocol conformance, AI integration, safety invariants, and API endpoints. Test results are available in the repository.

**Current version:** v2026.3.1.16, installable via:
```
curl -sL opencastor.com/install | bash
```

**QuantumLink-Sim:** OpenCastor implements a tamper-evident audit chain using HKDF-SHA256 key derivation combined with a BB84 quantum key distribution simulation. Each audit record is cryptographically chained to the previous record. Modification of any historical record is detectable. This addresses the EU AI Act Article 12 requirement for logs that enable reliable reconstruction of events.

The reference implementation demonstrates that RCAN compliance is achievable on production hardware today, at the scale of a single-board computer, without specialized infrastructure.

---

## 5. Standards Alignment

| Requirement Area | RCAN | ISO 10218-1:2025 | EU AI Act | IEC 62443 SL2/SL3 |
|---|---|---|---|---|
| **Robot identity** | ✅ RURI (global, resolvable) | ❌ No robot identity standard | Referenced (Art. 49 registration) | ❌ Not addressed |
| **Access control** | ✅ §2 RBAC (protocol-native, 5 tiers) | ✅ Clause 5.4 (system-level) | ✅ Art. 26 (organizational) | ✅ SL2: authentication & authorization |
| **Audit logging** | ✅ §6 (mandatory, per-message) | ✅ Clause 5.4 (system-level) | ✅ Art. 12 (AI system operation logs) | ✅ SL2: security event logging |
| **Software/firmware integrity** | ✅ §6 prompt injection defense | ✅ Clause 5.4 | ❌ Not specifically addressed | ✅ SL3: advanced integrity controls |
| **AI model identity** | ✅ §16.1 (mandatory in audit) | ❌ No provision | ✅ Art. 12 (implicitly required) | ❌ No provision |
| **Confidence-based gating** | ✅ §16.2 (configurable thresholds) | ❌ No provision | ✅ Art. 9 (risk measures) | ❌ No provision |
| **Human-in-the-loop authorization** | ✅ §16.3 (structural protocol gate) | ❌ No provision | ✅ Art. 14 (human oversight) | ❌ No provision |
| **AI reasoning transparency** | ✅ §16.4 (thought log, scope-gated) | ❌ No provision | ✅ Art. 13 (transparency) | ❌ No provision |
| **Protective stop / emergency stop** | ✅ §6 (local safety wins; SAFETY priority) | ✅ Clause 5.x (hardware requirement) | ❌ Not addressed at hardware level | ✅ SL2: functional safety integration |
| **Hardware safety certification** | ❌ Out of RCAN scope | ✅ Full coverage | ✅ Art. 43 (conformity assessment) | ❌ Out of IEC 62443 scope |
| **Physical safeguarding** | ❌ Out of RCAN scope | ✅ Full coverage | ❌ Out of AI Act scope | ❌ Out of IEC 62443 scope |
| **Risk assessment methodology** | ❌ Out of RCAN scope | ✅ Full coverage (ISO 12100 reference) | ✅ Art. 9 (lifecycle process) | ✅ SL: risk assessment |
| **Post-market monitoring** | 🔶 Audit trail supports it | ❌ Not addressed | ✅ Art. 72 (mandatory) | 🔶 Logging supports it |
| **Tamper-evident log integrity** | ✅ QuantumLink-Sim commitment chain | ❌ Not specified | ✅ Art. 12 (reconstruction requirement) | ✅ SL3: log integrity |

*Legend: ✅ = Addressed, ❌ = Not addressed, 🔶 = Partial / supporting evidence only*

This table illustrates that RCAN, ISO 10218-1:2025, the EU AI Act, and IEC 62443 each address different domains. Conformity assessment for an AI-driven industrial robot will draw on all four frameworks. RCAN fills the AI accountability layer that each of the other frameworks leaves open — providing the verifiable signal that makes the accountability requirements in those standards demonstrable.

---

## 6. Path to Standardization

RCAN is an open specification, not a product. Its provisions are designed to be evaluated, adopted, modified, or incorporated by standards bodies. Adoption does not require use of any specific implementation.

The current specification (v1.1) is a working draft. It has been published openly to invite technical review by the robot safety engineering community, including members of ISO/TC 299 WG3, the A3 standards committee, and CEN/CENELEC JTC 21.

**Proposed engagement:**

- **ISO/TC 299 WG3** (industrial robot safety — the committee responsible for ISO 10218): RCAN's §16 provisions represent a candidate technical basis for AI accountability requirements in a future revision of ISO 10218-1. We invite WG3 to review RCAN's provisions and evaluate whether they, or requirements derived from them, should be incorporated.

- **A3 standards committee / ANSI/A3 R15.06**: The US national adoption of ISO 10218-1 and -2 presents the same AI accountability gap. RCAN's §16 provisions are equally applicable to R15.06. We invite the A3 committee to consider parallel adoption.

- **CEN/CENELEC JTC 21** (AI standards in Europe): RCAN's EU AI Act mappings (Articles 12, 13, 14) are intended to inform JTC 21's work on harmonized technical standards supporting the AI Act for robotic systems. We invite JTC 21 to evaluate RCAN's provisions as candidate technical requirements that enable AI Act conformity assessment in the robotics domain.

RCAN welcomes contributions, technical objections, and proposal for modifications via the public GitHub repository at [github.com/continuonai/rcan-spec](https://github.com/continuonai/rcan-spec).

**Contact:** [rcan.dev](https://rcan.dev) | [github.com/continuonai/rcan-spec](https://github.com/continuonai/rcan-spec)

---

## Appendix A: RCAN §16 AI Accountability — Key Provisions (Summary)

The following table summarizes the key normative provisions of RCAN §16 for reference by standards committee reviewers.

| Provision | Requirement Level | Description | Rationale |
|---|---|---|---|
| **§16.1 Model identity** | MUST | Every audit record for an AI-generated command MUST include: model provider, model identifier, inference confidence (0.0–1.0), inference latency (ms), thought_id, escalation flag | Enables forensic investigation of AI-caused incidents; satisfies EU AI Act Art. 12 implicit requirements |
| **§16.1 Provider fallback logging** | MUST | When a command is generated by a fallback model (lower capability / lower quota), this MUST be recorded in the audit entry with the fallback reason | Distinguishes primary model decisions from degraded-mode decisions in the audit record |
| **§16.2 Confidence gates** | MUST | Operators MUST declare minimum confidence thresholds per action scope in robot configuration. Commands MUST be rejected before dispatch if model confidence is below the declared threshold for that scope | Prevents execution of AI commands that fall below the operator's acceptable confidence floor |
| **§16.2 Gate configuration** | MUST | Confidence thresholds MUST be declared in robot configuration (RCAN file) under the `confidence_gates` block, per-scope | Makes the confidence policy explicit, auditable, and reviewable by operators and assessors |
| **§16.3 HiTL gate declaration** | MUST | Action types requiring human authorization MUST be declared in robot configuration under `hitl_gates`. Undeclared action types are not gated | Makes the human oversight scope explicit and auditable |
| **§16.3 Authorization enforcement** | MUST | Gated actions MUST NOT be dispatched until an AUTHORIZE message with valid signature from OWNER or higher principal is received | The gate is structural — not advisory. The AI agent cannot proceed without the authorization message. |
| **§16.3 PENDING_AUTH status** | MUST | When a gated action is queued awaiting authorization, the robot MUST emit PENDING_AUTH status with the action description, requesting principal, and expiry time | Provides the human operator with the information needed to make an informed authorization decision |
| **§16.3 Authorization expiry** | MUST | Authorizations are single-use and expire. An authorization MUST NOT be reused for a subsequent command. | Prevents replay of authorization decisions |
| **§16.4 Thought log storage** | MUST | Every AI decision MUST produce a thought record: thought_id, timestamp, prompt (sanitized), reasoning output, action taken, confidence, model identifier | Creates the forensic and transparency record for each AI decision |
| **§16.4 Thought log access** | MUST | Thought records MUST be accessible via `GET /api/thoughts/<id>`. The `reasoning` field MUST require OWNER or higher scope. The `action` and `confidence` fields MAY be accessible to lower scopes. | Balances transparency with operational data protection |
| **§16.4 Thought log retention** | SHOULD | Thought records SHOULD be retained for a minimum of 6 months or as required by applicable regulations (EU AI Act Art. 12 specifies minimum 6 months for high-risk AI systems) | Aligns with EU AI Act retention requirements |

---

*RCAN Working Group / continuonai — March 2026*  
*rcan.dev | github.com/continuonai/rcan-spec*
