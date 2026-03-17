# RCAN Protocol Compliance Statement Template

**Document type:** RCAN compliance statement (per-deployment)  
**RCAN spec version:** 1.6  
**Status:** Normative template  

---

## Purpose

This one-page statement summarises a robot deployment's compliance with the RCAN protocol specification. It is intended to be:
- Attached to the EU AI Act technical file
- Published alongside the robot's public profile (if opted in)
- Generated automatically by `castor validate --statement`

Fill in the `[FILL]` sections. The conformance score and check results come directly from `castor validate --json`.

---

## RCAN Compliance Statement

```
RCAN PROTOCOL COMPLIANCE STATEMENT
===================================

Robot:          [FILL: robot name]
RRN:            [FILL: e.g., RRN-000000000001]
Config file:    [FILL: e.g., config/arm.rcan.yaml]
RCAN version:   [FILL: e.g., 1.6]
Runtime:        [FILL: e.g., OpenCastor v2026.3.x]
Date:           [FILL: YYYY-MM-DD]
Operator:       [FILL: name / organization]

CONFORMANCE SCORE
-----------------
Overall score:  [FILL]/100
Checks passed:  [FILL]
Warnings:       [FILL]
Failures:       [FILL]

SAFETY CONTROLS
---------------
P66 enabled:                  [FILL: YES / NO]
ESTOP invariant:              [FILL: YES — SAFETY messages bypass consent]
Local safety wins:            [FILL: YES / NO]
Watchdog configured:          [FILL: YES (Xs timeout) / NO]
Confidence gate:              [FILL: YES (0.X threshold) / NO]
Emergency stop distance:      [FILL: Xm / NOT CONFIGURED]

AUTONOMY AND CONSENT
--------------------
Level of Autonomy:            [FILL: LoA 0 / 1 / 2 / 3]
Consent required above scope: [FILL: e.g., control]
R2RAM scopes declared:        [FILL: YES / NO]
Replay protection:            [FILL: YES / NO]

DATA AND PRIVACY
----------------
Audit logging:                [FILL: YES (Xd retention) / NO]
Thought log:                  [FILL: ENABLED / DISABLED]
Trajectory logging:           [FILL: YES / NO]
Public profile:               [FILL: YES — opencastor.com/robot/:rrn / NO]
Cloud transmission:           [FILL: describe or NONE]

SECURITY
--------
Authentication:               [FILL: e.g., Firebase Auth UID]
Transport encryption:         [FILL: TLS 1.3 / unencrypted]
Security review date:         [FILL: YYYY-MM-DD or NOT REVIEWED]

EU AI ACT STATUS
----------------
Classification:               [FILL: High-risk (Annex III) / Not classified]
Risk assessment:              [FILL: COMPLETE (YYYY-MM-DD) / PENDING]
Conformity assessment:        [FILL: COMPLETE (Annex VI) / PENDING]
Art. 13 transparency:         [FILL: COMPLETE / PENDING]
Art. 17 QMS:                  [FILL: COMPLETE / PENDING]
August 2026 deadline:         [FILL: ON TRACK / AT RISK]

DECLARATION
-----------
The operator named above declares that this robot deployment conforms to
the RCAN Protocol Specification v[FILL] as verified by castor validate.

Signature: ________________  Date: ____________
```

---

## Generating the Statement Automatically

Future: `castor validate --statement` will output a pre-filled version of this template using data from your RCAN config and the conformance run.

Until then, run `castor validate --json` and map fields manually:

```bash
castor validate --config config/arm.rcan.yaml --json > conformance.json
# Then fill [FILL] sections from conformance.json output
```

---

## Where to File This Document

| Context | Location |
|---|---|
| EU AI Act technical file | `docs/compliance/rcan-compliance-statement-<robot>.md` |
| Public profile (if opted in) | Linked from `opencastor.com/robot/:rrn` |
| Internal audit | Version-controlled in main repo alongside RCAN config |
| Regulator submission | PDF export of filled template |
