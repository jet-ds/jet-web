import type { APIRoute } from 'astro';

import { EGREGORE_LICENSE_BUNDLE } from '../../features/egregore/licenses.server';

export const prerender = true;

export const GET: APIRoute = () => new Response(
  EGREGORE_LICENSE_BUNDLE.apache,
  { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
);
