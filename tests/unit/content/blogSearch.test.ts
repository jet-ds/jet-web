import { describe, expect, it } from 'vitest';
import {
  normalizeSearchText,
  searchBlogPosts,
  type SearchableBlogRecord,
} from '../../../src/features/blog-search/searchBlogPosts';

function record(
  id: string,
  overrides: Partial<SearchableBlogRecord> = {},
): SearchableBlogRecord {
  return {
    id,
    title: `Invented title ${id}`,
    description: 'Invented description.',
    summary: 'Invented summary.',
    tags: [],
    pubDate: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function resultIds(
  records: readonly SearchableBlogRecord[],
  query: string,
): string[] {
  return searchBlogPosts(records, query).map(({ id }) => id);
}

describe('normalizeSearchText', () => {
  it('compatibility-normalizes Unicode, folds case, removes diacritics, and trims', () => {
    expect(normalizeSearchText('  Ｃrème KELVIN  ')).toBe('creme kelvin');
  });
});

describe('searchBlogPosts', () => {
  it('tokenizes on non-letter and non-number boundaries and requires every distinct token', () => {
    const records = [
      record('complete', {
        title: 'Café—AI systems',
        description: 'Nothing else.',
        summary: 'Nothing else.',
      }),
      record('partial', {
        title: 'Café systems',
        description: 'Nothing else.',
        summary: 'Nothing else.',
      }),
    ];

    expect(resultIds(records, 'CAFE / ai / ai')).toEqual(['complete']);
  });

  it('allows distinct query tokens to match across indexed fields', () => {
    const records = [
      record('cross-field', {
        title: 'Local workflows',
        description: 'Nothing else.',
        summary: 'A retrieval field guide.',
      }),
      record('missing-token', {
        title: 'Local workflows',
        description: 'Nothing else.',
        summary: 'A compact field guide.',
      }),
    ];

    expect(resultIds(records, 'local retrieval')).toEqual(['cross-field']);
  });

  it('keeps a hyphenated title eligible throughout incremental token prefixes', () => {
    const records = [
      record('incremental-title', {
        title: 'Solar-Powered Field Notes',
        description: 'Nothing else.',
        summary: 'Nothing else.',
      }),
    ];

    for (const query of [
      'S',
      'So',
      'Sol',
      'Solar',
      'Solar-P',
      'Solar-Po',
      'Solar-Powered',
    ]) {
      expect(resultIds(records, query), query).toEqual(['incremental-title']);
    }
  });

  it('ranks exact title-token matches before longer prefix-only matches', () => {
    const records = [
      record('prefix-only', {
        title: 'Solarium Field Notes',
        description: 'Nothing else.',
        summary: 'Nothing else.',
        pubDate: '2026-03-01T00:00:00.000Z',
      }),
      record('exact-token', {
        title: 'Solar Field Notes',
        description: 'Nothing else.',
        summary: 'Nothing else.',
        pubDate: '2026-01-01T00:00:00.000Z',
      }),
    ];

    expect(resultIds(records, 'solar')).toEqual(['exact-token', 'prefix-only']);
  });

  it('ranks exact complete title equality before every lower score position', () => {
    const records = [
      record('lower', {
        title: 'A local AI field guide',
        tags: ['local', 'AI'],
        summary: 'Local AI local AI.',
        description: 'Local AI local AI.',
      }),
      record('exact', {
        title: 'Local AI',
        summary: 'Nothing else.',
        description: 'Nothing else.',
      }),
    ];

    expect(resultIds(records, 'local ai')).toEqual(['exact', 'lower']);
  });

  it('treats shortTitle as a complete title for exact equality', () => {
    const records = [
      record('long-title', {
        title: 'A local AI field guide',
        summary: 'Nothing else.',
        description: 'Nothing else.',
      }),
      record('short-title', {
        title: 'An unrelated long title',
        shortTitle: 'Local AI',
        summary: 'Nothing else.',
        description: 'Nothing else.',
      }),
    ];

    expect(resultIds(records, 'local ai')).toEqual([
      'short-title',
      'long-title',
    ]);
  });

  it('ranks a contiguous complete title phrase before title-token count ties', () => {
    const records = [
      record('separate', {
        title: 'AI methods for local teams',
        tags: ['local', 'AI'],
        summary: 'Local AI.',
        description: 'Local AI.',
      }),
      record('phrase', {
        title: 'A local AI field guide',
        summary: 'Nothing else.',
        description: 'Nothing else.',
      }),
    ];

    expect(resultIds(records, 'local ai')).toEqual(['phrase', 'separate']);
  });

  it('ranks more distinct title tokens before tag, summary, and description scores', () => {
    const records = [
      record('one-title-token', {
        title: 'Local workflows',
        tags: ['AI'],
        summary: 'Local AI.',
        description: 'Local AI.',
      }),
      record('two-title-tokens', {
        title: 'AI methods for local teams',
        summary: 'Nothing else.',
        description: 'Nothing else.',
      }),
    ];

    expect(resultIds(records, 'local ai')).toEqual([
      'two-title-tokens',
      'one-title-token',
    ]);
  });

  it('ranks exact normalized tag/query matches before tag-token presence', () => {
    const records = [
      record('tag-token-only', {
        title: 'Local workflows',
        tags: ['Applied AI methods'],
        summary: 'Local AI.',
        description: 'Local AI.',
      }),
      record('exact-tag', {
        title: 'Local workflows',
        tags: ['AI'],
        summary: 'Nothing else.',
        description: 'Nothing else.',
      }),
    ];

    expect(resultIds(records, 'local ai')).toEqual([
      'exact-tag',
      'tag-token-only',
    ]);
  });

  it('counts normalized tags equal to the complete multi-token query', () => {
    const records = [
      record('token-tags', {
        title: 'Local workflows',
        tags: ['AI'],
        summary: 'Nothing else.',
        description: 'Nothing else.',
      }),
      record('complete-query-tag', {
        title: 'Local workflows',
        tags: ['local ai'],
        summary: 'Nothing else.',
        description: 'Nothing else.',
      }),
    ];

    expect(resultIds(records, 'local ai')).toEqual([
      'complete-query-tag',
      'token-tags',
    ]);
  });

  it('ranks more distinct tag tokens before summary and description scores', () => {
    const records = [
      record('summary-heavy', {
        title: 'Local workflows',
        tags: ['Applied AI methods'],
        summary: 'Local AI.',
        description: 'Local AI.',
      }),
      record('tag-heavy', {
        title: 'Local workflows',
        tags: ['Local methods with AI'],
        summary: 'Nothing else.',
        description: 'Nothing else.',
      }),
    ];

    expect(resultIds(records, 'local ai')).toEqual([
      'tag-heavy',
      'summary-heavy',
    ]);
  });

  it('ranks more distinct summary tokens before description tokens', () => {
    const records = [
      record('description-heavy', {
        title: 'Local workflows',
        summary: 'AI systems.',
        description: 'Local AI.',
      }),
      record('summary-heavy', {
        title: 'Local workflows',
        summary: 'Local AI.',
        description: 'Nothing else.',
      }),
    ];

    expect(resultIds(records, 'local ai')).toEqual([
      'summary-heavy',
      'description-heavy',
    ]);
  });

  it('uses distinct description-token count as the final score position', () => {
    const records = [
      record('one-description-token', {
        title: 'Local workflows',
        summary: 'Nothing else.',
        description: 'AI systems.',
      }),
      record('two-description-tokens', {
        title: 'Local workflows',
        summary: 'Nothing else.',
        description: 'Local AI systems.',
      }),
    ];

    expect(resultIds(records, 'local ai')).toEqual([
      'two-description-tokens',
      'one-description-token',
    ]);
  });

  it('breaks equal scores by publication date descending, then NFC ID code units ascending', () => {
    const records = [
      record('e\u0301clair', {
        title: 'Local notes',
        pubDate: '2026-02-01T00:00:00.000Z',
      }),
      record('zebra', {
        title: 'Local notes',
        pubDate: '2026-02-01T00:00:00.000Z',
      }),
      record('newest', {
        title: 'Local notes',
        pubDate: '2026-03-01T00:00:00.000Z',
      }),
    ];

    expect(resultIds(records, 'local')).toEqual([
      'newest',
      'zebra',
      'e\u0301clair',
    ]);
  });

  it('restores complete canonical order for whitespace and does not mutate inputs', () => {
    const records = Object.freeze([
      Object.freeze(
        record('later-id', {
          title: 'Unrelated',
          tags: Object.freeze(['Invented']),
          pubDate: '2026-01-01T00:00:00.000Z',
        }),
      ),
      Object.freeze(
        record('newest', {
          title: 'Unrelated',
          tags: Object.freeze(['Invented']),
          pubDate: '2026-02-01T00:00:00.000Z',
        }),
      ),
      Object.freeze(
        record('earlier-id', {
          title: 'Unrelated',
          tags: Object.freeze(['Invented']),
          pubDate: '2026-01-01T00:00:00.000Z',
        }),
      ),
    ]);

    expect(resultIds(records, ' \n\t ')).toEqual([
      'newest',
      'earlier-id',
      'later-id',
    ]);
    expect(records.map(({ id }) => id)).toEqual([
      'later-id',
      'newest',
      'earlier-id',
    ]);
  });
});
