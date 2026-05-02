/**
 * rcan-spec — Vitest schema validation tests for version-tuple JSON Schemas
 *
 * Covers:
 *   - Payload schema (version-tuple.json): required fields, enum values, pattern constraints
 *   - Envelope schema (version-tuple-envelope.json): hybrid sig shape, PQ-required classical-optional
 *
 * Per RCAN v3.2 Decision 3 (pqc-hybrid-v1):
 *   - signature_mldsa65 + pq_kid are REQUIRED
 *   - signature_ed25519 + kid are OPTIONAL, but if ed25519 is present, kid must also be present
 *
 * Uses AJV 2020-12 for JSON Schema 2020-12 support (prefixItems, dependentRequired).
 * Existing draft-07 schemas are NOT touched.
 */

import { describe, it, expect, beforeAll } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Schema + fixture loading ──────────────────────────────────────────────────

const root = resolve(import.meta.dirname ?? ".", "..");

const PAYLOAD_SCHEMA = JSON.parse(
  readFileSync(resolve(root, "schemas/version-tuple.json"), "utf-8")
);
const ENVELOPE_SCHEMA = JSON.parse(
  readFileSync(resolve(root, "schemas/version-tuple-envelope.json"), "utf-8")
);
const PAYLOAD_EX = JSON.parse(
  readFileSync(resolve(root, "schemas/examples/version-tuple-robot-md.json"), "utf-8")
);
const ENVELOPE_EX = JSON.parse(
  readFileSync(
    resolve(root, "schemas/examples/version-tuple-envelope-robot-md.json"),
    "utf-8"
  )
);

// ── AJV setup ─────────────────────────────────────────────────────────────────

function makeAjv(): InstanceType<typeof Ajv2020> {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  return ajv;
}

// Validate helper — returns list of error message strings
function errorsFor(schema: object, data: unknown): string[] {
  const ajv = makeAjv();
  const valid = ajv.validate(schema, data);
  if (valid) return [];
  return (ajv.errors ?? []).map((e) => JSON.stringify(e));
}

// ── Schema meta-validation ────────────────────────────────────────────────────

describe("Schema meta-validation", () => {
  it("payload schema is valid JSON Schema 2020-12", () => {
    const ajv = makeAjv();
    expect(() => ajv.addSchema(PAYLOAD_SCHEMA)).not.toThrow();
  });

  it("envelope schema is valid JSON Schema 2020-12", () => {
    const ajv = makeAjv();
    expect(() => ajv.addSchema(ENVELOPE_SCHEMA)).not.toThrow();
  });
});

// ── Payload example validation ────────────────────────────────────────────────

describe("Payload example", () => {
  it("payload example validates against payload schema", () => {
    const errors = errorsFor(PAYLOAD_SCHEMA, PAYLOAD_EX);
    expect(errors).toEqual([]);
  });
});

// ── Envelope example validation ───────────────────────────────────────────────

describe("Envelope example", () => {
  it("envelope example validates against envelope schema", () => {
    const errors = errorsFor(ENVELOPE_SCHEMA, ENVELOPE_EX);
    expect(errors).toEqual([]);
  });
});

// ── Payload required fields ───────────────────────────────────────────────────

describe("Payload required fields", () => {
  it("rejects payload missing released_at", () => {
    const { released_at: _r, ...bad } = PAYLOAD_EX;
    const errors = errorsFor(PAYLOAD_SCHEMA, bad);
    expect(errors.some((e) => e.includes("released_at"))).toBe(true);
  });

  it("rejects payload with invalid protocol_version format in depends_on", () => {
    // "v3.2" is not valid semver (has 'v' prefix, missing patch)
    const bad = {
      ...PAYLOAD_EX,
      depends_on: { protocol_version: "v3.2", manifest_spec_version: "==1.5.0" },
    };
    const errors = errorsFor(PAYLOAD_SCHEMA, bad);
    expect(errors.some((e) => e.includes("protocol_version"))).toBe(true);
  });
});

// ── Envelope signature requirements ──────────────────────────────────────────

describe("Envelope — PQ signature requirements", () => {
  it("rejects envelope missing signature_mldsa65", () => {
    const { signature_mldsa65: _s, ...bad } = ENVELOPE_EX;
    const errors = errorsFor(ENVELOPE_SCHEMA, bad);
    expect(errors.some((e) => e.includes("signature_mldsa65"))).toBe(true);
  });

  it("rejects envelope missing pq_kid", () => {
    const { pq_kid: _k, ...bad } = ENVELOPE_EX;
    const errors = errorsFor(ENVELOPE_SCHEMA, bad);
    expect(errors.some((e) => e.includes("pq_kid"))).toBe(true);
  });

  it("PQ-only envelope (no kid + no ed25519 sig) validates", () => {
    const pqOnly = { ...ENVELOPE_EX };
    delete (pqOnly as Record<string, unknown>).kid;
    delete (pqOnly as Record<string, unknown>).signature_ed25519;
    const errors = errorsFor(ENVELOPE_SCHEMA, pqOnly);
    expect(errors).toEqual([]);
  });

  it("rejects envelope with signature_ed25519 but no kid (dependentRequired)", () => {
    const { kid: _k, ...bad } = ENVELOPE_EX;
    // ENVELOPE_EX has both kid and signature_ed25519; removing kid should fail
    const errors = errorsFor(ENVELOPE_SCHEMA, bad);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ── Envelope RAN format ───────────────────────────────────────────────────────

describe("Envelope — RAN format", () => {
  it("rejects envelope with malformed ran", () => {
    const bad = { ...ENVELOPE_EX, ran: "not-a-ran" };
    const errors = errorsFor(ENVELOPE_SCHEMA, bad);
    expect(errors.some((e) => e.toLowerCase().includes("ran"))).toBe(true);
  });
});

// ── Envelope alg array constraints ───────────────────────────────────────────

describe("Envelope — alg array", () => {
  it("rejects alg where first item is not ML-DSA-65 (prefixItems)", () => {
    const bad = { ...ENVELOPE_EX, alg: ["Ed25519", "ML-DSA-65"] };
    const errors = errorsFor(ENVELOPE_SCHEMA, bad);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ── Payload base64 round-trip ─────────────────────────────────────────────────

describe("Payload base64 round-trip", () => {
  it("envelope.payload decodes to canonical-JSON of the payload fixture", () => {
    const decoded = Buffer.from(ENVELOPE_EX.payload, "base64").toString("utf-8");
    const expected = JSON.stringify(PAYLOAD_EX, Object.keys(PAYLOAD_EX).sort(), undefined)
      .replace(/\s/g, "");
    // Canonical JSON: sorted keys, no whitespace
    const expectedCanonical = JSON.stringify(
      JSON.parse(JSON.stringify(PAYLOAD_EX)),
      (_, v) => v,
      0
    );
    // Use sort_keys canonical form matching Python's json.dumps(sort_keys=True, separators=(',',':'))
    function sortedStringify(obj: unknown): string {
      if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
        return JSON.stringify(obj);
      }
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(obj as object).sort()) {
        sorted[key] = (obj as Record<string, unknown>)[key];
      }
      return `{${Object.entries(sorted)
        .map(([k, v]) => `${JSON.stringify(k)}:${sortedStringify(v)}`)
        .join(",")}}`;
    }
    const canonical = sortedStringify(PAYLOAD_EX);
    expect(decoded).toBe(canonical);
  });
});
