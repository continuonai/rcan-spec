# SIL / PLe Safety Integrity Declarations

**Document type:** Safety Classification and Normative Annex Draft  
**Applies to:** RCAN Specification (all published versions) and OpenCastor reference implementation  
**Standards:** ISO 13849-1:2023 (Performance Level), IEC 62061:2021 (Safety Integrity Level)  
**Status:** Informative guidance; does not constitute a safety certification  

---

## Purpose

ISO 13849 (Performance Level, PL a–e) and IEC 62061 (Safety Integrity Level, SIL 1–3) are the functional safety standards for machinery control systems. Both standards require that safety functions be explicitly identified, allocated to specific hardware and software components, and verified through a quantitative risk reduction analysis.

RCAN defines several protocol-level behaviors that influence the probability of hazardous events in robotic systems. This document:

1. **Classifies** each RCAN-defined behavior as safety-relevant or non-safety-relevant in the ISO 13849 / IEC 62061 sense.  
2. **Specifies implementation requirements** for safety-relevant RCAN functions, including recommended software category and diagnostic obligations.  
3. **Provides draft normative annex language** (Annex S) for inclusion in a machinery safety case.

This document is intended for safety engineers, system integrators, and conformance auditors who must incorporate RCAN-defined behaviors into a machinery safety case for collaborative robots, industrial manipulators, or autonomous mobile robots operating near humans.

> **Fundamental caveat:** Conformance with the RCAN specification does not, by itself, constitute a safety-rated system or subsystem. RCAN is a protocol specification. Safety rating requires system-level risk assessment (ISO 12100), validated hardware safety systems, and formal SIL / PL verification. This document provides classification and guidance to support that process.

---

## Classification: Which RCAN Functions Are Safety-Relevant

A function is **safety-relevant** for the purposes of this document if its failure or absence would increase the probability of a hazardous event (e.g., unexpected robot motion near a person, failure to stop, unintended actuation).

A function is **not safety-relevant** (in the ISO 13849 / IEC 62061 sense) if its failure affects security, data integrity, or accountability but does not directly increase the probability of a hazardous mechanical event.

### Classification Table

| RCAN Function | Spec Clause | Safety-Relevant? | Rationale |
|---|---|---|---|
| Safe-stop on network loss | §8 | **YES** | Loss of communications could leave the robot in an undefined dynamic state. The safe-stop response (commanded deceleration to zero velocity and hold) is a protective measure that reduces the probability of collision or uncontrolled motion. |
| Local safety invariants — "local safety always wins" | §8 | **YES** | Prevents remote operators or LLM-generated commands from overriding on-device protective stops (e.g., proximitytriggered E-stop, joint limit enforcement). The invariant ensures that even a compromised or malfunctioning supervisory layer cannot disable local protective measures. |
| Priority bypass for SAFETY-class messages | §8 | **YES** | Ensures that emergency stop and safety-state signals are not queued behind normal-priority COMMAND traffic. Failure of this priority mechanism could delay E-stop propagation, increasing the probability and severity of injury. |
| HiTL gate — blocking of high-consequence autonomous actions | §16.3 | **YES** | Prevents the robot from autonomously executing action classes designated as high-consequence (e.g., full-force motion in a shared workspace) without explicit operator confirmation. The blocking behavior, when triggered, functions as a protective measure. |
| RBAC (5-tier role model) | §2 | **NO** | Access control function. Failure (e.g., privilege escalation) increases security risk but does not directly cause a hazardous mechanical event. Not a safety function in the ISO 13849 sense. |
| Audit trail and HMAC-keyed log chain | §6 | **NO** | Quality and forensic function. Audit log failure does not affect robot motion or protective stop behavior. |
| Model identity logging and attestation | §16.1 | **NO** | Accountability function. Model identity log failure does not prevent protective stops from firing. |
| Confidence gates (output confidence scoring) | §16.2 | **CONDITIONAL** | The confidence *score* itself is not a safety function. However, **if** confidence gates are configured to block command execution when confidence falls below a threshold in a context involving humans in the workspace, the *blocking behavior* is safety-relevant. Integrators must classify the confidence gate function on a per-deployment basis by assessing whether a gate failure (gate does not block a low-confidence command) increases the probability of a hazardous event. |

