import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canonicalSerialize } from '../../../src/features/jets-ghost/corpus/build';
import type { AssistantSourceEntry } from '../../../src/features/jets-ghost/corpus/build';
import type { BlogFrontmatter } from '../../../src/schemas/content';
import {
  buildFromAstroCollections,
  createAstroKnowledgeBaseLoader,
  repositorySourcePath,
  type AstroCorpusDependencies,
} from '../../../src/features/jets-ghost/corpus/astro';
import {
  getAstroContentCalls,
  setAstroContentStub,
} from '../../fixtures/astroContent';

function blogData(
  assistant = true,
  status: 'draft' | 'published' = 'published',
): BlogFrontmatter {
  return {
    title: 'Synthetic assistant source',
    description: 'A synthetic fixture for the Astro corpus adapter.',
    pubDate: new Date('2026-01-01T00:00:00.000Z'),
    author: 'Jet Sanchez',
    tags: ['synthetic'],
    status,
    assistant,
  };
}

type BlogSourceEntry = Extract<AssistantSourceEntry, { collection: 'blog' }>;

function adapterEntry(overrides: Partial<BlogSourceEntry> = {}): BlogSourceEntry {
  return {
    collection: 'blog',
    slug: 'synthetic',
    sourcePath: 'src/data/blog/synthetic.mdx',
    tracked: true,
    body: 'Synthetic body.',
    data: blogData(),
    ...overrides,
  };
}

function dependencies(entries: AssistantSourceEntry[]): AstroCorpusDependencies {
  return {
    root: '/repository',
    environment: {},
    loadCollections: vi.fn(async () => ({
      blog: entries.filter((entry) => entry.collection === 'blog').map((entry) => ({
        id: entry.slug,
        filePath: `/repository/${entry.sourcePath}`,
        body: entry.body,
        data: entry.data,
      })),
      works: entries.filter((entry) => entry.collection === 'works').map((entry) => ({
        id: entry.slug,
        filePath: `/repository/${entry.sourcePath}`,
        body: entry.body,
        data: entry.data,
      })),
    })),
    loadTrackedPaths: vi.fn(() => new Set(entries.map((entry) => entry.sourcePath))),
    readHead: vi.fn(async () => 'abc'),
  };
}

describe('Astro corpus adapter', () => {
  it('loads every entry before generator policy validation', async () => {
    const included = adapterEntry();
    const excluded = adapterEntry({
      slug: 'excluded',
      sourcePath: 'src/data/blog/excluded.mdx',
      data: blogData(false),
    });
    const invalidDraft = adapterEntry({
      slug: 'invalid-draft',
      sourcePath: 'src/data/blog/invalid-draft.mdx',
      data: blogData(true, 'draft'),
    });
    const deps = dependencies([included, excluded, invalidDraft]);

    await expect(buildFromAstroCollections(deps)).rejects.toThrow(/assistant.*published/i);
    expect(deps.loadCollections).toHaveBeenCalledOnce();
  });

  it('normalizes Loader API paths and rejects repository escapes', () => {
    expect(repositorySourcePath('/repository', '/repository/src/data/blog/example.mdx'))
      .toBe('src/data/blog/example.mdx');
    expect(repositorySourcePath('/repository', 'src/data/works/example.mdx'))
      .toBe('src/data/works/example.mdx');
    expect(() => repositorySourcePath('/repository', '/outside/example.mdx'))
      .toThrow(/outside the repository/i);
  });

  it('fails closed when Git tracking cannot be established', async () => {
    const deps = dependencies([adapterEntry()]);
    deps.loadTrackedPaths = vi.fn(() => {
      throw new Error('Git unavailable');
    });

    await expect(buildFromAstroCollections(deps)).rejects.toThrow(/git unavailable/i);
  });

  it('memoizes one shared package build', async () => {
    const deps = dependencies([adapterEntry()]);
    const load = createAstroKnowledgeBaseLoader(deps);
    const first = load();
    const second = load();

    expect(second).toBe(first);
    expect(await second).toBe(await first);
    expect(deps.loadCollections).toHaveBeenCalledOnce();
    expect(deps.readHead).toHaveBeenCalledOnce();
  });
});

describe('static corpus endpoint handlers', () => {
  beforeEach(() => {
    vi.resetModules();
    setAstroContentStub({
      blog: [{
        id: 'synthetic-endpoint',
        filePath: resolve('src/data/blog/how-to-install-claude-code-cli-2026.mdx'),
        body: 'Synthetic endpoint body.',
        data: blogData(),
      }],
      works: [],
    });
  });

  it('share one package and return exact canonical bytes and headers', async () => {
    const [{ GET: manifestGet }, { GET: contentGet }, { GET: indexGet }] = await Promise.all([
      import('../../../src/pages/assistant/corpus/manifest.json'),
      import('../../../src/pages/assistant/corpus/content.json'),
      import('../../../src/pages/assistant/corpus/index.json'),
    ]);
    const [manifestResponse, contentResponse, indexResponse] = await Promise.all([
      manifestGet({} as never),
      contentGet({} as never),
      indexGet({} as never),
    ]);
    const [manifestText, contentText, indexText] = await Promise.all([
      manifestResponse.text(),
      contentResponse.text(),
      indexResponse.text(),
    ]);

    expect(getAstroContentCalls().sort()).toEqual(['blog', 'works']);
    for (const response of [manifestResponse, contentResponse, indexResponse]) {
      expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate');
      expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    }
    expect(manifestText).toBe(canonicalSerialize(JSON.parse(manifestText)));
    expect(contentText).toBe(canonicalSerialize(JSON.parse(contentText)));
    expect(indexText).toBe(canonicalSerialize(JSON.parse(indexText)));

    const manifest = JSON.parse(manifestText) as Record<string, unknown>;
    const content = JSON.parse(contentText) as Record<string, unknown>;
    const index = JSON.parse(indexText) as Record<string, unknown>;
    expect(content.corpusVersion).toBe(manifest.corpusVersion);
    expect(index.corpusVersion).toBe(manifest.corpusVersion);
    expect(manifest.contentSha256).toBe(
      createHash('sha256').update(contentText, 'utf8').digest('hex'),
    );
    expect(manifest.indexSha256).toBe(
      createHash('sha256').update(indexText, 'utf8').digest('hex'),
    );
  });
});
