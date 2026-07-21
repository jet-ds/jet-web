import { describe, expect, it, vi } from 'vitest';
import { EGREGORE_CONTEXT } from '../../../src/features/egregore/config';
import type { LoadedKnowledgeBase } from '../../../src/features/egregore/corpus/repository';
import type {
  ChunkId,
  DocumentId,
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgePackage,
  KnowledgeSection,
  SectionId,
} from '../../../src/features/egregore/corpus/types';
import { estimateTokens } from '../../../src/features/egregore/corpus/segment';
import { rankAndPackContext } from '../../../src/features/egregore/selection/rankAndPack';
import {
  buildSearchIndexArtifact,
  loadSearchIndex,
  MINISEARCH_OPTIONS,
} from '../../../src/features/egregore/selection/searchIndex';
import type { ContextBudget } from '../../../src/features/egregore/selection/types';
import { serializeSourcePayload } from '../../../src/features/egregore/sourcePayload';

const itemMeasurements = vi.hoisted(() => vi.fn<(chunkId: ChunkId) => void>());

vi.mock('../../../src/features/egregore/sourcePayload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/features/egregore/sourcePayload')>();
  return {
    ...actual,
    measureSourcePayloadItem: (source: Parameters<typeof actual.measureSourcePayloadItem>[0]) => {
      itemMeasurements(source.chunkId);
      return actual.measureSourcePayloadItem(source);
    },
  };
});

interface ChunkFixture {
  document: number;
  section: number;
  order: number;
  text: string;
  title?: string;
  description?: string;
  tags?: string[];
  heading?: string;
}

const CORPUS_VERSION = 'a'.repeat(64);
const INDEX_SHA = 'b'.repeat(64);

function budget(knowledgeLimit: number): ContextBudget {
  return { ...EGREGORE_CONTEXT, knowledgeLimit };
}

function chunkId(document: number, section: number, order: number): ChunkId {
  const documentId = `blog:document-${document}`;
  const sectionId = `${documentId}#section-${section}`;
  const digest = ((document + 1) * 10_000 + (section + 1) * 100 + order)
    .toString(16)
    .padStart(64, '0');
  return `${sectionId}:${digest}:0` as ChunkId;
}

