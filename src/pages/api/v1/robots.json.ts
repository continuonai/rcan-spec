import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ url }) => {
  const robots = await getCollection('robots');

  // Query parameters
  const status = url.searchParams.get('status');
  const manufacturer = url.searchParams.get('manufacturer');
  const tag = url.searchParams.get('tag');
  const q = url.searchParams.get('q');
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

  // Full-text search across name, manufacturer, description, and tags
  if (q) {
    const query = q.toLowerCase();
    filteredRobots = filteredRobots.filter(r => {
      const haystack = [
        r.name,
        r.manufacturer,
        r.description,
        ...r.tags,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  // Sort by RRN
  filteredRobots.sort((a, b) => a.rrn.localeCompare(b.rrn));

  // Total before pagination
  const total = filteredRobots.length;

  // Apply pagination
  if (limit > 0) {
    filteredRobots = filteredRobots.slice(offset, offset + limit);
  } else if (offset > 0) {
    filteredRobots = filteredRobots.slice(offset);
  }

  const response = {
    api_version: '1.0',
    success: true,
    data: filteredRobots,
    meta: {
      total,
      count: filteredRobots.length,
      limit: limit || null,
      offset,
      filters: {
        status: status || null,
        manufacturer: manufacturer || null,
        tag: tag || null,
        q: q || null,
      },
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
