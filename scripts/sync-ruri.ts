#!/usr/bin/env npx ts-node
/**
 * RURI Sync Script
 *
 * This script fetches robot manifests from RURI endpoints and updates
 * the registry YAML files. It can be run manually or as part of CI/CD.
 *
 * Usage:
 *   npx ts-node scripts/sync-ruri.ts
 *   npx ts-node scripts/sync-ruri.ts --dry-run
 *   npx ts-node scripts/sync-ruri.ts --ruri "rcan://example.com/acme/bot/12345678"
 */

import * as fs from 'fs';
import * as path from 'path';

// RURI parsing utilities (inline to avoid import issues)
const RURI_REGEX = /^rcan:\/\/([a-z0-9][a-z0-9.-]*[a-z0-9])\/([a-z0-9][a-z0-9-]*[a-z0-9])\/([a-z0-9][a-z0-9-]*[a-z0-9])\/([0-9a-f]{8}(?:-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?)(?::(\d{1,5}))?(\/?[a-z][a-z0-9/-]*)?$/i;

interface ParsedRURI {
  raw: string;
  registry: string;
  manufacturer: string;
  model: string;
  deviceId: string;
  port?: number;
  capability?: string;
}

interface RobotManifest {
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
}

function parseRURI(ruri: string): ParsedRURI | null {
  const match = ruri.trim().match(RURI_REGEX);
  if (!match) return null;

  const [, registry, manufacturer, model, deviceId, port, capability] = match;
  return {
    raw: ruri.trim(),
    registry,
    manufacturer,
    model,
    deviceId,
    port: port ? parseInt(port, 10) : undefined,
    capability: capability?.replace(/^\//, '') || undefined,
  };
}

function ruriToHttpUrl(parsed: ParsedRURI): string {
  const port = parsed.port || 8080;
  const protocol = parsed.registry === 'localhost' ? 'http' : 'https';
  return `${protocol}://${parsed.registry}:${port}/.well-known/rcan-manifest.json`;
}

async function fetchManifest(url: string): Promise<RobotManifest> {
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

function manifestToYaml(manifest: RobotManifest, rrn: string): string {
  const lines: string[] = [];

  lines.push(`rrn: "${rrn}"`);
  lines.push(`name: "${manifest.name}"`);
  lines.push(`manufacturer: "${manifest.manufacturer}"`);
  lines.push(`model: "${manifest.model}"`);
  lines.push(`description: "${manifest.description || 'Robot registered via RCAN protocol'}"`);
  lines.push(`status: "${manifest.status === 'offline' ? 'retired' : 'active'}"`);
  lines.push('');

  if (manifest.links?.urdf) {
    lines.push(`urdf_url: "${manifest.links.urdf}"`);
  }
  if (manifest.links?.github) {
    lines.push(`github_url: "${manifest.links.github}"`);
  }
  if (manifest.links?.website) {
    lines.push(`website: "${manifest.links.website}"`);
  }
  lines.push('');

  if (manifest.specs) {
    lines.push('specs:');
    if (manifest.specs.weight_kg) lines.push(`  weight_kg: ${manifest.specs.weight_kg}`);
    if (manifest.specs.dimensions) lines.push(`  dimensions: "${manifest.specs.dimensions}"`);
    if (manifest.specs.dof) lines.push(`  dof: ${manifest.specs.dof}`);
    if (manifest.specs.compute) lines.push(`  compute: "${manifest.specs.compute}"`);
    if (manifest.specs.ros_version && manifest.specs.ros_version.length > 0) {
      lines.push('  ros_version:');
      manifest.specs.ros_version.forEach(v => lines.push(`    - "${v}"`));
    }
    if (manifest.specs.sensors && manifest.specs.sensors.length > 0) {
      lines.push('  sensors:');
      manifest.specs.sensors.forEach(s => lines.push(`    - "${s}"`));
    }
    lines.push('');
  }

  if (manifest.owner) {
    lines.push('owner:');
    lines.push(`  name: "${manifest.owner.name}"`);
    lines.push(`  type: "${manifest.owner.type}"`);
    lines.push('');
  }

  lines.push(`ruri: "${manifest.ruri}"`);
  lines.push('');
  lines.push('submitted_by: "rcan-auto-sync"');
  lines.push(`submitted_date: "${new Date().toISOString().split('T')[0]}"`);

  const tags = ['rcan-synced', ...(manifest.capabilities || [])];
  lines.push('tags:');
  tags.forEach(t => lines.push(`  - "${t}"`));

  return lines.join('\n') + '\n';
}

function getNextRRN(robotsDir: string): string {
  const files = fs.readdirSync(robotsDir);
  const rrns = files
    .filter(f => f.match(/^RRN-\d{8}\.yaml$/))
    .map(f => parseInt(f.match(/RRN-(\d{8})\.yaml/)?.[1] || '0', 10));

  const maxRRN = rrns.length > 0 ? Math.max(...rrns) : 0;
  const nextNum = (maxRRN + 1).toString().padStart(8, '0');
  return `RRN-${nextNum}`;
}

function findExistingByRURI(robotsDir: string, ruri: string): string | null {
  const files = fs.readdirSync(robotsDir).filter(f => f.endsWith('.yaml'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(robotsDir, file), 'utf-8');
    if (content.includes(`ruri: "${ruri}"`)) {
      return file.replace('.yaml', '');
    }
  }

  return null;
}

async function syncRURI(ruri: string, robotsDir: string, dryRun: boolean): Promise<void> {
  console.log(`\nProcessing: ${ruri}`);

  const parsed = parseRURI(ruri);
  if (!parsed) {
    console.error(`  [ERROR] Invalid RURI format`);
    return;
  }

  console.log(`  Registry: ${parsed.registry}`);
  console.log(`  Manufacturer: ${parsed.manufacturer}`);
  console.log(`  Model: ${parsed.model}`);
  console.log(`  Device ID: ${parsed.deviceId}`);

  const url = ruriToHttpUrl(parsed);
  console.log(`  Fetching: ${url}`);

  try {
    const manifest = await fetchManifest(url);
    console.log(`  [OK] Fetched manifest for: ${manifest.name}`);

    // Check if already registered
    const existingRRN = findExistingByRURI(robotsDir, ruri);
    const rrn = existingRRN || getNextRRN(robotsDir);

    const yamlContent = manifestToYaml(manifest, rrn);
    const filePath = path.join(robotsDir, `${rrn}.yaml`);

    if (dryRun) {
      console.log(`  [DRY-RUN] Would ${existingRRN ? 'update' : 'create'}: ${filePath}`);
      console.log('  --- YAML Content ---');
      console.log(yamlContent.split('\n').map(l => `  ${l}`).join('\n'));
    } else {
      fs.writeFileSync(filePath, yamlContent);
      console.log(`  [OK] ${existingRRN ? 'Updated' : 'Created'}: ${filePath}`);
    }
  } catch (err) {
    console.error(`  [ERROR] Failed to fetch manifest: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const ruriIndex = args.indexOf('--ruri');
  const specificRuri = ruriIndex !== -1 ? args[ruriIndex + 1] : null;

  const robotsDir = path.join(process.cwd(), 'src', 'content', 'robots');

  if (!fs.existsSync(robotsDir)) {
    console.error(`Error: Robots directory not found: ${robotsDir}`);
    process.exit(1);
  }

  console.log('RCAN RURI Sync Script');
  console.log('=====================');
  console.log(`Robots directory: ${robotsDir}`);
  console.log(`Dry run: ${dryRun}`);

  if (specificRuri) {
    // Sync a specific RURI
    await syncRURI(specificRuri, robotsDir, dryRun);
  } else {
    // Read RURIs from existing robots and sync them
    console.log('\nScanning existing robots for RURIs to sync...');

    const files = fs.readdirSync(robotsDir).filter(f => f.endsWith('.yaml'));
    let synced = 0;

    for (const file of files) {
      const content = fs.readFileSync(path.join(robotsDir, file), 'utf-8');
      const ruriMatch = content.match(/ruri:\s*"(rcan:\/\/[^"]+)"/);

      if (ruriMatch && ruriMatch[1]) {
        await syncRURI(ruriMatch[1], robotsDir, dryRun);
        synced++;
      }
    }

    if (synced === 0) {
      console.log('\nNo robots with RURI found. Nothing to sync.');
      console.log('To register a new robot, use: npx ts-node scripts/sync-ruri.ts --ruri "rcan://..."');
    }
  }

  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
