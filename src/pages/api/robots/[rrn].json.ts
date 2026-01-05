import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';

export const getStaticPaths: GetStaticPaths = async () => {
  const robots = await getCollection('robots');
  return robots.map(robot => ({
    params: { rrn: robot.data.rrn },
  }));
};

export const GET: APIRoute = async ({ params }) => {
  const robots = await getCollection('robots');
  const robot = robots.find(r => r.data.rrn === params.rrn);

  if (!robot) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Robot not found',
      rrn: params.rrn,
    }, null, 2), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const response = {
    success: true,
    data: robot.data,
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
