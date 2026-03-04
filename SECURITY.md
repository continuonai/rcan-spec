# Security Policy

## Supported Versions

| Version | Status | Supported Until |
|---------|--------|-----------------|
| v1.2.x (current) | ✅ Active | Until v1.4 released |
| v1.1.x | 🔶 Security fixes only | 2026-12-31 |
| v1.0.x and earlier | ❌ End of life | — |

Security fixes are backported to the current stable version and the previous minor version for a minimum of 12 months.

## Reporting a Vulnerability

**Do not file a public GitHub issue for security vulnerabilities.**

Report privately via one of the following:

- **GitHub Security Advisories** (preferred): [github.com/continuonai/rcan-spec/security/advisories/new](https://github.com/continuonai/rcan-spec/security/advisories/new)
- **Email**: security@continuon.ai — encrypt with PGP if the report contains sensitive detail (public key at rcan.dev/security.asc)

Include in your report:
- Spec version and section affected
- A clear description of the vulnerability
- Steps to reproduce or a proof-of-concept
- Your assessment of impact and exploitability
- Whether you have a proposed fix

## Response Timeline

| Stage | Commitment |
|-------|-----------|
| Acknowledgement | Within 48 hours |
| Triage (severity assessment) | Within 7 days |
| Status update | Every 14 days until resolved |
| Patch for Critical/High | Within 30 days |
| Patch for Medium | Within 90 days |
| Patch for Low/Informational | Next scheduled release |
| CVE coordination | On request for Critical/High |

## Scope

**In scope:**
- Spec ambiguities or contradictions that enable protocol-level security bypasses
- RURI format vulnerabilities (injection, spoofing, traversal)
- Role hierarchy flaws that allow privilege escalation across RCAN levels
- Safety invariant bypasses — any spec language that permits remote commands to override local safety checks
- Registry API vulnerabilities (rcan.dev/registry, /api/v1/)
- §16 AI accountability weaknesses — spec gaps that allow tampered audit records to appear valid
- Cryptographic weaknesses in commitment chain specification

**Out of scope:**
- Implementation vulnerabilities in third-party RCAN implementations (report to those maintainers)
- Physical hardware security (outside RCAN's protocol scope)
- Social engineering
- Denial of service against rcan.dev (report via GitHub issues)

## CVE Process

For Critical and High severity vulnerabilities, we will:
1. Request a CVE from MITRE via GitHub's CVE numbering authority partnership
2. Coordinate embargo with the reporter (typically 90 days maximum)
3. Publish a security advisory and spec errata simultaneously with the patch

## Responsible Disclosure Hall of Fame

We thank the following researchers for responsible disclosure:

*(None yet — be the first.)*

---

This policy follows [coordinated vulnerability disclosure](https://vuls.cert.org/confluence/display/CVD/Executive+Summary) guidelines from CERT/CC and aligns with ISO/IEC 29147 (vulnerability disclosure) and ISO/IEC 30111 (vulnerability handling).
