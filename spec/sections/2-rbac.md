# §2 — Role-Based Access Control (RBAC)

> This file is the normative source for RCAN RBAC sections. Each subsection
> corresponds to an Astro page under `src/pages/docs/`.

## §2.1 — Principal Roles

*(existing content unchanged)*

## §2.2 — Scope Definitions

*(existing content unchanged)*

## §2.3 — Owner Authorization

*(existing content unchanged)*

## §2.4 — Cross-Owner Consent (R2RAM)

*(existing content unchanged)*

## §2.5 — Revocation

*(existing content unchanged)*

## §2.6 — Channel-Layer Scope Assignment

*(added v1.6.2 — see CHANGELOG)*

## §2.7 — Multi-Hop Scope Propagation

*(added v1.6.2 — see CHANGELOG)*

---

## §2.8 Multi-Participant Mission Threads (R2R2H)

A **Mission** is a scoped conversation context shared by one or more robots and zero or more human principals.

### 2.8.1 Mission Context Fields

Commands dispatched within a mission MUST include:
- `mission_id`: stable identifier for the mission thread
- `participants`: list of RRNs participating in the mission
- `context: "mission_thread"`: identifies the dispatch context

### 2.8.2 Scope Invariants in Missions

- Mission scope is `chat` unless explicitly elevated to `control` by an authorized human principal
- Robots MUST NOT escalate scope within a mission thread (§2.7 non-escalation applies)
- Each robot's P66 invariants apply independently regardless of mission context

### 2.8.3 Response Routing

After processing a mission command, the robot MUST write its response to the shared mission messages subcollection, making it visible to all participants. The robot SHOULD NOT write directly to other robots' command queues — fanout is the bridge coordinator's responsibility.

### 2.8.4 @Mention Handling

A robot receiving a mission message with its RRN in `mentions[]` SHOULD prioritize responding. Robots NOT mentioned MAY respond if contextually relevant. This is advisory — enforcement is at the application layer.

### 2.8.5 Human Role Hierarchy

Missions support multiple human participants, each assigned a role:

| Role | Permissions |
|------|-------------|
| `owner` | Full control — invite/remove participants, end mission, all scopes (chat/control/system) |
| `operator` | Send chat and control commands; invite observers |
| `observer` | Read-only — can receive messages but MUST NOT send commands to robots |

Role invariants:
- Only `owner` and `operator` roles may dispatch robot commands via `sendMissionMessage`
- `observer` messages MUST be rejected by `sendMissionMessage` with `permission-denied`
- Operators cannot grant `owner` role when inviting participants
- The scope granted to robots in a fanout is capped by the sending human's role:
  `scope_level(fanout_cmd) ≤ scope_level(sender_role)` — consistent with §2.7 non-escalation
- `owner` role is assigned exclusively at mission creation; it cannot be transferred via invite

### 2.8.6 Multi-Human Audit

- All mission messages (human and robot) are retained in `missions/{id}/messages/` in Firestore
- Message documents include `from_role` for human senders to support role-based audit queries
- Deletion of mission message history MUST require `owner` role — operators and observers may not delete
- The `participant_uids` top-level array field on the mission document MUST be maintained for efficient membership queries (`array-contains`)
- `mission_invites/{uid}/invites/{missionId}` tracks all invite state (`pending`, `accepted`, `declined`) as a permanent audit record
