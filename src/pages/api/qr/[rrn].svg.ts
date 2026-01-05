import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import QRCode from 'qrcode';

export const getStaticPaths: GetStaticPaths = async () => {
  const robots = await getCollection('robots');
  return robots.map(robot => ({
    params: { rrn: robot.data.rrn },
  }));
};

export const GET: APIRoute = async ({ params, url }) => {
  const robots = await getCollection('robots');
  const robot = robots.find(r => r.data.rrn === params.rrn);

  if (!robot) {
    return new Response('Robot not found', { status: 404 });
  }

  const size = Math.min(parseInt(url.searchParams.get('size') || '200'), 1000);
  const registryUrl = `https://rcan.dev/registry/${params.rrn}/`;

  const svgString = await QRCode.toString(registryUrl, {
    type: 'svg',
    width: size,
    margin: 2,
    color: {
      dark: '#e8e6e3',
      light: '#0a0a0f',
    },
  });

  return new Response(svgString, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
