import base64
import json
import pathlib
import sys
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization
from dilithium_py.ml_dsa import ML_DSA_65

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from sign_envelope import sign_envelope, verify_signed_envelope, EnvelopeError  # noqa: E402

def _make_ed_key(tmp: pathlib.Path) -> pathlib.Path:
    priv = Ed25519PrivateKey.generate()
    pem = priv.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    p = tmp / "ed.priv.pem"; p.write_bytes(pem); return p

def _make_pq_key(tmp: pathlib.Path) -> tuple[pathlib.Path, bytes]:
    pub, priv = ML_DSA_65.keygen()
    p = tmp / "pq.priv.bin"; p.write_bytes(priv); return p, pub

PAYLOAD = {
    "project": "robot-md", "matrix_version": "1.0", "field": "cli_version",
    "value": "1.5.1", "depends_on": {"protocol_version": ">=3.2.0"},
    "released_at": "2026-05-01T17:42:11Z",
}

def test_hybrid_envelope_carries_both_signatures(tmp_path):
    ed_key = _make_ed_key(tmp_path)
    pq_key, _ = _make_pq_key(tmp_path)
    env = sign_envelope(PAYLOAD, ran="RAN-000000000002", pq_key_path=pq_key, pq_kid="deadbeef",
                        ed_key_path=ed_key, ed_kid="cafebabe")
    assert env["ran"] == "RAN-000000000002"
    assert env["pq_kid"] == "deadbeef"
    assert env["kid"] == "cafebabe"
    assert env["alg"] == ["ML-DSA-65", "Ed25519"]
    assert env["signature_mldsa65"] and env["signature_ed25519"]
    assert "signed_at" in env

def test_pq_only_envelope_when_no_classical_key(tmp_path):
    pq_key, _ = _make_pq_key(tmp_path)
    env = sign_envelope(PAYLOAD, ran="RAN-000000000002", pq_key_path=pq_key, pq_kid="deadbeef")
    assert env["alg"] == ["ML-DSA-65"]
    assert "signature_ed25519" not in env
    assert "kid" not in env
    assert env["signature_mldsa65"]

def test_pq_required_no_pq_raises(tmp_path):
    ed_key = _make_ed_key(tmp_path)
    with pytest.raises(EnvelopeError, match="pq_key_path required"):
        sign_envelope(PAYLOAD, ran="RAN-000000000002", pq_key_path=None, pq_kid="x",
                      ed_key_path=ed_key, ed_kid="y")

def test_canonical_payload_round_trip(tmp_path):
    pq_key, _ = _make_pq_key(tmp_path)
    env = sign_envelope(PAYLOAD, ran="RAN-000000000002", pq_key_path=pq_key, pq_kid="deadbeef")
    decoded = json.loads(base64.b64decode(env["payload"]))
    assert decoded == PAYLOAD

def test_verify_hybrid_round_trip(tmp_path):
    ed_priv = Ed25519PrivateKey.generate()
    ed_pem = ed_priv.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    ed_path = tmp_path / "ed.priv.pem"; ed_path.write_bytes(ed_pem)
    ed_pub_raw = ed_priv.public_key().public_bytes(
        encoding=serialization.Encoding.Raw, format=serialization.PublicFormat.Raw,
    )
    pq_pub, pq_priv = ML_DSA_65.keygen()
    pq_path = tmp_path / "pq.priv.bin"; pq_path.write_bytes(pq_priv)

    env = sign_envelope(PAYLOAD, ran="RAN-000000000002", pq_key_path=pq_path, pq_kid="dead",
                        ed_key_path=ed_path, ed_kid="cafe")
    result = verify_signed_envelope(env, pq_pub_raw=pq_pub, ed_pub_raw=ed_pub_raw)
    assert result["payload"] == PAYLOAD
    assert result["pq_ok"] is True
    assert result["classic_ok"] is True

def test_verify_rejects_tampered_pq_signature(tmp_path):
    pq_pub, pq_priv = ML_DSA_65.keygen()
    pq_path = tmp_path / "pq.priv.bin"; pq_path.write_bytes(pq_priv)
    env = sign_envelope(PAYLOAD, ran="RAN-000000000002", pq_key_path=pq_path, pq_kid="dead")
    sig = bytearray(base64.b64decode(env["signature_mldsa65"])); sig[0] ^= 0xff
    env["signature_mldsa65"] = base64.b64encode(bytes(sig)).decode()
    with pytest.raises(EnvelopeError, match="ml.dsa"):
        verify_signed_envelope(env, pq_pub_raw=pq_pub)

def test_verify_classical_optional_absent_ok(tmp_path):
    pq_pub, pq_priv = ML_DSA_65.keygen()
    pq_path = tmp_path / "pq.priv.bin"; pq_path.write_bytes(pq_priv)
    env = sign_envelope(PAYLOAD, ran="RAN-000000000002", pq_key_path=pq_path, pq_kid="dead")
    result = verify_signed_envelope(env, pq_pub_raw=pq_pub, ed_pub_raw=None)
    assert result["pq_ok"] is True
    assert result["classic_ok"] == "absent"

def test_verify_classical_present_but_invalid_rejected(tmp_path):
    ed_priv = Ed25519PrivateKey.generate()
    ed_pem = ed_priv.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    ed_path = tmp_path / "ed.priv.pem"; ed_path.write_bytes(ed_pem)
    pq_pub, pq_priv = ML_DSA_65.keygen()
    pq_path = tmp_path / "pq.priv.bin"; pq_path.write_bytes(pq_priv)

    env = sign_envelope(PAYLOAD, ran="RAN-000000000002", pq_key_path=pq_path, pq_kid="dead",
                        ed_key_path=ed_path, ed_kid="cafe")
    sig = bytearray(base64.b64decode(env["signature_ed25519"])); sig[0] ^= 0xff
    env["signature_ed25519"] = base64.b64encode(bytes(sig)).decode()
    other = Ed25519PrivateKey.generate().public_key().public_bytes(
        encoding=serialization.Encoding.Raw, format=serialization.PublicFormat.Raw,
    )
    with pytest.raises(EnvelopeError, match="ed25519"):
        verify_signed_envelope(env, pq_pub_raw=pq_pub, ed_pub_raw=other)
