# RCAN ↔ ROS2/DDS Bridge Specification

**Status:** Draft v1.0  
**Closes:** [Issue #3](https://github.com/continuonai/rcan-spec/issues/3)  
**Reference Implementation:** `castor/bridges/ros2_bridge.py`  
**ROS2 Distros Tested:** Humble (LTS), Iron, Jazzy

---

## 1. Overview

ROS2 (Robot Operating System 2) uses DDS (Data Distribution Service / RTPS) as its transport layer and is the dominant middleware in research robotics and increasingly in commercial systems. Despite its widespread adoption, ROS2 has **no access control model by default**, no AI accountability layer, and no globally unique robot identity. SROS2 adds partial security, but is widely considered incomplete and operationally complex.

The RCAN ↔ ROS2 bridge brings full RCAN governance to existing ROS2 robots **without modifying the ROS2 robot itself**. The bridge acts as the RCAN safety kernel at the network boundary: it validates all inbound commands against RCAN §12 RBAC and §8 safety invariants before relaying them as ROS2 messages, and it translates outbound ROS2 telemetry into RCAN STATUS broadcasts.

---

## 2. The Gap

| Feature | ROS2 / DDS | SROS2 | RCAN |
|---|---|---|---|
| **Access Control** | None — any node can publish to any topic | Partial — DDS Security plugin (DDS:Auth:Pkcs11 + DDS:Access:Permissions) | Full §12 RBAC: GUEST → CREATOR, per-action scope |
| **Robot Identity** | None — node names are local, not globally unique | None | RURI: globally unique `rcan://registry/mfr/model/id` |
| **AI Accountability** | None — no concept of AI-generated commands | None | §6 audit: ai_provider, ai_model, confidence, thought_id on every AI command |
| **Audit Trail** | None — no built-in logging of who commanded what | None | §6 append-only audit chain with SHA-256 linkage |
| **Network Loss Behavior** | Undefined — commands may queue indefinitely | Undefined | §8 invariants: robot halts or returns to safe state on loss |
| **HiTL Gate** | None | None | §9 PENDING_AUTH: commands above confidence threshold require human approval |
| **Specification** | Community standard, fragmented | Experimental | RCAN v1.2, versioned, published |

SROS2 improves DDS transport security but does not address identity, AI accountability, audit trails, or behavioral invariants. The RCAN bridge addresses all of these without requiring SROS2 adoption (though the two are compatible — see §9).

---

## 3. Architecture

The RCAN ↔ ROS2 bridge runs as a **ROS2 node** (`rcan_bridge_node`) within the robot's ROS2 environment. It is the sole point of RCAN governance enforcement — the underlying ROS2 stack does not need to know about RCAN.

```
┌──────────────────────────────────────────────────────────────────┐
│                     External Network                             │
│                                                                  │
│   RCAN Client           RCAN Registry          Human Operator    │
│   (AI agent, app)       (mDNS discovery)       (HiTL approve)   │
└──────────┬──────────────────────┬──────────────────┬────────────┘
           │ RCAN COMMAND         │ _rcan._tcp.local  │ POST /api/hitl/authorize
           ▼                      ▼                   ▼
┌──────────────────────────────────────────────────────────────────┐
│              RCAN ↔ ROS2 Bridge (rcan_bridge_node)               │
│                                                                  │
│  ┌─────────────────────┐    ┌──────────────────────────────────┐ │
│  │  RCAN Inbound       │    │  ROS2 Outbound                   │ │
│  │  • RBAC check §12   │    │  • Subscribe to ROS2 topics      │ │
│  │  • §8 invariants    │    │  • Translate to RCAN STATUS      │ │
│  │  • §9 HiTL gate     │    │  • Broadcast via mDNS            │ │
│  │  • §6 audit log     │    │                                  │ │
│  └────────┬────────────┘    └──────────────────────────────────┘ │
│           │                                                       │
│  ┌────────▼─────────────────────────────────────────────────┐    │
│  │  OpenCastor (§6 audit chain, §8 invariant enforcement)   │    │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
           │ ROS2 topics / actions / services
           ▼
┌──────────────────────────────────────────────────────────────────┐
│              ROS2 Robot (unmodified)                             │
│   /cmd_vel   /joint_trajectory_controller/...   /navigate_to_pose│
│   /joint_states   /odom   /diagnostics                          │
└──────────────────────────────────────────────────────────────────┘
```

### 3.1 Data Flows

#### Flow 1: RCAN-inbound → ROS2

1. RCAN client sends COMMAND message to bridge REST endpoint or RCAN socket
2. Bridge validates §12 RBAC scope for the authenticated role
3. Bridge evaluates §8 safety invariants (e-stop state, velocity limits, workspace bounds)
4. Bridge checks §9 HiTL gate — if PENDING_AUTH, suspends and fires notification; waits for AUTHORIZE
5. Bridge translates RCAN COMMAND to the appropriate ROS2 message type (see §4)
6. Bridge publishes/calls on the ROS2 topic/service/action
7. Bridge writes §6 audit entry with model identity fields if `thought_id` was provided
8. Bridge returns outcome + `audit_id` to RCAN client

#### Flow 2: ROS2-outbound → RCAN

1. Bridge subscribes to configured ROS2 topics at startup
2. On each message received, bridge translates to RCAN STATUS telemetry format
3. STATUS is broadcast via mDNS as `_rcan._tcp.local` and available via REST at `/api/status`
4. RCAN Registry discovery entries updated with latest telemetry timestamp

#### Flow 3: HiTL Gate (PENDING_AUTH)

1. Command arrives; §9 gate evaluates confidence score or action class as supervised
2. Bridge suspends command, creates a pending record with TTL (default: 5 minutes)
3. Bridge fires notification via configured channel (webhook, push, email)
4. Human operator calls `POST /api/hitl/authorize` (or `POST /api/hitl/deny`)
5. On AUTHORIZE: bridge replays command through §8 invariants, then forwards to ROS2
6. On DENY or timeout: bridge discards command, writes audit entry with outcome=`denied`

---

## 4. ROS2 Topic / Service / Action Mapping

| RCAN Message | ROS2 Equivalent | Translation Notes |
|---|---|---|
| `COMMAND {action: move, linear_x, linear_y, angular_z}` | `geometry_msgs/Twist` → `/cmd_vel` | linear.x, linear.y, angular.z mapped from RCAN params; velocity clamped to §8 limits |
| `COMMAND {action: arm_joint, joints: [...], positions: [...]}` | `trajectory_msgs/JointTrajectory` → `/joint_trajectory_controller/joint_trajectory` | joint names from robot profile; trajectory duration from `params.duration_s` |
| `COMMAND {action: navigate, x, y, yaw}` | `nav2_msgs/NavigateToPose` action → `/navigate_to_pose` | pose from RCAN params; frame_id from bridge config (default: `map`) |
| `COMMAND {action: stop}` | `geometry_msgs/Twist` → `/cmd_vel` (zero) + action cancel | publishes zero-velocity twist AND cancels any active nav2 goal |
| `COMMAND {action: estop}` | `std_msgs/Bool` → `/emergency_stop` | topic name configurable; §8 invariant: bridge also caches ESTOPPED state |
| `STATUS {state, battery, position, velocity}` | `sensor_msgs/JointState` ← `/joint_states` | joint names/positions/velocities → RCAN STATUS telemetry |
| `STATUS {position, velocity}` | `nav_msgs/Odometry` ← `/odom` | pose.position + twist → RCAN position/velocity fields |
| `STATUS {state: FAULT}` | `diagnostic_msgs/DiagnosticArray` ← `/diagnostics` | ERROR-level diagnostics → RCAN state=FAULT |
| `PENDING_AUTH` | `diagnostic_msgs/DiagnosticStatus` → `/diagnostics` + external notify | publishes diagnostic WARN + fires configured notification channel |
| `AUTHORIZE` | REST: `POST /api/hitl/authorize` | bridge exposes HTTP endpoint; RCAN clients or human operators POST here |

### 4.1 Velocity Limits (§8 Invariant Enforcement)

The bridge enforces velocity limits from the robot's RCAN profile before publishing to `/cmd_vel`:

```python
# Bridge clamps velocity to profile limits — cannot be overridden by RCAN client
twist.linear.x  = clamp(params.linear_x,  -profile.max_linear_vel,  profile.max_linear_vel)
twist.linear.y  = clamp(params.linear_y,  -profile.max_linear_vel,  profile.max_linear_vel)
twist.angular.z = clamp(params.angular_z, -profile.max_angular_vel, profile.max_angular_vel)
```

If the requested velocity exceeds the profile limit by more than 10%, the command is DENIED (not clamped) and an audit entry is written with `outcome=safety_violation`.

---

## 5. Configuration

The bridge is configured via the robot's `.rcan.yaml` (merged with the robot profile at startup):

```yaml
# .rcan.yaml — bridge section
bridge:
  type: ros2

  ros2:
    # ROS2 node identity
    namespace: /robot1
    node_name: rcan_bridge

    # Topic/action configuration
    cmd_vel_topic: /cmd_vel
    estop_topic: /emergency_stop
    joint_states_topic: /joint_states
    joint_trajectory_topic: /joint_trajectory_controller/joint_trajectory
    nav_action: /navigate_to_pose
    odom_topic: /odom
    diagnostics_topic: /diagnostics

    # Telemetry publishing rate
    telemetry_rate_hz: 10

    # Nav2 frame
    nav_frame_id: map

  # HiTL notification (used when PENDING_AUTH fires)
  hitl:
    notify_webhook: https://ops.example.com/rcan/hitl
    timeout_seconds: 300        # deny after 5 min with no response
    authorize_endpoint: /api/hitl/authorize  # bridge exposes this

  # REST API (for AUTHORIZE, status queries)
  api:
    host: 0.0.0.0
    port: 8765
    auth_token_env: RCAN_BRIDGE_TOKEN  # bearer token for REST API

  # RCAN safety constraints (override profile defaults)
  safety:
    max_linear_vel: 1.5        # m/s
    max_angular_vel: 1.0       # rad/s
    velocity_exceed_deny: true # deny (not clamp) if limit exceeded >10%
```

### 5.1 Multi-Robot Configuration

Each robot runs its own bridge instance with its own `.rcan.yaml`. For multi-robot deployments, a fleet-level registry collects STATUS telemetry from each bridge's mDNS advertisement.

---

## 6. Reference Implementation

### 6.1 Target

`castor/bridges/ros2_bridge.py` in the [OpenCastor](https://github.com/craigm26/OpenCastor) repository.

### 6.2 Dependencies

```
rclpy                    # ROS2 Python client library
geometry_msgs            # Twist
nav_msgs                 # Odometry
sensor_msgs              # JointState
trajectory_msgs          # JointTrajectory
diagnostic_msgs          # DiagnosticArray, DiagnosticStatus
nav2_msgs                # NavigateToPose action
action_msgs              # GoalStatusArray
std_msgs                 # Bool (estop)
castor                   # OpenCastor SDK (§6 audit, §8 invariants, §9 HiTL)
aiohttp                  # Async HTTP for REST API + webhook notifications
zeroconf                 # mDNS advertisement (_rcan._tcp.local)
```

### 6.3 Installation

The bridge requires a ROS2-enabled environment. Install alongside OpenCastor:

```bash
# Source ROS2 environment
source /opt/ros/humble/setup.bash

# Install bridge
pip install castor-sdk aiohttp zeroconf

# Run the bridge
python -m castor.bridges.ros2_bridge --config /etc/rcan/.rcan.yaml

# Or as a ROS2 launch file
ros2 launch castor rcan_bridge.launch.py config:=/etc/rcan/.rcan.yaml
```

### 6.4 Implementation Skeleton

```python
# castor/bridges/ros2_bridge.py (simplified)
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from nav_msgs.msg import Odometry
from sensor_msgs.msg import JointState
from nav2_msgs.action import NavigateToPose
from rclpy.action import ActionClient
from castor import OpenCastor, AuditEntry, RBACError, HiTLPending

class RCANBridgeNode(Node):
    def __init__(self, config):
        super().__init__('rcan_bridge', namespace=config.ros2.namespace)
        self.castor = OpenCastor(config)
        self.cfg = config

        # Publishers
        self.cmd_vel_pub = self.create_publisher(
            Twist, config.ros2.cmd_vel_topic, 10)

        # Subscribers → RCAN STATUS telemetry
        self.odom_sub = self.create_subscription(
            Odometry, config.ros2.odom_topic, self._on_odom, 10)
        self.joint_sub = self.create_subscription(
            JointState, config.ros2.joint_states_topic, self._on_joints, 10)

        # Action clients
        self.nav_client = ActionClient(
            self, NavigateToPose, config.ros2.nav_action)

    async def handle_rcan_command(self, cmd):
        """Entry point for all RCAN COMMAND messages."""
        # 1. RBAC check (§12)
        if not self.castor.rbac_check(cmd.role, cmd.action_type):
            return await self.castor.audit_deny(cmd, reason="rbac")

        # 2. §8 invariant check (estop state, velocity limits, workspace)
        violation = self.castor.check_invariants(cmd)
        if violation:
            return await self.castor.audit_deny(cmd, reason=violation)

        # 3. §9 HiTL gate
        if self.castor.hitl_gate_closed(cmd):
            await self.castor.request_hitl(cmd)
            return {"outcome": "pending_auth", "audit_id": cmd.pending_id}

        # 4. Translate and publish to ROS2
        outcome = await self._dispatch_to_ros2(cmd)

        # 5. §6 audit entry
        audit_id = await self.castor.audit(AuditEntry(
            action_type=cmd.action_type,
            role=cmd.role,
            outcome=outcome,
            ai_provider=cmd.ai_provider,
            ai_model=cmd.ai_model,
            confidence=cmd.confidence,
            thought_id=cmd.thought_id,
        ))
        return {"outcome": outcome, "audit_id": audit_id}

    async def _dispatch_to_ros2(self, cmd):
        if cmd.action_type == "move":
            twist = Twist()
            twist.linear.x  = self._clamp(cmd.params.linear_x,  self.cfg.safety.max_linear_vel)
            twist.linear.y  = self._clamp(cmd.params.linear_y,  self.cfg.safety.max_linear_vel)
            twist.angular.z = self._clamp(cmd.params.angular_z, self.cfg.safety.max_angular_vel)
            self.cmd_vel_pub.publish(twist)
            return "executed"
        elif cmd.action_type == "navigate":
            return await self._nav_to_pose(cmd.params)
        elif cmd.action_type == "stop":
            self.cmd_vel_pub.publish(Twist())  # zero velocity
            return "executed"
        else:
            return "unsupported_action"

    def _on_odom(self, msg):
        """Translate ROS2 Odometry → RCAN STATUS telemetry."""
        self.castor.update_status(
            position_x=msg.pose.pose.position.x,
            position_y=msg.pose.pose.position.y,
            position_z=msg.pose.pose.position.z,
            linear_velocity=msg.twist.twist.linear.x,
            angular_velocity=msg.twist.twist.angular.z,
        )

    def _clamp(self, value, limit):
        return max(-limit, min(limit, value))
```

---

## 7. mDNS Advertisement

The bridge advertises the robot via mDNS as `_rcan._tcp.local` so it is discoverable by RCAN registries and clients:

```
Service: _rcan._tcp.local
Name: {mfr}-{model}-{id}._rcan._tcp.local
TXT records:
  ruri=rcan://registry.local/{mfr}/{model}/{id}
  spec=1.2
  bridge=ros2
  distro=humble
  api=http://{host}:8765
  status_endpoint=http://{host}:8765/api/status
```

---

## 8. Audit Chain Integration

All RCAN COMMAND messages forwarded to ROS2 generate a §6-compliant audit entry in OpenCastor's append-only audit chain. The entry includes:

```json
{
  "audit_id": "sha256:a3f8...",
  "timestamp": "2026-03-03T18:00:00Z",
  "ruri": "rcan://registry.local/clearpath/husky/a200-001",
  "action_type": "move",
  "role": "OPERATOR",
  "outcome": "executed",
  "params": {"linear_x": 0.5, "angular_z": 0.1},
  "ai_provider": "openai",
  "ai_model": "gpt-4o",
  "confidence": 0.94,
  "thought_id": "chatcmpl-abc123",
  "bridge": "ros2",
  "ros2_topic": "/robot1/cmd_vel",
  "prev_hash": "sha256:7c2d..."
}
```

DENIED commands are also audited (with `outcome: "denied"` and `deny_reason`), ensuring a complete record regardless of whether the command reached ROS2.

---

## 9. SROS2 Compatibility

The RCAN ↔ ROS2 bridge is **fully compatible with SROS2**. The two security layers operate independently and complement each other:

| Layer | SROS2 | RCAN Bridge |
|---|---|---|
| Transport security | DDS Security: authentication + encryption | Independent (RCAN mTLS on inbound side) |
| Access control | DDS permissions.xml (topic-level) | RCAN §12 RBAC (action-level, role-based) |
| AI accountability | None | Full §6 audit with model identity |
| Audit trail | None | §6 append-only chain |

When SROS2 is enabled:
- The bridge authenticates to the ROS2 DDS network using SROS2 certificates (configured via `ROS_SECURITY_KEYSTORE`)
- RCAN RBAC is enforced **before** any message reaches the SROS2-protected DDS domain
- SROS2 permissions.xml and RCAN RBAC policies are maintained independently; neither inherits from the other

To enable:
```bash
export ROS_SECURITY_ENABLE=true
export ROS_SECURITY_STRATEGY=Enforce
export ROS_SECURITY_KEYSTORE=/etc/rcan/sros2_keystore
python -m castor.bridges.ros2_bridge --config /etc/rcan/.rcan.yaml
```

---

## 10. Conformance

A RCAN ↔ ROS2 bridge implementation MUST:

1. Validate RCAN §12 RBAC before publishing any message to ROS2 topics or calling any service/action
2. Enforce §8 velocity and workspace invariants (clamping or denial per config)
3. Implement the §9 HiTL gate with configurable timeout and notification
4. Generate a §6-compliant audit entry for every COMMAND (executed or denied)
5. Include `ai_provider`, `ai_model`, `confidence`, `thought_id` in audit entries when provided
6. Advertise via mDNS `_rcan._tcp.local` with a valid RCAN TXT record set
7. Expose `GET /api/status` and `POST /api/hitl/authorize` REST endpoints
8. Halt robot on loss of RCAN session (publish zero-velocity Twist, cancel active goals)

---

## 11. Known Limitations

- **ROS2 action feedback:** Navigation action feedback (progress percentage) is not currently translated to RCAN telemetry — only final outcome.
- **Multi-arm robots:** JointTrajectory mapping assumes a single controller; multi-arm robots may require per-arm topic configuration.
- **QoS mismatch:** If the ROS2 robot uses non-default QoS profiles, topic QoS in the bridge config may need adjustment.
- **ROS2 time:** Bridge uses ROS2 clock for timestamp correlation. Ensure `use_sim_time` is set correctly in simulation environments.

---

*See also:* [`docs/bridges/opcua-bridge.md`](./opcua-bridge.md) | [`docs/engagement/iso-tc299-roadmap.md`](../engagement/iso-tc299-roadmap.md) | [`docs/compliance/iso-10218-alignment.md`](../compliance/iso-10218-alignment.md)
