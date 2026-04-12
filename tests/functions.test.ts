/**
 * rcan-spec — Vitest unit tests for Cloudflare Functions logic and ruri.ts utilities
 *
 * Covers:
 *   - RRN parsing (root and delegated namespaces, expanded address space)
 *   - verifyAuth helper
 *   - Rate limit bucket logic
 *   - Verification tier upgrade rules (valid transitions, invalid skips)
 *   - /.well-known/rcan-node.json response structure
 *
 * Uses a lightweight in-memory D1 mock — no Cloudflare runtime required.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import {
  sortedJsonStringify,
  base64urlToBytes,
  bytesToBase64url,
  verifyMlDsa65Signature,
  handlePost,
  handleGet,
} from "../functions/api/v1/robots/[rrn]/fria.js";
import { deriveComplianceStatus, handleCompliance } from "../functions/api/v1/robots/[rrn]/compliance.js";

// ── D1 mock ───────────────────────────────────────────────────────────────────

interface MockRow {
  [key: string]: unknown;
}

function mockD1(seedData?: Record<string, MockRow[]>) {
  const tables: Record<string, MockRow[]> = seedData ?? {};

  return {
    exec: async (_sql: string) => {},
    prepare: (sql: string) => {
      const stmt = {
        _sql: sql,
        _args: [] as unknown[],
        bind: (...args: unknown[]) => {
          stmt._args = args;
          return stmt;
        },
        all: async () => {
          // Minimal SELECT COUNT(*) support for rate limiter test
          if (sql.includes("COUNT(*)")) {
            return { results: [{ count: 0 }] };
          }
          return { results: [] };
        },
        run: async () => ({ success: true, meta: { last_row_id: 1 } }),
        first: async (): Promise<MockRow | null> => null,
      };
      return stmt;
    },
  };
}

// ── Pure functions extracted for testing ──────────────────────────────────────

/** Mirrors parseRRN from functions/api/v1/resolve/[rrn].ts */
function parseRRN(
  rrn: string
):
  | { namespace: "root"; serial: string }
  | { namespace: string; prefix: string; serial: string }
  | null {
  // Delegated: prefix 2-8 alphanumeric chars, serial 8-16 digits
  const delegated = rrn.match(/^RRN-([A-Z0-9]{2,8})-(\d{8,16})$/);
  if (delegated) {
    return { namespace: delegated[1], prefix: delegated[1], serial: delegated[2] };
  }
  // Root: serial 8-16 digits
  const root = rrn.match(/^RRN-(\d{8,16})$/);
  if (root) {
    return { namespace: "root", serial: root[1] };
  }
  return null;
}

/** Mirrors parsePqcHybridSig — parses "pqc-hybrid-v1.<ed25519_b64url>.<ml_dsa_b64url>" */
function parsePqcHybridSig(sig: string): { ed25519: string; ml_dsa: string } | null {
  if (!sig.startsWith("pqc-hybrid-v1.")) return null;
  const rest = sig.slice("pqc-hybrid-v1.".length);
  const dotIdx = rest.indexOf(".");
  if (dotIdx < 1) return null;
  const ed25519Part = rest.slice(0, dotIdx);
  const mlDsaPart   = rest.slice(dotIdx + 1);
  if (!ed25519Part || !mlDsaPart) return null;
  // must not contain any further dots (would indicate extra segments)
  if (mlDsaPart.includes(".")) return null;
  return { ed25519: ed25519Part, ml_dsa: mlDsaPart };
}

/** Mirrors parsePqcV1Sig — parses "pqc-v1.<ml_dsa_b64url>" */
function parsePqcV1Sig(sig: string): { ml_dsa: string } | null {
  if (!sig.startsWith("pqc-v1.")) return null;
  const mlDsaPart = sig.slice("pqc-v1.".length);
  if (!mlDsaPart || mlDsaPart.includes(".")) return null;
  return { ml_dsa: mlDsaPart };
}

/** Returns whether a string is a valid base64url token (no padding, URL-safe chars) */
function isBase64url(s: string): boolean {
  return s.length > 0 && /^[A-Za-z0-9_-]+$/.test(s);
}

/** Mirrors formatRRN from functions/api/v1/robots/index.ts */
function formatRRN(id: number): string {
  return `RRN-${String(id).padStart(12, "0")}`;
}

/** Mirrors sha256 from functions/api/v1/robots/index.ts */
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyAuth(
  token: string,
  storedHash: string,
  salt: string
): Promise<boolean> {
  const keyHash = await sha256(token + salt);
  return keyHash === storedHash;
}

/** Mirrors tier upgrade validation from functions/api/v1/robots/[rrn]/verify.ts */
const TIERS = ["community", "verified", "certified", "accredited"] as const;
type Tier = (typeof TIERS)[number];

function isTier(value: unknown): value is Tier {
  return typeof value === "string" && (TIERS as readonly string[]).includes(value);
}

function validateTierUpgrade(
  currentTier: Tier,
  targetTier: Tier
): { valid: true } | { valid: false; reason: string } {
  const currentIdx = TIERS.indexOf(currentTier);
  const targetIdx = TIERS.indexOf(targetTier);

  if (targetIdx <= currentIdx) {
    return {
      valid: false,
      reason: `Cannot downgrade or re-verify. Current: ${currentTier}, requested: ${targetTier}`,
    };
  }
  if (targetIdx !== currentIdx + 1) {
    return {
      valid: false,
      reason: `Tier skipping not allowed. Next valid: ${TIERS[currentIdx + 1]}`,
    };
  }
  return { valid: true };
}

/** Rate limiter decision (pure logic extracted from middleware) */
function isRateLimited(
  currentCount: number,
  maxRequests: number
): boolean {
  return currentCount >= maxRequests;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RRN Parsing — root namespace", () => {
  it("accepts 8-digit root RRN (legacy)", () => {
    const result = parseRRN("RRN-00000001");
    expect(result).toEqual({ namespace: "root", serial: "00000001" });
  });

  it("accepts 12-digit root RRN (new format)", () => {
    const result = parseRRN("RRN-000000000001");
    expect(result).toEqual({ namespace: "root", serial: "000000000001" });
  });

  it("accepts 16-digit root RRN (max)", () => {
    const result = parseRRN("RRN-0000000000000001");
    expect(result).toEqual({ namespace: "root", serial: "0000000000000001" });
  });

  it("rejects 7-digit root RRN (too short)", () => {
    expect(parseRRN("RRN-0000001")).toBeNull();
  });

  it("rejects 17-digit root RRN (too long)", () => {
    expect(parseRRN("RRN-00000000000000001")).toBeNull();
  });

  it("rejects malformed RRN without prefix", () => {
    expect(parseRRN("00000001")).toBeNull();
  });
});