### Notes on the Conditional Classification of §16.2 Confidence Gates

The dual classification of §16.2 reflects the difference between:

- **The scoring mechanism** (computing a confidence value for LLM output) — not safety-relevant regardless of deployment.
- **The enforcement mechanism** (blocking or deferring command execution based on the threshold) — safety-relevant if and only if the blocked action class could otherwise produce a hazardous event.

Integrators who configure confidence gates as a protective measure for human-robot collaboration (e.g., "do not execute motion commands with confidence < 0.90 when a person is detected in the workspace") shall treat the gate enforcement function as safety-relevant and subject it to the implementation requirements in the following section.

---

## Implementation Requirements for Safety-Relevant Functions

The following requirements apply to each safety-relevant RCAN function. They are consistent with ISO 13849-1:2023 and IEC 62061:2021 and are intended to guide implementors in designing, verifying, and maintaining these functions.

### §8 Safe-Stop on Network Loss

**Recommended ISO 13849 Software Category:** Category 3 (dual-channel with cross-monitoring) or Category 4 (dual-channel with cross-monitoring and full diagnostic coverage) depending on the required PL.

**Minimum implementation requirements:**
- The safe-stop trigger shall operate independently of the normal command processing pipeline. A failure in the command processing path shall not prevent the safe-stop from being initiated.
- The watchdog timer that detects network loss shall be implemented in a module that is independently testable (self-test at power-on and periodic online diagnostic).
- The safe-stop output (deceleration command to the drive layer) shall be verifiable: a test mode shall allow injection of a simulated network-loss event and confirmation that the stop response is initiated within the specified latency.
- Software-only implementations of this function are subject to SILCL (SIL Capability Level) assessment per IEC 62061:2021 Clause 6. A software-only safe-stop function cannot, by itself, achieve SIL 3 / PLe without a validated hardware safety channel.

**Diagnostic coverage target:** DC ≥ 90% (Medium) for PL d; DC ≥ 99% (High) for PL e.

---

### §8 Local Safety Invariants ("Local Safety Always Wins")

**Recommended ISO 13849 Software Category:** Category 3 or 4.

**Minimum implementation requirements:**
- The invariant enforcement module shall execute at a higher priority than the RCAN command dispatch layer and shall not be pre-empted by LLM inference, network I/O, or user-space application code.
- The set of protected invariants (joint limits, proximity zones, force thresholds) shall be stored in write-protected memory or a separately validated configuration store. Unauthorized modification of invariant parameters shall be detectable.
- The invariant module shall include a power-on self-test (POST) that verifies all invariant parameters are within their configured ranges and that the enforcement path to the drive layer is intact.
- Integration with the hardware safety system (e.g., safety PLC, safety I/O module) is mandatory for deployments at PL d/e or SIL 2/3. The software invariant alone does not meet these levels.

**Diagnostic coverage target:** DC ≥ 90% (Medium) for PL d; DC ≥ 99% (High) for PL e.

---

### §8 Priority Bypass for SAFETY-Class Messages

**Recommended ISO 13849 Software Category:** Category 2 (single-channel with monitoring) at minimum; Category 3 for PL d.

**Minimum implementation requirements:**
- The message priority scheduler shall be implemented such that SAFETY-class messages preempt all queued COMMAND-class and CONFIG-class messages without exception.
- The scheduler implementation shall be verifiable: a test mode shall allow injection of a SAFETY message while a COMMAND message is queued and confirmation that the SAFETY message is dispatched first and within the specified latency bound.
- The priority mechanism shall be independent of application-layer configuration. No runtime parameter shall be capable of demoting a SAFETY-class message to lower priority.
- Latency from SAFETY message receipt to drive-layer application shall be measured and documented as part of the system's reaction time budget per ISO 13849-1:2023 Annex K.

---

### §16.3 HiTL Gate — Blocking of High-Consequence Autonomous Actions

