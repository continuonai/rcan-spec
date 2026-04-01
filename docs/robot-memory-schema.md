# Robot Memory Schema — Operational Memory Standard for RCAN Robots

**Status:** Draft  
**Version:** 1.0.0-draft  
**Related:** RCAN Spec §4 (Robot Identity), §6 (Agent Harness), §7 (Telemetry)  
**Issue:** continuonai/rcan-spec#191

---

## 1. Purpose

RCAN robot identities carry static configuration — RRN, cryptographic profile, capability declarations. They do not carry *operational memory*: what the robot has learned about itself and its environment during deployment.

The `robot-memory.md` schema fills this gap. It defines a structured, auto-maintained record of operational observations distilled from telemetry, error logs, and nightly analysis sessions. This record is injected into the robot's brain at session start, giving the agent context it could not have from code alone.

## 2. Scope

This document defines:

- The canonical YAML schema for `robot-memory.md` files
- Entry lifecycle (creation, reinforcement, confidence decay, pruning)
- Context injection rules
- Multi-robot federation semantics
- EU AI Act auditability considerations

Implementations are not required to use this schema to be RCAN-conformant. Conformant implementations that use operational memory **SHOULD** use this schema.

## 3. Schema Definition

### 3.1 File Location

The default path is `~/.opencastor/robot-memory.md`. Operators may configure an alternative path via `CASTOR_ROBOT_MEMORY_FILE`.

### 3.2 Format

The file is a Markdown document with a YAML front-matter block:

```markdown
---
schema_version: "1.0"
rrn: RRN-000000000001
last_updated: 2026-04-01T02:00:00Z

entries:
  - id: mem-a3f9c1d2
    type: hardware_observation
    text: "Left wheel encoder intermittent under sustained load — prefer speeds ≤0.3m/s"
    confidence: 0.92
    first_seen: 2026-03-28T14:00:00Z
    last_reinforced: 2026-04-01T02:00:00Z
    observation_count: 14
    tags: [wheel, encoder, navigation]
---
```

### 3.3 Top-Level Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `schema_version` | string | yes | Schema version: `"1.0"` |
| `rrn` | string | yes | Robot Resource Name (RCAN §4.1) |
| `last_updated` | ISO-8601 datetime | yes | UTC timestamp of last write |
| `entries` | array | yes | List of MemoryEntry objects |

### 3.4 MemoryEntry Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Stable identifier (e.g. `mem-{sha256[:8]}`) |
| `type` | EntryType | yes | See §3.5 |
| `text` | string | yes | Human-readable observation (max 500 chars) |
| `confidence` | float [0.0–1.0] | yes | Current confidence score |
| `first_seen` | ISO-8601 datetime | yes | When this observation was first recorded |
| `last_reinforced` | ISO-8601 datetime | yes | Last time new evidence matched this entry |
| `observation_count` | integer ≥1 | yes | How many times this observation has been confirmed |
| `tags` | string array | no | Free-form labels for filtering |

### 3.5 Entry Types

| Value | Description |
|---|---|
| `hardware_observation` | Physical robot degradation, calibration drift, sensor anomalies |
| `environment_note` | Spatial observations: unmapped obstacles, lighting conditions, floor types |
| `behavior_pattern` | Learned behavior adjustments: speed limits, preferred routes, interaction patterns |
| `resolved` | Previously noted issues now cleared — kept for audit trail, excluded from context injection |

## 4. Entry Lifecycle

### 4.1 Creation

Entries are created by the nightly analysis loop (autoDream or equivalent). Each entry requires at minimum: `id`, `type`, `text`, `confidence ≥ 0.1`, `first_seen`, `last_reinforced`, `observation_count: 1`.

Entry IDs SHOULD be stable across updates. The reference implementation uses `sha256(type + ":" + text)[:8]` prefixed with `mem-`.

### 4.2 Reinforcement

When subsequent evidence matches an existing entry:

