// @vitest-environment node

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import reactRenderer from '@astrojs/react/server.js';
import { beforeAll, describe, expect, it } from 'vitest';
import BlogPostPage from '../../../src/pages/blog/[slug].astro';
import {
  resolveBlogCollection,
  type BlogEntry,
} from '../../../src/features/collections/resolveCollections';
import { setAstroContentStub } from '../../fixtures/astroContent';

const image = {
  url: 'https://assets.public.blob.vercel-storage.com/images/blog/invented-a1b2c3d4.webp',
  alt: 'An invented Blog illustration',
  width: 1920 as const,
  height: 1080 as const,
};

type RenderableBlogEntry = BlogEntry & {
  data: BlogEntry['data'] & { author: string };
};

function blogEntry(id: string): RenderableBlogEntry {
  return {
    id,
    body: `Invented ${id} article body.`,
    data: {
      status: 'published',
      assistant: false,
      title: `Full ${id}`,
      description: `Description ${id}`,
      summary: `Summary ${id}`,
      pubDate: new Date('2026-08-20T00:00:00.000Z'),
      author: 'Invented Author',
      tags: ['invented'],
      image,
    },
  };
}

function postNavigationLinks(
  html: string,
): Array<{ href: string; text: string }> {
  const navigation = html.match(
    /<nav\b[^>]*aria-label="Post navigation"[^>]*>([\s\S]*?)<\/nav>/u,
  )?.[1];
  if (navigation === undefined) return [];
  return [
    ...navigation.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gu),
  ].map(([, href, content]) => ({
    href,
    text: content
      .replace(/<[^>]+>/gu, ' ')
      .replace(/\s+/gu, ' ')
      .trim(),
  }));
}

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
  container.addServerRenderer({ renderer: reactRenderer });
  container.addClientRenderer({
    name: '@astrojs/react',
    entrypoint: '@astrojs/react/client.js',
  });
});

describe('Blog detail navigation', () => {
  it('renders equal-date neighbors in the canonical hub and ItemList order', async () => {
    const entries = [
      blogEntry('bravo'),
      blogEntry('alpha'),
      blogEntry('charlie'),
    ];
    setAstroContentStub({ blog: entries, works: [] });

    expect(resolveBlogCollection(entries).map(({ id }) => id)).toEqual([
      'alpha',
      'bravo',
      'charlie',
    ]);

    const html = await container.renderToString(BlogPostPage, {
      props: { post: entries[0] },
    });
    const links = postNavigationLinks(html);

    expect(links.map(({ href }) => href)).toEqual([
      '/blog/charlie/',
      '/blog/alpha/',
    ]);
    expect(links.map(({ text }) => text)).toEqual([
      'Previous Full charlie',
      'Next Full alpha',
    ]);
  });
});
