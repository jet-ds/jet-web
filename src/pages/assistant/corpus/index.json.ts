import type { APIRoute } from 'astro';
import {
  canonicalSerialize,
} from '../../../features/jets-ghost/corpus/build';
import { loadAstroKnowledgeBase } from '../../../features/jets-ghost/corpus/astro';

export const prerender = true;

export const GET: APIRoute = async () => {
  const { index } = await loadAstroKnowledgeBase();
  return new Response(canonicalSerialize(index), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
};
