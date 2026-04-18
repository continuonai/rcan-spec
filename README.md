# RCAN Specification

RCAN v2.2 — the open protocol for secure robot-to-robot communication.

[![Spec Version](https://img.shields.io/badge/spec-v2.2.0-blue)](https://rcan.dev/spec/)
[![License](https://img.shields.io/badge/license-CC%20BY%204.0-green)](https://creativecommons.org/licenses/by/4.0/)
[![CI](https://github.com/continuonai/rcan-spec/actions/workflows/ci.yml/badge.svg)](https://github.com/continuonai/rcan-spec/actions)

**[→ Read the spec at rcan.dev/spec/](https://rcan.dev/spec/)**

## What Problem RCAN Solves

Robots today are islands. A Boston Dynamics Spot and a Raspberry Pi rover can't talk to each other, authenticate each other, or safely hand off work to each other — even if they're in the same room. RCAN defines a common addressing scheme (Robot URIs), a message envelope with built-in safety fields, and a federation model so any manufacturer can run their own registry while still interoperating with every other robot on the network. Think of it as DNS + HTTPS, but for robotics.

## Key Concepts

**RRN (Robot Registration Number)** — a permanent, globally unique identifier assigned by the registry. Format: `RRN-000000000001` (root) or `RRN-BD-000000000001` (delegated namespace). Survives hardware swaps and OS reinstalls.

**Robot URI (RURI)** — a resolvable address that embeds the registry, manufacturer, model, version, and device ID: `rcan://registry.rcan.dev/acme/arm/v2/unit-001`.

**R2RAM (Robot-to-Robot Access Model)** — role-based access control for robot-to-robot commands. Five levels: Guest → Observer → User → Operator → Creator. Scopes are fine-grained (read, control, safety, admin).

**Protocol 66** — RCAN's mandatory safety layer. Core invariant: local safety always wins. ESTOP is never blocked. Cloud commands pass through the same confidence gates and bounds checks as local commands.

**Message Types** — 31 defined message types covering commands, telemetry, consent, audit, federation sync, and ESTOP. Every message carries a `msg_id` for replay prevention and a `confidence` field for AI accountability.

## Spec Sections

| Section | Title |
|---|---|
| §1 | Robot URI (RURI) — canonical address format and validation |
| §2 | Role-Based Access Control — 5-level hierarchy, fine-grained scopes |
| §3 | Message Format — common envelope, all 31 MessageType values |
| §4 | Discovery (mDNS) — `_rcan._tcp.local` for LAN-local robot discovery |
| §5 | Authentication — RCAN JWT structure, gateway tokens, verification order |
| §6 | Safety Invariants — local supremacy, graceful degradation, audit trail |
| §7 | Federation — Right to Redirect, Local Supremacy, cross-registry trust |
| §8 | Robot Config (RCAN File) — `.rcan.yaml` schema, required and optional blocks |
| §9 | Capabilities — standard capability names, required scopes, HTTP endpoints |
| §10 | Autonomous Navigation — dead-reckoning waypoint API, physics prereqs |
| §11 | Behavior Scripts — YAML behavior format, step types, Behavior API |
| §12 | Depth & Sensing — depth obstacle zone API, JET colormap, safety integration |
| §13 | Telemetry Streaming — WebSocket endpoint, push rate, required fields |
| §14 | Provider Management — quota fallback, offline fallback, health check |
| §15 | Swarm Coordination — node registry, broadcast commands, safety rules |
| §16 | AI Accountability — confidence gates, HiTL gates, Thought Log |
| §17 | Distributed Registry Node Protocol — node types, RRN namespaces, sync |
| §18 | Capability Advertisement Protocol — Capability Object Map schema |
| §19 | Behavior/Skill Invocation — INVOKE, INVOKE_RESULT, INVOKE_CANCEL |
| §20 | Telemetry Field Registry — joint telemetry schema, Prometheus labels |
| §21 | Robot Registry Integration — RRN↔RURI mapping, ownership proof |
| Appendix B | Conformance Levels L1–L4 |

## SDKs

| SDK | Language | Install | Tests |
|---|---|---|---|
| [rcan-py](https://github.com/continuonai/rcan-py) | Python 3.10+ | `pip install rcan` | 754 |
| [rcan-ts](https://github.com/continuonai/rcan-ts) | TypeScript / Node 18+ | `npm install rcan-ts` | 447 |
| [OpenCastor](https://github.com/craigm26/OpenCastor) | Python (robot runtime) | `pip install opencastor==2026.3.17.1` | 6,459 |

## Companion formats

RCAN defines the *wire* layer (how robots talk). A robot still needs a way to declare *itself* — what it is, what it can do, and what safety envelope it operates under — to any agent that connects to it.

| Format | Purpose | Home |
|---|---|---|
| [**ROBOT.md**](https://robotmd.dev) | Single-file robot manifest (YAML frontmatter + markdown prose) — read by any agent harness (Claude Code, ChatGPT, Gemini, Ollama, …) at session start so the planner knows the robot before the first prompt. Uses `rcan_version` in the frontmatter to pin its RCAN target. | [RobotRegistryFoundation/robot-md](https://github.com/RobotRegistryFoundation/robot-md) |

ROBOT.md is independent of RCAN — you can ship one without the other — but the two compose cleanly: a robot with a ROBOT.md that pins `rcan_version: "3.0"` speaks RCAN 3.0 on the wire and declares that fact in its manifest.

## Conformance Badges

Implementations can declare a conformance level in their `/.well-known/rcan-node.json` manifest:

| Level | Requirement |
|---|---|
| **L1** | Robot URI parsing, basic message format |
| **L2** | L1 + authentication, RBAC, ESTOP |
| **L3** | L2 + replay prevention, audit chain, confidence gates |
| **L4** | L3 + registry integration, RRN, ownership proof |

Conformance tests live in the [`tests/`](tests/) directory and run against a reference implementation via `npm run test`.

## Spec Versioning

RCAN follows a **major.minor** policy. The spec is versioned independently of any SDK.

| Spec | SDKs | Backward compatible? |
|---|---|---|
| v1.6 | rcan-py 0.6, rcan-ts 0.6, OpenCastor 2026.4 | ✅ Yes |
| v1.5 | rcan-py 0.5, rcan-ts 0.5 | ✅ Yes |
| v1.4 | rcan-py 0.4, rcan-ts 0.4 | ✅ Yes |
| v1.0–1.3 | Legacy | ✅ Yes (message envelope backward compat) |

Minor bumps add fields and message types; they never remove or rename existing ones. A v1.6 SDK can read v1.0 messages.

## Contributing to the Spec

The spec is an Astro static site deployed to [rcan.dev](https://rcan.dev/spec/).

```bash
npm install
npm run dev      # localhost:4321
npm run build    # production → dist/
npm run test     # conformance tests
```

Open issues and proposals at [github.com/continuonai/rcan-spec/issues](https://github.com/continuonai/rcan-spec/issues). Major changes go through a public comment period before merging.

## Ecosystem

| Package | Version | Purpose |
|---|---|---|
| **rcan-spec** (this) | v1.6.0 | Protocol specification |
| [rcan-py](https://github.com/continuonai/rcan-py) | v0.6.0 | Python SDK |
| [rcan-ts](https://github.com/continuonai/rcan-ts) | v0.6.0 | TypeScript SDK |
| [OpenCastor](https://github.com/craigm26/OpenCastor) | v2026.3.17.1 | Robot runtime (reference impl) |
| [RRF](https://robotregistryfoundation.org) | v1.6.0 | Robot identity registry |
| [Fleet UI](https://app.opencastor.com) | live | Web fleet dashboard |
| [Docs](https://docs.opencastor.com) | live | Runtime reference, RCAN, API |

## License

Specification text: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Reference implementations: MIT.
