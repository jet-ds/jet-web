// @vitest-environment node

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import reactRenderer from '@astrojs/react/server.js';
import { beforeAll, describe, expect, it } from 'vitest';
import BlogCard from '../../../src/components/blog/BlogCard.astro';
import HomeCollectionCarousel from '../../../src/components/content/HomeCollectionCarousel.astro';
import ThemeAwareImage from '../../../src/components/ui/ThemeAwareImage.astro';
import WorkCard from '../../../src/components/works/WorkCard.astro';
import type { CollectionDisplayRecord } from '../../../src/features/collections/types';

const blogRecord: CollectionDisplayRecord = {
  id: 'complete-blog-card',
  kind: 'blog',
  href: '/blog/complete-blog-card/',
  title: 'A complete editorial title',
  summary: 'A complete editorial summary that must remain intact.',
  image: {
    url: 'https://example.com/blog-card.jpg',
    alt: 'A complete editorial card image',
    width: 1920,
    height: 1080,
  },
  date: '2026-08-25T00:00:00.000Z',
  facts: ['August 25, 2026', '4 min read'],
};

const otherWorkRecord: CollectionDisplayRecord = {
  id: 'complete-work-card',
  kind: 'other',
  href: '/works/complete-work-card/',
  title: 'A complete work title',
  summary: 'A complete work summary that must remain intact.',
  image: {
    url: 'https://example.com/work-card.jpg',
    alt: 'A complete work card image',
    width: 1920,
    height: 1080,
  },
  date: '2026-08-24T00:00:00.000Z',
  facts: ['August 24, 2026'],
};

const themeAwareWorkRecord: CollectionDisplayRecord = {
  ...otherWorkRecord,
  id: 'theme-aware-home-work-card',
  image: {
    ...otherWorkRecord.image,
    url: 'https://example.com/primary-work-card.jpg',
    darkUrl: 'https://example.com/alternate-dark-work-card.jpg',
  },
};

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
  container.addServerRenderer({ renderer: reactRenderer });
  container.addClientRenderer({
    name: '@astrojs/react',
    entrypoint: '@astrojs/react/client.js',
  });
});

function visibleText(html: string): string {
  return html
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

describe('collection card adapters', () => {
  it.each(['lazy', 'eager'] as const)(
    'preserves requested %s loading for both theme-aware image sources',
    async (loading) => {
      const html = await container.renderToString(ThemeAwareImage, {
        props: {
          src: 'https://example.com/light-image.jpg',
          darkSrc: 'https://example.com/dark-image.jpg',
          alt: 'An invented theme-aware scene',
          width: 1920,
          height: 1080,
          loading,
        },
      });

      const loadingAttributes = [
        ...html.matchAll(/loading="(lazy|eager)"/gu),
      ].map((match) => match[1]);
      expect(loadingAttributes).toEqual([loading, loading]);
    },
  );

  it('presents other work records with the public Work eyebrow', async () => {
    const html = await container.renderToString(WorkCard, {
      props: {
        record: otherWorkRecord,
        variant: 'collection',
        headingLevel: 2,
      },
    });
    const text = visibleText(html);

    expect(text).toContain('Work');
    expect(text).not.toContain('Other');
  });

  it('renders either permitted heading rank without changing compact-card content', async () => {
    for (const headingLevel of [2, 3] as const) {
      const html = await container.renderToString(BlogCard, {
        props: { record: blogRecord, variant: 'compact', headingLevel },
      });
      expect(html).toContain(`href="${blogRecord.href}"`);
      expect(html).toContain(`alt="${blogRecord.image.alt}"`);
      expect(html).toContain(`<h${headingLevel}`);
      expect(html).toContain(`${blogRecord.title}</h${headingLevel}>`);
      expect(visibleText(html)).toContain(blogRecord.summary);
      for (const fact of blogRecord.facts) {
        expect(visibleText(html)).toContain(fact);
      }
    }
  });

  it('offers compact fallback cards only site-justified responsive image widths', async () => {
    const html = await container.renderToString(BlogCard, {
      props: { record: blogRecord, variant: 'compact', headingLevel: 3 },
    });
    const widths = [...html.matchAll(/\s(\d+)w(?:,|&quot;|")/gu)].map((match) =>
      Number(match[1]),
    );

    expect(widths).toEqual([384, 768, 1152]);
  });

  it('keeps Homepage fallback and island props on the primary record image', async () => {
    const html = await container.renderToString(HomeCollectionCarousel, {
      props: { items: [themeAwareWorkRecord], label: 'Latest Works' },
    });

    expect(html).toContain('primary-work-card');
    expect(html).not.toContain('alternate-dark-work-card');
    expect(html).not.toContain('darkUrl');
  });
});
