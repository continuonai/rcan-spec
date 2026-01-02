# RCAN Protocol Specification

**Robot Communication & Addressing Network**

An open, federated protocol for addressing, discovering, and authenticating robotic agents across local networks and the internet.

## Overview

RCAN provides:

- **Robot URI (RURI)**: Globally unique identifiers for robots
- **Role-Based Access Control**: 5-level hierarchy (Guest → Creator)
- **mDNS Discovery**: Works offline via `_rcan._tcp.local`
- **Federation**: Anyone can run a registry (like email servers)
- **Safety Invariants**: Local safety always wins, graceful degradation

## Quick Start

```python
from rcan import RURI, RCANClient, Role

# Parse a robot's address
ruri = RURI.parse("rcan://continuon.cloud/continuon/companion-v1/d3a4b5c6")

# Connect and authenticate
client = RCANClient(client_id="my-app")
await client.connect(ruri)
await client.claim(Role.USER, credential="my-key")

# Send a command
await client.command("/arm", "move", {"x": 0.5, "y": 0.2})

# Clean up
await client.release()
```

## Documentation

- [Full Specification](https://rcan.dev/spec/)
- [Conformance Tests](https://rcan.dev/conformance/)
- [Reference Implementations](https://rcan.dev/implementations/)

## Development

This is an Astro static site.

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

Deploy to any static hosting:

- **GitHub Pages**: Push to `gh-pages` branch
- **Netlify**: Connect repo, build command `npm run build`, publish `dist/`
- **Vercel**: Connect repo, framework Astro

For custom domain (rcan.dev):
1. Add CNAME file to `public/`
2. Configure DNS A/CNAME records

## License

This specification is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Reference implementations are licensed under MIT.

## Links

- [Blog: We Need an ICANN for Robotics](https://craigmerry.com/blog/2026-01-02-we-need-an-icann-for-robotics/)
- [ContinuonAI](https://continuon.ai)

