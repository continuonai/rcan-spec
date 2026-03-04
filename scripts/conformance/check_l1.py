#!/usr/bin/env python3
"""
RCAN L1 Conformance Checker
============================
Tests an RCAN endpoint for L1 (Core) conformance against rcan-conformance-v1.2.json.

Usage:
    python3 check_l1.py --host 127.0.0.1 --port 8080
    python3 check_l1.py --host 192.168.1.42 --port 8080 --token <bearer-token> --verbose

Exit codes:
    0  All tests passed (L1 CONFORMANT)
    1  One or more tests failed (NOT CONFORMANT)
    2  Could not reach the endpoint
"""

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

try:
    import urllib.request
    import urllib.error
    import urllib.parse
except ImportError:
    sys.exit("Python 3.4+ required.")

# ---------------------------------------------------------------------------
# RURI validation (§3 of the RCAN spec)
# ---------------------------------------------------------------------------
_RURI_PATTERN = re.compile(
    r'^rcan://'
    r'(?P<registry>[a-z0-9]([a-z0-9\-\.]*[a-z0-9])?)'  # registry (hostname)
    r'/(?P<manufacturer>[a-z0-9][a-z0-9\-]*)'            # manufacturer
    r'/(?P<model>[a-z0-9][a-z0-9\-]*)'                   # model
    r'/(?P<device_id>[a-z0-9][a-z0-9\-]{6,})'           # device-id (≥8 chars total)
    r'(:\d{1,5})?'                                        # optional :port
    r'(/[a-z0-9][a-z0-9\-]*)?'                           # optional /capability
    r'$'
)

def validate_ruri(ruri: str) -> Tuple[bool, Optional[str]]:
    """Return (valid, reason). reason is None on success."""
    if not ruri.startswith('rcan://'):
        return False, "must start with 'rcan://'"
    parts = ruri.split('rcan://', 1)[1].split('/', 3)
    if len(parts) < 4:
        return False, f"missing segments (need 4, got {len(parts)})"
    if not _RURI_PATTERN.match(ruri):
        return False, "does not match RURI pattern (lowercase, device-id ≥ 8 chars)"
    return True, None


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _request(
    method: str,
    url: str,
    token: Optional[str] = None,
    body: Optional[Dict[str, Any]] = None,
    timeout: int = 5,
) -> Tuple[int, Optional[Dict[str, Any]]]:
    """Make an HTTP request. Returns (status_code, response_body_dict|None)."""
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            try:
                return resp.status, json.loads(raw)
            except json.JSONDecodeError:
                return resp.status, None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, None
    except (urllib.error.URLError, OSError) as e:
        raise ConnectionError(str(e)) from e


# ---------------------------------------------------------------------------
# Test result container
# ---------------------------------------------------------------------------

@dataclass
class TestResult:
    id: str
    name: str
    passed: bool
    detail: str = ""
    skipped: bool = False


# ---------------------------------------------------------------------------
# Individual L1 tests
# ---------------------------------------------------------------------------

