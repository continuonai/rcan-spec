# RCAN Robot Profiles

Pre-built `.rcan.yaml` configuration files for widely deployed cobot and mobile robot platforms. Use these as a starting point when integrating a new robot with an RCAN-compatible runtime.

> **Full config reference:** [rcan.dev/spec §8 — Robot Configuration (RCAN File)](https://rcan.dev/spec/#config)

---

## Available Profiles

| Profile | Type | Bridge | Payload | Reach |
|---|---|---|---|---|
| [`universal-robots/ur10e`](universal-robots/ur10e.rcan.yaml) | Collaborative arm | ur_rtde | 10 kg | 1300 mm |
| [`universal-robots/ur5e`](universal-robots/ur5e.rcan.yaml) | Collaborative arm | ur_rtde / ros2 | 5 kg | 850 mm |
| [`franka-robotics/franka-research-3`](franka-robotics/franka-research-3.rcan.yaml) | Collaborative arm | ros2 (franka_ros2) | 3 kg | 855 mm |
| [`kuka/iiwa7`](kuka/iiwa7.rcan.yaml) | Collaborative arm | kuka_sunrise / ros2 | 7 kg | 800 mm |
| [`boston-dynamics/spot`](boston-dynamics/spot.rcan.yaml) | Mobile quadruped | spot_sdk | 14 kg body | — |
| [`generic/mobile-differential-drive`](generic/mobile-differential-drive.rcan.yaml) | Mobile differential | ros2_nav (Nav2) | varies | — |

---

## How to Use a Profile

### 1. Copy the profile to your project

```bash
cp profiles/universal-robots/ur5e.rcan.yaml myrobot.rcan.yaml
```

### 2. Fill in `{device_id}`

Every profile's `ruri` field contains a `{device_id}` placeholder:

```yaml
ruri: rcan://local.rcan/universal-robots/ur5e/{device_id}
```

Replace `{device_id}` with a unique identifier for your specific robot unit. You have two options:

**Option A — UUID (recommended for production):**
```bash
python3 -c "import uuid; print(uuid.uuid4())"
# → 550e8400-e29b-41d4-a716-446655440000
```
```yaml
ruri: rcan://local.rcan/universal-robots/ur5e/550e8400-e29b-41d4-a716-446655440000
```

**Option B — Short hex (for local/dev use):**
```bash
python3 -c "import secrets; print(secrets.token_hex(4))"
# → a3f7c1d9
```
```yaml
ruri: rcan://local.rcan/universal-robots/ur5e/a3f7c1d9
```

> For fleet deployments, consider using the robot's hardware serial number or a UUID generated at provisioning time. Store the same ID in your RCAN registry entry.

### 3. Configure the bridge

Update the `bridge.host` (or equivalent) to match your robot's network address:

```yaml
bridge:
  type: ur_rtde
  host: 192.168.1.101   # ← your robot's actual IP
```

### 4. Tune safety and agent gates

Review the `safety` and `agent.confidence_gates` sections. The profiles ship with **conservative defaults**. Adjust after completing a site-specific risk assessment.

```yaml
safety:
  max_speed_override: 0.5    # raise only after risk assessment
  estop_distance_mm: 400

agent:
  confidence_gates:
    - scope: control
      min_confidence: 0.90   # adjust for your AI layer
      on_fail: escalate
```

### 5. Validate the config

If your RCAN runtime supports config validation:

```bash
rcan validate myrobot.rcan.yaml
```

Or validate manually against the published JSON Schema:

```bash
pip install jsonschema pyyaml
python3 -c "
import yaml, jsonschema, urllib.request, json
schema = json.loads(urllib.request.urlopen('https://rcan.dev/schema/rcan.schema.json').read())
config = yaml.safe_load(open('myrobot.rcan.yaml'))
jsonschema.validate(config, schema)
print('Config valid')
"
```

---

## Bridge Libraries

Each bridge type requires specific libraries on the control PC.

### `ur_rtde` — Universal Robots (UR3e / UR5e / UR10e / UR16e / UR20 / UR30)

```bash
pip install ur-rtde>=1.5.6
```

- SDK: [sdurobotics.gitlab.io/ur-rtde](https://sdurobotics.gitlab.io/ur-rtde/)
- PolyScope: Settings → System → RTDE → Enable
- Robot must be in **Remote Control** mode
- Firewall: allow TCP 29999, 30002, 30004 from control PC

**Alternative (ROS 2):** [Universal_Robots_ROS2_Driver](https://github.com/UniversalRobots/Universal_Robots_ROS2_Driver)
```bash
sudo apt install ros-humble-ur-robot-driver
ros2 launch ur_robot_driver ur_control.launch.py ur_type:=ur5e robot_ip:=<IP>
```

---

### `ros2` / `franka_ros2` — Franka Research 3 (FR3 / Panda)

```bash
# libfranka (≥ 0.13.0) — build from source
git clone --recursive https://github.com/frankaemika/libfranka
cd libfranka && mkdir build && cd build && cmake .. -DBUILD_TESTS=OFF && make -j4

# franka_ros2 — colcon workspace
colcon build --packages-up-to franka_bringup
```

- Requires **real-time kernel** (PREEMPT-RT) on control PC — test with `uname -r | grep rt`
- Activate **FCI** in Franka Desk (`https://<robot-ip>`) before launch
- Docs: [frankaemika.github.io/docs/franka_ros2](https://frankaemika.github.io/docs/franka_ros2.html)

---

### `kuka_sunrise` / `iiwa_ros2` — KUKA LBR iiwa 7 / iiwa 14

```bash
# iiwa_ros2 — ROS 2 Humble+
git clone https://github.com/ICube-Robotics/iiwa_ros2
colcon build --packages-up-to iiwa_bringup
```

- Deploy the FRI Java application (`ROSSmartServo.java`) via **KUKA Sunrise Workbench**
- FRI uses **UDP port 30200**; configure the client IP in Sunrise Workbench
- Sunrise OS ≥ 1.17 recommended
- For legacy KUKA KR C4 robots, use [kuka_experimental](https://github.com/ros-industrial/kuka_experimental) with RSI

---

### `spot_sdk` — Boston Dynamics Spot

```bash
pip install bosdyn-client bosdyn-mission bosdyn-choreography-client
# For Spot firmware 4.x: SDK ≥ 4.0
```

- SDK docs: [dev.bostondynamics.com](https://dev.bostondynamics.com)
- Connect via Spot's WiFi AP (`SpotXXXXXX`) or Ethernet payload port
- **Mandatory:** Register an E-Stop endpoint and maintain a heartbeat thread
- Acquire a **lease** before sending mobility commands
- Store credentials in environment variables, never in the YAML file

**Alternative (ROS 2):** [spot_ros2](https://github.com/boston-dynamics/spot_ros2)
```bash
ros2 launch spot_driver spot_driver.launch.py hostname:=192.168.80.3
```

---

### `ros2_nav` — Generic Differential Drive (Nav2)

```bash
sudo apt install ros-humble-nav2-bringup \
                 ros-humble-robot-localization \
                 ros-humble-ros2-control \
                 ros-humble-diff-drive-controller
```

- Works with TurtleBot 3/4, Clearpath Husky, and any `/cmd_vel`-compatible robot
- Requires a map (SLAM or pre-built) for autonomous navigation
- For OpenCastor Pi robots: run the RCAN OpenCastor runtime alongside Nav2

---

## Profile Design Notes

- **`local_safety_wins: true`** is always set. Per [RCAN spec §6](https://rcan.dev/spec/#safety), no remote command can bypass on-device safety checks.
- **`max_speed_override`** defaults to `0.5` (50% rated speed) for collaborative environments. Raise only after a formal risk assessment.
- **`confidence_gates`** are tuned conservatively. Industrial arms default to `0.90` minimum confidence before any control command is dispatched.
- **`hitl_gates`** are empty by default — operators must configure Human-in-the-Loop gates based on their deployment risk profile.
- **`{device_id}`** is always a template placeholder. Never commit a config with a real UUID unless it is intentional (e.g. a single-robot deployment).

---

## Contributing a Profile

To add a profile for a new platform:

1. Create `profiles/<manufacturer>/<model>.rcan.yaml`
2. Follow the header comment format (robot name, bridge type, spec version)
3. Include accurate hardware specs from the official datasheet
4. Set conservative safety defaults (`max_speed_override ≤ 0.5`)
5. Add a row to the table above
6. Open a PR referencing the platform's official documentation

---

*Profiles maintained by the RCAN community. Spec: [rcan.dev/spec §8](https://rcan.dev/spec/#config)*
