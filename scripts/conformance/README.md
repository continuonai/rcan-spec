# RCAN Conformance Test Suite

Version: **1.2**  
Spec reference: [RCAN Specification](https://rcan.continuon.cloud/spec/)

A conforming RCAN implementation MUST pass all tests at the level it claims.  
Levels are cumulative: an **L3** implementation must also pass **L1** and **L2**.

---

## Conformance Levels

### L1 — Core

The baseline level every RCAN implementation must satisfy.

| Area | Requirement |
|------|-------------|
| **RURI format** | Every robot address must match `rcan://<registry>/<manufacturer>/<model>/<device-id>`. Registry is a valid hostname; manufacturer, model, and device-id are lowercase alphanumeric + hyphens; device-id ≥ 8 chars. |
| **mDNS discovery** | Local robots advertise via mDNS service type `_rcan._tcp`. The TXT record must include `ruri=`, `role=`, and `version=` keys. |
| **RBAC enforcement** | Roles: CREATOR > OWNER > LEASEE > USER > GUEST. A principal may only issue messages requiring a role ≤ their assigned role. GUEST cannot issue `COMMAND` messages with `control` scope. |
| **JSON schema validation** | All messages must validate against the canonical RCAN JSON schema before dispatch. |
| **§6 audit fields** | Every dispatched message generates an audit entry containing at minimum: `principal`, `ruri`, `timestamp_ms`, `message_id`, `event`, `outcome`. |

Test file: [`rcan-conformance-v1.2.json`](./rcan-conformance-v1.2.json) → `levels.L1`  
Live checker: [`check_l1.py`](./check_l1.py)

---

### L2 — Safety

Builds on L1. Covers the safety-critical behaviours defined in §14–§15 of the spec.

| Area | Requirement |
|------|-------------|
| **Safe-stop on network loss** | If the control connection drops or heartbeat times out, the robot MUST enter safe-stop. Any pending `COMMAND` with `estop_active=true` in the device state MUST be rejected. |
| **Prompt injection defense** | Any `COMMAND` whose payload (or derived AI prompt) contains injection patterns (e.g., "ignore previous instructions") MUST be blocked and logged as `COMMAND_REJECTED`. |
| **Audit chain integrity** | Audit log entries are chained via HMAC-SHA256. Tampering with any record (field mutation, insertion, deletion) MUST break verification of all subsequent records. |
| **§16.2 confidence gates** | If a confidence gate specifies `min_confidence` and the AI-generated command falls below it: `on_fail=block` → reject; `on_fail=escalate` → escalate to HiTL queue without dispatching. |

Test file: [`rcan-conformance-v1.2.json`](./rcan-conformance-v1.2.json) → `levels.L2`

---

### L3 — AI Accountability

Builds on L1 + L2. Covers §16 (AI Governance) of the spec.

| Area | Requirement |
|------|-------------|
| **§16.1 Model identity in audit** | Every AI-produced `COMMAND` must include `ai.provider`, `ai.model`, and `ai.confidence` in the audit entry. Absence of any field is a conformance failure. |
| **§16.3 HiTL gates** | Actions whose `action_type` appears in the `hitl_gates` config with `require_auth=true` MUST NOT be dispatched immediately. They enter the HiTL queue pending an `AUTHORIZE` message. |
| **§16.3 HiTL authorization** | An `AUTHORIZE` message from a principal with OWNER role (or above) allows dispatch. An `AUTHORIZE` from a GUEST principal MUST be rejected with `INSUFFICIENT_PRIVILEGES`. |
| **§16.4 Thought log scope** | `GET /api/thoughts/<id>` returns a thought record with `confidence`. The `reasoning` field MUST be absent unless the requesting principal holds the `config` scope. |
| **Offline chain verification** | An implementation MUST be able to export its audit log as JSONL and verify the HMAC chain offline using only the chain secret, with no network dependency. |

Test file: [`rcan-conformance-v1.2.json`](./rcan-conformance-v1.2.json) → `levels.L3`

---

## Running the Tests

### L1 live checker (against a running endpoint)

```bash
python3 scripts/conformance/check_l1.py --host 127.0.0.1 --port 8080
```

Options:

| Flag | Default | Description |
|------|---------|-------------|
| `--host` | `127.0.0.1` | RCAN endpoint host |
| `--port` | `8080` | RCAN endpoint port |
| `--token` | *(none)* | Bearer token for authenticated tests |
| `--verbose` | off | Print full request/response details |

### Using the JSON test cases

The `rcan-conformance-v1.2.json` file is a machine-readable test suite.  
Each test case includes `id`, `name`, `description`, `test_type`, `input`, and `expect` fields.

Implementors can drive their own test harness against this file:

```python
import json, requests

with open("scripts/conformance/rcan-conformance-v1.2.json") as f:
    suite = json.load(f)

for level, tests in suite["levels"].items():
    for t in tests:
        # run t["input"] against your implementation, compare to t["expect"]
        pass
```

---

## Conformance Badge

Once all tests pass, implementations may display the appropriate badge:

```
L1 CORE       ✅ RCAN Conformant v1.2
L2 SAFETY     ✅ RCAN Safety Conformant v1.2
L3 AI-ACCT    ✅ RCAN AI-Accountable v1.2
```

---

## File Index

| File | Purpose |
|------|---------|
| `README.md` | This file — level descriptions and usage |
| `rcan-conformance-v1.2.json` | Machine-readable test cases (15 minimum, L1+L2+L3) |
| `check_l1.py` | Live L1 checker script |

---

*Maintained by the continuonai/rcan-spec project.*
