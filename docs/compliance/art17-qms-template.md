# Article 17 — Quality Management System Template for RCAN-Based Robots

**Regulation:** EU AI Act (Regulation 2024/1689), Article 17  
**RCAN spec version:** 1.6  
**Document type:** QMS template  
**Status:** Normative guidance  
**Applies from:** 2 August 2026  

---

## Overview

Article 17 requires providers of high-risk AI systems to establish a quality management system (QMS) addressing the full lifecycle — from design through post-market monitoring. This template maps RCAN-specific controls to each required QMS element.

**Scope:** Applies to organizations placing RCAN-compliant robot AI systems on the EU market or putting them into service.

---

## QMS Element 1 — Strategy for Regulatory Compliance

**Article 17(1)(a)**

| QMS requirement | RCAN control | Implementation |
|---|---|---|
| Strategy for achieving compliance with applicable law | Conformance checker | `castor validate` produces 0-fail score |
| Roles and responsibilities | RCAN metadata | `metadata.operator`, `metadata.contact` fields |
| Regulatory change monitoring | rcan-spec changelog | Subscribe to rcan-spec releases |

**Template text:**
```
Regulatory compliance strategy:
  Owner:       [FILL: named compliance officer or team]
  Review cycle: Quarterly or on each new RCAN major version
  Tool:        castor validate --config <robot.rcan.yaml>
  Target score: ≥90/100 on RCAN conformance suite
  Escalation:  [FILL: process for non-conformance — e.g., freeze deployments until resolved]
```

---

## QMS Element 2 — Design and Development Procedures

**Article 17(1)(b)**

| Procedure | RCAN mechanism |
|---|---|
| Design review gates | PR required for changes to `.rcan.yaml`, `safety.py`, `auth.py` |
| Model card documentation | `agent.model`, `agent.provider` in config |
| Test coverage requirement | `castor test` suite; target ≥90% coverage on safety paths |
| Configuration control | Git-versioned `.rcan.yaml`; `metadata.version` field |

**Minimum development checklist per release:**
- [ ] RCAN conformance score ≥80/100 (`castor validate`)
- [ ] All safety invariants pass (`castor test --safety`)
- [ ] No changes to `_FORBIDDEN_KEYS` (safety, auth, p66, estop) without design review
- [ ] `CHANGELOG.md` updated with safety-relevant changes
- [ ] Version bumped in `pyproject.toml` and `metadata.version`

---

## QMS Element 3 — Systematic Post-Market Monitoring

**Article 17(1)(f) + Article 72**

RCAN provides trajectory logging as the technical basis for post-market monitoring.

**Required monitoring fields in `.rcan.yaml`:**
```yaml
audit_log:
  enabled: true
  retention_days: 90     # minimum; adjust to legal requirement
  path: ~/.castor/audit.log

# Trajectory logging (OpenCastor reference implementation)
# Captures: skill_triggered, was_compacted, iterations, p66_blocked, p66_estop, error
```

**Monitoring KPIs to track:**
| KPI | Source | Target |
|---|---|---|
| ESTOP rate | `trajectories.p66_estop` | <0.5% of sessions |
| P66 block rate | `trajectories.p66_blocked` | <2% of sessions |
| Error rate | `trajectories.error IS NOT NULL` | <5% of sessions |
| Average iterations | `trajectories.iterations` | <5 per session |
| Model confidence | `trajectories.drift_score` | >0.6 average |

**Review cadence:**
- Weekly: automated anomaly detection (opencastor-autoresearch Track F)
- Monthly: operator review of KPI trends
- Quarterly: safety team review; update risk assessment if KPIs worsen

---

## QMS Element 4 — Documentation and Record-Keeping

**Article 17(1)(e) + Article 18**

| Document | Location | Retention |
|---|---|---|
| RCAN config file | `config/<robot>.rcan.yaml` (git) | Product lifetime |
| Conformance report | `castor validate --json` output | Each release |
| Test results | CI artifacts | 5 years minimum |
| Incident reports | `docs/incidents/YYYY-MM-DD-*.md` | 10 years |
| Risk assessment | `docs/risk-assessment.md` (see Art. 9 template) | Product lifetime |
| Training data provenance | `docs/training-provenance.md` | Product lifetime |

**Minimum technical file for EU AI Act Article 18:**
```
technical-file/
  system-description.md       — architecture, intended use, capabilities
  risk-assessment.md          — ISO 12100 aligned (see art9-risk-assessment-template.md)
  conformance-report.json     — output of castor validate --json
  test-report.md              — test coverage, safety test results
  instructions-for-use.md     — operator manual, maintenance
  art13-transparency.md       — filled Art. 13 transparency template
```

---

## QMS Element 5 — Incident Reporting

**Article 17(1)(g) + Article 73**

Serious incidents and near-misses must be reported to the national market surveillance authority within 15 days.

**Incident classification:**
| Severity | Criteria | Response time |
|---|---|---|
| Critical | Physical injury, property damage, ESTOP triggered by failure | 24h internal; 15d regulatory |
| High | Unexpected autonomous behavior in human-proximate environment | 72h internal |
| Medium | Safety threshold breach without physical consequence | 7d internal |
| Low | Anomalous model output, no physical consequence | Monthly review |

**RCAN incident template:** Create `docs/incidents/YYYY-MM-DD-<short-title>.md` with:
- Date/time, RRN, software version
- Trajectory DB entry (session_id from `trajectories.db`)
- Sequence of events
- P66 status (was ESTOP triggered? Was consent obtained?)
- Root cause
- Corrective action + timeline
- Regulatory notification status

---

## QMS Element 6 — Supplier Management

**Article 17(1)(c)**

| Supplier | RCAN relevance | Control |
|---|---|---|
| LLM provider (Anthropic, Google, etc.) | `agent.provider` | Pin model version; review provider security bulletins |
| Hardware supplier (motor, sensor) | `drivers[].protocol` | Require safety datasheet; verify CE/UL markings |
| Cloud infrastructure | `rcan_protocol.endpoints` | SOC 2 / ISO 27001 attestation |
| RCAN spec itself | `rcan_version` | Track rcan-spec changelog; update on security fixes |

---

## QMS Readiness Checklist

Before August 2026:

- [ ] QMS owner designated with documented authority
- [ ] Design review procedure documented and followed for last 3 releases
- [ ] Trajectory logging enabled and retention policy set
- [ ] Monthly KPI review process established
- [ ] Technical file directory created and populated
- [ ] Incident reporting process documented and tested (tabletop exercise)
- [ ] Supplier list current with security review dates
- [ ] RCAN conformance score ≥80/100
