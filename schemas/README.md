# RCAN JSON Schemas

Machine-verifiable [JSON Schema draft-07](https://json-schema.org/specification-links.html#draft-7) definitions for all RCAN message types, the RURI format, QuantumLink-Sim commitment records, and the `.rcan.yaml` configuration file.

---

## Schema Index

### Message Schemas (`schemas/messages/`)

| File | `message_type` | Name | Description |
|------|---------------|------|-------------|
| `command.json` | `1` | COMMAND | Instruct a robot to execute an action |
| `config.json` | `2` | CONFIG | Apply a partial config update (admin only) |
| `status.json` | `3` | STATUS | Robot publishes operational state + telemetry |
| `auth.json` | `4` | AUTH | Establish an authenticated session |
| `heartbeat.json` | `5` | HEARTBEAT | Liveness probe between robot and brain |
| `safety.json` | `6` | SAFETY | Highest-priority STOP / ESTOP / RESUME |
| `authorize.json` | `9` | AUTHORIZE | HiTL operator approves/rejects a pending action |
| `pending_auth.json` | `10` | PENDING_AUTH | HiTL gate notification for AI-generated command |

### Top-Level Schemas (`schemas/`)

| File | Description |
|------|-------------|
| `ruri.json` | Robot Uniform Resource Identifier (RURI) string schema |
| `commitment.json` | QuantumLink-Sim cryptographic commitment record |
| `rcan-config.json` | `.rcan.yaml` robot configuration file |
| `invoke-message.json` | §19 INVOKE message — request execution of a named skill/behavior |
| `invoke-result.json` | §19 INVOKE_RESULT message — robot response after skill execution |
| `joint-telemetry.json` | §20 Joint Telemetry object — single snapshot of joint sensor readings |

---

## RURI Format

```
rcan://REGISTRY/MANUFACTURER/MODEL/DEVICE-ID
```

Optional extensions:
```
rcan://REGISTRY:PORT/MANUFACTURER/MODEL/DEVICE-ID
rcan://REGISTRY/MANUFACTURER/MODEL/DEVICE-ID/capability-path
```

Examples:
- `rcan://rcan.dev/boston-dynamics/spot/bd-spot-001a2b3c`
- `rcan://local.rcan/generic/differential-drive/00000001`
- `rcan://registry.example.com:9000/universal-robots/ur10e/ur10e-0042-aabb`

---

## Validation — Python (`jsonschema`)

Install:
```bash
pip install jsonschema
```

### Validate a single message

```python
import json
import jsonschema
from pathlib import Path

SCHEMA_DIR = Path("schemas")

def load_schema(path: str) -> dict:
    with open(SCHEMA_DIR / path) as f:
        return json.load(f)

# Load schemas
command_schema = load_schema("messages/command.json")
ruri_schema    = load_schema("ruri.json")

# Build a resolver so $ref to ruri.json works
store = {
    "https://rcan.dev/schemas/ruri.json": ruri_schema,
}
resolver = jsonschema.RefResolver.from_schema(command_schema, store=store)

# Your message
message = {
    "message_type": 1,
    "ruri": "rcan://rcan.dev/boston-dynamics/spot/bd-spot-001a2b3c",
    "principal_id": "agent:openai:gpt-4o-mini",
    "role_level": 2,
    "scope": "control",
    "action": "nav_goal",
    "parameters": {"x": 3.5, "y": -1.2, "yaw_deg": 90},
    "timestamp_ms": 1741100000000,
    "message_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "priority": "NORMAL",
    "session_token": "tok_abc123xyz",
}

try:
    jsonschema.validate(message, command_schema, resolver=resolver)
    print("✅ Valid COMMAND message")
except jsonschema.ValidationError as e:
    print(f"❌ Invalid: {e.message}")
```

### Validate all schemas are parseable

```bash
for f in schemas/messages/*.json schemas/*.json; do
    python3 -c "import json; json.load(open('$f'))" \
        && echo "OK: $f" \
        || echo "FAIL: $f"
done
```

---

## Validation — Node.js (`ajv`)

Install:
```bash
npm install ajv
```

### Validate a single message

```js
const Ajv = require("ajv");
const fs  = require("fs");

const ajv = new Ajv({ strict: false });

// Load and add all schemas so $ref resolution works
const schemaFiles = [
  "schemas/ruri.json",
  "schemas/messages/command.json",
  "schemas/messages/config.json",
  "schemas/messages/status.json",
  "schemas/messages/auth.json",
  "schemas/messages/heartbeat.json",
  "schemas/messages/safety.json",
  "schemas/messages/authorize.json",
  "schemas/messages/pending_auth.json",
  "schemas/commitment.json",
  "schemas/rcan-config.json",
];

schemaFiles.forEach((file) => {
  const schema = JSON.parse(fs.readFileSync(file, "utf8"));
  ajv.addSchema(schema);
});

const commandSchema = JSON.parse(
  fs.readFileSync("schemas/messages/command.json", "utf8")
);

const message = {
  message_type: 1,
  ruri: "rcan://rcan.dev/boston-dynamics/spot/bd-spot-001a2b3c",
  principal_id: "agent:openai:gpt-4o-mini",
  role_level: 2,
  scope: "control",
  action: "nav_goal",
  parameters: { x: 3.5, y: -1.2, yaw_deg: 90 },
  timestamp_ms: 1741100000000,
  message_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  priority: "NORMAL",
  session_token: "tok_abc123xyz",
};

const validate = ajv.compile(commandSchema);
if (validate(message)) {
  console.log("✅ Valid COMMAND message");
} else {
  console.error("❌ Invalid:", validate.errors);
}
```

---

## Role Levels

| Level | Name | Permitted Scopes |
|-------|------|-----------------|
| `1` | Observer | `observe` |
| `2` | Operator | `observe`, `control` |
| `3` | Supervisor | `observe`, `control`, `configure` |
| `4` | Admin | `observe`, `control`, `configure`, `admin` |
| `5` | Safety-Override | all scopes including `safety` |

---

## Priority Levels (COMMAND)

| Value | Meaning |
|-------|---------|
| `NORMAL` | Standard queue ordering |
| `SAFETY` | Elevated — jumps ahead of NORMAL |
| `EMERGENCY` | Bypasses queue ordering entirely |

---

## Safety Events (SAFETY message)

| Event | Behaviour |
|-------|-----------|
| `STOP` | Controlled deceleration to rest |
| `ESTOP` | Immediate actuator cut — no deceleration ramp |
| `RESUME` | Clear a prior STOP/ESTOP; return to operational state |

---

## See Also

- [RCAN Spec](https://rcan.dev/spec) — Full protocol specification
- [Federation Protocol](https://rcan.dev/federation) — Multi-registry resolution
- [QuantumLink-Sim](https://rcan.dev/spec#quantum-link-sim) — Commitment layer
- [HiTL Gates §16](https://rcan.dev/spec#hitl) — Human-in-the-Loop authorisation
