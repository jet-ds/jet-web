import type { APIRoute } from 'astro';
import {
  canonicalSerialize,
} from '../../../features/egregore/corpus/build';
import { loadAstroKnowledgeBase } from '../../../features/egregore/corpus/astro';

export const prerender = true;

export const GET: APIRoute = async () => {
  const { manifest } = await loadAstroKnowledgeBase();
  return new Response(canonicalSerialize(manifest), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
};
