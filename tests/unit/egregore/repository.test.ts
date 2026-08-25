import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildKnowledgeBase,
  canonicalSerialize,
  type AssistantSourceEntry,
} from '../../../src/features/egregore/corpus/build';
import { StaticKnowledgeRepository } from '../../../src/features/egregore/corpus/repository';
import type {
  CorpusManifest,
  KnowledgePackage,
  SearchIndexArtifact,
} from '../../../src/features/egregore/corpus/types';

const URLS = [
  '/assistant/corpus/manifest.json',
  '/assistant/corpus/content.json',
  '/assistant/corpus/index.json',
] as const;

function source(): AssistantSourceEntry {
  return {
    collection: 'blog',
    slug: 'repository',
    sourcePath: 'src/data/blog/repository.mdx',
    tracked: true,
    body: [
      'Introduction.',
      '## First',
      '```txt\nFirst code block.\n```',
      '```txt\nSecond code block.\n```',
      '```txt\nThird code block.\n```',
      '## Second',
      '```txt\nFourth code block.\n```',
      '```txt\nFifth code block.\n```',
    ].join('\n\n'),
    data: {
      title: 'Repository fixture',
      description: 'Tests the static repository.',
      summary: 'An invented summary for the static repository fixture.',
      pubDate: new Date('2026-01-01T00:00:00.000Z'),
      author: 'Jet Sanchez',
      tags: ['repository'],
      status: 'published',
      assistant: true,
      image: {
        url: 'https://assets.public.blob.vercel-storage.com/images/blog/repository-fixture-a1b2c3d4.png',
        alt: 'An invented static repository illustration',
        width: 1920,
        height: 1080,
      },
    },
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

type Fixture = {
  manifest: CorpusManifest;
  content: KnowledgePackage;
  index: SearchIndexArtifact;
};

function fixture(): Fixture {
  return structuredClone(buildKnowledgeBase([source()], 'abc'));
}

function installFetch(value: Fixture, preserveManifestHashes = false) {
  const contentText = canonicalSerialize(value.content);
  const indexText = canonicalSerialize(value.index);
  const manifest = {
    ...value.manifest,
    contentSha256: preserveManifestHashes
      ? value.manifest.contentSha256
      : sha256(contentText),
    indexSha256: preserveManifestHashes
      ? value.manifest.indexSha256
      : sha256(indexText),
  };
  const payloads = new Map<string, string>([
    [URLS[0], canonicalSerialize(manifest)],
    [URLS[1], contentText],
    [URLS[2], indexText],
  ]);
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, _init?: RequestInit) => {
      const text = payloads.get(String(input));
      return text === undefined
        ? new Response('Not found', { status: 404 })
        : new Response(text, { status: 200 });
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('StaticKnowledgeRepository', () => {
  it('loads all artifacts with credential-free requests and exact lookup coverage', async () => {
    const value = fixture();
    const fetchMock = installFetch(value);
    const repository = new StaticKnowledgeRepository();
    const loaded = await repository.load();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(URLS);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toMatchObject({ credentials: 'omit' });
      expect(init).not.toHaveProperty('headers');
    }
    expect([...loaded.documentsById.keys()]).toEqual(
      value.content.documents.map(({ id }) => id),
    );
    expect([...loaded.sectionsById.keys()]).toEqual(
      value.content.sections.map(({ id }) => id),
    );
    expect([...loaded.chunksById.keys()]).toEqual(
      value.content.chunks.map(({ id }) => id),
    );
    expect(loaded.searchIndex.search('repository').length).toBeGreaterThan(0);
  });

  it('links only canonical previous and next chunks in the same section', async () => {
    const value = fixture();
    installFetch(value);
    const loaded = await new StaticKnowledgeRepository().load();

    for (const section of value.content.sections) {
      const chunks = value.content.chunks.filter(
        (chunk) => chunk.sectionId === section.id,
      );
      chunks.forEach((chunk, index) => {
        expect(loaded.neighborsByChunkId.get(chunk.id)).toEqual({
          ...(chunks[index - 1] ? { previous: chunks[index - 1].id } : {}),
          ...(chunks[index + 1] ? { next: chunks[index + 1].id } : {}),
        });
      });
    }
  });

  it('memoizes in memory and drops all retained state on unload', async () => {
    const value = fixture();
    const fetchMock = installFetch(value);
    const repository = new StaticKnowledgeRepository();
    const first = await repository.load();
    expect(await repository.load()).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    repository.unload();
    expect(await repository.load()).not.toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it.each([
    [
      'content corpus version',
      (value: Fixture) => {
        value.content.corpusVersion = 'stale';
      },
      false,
    ],
    [
      'index corpus version',
      (value: Fixture) => {
        value.index.corpusVersion = 'stale';
      },
      false,
    ],
    [
      'content byte hash',
      (value: Fixture) => {
        value.manifest.contentSha256 = '0'.repeat(64);
      },
      true,
    ],
    [
      'index byte hash',
      (value: Fixture) => {
        value.manifest.indexSha256 = '0'.repeat(64);
      },
      true,
    ],
    [
      'index config version',
      (value: Fixture) => {
        value.index.indexConfigVersion = 'stale' as '1.1.0';
      },
      false,
    ],
    [
      'MiniSearch version',
      (value: Fixture) => {
        value.index.miniSearchVersion = 'stale' as '7.2.0';
      },
      false,
    ],
    [
      'stemmer version',
      (value: Fixture) => {
        value.index.stemmerVersion = 'stale' as '2.0.1';
      },
      false,
    ],
    [
      'indexed count',
      (value: Fixture) => {
        value.manifest.indexedChunkCount += 1;
      },
      false,
    ],
    [
      'missing chunk id',
      (value: Fixture) => {
        value.index.chunkIds.pop();
      },
      false,
    ],
    [
      'duplicate chunk id',
      (value: Fixture) => {
        value.index.chunkIds[1] = value.index.chunkIds[0];
      },
      false,
    ],
    [
      'unknown chunk id',
      (value: Fixture) => {
        value.index.chunkIds[0] = 'blog:unknown#section:hash:0';
      },
      false,
    ],
    [
      'unknown serialized index id',
      (value: Fixture) => {
        (value.index.index.documentIds as Record<string, string>)['0'] =
          'blog:unknown#section:hash:0';
      },
      false,
    ],
    [
      'missing section parent',
      (value: Fixture) => {
        value.content.sections[0].documentId = 'blog:unknown';
      },
      false,
    ],
    [
      'missing chunk parent',
      (value: Fixture) => {
        value.content.chunks[0].sectionId = 'blog:repository#unknown';
      },
      false,
    ],
    [
      'invalid neighbor order',
      (value: Fixture) => {
        value.content.chunks[1].order = value.content.chunks[0].order;
      },
      false,
    ],
    [
      'interleaved section order',
      (value: Fixture) => {
        value.content.chunks[1].sectionId = value.content.sections[2].id;
      },
      false,
    ],
    [
      'derived token statistics',
      (value: Fixture) => {
        value.content.statistics.estimatedContentTokens += 1;
        value.manifest.statistics.estimatedContentTokens += 1;
      },
      false,
    ],
    [
      'derived full-corpus payload statistics',
      (value: Fixture) => {
        value.content.statistics.fullCorpusKnowledgeTokens += 1;
        value.manifest.statistics.fullCorpusKnowledgeTokens += 1;
      },
      false,
    ],
    [
      'stale chunk content hash behind a valid outer hash',
      (value: Fixture) => {
        value.content.chunks[0].text = 'Tampered chunk text.';
      },
      false,
    ],
    [
      'stale corpus version behind a valid outer hash',
      (value: Fixture) => {
        value.content.documents[0].title = 'Tampered title';
      },
      false,
    ],
  ] as Array<[string, (value: Fixture) => void, boolean]>)(
    'rejects %s mismatch or corruption',
    async (_label, mutate, preserveManifestHashes) => {
      const value = fixture();
      mutate(value);
      installFetch(value, preserveManifestHashes);

      await expect(new StaticKnowledgeRepository().load()).rejects.toThrow();
    },
  );
});
