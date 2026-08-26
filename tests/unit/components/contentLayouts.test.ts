// @vitest-environment node

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import reactRenderer from '@astrojs/react/server.js';
import { beforeAll, describe, expect, it } from 'vitest';
import BlogLayout from '../../../src/layouts/BlogLayout.astro';
import WorkLayout from '../../../src/layouts/WorkLayout.astro';

const blogTags = ['Invented blog taxonomy', 'Synthetic editorial topic'];
const workTags = ['Invented work taxonomy', 'Synthetic portfolio topic'];

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
  container.addServerRenderer({ renderer: reactRenderer });
  container.addClientRenderer({
    name: '@astrojs/react',
    entrypoint: '@astrojs/react/client.js',
  });
});

function visibleBodyText(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

describe('published content layouts', () => {
  it('keeps Blog tags in metadata without rendering a tag-chip inventory', async () => {
    const html = await container.renderToString(BlogLayout, {
      props: {
        title: 'Invented published article',
        description: 'An invented article description.',
        pubDate: new Date('2026-08-25T00:00:00.000Z'),
        author: 'Example Author',
        tags: blogTags,
      },
      slots: { default: '<p>Invented article body.</p>' },
    });
    const text = visibleBodyText(html);

    for (const tag of blogTags) {
      expect(html).toContain(tag);
      expect(text).not.toContain(tag);
    }
  });

  it('keeps Work tags in metadata without rendering a tag-chip inventory', async () => {
    const html = await container.renderToString(WorkLayout, {
      props: {
        title: 'Invented published work',
        description: 'An invented work description.',
        type: 'research',
        date: new Date('2026-08-25T00:00:00.000Z'),
        tags: workTags,
      },
      slots: { default: '<p>Invented work body.</p>' },
    });
    const text = visibleBodyText(html);

    for (const tag of workTags) {
      expect(html).toContain(tag);
      expect(text).not.toContain(tag);
    }
  });
});
