/**
 * RURI (Robot URI) Parser and Validator
 *
 * RURI Format: rcan://registry/manufacturer/model/device-id[:port][/capability]
 */

export interface ParsedRURI {
  raw: string;
  registry: string;
  manufacturer: string;
  model: string;
  deviceId: string;
  port?: number;
  capability?: string;
}

export interface RURIValidationResult {
  valid: boolean;
  error?: string;
  parsed?: ParsedRURI;
}

// RURI validation regex from the spec
const RURI_REGEX = /^rcan:\/\/([a-z0-9][a-z0-9.-]*[a-z0-9])\/([a-z0-9][a-z0-9-]*[a-z0-9])\/([a-z0-9][a-z0-9-]*[a-z0-9])\/([0-9a-f]{8}(?:-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?)(?::(\d{1,5}))?(\/?[a-z][a-z0-9/-]*)?$/i;

/**
 * Parse and validate a RURI string
 */
export function parseRURI(ruri: string): RURIValidationResult {
  if (!ruri) {
    return { valid: false, error: 'RURI cannot be empty' };
  }

  const trimmedRuri = ruri.trim();

  if (!trimmedRuri.startsWith('rcan://')) {
    return { valid: false, error: 'RURI must start with rcan://' };
  }

  const match = trimmedRuri.match(RURI_REGEX);

  if (!match) {
    return { valid: false, error: 'Invalid RURI format' };
  }

  const [, registry, manufacturer, model, deviceId, port, capability] = match;

  // Validate port if present
  if (port) {
    const portNum = parseInt(port, 10);
    if (portNum < 1 || portNum > 65535) {
      return { valid: false, error: 'Port must be between 1 and 65535' };
    }
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
      capability: capability?.replace(/^\//, '') || undefined,
    },
  };
}

/**
 * Build a RURI string from components
 */
export function buildRURI(parts: {
  registry: string;
  manufacturer: string;
  model: string;
  deviceId: string;
  port?: number;
  capability?: string;
}): string {
  let ruri = `rcan://${parts.registry}/${parts.manufacturer}/${parts.model}/${parts.deviceId}`;

  if (parts.port) {
    ruri += `:${parts.port}`;
  }

  if (parts.capability) {
    ruri += `/${parts.capability}`;
  }

  return ruri;
}

/**
 * Convert a RURI to an HTTP URL for fetching manifest data
 */
export function ruriToHttpUrl(ruri: string | ParsedRURI): string | null {
  const parsed = typeof ruri === 'string' ? parseRURI(ruri).parsed : ruri;

  if (!parsed) {
    return null;
  }

  const port = parsed.port || 8080;
  const protocol = parsed.registry === 'localhost' ? 'http' : 'https';

  // The manifest endpoint is assumed to be at /.well-known/rcan-manifest.json
  return `${protocol}://${parsed.registry}:${port}/.well-known/rcan-manifest.json`;
}

/**
 * Robot manifest structure returned from RURI endpoints
 */
export interface RobotManifest {
  ruri: string;
  name: string;
  manufacturer: string;
  model: string;
  description?: string;
  version?: string;
  capabilities?: string[];
  status?: 'active' | 'idle' | 'busy' | 'error' | 'offline';
  specs?: {
    weight_kg?: number;
    dimensions?: string;
    dof?: number;
    sensors?: string[];
    compute?: string;
    ros_version?: string[];
  };
  links?: {
    urdf?: string;
    github?: string;
    website?: string;
    documentation?: string;
  };
  owner?: {
    name: string;
    type: 'individual' | 'company' | 'research' | 'community';
    contact?: string;
  };
  discovery?: {
    mdns?: boolean;
    txt_records?: Record<string, string>;
  };
}

/**
 * Validate a robot manifest structure
 */
export function validateManifest(manifest: unknown): manifest is RobotManifest {
  if (!manifest || typeof manifest !== 'object') {
    return false;
  }

  const m = manifest as Record<string, unknown>;

  // Required fields
  if (typeof m.ruri !== 'string') return false;
  if (typeof m.name !== 'string') return false;
  if (typeof m.manufacturer !== 'string') return false;
  if (typeof m.model !== 'string') return false;

  return true;
}

/**
 * Convert a robot manifest to registry YAML data format
 */
export function manifestToRegistryData(manifest: RobotManifest, rrn: string): Record<string, unknown> {
  const parsed = parseRURI(manifest.ruri).parsed;

  return {
    rrn,
    name: manifest.name,
    manufacturer: manifest.manufacturer,
    model: manifest.model,
    description: manifest.description || `Robot registered via RCAN protocol from ${manifest.ruri}`,
    status: manifest.status === 'offline' ? 'retired' : 'active',
    ruri: manifest.ruri,
    urdf_url: manifest.links?.urdf,
    github_url: manifest.links?.github,
    website: manifest.links?.website,
    specs: manifest.specs ? {
      weight_kg: manifest.specs.weight_kg,
      dimensions: manifest.specs.dimensions,
      dof: manifest.specs.dof,
      sensors: manifest.specs.sensors,
      compute: manifest.specs.compute,
      ros_version: manifest.specs.ros_version,
    } : undefined,
    owner: manifest.owner ? {
      name: manifest.owner.name,
      type: manifest.owner.type,
    } : undefined,
    tags: [
      'rcan-registered',
      ...(manifest.capabilities || []),
    ],
    submitted_by: 'rcan-auto-register',
    submitted_date: new Date().toISOString().split('T')[0],
  };
}
