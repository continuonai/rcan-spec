# Robot Registry Foundation — Draft Founding Charter

> **Status: DRAFT** · Last revised: 2026-03-04
> Seeking co-founders, endorsing organizations, and stakeholder input.
> → Discuss on [GitHub issue #13](https://github.com/continuonai/rcan-spec/issues/13)

---

## Mission

The **Robot Registry Foundation (RRF)** shall operate the root RCAN robot registry as **neutral, independent, public infrastructure** — analogous to IANA/ICANN for the internet's domain name system, or the Linux Foundation for open-source governance.

The RRF will:

- Maintain the authoritative root registry of Robot Registration Numbers (RRNs) and registered robot identities under the RCAN protocol.
- Operate that registry in a vendor-neutral, financially transparent, and publicly accountable manner.
- Serve as the **registry of last resort**, ensuring continuity of robot identity infrastructure regardless of any single organization's commercial fate.
- Steward the RCAN specification in alignment with the broader RCAN community.

---

## The Problem

Robot identity infrastructure today has no independent authority. This creates systemic risks:

1. **Manufacturer-controlled registries.** Each manufacturer operates its own robot registry under its own terms. There is no shared namespace, no interoperability guarantee, and no recourse if a manufacturer changes its policies or exits the market. When a manufacturer's registry disappears, the identity records of deployed robots disappear with it.

2. **No dispute resolution.** If two organizations claim the same Robot Registration Number prefix, or if a manufacturer's identity is impersonated in a third-party registry, there is currently no neutral body to adjudicate the conflict. Legal action in national courts — slow, expensive, and jurisdictionally fragmented — is the only recourse.

3. **No registry of last resort.** There is no entity whose explicit mandate is to preserve the root registry and ensure that deployed robots can always resolve their identity. Infrastructure that depends on any single commercial entity's survival is fragile by design.

4. **Regulatory vacuum.** Emerging frameworks (EU AI Act, ISO/TC 299 standards) increasingly require traceable robot identity for compliance. Without a neutral registration body, regulators cannot point implementors to a trustworthy, independent authority.

---

## Governance Principles

The RRF shall be governed according to the following principles:

1. **Multi-stakeholder representation.** No single sector — industry, government, academia, or civil society — shall dominate governance. The board and committees shall structurally represent all affected communities.

2. **No single-entity control.** No corporation, government body, or individual shall hold a majority of board seats, veto power over technical decisions, or unilateral control over registry data or software.

3. **Open membership.** Membership shall be open to any organization or individual committed to the RRF's mission. Membership tiers shall reflect contribution levels, not gatekeeping.

4. **Transparent decision-making.** Board deliberations, votes, financial statements, and policy changes shall be published publicly. Major decisions shall include a public comment period of not less than 30 days.

5. **Open source software requirement.** All software used to operate the root registry shall be released under an OSI-approved open source license. This ensures that the community can fork and continue operations if the RRF itself fails.

---

## Board Composition (Proposed)

The founding board shall consist of **10 voting seats** plus non-voting observers:

| Seat(s) | Constituency | Selection |
|---------|-------------|-----------|
| 2 seats | Robot manufacturers | Elected by manufacturer member organizations; rotating 2-year terms; no single manufacturer may hold both seats simultaneously |
| 2 seats | Safety standards bodies | Designated by ISO/TC 299 (1 seat) and A3 — Association for Advancing Automation (1 seat) |
| 2 seats | Academic / research institutions | Elected by academic member organizations |
| 1 seat | Civil society | Elected by contributor-tier members |
| 3 seats | Foundation general | Elected at large by all member classes combined |
| — | Government observers | Non-voting; open to national standards bodies and regulatory agencies (e.g., NIST, EU Commission, BSI) |

Board members serve 2-year staggered terms. No individual may serve more than three consecutive terms.

A simple majority (6/10) is required for operational decisions. A supermajority (8/10) is required for amendments to this charter, changes to registry policies, or dissolution of the Foundation.

---

## Membership Tiers

### Founding Members
Organizations that actively co-create this charter prior to the Foundation's formal incorporation. Founding members:
- Receive a permanent seat in the founding board election.
- Are recognized by name in the Foundation's public record.
- Commit to a minimum 3-year financial contribution at the Supporting Member level.

### Supporting Members
Organizations that operate RCAN-compatible registries, deploy RCAN-identified robots, or otherwise depend on the root registry infrastructure. Supporting members:
- Pay annual dues (tiered by organization size; sliding scale available for non-profits and academic institutions).
- Elect the manufacturer and academic board seats.
- Receive advance notice of policy changes and priority access to technical working groups.

### Contributors
Individuals who contribute to the RCAN specification, registry software, documentation, or tooling. Contributors:
- Are recognized in the project's public contributor list.
- Elect the civil society board seat.
- No financial obligation; contribution is the membership criterion.

---

## Dispute Resolution

The RRF shall provide a structured dispute resolution process for the following categories of conflict:

- **RRN conflicts**: Two organizations claim the same Robot Registration Number prefix or overlapping namespace.
- **Manufacturer impersonation**: A registry entry falsely claims to represent a manufacturer's robots.
- **Registry abuse**: A registered operator violates RRF policies (e.g., issuing fraudulent identities, failing to maintain data accuracy).

### Three-Step Process

**Step 1 — Direct Negotiation (30 days)**
The RRF secretariat notifies both parties and requires good-faith direct negotiation. The RRF provides a neutral facilitator on request. Most conflicts are expected to resolve at this step.

**Step 2 — Mediation (60 days)**
If direct negotiation fails, either party may escalate to formal mediation conducted by a neutral third-party mediator selected from the RRF's approved panel. Mediation is confidential. Costs are shared equally unless the mediator determines one party acted in bad faith.

**Step 3 — Board Ruling (90 days)**
If mediation fails, the matter is referred to the full RRF board for a binding ruling. The board may: assign the contested namespace to one party, revoke a registration, impose a probationary period, or expel a member. Board rulings are published publicly (with personally identifiable information redacted where required by law).

Appeals of board rulings may be submitted to an independent arbitrator within 30 days of the ruling.

---

## Registry of Last Resort

The RRF's core operational guarantee is **continuity of the root registry**, independent of any single organization's survival, including the RRF itself.

### Operational Continuity Provisions

1. **Data escrow.** A full, cryptographically signed snapshot of the root registry database shall be deposited with at least two independent escrow agents (e.g., Software Heritage Foundation, Internet Archive, or a national library) on a weekly basis. The escrow format shall be an open, documented schema with no proprietary dependencies.

2. **Software escrow.** The complete registry software stack shall be escrowed alongside the data. Any organization shall be able to reconstruct and operate a functionally equivalent root registry from the escrowed materials.

3. **Succession plan.** The RRF charter shall name a successor organization (e.g., ISOC, Linux Foundation, or a designated academic consortium) that shall assume operations if the RRF dissolves without an alternative arrangement. The succession organization must publicly commit to the RRF's governance principles as a condition of succession.

4. **No data hostage.** Registry data shall never be used as collateral, transferred to a for-profit entity without member consent, or made subject to any license that would restrict the community's ability to migrate to a successor registry.

---

## Scope

The Robot Registry Foundation governs the following areas:

### 1. RRN Assignment
The RRF maintains the authoritative namespace of **Robot Registration Numbers (RRNs)**. It delegates namespace prefixes to Authoritative nodes (manufacturers, enterprises) and reserves the root namespace for robots without a dedicated organisational registry.

### 2. RCAN Specification Stewardship
The RRF stewards the RCAN protocol specification hosted at [github.com/continuonai/rcan-spec](https://github.com/continuonai/rcan-spec). This includes:
- Accepting and reviewing proposed specification changes via GitHub issues and pull requests.
- Maintaining the canonical spec version and changelog.
- Publishing normative conformance requirements for each spec version.
- Coordinating with external standards bodies (ISO/TC 299, IEC TC 62, NIST) to align RCAN with emerging international standards.

### 3. SDK Conformance
The RRF defines and maintains conformance criteria for RCAN SDKs. An SDK is **RCAN-conformant** if it:
- Correctly implements all normative wire types for its declared spec version.
- Passes the RCAN conformance test suite (Level 1 minimum).
- Publishes a conformance manifest (`p66-manifest.json` or equivalent) for the target robot platform.

### 4. Registry Governance
The RRF sets policies for federation, delegation, revocation, and dispute resolution between RCAN registries worldwide (see §Dispute Resolution and §Registry of Last Resort).

---

## Current Chair

During the bootstrapping phase (until formal incorporation and board election), **Craig Merry ([@craigm26](https://github.com/craigm26))** serves as founding chair. The chair has decision-making authority on:
- Spec changes that do not receive consensus within 21 days of open review.
- Namespace prefix assignments.
- Registry suspension or revocation.
- Emergency security patches to the spec.

The chair role transitions to the elected board upon formal Foundation incorporation.

---

## Contribution Process

RCAN is developed in the open. Anyone may propose changes to the specification, registry software, documentation, or tooling.

### Proposing a Spec Change

1. **Open a GitHub issue** at [continuonai/rcan-spec](https://github.com/continuonai/rcan-spec/issues) describing the problem or proposal. Use the `spec-change` label for normative changes, `discussion` for exploratory ideas.
2. **Gather feedback** — a minimum 14-day open comment period applies to all normative changes. Breaking changes require 30 days.
3. **Open a pull request** with the proposed change. PRs must include: updated spec text, rationale, backward-compatibility analysis, and (for new message types) a wire format definition.
4. **Review** — the chair or a delegated reviewer approves or requests changes. Two approvals are required for normative changes.
5. **Merge** — once approved, the PR is merged and the change is included in the next spec release.

### Contribution Types

| Type | Issue label | Review period | Approvals needed |
|---|---|---|---|
| Editorial (typo, clarity) | `editorial` | 3 days | 1 |
| Non-normative (examples, notes) | `docs` | 7 days | 1 |
| Normative (wire format, behaviour) | `spec-change` | 14 days | 2 |
| Breaking change | `breaking` | 30 days | Chair + 1 |
| New MessageType | `spec-change` + `wire-format` | 21 days | Chair + 1 |

### Contributor Recognition
All contributors are listed in the repository's `CONTRIBUTORS.md`. Organisations that ship RCAN-conformant implementations are listed in the conformance registry.

---

## Conformance

### RCAN Conformance Levels

| Level | Requirement |
|---|---|
| **L1 — Basic** | Implements RCAN wire framing, HELLO/STATUS/COMMAND/DISCOVER message types, RRN registration, and RURI parsing. |
| **L2 — Auth** | Adds role-based access control, Ed25519 ownership keys, and authenticated registry operations. |
| **L3 — Federation** | Adds REGISTRY_REGISTER, REGISTRY_RESOLVE, federation proof verification, and sync protocol. |
| **L4 — Safety** | Adds ESTOP, hardware_safety field support, watchdog integration, and P66 conformance manifest. |

An implementation **MUST** declare its conformance level in its `rcan-config.json` or `p66-manifest.json`.

### P66 Conformance

**P66** is the RCAN safety conformance profile, named for the IP66 ingress protection standard. A P66-conformant robot must:
- Support ESTOP (MessageType 5) with ≤100ms guaranteed response time.
- Publish a `p66-manifest.json` at a stable URL, included in registry federation proofs.
- Declare `hardware_safety` capabilities in `rcan-config.json`.
- Pass the P66 conformance test suite.

P66 conformance is a prerequisite for robots deployed in environments with direct human interaction.

---

## Versioning Policy

| Artifact | Scheme | Example | Notes |
|---|---|---|---|
| RCAN specification | Semver (`MAJOR.MINOR`) | `1.4`, `2.0` | MAJOR bump = breaking wire changes; MINOR = additive |
| RCAN SDKs | Semver (`MAJOR.MINOR.PATCH`) | `1.4.2` | Tracks spec MAJOR.MINOR; PATCH for bug fixes |
| RCAN runtimes (rcan-pi, rcan-ros2) | CalVer (`YYYY.MM.PATCH`) | `2026.03.1` | Decoupled from spec; release when ready |
| rcan-spec repository | Git tags + GitHub releases | `v1.4.0` | Tag on merge of normative changes |

**Deprecation policy:** A message type or field marked `deprecated` in spec version N is removed no earlier than version N+2. Implementations MUST support deprecated fields for at least one major version cycle.

---

## IP Policy

| Asset | License |
|---|---|
| Specification text (`.md`, `.astro` spec pages) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Reference implementations, SDKs, tools | [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) |
| Conformance test suites | Apache 2.0 |
| Registry software | Apache 2.0 |
| Logos and visual identity | All rights reserved (contact maintainers for use) |

Contributors agree that their contributions to the specification text are licensed under CC BY 4.0, and their code contributions are licensed under Apache 2.0, by the act of submitting a pull request to the rcan-spec repository.

No contributor license agreement (CLA) is required beyond agreement to these license terms.

---

## External Standards Alignment

The RCAN specification is designed to align with and complement existing international standards. The RRF actively monitors and incorporates requirements from:

| Standard | Relevance to RCAN | Status |
|---|---|---|
| **ISO 10218-1/2** (Robot safety) | Physical safety requirements for industrial robots; informs P66 conformance and ESTOP timing requirements | Aligned in v1.4 |
| **ISO/TS 15066** (Collaborative robots) | Power and force limiting, speed/separation monitoring; informs hardware_safety field schema | Aligned in v1.4 |
| **EU AI Act (Regulation 2024/1689)** | Art. 13 transparency obligations; Art. 49 high-risk AI registration; informs transparency manifest spec | Tracked in #159; target v1.5 |
| **IEC 62443** (Industrial cybersecurity) | Security levels for industrial control systems; informs RCAN auth and registry security requirements | Partially aligned; full alignment target v1.6 |
| **NIST AI RMF** (AI Risk Management) | AI risk categorisation and documentation; informs P66 manifest and transparency disclosure fields | Tracked; target v1.5 |
| **ISO/TC 299** (Robotics terminology) | Common vocabulary for robot types and capabilities; informs RCAN robot type taxonomy | Ongoing alignment |
| **IEC 61508** (Functional safety) | SIL (Safety Integrity Level) classification; informs hardware_safety SIL attestation fields | Target v1.5 |

The RRF seeks formal liaison status with ISO/TC 299 and will apply for W3C liaison once formally incorporated.

---

## EU AI Act Relevance

The EU AI Act (Regulation 2024/1689) creates a direct use case for the Robot Registry Foundation.

### Article 49 — Registration of High-Risk AI Systems

Article 49 requires providers of high-risk AI systems to register those systems in the EU database before placing them on the market. Autonomous robots that fall under **Annex III, Category 3** (management and operation of critical infrastructure) or other categories involving physical interaction with persons are likely to qualify as high-risk AI systems.

The current EU database is EU-operated and EU-jurisdictional. This creates compliance complexity for manufacturers outside the EU and for multi-jurisdiction deployments. An independent, internationally governed body such as the RRF could serve as a **candidate supplementary registration body**, accepted by regulators across jurisdictions, reducing the compliance burden for global robot deployments.

### RCAN as Technical Identity Infrastructure

RCAN's Robot Registration Numbers (RRNs) and Robot Uniform Resource Identifiers (RURIs) provide the technical identity layer that registration frameworks require:
- A unique, persistent, globally resolvable identifier per robot.
- A structured namespace enabling rapid lookup by regulatory authorities.
- An audit chain linking physical robot to registered identity.

The RRF would provide the governance layer above this technical infrastructure — the trusted third party that regulators, insurers, and the public can rely on to maintain the integrity of the registry.

---

## Current Status

**This document is a DRAFT.** The Robot Registry Foundation does not yet exist as a legal entity.

We are currently:
- [ ] Identifying co-founders and endorsing organizations.
- [ ] Soliciting feedback on the governance model, board composition, and membership tiers.
- [ ] Mapping regulatory requirements across jurisdictions (EU, US, Japan, South Korea).
- [ ] Identifying potential escrow agents and successor organizations.
- [ ] Exploring incorporation options (US 501(c)(6), Swiss foundation, EU association).

No commitments have been made. This charter is an invitation to collaborate.

---

## How to Get Involved

| Role | What to do |
|------|-----------|
| **Co-founder** | Comment on [GitHub issue #13](https://github.com/continuonai/rcan-spec/issues/13) expressing intent to co-found; include your organization name and primary interest |
| **Endorsing organization** | Post a short statement of endorsement on issue #13; no financial commitment required at this stage |
| **Technical contributor** | Open a pull request against `docs/governance/` with proposed amendments |
| **Standards body representative** | Contact the RCAN maintainers directly via the repository to discuss formal liaison |
| **Interested observer** | ⭐ Star the [rcan-spec repository](https://github.com/continuonai/rcan-spec) and subscribe to issue #13 for updates |

We are particularly seeking input from:
- Robot manufacturers (large and small) currently implementing RCAN.
- National standards bodies and regulatory agencies.
- Academic robotics departments and research labs.
- Civil society organizations working on AI accountability and public safety.

---

*This charter was drafted by the RCAN specification maintainers as a starting point for community discussion. It does not represent a final legal document. Nothing herein creates any binding obligation on any party.*
