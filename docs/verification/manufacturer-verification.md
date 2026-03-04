# RCAN Manufacturer Verification Program

The RCAN Manufacturer Verification Program establishes a trust hierarchy for robot entries in the registry. Verification tiers signal the source and quality of a robot's identity data, helping operators, integrators, and regulators understand how much confidence to place in a robot's registered profile.

---

## Verification Tiers

| Tier | Label | Emoji | Meaning |
|------|-------|-------|---------|
| `unverified` | Unverified | ⬜ | Robot entry has not been reviewed or attested by any party |
| `community` | Community Verified | 🟡 | Well-known open hardware OR 3+ independent community attestations |
| `manufacturer_claimed` | Manufacturer Claimed | 🔵 | Manufacturer has asserted ownership via domain + DNS verification |
| `manufacturer_verified` | Manufacturer Verified | ✅ | Full verification: DNS + signed attestation + live RURI endpoint |

---

## How to Achieve Each Tier

### ⬜ Unverified (default)

All new robot submissions start as `unverified`. No action required; this is the baseline state for community-submitted entries that have not yet been reviewed.

---

### 🟡 Community Verified

**Eligibility criteria (either):**
- The robot is a well-known open-hardware platform with a public record (e.g., TurtleBot, Spot, Unitree robots), **OR**
- The robot entry receives **3 or more independent community attestations** via GitHub Pull Request review (distinct GitHub accounts, each commenting with `:attestation:` or equivalent tag in the PR)

**Process:**
1. Open a PR adding or updating the robot YAML
2. Reviewers comment to attest accuracy of make/model/spec data
3. A maintainer sets `verification_status: community` once criteria are met

Community verification confirms the identity data is plausible and community-reviewed, but does not confirm that the submitter is affiliated with the manufacturer.

---

### 🔵 Manufacturer Claimed

**Requirements:**
1. Submit a PR or API request **from a verified manufacturer domain** (email or signed commit from `@{manufacturer-domain}`)
2. Publish a DNS TXT record on the manufacturer's domain:
   ```
   _rcan-verify.{domain}  TXT  "rrn={RRN};model={model}"
   ```
   **Example:**
   ```
   _rcan-verify.robotis.com  TXT  "rrn=RRN-00000001;model=turtlebot3_burger"
   ```
3. RCAN registry will perform a DNS lookup to validate the record before upgrading the tier

**What this proves:** The manufacturer controls the domain associated with the robot and has explicitly claimed this RRN.

**Limitations:** Does not require a live robot endpoint. The manufacturer asserts ownership but full automated verification has not been completed.

---

### ✅ Manufacturer Verified

**Requirements (all of the following):**

1. All `manufacturer_claimed` requirements above ✓
2. Submit a **signed attestation JSON** file (see schema below)
3. Host a **live RURI endpoint** that responds to:
   ```
   GET /.well-known/rcan-manifest.json
   ```
   The response must include the RRN and match the registry entry's `ruri` field.

**Signed Attestation JSON Schema:**

```json
{
  "rrn": "RRN-00000001",
  "manufacturer": "ROBOTIS",
  "model": "turtlebot3_burger",
  "timestamp_iso": "2026-01-15T12:00:00Z",
  "registry_url": "https://rcan.dev/registry/RRN-00000001",
  "signature": "pending"
}
```

> **Note on `signature`:** The `"pending"` value is a placeholder for the initial submission phase. A future version of the protocol will require a cryptographic signature (e.g., Ed25519) over the canonical JSON payload. Manufacturers should structure their tooling to accommodate this field being populated with a real signature in RCAN protocol v2.

**RURI Endpoint Validation:**

The RCAN registry crawler will perform a `GET` request to:
```
{ruri}/.well-known/rcan-manifest.json
```

The response must be a valid JSON object containing at minimum:
```json
{
  "rrn": "RRN-XXXXXXXX",
  "model": "...",
  "manufacturer": "..."
}
```

Fields must match the registry entry. The endpoint must respond with HTTP 200 and `Content-Type: application/json`.

---

## Why Verification Matters

### Safety Contexts
Autonomous robots operating in shared spaces (warehouses, hospitals, public areas) must be identifiable. Verification tiers allow safety systems and operators to determine whether a robot's claimed identity can be trusted. An `unverified` robot should be treated with more caution than a `manufacturer_verified` one.

### EU AI Act Conformity
The EU AI Act (2024/1689) classifies many autonomous robots as high-risk AI systems. Manufacturers placing these systems on the EU market must maintain technical documentation and traceability. RCAN verification tiers provide a lightweight conformity signal that can be referenced in technical files and declarations of conformity.

### Insurance & Liability
Insurance underwriters increasingly require proof of robot identity and provenance for coverage of autonomous systems. A `manufacturer_verified` registry entry provides a third-party attestation that can be cited in insurance applications and incident reports.

### Incident Investigation
When a robot causes an incident, first responders and investigators need to quickly identify the responsible manufacturer, model, and owner. A verified registry entry accelerates this process and reduces the risk of misidentification. The RCAN API endpoint (`/api/v1/verify/{rrn}`) can be queried in real-time by emergency systems.

---

## Verification Status API

Query the verification status of any registered robot:

```
GET https://rcan.dev/api/v1/verify/{rrn}
```

**Example response:**
```json
{
  "success": true,
  "rrn": "RRN-00000001",
  "verification_status": "community",
  "verification_date": null,
  "verification_method": null,
  "api_version": "1.0"
}
```

---

## Roadmap

- **v1.0** — Four-tier model with DNS and endpoint verification (current)
- **v1.1** — Cryptographic signatures on attestation JSON (Ed25519)
- **v2.0** — Automated continuous re-verification via RURI crawler; revocation support

---

*This document is part of the RCAN specification. For questions or to initiate manufacturer verification, open an issue at [github.com/rcan-spec/rcan-spec](https://github.com/rcan-spec/rcan-spec).*