**Recommended ISO 13849 Software Category:** Category 1 (single-channel, well-tried components) for supplementary use; Category 3 if the HiTL gate is the primary risk reduction measure for a given action class.

**Minimum implementation requirements:**
- The set of high-consequence action classes subject to HiTL gating shall be documented in the machinery safety case and shall be derived from the risk assessment per ISO 12100.
- The gate shall implement a **fail-safe default**: in the absence of operator confirmation (timeout, operator unreachable, or system uncertainty), the action shall not proceed.
- The operator confirmation channel shall be authenticated (§2 RBAC OPERATOR tier minimum) to prevent spoofed confirmations.
- HiTL gate events (gate triggered, operator confirmation received or denied, action proceeded or aborted) shall be logged to the §6 audit trail.
- The gate function shall be independently testable: a test mode shall allow simulation of a high-consequence action request and confirmation that the gate blocks execution until confirmation is received.

**Note on software-only implementation:** A software-only HiTL gate function is subject to IEC 62061:2021 SILCL assessment. For deployments where the HiTL gate is the primary protective measure for a high-PLr / high-SIL action class, supplementary hardware interlocking is strongly recommended.

---

### General Requirements for All Safety-Relevant RCAN Functions

1. **Independence:** Each safety-relevant RCAN function shall be implemented in a module that is logically and, where required by the target PL/SIL, physically independent of non-safety functions.
2. **Software safety lifecycle:** Software implementing safety-relevant RCAN functions shall be developed in accordance with IEC 62061:2021 Clause 7 (software safety requirements) or an equivalent process (e.g., ISO 26262 for automotive domains, IEC 61508-3 for general functional safety).
3. **Verification and validation:** Each safety-relevant function shall be subject to a documented verification and validation plan including unit tests, integration tests, and a hardware-in-the-loop (HiL) validation for the target platform.
4. **Change management:** Modifications to any safety-relevant RCAN function implementation shall trigger re-assessment of the affected safety function, including updated FMEA/FTA and re-validation of diagnostic coverage claims.

---

## Normative Annex S — Safety Function Implementation Guidance (Draft)

> **Editorial note:** The following annex is written in formal standards normative language for potential inclusion in a future revision of the RCAN specification. Shall = normative requirement. Should = recommendation. May = permission.

---

### Annex S (Informative) — Safety Function Implementation Guidance

#### S.1 Scope

This annex provides guidance for implementors incorporating RCAN-defined safety behaviors into machinery safety cases in accordance with ISO 13849-1:2023 (*Safety of machinery — Safety-related parts of control systems*) and IEC 62061:2021 (*Safety of machinery — Functional safety of safety-related control systems*).

This annex is informative. It does not impose requirements on RCAN conformance; however, implementors targeting functional safety certifications SHALL treat the guidance herein as normative for the purposes of their safety case.

#### S.2 RCAN as a Non-Safety-Rated Component

Conformance with the RCAN specification does not, by itself, constitute a safety-rated system or subsystem. The RCAN specification defines protocol behaviors; it does not specify hardware architectures, failure rate data (λ), diagnostic coverage (DC), or common cause failure (CCF) parameters required for quantitative safety integrity assessment.

Safety-relevant RCAN functions (as defined in S.3) SHALL be implemented in conjunction with a validated hardware safety system achieving a minimum of PLc (Category 2, MTTFd Medium) or SIL 1, as determined by the risk assessment per ISO 12100 and ISO 10218-2.

Safety-relevant RCAN functions SHALL be verified through the risk assessment process defined in:
- ISO 12100:2010 — Risk assessment and risk reduction
- ISO 10218-2:2011 — Robot system integration safety requirements
- ISO/TS 15066:2016 — Collaborative robots (for human-robot collaboration deployments)

#### S.3 Safety-Relevant Functions

The following RCAN-defined functions are classified as safety-relevant for the purposes of this annex. Each function is identified by its specification clause reference.

