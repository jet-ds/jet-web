import MiniSearch from 'minisearch';
import { describe, expect, it, vi } from 'vitest';
import { buildKnowledgeBase, type AssistantSourceEntry } from '../../../src/features/jets-ghost/corpus/build';
import {
  buildSearchIndexArtifact,
  INDEX_CONFIG_VERSION,
  loadSearchIndex,
  MINISEARCH_OPTIONS,
  MINISEARCH_VERSION,
  STEMMER_VERSION,
} from '../../../src/features/jets-ghost/selection/searchIndex';

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
    expect(INDEX_CONFIG_VERSION).toBe('1.0.0');
    expect(MINISEARCH_VERSION).toBe('7.2.0');
    expect(STEMMER_VERSION).toBe('2.0.1');
  });
});
