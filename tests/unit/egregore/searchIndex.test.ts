import MiniSearch from 'minisearch';
import { describe, expect, it, vi } from 'vitest';
import {
  buildKnowledgeBase,
  canonicalSerialize,
  type AssistantSourceEntry,
} from '../../../src/features/egregore/corpus/build';
import type { KnowledgePackage } from '../../../src/features/egregore/corpus/types';
import {
  buildSearchIndexArtifact,
  INDEX_CONFIG_VERSION,
  loadSearchIndex,
  MINISEARCH_OPTIONS,
  MINISEARCH_VERSION,
  STEMMER_VERSION,
} from '../../../src/features/egregore/selection/searchIndex';

function source(slug: string, body: string, tags: string[] = []): AssistantSourceEntry {
  return {
    collection: 'blog',
    slug,
    sourcePath: `src/data/blog/${slug}.mdx`,
    tracked: true,
    body,
    data: {
      title: slug === 'metadata' ? 'Astral title' : `Title ${slug}`,
      description: slug === 'metadata' ? 'Nebular description' : `Description ${slug}`,
      pubDate: new Date('2026-01-01T00:00:00.000Z'),
      author: 'Jet Sanchez',
      tags,
      status: 'published',
      assistant: true,
    },
  };
}

function buildFixture(order: 'forward' | 'reverse' = 'forward') {
  const entries = [
    source('metadata', 'Introduction text.\n\n## Orbital heading\n\nRunning retrieval workflows.', ['quasar-tag']),
    source('prefix', 'A retrieval system indexes evidence.'),
  ];
  return buildKnowledgeBase(order === 'forward' ? entries : entries.reverse(), 'abc');
}

function unicodeContent(secondForm: 'NFC' | 'NFD'): KnowledgePackage {
  const form = (value: string): string => value.normalize(secondForm);
  const firstId = `blog:first#evidence:${'1'.repeat(64)}:0` as const;
  const secondId = `blog:second#evidence:${'2'.repeat(64)}:0` as const;
  return {
    schemaVersion: '1.0.0',
    segmentationVersion: '1.0.0',
    corpusVersion: 'a'.repeat(64),
    sourceCommit: 'abc',
    documents: [
      {
        id: 'blog:first',
        order: 0,
        collection: 'blog',
        slug: 'first',
        title: 'Café title',
        description: 'Résumé description',
        canonicalUrl: 'https://jetsanchez.com/blog/first/',
        tags: ['Crème'],
        author: 'Jet Sanchez',
        publishedAt: '2026-01-01T00:00:00.000Z',
        sourcePath: 'src/data/blog/first.mdx',
        sourceHash: '3'.repeat(64),
      },
      {
        id: 'blog:second',
        order: 1,
        collection: 'blog',
        slug: 'second',
        title: form('Café title'),
        description: form('Résumé description'),
        canonicalUrl: 'https://jetsanchez.com/blog/second/',
        tags: [form('Crème')],
        author: 'Jet Sanchez',
        publishedAt: '2026-01-02T00:00:00.000Z',
        sourcePath: 'src/data/blog/second.mdx',
        sourceHash: '4'.repeat(64),
      },
    ],
    sections: [
      {
        id: 'blog:first#evidence',
        documentId: 'blog:first',
        heading: 'Évidence',
        headingPath: ['Évidence'],
        order: 0,
      },
      {
        id: 'blog:second#evidence',
        documentId: 'blog:second',
        heading: form('Évidence'),
        headingPath: [form('Évidence')],
        order: 0,
      },
    ],
    chunks: [
      {
        id: firstId,
        documentId: 'blog:first',
        sectionId: 'blog:first#evidence',
        text: 'Touché body',
        estimatedTokens: 3,
        order: 0,
        contentHash: '1'.repeat(64),
        sameTextOccurrence: 0,
      },
      {
        id: secondId,
        documentId: 'blog:second',
        sectionId: 'blog:second#evidence',
        text: form('Touché body'),
        estimatedTokens: 3,
        order: 0,
        contentHash: '2'.repeat(64),
        sameTextOccurrence: 0,
      },
    ],
    statistics: {
      documentCount: 2,
      sectionCount: 2,
      chunkCount: 2,
      estimatedContentTokens: 6,
      fullCorpusKnowledgeTokens: 20,
    },
  };
}