```
new_confidence = min(1.0, old_confidence + 0.10)
observation_count += 1
last_reinforced = now()
```

The nudge factor (0.10) is a default; implementations MAY configure it.

### 4.3 Confidence Decay

Entries that are not reinforced by new evidence decay over time:

```
days_elapsed = (now - last_reinforced) / 86400
new_confidence = max(0.0, old_confidence - DECAY_RATE * days_elapsed)
```

**Default `DECAY_RATE`:** 0.05 per day (full decay from 1.0 in 20 days).

Decay is applied at read time, not write time. The file stores the last-known confidence; decay is computed on load.

### 4.4 Context Injection Threshold

Entries are eligible for brain context injection if:

```
confidence >= CONFIDENCE_INJECT_MIN (default: 0.30)
AND type != "resolved"
```

Eligible entries are sorted by confidence descending. Implementations SHOULD limit the injected set to the top N entries by token budget.

### 4.5 Pruning

Entries with `confidence < CONFIDENCE_PRUNE_MIN (default: 0.10)` are removed from the file on the next write cycle. Pruning is irreversible; implementations MAY archive pruned entries to a separate file before removal.

## 5. Context Injection Format

When injecting into a brain session, implementations SHOULD format entries as:

```
🔴 [92%] Left wheel encoder intermittent under load — prefer ≤0.3m/s
🟡 [65%] Kitchen doorway has 3cm lip — navigate at ≤0.1m/s
🟢 [35%] Right camera auto-focus inconsistent in low light
```

Confidence emoji bands:
- 🔴 confidence ≥ 0.80 — high confidence, recent evidence
- 🟡 0.50 ≤ confidence < 0.80 — medium confidence
- 🟢 CONFIDENCE_INJECT_MIN ≤ confidence < 0.50 — lower confidence

The injected block MUST NOT be included in the cached (static) section of the system prompt. It is dynamic and changes each session.

## 6. Multi-Robot Federation

When two robots share operational context (e.g. Bob and Alex operating together), each robot's memory MAY include a `peer_context` block:

```yaml
peer_context:
  - rrn: RRN-000000000005
    last_synced: 2026-04-01T01:00:00Z
    entries:
      - id: mem-peer-b1c2
        type: environment_note
        text: "Alex reports east corridor blocked by construction barrier"
        confidence: 0.75
        tags: [navigation, peer]
```

Peer entries SHOULD be clearly labelled and injected separately from own-robot entries. A robot MUST NOT reinforce its own entries based solely on peer data.

## 7. EU AI Act Alignment

For high-risk AI systems (RCAN L2+, Annex III), `robot-memory.md` contributes to:

- **Article 13 (Transparency):** Structured operational history provides auditable evidence of observed behaviours
- **Article 17 (Quality Management):** Confidence scoring and decay demonstrate systematic monitoring of system degradation
- **Article 9 (Risk Management):** `hardware_observation` entries directly map to risk monitoring requirements

The file SHOULD be retained for the operational lifetime of the robot and included in technical documentation packages.

## 8. Implementation Notes

### 8.1 Write Safety

Implementations MUST use atomic writes (temp file + rename) to prevent corruption on power loss.

### 8.2 Schema Migration

Implementations encountering a file without `schema_version` SHOULD treat it as free-form text and migrate to structured format on next write.

### 8.3 Confidentiality

`robot-memory.md` MAY contain sensitive operational data. It SHOULD be treated with the same access controls as the robot's private key material.

## 9. Reference Implementation

The reference implementation is in `craigm26/OpenCastor`:

- `castor/brain/memory_schema.py` — schema, load/save, decay, filter, prune
- `castor/brain/robot_context.py` — context injection at brain session start
- `castor/brain/autodream.py` — nightly entry generation and reinforcement

---

*Proposed for inclusion in RCAN Spec §8 (Operational Memory Extension). Feedback welcome via rcan-spec issues.*
