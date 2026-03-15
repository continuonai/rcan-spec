# EU AI Act Compliance Guide for RCAN Robots

**Deadline: August 2, 2026** (General Purpose AI provisions in force)

## Applicability

Robots using RCAN that incorporate LLM/AI capabilities fall under EU AI Act as:

- **High-risk AI systems** (Annex III, §3 — safety components of machinery)
- **General Purpose AI** (if using foundation models like Claude/GPT)

## Required Compliance Steps

### Article 13 — Transparency (MessageType 18)

Robots must be capable of disclosing:

- That they are an AI system
- Their operator identity
- Their capabilities and limitations
- Contact information for complaints

**Implementation:** Use RCAN MessageType.TRANSPARENCY (18) when:

- A robot enters a human-occupied space
- A human directly interacts with the robot
- Requested via voice command or button

```python
from rcan.safety import make_transparency_message

msg = make_transparency_message(
    source_ruri="rcan://rcan.dev/acme/arm/v1/unit-001",
    target_ruri="rcan://local/human-display",
    operator="Acme Robotics",
    capabilities=["navigation", "manipulation", "speech"],
    model_family="claude-sonnet",
    limitations=["cannot lift > 5 kg", "outdoor use only in dry conditions"],
    contact="safety@acme-robotics.example",
    p66_conformance_pct=87.5,
    audit_enabled=True,
)
```

### Article 17 — Quality Management System

Deployers must maintain:

- Risk assessment documentation (ISO 12100 recommended)
- Test and validation records
- Incident log
- Human oversight procedures

**RCAN Implementation:** audit trail from `GET /api/safety/manifest` + daily audit logs

### Article 9 — Risk Management

Apply ISO 12100 risk assessment process:

1. Hazard identification (robots in human spaces)
2. Risk estimation (likelihood × severity)
3. Risk reduction (Protocol 66 + RCAN safety invariants)
4. Residual risk documentation

## Timeline

- **March 2026**: MessageType 18 spec (this PR)
- **Q2 2026**: Reference implementation in OpenCastor
- **August 2, 2026**: Full compliance deadline
