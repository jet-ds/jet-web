import type { APIRoute } from 'astro';

import { JETS_GHOST_LICENSE_BUNDLE } from '../../../../../features/jets-ghost/licenses.server';

export const prerender = true;

export const GET: APIRoute = () => new Response(
  JETS_GHOST_LICENSE_BUNDLE.apache,
  { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
);