async function fixture(
  specs: readonly ChunkFixture[],
  options: { forceOversized?: boolean } = {},
): Promise<LoadedKnowledgeBase> {
  const documentNumbers = [...new Set(specs.map((spec) => spec.document))].sort((a, b) => a - b);
  const documents: KnowledgeDocument[] = documentNumbers.map((number, index) => {
    const first = specs.find((spec) => spec.document === number)!;
    return {
      id: `blog:document-${number}`,
      order: index,
      collection: 'blog',
      slug: `document-${number}`,
      title: first.title ?? `Title ${number}`,
      description: first.description ?? `Description ${number}`,
      canonicalUrl: `https://jetsanchez.com/blog/document-${number}/`,
      tags: first.tags ?? [],
      author: 'Jet Sanchez',
      publishedAt: '2026-01-01T00:00:00.000Z',
      sourcePath: `src/data/blog/document-${number}.mdx`,
      sourceHash: number.toString(16).padStart(64, '1').slice(-64),
    } as KnowledgeDocument;
  });
  const documentOrder = new Map(documents.map((document) => [document.id, document.order]));
  const sectionKeys = [...new Set(specs.map((spec) => `${spec.document}:${spec.section}`))]
    .sort((left, right) => {
      const [leftDocument, leftSection] = left.split(':').map(Number);
      const [rightDocument, rightSection] = right.split(':').map(Number);
      return leftDocument - rightDocument || leftSection - rightSection;
    });
  const sections: KnowledgeSection[] = sectionKeys.map((key) => {
    const [document, section] = key.split(':').map(Number);
    const first = specs.find((spec) => spec.document === document && spec.section === section)!;
    const documentId = `blog:document-${document}` as DocumentId;
    return {
      id: `${documentId}#section-${section}` as SectionId,
      documentId,
      heading: first.heading ?? `Heading ${section}`,
      headingPath: [first.heading ?? `Heading ${section}`],
      order: section,
    };
  });
  const chunks: KnowledgeChunk[] = [...specs]
    .sort((left, right) => (
      (documentOrder.get(`blog:document-${left.document}` as DocumentId) ?? 0)
      - (documentOrder.get(`blog:document-${right.document}` as DocumentId) ?? 0)
      || left.order - right.order
    ))
    .map((spec) => {
      const documentId = `blog:document-${spec.document}` as DocumentId;
      const sectionId = `${documentId}#section-${spec.section}` as SectionId;
      return {
        id: chunkId(spec.document, spec.section, spec.order),
        documentId,
        sectionId,
        text: spec.text,
        estimatedTokens: estimateTokens(spec.text),
        order: spec.order,
        contentHash: chunkId(spec.document, spec.section, spec.order).split(':').at(-2)!,
        sameTextOccurrence: 0,
      };
    });
  const documentsById = new Map(documents.map((document) => [document.id, document]));
  const sectionsById = new Map(sections.map((section) => [section.id, section]));
  const chunksById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const neighborsByChunkId = new Map<ChunkId, { previous?: ChunkId; next?: ChunkId }>();
  for (const section of sections) {
    const siblings = chunks.filter((chunk) => chunk.sectionId === section.id);
    siblings.forEach((chunk, index) => neighborsByChunkId.set(chunk.id, {
      ...(siblings[index - 1] ? { previous: siblings[index - 1].id } : {}),
      ...(siblings[index + 1] ? { next: siblings[index + 1].id } : {}),
    }));
  }
  const payload = chunks.map((chunk, index) => {
    const document = documentsById.get(chunk.documentId)!;
    const section = sectionsById.get(chunk.sectionId)!;
    return {
      citationId: `S${index + 1}` as const,
      documentId: document.id,
      sectionId: section.id,
      chunkId: chunk.id,
      title: document.title,
      canonicalUrl: document.canonicalUrl,
      heading: section.heading,
      text: chunk.text,
    };
  });
  const fullCorpusKnowledgeTokens = serializeSourcePayload(payload).estimatedTokens;
  const packageValue: KnowledgePackage = {
    schemaVersion: '1.0.0',
    segmentationVersion: '1.0.0',
    corpusVersion: CORPUS_VERSION,
    sourceCommit: 'commit-sha',
    documents,
    sections,
    chunks,
    statistics: {
      documentCount: documents.length,
      sectionCount: sections.length,
      chunkCount: chunks.length,
      estimatedContentTokens: chunks.reduce((sum, chunk) => sum + chunk.estimatedTokens, 0),
      fullCorpusKnowledgeTokens: options.forceOversized
        ? fullCorpusKnowledgeTokens + 1_000_000
        : fullCorpusKnowledgeTokens,
    },
  };
  const artifact = buildSearchIndexArtifact(packageValue);

  return {
    package: packageValue,
    searchIndex: await loadSearchIndex(artifact, CORPUS_VERSION),
    documentsById,
    sectionsById,
    chunksById,
    neighborsByChunkId,
    indexSha256: INDEX_SHA,
    indexConfigVersion: artifact.indexConfigVersion,
    miniSearchVersion: artifact.miniSearchVersion,
    stemmerVersion: artifact.stemmerVersion,
  };
}

function fixedResults(
  knowledgeBase: LoadedKnowledgeBase,
  values: Array<[ChunkId, number]>,
): void {
  vi.spyOn(knowledgeBase.searchIndex, 'search').mockReturnValue(values.map(([id, score]) => ({
    id,
    score,
    terms: ['term'],
    queryTerms: ['term'],
    match: { term: ['body'] },
  })));
}

