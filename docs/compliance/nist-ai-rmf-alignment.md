# RCAN Protocol — NIST AI Risk Management Framework 1.0 Alignment

**Document type:** Compliance alignment  
**RCAN spec version:** 1.1 (rcan.dev/spec)  
**Framework:** NIST AI Risk Management Framework 1.0 (NIST AI 100-1, January 2023)  
**Classification focus:** AI systems deployed in safety-critical robotics contexts; US government procurement  
**Target audience:** Federal agencies, DoD program offices, system integrators, robot OEMs pursuing US government contracts  
**Status:** Informative  
**Last updated:** 2026-03-04  

---

## Overview

The NIST AI Risk Management Framework (AI RMF 1.0), published by the National Institute of Standards and Technology in January 2023, is a voluntary framework for organizations to identify, assess, and manage risks associated with the design, deployment, and use of AI systems. It is structured around four core functions — **GOVERN**, **MAP**, **MEASURE**, and **MANAGE** — and is accompanied by the NIST AI RMF Playbook (also published as part of NIST AI 100-1), which provides actionable suggested practices for each function.

RCAN (Robot Communication and Addressing Network) is a protocol specification governing the AI agent governance and networking layer of robot systems: how commands are originated, authorized, routed, audited, and constrained at the protocol level. This document maps RCAN protocol provisions to the NIST AI RMF 1.0 core functions and sub-categories, demonstrating the framework alignment relevant to US government procurement conversations and federal AI risk management obligations.

This document is the primary reference for federal agencies, DoD program offices, and GSA-schedule integrators evaluating RCAN-based systems against NIST AI RMF requirements. It should be read alongside the companion documents addressing ISO 10218-1:2025 alignment and EU AI Act compliance.

This document is informative and does not constitute legal or regulatory advice. Compliance determination for any specific procurement or deployment context requires qualified legal and technical assessment.

---

## 1. Overview of NIST AI RMF 1.0

### Framework Purpose and Structure

The NIST AI RMF 1.0 was developed in response to a mandate from Congress (National AI Initiative Act of 2020) and published in January 2023 following an extended public comment process. It is a voluntary, non-prescriptive framework designed to be:

- **Technology-neutral** — applicable across AI system types, domains, and deployment contexts
- **Risk-based** — focused on characterizing and managing AI risks proportionate to likely impact
- **Iterative** — intended to evolve as AI technology, deployment patterns, and understanding of AI risks mature

The framework is organized around **four core functions**:

| Function | Purpose |
|----------|---------|
| **GOVERN** | Establish organizational culture, policies, accountability structures, and workforce capabilities for AI risk management |
| **MAP** | Identify and characterize AI risks in context, including system boundaries, stakeholders, and foreseeable impacts |
| **MEASURE** | Analyze and assess AI risks using quantitative and qualitative methods, metrics, and evaluation approaches |
| **MANAGE** | Prioritize and address AI risks, and communicate residual risks to relevant stakeholders |

Each function is decomposed into **categories** and **sub-categories**. The companion NIST AI RMF Playbook provides suggested actions for each sub-category.

### Companion Document: NIST AI 100-1 Playbook

The NIST AI RMF Playbook (part of NIST AI 100-1) provides suggested practices organized by the four core functions. Key playbook sections referenced in this document include:

- **Govern-1** (policies and accountability for AI risk): organizational AI governance documentation
- **Map-1** (context and categorization): system boundary definition, AI actor identification
- **Measure-2.6** (explainability and interpretability): AI decision transparency mechanisms
- **Manage-1.3** (response and recovery planning): incident response and emergency procedures

### Relationship to NIST Cybersecurity Framework (CSF 2.0)

The NIST AI RMF is designed to complement rather than replace the NIST Cybersecurity Framework (CSF 2.0, published February 2024). For AI systems in federal contexts:

