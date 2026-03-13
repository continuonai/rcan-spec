# CLAUDE.md — rcan-spec Development Guide

> **Agent context file.** Read this before making any changes.

## What Is rcan-spec?

The official specification for the RCAN (Robot Communication and Autonomy Network) protocol. Published at **rcan.dev** via Cloudflare Pages. Astro-based static site.

**Current version**: v1.4 | **Repo**: continuonai/rcan-spec | **Branch**: master

## Repository Layout

```
rcan-spec/
├── src/
│   ├── pages/
│   │   ├── spec/
│   │   │   ├── index.astro          # Monolithic spec (all sections inline) — 1042 lines
│   │   │   ├── section-1.astro      # §1 Robot URI (RURI) — dedicated page
│   │   │   ├── section-2.astro      # §2 Role-Based Access Control
│   │   │   ├── ... (§3–§21)
│   │   │   ├── v1.0.astro           # Version snapshot
│   │   │   ├── v1.1.astro
│   │   │   ├── v1.2.astro
│   │   │   ├── v1.3.astro
│   │   │   └── v1.4.astro           # Created for v1.4 release
│   │   ├── conformance/index.astro  # L1–L4 conformance test tables
│   │   ├── implementations/         # Known implementations (OpenCastor, rcan-py, rcan-ts)
│   │   ├── federation/              # Federation protocol docs
│   │   ├── pricing/                 # RRN registration tiers
│   │   ├── about.astro              # About + version timeline
│   │   └── changelog.astro          # Full version changelog
│   ├── layouts/
│   │   ├── BaseLayout.astro         # Site-wide layout (nav, footer)
│   │   └── DocsLayout.astro         # Docs pages layout (sidebar, breadcrumb)
│   └── components/
│       └── CodeWindow.astro         # Syntax-highlighted code block
├── public/
│   └── sdk-status.json             # SDK version badges (auto-updated by CI)
├── tests/
│   └── functions.test.ts           # Vitest unit tests (101 tests)
└── VERSIONING.md                    # How spec versions work
```

## Spec Version Conventions

| Version | What's included | Status |
|---|---|---|
| v1.0 | RURI, RBAC, Message Format, Discovery, Auth | Archive |
| v1.1 | + ConfidenceGate (§7), Ed25519 signing (§9), offline fallback | Archive |
| v1.2 | + AuditChain (§16), HiTL (§8), federation (§12), §17–§20, Appendix B | Archive |
| v1.3 | + §21 Registry Integration, structured URI RRN, L4 conformance | Stable |
| v1.4 | + §1–§16 dedicated section pages (full content, replaces stubs) | **Current** |

## Styling Rules

**Use Tailwind CSS exclusively — NO inline `style=` attributes.**

Custom tokens:
- Backgrounds: `bg-bg`, `bg-bg-card`, `bg-bg-alt`
- Text: `text-text`, `text-text-muted`, `text-text-faint`, `text-accent`
- Borders: `border-border`
- Accent: `text-accent`, `bg-accent/10`, `border-accent/20`

Status badges:
- Stable: `bg-green-500/10 text-green-400 border-green-500/20`
- Draft: `bg-amber-500/10 text-amber-400 border-amber-500/20`
- Latest version: `bg-accent/15 text-accent border-accent/30`

Code blocks: always use `<CodeWindow code={...} language="json|yaml|python" title="..." />`

## Section Page Pattern

All section pages (§1–§21) should follow this structure:
```
---
import DocsLayout from '../../layouts/DocsLayout.astro';
import CodeWindow from '../../components/CodeWindow.astro';
const myCode = `...`;
---
<DocsLayout title="§N Section Title" description="...">
  <div class="max-w-3xl mx-auto">
    <!-- Breadcrumb -->
    <!-- Header with title + status badge + version + back link -->
    <!-- Overview paragraph -->
    <!-- Content sections: tables, code windows, conformance requirements -->
    <!-- Prev/Next navigation -->
  </div>
</DocsLayout>
```

Rich examples: see `section-19.astro`, `section-20.astro`, `section-21.astro`.

## Building & Testing

```bash
npm run build        # Astro build — must produce 55+ pages cleanly
npx vitest run tests/functions.test.ts   # 101 unit tests — all must pass
```

Always run both before committing.

## Key Files to Update When Bumping Spec Version

1. `src/pages/changelog.astro` — add new version entry at top of `versions` array
2. `src/pages/about.astro` — add to versions timeline array
3. `src/pages/spec/index.astro` — update `<DocsLayout title="Specification vX.Y.0">`
4. `src/pages/spec/vX.Y.astro` — create new snapshot page
5. `public/sdk-status.json` — update `spec_version` field and `updated` timestamp
6. `src/pages/implementations/index.astro` — update OpenCastor + rcan-py version badges
7. `src/pages/conformance/index.astro` — update description and badge block if new L-level added

## sdk-status.json

Updated by CI (or manually):
```json
{
  "updated": "2026-03-13T08:00:00Z",
  "spec_version": "1.4",
  "sdks": {
    "rcan-py": { "version": "0.4.0", "status": "pass", "pypi": "..." },
    "rcan-ts": { "version": "0.3.0", "status": "pass", "npm": "..." }
  }
}
```

## Conformance Levels

| Level | Label | Key requirement |
|---|---|---|
| L1 | Core | DISCOVER, STATUS, COMMAND, RURI addressing, JWT auth |
| L2 | Secure | L1 + HiTL gates, Ed25519 signing, AuditChain |
| L3 | Federated | L2 + commitment chain, cross-registry discovery, capability advertisement |
| L4 | Registry | L3 + REGISTRY_REGISTER/RESOLVE roundtrip, RRN validation (both formats) |

Legend in conformance table: ✅ = must succeed | ❌ = must reject (error path IS correct behaviour, ❌ ≠ failing test)

## Push Workflow

Branch: `master` (not `main`). Always:
```bash
git pull --rebase origin master
npm run build       # clean build
npx vitest run tests/functions.test.ts
git add -A && git commit -m "..."
git push origin master
```
