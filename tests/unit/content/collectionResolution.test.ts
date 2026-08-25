import { describe, expect, it } from 'vitest';
import {
  resolveBlogCollection,
  resolveHomepageBlog,
  resolveHomepageWorks,
  resolveWorksCollection,
  type BlogEntry,
  type WorkEntry,
} from '../../../src/features/collections/resolveCollections';

const blogImage = {
  url: 'https://assets.public.blob.vercel-storage.com/images/blog/invented-a1b2c3d4.webp',
  alt: 'An invented Blog illustration',
  width: 1920 as const,
  height: 1080 as const,
};

const workImage = {
  url: 'https://assets.public.blob.vercel-storage.com/images/works/invented-e5f6a7b8.webp',
  alt: 'An invented Work illustration',
  width: 1920 as const,
  height: 1080 as const,
};

function blogEntry(
  id: string,
  pubDate: string,
  overrides: Partial<BlogEntry['data']> = {},
): BlogEntry {
  return {
    id,
    body: 'A short invented article body.',
    data: {
      status: 'published',
      assistant: false,
      title: `Full ${id}`,
      shortTitle: `Short ${id}`,
      description: `Description ${id}`,
      summary: `Summary ${id}`,
      pubDate: new Date(`${pubDate}T00:00:00.000Z`),
      tags: ['invented', id],
      image: blogImage,
      ...overrides,
    },
  };
}

function workEntry(
  id: string,
  date: string,
  overrides: Partial<WorkEntry['data']> = {},
): WorkEntry {
  return {
    id,
    body: 'An invented work body.',
    data: {
      status: 'published',
      assistant: false,
      title: `Full ${id}`,
      shortTitle: `Short ${id}`,
      description: `Description ${id}`,
      summary: `Summary ${id}`,
      type: 'project',
      date: new Date(`${date}T00:00:00.000Z`),
      tags: ['invented', id],
      image: workImage,
      ...overrides,
    },
  };
}

function ids(records: readonly { id: string }[]): string[] {
  return records.map(({ id }) => id);
}

