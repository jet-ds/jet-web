import { describe, expect, it } from 'vitest';
import {
  KNOWN_CHATBOT_PATHNAMES,
  containChatbotBlobs,
  type BlobContainmentDependencies,
  type BlobListPage,
} from '../../../scripts/contain-chatbot-blobs';

const blobOrigin = 'https://vyge4wbmw8jgd8rh.public.blob.vercel-storage.com';
const beforePath = 'docs/verification/containment/chatbot-blobs-before.json';
const afterPath = 'docs/verification/containment/chatbot-blobs-after.json';

function blob(pathname: string, size = 100) {
  return {
    pathname,
    url: `${blobOrigin}/${pathname}`,
    size,
    uploadedAt: new Date('2026-07-11T07:00:00.000Z'),
  };
}

function completeInventory() {
  return [
    ...KNOWN_CHATBOT_PATHNAMES.map((pathname, index) => blob(pathname, 100 + index)),
    blob('chatbot/obsolete-extra.json', 200),
  ];
}

function evidenceFor(entries = completeInventory()) {
  return entries
    .map((entry) => ({ ...entry, uploadedAt: entry.uploadedAt.toISOString() }))
    .sort((left, right) => left.pathname.localeCompare(right.pathname));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

function canonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

type HarnessOptions = {
  pages?: BlobListPage[];
  relists?: BlobListPage[];
  probeStatus?: number;
  files?: Map<string, string>;
  deleteError?: string;
};

function makeHarness(options: HarnessOptions = {}) {
  const initialPages = options.pages ?? [{ blobs: completeInventory(), hasMore: false }];
  const relists = options.relists ?? [{ blobs: [], hasMore: false }];
  const files = new Map(options.files ?? []);
  const cursors: Array<string | undefined> = [];
  const deleted: string[][] = [];
  const fetched: Array<{ url: string; init: RequestInit | undefined }> = [];
  const writes: Array<{ path: string; contents: string }> = [];
  const reads: string[] = [];
  const outputs: string[] = [];
  const sleeps: number[] = [];
  let initialIndex = 0;
  let relistIndex = 0;
  let deletingStarted = false;

  const dependencies = {
    async list(cursor?: string) {
      cursors.push(cursor);
      if (!deletingStarted) {
        const page = initialPages[Math.min(initialIndex, initialPages.length - 1)];
        initialIndex += 1;
        return page;
      }
      const page = relists[Math.min(relistIndex, relists.length - 1)];
      relistIndex += 1;
      return page;
    },
    async delete(urls: string[]) {
      deletingStarted = true;
      deleted.push([...urls]);
      if (options.deleteError) throw new Error(options.deleteError);
    },
    async fetch(url: string, init?: RequestInit) {
      fetched.push({ url, init });
      return { status: options.probeStatus ?? 404 };
    },
    now: () => new Date('2026-07-13T04:05:06.789Z'),
    async sleep(milliseconds: number) {
      sleeps.push(milliseconds);
    },
    exists(path: string) {
      return files.has(path);
    },
    readEvidence(path: string) {
      reads.push(path);
      const contents = files.get(path);
      if (contents === undefined) throw new Error('TEST_EVIDENCE_NOT_FOUND');
      return contents;
    },
    writeEvidence(path: string, contents: string) {
      if (path === beforePath && files.has(path)) throw new Error('TEST_BEFORE_OVERWRITE');
      files.set(path, contents);
      writes.push({ path, contents });
    },
    output(contents: string) {
      outputs.push(contents);
    },
  } as BlobContainmentDependencies;

  return {
    dependencies,
    files,
    cursors,
    deleted,
    fetched,
    writes,
    reads,
    outputs,
    sleeps,
  };
}

describe('chatbot Blob containment', () => {
  it('pages through the complete prefix and prints a canonical sanitizer-safe dry run', async () => {
    const known = KNOWN_CHATBOT_PATHNAMES.map((pathname, index) => blob(pathname, 100 + index));
    const extra = blob('chatbot/obsolete-extra.json', 200);
    const harness = makeHarness({
      pages: [
        { blobs: known.slice(0, 2), cursor: 'next-page', hasMore: true },
        { blobs: [...known.slice(2), extra], hasMore: false },
      ],
    });

    const result = await containChatbotBlobs([], harness.dependencies);
    const expectedInventory = evidenceFor([...known, extra]);

    expect(result).toMatchObject({ mode: 'dry-run', state: 'FRESH', before: expectedInventory });
    expect(harness.cursors).toEqual([undefined, 'next-page']);
    expect(harness.deleted).toEqual([]);
    expect(harness.writes).toEqual([]);
    expect(harness.outputs).toEqual([canonicalJson({
      inventory: expectedInventory,
      mode: 'dry-run',
      state: 'FRESH',
    })]);
  });

  it('refuses to delete or probe without explicit --execute', async () => {
    const harness = makeHarness();

    await containChatbotBlobs([], harness.dependencies);

    expect(harness.deleted).toEqual([]);
    expect(harness.fetched).toEqual([]);
    expect(harness.writes).toEqual([]);
    expect(harness.outputs).toHaveLength(1);
  });

  it('FRESH atomically preserves canonical before evidence before deleting all objects', async () => {
    const harness = makeHarness();

    const result = await containChatbotBlobs(['--execute'], harness.dependencies);
    const expectedBefore = evidenceFor();

    expect(result).toMatchObject({ state: 'FRESH', before: expectedBefore, after: [] });
    expect(harness.deleted).toEqual([expectedBefore.map((entry) => entry.url)]);
    expect(harness.writes).toEqual([
      { path: beforePath, contents: canonicalJson(expectedBefore) },
      { path: afterPath, contents: canonicalJson([]) },
    ]);
    expect(harness.files.get(beforePath)).toBe(canonicalJson(expectedBefore));
  });

  it('RESUME preserves saved before proof byte-for-byte and deletes only remaining objects', async () => {
    const savedBefore = JSON.stringify(evidenceFor());
    const remaining = [completeInventory()[0]];
    const harness = makeHarness({
      pages: [{ blobs: remaining, hasMore: false }],
      files: new Map([[beforePath, savedBefore]]),
    });

    const result = await containChatbotBlobs(['--execute'], harness.dependencies);

    expect(result).toMatchObject({ state: 'RESUME', before: evidenceFor(), after: [] });
    expect(harness.files.get(beforePath)).toBe(savedBefore);
    expect(harness.writes.some((write) => write.path === beforePath)).toBe(false);
    expect(harness.deleted).toEqual([[remaining[0].url]]);
    expect(harness.fetched).toHaveLength(evidenceFor().length);
  });

  it('ALREADY_CONTAINED preserves before proof and probes every original URL', async () => {
    const savedBefore = canonicalJson(evidenceFor());
    const harness = makeHarness({
      pages: [{ blobs: [], hasMore: false }],
      files: new Map([[beforePath, savedBefore]]),
    });

    const result = await containChatbotBlobs(['--execute'], harness.dependencies);

    expect(result).toMatchObject({ state: 'ALREADY_CONTAINED', before: evidenceFor(), after: [] });
    expect(harness.files.get(beforePath)).toBe(savedBefore);
    expect(harness.deleted).toEqual([]);
    expect(harness.fetched).toHaveLength(evidenceFor().length);
    expect(harness.writes).toEqual([{ path: afterPath, contents: canonicalJson([]) }]);
  });

  it('does not rewrite an existing valid empty after inventory', async () => {
    const harness = makeHarness({
      pages: [{ blobs: [], hasMore: false }],
      files: new Map([
        [beforePath, canonicalJson(evidenceFor())],
        [afterPath, canonicalJson([])],
      ]),
    });

    await containChatbotBlobs(['--execute'], harness.dependencies);

    expect(harness.writes).toEqual([]);
  });

  it.each([
    ['partial', [blob(KNOWN_CHATBOT_PATHNAMES[0])]],
    ['empty', []],
  ])('fails a %s current inventory without preserved before proof', async (_label, entries) => {
    const harness = makeHarness({ pages: [{ blobs: entries, hasMore: false }] });

    await expect(containChatbotBlobs(['--execute'], harness.dependencies))
      .rejects.toThrow('PRESERVED_BEFORE_EVIDENCE_REQUIRED');
    expect(harness.writes).toEqual([]);
    expect(harness.deleted).toEqual([]);
    expect(harness.fetched).toEqual([]);
    expect(harness.outputs).toEqual([]);
  });

  it.each([
    'chatbot/token=review-canary.json',
    `chatbot/${'1234567890abcdef'.repeat(4)}.json`,
  ])('rejects unsafe current evidence before stdout, write, or delete: %s', async (pathname) => {
    const harness = makeHarness({
      pages: [{ blobs: [...completeInventory(), blob(pathname)], hasMore: false }],
    });

    await expect(containChatbotBlobs([], harness.dependencies)).rejects.toThrow();
    expect(harness.outputs).toEqual([]);
    expect(harness.writes).toEqual([]);
    expect(harness.deleted).toEqual([]);
  });

  it('rejects unsafe saved before proof before output, write, delete, or probe', async () => {
    const unsafeBefore = evidenceFor([
      ...completeInventory(),
      blob('chatbot/token=review-canary.json'),
    ]);
    const harness = makeHarness({
      pages: [{ blobs: [completeInventory()[0]], hasMore: false }],
      files: new Map([[beforePath, JSON.stringify(unsafeBefore)]]),
    });

    await expect(containChatbotBlobs(['--execute'], harness.dependencies)).rejects.toThrow();
    expect(harness.outputs).toEqual([]);
    expect(harness.writes).toEqual([]);
    expect(harness.deleted).toEqual([]);
    expect(harness.fetched).toEqual([]);
  });

  it('rejects unsafe existing after evidence before output, write, delete, or probe', async () => {
    const unsafeAfter = evidenceFor([blob('chatbot/token=review-canary.json')]);
    const harness = makeHarness({
      files: new Map([[afterPath, JSON.stringify(unsafeAfter)]]),
    });

    await expect(containChatbotBlobs(['--execute'], harness.dependencies)).rejects.toThrow();
    expect(harness.outputs).toEqual([]);
    expect(harness.writes).toEqual([]);
    expect(harness.deleted).toEqual([]);
    expect(harness.fetched).toEqual([]);
  });

  it('preserves fresh before proof when deletion is interrupted', async () => {
    const harness = makeHarness({ deleteError: 'INJECTED_DELETE_FAILURE' });

    await expect(containChatbotBlobs(['--execute'], harness.dependencies))
      .rejects.toThrow('INJECTED_DELETE_FAILURE');
    expect(harness.files.get(beforePath)).toBe(canonicalJson(evidenceFor()));
    expect(harness.files.has(afterPath)).toBe(false);
    expect(harness.writes).toEqual([{ path: beforePath, contents: canonicalJson(evidenceFor()) }]);
  });

  it('rejects a resumed current object that is not in the preserved proof', async () => {
    const harness = makeHarness({
      pages: [{ blobs: [blob('chatbot/new-safe-object.json')], hasMore: false }],
      files: new Map([[beforePath, canonicalJson(evidenceFor())]]),
    });

    await expect(containChatbotBlobs(['--execute'], harness.dependencies))
      .rejects.toThrow('CURRENT_INVENTORY_NOT_IN_PRESERVED_BEFORE');
    expect(harness.deleted).toEqual([]);
    expect(harness.writes).toEqual([]);
  });

  it('uses cache-busted GET probes and requires exact 404 responses', async () => {
    const success = makeHarness();
    await containChatbotBlobs(['--execute'], success.dependencies);

    expect(success.fetched).toHaveLength(4);
    for (const { url, init } of success.fetched) {
      const parsed = new URL(url);
      expect(parsed.searchParams.get('containment')).toMatch(/^1783915506789-\d+$/u);
      expect(init).toMatchObject({ method: 'GET', cache: 'no-store', redirect: 'manual' });
    }

    const failure = makeHarness({ probeStatus: 410 });
    await expect(containChatbotBlobs(['--execute'], failure.dependencies))
      .rejects.toThrow('BLOB_PROBE_NOT_404');
  });

  it('retries bounded relists and fails closed when the prefix stays populated', async () => {
    const stale = { blobs: [blob('chatbot/stale.json')], hasMore: false };
    const harness = makeHarness({ relists: [stale, stale, stale, stale, stale] });

    await expect(containChatbotBlobs(['--execute'], harness.dependencies))
      .rejects.toThrow('BLOB_PREFIX_NOT_EMPTY');
    expect(harness.sleeps).toHaveLength(4);
  });

  it('accepts only the explicit execute flag', async () => {
    const harness = makeHarness();

    await expect(containChatbotBlobs(['--delete'], harness.dependencies))
      .rejects.toThrow('INVALID_ARGUMENT');
    expect(harness.deleted).toEqual([]);
    expect(harness.outputs).toEqual([]);
  });
});