describe('deterministic MiniSearch artifact', () => {
  it('is byte-equivalent for canonical content regardless of source input order', () => {
    const forward = buildFixture('forward');
    const reverse = buildFixture('reverse');
    expect(buildSearchIndexArtifact(forward.content))
      .toEqual(buildSearchIndexArtifact(reverse.content));
  });

  it('indexes every canonical chunk exactly once', () => {
    const result = buildFixture();

    expect(result.index.chunkIds).toEqual(result.content.chunks.map((chunk) => chunk.id));
    expect(new Set(result.index.chunkIds).size).toBe(result.content.chunks.length);
    expect(result.index.chunkCount).toBe(result.content.chunks.length);
  });

  it('canonicalizes every indexed string before serialization and hydration', async () => {
    const mixed = unicodeContent('NFD');
    const canonical = unicodeContent('NFC');
    expect(canonicalSerialize(mixed)).toBe(canonicalSerialize(canonical));

    const mixedArtifact = buildSearchIndexArtifact(mixed);
    const canonicalArtifact = buildSearchIndexArtifact(canonical);
    expect(canonicalSerialize(mixedArtifact)).toBe(canonicalSerialize(canonicalArtifact));

    const deliveredArtifact = JSON.parse(
      canonicalSerialize(mixedArtifact),
    ) as typeof mixedArtifact;
    const index = await loadSearchIndex(deliveredArtifact, mixed.corpusVersion);
    const expectedIds = mixed.chunks.map((chunk) => chunk.id).sort();
    for (const term of ['café', 'résumé', 'crème', 'évidence', 'touché', 'cafe\u0301']) {
      expect(index.search(term).map((result) => result.id).sort()).toEqual(expectedIds);
    }
  });

  it('searches metadata and applies stop words, stemming, and five-character prefixes', async () => {
    const fixture = buildFixture();
    const index = await loadSearchIndex(fixture.index, fixture.content.corpusVersion);
    const metadataDocumentId = 'blog:metadata';

    for (const term of ['astral', 'nebular', 'quasar-tag', 'orbital', 'running']) {
      expect(index.search(term).some((result) => result.id.startsWith(metadataDocumentId))).toBe(true);
    }
    expect(index.search('runs').some((result) => result.id.startsWith(metadataDocumentId))).toBe(true);
    expect(index.search('the')).toEqual([]);
    expect(index.search('retri').length).toBeGreaterThan(0);
    expect(index.search('retr')).toEqual([]);
  });

  it('drops one-character possessive and version fragments while retaining meaningful terms', () => {
    const processTerm = MINISEARCH_OPTIONS.processTerm;

    expect(processTerm('s')).toBeNull();
    expect(processTerm('2')).toBeNull();
    expect(processTerm('1')).toBeNull();
    expect(processTerm('AI')).toBe('ai');
    expect(processTerm('record')).toBe('record');
  });

  it('hydrates with the exact checked-in options', async () => {
    const fixture = buildFixture();
    const implementation = MiniSearch.loadJSAsync.bind(MiniSearch);
    const spy = vi.spyOn(MiniSearch, 'loadJSAsync').mockImplementation(implementation);

    await loadSearchIndex(fixture.index, fixture.content.corpusVersion);

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(fixture.index.index, MINISEARCH_OPTIONS);
  });

  it.each([
    ['corpus', { corpusVersion: 'stale' }],
    ['config', { indexConfigVersion: 'stale' }],
    ['MiniSearch', { miniSearchVersion: 'stale' }],
    ['stemmer', { stemmerVersion: 'stale' }],
  ])('fails closed for stale %s versions', async (_label, mutation) => {
    const fixture = buildFixture();
    const stale = { ...fixture.index, ...mutation } as typeof fixture.index;

    await expect(loadSearchIndex(stale, fixture.content.corpusVersion)).rejects.toThrow(/version/i);
  });

  it('pins the evaluated index dependency versions', () => {
    expect(INDEX_CONFIG_VERSION).toBe('1.1.0');
    expect(MINISEARCH_VERSION).toBe('7.2.0');
    expect(STEMMER_VERSION).toBe('2.0.1');
  });
});
