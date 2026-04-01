# RCAN Cryptographic Profiles

> **Status:** Draft — targeted for RCAN v2.3.0
> **Issue:** #188

## Overview

A *cryptographic profile* names a complete signing algorithm suite used throughout RCAN for:

- RURI `?sig=` query parameter (§1.6)
- `firmware_hash` envelope field, type 13 (§3)
- `attestation_ref` envelope field, type 14 (§3)
- M2M tokens (§11)

The profile is advertised in `/.well-known/rcan-node.json` via the `crypto_profile` field (see §17).

---

## Profile: pqc-hybrid-v1 (Recommended — now through 2027)

### Purpose

Provides quantum-resistant signing while remaining verifiable by pre-v2.2 receivers that only check Ed25519. Both signature halves are REQUIRED; a message carrying only one half MUST be rejected by v2.3+ receivers.

### Algorithm Suite

| Component | Algorithm | Standard |
|-----------|-----------|----------|
| Classical | Ed25519 | RFC 8032 |
| Post-Quantum | ML-DSA-65 / Dilithium3 | NIST FIPS 204 |

### Key Sizes

| Key type | Raw bytes | Base64url length |
|----------|-----------|------------------|
| Ed25519 public key | 32 B | 43 chars |
| Ed25519 signature | 64 B | 86 chars |
| ML-DSA-65 public key | 1952 B | 2603 chars |
| ML-DSA-65 signature | 3309 B | 4412 chars |

### Signature Encoding

The combined signature is a single string of the form:

```
pqc-hybrid-v1.<ed25519_base64url>.<ml_dsa_base64url>
```

- `<ed25519_base64url>` — base64url (no padding) of the 64-byte Ed25519 signature
- `<ml_dsa_base64url>` — base64url (no padding) of the 3309-byte ML-DSA-65 signature
- The two components are separated by a literal `.`
- The prefix `pqc-hybrid-v1` distinguishes this encoding from the legacy bare base64url format

**Example (truncated for readability):**
```
pqc-hybrid-v1.AAAA...AAAA.BBBB...BBBB
```

### Signing Procedure

```python
# message_bytes = canonical payload to sign (e.g. RURI path bytes)
ed25519_sig  = ed25519_sign(ed25519_private_key, message_bytes)
ml_dsa_sig   = ml_dsa_65_sign(ml_dsa_private_key, message_bytes)

combined_sig = (
    "pqc-hybrid-v1."
    + base64url_no_pad(ed25519_sig)
    + "."
    + base64url_no_pad(ml_dsa_sig)
)
```

### Verification Procedure

```python
# sig_str = value from ?sig= or envelope field
parts = sig_str.split(".")
# parts[0] == "pqc-hybrid-v1", parts[1] == ed25519 half, parts[2] == ml_dsa half

if len(parts) != 3 or parts[0] != "pqc-hybrid-v1":
    raise SignatureFormatError("Not a pqc-hybrid-v1 signature")

ed25519_bytes = base64url_decode(parts[1])
ml_dsa_bytes  = base64url_decode(parts[2])

# BOTH halves must verify; either failure MUST reject the message
assert ed25519_verify(ed25519_public_key, message_bytes, ed25519_bytes), "Ed25519 half invalid"
assert ml_dsa_65_verify(ml_dsa_public_key, message_bytes, ml_dsa_bytes), "ML-DSA-65 half invalid"
```

### Conformance Requirements

- A v2.3+ node advertising `crypto_profile: "pqc-hybrid-v1"` MUST produce signatures in this combined format.
- Receivers MUST reject any message where only one half is present.
- Receivers MUST reject any message where either half fails verification.
- The `ed25519_public_key` and `pqc_public_key` fields MUST both be set in `/.well-known/rcan-node.json` when using this profile.

---

## Profile: pqc-v1 (Future — post-2028)

### Purpose

ML-DSA-65 only. For use after Ed25519 sunset (2027). Receivers that support `pqc-v1` no longer need to maintain Ed25519 verification code.

### Algorithm Suite

| Component | Algorithm | Standard |
|-----------|-----------|----------|
| Post-Quantum | ML-DSA-65 / Dilithium3 | NIST FIPS 204 |

### Signature Encoding

```
pqc-v1.<ml_dsa_base64url>
```

- `<ml_dsa_base64url>` — base64url (no padding) of the 3309-byte ML-DSA-65 signature

### Conformance Requirements

- **General rule:** Prefer `pqc-hybrid-v1` during 2026–2027 for maximum interoperability with receivers that may not yet support ML-DSA verification.
- **Exception — operator-owned deployments:** A robot operator who controls both the issuing node and all verifiers in the deployment MAY use `pqc-v1` at any time, including before 2028. This is appropriate for closed fleets where the operator owns both sides of the trust chain.
- A node advertising `crypto_profile: "pqc-v1"` MUST reject legacy Ed25519-only messages.
- The `ed25519_public_key` field is absent or null when using `pqc-v1`.

---

## Migration Timeline

| Period | Profile | Notes |
|--------|---------|-------|
| 2026 – 2027 | `pqc-hybrid-v1` | Default for interop. Both halves required. Old receivers still verify Ed25519. |
| 2026+ | `pqc-v1` | **Operator-owned/closed deployments only.** ML-DSA-65 only when operator controls all verifiers. |
| 2027 | Ed25519 sunset | SDKs stop signing with Ed25519; `pqc-hybrid-v1` generators may set Ed25519 half to zeros per compat mode. |
| 2028+ | `pqc-v1` | General availability. ML-DSA-65 only. Ed25519 verification code removed. |

---

## Reference Implementations

- **Python:** `dilithium-py` (pure-software, no native deps)
- **TypeScript:** `@noble/post-quantum` (pure-software, no native deps)
