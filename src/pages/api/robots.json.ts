import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ url }) => {
  const robots = await getCollection('robots');

  // Get query parameters
  const status = url.searchParams.get('status');
  const manufacturer = url.searchParams.get('manufacturer');
  const tag = url.searchParams.get('tag');
  const limit = parseInt(url.searchParams.get('limit') || '0');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  // Filter robots
  let filteredRobots = robots.map(r => r.data);

  if (status) {
    filteredRobots = filteredRobots.filter(r => r.status === status);
  }

  if (manufacturer) {
    filteredRobots = filteredRobots.filter(r =>
      r.manufacturer.toLowerCase().includes(manufacturer.toLowerCase())
    );
  }

  if (tag) {
    filteredRobots = filteredRobots.filter(r =>
      r.tags.some(t => t.toLowerCase() === tag.toLowerCase())
    );
  }

  // Sort by RRN
  filteredRobots.sort((a, b) => a.rrn.localeCompare(b.rrn));

  // Calculate total before pagination
  const total = filteredRobots.length;

  // Apply pagination
  if (limit > 0) {
    filteredRobots = filteredRobots.slice(offset, offset + limit);
  } else if (offset > 0) {
    filteredRobots = filteredRobots.slice(offset);
  }

  const response = {
    success: true,
    data: filteredRobots,
    meta: {
      total,
      count: filteredRobots.length,
      limit: limit || null,
      offset,
    },
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
