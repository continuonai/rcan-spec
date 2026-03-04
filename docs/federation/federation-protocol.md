# RCAN Federation Protocol

**Status:** Draft  
**Version:** 1.0  
**Authors:** RCAN Working Group  
**Related:** [Governance](/governance) · [RURI Specification](/spec) · [Conformance](/conformance)

---

## 1. Overview

The RCAN Federation Protocol defines how multiple independent robot registries interoperate to form a global, decentralised robot identity namespace — without any single point of control.

Federation is modelled after the Domain Name System (DNS): just as anyone can operate a DNS resolver or authoritative nameserver, anyone can host an RCAN registry for their own namespace. A robot's globally unique identity is embedded in its RURI, which encodes the authoritative registry that can resolve it.

> **Design principle:** No single organisation — including the RCAN Working Group — should be a required intermediary for robot identity resolution at runtime.

---

## 2. Why Federation?

Centralised identity registries create systemic risks:

| Risk | Centralised | Federated |
|---|---|---|
| Single point of failure | Registry outage breaks all resolution | Local/org registries continue independently |
| Vendor lock-in | One body controls all robot identities | Operators own their own namespace |
| Governance capture | One actor can revoke/alter identities | Independent registries protect their members |
| Scalability ceiling | One registry, millions of robots | Horizontal scaling across registries |
| Offline operation | Cloud-down = robots can't resolve | Local registries survive network partitions |

Federation ensures that:
- Manufacturers can run their own registries for their product lines.
- Enterprises can run internal registries for their robot fleets.
- Local/offline deployments resolve without any internet access.
- `rcan.dev` is a bootstrap anchor and governance reference — not a required runtime dependency.

---

## 3. RURI Structure and Federation Encoding

A Robot Uniform Resource Identifier (RURI) encodes the authoritative registry directly in its structure:

```
rcan://REGISTRY/MANUFACTURER/MODEL/DEVICE-ID
```

| Component | Description | Example |
|---|---|---|
| `REGISTRY` | Hostname of the authoritative registry | `rcan.dev`, `robots.acme-corp.com`, `local.rcan` |
| `MANUFACTURER` | Manufacturer slug (lowercase, hyphens) | `boston-dynamics`, `universal-robots` |
| `MODEL` | Model slug (lowercase, hyphens) | `spot`, `ur10e` |
| `DEVICE-ID` | Unique device identifier (≥ 8 chars, lowercase + hyphens) | `a1b2c3d4e5f6` |

### 3.1 Extended Forms

```
# With port
rcan://registry.example.com:9000/manufacturer/model/device-id

# With capability path
rcan://registry.example.com/manufacturer/model/device-id/teleop

# With port and capability
rcan://registry.example.com:9000/manufacturer/model/device-id/camera
```

### 3.2 Self-Describing Resolution

Because the registry host is encoded in the RURI itself, **no central lookup is needed** to determine where to resolve a RURI. A resolver simply:

1. Parses the `REGISTRY` component from the RURI.
2. Constructs the registry API URL: `https://<REGISTRY>/api/rcan/v1/`
3. Queries that registry directly.

This is intentionally analogous to how DNS resolvers use the authoritative nameserver embedded in zone delegation records.

---

## 4. Registry Types

RCAN defines three classes of registry, distinguished by scope and authority level.

### 4.1 Root Registry — `rcan.dev`

The root registry is operated by the RCAN Working Group and serves as:

- The **registry of last resort** for robots without a dedicated organisational registry.
- The **bootstrap anchor** for federation: federated registries register themselves with the root so other parties can discover them.
- The **governance reference**: root registry policies are set by an independent governance body (see [/governance](/governance)).

The root registry **MUST NOT** be a required runtime dependency. If `rcan.dev` is unreachable, robot operations using organisational or local registries **MUST** continue normally.

**Root RURI example:**
```
rcan://rcan.dev/boston-dynamics/spot/bd-spot-001a2b3c
```

### 4.2 Organisational Registry

An organisational registry is hosted by a manufacturer, enterprise, or research institution for their own robot fleet or product line.

**Characteristics:**
- Operates under its own domain (e.g., `robots.acme-corp.com`)
- Authoritative for RURIs in its namespace
- Registers itself with the root registry for discoverability
- May choose to federate with other organisational registries

**Organisational RURI example:**
```
rcan://robots.acme-corp.com/acme/logistics-bot/lgb-00a1b2c3d4e5
```

### 4.3 Local Registry — `local.rcan`

A local registry operates within a private network (LAN, robot cell, facility) and resolves RURIs without any internet access. The reserved hostname `local.rcan` is used for local-scope registries, resolved via mDNS.

**Characteristics:**
- Operates on a private network; never routable on the public internet
- Uses mDNS service type `_rcan-registry._tcp` for discovery
- Resolves entirely offline
- Suitable for manufacturing cells, research labs, and air-gapped deployments

**Local RURI example:**
```
rcan://local.rcan/opencastor/rover/abc12345
```

