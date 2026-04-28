# Plan A — rcan-spec NA Compliance Docs Cascade

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ANSI/RIA R15.06, ANSI/RIA R15.08, and ISO/TS 15066 alignment docs to rcan-spec, plus a new normative §27 (Multi-jurisdiction compliance declarations), and bump the spec to v3.2.0.

**Architecture:** Pure docs cascade — no schema changes, no code changes, no API changes in this plan. The §27 spec section is normative (describes the `compliance.jurisdictions[]` shape that robot-md will implement in Plan B). The three alignment docs are informative (describe how RCAN provisions map to each standard's clauses). One existing doc (`iso-10218-alignment.md`) gets a one-paragraph cross-reference. CHANGELOG, VERSIONING, and `package.json` get version bumps.

**Tech Stack:** Astro 5.x for the spec site, Markdown for docs, `pnpm` for build/test, `vitest` for content-collection tests.

**Spec reference:** `~/robot-md/docs/superpowers/specs/2026-04-27-na-compliance-jurisdictions-design.md` (commit 3f5656a in robot-md).

---

## File Structure

| Path | Action | Purpose |
|---|---|---|
| `spec/sections/27-multi-jurisdiction-compliance.md` | Create | New normative spec section. Describes `compliance.jurisdictions[]` semantics, regime enum, gate layering, voluntary frameworks. |
| `docs/compliance/ansi-ria-r1506-alignment.md` | Create | Informative R15.06 ↔ RCAN clause-by-clause alignment. |
| `docs/compliance/ansi-ria-r1508-alignment.md` | Create | Informative R15.08 ↔ RCAN clause-by-clause alignment. Heaviest doc — collaborative-mode mapping. |
| `docs/compliance/iso-ts-15066-alignment.md` | Create | Informative ISO/TS 15066 ↔ RCAN alignment (parent of R15.08). |
| `docs/compliance/iso-10218-alignment.md` | Modify | Append a 1-paragraph cross-reference to R15.06 near the top. |
| `CHANGELOG.md` | Modify | Add v3.2 entry. |
| `VERSIONING.md` | Modify | Update "Current version: v1.3" reference (already stale) to v3.2. |
| `package.json` | Modify | Bump version 3.0.0 → 3.2.0. |

---

## Task 1: Add normative §27 spec section

**Files:**
- Create: `spec/sections/27-multi-jurisdiction-compliance.md`

- [ ] **Step 1: Confirm directory and existing section style**

Run: `ls spec/sections/ && head -20 spec/sections/2-rbac.md`
Expected: see `2-rbac.md` and `MESSAGE_TYPE_NUMBERING.md` listed; the section file uses an h1 title and standard markdown.

- [ ] **Step 2: Write §27 content**

Create `spec/sections/27-multi-jurisdiction-compliance.md` with this exact content:

```markdown
# §27 Multi-Jurisdiction Compliance Declarations

**Status:** Normative
**Spec version introduced:** v3.2
**Schema target:** `compliance.jurisdictions[]` in `site/schema/v2/robot.schema.json` (robot-md)

## §27.1 Purpose

A robot may be deployed across jurisdictions with overlapping but non-identical conformance regimes. RCAN robots MUST declare conformance with each applicable legal regime independently rather than collapsing them into a single jurisdiction-implicit field.

## §27.2 Declaration shape

The `compliance` block in a robot manifest contains:

- `compliance.jurisdictions[]` — an ordered array of regime declarations. Order is not semantically significant. Each entry is a discriminated union on `regime`.
- `compliance.iso_42001`, `compliance.nist_ai_rmf`, `compliance.iec_62443` — flat sibling blocks for voluntary / management-system / cybersecurity frameworks. These are not jurisdiction declarations and MUST NOT appear inside `jurisdictions[]`.

A robot MAY declare zero, one, or more entries in `jurisdictions[]`. A manifest with no `compliance` block at all is permissible at the schema layer; deployment-time tooling MAY require a non-empty declaration.

## §27.3 Regime enum

The `regime` field on each jurisdiction entry is a string with one of the following values:

| Value | Standard | Edition field required |
|---|---|---|
| `eu_ai_act` | EU AI Act (Regulation (EU) 2024/1689) | No (single regulation) |
| `ansi_ria_r1506` | ANSI/RIA R15.06 (Industrial Robot Safety, US adoption of ISO 10218-1/2) | Yes (`2012` or `2025`) |
| `ansi_ria_r1508` | ANSI/RIA R15.08 (Collaborative Robot Safety, US adoption of ISO/TS 15066) | Yes (`2023`) |

Future regimes (UK AI Bill, Canadian AIDA, etc.) are added by extending this enum without spec-major bumps.

## §27.4 Gates: declaration must come with evidence

Each regime declaration MUST be accompanied by the evidence its underlying standard requires. Schema-layer gates (enforced via JSON Schema `if/then`) MUST reject manifests where:

- `regime: eu_ai_act` is declared without `risk_assessment_ref`.
- `regime: eu_ai_act` is declared with `annex_iii_basis` set but without `fria_ref` (preserves the v3.1 FRIA gate).
- `regime: ansi_ria_r1506` is declared without `edition`, `system_integrator`, or `risk_assessment_ref`.
- `regime: ansi_ria_r1508` is declared without `edition`, `risk_assessment_ref`, or a non-empty `collaborative_modes[]`.
- `regime: ansi_ria_r1508` is declared with `collaborative_modes` containing `power_force_limiting` but without `force_limits_ref`.

Validator-layer gates (enforced by `robot-md validate` or equivalent) MUST additionally:

- Reject manifests with duplicate `regime` values in `jurisdictions[]`.
- Reject `edition` values that are not yet published as of validator release date.

Capability-layer gates (enforced by `robot-md doctor` or equivalent) SHOULD additionally cross-reference declared `collaborative_modes` against the robot's actual safety primitives (e.g., `safety_rated_monitored_stop` declared but no safety-rated stop primitive in the backend driver). Capability gates are out of scope for v3.2 and are tracked as future work.

## §27.5 Migration from v3.1 (informative)

A v3.1 manifest with this shape:

```yaml
compliance:
  fria_ref: "https://example.org/fria.pdf"
  annex_iii_basis: "safety_component"
  eu_ai_act:
    audit_retention_days: 2555
  iso_42001:
    self_assessed: true
```

Becomes this in v3.2:

```yaml
compliance:
  jurisdictions:
    - regime: "eu_ai_act"
      risk_assessment_ref: "https://example.org/risk-assessment.pdf"
      annex_iii_basis: "safety_component"
      fria_ref: "https://example.org/fria.pdf"
      audit_retention_days: 2555
  iso_42001:
    self_assessed: true
```

The `risk_assessment_ref` is newly required; operators upgrading from v3.1 MUST supply one (they were obligated to have one under EU AI Act Article 9 already; the schema now enforces declaration).

`compliance.eu_ai_act` is removed; its single field (`audit_retention_days`) moves into the EU jurisdiction entry.

## §27.6 Conformance level

Conformance with §27 is required for any RCAN v3.2 manifest that contains a `compliance` block. Manifests omitting `compliance` are not subject to §27.
```

- [ ] **Step 3: Run Astro build to verify markdown parses**

Run: `pnpm build`
Expected: build succeeds; no broken-link or content-collection errors involving `27-multi-jurisdiction-compliance.md`.

- [ ] **Step 4: Commit**

```bash
git add spec/sections/27-multi-jurisdiction-compliance.md
git commit -m "spec(§27): multi-jurisdiction compliance declarations"
```

---

## Task 2: Create ANSI/RIA R15.06 alignment doc

**Files:**
- Create: `docs/compliance/ansi-ria-r1506-alignment.md`

- [ ] **Step 1: Reference the existing template**

Run: `head -50 docs/compliance/iso-10218-alignment.md`
Expected: header block with Document type / RCAN spec version / Standard / Status / Last updated; Purpose section; Document Scope two-column table; Clause-by-Clause Alignment Table.

- [ ] **Step 2: Write the alignment doc following the established template**

Create `docs/compliance/ansi-ria-r1506-alignment.md` with this content (the table-row examples below are the *complete* required set — do not abbreviate):

```markdown
# RCAN Protocol — ANSI/RIA R15.06 Alignment

**Document type:** Compliance alignment
**RCAN spec version:** 3.2 (rcan.dev/spec)
**Standard:** ANSI/RIA R15.06 — American National Standard for Industrial Robots and Robot Systems — Safety Requirements (US adoption of ISO 10218-1 and ISO 10218-2)
**Status:** Informative
**Last updated:** 2026-04-27

---

## Purpose

ANSI/RIA R15.06 is the United States adoption of ISO 10218-1 (industrial robots) and ISO 10218-2 (industrial robot systems and integration). It is published by the Association for Advancing Automation (A3) and accredited by ANSI. It is the de facto baseline for industrial-robot deployment safety in North America: OSHA recognizes it for general-duty-clause compliance, integrators reference it in customer contracts, and insurance carriers underwrite to it.

R15.06 governs the mechanical, electrical, and integration safety of industrial robots. RCAN governs the AI-agent-and-network governance layer above the controller. The two are complementary: a deployment is conformant with both, not one or the other. This document maps the points where RCAN provisions satisfy or extend R15.06 obligations, and where RCAN fills gaps that R15.06 does not address — in particular, AI model accountability, prompt-injection defense, and federated principal authentication.

For the parent standards, see `iso-10218-alignment.md` (ISO 10218-1:2025). R15.06 in this document refers to the 2012 edition (currently in force in the US) and the forthcoming 2025 edition where applicable.

---

## Document Scope

| Framework | Scope |
|-----------|-------|
| **RCAN** | AI agent governance, robot networking, access control, audit trail, AI decision accountability, human-in-the-loop authorization, federated robot communication |
| **ANSI/RIA R15.06** | Mechanical and integration safety of industrial robots: design, manufacture, system integration, safeguarding (fences, light curtains, safety zones), risk assessment methodology, system integrator obligations |

These are not competing standards. A robot system can and should be compliant with both. R15.06 addresses the physical and integration layer; RCAN addresses the AI and networking layer above it. Compliance with one does not imply compliance with the other.

---

## Clause-by-Clause Alignment Table

| RCAN Provision | R15.06 Requirement | Relationship |
|---|---|---|
| **§6 Audit trail** — All `COMMAND` and `CONFIG` messages MUST be logged with principal identity, RURI, timestamp (ms), message_id, and outcome (`ok` / `blocked` / `error`) | R15.06-1 §5.4 — Risk-assessment records and traceability | **Aligned** — RCAN's audit trail satisfies the traceability obligation at the AI-command layer. R15.06's records are paper/PLC-controller-side; RCAN's are at the AI-agent-side. Both are required. |
| **§2 RBAC — 5-tier role hierarchy** (GUEST → USER → LEASEE → OWNER → CREATOR) with protocol-enforced scope restrictions and rate limits per role | R15.06-2 §5.3 — System integrator authentication and authorization for control-system access | **Aligned** — RCAN's role hierarchy satisfies the access-control obligation at the message layer. RCAN extends it by making roles JWT-embedded and verified per-message rather than session-scoped. |
| **§16.1 Model identity in audit records** — Every AI-generated command audit record MUST include: model provider, model identifier, inference confidence score, inference latency (ms), thought_id, escalation flag | No equivalent in R15.06 | **RCAN Fills Gap** — R15.06 has no requirement to record which AI model produced a command, at what confidence, or whether a fallback model was invoked. Without this information, forensic investigation of an AI-caused incident is impossible. |
| **§16.2 Confidence gates** — Minimum confidence thresholds MUST be declared per action scope; commands MUST be rejected before dispatch if reported confidence falls below threshold | No equivalent in R15.06 | **RCAN Fills Gap** — R15.06 defines mechanical and integration limits but has no mechanism to gate command execution on AI model confidence. |
| **§6 Prompt-injection defense** — Implementations forwarding natural-language instructions to a language model MUST scan for injection patterns; `ScanVerdict.BLOCK` MUST short-circuit before model invocation | R15.06-1 §5.4 — Software integrity for the robot control system | **RCAN Fills Gap** — R15.06's software-integrity obligations cover firmware and controller software. They do not address prompt injection, which is a distinct attack vector specific to LLM-driven control systems. |
| **§16.3 Confidence regression detection** — Drift in model confidence over time MUST be tracked and surfaced as a safety signal | No equivalent in R15.06 | **RCAN Fills Gap** — R15.06 assumes static control logic; AI-driven control evolves. RCAN tracks the evolution. |
| **§17 Distributed Registry / RRN** — Robots are addressable via RRN URIs registered with a federation registry | No equivalent in R15.06 | **RCAN Fills Gap** — R15.06 does not address inter-robot identity. RCAN provides a federated naming scheme. |
| **§19 INVOKE / Capability Advertisement** — Robots advertise their capabilities and accept invocations via typed messages | R15.06-2 §5.5 — Integration validation and capability documentation | **Aligned** — RCAN's machine-readable capability advertisement satisfies the integration-validation documentation obligation. |
| **§22 FRIA (when EU jurisdiction also declared)** — Cross-jurisdiction declarations may share a single risk-assessment artifact | R15.06-1 §5.2 — Risk-assessment methodology (ISO 12100 reference) | **Aligned** — A risk assessment performed to ISO 12100 also satisfies the EU AI Act FRIA when scoped to fundamental-rights impacts. RCAN supports both via shared `risk_assessment_ref`. |
| **§27 Multi-jurisdiction compliance declarations** — `compliance.jurisdictions[].regime=ansi_ria_r1506` MUST include `system_integrator`, `edition`, and `risk_assessment_ref` | R15.06-2 §4 — System integrator obligations | **Aligned** — RCAN's schema requires the named integrator declaration that R15.06-2 mandates as a precondition for system-level conformance. |
| **§16.4 Authorization escalation** — Commands above a confidence-or-scope threshold MUST escalate to a higher principal role | R15.06-1 §5.7 — Override and authorization controls | **Aligned, RCAN extends** — R15.06 specifies physical override controls (key switches, etc.); RCAN extends to AI-decision authorization. Both apply. |
| **§6.7 Safety invariants** — Manifest-declared safety invariants MUST be enforced at message dispatch | R15.06-1 §5.6 — Speed and force limits in non-collaborative operation | **Aligned** — RCAN's safety invariants are the AI-side enforcement of the same physical limits R15.06 declares. The mechanism is different (message-layer rejection vs. controller-layer limit), but the obligation is the same. |

---

## Cross-References

| Normative target | Schema field |
|---|---|
| §27 (this spec) | `compliance.jurisdictions[].regime=ansi_ria_r1506` |
| §27.4 gates | `edition`, `system_integrator`, `risk_assessment_ref` required when regime is declared |
| Optional ISO 10218 traceability | `iso_10218_part1_ref`, `iso_10218_part2_ref` |

For RCAN's own normative text on the declaration shape, see §27 in this spec.

For ISO 10218-1:2025 alignment (the parent standard), see `iso-10218-alignment.md`.

---

## Versioning Note

This alignment doc is reviewed and updated when:

1. The RCAN spec is bumped (next review at v3.3).
2. ANSI/RIA R15.06 is republished (the 2025 edition is anticipated; this doc will be updated to map any new clauses).

Last reviewed: 2026-04-27 against ANSI/RIA R15.06-2012.
```

- [ ] **Step 3: Run Astro build to verify markdown parses and links resolve**

Run: `pnpm build`
Expected: build succeeds; no broken links to `iso-10218-alignment.md` or `27-multi-jurisdiction-compliance.md`.

- [ ] **Step 4: Commit**

```bash
git add docs/compliance/ansi-ria-r1506-alignment.md
git commit -m "docs(compliance): add ANSI/RIA R15.06 alignment"
```

---

## Task 3: Create ANSI/RIA R15.08 alignment doc

**Files:**
- Create: `docs/compliance/ansi-ria-r1508-alignment.md`

- [ ] **Step 1: Write the alignment doc**

Create `docs/compliance/ansi-ria-r1508-alignment.md`:

```markdown
# RCAN Protocol — ANSI/RIA R15.08 Alignment

**Document type:** Compliance alignment
**RCAN spec version:** 3.2 (rcan.dev/spec)
**Standard:** ANSI/RIA R15.08-1:2023 — Industrial Mobile Robots — Safety Requirements (and R15.08-2 for collaborative-robot integration; US adoption of ISO/TS 15066)
**Status:** Informative
**Last updated:** 2026-04-27

---

## Purpose

ANSI/RIA R15.08 governs the safety of collaborative robots — robots designed to share workspace with humans without traditional fixed safeguarding. It is published by the Association for Advancing Automation (A3), accredited by ANSI, and is the US analogue of ISO/TS 15066. R15.08 covers four collaborative-operation modes: safety-rated monitored stop, hand guiding, speed-and-separation monitoring, and power-and-force limiting.

RCAN governs the AI-agent and networking layer above the cobot's controller. R15.08 governs the mechanical, force/pressure, and operational-mode layer. The two are complementary. This document maps RCAN provisions to R15.08 clauses, with particular focus on how each of the four collaborative modes maps to RCAN message types, principal-role requirements, and capability declarations.

For the parent standard, see `iso-ts-15066-alignment.md`. For industrial (non-collaborative) robots, see `ansi-ria-r1506-alignment.md`.

---

## Document Scope

| Framework | Scope |
|-----------|-------|
| **RCAN** | AI agent governance, robot networking, access control, audit trail, AI decision accountability, human-in-the-loop authorization for cobot commands |
| **ANSI/RIA R15.08** | Cobot safety: design parameters for the four collaborative modes, force/pressure limits per body region (via ISO/TS 15066 Annex A), risk-assessment methodology specific to human-robot collaboration |

A cobot deployment must conform to both. R15.08 ensures the robot cannot mechanically harm a person; RCAN ensures the AI agent driving the robot is auditable and authorized. Neither implies the other.

---

## Clause-by-Clause Alignment Table

| RCAN Provision | R15.08 Requirement | Relationship |
|---|---|---|
| **§27.4 collaborative_modes[] enum** — Robots declaring `regime=ansi_ria_r1508` MUST list at least one of: `safety_rated_monitored_stop`, `hand_guiding`, `speed_and_separation_monitoring`, `power_force_limiting` | R15.08 §5 — The four collaborative-operation modes | **Aligned** — RCAN's schema enum is a direct lift of the R15.08 mode taxonomy. Declaring a mode in `collaborative_modes[]` is the manifest-layer assertion that the robot supports that mode. |
| **§27.4 PFL force-limits gate** — Declaring `power_force_limiting` in `collaborative_modes` MUST require a non-null `force_limits_ref` | R15.08 §5.4 + ISO/TS 15066 Annex A — Force/pressure limits per body region for power-and-force-limiting mode | **Aligned, schema-enforced** — The R15.08 PFL obligation is meaningless without the force/pressure declaration. The schema gate makes paper-only PFL declaration impossible. |
| **§2 RBAC — LEASEE role + scoped JWT** | R15.08 §5.2 — Hand-guiding requires authorized operator with active control | **Aligned** — RCAN's LEASEE principal with a scoped JWT is the message-layer mechanism for asserting "this human is currently authorized to hand-guide." Hand-guiding sessions issue a LEASEE token bound to the session; the token is revoked when guiding ends. |
| **§19 Telemetry messages — proximity, vision, force-torque** | R15.08 §5.3 — Speed-and-separation monitoring requires real-time human-position sensing | **Aligned** — RCAN's perception telemetry messages are the data path for SSM. Operators implementing SSM declare the proximity sensor in their robot manifest's `sensors[]` and emit the telemetry per §19. |
| **§6.7 Safety invariants** — Manifest-declared invariants enforced at message dispatch | R15.08 §5.1 — Safety-rated monitored stop requires a safety-rated stop function | **Aligned** — RCAN's safety invariants enforce stop-on-violation at the message layer; R15.08 specifies the underlying primitive. The two layer cleanly. |
| **§6 Audit trail** — All collaborative-mode transitions MUST be logged | R15.08 §6 — Mode transitions are safety-critical events requiring records | **Aligned** — A `CONFIG` message switching collaborative mode is an audited event in RCAN; R15.08 obliges it to be recorded. |
| **§16.2 Confidence gates** — Minimum AI confidence thresholds declared per action scope | No equivalent in R15.08 | **RCAN Fills Gap** — R15.08 has no provision for AI confidence. An AI agent commanding a cobot in PFL mode at low confidence is a distinct failure mode that RCAN gates against. |
| **§16.1 Model identity in audit** — Recorded per command | No equivalent in R15.08 | **RCAN Fills Gap** — Forensic accountability for AI-caused cobot incidents requires model identity. R15.08 records mode and operator but not model. |
| **§17 RRN federation** — Robots have a global identity | No equivalent in R15.08 | **RCAN Fills Gap** — R15.08 governs a single deployment; multi-robot or multi-operator federation is RCAN's domain. |
| **§16.4 Authorization escalation** — Above-threshold commands escalate principal role | R15.08 §5.5 — Mode-change authorization | **Aligned, RCAN extends** — R15.08 covers physical mode-change authorization (button presses, key switches); RCAN extends to AI-initiated mode-change requests. |
| **§27.4 risk_assessment_ref required** | R15.08 §4 — Risk assessment specific to human-robot collaboration is the precondition for any cobot deployment | **Aligned, schema-enforced** — The schema gate prevents declaration of R15.08 conformance without naming the risk-assessment artifact. |
| **§27.4 edition required** | R15.08 evolves; the 2023 edition introduced revised PFL limits | **Aligned, schema-enforced** — Declaring an edition makes the conformance claim verifiable against the right document. |
| **§19 Capability advertisement — collaborative_modes** | R15.08 §5 — Mode capabilities must be declared by the integrator | **Aligned** — RCAN's capability advertisement is the machine-readable form of R15.08's integrator declaration. |
| **§22 FRIA (when EU also declared)** | R15.08 §4 risk assessment | **Aligned, shareable** — Same artifact can satisfy both with appropriate scoping. |
| **§6.5 Rate limits per role** | R15.08 §5.5 — Mode-change throttling to prevent rapid mode oscillation | **Aligned** — RCAN's per-role rate limits include CONFIG-message rate limits, which cap mode-change frequency. |

---

## Cross-References

| Normative target | Schema field |
|---|---|
| §27 (this spec) | `compliance.jurisdictions[].regime=ansi_ria_r1508` |
| §27.4 PFL gate | `collaborative_modes` contains `power_force_limiting` → `force_limits_ref` required |
| §27.4 mode enum | `collaborative_modes[]` items: `safety_rated_monitored_stop` / `hand_guiding` / `speed_and_separation_monitoring` / `power_force_limiting` |
| ISO/TS 15066 alignment | `iso-ts-15066-alignment.md` |
| R15.06 (industrial, non-collaborative) | `ansi-ria-r1506-alignment.md` |

For ISO/TS 15066 numerical force/pressure tables (Annex A), see the underlying standard. RCAN does not duplicate the table; the `force_limits_ref` URI points to the operator's deployment-specific declaration.

---

## Versioning Note

This alignment doc is reviewed and updated when:

1. The RCAN spec is bumped (next review at v3.3).
2. ANSI/RIA R15.08 is republished or amended.
3. ISO/TS 15066 is revised (15066 is the parent standard for the PFL clauses).

Last reviewed: 2026-04-27 against ANSI/RIA R15.08-1:2023.
```

- [ ] **Step 2: Build to verify**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add docs/compliance/ansi-ria-r1508-alignment.md
git commit -m "docs(compliance): add ANSI/RIA R15.08 alignment"
```

---

## Task 4: Create ISO/TS 15066 alignment doc

**Files:**
- Create: `docs/compliance/iso-ts-15066-alignment.md`

- [ ] **Step 1: Write the alignment doc**

Create `docs/compliance/iso-ts-15066-alignment.md`:

```markdown
# RCAN Protocol — ISO/TS 15066 Alignment

**Document type:** Compliance alignment
**RCAN spec version:** 3.2 (rcan.dev/spec)
**Standard:** ISO/TS 15066:2016 — Robots and robotic devices — Collaborative robots
**Status:** Informative
**Last updated:** 2026-04-27

---

## Purpose

ISO/TS 15066 is the ISO Technical Specification governing collaborative-robot safety. It is the parent standard for ANSI/RIA R15.08 (US adoption) and the de facto reference for European cobot deployments. Its central technical contribution is Annex A: a body-region-by-region table of force and pressure limits that a cobot in power-and-force-limiting (PFL) mode must not exceed.

This alignment doc exists primarily for traceability when European operators reference ISO/TS 15066 directly without going through R15.08. The clause mappings overlap heavily with `ansi-ria-r1508-alignment.md`; this doc is the parent and the R15.08 doc is the US-flavored child.

---

## Document Scope

| Framework | Scope |
|-----------|-------|
| **RCAN** | AI agent governance, robot networking, audit trail, AI accountability for cobot commands |
| **ISO/TS 15066** | Cobot collaborative-operation modes; numerical force and pressure limits per body region (Annex A); risk-assessment methodology for human-robot interaction |

---

## Clause-by-Clause Alignment Table

| RCAN Provision | ISO/TS 15066 Requirement | Relationship |
|---|---|---|
| **§27.4 collaborative_modes[]** | Clause 5 — The four collaborative-operation types | **Aligned** — RCAN's enum mirrors the four ISO/TS 15066 modes. |
| **§27.4 force_limits_ref required when PFL declared** | Annex A — Force and pressure limits per body region for quasi-static and transient contacts | **Aligned, schema-enforced** — The PFL gate prevents declaration without a pointer to the operator's body-region force/pressure declarations. |
| **§19 Telemetry messages — force-torque** | Clause 5.5 — PFL force-monitoring requirements | **Aligned** — Force-torque telemetry per §19 is the data path; ISO/TS 15066 defines the limits the data must respect. |
| **§19 Telemetry messages — proximity, vision** | Clause 5.4 — Speed-and-separation monitoring | **Aligned** — Same as R15.08 alignment. |
| **§2 RBAC — LEASEE** | Clause 5.3 — Hand-guiding authorization | **Aligned** — Same as R15.08 alignment. |
| **§6 Audit trail — mode transitions** | Clause 6 — Records of collaborative-operation events | **Aligned** — RCAN's CONFIG audit covers mode changes. |
| **§6.7 Safety invariants** | Clause 5.2 — Safety-rated monitored stop | **Aligned** — Stop-on-invariant-violation in RCAN; primitive in ISO/TS 15066. |
| **§16.1 Model identity in audit** | No equivalent | **RCAN Fills Gap** — ISO/TS 15066 predates LLM-driven control. |
| **§16.2 Confidence gates** | No equivalent | **RCAN Fills Gap** — Same as R15.08. |
| **§17 RRN federation** | No equivalent | **RCAN Fills Gap** — Single-deployment scope in 15066. |

---

## Cross-References

| Normative target | Field |
|---|---|
| §27 multi-jurisdiction declaration | The 15066 declaration is implicit when `regime=ansi_ria_r1508` is declared (R15.08 incorporates 15066 by reference). For operators referencing 15066 directly without R15.08, set `compliance.jurisdictions[].iso_ts_15066_ref` on the relevant entry. |
| Force/pressure limits | `force_limits_ref` (URI to operator's Annex A declarations) |
| ANSI/RIA R15.08 alignment | `ansi-ria-r1508-alignment.md` |

---

## Versioning Note

This alignment doc is reviewed and updated when:

1. The RCAN spec is bumped (next review at v3.3).
2. ISO/TS 15066 is revised. (As of 2026-04-27, the current edition is 2016; an ISO 15066 full standard is anticipated to replace the TS — this doc will be updated when published.)

Last reviewed: 2026-04-27 against ISO/TS 15066:2016.
```

- [ ] **Step 2: Build to verify**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add docs/compliance/iso-ts-15066-alignment.md
git commit -m "docs(compliance): add ISO/TS 15066 alignment"
```

---

## Task 5: Add R15.06 cross-reference paragraph to existing ISO 10218 doc

**Files:**
- Modify: `docs/compliance/iso-10218-alignment.md`

- [ ] **Step 1: Read the existing doc to find the right insertion point**

Run: `head -25 docs/compliance/iso-10218-alignment.md`
Expected: header block, then `---`, then `## Purpose` section. Insert the cross-ref paragraph at the *end* of the Purpose section.

- [ ] **Step 2: Append cross-reference paragraph**

Use Edit to add a new final paragraph at the end of the existing `## Purpose` section. The paragraph should read:

```
> Operators in North America declaring conformance with ANSI/RIA R15.06 should refer to that standard's alignment doc; R15.06 is the US adoption of ISO 10218-1/2 with US-specific integration extensions. The schema field `compliance.jurisdictions[].regime=ansi_ria_r1506` is the declarative mechanism. See `ansi-ria-r1506-alignment.md`.
```

(Use a blockquote so it's visually distinct from the body paragraphs above it.)

- [ ] **Step 3: Build to verify the link resolves**

Run: `pnpm build`
Expected: build succeeds; no broken-link warning for `ansi-ria-r1506-alignment.md`.

- [ ] **Step 4: Commit**

```bash
git add docs/compliance/iso-10218-alignment.md
git commit -m "docs(compliance): cross-reference R15.06 from ISO 10218 alignment"
```

---

## Task 6: Bump version to 3.2.0

**Files:**
- Modify: `package.json`
- Modify: `CHANGELOG.md`
- Modify: `VERSIONING.md`

- [ ] **Step 1: Bump `package.json`**

Edit `package.json`: change `"version": "3.0.0"` to `"version": "3.2.0"`.

(If `package.json` already shows `3.1.0` or another value, bump to `3.2.0` regardless — the target is 3.2.0.)

- [ ] **Step 2: Add CHANGELOG entry**

Prepend the following entry below the top header in `CHANGELOG.md` (use Edit on the file's first version-header anchor):

```markdown
## v3.2 — 2026-04-27

**Added — Multi-jurisdiction compliance declarations**
- §27 (normative): `compliance.jurisdictions[]` with discriminated union on `regime` (`eu_ai_act` / `ansi_ria_r1506` / `ansi_ria_r1508`).
- Standard-of-conduct gates: each regime declaration must come with the evidence its underlying standard requires (FRIA gate preserved, plus risk-assessment-ref / system-integrator / force-limits-ref gates).
- New informative alignment docs:
  - `docs/compliance/ansi-ria-r1506-alignment.md`
  - `docs/compliance/ansi-ria-r1508-alignment.md`
  - `docs/compliance/iso-ts-15066-alignment.md`
- Cross-reference paragraph added to existing `iso-10218-alignment.md`.

**Schema impact** — robot.schema.json v2 (in robot-md repo) implements §27. Manifests using v3.1's flat `compliance.fria_ref` / `compliance.annex_iii_basis` shape MUST migrate; see `robot-md/scripts/migrate-compliance-v2.py` (Plan B).

**SDK Compatibility**
- robot-md >= 2.0.0
- rcan-py >= 3.4.0
- rcan-ts >= 3.4.0
- OpenCastor >= the next release that bumps rcan-py to 3.4.0
```

- [ ] **Step 3: Update VERSIONING.md current-version line**

Use Edit to change `Current version: **v1.3** (MAJOR.MINOR; PATCH omitted when 0)` to `Current version: **v3.2** (MAJOR.MINOR; PATCH omitted when 0)` in `VERSIONING.md`. (This corrects a doc that has been stale across multiple version bumps; only this single line should change.)

- [ ] **Step 4: Build + run vitest to verify nothing broke**

Run: `pnpm build && pnpm test`
Expected: build succeeds; all vitest tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json CHANGELOG.md VERSIONING.md
git commit -m "chore(release): rcan-spec v3.2 — multi-jurisdiction compliance declarations"
```

---

## Task 7: Final verification + tag

**Files:** none modified

- [ ] **Step 1: Confirm clean working tree**

Run: `git status`
Expected: nothing to commit, working tree clean.

- [ ] **Step 2: Run full build + test once more**

Run: `pnpm build && pnpm test`
Expected: both succeed.

- [ ] **Step 3: Confirm all the new docs are linked from the build**

Run: `grep -rln "ansi-ria-r1506-alignment\|ansi-ria-r1508-alignment\|iso-ts-15066-alignment" dist/ 2>/dev/null | head -5`
Expected: at least one match per filename — the Astro build output references the new docs.

- [ ] **Step 4: Tag the release**

```bash
git tag v3.2.0
git push origin main
git push origin v3.2.0
```

(Push only if the user has confirmed they want this released — release tagging is sometimes deferred. Verify before pushing.)

---

## Plan completion check

- [ ] §27 spec section created and parses in the build
- [ ] Three new alignment docs created and link-checked
- [ ] iso-10218-alignment.md cross-references R15.06
- [ ] package.json, CHANGELOG.md, VERSIONING.md updated to v3.2
- [ ] `pnpm build && pnpm test` succeeds on a clean working tree
- [ ] (Optional) Tag pushed to origin

When all boxes are checked, Plan A is complete. Plan B (robot-md schema v2) can begin once this plan's commits are visible on `main`.
