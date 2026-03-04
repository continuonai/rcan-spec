# ISO/TC 299 Engagement Roadmap

**Status:** Internal working document  
**Closes:** [Issue #7](https://github.com/continuonai/rcan-spec/issues/7)  
**Last updated:** 2026-03-03  
**Audience:** RCAN contributors and maintainers

---

> **Purpose:** This is a practical, internal strategy document for how the RCAN project pursues engagement with ISO/TC 299 (Robotics) and related standards bodies. It is committed to the repo so contributors understand the standardization context and can participate in outreach efforts.

---

## 1. Why Standards Engagement Matters

RCAN addresses a gap that existing robot safety standards do not cover: **AI decision accountability at the protocol layer**. ISO 10218-1:2025 (industrial robot safety), ISO/TS 15066 (collaborative robots), and IEC 62443 (industrial cybersecurity) collectively govern how robots are built, deployed, and secured — but none of them specify how AI-generated commands should be attributed, audited, or bounded.

The EU AI Act (Art. 12, 13, 14) creates a new legal requirement for exactly these capabilities in high-risk AI systems — which includes robots in many deployment contexts. The August 2026 deadline for harmonized EU AI Act standards creates urgency.

Without standards engagement, RCAN risks being perceived as a niche open-source project. With it, RCAN becomes the reference architecture that answers the question: *"How do we add AI accountability to robots?"*

**The goal:** RCAN §6 (audit), §8 (safety invariants), §9 (HiTL gate), and §12 (RBAC) referenced as informative or normative material in an ISO/TC 299 Technical Report or Work Item, and harmonized as the basis for EU AI Act compliance in robotics.

---

## 2. ISO/TC 299 Structure

**ISO/TC 299** is the ISO technical committee for Robotics. Secretariat: **SIS (Swedish Standards Institute)**.

| Working Group | Scope | Key Output |
|---|---|---|
| **WG 2** | Service robot safety (domestic, professional) | ISO 13482 |
| **WG 3** | Industrial robot safety | ISO 10218-1:2025, ISO 10218-2 |
| **WG 7** | Vocabulary and characteristics | ISO 8373 |
| **JWG 5** | Medical robot safety (joint with ISO/TC 299) | ISO 21281 series |
| **SG 1** | Gaps and Structure | Identification of gaps in existing standards — **directly relevant to RCAN** |

### 2.1 SG 1: Gaps and Structure — The Primary Entry Point

SG 1 (Special Group 1: Gaps and Structure) is explicitly tasked with identifying gaps in existing robotics standards. Its mandate is to find what is NOT covered by current ISO/TC 299 standards and recommend new work items or Technical Reports.

**RCAN addresses a gap SG 1 exists to find.** This is the most direct formal entry point for RCAN into the ISO/TC 299 process.

---

## 3. Primary Contact: Roberta Nelson Shea

> **This is the single most important contact for RCAN standardization.**

**Roberta Nelson Shea**  
- Global Technical Compliance Officer, Universal Robots  
- Convenor, ISO/TC 299 **WG 3** (Industrial Robot Safety) — wrote ISO 10218-1:2025  
- Convenor, ISO/TC 299 **SG 1** (Gaps and Structure) — explicitly tasked with finding the gaps RCAN addresses  
- LinkedIn: [linkedin.com/in/robertanelsonshea](https://linkedin.com/in/robertanelsonshea)

She simultaneously chairs the working group that produced the most recent industrial robot safety standard AND runs the committee explicitly tasked to find gaps in that standard. RCAN is precisely the type of gap SG 1 is looking for.

**Recommended initial outreach:**  
LinkedIn DM, brief and technical. Lead with the gap, not the project:

> "Hi Roberta — I'm working on an open specification that adds AI decision accountability to robot protocols (audit chain, RBAC, HiTL gates). It fills a gap I don't see covered by ISO 10218-1 or 13482 for AI-generated commands. Given SG 1's mandate, I'd value 20 minutes to walk you through the technical approach. Published spec at rcan.dev — technical brief attached."

Attach: `docs/whitepaper/ai-accountability-layer-2026.md`

---

## 4. US Path: A3 / ANSI

**Carole Strait Franklin**  
- Director of Standards Development, **A3** (Association for Advancing Automation)  
- LinkedIn: [linkedin.com/in/carole-strait-franklin-64972b7](https://linkedin.com/in/carole-strait-franklin-64972b7)

A3 administers **ANSI/A3 R15.06-2025** (industrial robot safety, US version of ISO 10218) and holds ISO/TC 299 liaison status. A3 is the US national body pathway into ISO/TC 299.

**Why this matters for RCAN:**
- ANSI membership → access to ISO/TC 299 national body voting and observer seats
- A3 Technical Committee presentation → visibility with US robot safety practitioners
- **Automate conference** (A3's flagship annual event) → talk proposals for practitioner audiences

**Recommended outreach:**
1. LinkedIn connection + brief introduction to RCAN
2. Request: A3 Technical Committee presentation slot (30–45 min) — "AI Decision Accountability at the Protocol Layer"
3. Submit talk proposal to **Automate 2026 or 2027** conference

---

## 5. EU Path: CEN/CENELEC JTC 21

**Contact:** namirifar@cencenelec.eu  
**Subject:** JTC 21 liaison inquiry — RCAN AI accountability specification for robotics

CEN/CENELEC Joint Technical Committee 21 (JTC 21) is developing harmonized standards under the EU AI Act. Organizations with relevant technical specifications can apply for **liaison status**, enabling them to contribute technical content to the standards development process.

**Why RCAN qualifies:**  
RCAN §16 (EU AI Act compliance mappings) maps directly to:
- **Art. 12** — Record-keeping requirements → RCAN §6 audit chain
- **Art. 13** — Transparency and provision of information → RCAN §5 identity + capability manifest
- **Art. 14** — Human oversight → RCAN §9 HiTL gate + PENDING_AUTH mechanism

The **August 2026 deadline** for harmonized EU AI Act standards creates urgency. JTC 21 is actively developing standards now; waiting until 2027 means missing the harmonization window.

**Attachments for outreach email:**
- `docs/compliance/eu-ai-act-mapping.md` (article-by-article mapping)
- `docs/whitepaper/ai-accountability-layer-2026.md` (technical brief)

---

## 6. Engagement Timeline

### 6.1 Immediate (0–3 months)

- [ ] **LinkedIn DM to Roberta Nelson Shea** — link rcan.dev + attach whitepaper PDF
- [ ] **LinkedIn DM to Carole Strait Franklin** — introduce RCAN, request A3 TC presentation
- [ ] **Email to namirifar@cencenelec.eu** — JTC 21 liaison inquiry with attachments
- [ ] **Submit Automate 2026/2027 talk proposal**: "AI Decision Accountability at the Protocol Layer" — abstract due dates vary, check A3 conference site
- [ ] **Publish** `docs/whitepaper/ai-accountability-layer-2026.md` at rcan.dev/whitepaper (PDF + web)

### 6.2 Near-term (3–12 months)

- [ ] **ISO/TC 299 liaison status** — apply via ANSI (requires A3 membership or direct ANSI organizational membership). Budget: ~$1,500–3,000/year for ANSI SMB membership.
- [ ] **WG 3 or SG 1 observer status** — request via Roberta Nelson Shea or ANSI contact. Observers receive meeting documents and can attend without voting.
- [ ] **Submit RCAN as informative reference** — if any ISO/TC 299 Technical Report is in draft, request inclusion of rcan.dev/spec as an informative reference for AI accountability approaches.
- [ ] **A3 Technical Committee presentation** — 30–45 min slot to present RCAN to US robot safety community.

### 6.3 Medium-term (12–36 months)

- [ ] **ISO Publicly Available Specification (PAS)** — submit RCAN spec as ISO PAS. Requirements:
  - Mature, published specification ✅ (v1.2 at rcan.dev/spec)
  - Reference implementation ✅ (OpenCastor, 4,665+ tests)
  - Documented industry need ✅ (EU AI Act timeline, deployment case studies)
  - National body sponsor — **required**, pursue via ANSI/A3 relationship
- [ ] **Propose new Work Item** — once observer/liaison status established, propose a Work Item in WG 3 or new WG focused on AI accountability requirements for robots.
- [ ] **RCAN OPC UA namespace registration** — submit `https://rcan.dev/opcua/v1` to OPC Foundation namespace registry. Link to ISO/TC 299 engagement as evidence of standards alignment.

### 6.4 Long-term (3–5 years)

- [ ] **Full ISO standard** — conversion of RCAN PAS (or informative Technical Report) to normative ISO standard. Requires:
  - National body sponsorship (ANSI/A3 path)
  - Sustained WG participation (voting member status)
  - Ballot passage across ISO member bodies
  - This timeline is realistic given the EU AI Act urgency creating political will

---

## 7. Credibility Assets (Current)

These exist today and can be cited immediately in any standards engagement:

| Asset | Location | Relevance |
|---|---|---|
| Published specification v1.2 | [rcan.dev/spec](https://rcan.dev/spec) | Versioned, citable technical specification |
| Reference implementation | [github.com/craigm26/OpenCastor](https://github.com/craigm26/OpenCastor) | 4,665+ tests, deployed on real hardware |
| Compliance documentation | [github.com/continuonai/rcan-spec/docs](https://github.com/continuonai/rcan-spec/tree/master/docs) | Conformance suite, robot profiles |
| Forensic audit chain | [github.com/craigm26/Quantum-link-Sim](https://github.com/craigm26/Quantum-link-Sim) | §6 audit implementation |
| Technical whitepaper | `docs/whitepaper/ai-accountability-layer-2026.md` | Committee-audience brief |
| ISO 10218 alignment | `docs/compliance/iso-10218-alignment.md` | Clause-by-clause mapping to WG 3 output |
| EU AI Act mapping | `docs/compliance/eu-ai-act-mapping.md` | Article-by-article mapping (Art. 12, 13, 14) |
| Conformance test suite | `scripts/conformance/` | L1/L2/L3 test suite with live checker |
| Robot profiles | `profiles/` | 6 profiles: UR, KUKA, Franka, Spot, generic, custom |
| OPC UA bridge spec | `docs/bridges/opcua-bridge.md` | Standards-adjacent technical depth |
| ROS2 bridge spec | `docs/bridges/ros2-bridge.md` | Ecosystem integration documentation |

**What's missing (to be completed):**

- [ ] PDF version of whitepaper for email attachments
- [ ] Case study: deployment on real hardware with audit chain in production
- [ ] Industry co-signatories (one or two robot manufacturers or integrators willing to say "we evaluated RCAN")
- [ ] ANSI membership (required for ISO/TC 299 voting participation)

---

## 8. Messaging Guidance

### For ISO/TC 299 (WG 3, SG 1)

Lead with the **gap**, not the project:

> "ISO 10218-1:2025 defines how robots must behave safely. It does not specify how AI-generated commands must be attributed, audited, or bounded at the protocol level. As AI agents increasingly operate robots, this gap creates accountability uncertainty. RCAN provides a concrete specification for this layer."

Cite: `docs/compliance/iso-10218-alignment.md` to show clause-by-clause awareness of ISO 10218.

### For EU/CEN-CENELEC (JTC 21)

Lead with the **regulatory deadline**:

> "RCAN §6 and §9 provide a concrete technical specification for EU AI Act Art. 12, 13, and 14 requirements for robots. With harmonized standards needed by August 2026, RCAN offers a reference architecture that is already implemented and tested."

Cite: `docs/compliance/eu-ai-act-mapping.md`

### For US (A3 / Automate)

Lead with **industry adoption friction**:

> "As AI agents begin commanding robots on factory floors, integrators face a question with no current standard answer: how do you prove the robot was authorized to take that action, which AI model authorized it, and what the confidence level was? RCAN answers this question with a protocol-level specification that works alongside OPC UA and ROS2."

---

## 9. Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Standards bodies move slowly; RCAN reaches adoption before standardization | High | Standards engagement supplements adoption, doesn't gate it. Adoption makes the standards case stronger. |
| Larger organizations submit competing proposals | Medium | Submit RCAN as open specification with permissive licensing. Compete on technical merit and reference implementation depth. |
| EU AI Act harmonization proceeds without robotics input | Low | JTC 21 outreach and A3 liaison engagement address this. August 2026 deadline creates urgency for JTC 21 to engage domain experts. |
| WG 3 views AI accountability as out of scope | Low | SG 1's explicit mandate is to find gaps. The EU AI Act creates regulatory pressure that makes WG 3 expansion of scope likely. |

---

## 10. Tracking

Engagement activity is tracked via GitHub issues in this repo. Tag with label `engagement` and `standards`.

| Contact | Status | Next Action |
|---|---|---|
| Roberta Nelson Shea (ISO/TC 299 WG3/SG1) | Not contacted | LinkedIn DM with whitepaper |
| Carole Strait Franklin (A3/ANSI) | Not contacted | LinkedIn DM, request TC presentation |
| CEN/CENELEC JTC 21 | Not contacted | Email namirifar@cencenelec.eu |
| Automate 2026/2027 | Not submitted | Check A3 site for CFP deadline |
| ANSI membership | Not applied | Evaluate SMB tier (~$1,500/yr) |
| OPC Foundation namespace | Not submitted | After bridge spec is finalized |

---

*See also:* [`docs/bridges/opcua-bridge.md`](../bridges/opcua-bridge.md) | [`docs/bridges/ros2-bridge.md`](../bridges/ros2-bridge.md) | [`docs/compliance/iso-10218-alignment.md`](../compliance/iso-10218-alignment.md) | [`docs/compliance/eu-ai-act-mapping.md`](../compliance/eu-ai-act-mapping.md) | [`docs/whitepaper/ai-accountability-layer-2026.md`](../whitepaper/ai-accountability-layer-2026.md)