- The **CSF 2.0 GOVERN function** (new in CSF 2.0) directly parallels the AI RMF GOVERN function, enabling unified governance documentation
- CSF 2.0 **IDENTIFY, PROTECT, DETECT, RESPOND, RECOVER** functions address cybersecurity risks that apply to AI-driven robot systems
- RCAN's SECURITY.md and §6 security controls (prompt injection defense, audit trail, session TTL, RBAC) address CSF 2.0 controls alongside AI RMF requirements
- A joint AI RMF + CSF 2.0 assessment of a RCAN-based system can leverage a single set of technical evidence artifacts

### Relevance to Executive Order 14028

Executive Order 14028 (Improving the Nation's Cybersecurity, May 2021) imposes software supply chain security requirements on federal software suppliers, including:

- **Software Bill of Materials (SBOM)**: Federal agencies must obtain SBOMs for software they procure. OpenCastor (the RCAN reference implementation) generates a **CycloneDX SBOM** as part of its CI/CD pipeline, satisfying this requirement for RCAN-based systems.
- **Secure development practices**: EO 14028 requires suppliers to follow secure development lifecycle practices. RCAN's SECURITY.md defines vulnerability disclosure and patch management procedures. OpenCastor uses GitHub Actions with OIDC-based attestation and Dependabot for dependency vulnerability management.
- **CISA CVD alignment**: RCAN's SECURITY.md vulnerability disclosure process is aligned with CISA Coordinated Vulnerability Disclosure (CVD) guidelines, satisfying the EO 14028 requirement for a vendor vulnerability disclosure program.

### Relevance to Executive Order 14110

Executive Order 14110 (Safe, Secure, and Trustworthy Development and Use of Artificial Intelligence, October 2023) directs federal agencies and AI developers to implement AI safety and security standards, including:

- **AI safety testing**: EO 14110 §4 directs developers of dual-use AI systems to report safety test results. RCAN's conformance test suite (19 test cases, `check_l1.py`) provides the technical infrastructure for AI safety testing of robot command systems.
- **Transparency and traceability**: EO 14110 emphasizes AI transparency. RCAN's §16.4 thought log (reasoning transparency per command, scope-gated access) and §16.1 model identity in audit records directly address this.
- **NIST AI Safety Institute coordination**: EO 14110 §4.1 directed NIST to establish the AISI. RCAN's governance body (Robot Registry Foundation) intends to engage AISI for profile development (see Section 5 — Contact Path).

### NIST AI Safety Institute (AISI)

The NIST AI Safety Institute (AISI), established under EO 14110, is the primary US government body for AI safety standards development. AISI is developing sector-specific AI RMF profiles and evaluation methodologies. The Robot Registry Foundation plans to submit a **Robotics Sector AI RMF Profile** as a community contribution through the AISI profile development process (see Section 5).

---

## 2. RCAN Provisions — AI RMF Function Mapping Table

The table below maps RCAN protocol provisions to the NIST AI RMF 1.0 core functions and sub-categories. Coverage levels are defined as:

- **Full** — RCAN provides a complete protocol-level implementation of the sub-category's technical requirements
- **Partial** — RCAN addresses the technical layer; organizational process requirements remain the implementer's responsibility
- **Planned** — Addressed in the RCAN roadmap; not yet fully specified in v1.1

| RCAN Provision | AI RMF Function | AI RMF Sub-Category | Coverage | Notes |
|---|---|---|---|---|
| **Robot Registry Foundation governance charter**; VERSIONING.md (semantic versioning and deprecation policy); SECURITY.md (vulnerability management and disclosure) | GOVERN | **GOVERN 1.1** — Policies, processes, procedures, and practices for AI risk management are documented and in place | **Partial** | RCAN provides the governance documentation artifacts (charter, versioning policy, security policy) that constitute the technical layer of an AI risk management policy. Deployers and providers must supplement with organizational AI governance policies addressing their specific deployment context. |
| **§16.1 Model identity in audit records** — every AI-generated command audit record MUST include model provider, model identifier, inference confidence, inference latency (ms), thought_id, and escalation flag; **AuditLog `ai` sub-dictionary** present on every AI-originated entry; `GET /api/thoughts/<id>` API endpoint | GOVERN | **GOVERN 1.2** — Accountability mechanisms for AI risk management are in place | **Full** | RCAN's §16.1 makes AI model identity a first-class audit field, creating an unambiguous chain of accountability from every executed command back to the specific model that produced it. The `ai` sub-dictionary in every AuditLog entry and the queryable `GET /api/thoughts/<id>` endpoint provide the evidentiary foundation for accountability review. This directly satisfies the GOVERN 1.2 requirement that accountability for AI risk outcomes be traceable to identifiable actors and systems. |
| **§16.2 Confidence gates** — minimum confidence thresholds MUST be declared per action scope in robot configuration; a command MUST be rejected before dispatch if the model's confidence falls below the scope-specific threshold; thresholds are configurable per deployment | GOVERN | **GOVERN 1.4** — Organizational teams are committed to a risk tolerance that informs resource allocation and prioritization of AI risk management activities | **Full** | Confidence gate thresholds are the protocol-level expression of the operator's risk tolerance. A deployer that sets a high threshold for `MOTION` scope and a lower threshold for `STATUS` scope is encoding their risk tolerance directly in the protocol configuration. This satisfies GOVERN 1.4 by making risk tolerance decisions concrete, documented, and enforceable at the protocol layer rather than policy-layer aspirations. |
| **§16.3 Human-in-the-Loop (HiTL) gates** — action types declared as requiring human authorization MUST NOT be dispatched until an `AUTHORIZE` message from a principal with OWNER or higher role has been received; pending actions emit `PENDING_AUTH` status; `POST /api/hitl/authorize` API endpoint | GOVERN | **GOVERN 2.2** — AI risk management is integrated into organizational risk governance; human oversight of AI systems is maintained where appropriate | **Full** | RCAN's §16.3 HiTL gates implement human oversight as a structural protocol constraint rather than an application-layer suggestion. The OWNER-or-higher authorization requirement ensures that oversight is performed by a principal with accountable authority. The `PENDING_AUTH` status provides the human-machine interface. This directly satisfies the GOVERN 2.2 human oversight requirement and supports the deployment of oversight controls proportionate to action risk level. |
| **RURI** (globally unique robot identity, format: `rcan://registry/<RRN>/<uuid>`); **Robot Registry Network (RRN)** — manufacturer-verified robot registration; manufacturer verification workflow in registry API | MAP | **MAP 1.1** — Context is established for the AI system's development and planned use, including understanding the system purpose, capabilities, and operating environment | **Full** | RURI provides a globally unique, registry-verified identity for every robot in the network. The RRN manufacturer verification workflow establishes provenance: who manufactured the robot, what capabilities it has, and what safety profile applies. This satisfies MAP 1.1 by anchoring every AI interaction to a verified, characterized system context. Agents receiving a RURI-identified message know the system's physical capabilities and conformance level before processing any command. |
| **Conformance levels L1/L2/L3** — tiered compliance levels with progressively more demanding AI accountability requirements; **robot profiles** (UR5e, Spot, Unitree H1, etc.) with capability declarations; conformance assessment documentation | MAP | **MAP 1.5** — Practices and personnel are in place to perform risk impact assessment of AI systems | **Partial** | RCAN's L1/L2/L3 conformance levels provide a structured risk impact classification for AI robot systems. L1 covers basic audit and RBAC; L2 adds confidence gates and HiTL; L3 adds thought log and federated trust. Deployers can select the conformance level appropriate to their risk assessment. Robot profiles provide the capability declarations needed for impact assessment. Deployers must conduct the full risk impact assessment; conformance levels provide the technical evidence structure. |
| **§16 AI Accountability** — protocol-enforced separation of AI-produced commands from human-programmed commands; `origin: AI` vs `origin: HUMAN` field in every COMMAND message; §16.1 model identity block exclusively required for `origin: AI` messages | MAP | **MAP 2.1** — Scientific findings, technical standards, and AI-specific considerations inform AI risk assessment approaches | **Full** | RCAN's §16 makes the AI/human command distinction a first-class protocol primitive. Every message carries its origin, and AI-originated messages carry the full accountability record. This satisfies MAP 2.1 by implementing the AI-specific risk consideration (AI vs human agency) at the protocol layer, making it available for analysis without relying on application-level documentation. |
| **Federation protocol** — registry federation via `.well-known/rcan-registry.json`; inter-registry trust anchoring; third-party registry verification requirements; federated principal identity resolution | MAP | **MAP 3.5** — Practices are in place to assess risks from dependencies on external entities, including third-party AI components, data, and infrastructure | **Partial** | RCAN's federation protocol addresses third-party trust by requiring explicit registry-level trust anchoring before inter-registry principals can be accepted. The `.well-known/rcan-registry.json` discovery mechanism and registry verification workflow mean that third-party robot identities must be verified before commands from those principals are accepted. Deployers using federated registries must additionally assess the security posture of federated registries as part of their third-party risk process. |
| **Conformance test suite** — 19 test cases covering L1 requirements; `check_l1.py` automated compliance checker; test cases for RBAC, audit trail, session TTL, SAFETY priority, and prompt injection defense | MEASURE | **MEASURE 1.1** — Approaches and metrics for AI risk identification are established and documented | **Full** | The RCAN conformance test suite provides a concrete, executable risk identification methodology. The 19 test cases cover the primary risk vectors in the RCAN security model: access control, audit completeness, session management, message priority, and prompt injection resistance. `check_l1.py` enables automated, repeatable risk measurement. This satisfies MEASURE 1.1 by providing documented, tool-supported risk identification practices. |
| **§6 Safety invariants** — local safety always wins (on-device safety checks cannot be bypassed by any remote command); graceful degradation to safe state on network loss; latency budget enforcement (`latency_budget_ms`); `agent.safety_stop` flag | MEASURE | **MEASURE 2.5** — AI system robustness is evaluated for performance and behavior under unexpected conditions | **Full** | RCAN's safety invariants directly address robustness measurement. The "local safety always wins" invariant provides a measurable floor: any test that attempts to bypass on-device safety checks via a remote command can be used to measure protocol robustness. The graceful degradation requirement is a testable specification. The latency budget (`latency_budget_ms`) is a measurable performance constraint. These invariants satisfy MEASURE 2.5 by providing concrete, testable robustness requirements rather than aspirational goals. |
| **§16.4 Thought log** — AI reasoning records (thought_id, prompt, reasoning chain, action taken, confidence, timestamp) MUST be stored and accessible via `GET /api/thoughts/<id>`; `reasoning` field MUST require OWNER or higher scope to retrieve; scope-gated access control | MEASURE | **MEASURE 2.6** — AI system explainability and interpretability are evaluated | **Full** | RCAN's §16.4 thought log is a complete explainability and interpretability infrastructure. Every AI-generated command has an associated reasoning record that captures the prompt, the model's reasoning chain, the action taken, and the confidence level. The `GET /api/thoughts/<id>` endpoint makes this record queryable. Scope-gated access ensures that reasoning transparency is available to authorized oversight principals. This satisfies MEASURE 2.6 by providing a per-decision explainability record at the protocol layer. |
| **§16.2 Confidence gate thresholds** — thresholds are configurable per action scope (e.g., `MOTION`, `STATUS`, `CONFIG`), enabling different risk tolerances for different action types; confidence miscalibration detection via threshold crossing events logged in audit trail | MEASURE | **MEASURE 2.9** — AI system performance is evaluated for fairness, bias, and unintended outcomes in context of use | **Partial** | RCAN's scope-specific confidence gate thresholds provide a configurable mechanism to measure and enforce AI performance floors across different action categories. Threshold crossing events are logged, enabling analysis of patterns that may indicate model bias or miscalibration in specific scopes. This satisfies the technical measurement layer of MEASURE 2.9. Deployers must additionally conduct fairness and bias evaluation appropriate to their specific AI model and deployment context; confidence gates provide the enforcement and measurement infrastructure. |
| **Telemetry messages** (`TELEMETRY` message type); **heartbeat protocol** (session keepalive with payload); nightly monitoring integration in OpenCastor reference implementation; telemetry anomaly detection hooks | MEASURE | **MEASURE 4.1** — Measurement approaches for identifying AI risk are maintained and updated | **Full** | RCAN's telemetry and heartbeat protocols provide continuous operational monitoring infrastructure. The telemetry message type enables AI system performance data to be streamed to monitoring systems. The heartbeat protocol provides liveness monitoring. The nightly monitoring integration in OpenCastor demonstrates a complete implementation. This satisfies MEASURE 4.1 by providing the protocol-level infrastructure for ongoing AI risk measurement in production deployments. |
| **§6 SAFETY priority messages** — `Priority.SAFETY` messages MUST be processed first regardless of queue state, MUST NOT be rate-limited, and MUST be acknowledged within `latency_budget_ms`; emergency stop integration; `latency_budget_ms` enforcement | MANAGE | **MANAGE 1.3** — Responses to identified AI risks are planned and documented | **Full** | RCAN's SAFETY priority message mechanism is a protocol-level response plan: the specification defines, in advance, how the system responds to safety-critical conditions. The emergency stop path (`Priority.SAFETY` → on-device safety check → halt) is a documented, testable response procedure. The `latency_budget_ms` constraint ensures that response time commitments are enforceable. This satisfies MANAGE 1.3 by implementing the response plan in the protocol itself rather than in organizational documentation that may or may not be implemented. |
| **Tamper-evident audit chain** — QuantumLink-Sim HKDF-SHA256 + BB84 QKD simulation commitment chain; `chain_hash` integrity field in every AuditLog entry; cryptographic chaining ensures log records cannot be modified or deleted without detection | MANAGE | **MANAGE 2.4** — AI risk treatment plans are implemented and monitored; incident response procedures are in place | **Full** | RCAN's tamper-evident audit chain directly implements the evidentiary infrastructure for incident response. When an AI-related incident occurs, the `chain_hash` integrity mechanism ensures that the audit record has not been altered, providing trustworthy forensic evidence. The QuantumLink-Sim commitment chain provides post-quantum-resistant integrity assurance. This satisfies MANAGE 2.4 by ensuring that incident response procedures have access to reliable, tamper-evident records. |
| **§2 RBAC — 5-tier role hierarchy** (GUEST → USER → LEASEE → OWNER → CREATOR) with JWT-embedded role enforcement; scope restrictions enforced at the protocol layer; session TTL with explicit renewal requirement; rate limits per role | MANAGE | **MANAGE 3.1** — AI risk treatment is applied to identified risks; risk reduction approaches are implemented | **Full** | RCAN's RBAC system is the primary risk treatment mechanism for access control risks. The 5-tier hierarchy ensures that principals operate within their authorized scope; the protocol enforces this rather than relying on application-layer controls. Session TTL with explicit renewal prevents persistent unauthorized access. Per-role rate limits bound the impact of credential compromise. These controls satisfy MANAGE 3.1 by implementing concrete, enforceable risk treatment for the access control risk category. |
| **§6 Prompt injection defense** — implementations forwarding natural-language instructions to a language model MUST scan for injection patterns before model invocation; a `ScanVerdict.BLOCK` result MUST return an error without calling the model; scanning is logged in the audit trail | MANAGE | **MANAGE 4.1** — Residual AI risks are communicated to relevant stakeholders and documented | **Partial** | RCAN's prompt injection defense addresses one of the most significant residual risks in LLM-driven robot control systems: the possibility that a malicious input could cause the LLM to generate an unauthorized command. The mandatory pre-invocation scan and `ScanVerdict.BLOCK` enforcement reduce this residual risk to a defined envelope. The audit trail logging of scan results enables communication of residual risk exposure to deployers. Deployers must additionally communicate residual risks (including risks from injection patterns not caught by the scanner) to their oversight stakeholders. |

---

## 3. Relationship to Executive Order 14028 (Software Supply Chain Security)

EO 14028 (May 2021) and the subsequent NIST guidance (NIST SP 800-218 Secure Software Development Framework) impose software supply chain security requirements on vendors supplying software to federal agencies. RCAN-based systems address these requirements as follows:

### Software Bill of Materials (SBOM)

| EO 14028 Requirement | RCAN / OpenCastor Implementation |
|---|---|
| Vendors must provide a machine-readable SBOM for software supplied to federal agencies | OpenCastor CI/CD pipeline generates a **CycloneDX-format SBOM** on every release build, enumerating all direct and transitive dependencies with version, license, and package URL (PURL) fields |
| SBOM must be provided in a format specified by NTIA minimum elements guidance | CycloneDX satisfies NTIA minimum elements. SBOM artifacts are published as release attachments on the OpenCastor GitHub repository |
| SBOM must be maintained and updated with each software release | SBOM generation is automated in CI; every version-tagged release produces a new SBOM artifact |

### Secure Development Practices

| EO 14028 / SSDF Requirement | RCAN / OpenCastor Implementation |
|---|---|
| **SSDF PO.1** — Define security requirements for software development | SECURITY.md defines the vulnerability management and disclosure policy. Conformance test suite defines security requirement test cases. |
| **SSDF PW.4** — Reuse existing, well-secured software | OpenCastor uses Dependabot for automated dependency vulnerability scanning; all transitive dependencies are enumerated in the SBOM |
| **SSDF RV.1** — Identify and confirm vulnerabilities on an ongoing basis | Dependabot alerts are triaged within 14 days per SECURITY.md policy; critical vulnerabilities within 72 hours |
| **SSDF PW.6** — Configure the compilation, interpreter, and build processes to improve executable security | GitHub Actions with OIDC-based artifact attestation; build provenance recorded per SLSA Level 2 requirements |

### Vulnerability Disclosure

RCAN's SECURITY.md vulnerability disclosure process is designed to be consistent with CISA Coordinated Vulnerability Disclosure (CVD) guidelines:

- Vulnerability reports accepted via dedicated security contact (security@rcan.dev)
- 90-day disclosure timeline with coordinated release option
- CVE assignment process for confirmed vulnerabilities
- CISA VDP (Vulnerability Disclosure Policy) platform notification for vulnerabilities affecting deployed federal systems

---

## 4. Relationship to NIST AI 100-1 Playbook

The NIST AI RMF Playbook provides suggested actions for each framework sub-category. The table below maps the most directly relevant Playbook suggested actions to RCAN provisions.

| Playbook Suggested Action | RCAN Implementation |
|---|---|
| **Govern-1.1 (Suggested Action 1)** — Identify AI actors (developers, operators, users) involved in the AI system lifecycle and document their roles and responsibilities | RCAN's RBAC system (`§2`) assigns every principal to a typed role (GUEST, USER, LEASEE, OWNER, CREATOR) that maps to a defined AI actor category. Every message carries the principal's RURI and role, making AI actor identity a protocol primitive rather than organizational documentation. The Robot Registry Foundation governance charter maps these roles to the AI actor taxonomy. |
| **Govern-1.2 (Suggested Action 3)** — Establish accountability mechanisms so that AI actors can be held responsible for their decisions | `§16.1` model identity in audit records and the `AuditLog ai` sub-dictionary ensure that every AI-generated command is permanently attributed to the specific model, version, and principal that produced it. The `chain_hash` tamper-evident audit chain ensures accountability records cannot be altered. |
| **Map-1.1 (Suggested Action 2)** — Document the organizational context and intended use of the AI system, including known limitations | RURI and robot profiles provide machine-readable system context documentation at the protocol layer. Conformance level declarations (L1/L2/L3) document AI accountability capability limitations in a standardized format. |
| **Measure-2.6 (Suggested Action 1)** — Implement AI transparency mechanisms that allow users and operators to understand AI system behavior and decisions | `§16.4` thought log provides per-decision reasoning transparency. The `GET /api/thoughts/<id>` API makes reasoning records queryable. Scope-gated access (`reasoning` requires OWNER+) ensures transparency is available to oversight principals. |
| **Measure-2.6 (Suggested Action 3)** — Provide explanations for AI decisions in a format appropriate to the user's expertise and role | RCAN's scope-gated thought log access provides a role-appropriate explanation capability: operational principals see action and confidence; oversight principals (OWNER+) see the full reasoning chain. |
| **Manage-1.3 (Suggested Action 1)** — Develop and document incident response procedures for AI system failures and unexpected behaviors | `§6` SAFETY priority messages and the emergency stop path constitute a protocol-specified incident response procedure. The procedure is not organizational documentation that may drift from implementation — it is the specification itself. `Priority.SAFETY` → immediate processing → acknowledgment within `latency_budget_ms` → on-device safety enforcement. |
| **Manage-1.3 (Suggested Action 2)** — Test incident response procedures to ensure they function as expected | The RCAN conformance test suite includes test cases for SAFETY priority message handling and emergency stop path verification. These test cases constitute documented, executable tests of the incident response procedures. |
| **Manage-2.4 (Suggested Action 2)** — Maintain audit trails that support incident investigation and forensic analysis | The tamper-evident audit chain (QuantumLink-Sim, `chain_hash` field) provides forensic-grade audit infrastructure. Every AI-generated command has an associated thought record, confidence score, and chained integrity commitment. Post-incident reconstruction can trace the complete AI decision chain from prompt to executed command. |

---

## 5. Contact Path — Standards Engagement

### NIST AI Safety Institute (AISI)

The NIST AI Safety Institute is the primary engagement path for RCAN contributions to US AI safety standards development.

| Contact | Details |
|---|---|
| **AISI general contact** | aisi@nist.gov |
| **AISI website** | https://www.nist.gov/artificial-intelligence/executive-order-safe-secure-and-trustworthy-artificial-intelligence |
| **Scope** | AI safety evaluation methodologies, sector-specific AI RMF profiles, AI incident reporting frameworks |
| **Planned engagement** | Robot Registry Foundation — submission of a Robotics Sector AI RMF Profile as a community contribution to the AISI profile library |

### NIST NCCoE AI Working Groups

The NIST National Cybersecurity Center of Excellence (NCCoE) operates AI-focused working groups that develop practical guidance for AI system security. Relevant working groups include:

| Working Group | Relevance to RCAN |
|---|---|
| **AI/ML Security** | RCAN prompt injection defense, model identity audit, and confidence gating are directly relevant to NCCoE AI/ML security guidance development |
| **Critical Infrastructure AI** | RCAN's application to industrial robot systems (Annex III EU AI Act classification) aligns with critical infrastructure AI security use cases |
| **Zero Trust Architecture** | RCAN's per-message principal identity and JWT-embedded role enforcement align with Zero Trust Architecture (NIST SP 800-207) requirements |

### AI RMF Profile Contribution Process

The AI RMF supports community-developed sector profiles that provide tailored implementation guidance for specific domains. The Robot Registry Foundation intends to develop and submit a **Robotics AI RMF Profile** that:

1. Maps the AI RMF sub-categories to RCAN conformance level requirements
2. Provides robotics-sector-specific suggested actions for each function
3. Integrates with ISO 10218-1:2025 and IEC 62443 (industrial automation security) mappings
4. Supports federal agencies procuring AI-driven robot systems under OMB AI policy guidance

Organizations wishing to participate in the Robotics AI RMF Profile development should contact the Robot Registry Foundation via the RCAN GitHub repository (github.com/craigm26/rcan-spec).

---

## 6. Summary: AI RMF Function Coverage

The table below provides a one-line assessment of RCAN's overall coverage of each AI RMF core function.

| AI RMF Function | Overall Coverage | Summary |
|---|---|---|
| **GOVERN** | **Partial** | RCAN provides governance documentation artifacts (charter, versioning, security policy), protocol-enforced accountability (§16.1 model identity), configurable risk tolerance (§16.2 confidence gates), and human oversight infrastructure (§16.3 HiTL gates). Organizational AI governance policies, AI ethics review, and workforce AI risk training remain the implementer's responsibility. |
| **MAP** | **Full** | RCAN's RURI, robot registry, conformance levels, robot profiles, §16 AI/human origin distinction, and federation protocol collectively provide a complete protocol-level implementation of the MAP function's system context, impact assessment, and third-party risk characterization requirements. |
| **MEASURE** | **Full** | RCAN's conformance test suite (19 test cases), safety invariants (§6), thought log (§16.4), confidence gate threshold monitoring, and telemetry/heartbeat protocol provide a complete protocol-level implementation of the MEASURE function's risk identification, robustness evaluation, explainability, and ongoing monitoring requirements. |
| **MANAGE** | **Full** | RCAN's SAFETY priority messages, emergency stop path, tamper-evident audit chain (QuantumLink-Sim), 5-tier RBAC, session TTL, and prompt injection defense provide a complete protocol-level implementation of the MANAGE function's response planning, incident response, risk treatment, and residual risk management requirements. |

**Overall assessment:** RCAN provides **full** AI RMF technical coverage for the MAP, MEASURE, and MANAGE functions and **partial** coverage for the GOVERN function. The GOVERN partial coverage reflects the inherent organizational nature of governance requirements — protocol specifications can provide documentation artifacts and technical accountability mechanisms, but organizational AI governance culture, workforce training, and executive commitment are outside any protocol's scope.

For US government procurement, RCAN-based systems demonstrate alignment with all four AI RMF functions and provide documented technical evidence for each. Procuring agencies should use this document alongside the RCAN conformance test results and OpenCastor reference implementation SBOM as the primary technical evidence package for AI RMF alignment assessment.

---

## Appendix: Key RCAN Terminology

| Term | Definition |
|---|---|
| **RURI** | Robot Uniform Resource Identifier — globally unique protocol-layer identity for a robot, format: `rcan://registry/<RRN>/<uuid>` |
| **RRN** | Robot Registry Network — decentralized registry of manufacturer-verified robot identities |
| **HiTL** | Human-in-the-Loop — protocol gate requiring human authorization before dispatch of defined action types (§16.3) |
| **Thought log** | Per-command AI reasoning record stored by the RCAN agent, queryable via `GET /api/thoughts/<id>` (§16.4) |
| **Confidence gate** | Per-scope minimum confidence threshold that blocks command dispatch when model confidence is insufficient (§16.2) |
| **QuantumLink-Sim** | RCAN's tamper-evident audit chain mechanism using HKDF-SHA256 + BB84 QKD simulation commitment chaining |
| **OpenCastor** | RCAN reference implementation (github.com/craigm26/OpenCastor), targeting Hailo-8 + OAK-D + Raspberry Pi 5 |
| **Conformance L1/L2/L3** | Tiered RCAN compliance levels: L1 (RBAC + audit), L2 (+ confidence gates + HiTL), L3 (+ thought log + federation) |
| **chain_hash** | Per-AuditLog-entry field containing the HKDF commitment over the current record and the previous record's hash, enabling tamper detection |
| **SAFETY priority** | Highest RCAN message priority (`Priority.SAFETY`); must be processed immediately, cannot be rate-limited, must be acknowledged within `latency_budget_ms` |
