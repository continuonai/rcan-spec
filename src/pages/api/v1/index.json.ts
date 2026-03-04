import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const robots = await getCollection('robots');
  const baseUrl = site ? site.origin : 'https://rcan.dev';

  const response = {
    api_version: '1.0',
    base_url: `${baseUrl}/api/v1`,
    total_robots: robots.length,
    endpoints: [
      {
        path: '/api/v1/index.json',
        method: 'GET',
        description: 'API discovery — lists all available v1 endpoints and registry stats',
      },
      {
        path: '/api/v1/robots.json',
        method: 'GET',
        description:
          'List all registered robots. Supports ?status=, ?manufacturer=, ?tag=, ?q= (full-text search), ?limit=, ?offset=',
      },
      {
        path: '/api/v1/robots/[rrn].json',
        method: 'GET',
        description: 'Get a single robot by RRN (e.g. /api/v1/robots/RRN-00000001.json)',
      },
      {
        path: '/api/v1/ruri/[...slug].json',
        method: 'GET',
        description:
          'Resolve a RURI to a robot registry entry. Pass the URL-encoded RURI after /api/v1/ruri/ (e.g. /api/v1/ruri/rcan%3A%2F%2Frcan.dev%2Fmfr%2Fmdl%2Fdevice-id.json)',
      },
      {
        path: '/api/robots.json',
        method: 'GET',
        description: 'Legacy list endpoint (no api_version field). Use /api/v1/robots.json for new integrations.',
      },
      {
        path: '/api/robots/[rrn].json',
        method: 'GET',
        description: 'Legacy single-robot endpoint. Use /api/v1/robots/[rrn].json for new integrations.',
      },
      {
        path: '/api/badge/[rrn].svg',
        method: 'GET',
        description: 'SVG badge for a robot (embed in README). Supports ?style=, ?label=',
      },
      {
        path: '/api/qr/[rrn].svg',
        method: 'GET',
        description: 'QR code linking to the robot registry page. Supports ?size=',
      },
    ],
  };

  return new Response(JSON.stringify(response, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
