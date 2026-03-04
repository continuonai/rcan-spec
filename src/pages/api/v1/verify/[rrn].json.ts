import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ params }) => {
  const { rrn } = params;

  if (!rrn) {
    return new Response(
      JSON.stringify({ success: false, error: 'RRN parameter is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const robots = await getCollection('robots');
  const robot = robots.find((r) => r.data.rrn === rrn);

  if (!robot) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Robot not found',
        rrn,
        api_version: '1.0',
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      rrn: robot.data.rrn,
      verification_status: robot.data.verification_status,
      verification_date: null,
      verification_method: null,
      api_version: '1.0',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};

export async function getStaticPaths() {
  const robots = await getCollection('robots');
  return robots.map((robot) => ({
    params: { rrn: robot.data.rrn },
  }));
}