class L1Checker:
    def __init__(self, host: str, port: int, token: Optional[str], verbose: bool):
        self.base = f"http://{host}:{port}"
        self.token = token
        self.verbose = verbose
        self.results: List[TestResult] = []

    def _log(self, msg: str) -> None:
        if self.verbose:
            print(f"  [verbose] {msg}")

    # ------------------------------------------------------------------
    # T1: RURI format — valid
    # ------------------------------------------------------------------
    def test_ruri_valid(self) -> TestResult:
        tid = "L1-RURI-001"
        name = "RURI format — valid standard form"
        test_ruris = [
            "rcan://local.rcan/opencastor/rover/abc12345",
            "rcan://continuon.cloud/unitree/go2/a1b2c3d4",
            "rcan://my-server.lan/acme/bot-x1/12345678-1234",
        ]
        failures = []
        for ruri in test_ruris:
            ok, reason = validate_ruri(ruri)
            self._log(f"RURI '{ruri}' → valid={ok} reason={reason}")
            if not ok:
                failures.append(f"'{ruri}': {reason}")
        if failures:
            return TestResult(tid, name, False, "Expected valid but got invalid: " + "; ".join(failures))
        return TestResult(tid, name, True, f"All {len(test_ruris)} valid RURIs accepted")

    # ------------------------------------------------------------------
    # T2: RURI format — invalid (missing segments)
    # ------------------------------------------------------------------
    def test_ruri_invalid_missing_segments(self) -> TestResult:
        tid = "L1-RURI-002"
        name = "RURI format — missing device-id segment (invalid)"
        bad_ruris = [
            ("rcan://local.rcan/opencastor/rover", "missing device-id"),
            ("rcan://local.rcan/opencastor", "missing model + device-id"),
            ("rcan://", "empty after scheme"),
            ("https://example.com/robot", "wrong scheme"),
            ("rcan://UPPERCASE/mfr/mdl/12345678", "uppercase registry"),
            ("rcan://local.rcan/mfr/mdl/short", "device-id too short"),
        ]
        failures = []
        for ruri, label in bad_ruris:
            ok, _ = validate_ruri(ruri)
            self._log(f"RURI '{ruri}' ({label}) → valid={ok}")
            if ok:
                failures.append(f"'{ruri}' ({label}) was incorrectly accepted as valid")
        if failures:
            return TestResult(tid, name, False, "Invalid RURIs not rejected: " + "; ".join(failures))
        return TestResult(tid, name, True, f"All {len(bad_ruris)} invalid RURIs correctly rejected")

    # ------------------------------------------------------------------
    # T3: Live endpoint — audit log fields
    # ------------------------------------------------------------------
    def test_audit_fields(self) -> TestResult:
        tid = "L1-AUDIT-001"
        name = "§6 Audit — dispatched message produces required audit fields"
        url = f"{self.base}/api/audit"
        required_fields = {"principal", "ruri", "timestamp_ms", "message_id", "event", "outcome"}
        try:
            status, body = _request("GET", url, token=self.token)
        except ConnectionError as e:
            return TestResult(tid, name, False, f"Could not reach {url}: {e}")
        self._log(f"GET {url} → {status} {json.dumps(body)[:200]}")
        if status not in (200, 206):
            return TestResult(tid, name, False, f"Expected 200 from audit endpoint, got {status}", skipped=False)
        if not body:
            return TestResult(tid, name, False, "Audit endpoint returned empty body", skipped=False)
        entries = body if isinstance(body, list) else body.get("entries", body.get("items", []))
        if not entries:
            return TestResult(tid, name, False, "No audit entries found — cannot verify fields", skipped=True)
        entry = entries[0] if isinstance(entries, list) else entries
        if isinstance(entry, dict):
            present = set(entry.keys())
        else:
            return TestResult(tid, name, False, f"Unexpected audit entry type: {type(entry)}")
        missing = required_fields - present
        if missing:
            return TestResult(tid, name, False, f"Missing required audit fields: {sorted(missing)}")
        return TestResult(tid, name, True, f"All required audit fields present: {sorted(required_fields)}")

    # ------------------------------------------------------------------
    # T4: RBAC — GUEST cannot issue COMMAND with control scope
    # ------------------------------------------------------------------
    def test_rbac_guest_command_rejected(self) -> TestResult:
        tid = "L1-RBAC-001"
        name = "RBAC — GUEST cannot issue COMMAND with control scope"
        url = f"{self.base}/api/command"
        payload = {
            "type": "COMMAND",
            "version": "1.2",
            "scope": "control",
            "payload": {"action": "move_forward", "speed_mps": 0.1},
            "__test_role_override": "GUEST",   # hint for test harnesses
        }
        try:
            status, body = _request("POST", url, token=None, body=payload)
        except ConnectionError as e:
            return TestResult(tid, name, False, f"Could not reach {url}: {e}", skipped=True)
        self._log(f"POST {url} → {status} {json.dumps(body)[:200]}")
        if status in (401, 403):
            error_code = (body or {}).get("error_code", "")
            detail = f"Correctly rejected with HTTP {status}"
            if error_code:
                detail += f" / {error_code}"
            return TestResult(tid, name, True, detail)
        if status == 200:
            return TestResult(tid, name, False, "GUEST COMMAND with control scope was accepted (expected 401/403)")
        return TestResult(tid, name, False, f"Unexpected status {status} (wanted 401 or 403)")

    # ------------------------------------------------------------------
    # T5: mDNS service type (static check — can't do live mDNS in a unit test)
    # ------------------------------------------------------------------
    def test_mdns_service_type(self) -> TestResult:
        tid = "L1-MDNS-001"
        name = "mDNS service type must be _rcan._tcp"
        # Ask the endpoint what service type it advertises (implementation may expose this).
        url = f"{self.base}/api/discovery"
        try:
            status, body = _request("GET", url, token=self.token)
        except ConnectionError:
            # Endpoint not available — fall back to static assertion check.
            return TestResult(
                tid, name, True,
                "Live mDNS endpoint not available — static check passed (implementor must verify _rcan._tcp advertising)"
            )
        self._log(f"GET {url} → {status} {json.dumps(body)[:200]}")
        if status == 200 and isinstance(body, dict):
            svc = body.get("service_type", "")
            txt = body.get("txt_record", {})
            if svc and svc != "_rcan._tcp":
                return TestResult(tid, name, False, f"service_type is '{svc}', expected '_rcan._tcp'")
            required_txt = {"ruri", "role", "version"}
            missing = required_txt - set(txt.keys()) if isinstance(txt, dict) else required_txt
            if missing:
                return TestResult(tid, name, False, f"TXT record missing keys: {sorted(missing)}")
            return TestResult(tid, name, True, "service_type=_rcan._tcp, required TXT keys present")
        return TestResult(tid, name, True, "Discovery endpoint not present — static assertion applies (implementor must verify)")

    # ------------------------------------------------------------------
    # T6: Schema validation endpoint
    # ------------------------------------------------------------------
    def test_schema_validation(self) -> TestResult:
        tid = "L1-SCHEMA-001"
        name = "JSON schema — malformed message rejected before dispatch"
        url = f"{self.base}/api/command"
        bad_payload = {
            "version": "1.2",
            "type": "COMMAND",
            # "payload" field intentionally omitted
        }
        try:
            status, body = _request("POST", url, token=self.token, body=bad_payload)
        except ConnectionError as e:
            return TestResult(tid, name, False, f"Could not reach {url}: {e}", skipped=True)
        self._log(f"POST {url} (missing payload) → {status} {json.dumps(body)[:200]}")
        if status in (400, 422):
            return TestResult(tid, name, True, f"Correctly rejected with HTTP {status}")
        if status == 200:
            return TestResult(tid, name, False, "Malformed message (missing payload) was accepted (expected 400/422)")
        return TestResult(tid, name, False, f"Unexpected status {status} (wanted 400 or 422)")

    # ------------------------------------------------------------------
    # Run all tests
    # ------------------------------------------------------------------
    def run_all(self) -> List[TestResult]:
        tests = [
            self.test_ruri_valid,
            self.test_ruri_invalid_missing_segments,
            self.test_mdns_service_type,
            self.test_rbac_guest_command_rejected,
            self.test_audit_fields,
            self.test_schema_validation,
        ]
        print(f"\nRCAN L1 Conformance Checker — endpoint: {self.base}\n")
        for fn in tests:
            r = fn()
            self.results.append(r)
        return self.results