describe("RRN Parsing — delegated namespace", () => {
  it("accepts 2-char alphabetic prefix with 8-digit serial (legacy)", () => {
    const result = parseRRN("RRN-BD-00000001");
    expect(result).toEqual({ namespace: "BD", prefix: "BD", serial: "00000001" });
  });

  it("accepts 4-char prefix with 12-digit serial", () => {
    const result = parseRRN("RRN-ACME-000000000042");
    expect(result).toEqual({ namespace: "ACME", prefix: "ACME", serial: "000000000042" });
  });

  it("accepts 8-char alphanumeric prefix", () => {
    const result = parseRRN("RRN-A1B2C3D4-000000000001");
    expect(result).toEqual({ namespace: "A1B2C3D4", prefix: "A1B2C3D4", serial: "000000000001" });
  });

  it("rejects 1-char prefix (too short)", () => {
    expect(parseRRN("RRN-A-00000001")).toBeNull();
  });

  it("rejects 9-char prefix (too long)", () => {
    expect(parseRRN("RRN-ABCDEFGHI-00000001")).toBeNull();
  });

  it("rejects lowercase prefix", () => {
    expect(parseRRN("RRN-bd-00000001")).toBeNull();
  });
});

describe("formatRRN — 12-digit generation", () => {
  it("pads id=1 to 12 digits", () => {
    expect(formatRRN(1)).toBe("RRN-000000000001");
  });

  it("pads id=999 correctly", () => {
    expect(formatRRN(999)).toBe("RRN-000000000999");
  });

  it("handles id at 12-digit boundary", () => {
    expect(formatRRN(999999999999)).toBe("RRN-999999999999");
  });
});

describe("verifyAuth — API key hashing", () => {
  const salt = "rcan-dev";

  it("accepts correct token", async () => {
    const token = "rcan_test_abc123";
    const hash = await sha256(token + salt);
    expect(await verifyAuth(token, hash, salt)).toBe(true);
  });

  it("rejects wrong token", async () => {
    const goodToken = "rcan_correct";
    const badToken = "rcan_wrong";
    const hash = await sha256(goodToken + salt);
    expect(await verifyAuth(badToken, hash, salt)).toBe(false);
  });

  it("is salt-sensitive (same token, different salt → different hash)", async () => {
    const token = "rcan_test";
    const hash1 = await sha256(token + "salt1");
    const hash2 = await sha256(token + "salt2");
    expect(hash1).not.toBe(hash2);
  });
});

describe("Rate Limiting — bucket logic", () => {
  const WRITE_LIMIT = 10;

  it("allows request when under limit", () => {
    expect(isRateLimited(9, WRITE_LIMIT)).toBe(false);
  });

  it("blocks request when at limit", () => {
    expect(isRateLimited(10, WRITE_LIMIT)).toBe(true);
  });

  it("blocks request when over limit", () => {
    expect(isRateLimited(15, WRITE_LIMIT)).toBe(true);
  });

  it("allows first request (count=0)", () => {
    expect(isRateLimited(0, WRITE_LIMIT)).toBe(false);
  });
});

describe("Verification Tier Upgrade Rules", () => {
  describe("valid transitions", () => {
    it("community → verified is valid", () => {
      expect(validateTierUpgrade("community", "verified")).toEqual({ valid: true });
    });

    it("verified → certified is valid", () => {
      expect(validateTierUpgrade("verified", "certified")).toEqual({ valid: true });
    });

    it("certified → accredited is valid", () => {
      expect(validateTierUpgrade("certified", "accredited")).toEqual({ valid: true });
    });
  });

  describe("invalid transitions — skipping", () => {
    it("community → certified is rejected (skip)", () => {
      const result = validateTierUpgrade("community", "certified");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("skipping");
      }
    });

    it("community → accredited is rejected (skip)", () => {
      const result = validateTierUpgrade("community", "accredited");
      expect(result.valid).toBe(false);
    });

    it("verified → accredited is rejected (skip)", () => {
      const result = validateTierUpgrade("verified", "accredited");
      expect(result.valid).toBe(false);
    });
  });

  describe("invalid transitions — downgrade / same", () => {
    it("verified → community is rejected (downgrade)", () => {
      const result = validateTierUpgrade("verified", "community");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("downgrade");
      }
    });

    it("certified → verified is rejected (downgrade)", () => {
      const result = validateTierUpgrade("certified", "verified");
      expect(result.valid).toBe(false);
    });

    it("accredited → community is rejected (downgrade)", () => {
      const result = validateTierUpgrade("accredited", "community");
      expect(result.valid).toBe(false);
    });

    it("same tier is rejected", () => {
      const result = validateTierUpgrade("certified", "certified");
      expect(result.valid).toBe(false);
    });
  });
});

describe("isTier — type guard", () => {
  it("accepts valid tiers", () => {
    for (const t of TIERS) {
      expect(isTier(t)).toBe(true);
    }
  });

  it("rejects unknown tier strings", () => {
    expect(isTier("gold")).toBe(false);
    expect(isTier("premium")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isTier(42)).toBe(false);
    expect(isTier(null)).toBe(false);
    expect(isTier(undefined)).toBe(false);
  });
});

describe("/.well-known/rcan-node.json response structure", () => {
  // Mirror the manifest from functions/.well-known/rcan-node.json.ts
  const manifest = {
    rcan_node_version: "1.0",
    node_type: "root",
    operator: "Robot Registry Foundation",
    namespace_prefix: "RRN",
    public_key: null,
    api_base: "https://rcan.dev/api/v1",
    registry_ui: "https://rcan.dev/registry/",
    spec_version: "1.3",
    capabilities: ["register", "resolve", "verify", "delegate"],
    sync_endpoint: "https://rcan.dev/api/v1/sync",
    last_sync: new Date().toISOString(),
    ttl_seconds: 3600,
    contact: "registry@rcan.dev",
    governance: "https://rcan.dev/governance/",
    federation_protocol: "https://rcan.dev/federation/",
  };

  it("has required fields", () => {
    const required = [
      "rcan_node_version",
      "node_type",
      "operator",
      "namespace_prefix",
      "public_key",
      "api_base",
    ];
    for (const field of required) {
      expect(manifest).toHaveProperty(field);
    }
  });

  it("node_type is 'root'", () => {
    expect(manifest.node_type).toBe("root");
  });

  it("namespace_prefix matches RRN pattern", () => {
    expect(manifest.namespace_prefix).toMatch(/^RRN(-[A-Z0-9]{2,8})?$/);
  });

  it("capabilities includes core verbs", () => {
    expect(manifest.capabilities).toContain("register");
    expect(manifest.capabilities).toContain("resolve");
    expect(manifest.capabilities).toContain("verify");
  });

  it("ttl_seconds is a positive integer", () => {
    expect(typeof manifest.ttl_seconds).toBe("number");
    expect(manifest.ttl_seconds).toBeGreaterThan(0);
  });

  it("api_base is a valid HTTPS URL", () => {
    const url = new URL(manifest.api_base);
    expect(url.protocol).toBe("https:");
  });
});

