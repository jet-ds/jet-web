import { describe, expect, it } from 'vitest';
import {
  renderLlmsText,
  resolveLlmsText,
} from '../../../src/features/discovery/llmsText';
import type {
  BlogEntry,
  WorkEntry,
} from '../../../src/features/collections/resolveCollections';
import type { CollectionDisplayRecord } from '../../../src/features/collections/types';

const image = {
  url: 'https://assets.public.blob.vercel-storage.com/images/blog/invented-a1b2c3d4.webp',
  alt: 'An invented illustration',
  width: 1920 as const,
  height: 1080 as const,
};

function displayRecord(
  kind: CollectionDisplayRecord['kind'],
  title: string,
  summary: string,
  href: string,
): CollectionDisplayRecord {
  return {
    id: 'invented',
    href,
    kind,
    title,
    summary,
    image,
    date: '2026-08-25T00:00:00.000Z',
    facts: ['August 25, 2026'],
  };
}

function blogEntry(id: string, status: 'draft' | 'published'): BlogEntry {
  return {
    id,
    body: 'An invented article body.',
    data: {
      status,
      assistant: false,
      title: `Invented ${id}`,
      description: `Description for ${id}`,
      summary: `Complete summary for ${id}.`,
      pubDate: new Date('2026-08-25T00:00:00.000Z'),
      tags: ['invented'],
      image,
    },
  };
}

function workEntry(id: string, status: 'draft' | 'published'): WorkEntry {
  return {
    id,
    body: 'An invented work body.',
    data: {
      status,
      assistant: false,
      title: `Invented ${id}`,
      description: `Description for ${id}`,
      summary: `Complete summary for ${id}.`,
      type: 'project',
      date: new Date('2026-08-25T00:00:00.000Z'),
      tags: ['invented'],
      image,
    },
  };
}

describe('llms.txt discovery text', () => {
  it('keeps escaped titles and normalized summaries on one physical list line', () => {
    const input = {
      siteName: 'Jet Sanchez',
      siteDescription:
        'Research, systems & tools for thinking clearly in an AI-driven world',
      blog: [
        displayRecord(
          'blog',
          'Invented [article]\r\n\\guide',
          'Complete\r\n article   summary. ',
          'https://jetsanchez.com/blog/invented/?source=[exact]#part',
        ),
      ],
      works: [
        displayRecord(
          'project',
          'Invented work',
          'Complete\nwork\t summary.',
          'https://jetsanchez.com/works/invented/',
        ),
      ],
    };

    const rendered = renderLlmsText(input);

    expect(rendered).toBe(`# Jet Sanchez
> Research, systems & tools for thinking clearly in an AI-driven world

## Main
- [About](https://jetsanchez.com/about/): About Jet Sanchez
- [Blog](https://jetsanchez.com/blog/): Essays and analysis
- [Works](https://jetsanchez.com/works/): Research and projects
- [Egregore](https://jetsanchez.com/chatbot/): A local-first personal assistant

## Articles
- [Invented \\[article\\] \\\\guide](https://jetsanchez.com/blog/invented/?source=[exact]#part): Complete article summary.

## Works
- [Invented work](https://jetsanchez.com/works/invented/): Complete work summary.
`);
  });

  it('projects new published raw entries and excludes drafts through canonical resolvers', () => {
    const text = resolveLlmsText({
      siteName: 'Jet Sanchez',
      siteDescription: 'Invented site description',
      blogEntries: [
        blogEntry('new-published-article', 'published'),
        blogEntry('unfinished-draft-article', 'draft'),
      ],
      workEntries: [
        workEntry('new-published-work', 'published'),
        workEntry('unfinished-draft-work', 'draft'),
      ],
    });

    expect(text).toContain(
      '- [Invented new-published-article](https://jetsanchez.com/blog/new-published-article/): Complete summary for new-published-article.',
    );
    expect(text).toContain(
      '- [Invented new-published-work](https://jetsanchez.com/works/new-published-work/): Complete summary for new-published-work.',
    );
    expect(text).not.toContain('unfinished-draft-article');
    expect(text).not.toContain('unfinished-draft-work');
  });
});