describe('collection resolution', () => {
  it('filters drafts before reading publication-required Blog and Work fields', () => {
    const incompleteBlogDraft: BlogEntry = {
      id: 'unfinished-blog',
      body: '',
      data: { status: 'draft', assistant: false },
    };
    const incompleteWorkDraft: WorkEntry = {
      id: 'unfinished-work',
      body: '',
      data: { status: 'draft', assistant: false },
    };

    expect(
      ids(
        resolveBlogCollection([
          incompleteBlogDraft,
          blogEntry('ready', '2026-08-20'),
        ]),
      ),
    ).toEqual(['ready']);
    expect(
      ids(
        resolveWorksCollection([
          incompleteWorkDraft,
          workEntry('ready', '2026-08-20'),
        ]),
      ),
    ).toEqual(['ready']);
    expect(
      ids(
        resolveHomepageBlog([
          incompleteBlogDraft,
          blogEntry('ready', '2026-08-20'),
        ]),
      ),
    ).toEqual(['ready']);
    expect(
      ids(
        resolveHomepageWorks([
          incompleteWorkDraft,
          workEntry('ready', '2026-08-20'),
        ]),
      ),
    ).toEqual(['ready']);
  });

  it('orders the Blog collection by date descending then NFC code-unit ID ascending', () => {
    const entries = [
      blogEntry('older', '2026-08-19'),
      blogEntry('e\u0301clair', '2026-08-20'),
      blogEntry('zebra', '2026-08-20'),
      blogEntry('newest', '2026-08-21'),
    ];

    expect(ids(resolveBlogCollection(entries))).toEqual([
      'newest',
      'zebra',
      'e\u0301clair',
      'older',
    ]);
    expect(ids(entries)).toEqual(['older', 'e\u0301clair', 'zebra', 'newest']);
  });

  it('orders the Works collection by date descending then NFC code-unit ID ascending', () => {
    expect(
      ids(
        resolveWorksCollection([
          workEntry('older', '2026-08-19', { homepagePriority: 1 }),
          workEntry('e\u0301clair', '2026-08-20', { homepagePriority: 1 }),
          workEntry('zebra', '2026-08-20'),
          workEntry('newest', '2026-08-21'),
        ]),
      ),
    ).toEqual(['newest', 'zebra', 'e\u0301clair', 'older']);
  });

  it('orders Homepage Blog canonically before applying its explicit limit', () => {
    const entries = [
      blogEntry('older', '2026-08-19'),
      blogEntry('e\u0301clair', '2026-08-20'),
      blogEntry('zebra', '2026-08-20'),
      blogEntry('newest', '2026-08-21'),
    ];

    expect(ids(resolveHomepageBlog(entries, 3))).toEqual([
      'newest',
      'zebra',
      'e\u0301clair',
    ]);
  });

  it('orders Homepage Works by priority, date, and NFC code-unit ID with unprioritized entries last', () => {
    const entries = [
      workEntry('unprioritized-newest', '2026-08-25'),
      workEntry('priority-two', '2026-08-24', { homepagePriority: 2 }),
      workEntry('priority-one-older', '2026-08-20', { homepagePriority: 1 }),
      workEntry('e\u0301clair', '2026-08-22', { homepagePriority: 1 }),
      workEntry('zebra', '2026-08-22', { homepagePriority: 1 }),
      workEntry('unprioritized-older', '2026-08-19'),
    ];

    expect(ids(resolveHomepageWorks(entries))).toEqual([
      'zebra',
      'e\u0301clair',
      'priority-one-older',
      'priority-two',
      'unprioritized-newest',
    ]);
  });

  it('defaults Homepage collections to at most five while preserving fewer records', () => {
    const sixBlogs = Array.from({ length: 6 }, (_, index) =>
      blogEntry(
        `blog-${index}`,
        `2026-08-${String(index + 10).padStart(2, '0')}`,
      ),
    );
    const twoWorks = [
      workEntry('work-one', '2026-08-20'),
      workEntry('work-two', '2026-08-19'),
    ];

    expect(resolveHomepageBlog(sixBlogs)).toHaveLength(5);
    expect(resolveHomepageWorks(twoWorks)).toHaveLength(2);
  });

  it.each([0, -1, 1.5, 6, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid Homepage limits (%s)',
    (limit) => {
      expect(() => resolveHomepageBlog([], limit)).toThrow(/limit/iu);
      expect(() => resolveHomepageWorks([], limit)).toThrow(/limit/iu);
    },
  );

  it('adapts published entries into complete serializable display records', () => {
    const blog = blogEntry('invented-post', '2026-08-20', {
      title: 'A full invented title',
      shortTitle: 'An invented title',
      description: 'An invented search description.',
      summary: 'A complete invented summary.',
      tags: ['One', 'Two'],
    });
    const research = workEntry('invented-paper', '2026-08-18', {
      title: 'A full invented paper title',
      shortTitle: undefined,
      summary: 'A complete invented research summary.',
      type: 'research',
      venue: 'Invented Journal',
    });

    expect(resolveBlogCollection([blog])).toEqual([
      {
        id: 'invented-post',
        href: '/blog/invented-post/',
        kind: 'blog',
        title: 'An invented title',
        summary: 'A complete invented summary.',
        image: blogImage,
        date: '2026-08-20T00:00:00.000Z',
        facts: ['Aug 20, 2026', '1 min read'],
        search: {
          title: 'A full invented title',
          shortTitle: 'An invented title',
          description: 'An invented search description.',
          summary: 'A complete invented summary.',
          tags: ['One', 'Two'],
        },
      },
    ]);
    expect(resolveWorksCollection([research])).toEqual([
      {
        id: 'invented-paper',
        href: '/works/invented-paper/',
        kind: 'research',
        title: 'A full invented paper title',
        summary: 'A complete invented research summary.',
        image: workImage,
        date: '2026-08-18T00:00:00.000Z',
        facts: ['Aug 18, 2026', 'Invented Journal'],
      },
    ]);
    expect(() =>
      JSON.parse(JSON.stringify(resolveBlogCollection([blog]))),
    ).not.toThrow();
  });
});
