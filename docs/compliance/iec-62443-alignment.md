# IEC 62443 Security Level Alignment

**Document type:** Compliance Alignment  
**Applies to:** RCAN Specification (all published versions) and OpenCastor reference implementation  
**Standard:** IEC 62443 — Industrial Automation and Control Systems Security  
**Status:** Informative guidance; not a certification claim  

---

## Overview

IEC 62443 is the primary international standard for Operational Technology (OT) cybersecurity. Published by the International Electrotechnical Commission, it defines Security Levels (SL 1–4) based on the sophistication of the adversary being defended against and prescribes countermeasures appropriate to each level for industrial control systems and networks.

RCAN's protocol-level security model and OpenCastor's quantum commitment chain address several IEC 62443 requirements specifically in the context of AI-driven robotic systems. This document maps RCAN provisions to IEC 62443 Security Level requirements, identifies coverage gaps that are organizational or architectural in nature (and therefore outside RCAN's protocol scope), and provides practical guidance for integrators conducting IEC 62443 compliance assessments.

> **Scope caveat:** IEC 62443 applies to industrial control system networks as a whole. RCAN is a *protocol specification*, not a network architecture or organizational security program. The coverage ratings below reflect what the RCAN protocol contributes; full SL achievement requires system-level and organizational controls outside RCAN's scope.

---

## Security Level Mapping

The table below maps each IEC 62443 Security Level to the corresponding RCAN provisions. Coverage is rated **Partial** throughout because RCAN is a protocol, not a complete security program.

| IEC 62443 SL | Adversary Profile | Key IEC 62443 Requirements | RCAN Provisions That Address This | Coverage |
|---|---|---|---|---|
| **SL 1** | Casual violation — curious insiders, unintentional errors | Basic authentication; audit logging of system events | §2 RBAC (GUEST and USER roles provide minimum access differentiation); §6 audit trail (COMMAND and CONFIG message types logged with principal identity at time of dispatch) | Partial |
| **SL 2** | Intentional violation with low resources — disgruntled insiders, commodity tooling | Authenticated sessions; role separation; log integrity; patch management | §2 full 5-tier RBAC (GUEST / USER / OPERATOR / ENGINEER / ADMIN); §6 HMAC-keyed audit chain (each audit record keyed to session credentials); §6 prompt injection defense (injection attempts detected and blocked before the LLM inference call, preventing insider misuse of the AI channel) | Partial — RCAN addresses the protocol layer; network segmentation, conduit firewalling, and patch management processes are organizational and out of scope |
| **SL 3** | Sophisticated intentional violation — organized criminal groups, hacktivists | Strong authentication (MFA); tamper-evident logging; anomaly detection; software integrity verification | §6 quantum commitment chain (QuantumLink-Sim hybrid QKD + HKDF-SHA-256 derivation; QBER monitoring provides continuous link-integrity signal); §16.2 confidence gates (model-output confidence thresholds function as an anomaly detection mechanism in the AI inference path); §16.3 Human-in-the-Loop (HiTL) gates (operator confirmation required for designated high-consequence action classes) | Partial — addresses the AI-specific attack surface (adversarial prompts, model substitution); physical security and network zone/conduit architecture remain out of scope |
| **SL 4** | State-sponsored attack — nation-state grade adversary with sophisticated resources | Nation-state-grade controls: hardware security modules, classified key management, multi-layer defense-in-depth | QuantumLink-Sim BB84 QKD hybrid key derivation provides cryptographic forward secrecy against a quantum-capable adversary; derived session keys are ephemeral and not recoverable from recorded traffic | Partial — QuantumLink-Sim is a simulation of QKD, not a certified QKD hardware implementation; real SL 4 deployments require certified QKD hardware (e.g., ID Quantique, Toshiba QKD) and classified key custodian procedures |

### Reading the Coverage Column

**Partial** is the only honest rating for a protocol specification against a system-level standard. It means:

- RCAN *contributes evidence* for the named requirements.  
- RCAN *does not substitute* for system architecture, physical security, organizational controls, or network segmentation.  
- A complete IEC 62443 compliance assessment must include controls beyond the protocol layer.

---

## What IEC 62443 Requires That RCAN Does Not Address

The following IEC 62443 requirement families are explicitly out of scope for RCAN. Integrators must address these through system design and organizational controls.

### Network Zone and Conduit Architecture (Purdue Model)

IEC 62443-3-2 requires that industrial networks be partitioned into security zones with managed conduits between them. RCAN is a *protocol*, not a network architecture. It does not specify how RCAN-speaking nodes are segmented, which network interfaces they use, or how conduit firewalls are configured. Integrators are responsible for deploying RCAN nodes within an appropriate zone architecture (e.g., ISA/IEC 62443 Zone 3 for supervisory systems, Zone 2 for field devices) and for defining conduit policies at the network layer.

### Physical Security Requirements

IEC 62443 at SL 2 and above includes requirements for physical access control to field devices and control panels. RCAN has no provisions for physical tamper-evidence, locked enclosures, or badge access to robot hardware. Physical security is the responsibility of the facility and the robot integrator.

### Patch and Vulnerability Management Processes

IEC 62443-2-3 defines organizational requirements for software maintenance, patching, and CVE tracking. RCAN does not specify a patch cadence, vulnerability disclosure process, or software update mechanism. These are organizational responsibilities. OpenCastor publishes security advisories through its GitHub repository; integrators must establish their own patch management processes aligned with IEC 62443-2-3.

### Supplier / Supply Chain Risk Management

IEC 62443-2-4 and the emerging supply chain provisions require that integrators assess the security posture of software and hardware suppliers. RCAN does not address supplier risk assessment. Integrators procuring RCAN-conformant components must independently assess each supplier's security development lifecycle (SDL) and contractual security obligations.

---

## How to Use RCAN in an IEC 62443 Compliance Assessment

RCAN adoption provides **protocol-level evidence** for requirements in the following IEC 62443-3-3 System Requirement (SR) families:

### Access Control (SR 1.x)

- **SR 1.1 — Account Management:** §2 RBAC defines five principal tiers (GUEST, USER, OPERATOR, ENGINEER, ADMIN) with explicit capability sets. Cite §2 and the conformant implementation's role configuration in the SR 1.1 evidence package.
- **SR 1.2 — Software Process and Device Identification:** §6 logs the principal identity with every COMMAND and CONFIG audit record. Session tokens are cryptographically bound to the authenticating identity via the HMAC-keyed audit chain.
- **SR 1.3 — Control of Unauthenticated Access:** §2 GUEST role is explicitly limited to read-only telemetry; no COMMAND-class messages may be dispatched by an unauthenticated or GUEST-tier principal.

### Audit Logging (SR 2.8 / SR 3.3)

- **SR 2.8 — Audit Log Accessibility:** §6 defines a structured audit trail with mandatory fields (timestamp, principal, session ID, message type, payload hash). The audit log is accessible to ADMIN-tier principals via the management interface.
- **SR 3.3 — Security Functionality Verification:** The QuantumLink-Sim quantum commitment chain provides tamper-evident audit records. Each audit entry is committed to the chain; post-hoc modification of any entry invalidates all subsequent chain links. This provides evidence for SR 3.3 at SL 2–3. Cite QuantumLink-Sim audit output (chain root hash, QBER statistics) in the SR 3.3 evidence package.

### System Integrity (SR 3.4)

- **SR 3.4 — Software and Information Integrity:** §6 prompt injection defense validates all LLM-bound inputs against an injection signature set before the inference call. This addresses software integrity in the AI inference path, which IEC 62443-3-3 SR 3.4 did not originally contemplate but which is applicable under the standard's general intent.

### Practical Evidence Checklist

When preparing an IEC 62443 assessment package for a RCAN-conformant system, include:

1. RCAN specification version number and conformance test report.
2. §2 role configuration document: which principals are assigned which tiers, and the organizational procedures for role assignment and revocation.
3. §6 audit log samples covering COMMAND, CONFIG, and SAFETY message types, annotated with principal identity and session ID.
4. QuantumLink-Sim chain root hash and QBER monitoring statistics for the assessment period.
5. §16.2 confidence gate threshold configuration and a log of gate-triggered rejections during the assessment period.
6. §16.3 HiTL gate event log showing operator confirmation records for high-consequence actions.
7. A gap register documenting which IEC 62443 requirements are addressed by system-level or organizational controls outside RCAN.

---

## Relation to RCAN §16 AI Accountability

IEC 62443 was developed for traditional industrial control systems and predates the widespread deployment of AI inference engines in robotic control loops. The standard has **no AI-specific provisions**: it does not address adversarial prompts, model substitution attacks, confidence-based anomaly detection, or the accountability problems introduced by non-deterministic AI decision-making.

RCAN §16 — AI Accountability — explicitly extends the IEC 62443 security model into the AI inference layer:

| Attack Surface | IEC 62443 Coverage | RCAN §16 Provision |
|---|---|---|
| Adversarial prompt injection targeting the LLM | Not addressed | §6 prompt injection defense (pre-LLM input validation); §16.1 model identity logging (detects unexpected model substitution) |
| Model substitution (supply chain attack on AI component) | Not addressed (generic software integrity only) | §16.1 model identity attestation (model hash logged at session start; deviation triggers alert) |
| Unauthorized autonomous action (robot acts without operator knowledge) | Partially addressed by access control SRs | §16.3 HiTL gates (operator confirmation required before high-consequence autonomous actions are executed) |
| Inference-time anomaly (model produces outlier outputs) | Not addressed | §16.2 confidence gates (outputs below configured confidence threshold are blocked and flagged) |

RCAN §16 is therefore best understood as a **domain extension** of IEC 62443 for AI-driven robotic systems. Organizations deploying AI robots in IEC 62443-regulated environments should treat §16 provisions as supplementary controls within their SL 3–4 security programs.

---

## References

- IEC 62443-1-1:2009 — Terminology, concepts and models
- IEC 62443-2-1:2010 — Establishing an IACS security management system
- IEC 62443-2-3:2015 — Patch management in the IACS environment
- IEC 62443-2-4:2015 — Security program requirements for IACS service providers
- IEC 62443-3-2:2020 — Security risk assessment for system design
- IEC 62443-3-3:2013 — System security requirements and security levels
- RCAN Specification §2 (Access Control and RBAC)
- RCAN Specification §6 (Audit Trail and Quantum Commitment Chain)
- RCAN Specification §8 (Safety Layer)
- RCAN Specification §16 (AI Accountability)
- QuantumLink-Sim documentation (OpenCastor repository)

---

*This document is informative guidance and does not constitute a certification claim under IEC 62443. Formal IEC 62443 certification requires assessment by an accredited third-party certification body.*
