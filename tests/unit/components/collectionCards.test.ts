// @vitest-environment node

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import BlogCard from '../../../src/components/blog/BlogCard.astro';
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

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

function visibleText(html: string): string {
  return html
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeHeadingRank(html: string): string {
  return html.replace(/(<\/?h)[23](?=[\s>])/gu, '$1#');
}

describe('collection card adapters', () => {
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
    const renderAtLevel = async (headingLevel: 2 | 3) => {
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

      return normalizeHeadingRank(html);
    };

    expect(await renderAtLevel(2)).toEqual(await renderAtLevel(3));
  });
});