> **Note:** Multiple local registries may exist on a network; the mDNS `priority` field determines preference.

---

## 5. Resolution Chain

RCAN resolution follows a deterministic, priority-ordered chain. A resolver **MUST** attempt each step in order and return the result from the first successful step.

```
1. Local cache
       ↓  (cache miss or expired TTL)
2. Parse REGISTRY host from RURI
       ↓
3. Query registry API: GET https://<REGISTRY>/api/rcan/v1/robots/<rrn>
       ↓  (registry unreachable)
4. Fallback: query root registry rcan.dev (if configured)
       ↓  (root also unreachable)
5. Resolution failure → return REGISTRY_UNREACHABLE error
```

### 5.1 Cache Behaviour

- Cache entries **MUST** include the TTL returned by the registry (`cache_ttl_seconds` field).
- Default TTL if not specified: **300 seconds** (5 minutes).
- Cached federation proofs **SHOULD** be stored on persistent storage for offline resilience.
- Stale cache entries **MAY** be served when the registry is unreachable (implementations SHOULD log this).

### 5.2 Registry Query

A resolver queries the registry's REST API:

```http
GET https://<REGISTRY>/api/rcan/v1/robots/<rrn>
Accept: application/json
```

The registry responds with a **Federation Proof** (see §6).

### 5.3 Registry Discovery

If a registry hostname is unknown (first contact), a resolver **MAY** fetch the registry's well-known descriptor before querying:

```http
GET https://<REGISTRY>/.well-known/rcan-registry.json
```

See §7 for the descriptor schema.

---

## 6. Federation Proof

A federation proof is the signed, authoritative response from a registry confirming a robot's identity and registration status.

### 6.1 JSON Schema

```json
{
  "registry_url": "https://rcan.dev",
  "rrn": "RRN-00000042",
  "robot_name": "Spot Unit Alpha",
  "registry_pubkey_hint": "sha256:abc123def456...",
  "timestamp_iso": "2026-03-04T15:30:00Z",
  "chain_hash": "sha256:fedcba987654...",
  "attestation": "pending"
}
```

### 6.2 Field Definitions

| Field | Type | Required | Description |
|---|---|---|---|
| `registry_url` | string (URL) | ✅ | Canonical URL of the issuing registry |
| `rrn` | string | ✅ | Robot Registration Number, unique within this registry |
| `robot_name` | string | ✅ | Human-readable robot display name |
| `registry_pubkey_hint` | string | ✅ | `sha256:` fingerprint of the registry's current signing public key |
| `timestamp_iso` | string (ISO 8601) | ✅ | Time the proof was generated (UTC) |
| `chain_hash` | string | ✅ | `sha256:` hash linking this proof to the registry's previous proof (audit chain) |
| `attestation` | string (enum) | ✅ | Registration status: `"active"`, `"pending"`, `"suspended"`, `"revoked"` |

### 6.3 Attestation States

| State | Meaning |
|---|---|
| `active` | Robot is fully registered and in good standing |
| `pending` | Registration submitted, awaiting verification |
| `suspended` | Registration temporarily suspended (e.g., safety hold) |
| `revoked` | Registration permanently revoked |

### 6.4 Proof Verification

Resolvers **SHOULD** verify federation proofs by:

1. Fetching the registry's public key from `public_key_url` (from the registry's `.well-known` descriptor).
2. Verifying the proof signature against the `registry_pubkey_hint` fingerprint.
3. Checking `timestamp_iso` is within acceptable skew (recommended: ±5 minutes).
4. Validating `chain_hash` against the previous proof in the chain (for audit integrity).

---

## 7. Running a Federated Registry

Any organisation can operate an RCAN-conformant registry. The requirements are intentionally minimal.

### 7.1 Requirements

| Requirement | Description |
|---|---|
| **RCAN API** | Implement the RCAN Registry REST API (see §7.2) |
| **Well-Known Descriptor** | Publish `/.well-known/rcan-registry.json` (see §7.3) |
| **Public Key** | Publish a public key for proof signing; link from descriptor |
| **Open API** | The registry API **MUST** be publicly accessible (no auth required for reads) |
| **TLS** | HTTPS required; valid certificate required |
| **Root Registration** | Register with root registry `rcan.dev` for global discoverability |

### 7.2 Required API Endpoints

A conformant registry **MUST** implement the following endpoints at its `api_base`:

```
GET  {api_base}/robots/{rrn}             → federation proof
GET  {api_base}/robots?manufacturer=...  → list robots (filterable)
GET  {api_base}/robots/{rrn}/capabilities → capability listing
POST {api_base}/robots                   → register a robot (authenticated)
GET  {api_base}/status                   → registry health/version
```

### 7.3 .well-known/rcan-registry.json Schema

Every registry **MUST** publish a descriptor at `/.well-known/rcan-registry.json`:

