import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';

/**
 * RURI Resolution Endpoint
 *
 * Accepts a URL-encoded RURI as the path slug and resolves it to a robot entry.
 *
 * Usage:
 *   GET /api/v1/ruri/<encodeURIComponent(ruri)>.json
 *
 * Example:
 *   RURI: rcan://rcan.dev/opencastor/rover/abcdef12
 *   URL:  /api/v1/ruri/rcan%3A%2F%2Frcan.dev%2Fopencastor%2Frover%2Fabcdef12.json
 *
 * The slug may also be passed as path segments when the RURI is not URL-encoded;
 * in that case the handler reconstructs the RURI from the slug string.
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const robots = await getCollection('robots');

  // Only generate paths for robots that have a RURI assigned
  return robots
    .filter(r => r.data.ruri)
    .map(robot => ({
      params: {
        // URL-encode the RURI so it becomes a single opaque path segment
        // (avoids conflict with the literal slashes in rcan:// URLs)
        slug: encodeURIComponent(robot.data.ruri as string),
      },
    }));
};

export const GET: APIRoute = async ({ params }) => {
  const robots = await getCollection('robots');
  const rawSlug = params.slug as string;

  // Attempt to decode — callers may pass an URL-encoded RURI or a path-segment form
  let ruri: string;
  try {
    ruri = decodeURIComponent(rawSlug);
  } catch {
    ruri = rawSlug;
  }

  // If the slug came in as path segments (e.g. "rcan:/host/mfr/model/id"),
  // normalize the double-slash that path splitting collapses.
  if (ruri.startsWith('rcan:/') && !ruri.startsWith('rcan://')) {
    ruri = 'rcan://' + ruri.slice(6);
  }

  // Match against the ruri field in the collection
  const match = robots.find(r => r.data.ruri === ruri);

  if (!match) {
    return new Response(
      JSON.stringify(
        {
          api_version: '1.0',
          success: false,
          error: 'No robot found for this RURI',
          ruri,
        },
        null,
        2
      ),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  const response = {
    api_version: '1.0',
    success: true,
    ruri,
    data: match.data,
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