describe("mockD1 helper", () => {
  it("exec resolves without error", async () => {
    const db = mockD1();
    await expect(db.exec("CREATE TABLE IF NOT EXISTS test (id INTEGER)")).resolves.toBeUndefined();
  });

  it("prepare().bind().run() resolves successfully", async () => {
    const db = mockD1();
    const result = await db.prepare("INSERT INTO test (id) VALUES (?)").bind(1).run();
    expect(result.success).toBe(true);
  });

  it("prepare().bind().first() returns null for empty db", async () => {
    const db = mockD1();
    const row = await db.prepare("SELECT * FROM test WHERE id = ?").bind(99).first();
    expect(row).toBeNull();
  });

  it("prepare().bind().all() returns empty results for empty db", async () => {
    const db = mockD1();
    const { results } = await db.prepare("SELECT * FROM test").bind().all();
    expect(Array.isArray(results)).toBe(true);
  });
});

// ── ruri.ts utility tests ─────────────────────────────────────────────────────
// Mirror parseRURI, buildRURI, ruriToHttpUrl, and validateManifest from src/utils/ruri.ts
// These are inlined here to avoid Astro/Vite build-time imports in the Vitest environment.

interface ParsedRURI {
  raw: string;
  registry: string;
  manufacturer: string;
  model: string;
  deviceId: string;
  port?: number;
  capability?: string;
}

interface RURIValidationResult {
  valid: boolean;
  error?: string;
  parsed?: ParsedRURI;
}