```json
{
  "name": "ACME Robotics Registry",
  "operator": "ACME Corporation",
  "rcan_version": "1.2",
  "api_base": "https://robots.acme-corp.com/api/rcan/v1",
  "public_key_url": "https://robots.acme-corp.com/.well-known/rcan-registry.pub",
  "federation_root": "https://rcan.dev"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✅ | Human-readable registry name |
| `operator` | string | ✅ | Organisation operating this registry |
| `rcan_version` | string | ✅ | RCAN spec version this registry conforms to (e.g., `"1.2"`) |
| `api_base` | string (URL) | ✅ | Base URL for the RCAN Registry REST API |
| `public_key_url` | string (URL) | ✅ | URL to fetch the registry's public signing key (PEM format) |
| `federation_root` | string (URL) | ✅ | Root registry this registry federates with (typically `https://rcan.dev`) |

### 7.4 Step-by-Step: Launch a Federated Registry

**Step 1 — Implement the API**

Implement the required endpoints from §7.2. Reference implementations are available:
- [rcan-registry-reference](https://github.com/continuonai/rcan-spec/tree/main/examples/registry) (TypeScript / Node.js)

**Step 2 — Generate and Publish Your Key Pair**

```bash
# Generate Ed25519 key pair
openssl genpkey -algorithm ed25519 -out registry-private.pem
openssl pkey -in registry-private.pem -pubout -out registry-public.pem

# Publish registry-public.pem at /.well-known/rcan-registry.pub
```

**Step 3 — Publish .well-known/rcan-registry.json**

Serve the descriptor at `https://your-registry.example.com/.well-known/rcan-registry.json` with the fields from §7.3.

**Step 4 — Validate Conformance**

Run the RCAN conformance checker against your registry:

```bash
python3 scripts/conformance/check_l1.py \
  --host your-registry.example.com \
  --port 443 \
  --registry-mode
```

**Step 5 — Register with the Root**

Submit your registry to `rcan.dev` so it is discoverable by the broader RCAN ecosystem:

```http
POST https://rcan.dev/api/rcan/v1/federation/registries
Content-Type: application/json

{
  "registry_url": "https://your-registry.example.com",
  "well_known_url": "https://your-registry.example.com/.well-known/rcan-registry.json"
}
```

The root registry will fetch and validate your `.well-known` descriptor, verify your API conformance, and add your registry to the federation index.

---

## 8. Root Registry Governance

`rcan.dev` serves as the root registry and federation anchor. Its operation **MUST** be governed by an independent body to prevent capture by any single commercial or governmental interest.

Governance responsibilities include:
- Setting and updating the RCAN specification.
- Operating the root registry `rcan.dev` with defined uptime SLAs.
- Maintaining the federation index of registered organisational registries.
- Establishing policies for registry suspension or revocation.
- Publishing the governance charter and meeting records publicly.

> **See:** [/governance](/governance) for the full governance charter, board composition, and decision-making process.

The root registry **MUST NOT** be used as a runtime dependency for local or organisational registries. Its role is bootstrap, governance, and discoverability — not operational control.

---

## 9. Security Considerations

### 9.1 Registry Impersonation

Because the registry hostname is encoded in the RURI, a malicious actor could craft a RURI pointing to a fake registry. Mitigations:

- Always verify the federation proof signature against the registry's published public key.
- For high-security deployments, pin allowed registry hostnames in the resolver configuration.
- The root registry federation index provides a canonical list of registered organisational registries.

### 9.2 Key Rotation

Registries **MUST** support key rotation without service interruption:

- Publish new key at least 24 hours before the old key expires.
- The `registry_pubkey_hint` in federation proofs identifies which key was used for signing.
- Old proofs signed with the prior key remain verifiable for their `chain_hash` continuity.

### 9.3 Replay Attacks

Federation proofs include `timestamp_iso`. Resolvers **MUST** reject proofs with timestamps more than 5 minutes in the past or future (subject to reasonable clock skew).

### 9.4 Offline and Air-Gapped Deployments

Local registries (`local.rcan`) are designed for offline operation. For air-gapped deployments:
- Pre-load the registry's public key at deployment time.
- Use cached federation proofs with extended TTLs.
- Disable root registry fallback in the resolver configuration.

---

## 10. Appendix: Error Codes

| Code | Name | Description |
|---|---|---|
| 6001 | `REGISTRY_UNREACHABLE` | Could not connect to the registry at the RURI's host |
| 6002 | `FEDERATION_PROOF_INVALID` | Proof signature verification failed |
| 6003 | `FEDERATION_PROOF_EXPIRED` | Proof `timestamp_iso` is outside acceptable skew |
| 6004 | `REGISTRY_NOT_FOUND` | Registry is not registered with the root federation index |
| 6005 | `CHAIN_HASH_MISMATCH` | `chain_hash` does not match expected value (audit chain broken) |
| 6006 | `ROBOT_NOT_REGISTERED` | RRN not found in the queried registry |
| 6007 | `ROBOT_SUSPENDED` | Robot registration is currently suspended |
| 6008 | `ROBOT_REVOKED` | Robot registration has been permanently revoked |

---

*RCAN Federation Protocol · Draft v1.0 · © RCAN Working Group · Licensed CC-BY-4.0*