describe('deterministic MiniSearch rank and pack', () => {
  it('preserves MiniSearch scores from all evaluated boosted fields', async () => {
    const knowledgeBase = await fixture([
      { document: 0, section: 0, order: 0, title: 'astral', text: 'plain' },
      { document: 1, section: 0, order: 0, tags: ['astral'], text: 'plain' },
      { document: 2, section: 0, order: 0, heading: 'astral', text: 'plain' },
      { document: 3, section: 0, order: 0, description: 'astral', text: 'plain' },
      { document: 4, section: 0, order: 0, text: 'astral' },
    ], { forceOversized: true });
    const raw = new Map(knowledgeBase.searchIndex.search('astral').map((result) => [result.id, result.score]));
    const result = rankAndPackContext({ query: 'astral', knowledgeBase, budget: budget(100_000) });

    expect(MINISEARCH_OPTIONS.searchOptions.boost).toEqual({
      title: 5, description: 2, tags: 4, heading: 3, body: 1,
    });
    expect(result.diagnostics.directMatchCount).toBe(5);
    expect(result.sources.every((source) => source.rankingScore === raw.get(source.chunkId))).toBe(true);
  });

  it('uses the fixed stop words, stemmer, and five-character prefix behavior', async () => {
    const knowledgeBase = await fixture([
      { document: 0, section: 0, order: 0, text: 'Running retrieval workflows.' },
    ], { forceOversized: true });

    expect(rankAndPackContext({ query: 'the', knowledgeBase, budget: budget(1_000) }).sources).toEqual([]);
    expect(rankAndPackContext({ query: 'runs', knowledgeBase, budget: budget(1_000) }).sources).toHaveLength(1);
    expect(rankAndPackContext({ query: 'retri', knowledgeBase, budget: budget(1_000) }).sources).toHaveLength(1);
    expect(rankAndPackContext({ query: 'retr', knowledgeBase, budget: budget(1_000) }).sources).toEqual([]);
  });

  it('passes no result limit and selects all 25 matching chunks when they fit', async () => {
    const knowledgeBase = await fixture(Array.from({ length: 25 }, (_, index) => ({
      document: index,
      section: 0,
      order: 0,
      text: 'sharedterm',
    })), { forceOversized: true });
    const implementation = knowledgeBase.searchIndex.search.bind(knowledgeBase.searchIndex);
    const search = vi.spyOn(knowledgeBase.searchIndex, 'search').mockImplementation(implementation);

    const result = rankAndPackContext({
      query: 'sharedterm',
      knowledgeBase,
      budget: budget(100_000),
    });

    expect(search).toHaveBeenCalledWith('sharedterm');
    expect(search.mock.calls[0]).toHaveLength(1);
    expect(result.sources).toHaveLength(25);
    expect(result.diagnostics.directMatchCount).toBe(25);
  });

  it('orders direct and adjacent candidates deterministically and deduplicates nominations', async () => {
    const knowledgeBase = await fixture([
      { document: 0, section: 0, order: 0, text: 'zero' },
      { document: 0, section: 0, order: 1, text: 'one' },
      { document: 0, section: 0, order: 2, text: 'two' },
      { document: 0, section: 0, order: 3, text: 'three' },
    ], { forceOversized: true });
    fixedResults(knowledgeBase, [
      [chunkId(0, 0, 3), 5],
      [chunkId(0, 0, 1), 10],
    ]);

    const result = rankAndPackContext({ query: 'term', knowledgeBase, budget: budget(10_000) });

    expect(result.sources.map((source) => [source.chunkOrder, source.selectionReason, source.rankingScore]))
      .toEqual([
        [1, 'lexical-match', 10],
        [3, 'lexical-match', 5],
        [0, 'heading-expansion', 5],
        [2, 'heading-expansion', 5],
      ]);
    expect(new Set(result.sources.map((source) => source.chunkId)).size).toBe(4);
    expect(result.diagnostics.expansionCandidateCount).toBe(2);
  });

  it('expands only immediate same-section neighbors and fails closed on corrupt lookups', async () => {
    const knowledgeBase = await fixture([
      { document: 0, section: 0, order: 0, text: 'before' },
      { document: 0, section: 0, order: 1, text: 'matched' },
      { document: 0, section: 1, order: 2, text: 'other section' },
    ], { forceOversized: true });
    fixedResults(knowledgeBase, [[chunkId(0, 0, 1), 4]]);
    const result = rankAndPackContext({ query: 'term', knowledgeBase, budget: budget(10_000) });

    expect(result.sources.map((source) => source.chunkId)).toEqual([
      chunkId(0, 0, 1),
      chunkId(0, 0, 0),
    ]);

    knowledgeBase.neighborsByChunkId = new Map([
      [chunkId(0, 0, 1), { next: chunkId(0, 1, 2) }],
    ]);
    expect(() => rankAndPackContext({ query: 'term', knowledgeBase, budget: budget(10_000) }))
      .toThrow(/neighbor.*section/i);

    fixedResults(knowledgeBase, [['blog:unknown#section:dead:0' as ChunkId, 1]]);
    expect(() => rankAndPackContext({ query: 'term', knowledgeBase, budget: budget(10_000) }))
      .toThrow(/unknown.*chunk/i);
  });

  it('uses stable chunk ID after equal scores, reasons, and explicit orders', async () => {
    const knowledgeBase = await fixture([
      { document: 0, section: 0, order: 0, text: 'first' },
      { document: 1, section: 0, order: 0, text: 'second' },
    ], { forceOversized: true });
    const first = chunkId(0, 0, 0);
    const second = chunkId(1, 0, 0);
    knowledgeBase.documentsById = new Map([
      [first.split('#')[0] as DocumentId, { ...knowledgeBase.documentsById.get('blog:document-0')!, order: 0 }],
      [second.split('#')[0] as DocumentId, { ...knowledgeBase.documentsById.get('blog:document-1')!, order: 0 }],
    ]);
    fixedResults(knowledgeBase, [[second, 3], [first, 3]]);

    const result = rankAndPackContext({ query: 'term', knowledgeBase, budget: budget(10_000) });
    expect(result.sources.map((source) => source.chunkId)).toEqual([first, second]);
  });

  it('appends unmatched chunks canonically only when the verified complete corpus fits', async () => {
    const knowledgeBase = await fixture([
      { document: 0, section: 0, order: 0, text: 'unmatched zero' },
      { document: 0, section: 1, order: 1, text: 'unmatched one' },
      { document: 0, section: 2, order: 2, text: 'needle' },
    ]);
    const limit = knowledgeBase.package.statistics.fullCorpusKnowledgeTokens;
    const result = rankAndPackContext({ query: 'needle', knowledgeBase, budget: budget(limit) });

    expect(result.sources.map((source) => [source.chunkOrder, source.selectionReason])).toEqual([
      [2, 'lexical-match'],
      [0, 'complete-corpus'],
      [1, 'complete-corpus'],
    ]);
    expect(result.diagnostics.completeCorpusIncluded).toBe(true);
    expect(result.estimatedTokens).toBe(limit);
    expect(serializeSourcePayload(result.sources).estimatedTokens).toBe(limit);

    knowledgeBase.package.statistics.fullCorpusKnowledgeTokens = 1;
    expect(() => rankAndPackContext({ query: 'needle', knowledgeBase, budget: budget(limit) }))
      .toThrow(/full-corpus.*statistic/i);
  });

  it('skips an oversized candidate, continues packing, and assigns citations after acceptance', async () => {
    const knowledgeBase = await fixture([
      { document: 0, section: 0, order: 0, text: 'x'.repeat(2_000) },
      { document: 1, section: 0, order: 0, text: 'small' },
      { document: 2, section: 0, order: 0, text: 'tiny' },
    ], { forceOversized: true });
    fixedResults(knowledgeBase, [
      [chunkId(0, 0, 0), 10],
      [chunkId(1, 0, 0), 9],
      [chunkId(2, 0, 0), 8],
    ]);
    const smallOnly = serializeSourcePayload([{
      citationId: 'S1',
      documentId: 'blog:document-1',
      sectionId: 'blog:document-1#section-0',
      chunkId: chunkId(1, 0, 0),
      title: 'Title 1',
      canonicalUrl: 'https://jetsanchez.com/blog/document-1/',
      heading: 'Heading 0',
      text: 'small',
    }]).estimatedTokens;

    const result = rankAndPackContext({ query: 'term', knowledgeBase, budget: budget(smallOnly) });

    expect(result.sources.map((source) => [source.citationId, source.text])).toEqual([['S1', 'small']]);
    expect(result.diagnostics.rejectedForBudgetCount).toBe(2);
    expect(result.estimatedTokens).toBe(serializeSourcePayload(result.sources).estimatedTokens);
  });

  it('resolves and serializes each large-fixture candidate once without scanning unmatched content', async () => {
    const candidateCount = 100;
    const knowledgeBase = await fixture(Array.from({ length: candidateCount }, (_, order) => ({
      document: 0,
      section: 0,
      order,
      text: `needle ${order}`,
    })), { forceOversized: true });
    const counts = { document: 0, section: 0, chunk: 0, neighbor: 0 };
    const countingMap = <K, V>(map: ReadonlyMap<K, V>, key: keyof typeof counts): ReadonlyMap<K, V> => ({
      get size() { return map.size; },
      get(id: K) { counts[key] += 1; return map.get(id); },
      has: map.has.bind(map),
      entries: map.entries.bind(map),
      keys: map.keys.bind(map),
      values: map.values.bind(map),
      forEach: map.forEach.bind(map),
      [Symbol.iterator]: map[Symbol.iterator].bind(map),
    });
    knowledgeBase.documentsById = countingMap(knowledgeBase.documentsById, 'document');
    knowledgeBase.sectionsById = countingMap(knowledgeBase.sectionsById, 'section');
    knowledgeBase.chunksById = countingMap(knowledgeBase.chunksById, 'chunk');
    knowledgeBase.neighborsByChunkId = countingMap(knowledgeBase.neighborsByChunkId, 'neighbor');
    const noScan = <T>(values: T[]): T[] => new Proxy(values, {
      get(target, property, receiver) {
        if (property === Symbol.iterator || property === 'find' || property === 'map' || property === 'forEach') {
          throw new Error('oversized corpus scan');
        }
        return Reflect.get(target, property, receiver);
      },
    });
    knowledgeBase.package.documents = noScan(knowledgeBase.package.documents);
    knowledgeBase.package.sections = noScan(knowledgeBase.package.sections);
    knowledgeBase.package.chunks = noScan(knowledgeBase.package.chunks);
    itemMeasurements.mockClear();

    const result = rankAndPackContext({ query: 'needle', knowledgeBase, budget: budget(10_000) });

    expect(result.sources).toHaveLength(candidateCount);
    expect(counts).toEqual({
      document: candidateCount,
      section: candidateCount,
      chunk: candidateCount,
      neighbor: candidateCount,
    });
    expect(itemMeasurements).toHaveBeenCalledTimes(candidateCount);
    expect(new Set(itemMeasurements.mock.calls.map(([id]) => id)).size).toBe(candidateCount);
  });

  it('returns an empty valid selection for an unmatched oversized corpus without leaking text', async () => {
    const knowledgeBase = await fixture([
      { document: 0, section: 0, order: 0, text: 'private-looking source text' },
    ], { forceOversized: true });
    const result = rankAndPackContext({
      query: 'secret unmatched question',
      knowledgeBase,
      budget: budget(10),
    });

    expect(result).toMatchObject({
      pipeline: 'minisearch-rank-pack',
      indexSha256: INDEX_SHA,
      indexConfigVersion: '1.1.0',
      miniSearchVersion: '7.2.0',
      stemmerVersion: '2.0.1',
      corpusVersion: CORPUS_VERSION,
      sources: [],
      estimatedTokens: estimateTokens('[]'),
      diagnostics: {
        directMatchCount: 0,
        expansionCandidateCount: 0,
        packedCount: 0,
        rejectedForBudgetCount: 0,
        completeCorpusIncluded: false,
        knowledgeTokens: estimateTokens('[]'),
      },
    });
    expect(result.diagnostics.rankingMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(result.diagnostics)).not.toContain('secret unmatched question');
    expect(JSON.stringify(result.diagnostics)).not.toContain('private-looking source text');
  });
});
