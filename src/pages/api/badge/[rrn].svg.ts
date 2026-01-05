import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';

export const getStaticPaths: GetStaticPaths = async () => {
  const robots = await getCollection('robots');
  return robots.map(robot => ({
    params: { rrn: robot.data.rrn },
    props: { robot: robot.data },
  }));
};

interface RobotData {
  rrn: string;
  name: string;
  status: 'active' | 'retired' | 'prototype' | 'concept';
}

const statusColors: Record<string, { bg: string; text: string }> = {
  active: { bg: '#22c55e', text: '#ffffff' },
  retired: { bg: '#6b7280', text: '#ffffff' },
  prototype: { bg: '#f59e0b', text: '#000000' },
  concept: { bg: '#8b5cf6', text: '#ffffff' },
};

function generateBadgeSVG(
  robot: RobotData,
  style: 'flat' | 'flat-square' | 'plastic',
  customLabel?: string
): string {
  const label = customLabel || 'RCAN';
  const message = robot.rrn;
  const status = robot.status;
  const colors = statusColors[status] || statusColors.active;

  // Calculate text widths (approximate)
  const labelWidth = label.length * 7 + 10;
  const messageWidth = message.length * 6.5 + 10;
  const statusWidth = status.length * 6 + 10;
  const totalWidth = labelWidth + messageWidth + statusWidth;
  const height = 20;

  const radius = style === 'flat-square' ? 0 : style === 'plastic' ? 4 : 3;

  // Generate gradient for plastic style
  const gradientDef = style === 'plastic'
    ? `<linearGradient id="grad" x2="0" y2="100%">
        <stop offset="0" stop-color="#fff" stop-opacity=".15"/>
        <stop offset="1" stop-opacity=".15"/>
       </linearGradient>`
    : '';

  const gradientOverlay = style === 'plastic'
    ? `<rect rx="${radius}" width="${totalWidth}" height="${height}" fill="url(#grad)"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" role="img" aria-label="${label}: ${message}">
  <title>${label}: ${message} (${status})</title>
  ${gradientDef}
  <clipPath id="c">
    <rect width="${totalWidth}" height="${height}" rx="${radius}"/>
  </clipPath>
  <g clip-path="url(#c)">
    <rect width="${labelWidth}" height="${height}" fill="#555"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="${height}" fill="#007ec6"/>
    <rect x="${labelWidth + messageWidth}" width="${statusWidth}" height="${height}" fill="${colors.bg}"/>
    ${gradientOverlay}
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="14" fill="#fff">${label}</text>
    <text x="${labelWidth + messageWidth / 2}" y="14" fill="#fff">${message}</text>
    <text x="${labelWidth + messageWidth + statusWidth / 2}" y="14" fill="${colors.text}">${status}</text>
  </g>
</svg>`;
}

export const GET: APIRoute = async ({ params, url, props }) => {
  const robot = props.robot as RobotData | undefined;

  if (!robot) {
    // Fallback: fetch from collection
    const robots = await getCollection('robots');
    const found = robots.find(r => r.data.rrn === params.rrn);
    if (!found) {
      return new Response('Robot not found', { status: 404 });
    }
    const style = (url.searchParams.get('style') || 'flat') as 'flat' | 'flat-square' | 'plastic';
    const label = url.searchParams.get('label') || undefined;
    const svg = generateBadgeSVG(found.data, style, label);

    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  const style = (url.searchParams.get('style') || 'flat') as 'flat' | 'flat-square' | 'plastic';
  const label = url.searchParams.get('label') || undefined;
  const svg = generateBadgeSVG(robot, style, label);

  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
