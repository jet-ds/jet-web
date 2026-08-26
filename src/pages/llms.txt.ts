import { getCollection } from 'astro:content';
import { SITE } from '../config/site';
import { resolveLlmsText } from '../features/discovery/llmsText';

export const prerender = true;

export async function GET(): Promise<Response> {
  const [blogEntries, workEntries] = await Promise.all([
    getCollection('blog'),
    getCollection('works'),
  ]);

  return new Response(
    resolveLlmsText({
      siteName: SITE.title,
      siteDescription: SITE.description,
      blogEntries,
      workEntries,
    }),
    {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    },
  );
}