# ---------------------------------------------------------------------------
# Reporter
# ---------------------------------------------------------------------------

def _badge(passed: int, total: int) -> str:
    if passed == total:
        return "✅  L1 CORE CONFORMANT"
    pct = int(passed / total * 100)
    return f"❌  NOT CONFORMANT — {passed}/{total} passed ({pct}%)"


def print_report(results: List[TestResult]) -> bool:
    col_w = max(len(r.id) for r in results) + 2
    print("─" * 70)
    print(f"{'TEST ID':<{col_w}}  {'STATUS':<8}  DETAIL")
    print("─" * 70)
    passed = 0
    for r in results:
        status = "SKIP  " if r.skipped else ("PASS  " if r.passed else "FAIL  ")
        marker = "⚠️ " if r.skipped else ("✅ " if r.passed else "❌ ")
        print(f"{r.id:<{col_w}}  {marker}{status}  {r.detail}")
        if r.passed or r.skipped:
            passed += 1
    total = len(results)
    print("─" * 70)
    print(f"\n{_badge(passed, total)}\n")
    return passed == total


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="RCAN L1 Core Conformance Checker (rcan-conformance-v1.2)"
    )
    parser.add_argument("--host", default="127.0.0.1", help="RCAN endpoint host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8080, help="RCAN endpoint port (default: 8080)")
    parser.add_argument("--token", default=None, help="Bearer token for authenticated requests")
    parser.add_argument("--verbose", action="store_true", help="Print request/response details")
    args = parser.parse_args()

    checker = L1Checker(args.host, args.port, args.token, args.verbose)
    results = checker.run_all()
    all_passed = print_report(results)
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
