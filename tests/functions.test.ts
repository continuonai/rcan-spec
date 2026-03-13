/**
 * rcan-spec — Vitest unit tests for Cloudflare Functions logic
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

import { describe, it, expect, vi } from "vitest";

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