| Safety Function | Clause | Failure Mode of Concern |
|---|---|---|
| Safe-stop on network loss | §8 | Network loss not detected; robot continues motion in undefined state |
| Local safety invariant enforcement | §8 | Remote command overrides on-device protective stop |
| SAFETY-class message priority bypass | §8 | Emergency signal queued behind normal traffic; delayed E-stop |
| HiTL gate — high-consequence action blocking | §16.3 | Autonomous high-risk action executes without operator confirmation |
| Confidence gate enforcement (conditional) | §16.2 | Low-confidence command executes in proximity to humans (deployment-specific) |

Implementors SHALL document the applicable safety functions for their deployment in the machinery safety case and SHALL reference the relevant RCAN specification clause as the design specification for each function.

#### S.4 Supplementary Role of RCAN Software Safety Functions

When implemented alongside a hardware safety system achieving PLe / SIL 3 (Category 4, dual-channel with DC High), RCAN's software safe-stop functions (§8) MAY be treated as supplementary protective measures in the risk reduction calculation, provided that:

a) The software safe-stop function is implemented independently of the hardware safety channel (no shared software modules, no shared power supply, no shared I/O path).

b) The diagnostic coverage of the software safe-stop function is assessed and documented in accordance with IEC 62061:2021 Table D.1 (software systematic capability assessment).

c) Common cause failure (CCF) between the software safe-stop function and the hardware safety channel is assessed and mitigated in accordance with ISO 13849-1:2023 Annex F or IEC 62061:2021 Annex F.

d) The combined risk reduction contribution of the software and hardware channels does not exceed the quantitative limits established by the applicable standard for software-only contributions (IEC 62061:2021 Clause 6.2).

The RCAN software safe-stop function SHALL NOT be credited as the sole risk reduction measure for any hazard requiring PLd/e or SIL 2/3 without supplementary hardware interlocking.

#### S.5 Reference Implementation

OpenCastor's reactive layer (`castor/tiered_brain.py`) provides a reference implementation of the §8 safety invariants in software. The reactive layer is architecturally significant in the following respects relevant to functional safety:

- **Execution order:** The reactive layer executes before any LLM inference call in the processing pipeline. Safety invariants are evaluated against the current robot state before any AI-generated command reaches the command dispatch layer.
- **Non-overridability:** The reactive layer's invariant checks cannot be suppressed or overridden by LLM model output. The model output is evaluated *after* the reactive layer has confirmed that proceeding is permissible under current invariant conditions.
- **Separation of concerns:** The reactive layer is a distinct software module with no runtime dependency on the LLM inference module. A failure in the inference module does not impair the reactive layer's ability to enforce safety invariants.

Implementors using OpenCastor as a basis for their system SHALL review `castor/tiered_brain.py` against the requirements of S.2 and S.3 and SHALL conduct a software FMEA covering the reactive layer's invariant enforcement path.

> **Note:** The OpenCastor reference implementation is provided as an illustrative example. It has not been independently certified against ISO 13849-1 or IEC 62061. Integrators are responsible for their own conformance assessment.

---

## References

- ISO 13849-1:2023 — Safety of machinery: Safety-related parts of control systems — Part 1: General principles for design
- IEC 62061:2021 — Safety of machinery: Functional safety of safety-related control systems
- ISO 12100:2010 — Safety of machinery: General principles for design — Risk assessment and risk reduction
- ISO 10218-1:2011 — Robots and robotic devices: Safety requirements for industrial robots — Part 1: Robots
- ISO 10218-2:2011 — Robots and robotic devices: Safety requirements for industrial robots — Part 2: Robot systems and integration
- ISO/TS 15066:2016 — Robots and robotic devices: Collaborative robots
- IEC 61508-3:2010 — Functional safety of E/E/PE safety-related systems — Part 3: Software requirements
- RCAN Specification §8 (Safety Layer)
- RCAN Specification §2 (Access Control and RBAC)
- RCAN Specification §6 (Audit Trail and Quantum Commitment Chain)
- RCAN Specification §16 (AI Accountability)
- OpenCastor reference implementation: `castor/tiered_brain.py`

---

*This document is informative guidance. It does not constitute a safety certification, a PL/SIL claim, or a declaration of conformity under ISO 13849 or IEC 62061. Formal safety certification requires assessment by a competent and, where required by applicable regulations, accredited third-party certification body.*