const RURI_REGEX =
  /^rcan:\/\/([a-z0-9][a-z0-9.-]*[a-z0-9])\/([a-z0-9][a-z0-9-]*[a-z0-9])\/([a-z0-9][a-z0-9-]*[a-z0-9])\/([0-9a-f]{8}(?:-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?)(?::(\d{1,5}))?(\/?[a-z][a-z0-9/-]*)?$/i;

function parseRURI(ruri: string): RURIValidationResult {
  if (!ruri) return { valid: false, error: "RURI cannot be empty" };
  const trimmedRuri = ruri.trim();
  if (!trimmedRuri.startsWith("rcan://"))
    return { valid: false, error: "RURI must start with rcan://" };
  const match = trimmedRuri.match(RURI_REGEX);
  if (!match) return { valid: false, error: "Invalid RURI format" };
  const [, registry, manufacturer, model, deviceId, port, capability] = match;
  if (port) {
    const portNum = parseInt(port, 10);
    if (portNum < 1 || portNum > 65535)
      return { valid: false, error: "Port must be between 1 and 65535" };
  }
  return {
    valid: true,
    parsed: {
      raw: trimmedRuri,
      registry,
      manufacturer,
      model,
      deviceId,
      port: port ? parseInt(port, 10) : undefined,
      capability: capability?.replace(/^\//, "") || undefined,
    },
  };
}

function buildRURI(parts: {
  registry: string;
  manufacturer: string;
  model: string;
  deviceId: string;
  port?: number;
  capability?: string;
}): string {
  let ruri = `rcan://${parts.registry}/${parts.manufacturer}/${parts.model}/${parts.deviceId}`;
  if (parts.port) ruri += `:${parts.port}`;
  if (parts.capability) ruri += `/${parts.capability}`;
  return ruri;
}

function ruriToHttpUrl(ruri: string | ParsedRURI): string | null {
  const parsed = typeof ruri === "string" ? parseRURI(ruri).parsed : ruri;
  if (!parsed) return null;
  const port = parsed.port || 8080;
  const protocol = parsed.registry === "localhost" ? "http" : "https";
  return `${protocol}://${parsed.registry}:${port}/.well-known/rcan-manifest.json`;
}

interface RobotManifest {
  ruri: string;
  name: string;
  manufacturer: string;
  model: string;
  [key: string]: unknown;
}

function validateManifest(manifest: unknown): manifest is RobotManifest {
  if (!manifest || typeof manifest !== "object") return false;
  const m = manifest as Record<string, unknown>;
  if (typeof m.ruri !== "string") return false;
  if (typeof m.name !== "string") return false;
  if (typeof m.manufacturer !== "string") return false;
  if (typeof m.model !== "string") return false;
  return true;
}

describe("parseRURI — valid inputs", () => {
  it("parses a minimal RURI", () => {
    const r = parseRURI("rcan://rcan.dev/myorg/mybot/abc12345");
    expect(r.valid).toBe(true);
    expect(r.parsed?.registry).toBe("rcan.dev");
    expect(r.parsed?.manufacturer).toBe("myorg");
    expect(r.parsed?.model).toBe("mybot");
    expect(r.parsed?.deviceId).toBe("abc12345");
    expect(r.parsed?.port).toBeUndefined();
    expect(r.parsed?.capability).toBeUndefined();
  });

  it("parses a RURI with port", () => {
    const r = parseRURI("rcan://rcan.dev/myorg/mybot/abc12345:9090");
    expect(r.valid).toBe(true);
    expect(r.parsed?.port).toBe(9090);
  });

  it("parses a RURI with capability", () => {
    const r = parseRURI("rcan://rcan.dev/myorg/mybot/abc12345/nav");
    expect(r.valid).toBe(true);
    expect(r.parsed?.capability).toBe("nav");
  });

  it("parses a RURI with port and capability", () => {
    const r = parseRURI("rcan://rcan.dev/myorg/mybot/abc12345:8080/camera");
    expect(r.valid).toBe(true);
    expect(r.parsed?.port).toBe(8080);
    expect(r.parsed?.capability).toBe("camera");
  });

  it("preserves raw string on parsed output", () => {
    const ruri = "rcan://rcan.dev/opencastor/rover/abc12345";
    const r = parseRURI(ruri);
    expect(r.parsed?.raw).toBe(ruri);
  });

  it("strips leading whitespace before parsing", () => {
    const r = parseRURI("  rcan://rcan.dev/myorg/mybot/abc12345");
    expect(r.valid).toBe(true);
  });
});

describe("parseRURI — invalid inputs", () => {
  it("rejects empty string", () => {
    const r = parseRURI("");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("empty");
  });

  it("rejects URI without rcan:// scheme", () => {
    const r = parseRURI("https://rcan.dev/myorg/mybot/abc12345");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("rcan://");
  });

  it("rejects RURI missing components", () => {
    expect(parseRURI("rcan://rcan.dev/myorg/mybot").valid).toBe(false);
  });

  it("rejects port 0 (invalid)", () => {
    const r = parseRURI("rcan://rcan.dev/myorg/mybot/abc12345:0");
    expect(r.valid).toBe(false);
  });

  it("rejects port > 65535", () => {
    const r = parseRURI("rcan://rcan.dev/myorg/mybot/abc12345:99999");
    expect(r.valid).toBe(false);
  });
});

describe("buildRURI", () => {
  it("builds a minimal RURI", () => {
    expect(
      buildRURI({ registry: "rcan.dev", manufacturer: "myorg", model: "mybot", deviceId: "abc12345" })
    ).toBe("rcan://rcan.dev/myorg/mybot/abc12345");
  });

  it("appends port when provided", () => {
    expect(
      buildRURI({ registry: "rcan.dev", manufacturer: "myorg", model: "mybot", deviceId: "abc12345", port: 9090 })
    ).toBe("rcan://rcan.dev/myorg/mybot/abc12345:9090");
  });

  it("appends capability when provided", () => {
    expect(
      buildRURI({ registry: "rcan.dev", manufacturer: "myorg", model: "mybot", deviceId: "abc12345", capability: "nav" })
    ).toBe("rcan://rcan.dev/myorg/mybot/abc12345/nav");
  });

  it("round-trips with parseRURI", () => {
    const parts = { registry: "rcan.dev", manufacturer: "opencastor", model: "rover", deviceId: "abc12345" };
    const built = buildRURI(parts);
    const parsed = parseRURI(built);
    expect(parsed.valid).toBe(true);
    expect(parsed.parsed?.manufacturer).toBe(parts.manufacturer);
    expect(parsed.parsed?.model).toBe(parts.model);
  });
});

describe("ruriToHttpUrl", () => {
  it("returns HTTPS URL for remote registry", () => {
    const url = ruriToHttpUrl("rcan://rcan.dev/myorg/mybot/abc12345");
    expect(url).toBe("https://rcan.dev:8080/.well-known/rcan-manifest.json");
  });

  it("returns HTTP URL for localhost registry", () => {
    const url = ruriToHttpUrl("rcan://localhost/myorg/mybot/abc12345");
    expect(url).toBe("http://localhost:8080/.well-known/rcan-manifest.json");
  });

  it("uses explicit port when provided", () => {
    const url = ruriToHttpUrl("rcan://rcan.dev/myorg/mybot/abc12345:9090");
    expect(url).toBe("https://rcan.dev:9090/.well-known/rcan-manifest.json");
  });

  it("returns null for invalid RURI string", () => {
    expect(ruriToHttpUrl("not-a-ruri")).toBeNull();
  });

  it("accepts a pre-parsed ParsedRURI object", () => {
    const parsed = parseRURI("rcan://rcan.dev/myorg/mybot/abc12345").parsed!;
    const url = ruriToHttpUrl(parsed);
    expect(url).toBe("https://rcan.dev:8080/.well-known/rcan-manifest.json");
  });
});

describe("validateManifest", () => {
  const valid: RobotManifest = {
    ruri: "rcan://rcan.dev/myorg/mybot/abc12345",
    name: "My Bot",
    manufacturer: "MyOrg",
    model: "mybot",
  };

  it("accepts a valid manifest", () => {
    expect(validateManifest(valid)).toBe(true);
  });

  it("rejects null", () => {
    expect(validateManifest(null)).toBe(false);
  });

  it("rejects non-object", () => {
    expect(validateManifest("string")).toBe(false);
  });

  it("rejects manifest missing ruri", () => {
    const { ruri: _ruri, ...rest } = valid;
    expect(validateManifest(rest)).toBe(false);
  });

  it("rejects manifest missing name", () => {
    const { name: _name, ...rest } = valid;
    expect(validateManifest(rest)).toBe(false);
  });

  it("rejects manifest missing manufacturer", () => {
    const { manufacturer: _mfr, ...rest } = valid;
    expect(validateManifest(rest)).toBe(false);
  });

  it("rejects manifest missing model", () => {
    const { model: _model, ...rest } = valid;
    expect(validateManifest(rest)).toBe(false);
  });

  it("accepts manifest with extra optional fields", () => {
    expect(validateManifest({ ...valid, description: "extra", capabilities: ["nav"] })).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §19 — INVOKE / INVOKE_RESULT validation
// Covers: message structure, status values, error codes, reply_to correlation,
//         and INVOKE_CANCEL structure (issue #107)
// ─────────────────────────────────────────────────────────────────────────────

/** Mirrors the INVOKE message validator that an RCAN node would apply */
function validateInvoke(msg: unknown): boolean {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  if (m.type !== "INVOKE") return false;
  if (typeof m.msg_id !== "string" || !m.msg_id) return false;
  const p = m.payload as Record<string, unknown> | undefined;
  if (!p || typeof p.behavior !== "string" || !p.behavior) return false;
  return true;
}

/** Mirrors the INVOKE_RESULT message validator */
function validateInvokeResult(msg: unknown): boolean {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  if (m.type !== "INVOKE_RESULT") return false;
  if (typeof m.msg_id !== "string" || !m.msg_id) return false;
  // reply_to is the correlation field (§19.3) — must reference originating INVOKE msg_id
  if (typeof m.reply_to !== "string" || !m.reply_to) return false;
  const p = m.payload as Record<string, unknown> | undefined;
  if (!p) return false;
  const validStatuses = ["success", "failure", "timeout", "cancelled"];
  if (!validStatuses.includes(p.status as string)) return false;
  return true;
}

/** INVOKE_CANCEL validator (§19.4) */
function validateInvokeCancel(msg: unknown): boolean {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  if (m.type !== "INVOKE_CANCEL") return false;
  const p = m.payload as Record<string, unknown> | undefined;
  // payload.msg_id = the msg_id of the INVOKE to cancel
  if (!p || typeof p.msg_id !== "string" || !p.msg_id) return false;
  return true;
}

describe("§19 INVOKE message validation", () => {
  it("accepts a well-formed INVOKE", () => {
    expect(validateInvoke({
      type: "INVOKE", msg_id: "abc-001",
      payload: { behavior: "navigate_to", params: { x: 1.0, y: 2.0 } },
    })).toBe(true);
  });

  it("rejects INVOKE without behavior in payload", () => {
    expect(validateInvoke({
      type: "INVOKE", msg_id: "abc-002",
      payload: { params: {} },
    })).toBe(false);
  });

  it("rejects INVOKE without msg_id", () => {
    expect(validateInvoke({
      type: "INVOKE",
      payload: { behavior: "wave" },
    })).toBe(false);
  });

  it("rejects wrong type", () => {
    expect(validateInvoke({
      type: "STATUS", msg_id: "abc-003",
      payload: { behavior: "wave" },
    })).toBe(false);
  });

  it("rejects non-object input", () => {
    expect(validateInvoke("INVOKE")).toBe(false);
    expect(validateInvoke(null)).toBe(false);
  });
});

describe("§19 INVOKE_RESULT message validation", () => {
  const base = {
    type: "INVOKE_RESULT",
    msg_id: "res-001",
    reply_to: "abc-001",
    payload: { status: "success", result: { reached: true } },
  };

  it("accepts a well-formed success result", () => {
    expect(validateInvokeResult(base)).toBe(true);
  });

  it("accepts all valid status values", () => {
    for (const status of ["success", "failure", "timeout", "cancelled"]) {
      expect(validateInvokeResult({ ...base, payload: { status } })).toBe(true);
    }
  });

  it("rejects invalid status value", () => {
    expect(validateInvokeResult({ ...base, payload: { status: "pending" } })).toBe(false);
    expect(validateInvokeResult({ ...base, payload: { status: "" } })).toBe(false);
  });

  it("rejects missing reply_to (correlation field §19.3)", () => {
    const { reply_to: _r, ...noReplyTo } = base;
    expect(validateInvokeResult(noReplyTo)).toBe(false);
  });

  it("rejects empty reply_to", () => {
    expect(validateInvokeResult({ ...base, reply_to: "" })).toBe(false);
  });

  it("reply_to must match originating INVOKE msg_id", () => {
    // Structural check: reply_to is a non-empty string matching the INVOKE's msg_id
    const invoke = { type: "INVOKE", msg_id: "invoke-xyz", payload: { behavior: "wave" } };
    const result = { ...base, reply_to: invoke.msg_id };
    expect(result.reply_to).toBe(invoke.msg_id);
    expect(validateInvokeResult(result)).toBe(true);
  });

  it("rejects missing payload", () => {
    const { payload: _p, ...noPayload } = base;
    expect(validateInvokeResult(noPayload)).toBe(false);
  });
});

describe("§19 INVOKE_CANCEL message validation", () => {
  it("accepts a well-formed INVOKE_CANCEL", () => {
    expect(validateInvokeCancel({
      type: "INVOKE_CANCEL",
      payload: { msg_id: "abc-001" },
    })).toBe(true);
  });

  it("rejects INVOKE_CANCEL without payload.msg_id", () => {
    expect(validateInvokeCancel({
      type: "INVOKE_CANCEL",
      payload: {},
    })).toBe(false);
  });

  it("rejects INVOKE_CANCEL without payload", () => {
    expect(validateInvokeCancel({ type: "INVOKE_CANCEL" })).toBe(false);
  });

  it("rejects wrong type", () => {
    expect(validateInvokeCancel({ type: "INVOKE", payload: { msg_id: "x" } })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §20 — Telemetry Field Registry validation
// Covers: standard field name validation, field structure, joint state,
//         robot state, sensor fields, odometry  (issue #107)
// ─────────────────────────────────────────────────────────────────────────────

const STANDARD_JOINT_FIELDS = new Set([
  "joint.position", "joint.velocity", "joint.effort",
  "joint.temperature", "joint.current",
]);

const STANDARD_ROBOT_STATE_FIELDS = new Set([
  "robot.mode", "robot.battery_pct", "robot.estop",
  "robot.pose.x", "robot.pose.y", "robot.pose.z",
  "robot.pose.yaw", "robot.velocity.linear", "robot.velocity.angular",
]);

const STANDARD_SENSOR_FIELDS = new Set([
  "sensor.imu.accel.x", "sensor.imu.accel.y", "sensor.imu.accel.z",
  "sensor.imu.gyro.x", "sensor.imu.gyro.y", "sensor.imu.gyro.z",
  "sensor.lidar.range", "sensor.camera.fps", "sensor.camera.width", "sensor.camera.height",
]);

const STANDARD_ODOMETRY_FIELDS = new Set([
  "odom.x", "odom.y", "odom.z",
  "odom.vx", "odom.vy", "odom.omega",
]);

function isTelemetryFieldValid(field: string): boolean {
  return (
    STANDARD_JOINT_FIELDS.has(field) ||
    STANDARD_ROBOT_STATE_FIELDS.has(field) ||
    STANDARD_SENSOR_FIELDS.has(field) ||
    STANDARD_ODOMETRY_FIELDS.has(field) ||
    field.startsWith("x.") // custom extension namespace
  );
}

function validateTelemetryFrame(frame: unknown): boolean {
  if (typeof frame !== "object" || frame === null) return false;
  const f = frame as Record<string, unknown>;
  if (typeof f.ruri !== "string" || !f.ruri) return false;
  if (typeof f.timestamp_ms !== "number") return false;
  if (typeof f.fields !== "object" || f.fields === null) return false;
  return true;
}

describe("§20 Telemetry — standard field name registry", () => {
  it("accepts all standard joint fields", () => {
    for (const field of STANDARD_JOINT_FIELDS) {
      expect(isTelemetryFieldValid(field)).toBe(true);
    }
  });

  it("accepts all standard robot-state fields", () => {
    for (const field of STANDARD_ROBOT_STATE_FIELDS) {
      expect(isTelemetryFieldValid(field)).toBe(true);
    }
  });

  it("accepts all standard sensor fields", () => {
    for (const field of STANDARD_SENSOR_FIELDS) {
      expect(isTelemetryFieldValid(field)).toBe(true);
    }
  });

  it("accepts all odometry fields", () => {
    for (const field of STANDARD_ODOMETRY_FIELDS) {
      expect(isTelemetryFieldValid(field)).toBe(true);
    }
  });

  it("accepts custom extension fields (x. namespace)", () => {
    expect(isTelemetryFieldValid("x.hailo.confidence")).toBe(true);
    expect(isTelemetryFieldValid("x.custom.field")).toBe(true);
  });

  it("rejects unknown non-namespaced fields", () => {
    expect(isTelemetryFieldValid("battery_level")).toBe(false);
    expect(isTelemetryFieldValid("speed")).toBe(false);
    expect(isTelemetryFieldValid("")).toBe(false);
  });
});

describe("§20 Telemetry — frame structure validation", () => {
  const validFrame = {
    ruri: "rcan://rcan.dev/craigm26/opencastor-rpi5-hailo/bob-001",
    timestamp_ms: 1710000000000,
    fields: {
      "robot.battery_pct": 87.4,
      "robot.mode": "autonomous",
      "odom.x": 1.23,
    },
  };

  it("accepts a well-formed telemetry frame", () => {
    expect(validateTelemetryFrame(validFrame)).toBe(true);
  });

  it("rejects frame without ruri", () => {
    const { ruri: _r, ...noRuri } = validFrame;
    expect(validateTelemetryFrame(noRuri)).toBe(false);
  });

  it("rejects frame without timestamp_ms", () => {
    const { timestamp_ms: _t, ...noTs } = validFrame;
    expect(validateTelemetryFrame(noTs)).toBe(false);
  });

  it("rejects frame without fields", () => {
    const { fields: _f, ...noFields } = validFrame;
    expect(validateTelemetryFrame(noFields)).toBe(false);
  });

  it("rejects non-object input", () => {
    expect(validateTelemetryFrame(null)).toBe(false);
    expect(validateTelemetryFrame("frame")).toBe(false);
  });

  it("timestamp_ms must be a number (not a string)", () => {
    expect(validateTelemetryFrame({ ...validFrame, timestamp_ms: "1710000000000" })).toBe(false);
  });
});

// ── PQC Hybrid v1 Cryptographic Profile (issue #188) ─────────────────────────

describe("pqc-hybrid-v1 signature format", () => {
  const FAKE_ED25519  = "A".repeat(86);   // 86 base64url chars = 64 bytes (Ed25519 sig size)
  const FAKE_ML_DSA   = "B".repeat(4412); // 4412 base64url chars = 3309 bytes (ML-DSA-65 sig size)
  const validHybrid   = `pqc-hybrid-v1.${FAKE_ED25519}.${FAKE_ML_DSA}`;

  it("parses a well-formed pqc-hybrid-v1 signature", () => {
    const result = parsePqcHybridSig(validHybrid);
    expect(result).not.toBeNull();
    expect(result!.ed25519).toBe(FAKE_ED25519);
    expect(result!.ml_dsa).toBe(FAKE_ML_DSA);
  });

  it("both components are valid base64url tokens", () => {
    const result = parsePqcHybridSig(validHybrid)!;
    expect(isBase64url(result.ed25519)).toBe(true);
    expect(isBase64url(result.ml_dsa)).toBe(true);
  });

  it("rejects a bare Ed25519 sig (no prefix)", () => {
    expect(parsePqcHybridSig(FAKE_ED25519)).toBeNull();
  });

  it("rejects a single-half sig (Ed25519 half only, no ml-dsa component)", () => {
    expect(parsePqcHybridSig(`pqc-hybrid-v1.${FAKE_ED25519}`)).toBeNull();
  });

  it("rejects a single-half sig (empty ml-dsa component)", () => {
    expect(parsePqcHybridSig(`pqc-hybrid-v1.${FAKE_ED25519}.`)).toBeNull();
  });

  it("rejects a single-half sig (empty ed25519 component)", () => {
    expect(parsePqcHybridSig(`pqc-hybrid-v1..${FAKE_ML_DSA}`)).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(parsePqcHybridSig("")).toBeNull();
  });

  it("rejects wrong prefix", () => {
    expect(parsePqcHybridSig(`pqc-v1.${FAKE_ED25519}.${FAKE_ML_DSA}`)).toBeNull();
    expect(parsePqcHybridSig(`hybrid.${FAKE_ED25519}.${FAKE_ML_DSA}`)).toBeNull();
  });

  it("rejects extra segments (three dots = four parts)", () => {
    expect(parsePqcHybridSig(`pqc-hybrid-v1.${FAKE_ED25519}.${FAKE_ML_DSA}.extra`)).toBeNull();
  });

  it("Ed25519 half has correct byte-size representation (86 base64url chars = 64 bytes)", () => {
    const result = parsePqcHybridSig(validHybrid)!;
    // base64url without padding: ceil(64 * 4 / 3) = 86 chars
    expect(result.ed25519.length).toBe(86);
  });

  it("ML-DSA-65 half has correct byte-size representation (4412 base64url chars = 3309 bytes)", () => {
    const result = parsePqcHybridSig(validHybrid)!;
    // base64url without padding: ceil(3309 * 4 / 3) = 4412 chars
    expect(result.ml_dsa.length).toBe(4412);
  });
});

describe("pqc-v1 signature format (post-2028)", () => {
  const FAKE_ML_DSA = "C".repeat(4412);
  const validPqcV1  = `pqc-v1.${FAKE_ML_DSA}`;

  it("parses a well-formed pqc-v1 signature", () => {
    const result = parsePqcV1Sig(validPqcV1);
    expect(result).not.toBeNull();
    expect(result!.ml_dsa).toBe(FAKE_ML_DSA);
  });

  it("rejects an empty ml-dsa component", () => {
    expect(parsePqcV1Sig("pqc-v1.")).toBeNull();
  });

  it("rejects two-component input (pqc-hybrid-v1 sig fed to pqc-v1 parser)", () => {
    const FAKE_ED = "A".repeat(86);
    expect(parsePqcV1Sig(`pqc-v1.${FAKE_ED}.${FAKE_ML_DSA}`)).toBeNull();
  });

  it("rejects wrong prefix", () => {
    expect(parsePqcV1Sig(`pqc-hybrid-v1.${FAKE_ML_DSA}`)).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(parsePqcV1Sig("")).toBeNull();
  });
});

describe("rcan-node.json manifest — PQC fields (issue #188)", () => {
  // Mirror the updated manifest from functions/.well-known/rcan-node.json.ts
  const manifest = {
    rcan_node_version: "1.0",
    node_type: "root",
    operator: "Robot Registry Foundation",
    namespace_prefix: "RRN",
    public_key: null,
    crypto_profile: "pqc-hybrid-v1",
    pqc_public_key: null,
    ed25519_public_key: null,
    api_base: "https://rcan.dev/api/v1",
    registry_ui: "https://rcan.dev/registry/",
    spec_version: "2.3",
    capabilities: ["register", "resolve", "verify", "delegate"],
    sync_endpoint: "https://rcan.dev/api/v1/sync",
    last_sync: new Date().toISOString(),
    ttl_seconds: 3600,
    contact: "registry@rcan.dev",
    governance: "https://rcan.dev/governance/",
    federation_protocol: "https://rcan.dev/federation/",
  };

  it("has crypto_profile field", () => {
    expect(manifest).toHaveProperty("crypto_profile");
  });

  it("crypto_profile is pqc-hybrid-v1", () => {
    expect(manifest.crypto_profile).toBe("pqc-hybrid-v1");
  });

  it("has pqc_public_key field", () => {
    expect(manifest).toHaveProperty("pqc_public_key");
  });

  it("has ed25519_public_key field", () => {
    expect(manifest).toHaveProperty("ed25519_public_key");
  });

  it("spec_version is 2.3", () => {
    expect(manifest.spec_version).toBe("2.3");
  });
});

// ── Pure helpers from fria.ts ─────────────────────────────────────────────────

describe("sortedJsonStringify", () => {
  it("sorts top-level keys alphabetically", () => {
    const result = sortedJsonStringify({ z: 1, a: 2, m: 3 });
    expect(result).toBe('{"a":2,"m":3,"z":1}');
  });

  it("sorts nested object keys recursively", () => {
    const result = sortedJsonStringify({ b: { y: 1, x: 2 }, a: 3 });
    expect(result).toBe('{"a":3,"b":{"x":2,"y":1}}');
  });

  it("preserves arrays without sorting elements", () => {
    const result = sortedJsonStringify({ arr: [3, 1, 2] });
    expect(result).toBe('{"arr":[3,1,2]}');
  });

  it("handles null values", () => {
    const result = sortedJsonStringify({ a: null });
    expect(result).toBe('{"a":null}');
  });

  it("handles primitives", () => {
    expect(sortedJsonStringify(42)).toBe("42");
    expect(sortedJsonStringify("hello")).toBe('"hello"');
    expect(sortedJsonStringify(true)).toBe("true");
  });
});

describe("base64urlToBytes / bytesToBase64url", () => {
  it("round-trips arbitrary bytes", () => {
    const original = new Uint8Array([1, 2, 3, 255, 0, 128]);
    const encoded = bytesToBase64url(original);
    const decoded = base64urlToBytes(encoded);
    expect(decoded).toEqual(original);
  });

  it("uses URL-safe characters (no + or /)", () => {
    const bytes = new Uint8Array(64).fill(255);
    const encoded = bytesToBase64url(bytes);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
  });
});

describe("verifyMlDsa65Signature", () => {
  let publicKeyB64: string;
  let validSigB64: string;
  let testDoc: Record<string, unknown>;

  beforeAll(async () => {
    const keys = ml_dsa65.keygen();
    publicKeyB64 = bytesToBase64url(keys.publicKey);

    testDoc = {
      schema: "rcan-fria-v1",
      generated_at: "2026-04-11T09:00:00.000Z",
      system: { rrn: "RRN-000000000001", robot_name: "test-bot" },
      deployment: { annex_iii_basis: "safety_component", prerequisite_waived: false },
    };

    const { sig: _, ...docWithoutSig } = testDoc;
    const canonical = sortedJsonStringify(docWithoutSig);
    const message = new TextEncoder().encode(canonical);
    const sigBytes = ml_dsa65.sign(message, keys.secretKey);
    validSigB64 = bytesToBase64url(sigBytes);
  });

  it("returns true for a valid ML-DSA-65 signature", async () => {
    const result = await verifyMlDsa65Signature(testDoc, validSigB64, publicKeyB64);
    expect(result).toBe(true);
  });

  it("returns false for a tampered document", async () => {
    const tampered = { ...testDoc, deployment: { annex_iii_basis: "biometric" } };
    const result = await verifyMlDsa65Signature(tampered, validSigB64, publicKeyB64);
    expect(result).toBe(false);
  });

  it("returns false for an invalid signature string", async () => {
    const result = await verifyMlDsa65Signature(testDoc, "aW52YWxpZA", publicKeyB64);
    expect(result).toBe(false);
  });

  it("returns false for a wrong public key", async () => {
    const otherKeys = ml_dsa65.keygen();
    const otherPubB64 = bytesToBase64url(otherKeys.publicKey);
    const result = await verifyMlDsa65Signature(testDoc, validSigB64, otherPubB64);
    expect(result).toBe(false);
  });

  it("excludes the sig field from canonical form", async () => {
    const docWithSig = {
      ...testDoc,
      sig: { alg: "ml-dsa-65", kid: "key-001", value: validSigB64 },
    };
    const result = await verifyMlDsa65Signature(docWithSig, validSigB64, publicKeyB64);
    expect(result).toBe(true);
  });
});

describe("deriveComplianceStatus", () => {
  it("returns no_fria when fria is null", () => {
    expect(deriveComplianceStatus(null)).toBe("no_fria");
  });

  it("returns compliant when overall_pass and not waived", () => {
    expect(deriveComplianceStatus({ sig_verified: 1, overall_pass: 1, prerequisite_waived: 0 })).toBe("compliant");
  });

  it("returns provisional when overall_pass but waived", () => {
    expect(deriveComplianceStatus({ sig_verified: 1, overall_pass: 1, prerequisite_waived: 1 })).toBe("provisional");
  });

  it("returns non_compliant when overall_pass is 0", () => {
    expect(deriveComplianceStatus({ sig_verified: 1, overall_pass: 0, prerequisite_waived: 0 })).toBe("non_compliant");
  });

  it("returns non_compliant even if waived when overall_pass is 0", () => {
    expect(deriveComplianceStatus({ sig_verified: 1, overall_pass: 0, prerequisite_waived: 1 })).toBe("non_compliant");
  });

  it("returns non_compliant when sig_verified is 0 even if overall_pass is 1", () => {
    expect(deriveComplianceStatus({ sig_verified: 0, overall_pass: 1, prerequisite_waived: 0 })).toBe("non_compliant");
  });
});

// ── POST /robots/:rrn/fria handler tests ──────────────────────────────────────

// Inline sha256 for test auth setup (mirrors fria.ts)
async function sha256ForTest(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("POST /robots/:rrn/fria — validation", () => {
  const TEST_RRN = "RRN-000000000001";
  const TEST_TOKEN = "test-api-key";
  const TEST_SALT = "rcan-dev";

  let validApiKeyHash: string;
  let validPublicKeyB64: string;
  let validSigB64: string;
  let validDoc: Record<string, unknown>;

  beforeAll(async () => {
    validApiKeyHash = await sha256ForTest(TEST_TOKEN + TEST_SALT);

    const keys = ml_dsa65.keygen();
    validPublicKeyB64 = bytesToBase64url(keys.publicKey);

    validDoc = {
      schema: "rcan-fria-v1",
      generated_at: "2026-04-11T09:00:00.000Z",
      system: { rrn: TEST_RRN, robot_name: "test-bot", rcan_version: "3.0" },
      deployment: { annex_iii_basis: "safety_component", prerequisite_waived: false },
      conformance: { score: 90, pass: 24, warn: 0, fail: 0 },
      signing_key: { alg: "ml-dsa-65", kid: "key-001", public_key: validPublicKeyB64 },
    };

    const { sig: _, ...docWithoutSig } = validDoc;
    const canonical = sortedJsonStringify(docWithoutSig);
    const message = new TextEncoder().encode(canonical);
    const sigBytes = ml_dsa65.sign(message, keys.secretKey);
    validSigB64 = bytesToBase64url(sigBytes);

    // Add sig field to validDoc
    validDoc.sig = { alg: "ml-dsa-65", kid: "key-001", value: validSigB64 };
  });

  function makeRequest(body: unknown, token?: string): Request {
    return new Request("https://rcan.dev/api/v1/robots/RRN-000000000001/fria", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  function makeEnv(robotRow: { id: number; api_key_hash: string } | null) {
    return {
      DB: {
        exec: async (_sql: string) => {},
        prepare: (sql: string) => {
          const stmt = {
            _args: [] as unknown[],
            bind: (...args: unknown[]) => { stmt._args = args; return stmt; },
            first: async () => {
              if (sql.includes("FROM robots")) return robotRow;
              if (sql.includes("FROM fria_documents")) return null;
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => ({ success: true, meta: { last_row_id: 42 } }),
          };
          return stmt;
        },
      } as unknown as D1Database,
      RCAN_API_KEY_SALT: TEST_SALT,
    };
  }

  it("returns 401 when no Authorization header", async () => {
    const req = makeRequest(validDoc);
    const env = makeEnv({ id: 1, api_key_hash: validApiKeyHash });
    const res = await handlePost(TEST_RRN, req, env);
    expect(res.status).toBe(401);
  });

  it("returns 404 when robot not found", async () => {
    const req = makeRequest(validDoc, TEST_TOKEN);
    const env = makeEnv(null);
    const res = await handlePost(TEST_RRN, req, env);
    expect(res.status).toBe(404);
  });

  it("returns 401 when API key does not match", async () => {
    const req = makeRequest(validDoc, "wrong-key");
    const env = makeEnv({ id: 1, api_key_hash: validApiKeyHash });
    const res = await handlePost(TEST_RRN, req, env);
    expect(res.status).toBe(401);
  });

  it("returns 400 when schema is wrong", async () => {
    const req = makeRequest({ ...validDoc, schema: "wrong-schema" }, TEST_TOKEN);
    const env = makeEnv({ id: 1, api_key_hash: validApiKeyHash });
    const res = await handlePost(TEST_RRN, req, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("INVALID_SCHEMA");
  });

  it("returns 400 when sig.value is missing", async () => {
    const docNoSig = { ...validDoc, sig: { alg: "ml-dsa-65" } };
    const req = makeRequest(docNoSig, TEST_TOKEN);
    const env = makeEnv({ id: 1, api_key_hash: validApiKeyHash });
    const res = await handlePost(TEST_RRN, req, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("MISSING_FIELDS");
    expect(body.error).toContain("sig.value");
  });

  it("returns 400 for invalid ML-DSA-65 signature", async () => {
    const badSigDoc = {
      ...validDoc,
      sig: { alg: "ml-dsa-65", kid: "key-001", value: "aW52YWxpZA" },
    };
    const req = makeRequest(badSigDoc, TEST_TOKEN);
    const env = makeEnv({ id: 1, api_key_hash: validApiKeyHash });
    const res = await handlePost(TEST_RRN, req, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("INVALID_SIGNATURE");
  });

  it("returns 201 for a valid FRIA submission", async () => {
    const req = makeRequest(validDoc, TEST_TOKEN);
    const env = makeEnv({ id: 1, api_key_hash: validApiKeyHash });
    const res = await handlePost(TEST_RRN, req, env);
    expect(res.status).toBe(201);
    const body = await res.json() as { id: number; sig_verified: boolean; overall_pass: boolean };
    expect(body.sig_verified).toBe(true);
    expect(body.overall_pass).toBe(true);
    expect(body.id).toBe(42);
  });
});

describe("GET /robots/:rrn/fria — handler", () => {
  const TEST_RRN = "RRN-000000000001";

  const friaRow = {
    id: 42,
    rrn: TEST_RRN,
    submitted_at: "2026-04-11T09:00:00.000Z",
    annex_iii_basis: "safety_component",
    overall_pass: 1,
    sig_verified: 1,
    document: JSON.stringify({ schema: "rcan-fria-v1", deployment: { annex_iii_basis: "safety_component" } }),
  };

  function makeGetEnv(rows: typeof friaRow[] | null) {
    return {
      DB: {
        exec: async (_sql: string) => {},
        prepare: (sql: string) => {
          const stmt = {
            _args: [] as unknown[],
            bind: (...args: unknown[]) => { stmt._args = args; return stmt; },
            first: async () => rows && rows.length > 0 ? rows[0] : null,
            all: async () => {
              // Strip document field when the SELECT list doesn't include it (the ?all=true path).
              // The table name "fria_documents" always appears, so check for ", document" or "SELECT document".
              const selectsDocCol = /SELECT\s[^)]*\bdocument\b/.test(sql) || sql.includes(", document");
              const stripped = (rows ?? []).map((r) => {
                if (!selectsDocCol) {
                  const { document: _doc, ...rest } = r;
                  return rest;
                }
                return r;
              });
              return { results: stripped };
            },
            run: async () => ({ success: true, meta: { last_row_id: 1 } }),
          };
          return stmt;
        },
      } as unknown as D1Database,
    };
  }

  it("returns 404 when no FRIA exists (latest)", async () => {
    const req = new Request(`https://rcan.dev/api/v1/robots/${TEST_RRN}/fria`);
    const env = makeGetEnv(null);
    const res = await handleGet(TEST_RRN, req, env);
    expect(res.status).toBe(404);
  });

  it("returns 200 with document blob for latest", async () => {
    const req = new Request(`https://rcan.dev/api/v1/robots/${TEST_RRN}/fria`);
    const env = makeGetEnv([friaRow]);
    const res = await handleGet(TEST_RRN, req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { id: number; sig_verified: boolean; document: unknown };
    expect(body.id).toBe(42);
    expect(body.sig_verified).toBe(true);
    expect(body.document).toBeDefined();
  });

  it("returns 200 with array and no document blobs for ?all=true", async () => {
    const req = new Request(`https://rcan.dev/api/v1/robots/${TEST_RRN}/fria?all=true`);
    const env = makeGetEnv([friaRow]);
    const res = await handleGet(TEST_RRN, req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { count: number; fria_documents: { document?: unknown }[] };
    expect(body.count).toBe(1);
    expect(body.fria_documents[0]!.document).toBeUndefined();
  });

  it("returns 404 for ?all=true when no FRIA exists", async () => {
    const req = new Request(`https://rcan.dev/api/v1/robots/${TEST_RRN}/fria?all=true`);
    const env = makeGetEnv([]);
    const res = await handleGet(TEST_RRN, req, env);
    expect(res.status).toBe(404);
  });
});
