"""Hybrid-signing producer + verifier for version-tuple envelopes.

Per RCAN v3.2 Decision 3 (pqc-hybrid-v1, PQ-required-classical-optional):
- signature_mldsa65 REQUIRED on every envelope; verifier MUST verify it.
- signature_ed25519 OPTIONAL; if present, MUST verify (no silent acceptance
  of tampered classical halves).
"""
from __future__ import annotations
import argparse
import base64
import datetime as dt
import json
import pathlib
from typing import Optional, Union, Literal
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature
from dilithium_py.ml_dsa import ML_DSA_65

class EnvelopeError(Exception):
    pass

def _canonical(obj: dict) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")

def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode()

def _now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

def sign_envelope(
    payload: dict,
    *,
    ran: str,
    pq_key_path: Optional[pathlib.Path],
    pq_kid: str,
    ed_key_path: Optional[pathlib.Path] = None,
    ed_kid: Optional[str] = None,
) -> dict:
    if pq_key_path is None:
        raise EnvelopeError("pq_key_path required (signature_mldsa65 is mandatory per Decision 3)")
    canon = _canonical(payload)
    pq_priv = pathlib.Path(pq_key_path).read_bytes()
    pq_sig = ML_DSA_65.sign(pq_priv, canon)

    env: dict = {
        "ran": ran,
        "alg": ["ML-DSA-65"],
        "pq_kid": pq_kid,
        "payload": _b64(canon),
        "signature_mldsa65": _b64(pq_sig),
        "signed_at": _now_iso(),
    }
    if ed_key_path is not None:
        if ed_kid is None:
            raise EnvelopeError("ed_kid required when ed_key_path provided")
        ed_priv_pem = pathlib.Path(ed_key_path).read_bytes()
        ed_priv = serialization.load_pem_private_key(ed_priv_pem, password=None)
        if not isinstance(ed_priv, Ed25519PrivateKey):
            raise EnvelopeError("classical key must be Ed25519 PEM")
        ed_sig = ed_priv.sign(canon)
        env["alg"] = ["ML-DSA-65", "Ed25519"]
        env["kid"] = ed_kid
        env["signature_ed25519"] = _b64(ed_sig)
    return env

def verify_signed_envelope(
    env: dict,
    *,
    pq_pub_raw: bytes,
    ed_pub_raw: Optional[bytes] = None,
) -> dict:
    """Verify hybrid envelope. Returns {payload, pq_ok, classic_ok}.

    classic_ok is True | False | "absent". Raises EnvelopeError on PQ failure
    or on tampered classical sig (when classical present).
    """
    canon = base64.b64decode(env["payload"])
    pq_sig = base64.b64decode(env["signature_mldsa65"])
    if not ML_DSA_65.verify(pq_pub_raw, canon, pq_sig):
        raise EnvelopeError("ml-dsa-65 signature failed verification")
    pq_ok = True
    classic_ok: Union[bool, Literal["absent"]] = "absent"
    if "signature_ed25519" in env:
        if ed_pub_raw is None:
            raise EnvelopeError("ed25519 signature present but no classical pub provided to verify")
        ed_pub = Ed25519PublicKey.from_public_bytes(ed_pub_raw)
        ed_sig = base64.b64decode(env["signature_ed25519"])
        try:
            ed_pub.verify(ed_sig, canon)
            classic_ok = True
        except InvalidSignature as e:
            raise EnvelopeError("ed25519 signature failed verification") from e
    return {"payload": json.loads(canon), "pq_ok": pq_ok, "classic_ok": classic_ok}

def _cli():
    p = argparse.ArgumentParser()
    p.add_argument("--payload", type=pathlib.Path, required=True)
    p.add_argument("--ran", required=True)
    p.add_argument("--pq-key", type=pathlib.Path, required=True)
    p.add_argument("--pq-kid", required=True)
    p.add_argument("--ed-key", type=pathlib.Path, default=None)
    p.add_argument("--ed-kid", default=None)
    p.add_argument("--out", type=pathlib.Path, required=True)
    args = p.parse_args()
    payload = json.loads(args.payload.read_text())
    env = sign_envelope(payload, ran=args.ran, pq_key_path=args.pq_key, pq_kid=args.pq_kid,
                        ed_key_path=args.ed_key, ed_kid=args.ed_kid)
    args.out.write_text(json.dumps(env, indent=2))

if __name__ == "__main__":
    _cli()
