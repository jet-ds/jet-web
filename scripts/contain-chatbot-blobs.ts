import { del as deleteBlob, list as listBlobs } from '@vercel/blob';
import {
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertSafeBlobInventory,
  canonicalEvidenceJson,
  type SafeBlobInventoryEntry,
} from './sanitize-vercel-evidence';

const CHATBOT_PREFIX = 'chatbot/';
const BLOB_HOST = 'vyge4wbmw8jgd8rh.public.blob.vercel-storage.com';
const BEFORE_EVIDENCE = 'docs/verification/containment/chatbot-blobs-before.json';
const AFTER_EVIDENCE = 'docs/verification/containment/chatbot-blobs-after.json';
const RELIST_ATTEMPTS = 5;
const RELIST_DELAY_MS = 500;

export const KNOWN_CHATBOT_PATHNAMES = [
  'chatbot/chunks-d70520113a820db7.bin',
  'chatbot/embeddings-d70520113a820db7.bin',
  'chatbot/manifest-d70520113a820db7.json',
] as const;

export type BlobListEntry = {
  pathname: string;
  url: string;
  size: number;
  uploadedAt: Date | string;
};

export type BlobListPage = {
  blobs: BlobListEntry[];
  cursor?: string;
  hasMore: boolean;
};

export type BlobEvidenceEntry = SafeBlobInventoryEntry;

export type BlobProbe = {
  pathname: string;
  status: number;
};

export type BlobContainmentState = 'FRESH' | 'RESUME' | 'ALREADY_CONTAINED';

export type BlobContainmentDependencies = {
  list(cursor?: string): Promise<BlobListPage>;
  delete(urls: string[]): Promise<void>;
  fetch(url: string, init?: RequestInit): Promise<{ status: number }>;
  now(): Date;
  sleep(milliseconds: number): Promise<void>;
  exists(path: string): boolean;
  readEvidence(path: string): string;
  writeEvidence(path: string, contents: string): void;
  output(contents: string): void;
};

export type BlobContainmentResult = {
  mode: 'dry-run' | 'execute';
  state: BlobContainmentState;
  before: BlobEvidenceEntry[];
  after: BlobEvidenceEntry[];
  probes: BlobProbe[];
};

class BlobContainmentError extends Error {
  constructor(readonly rule: string) {
    super(rule);
  }
}

function fail(rule: string): never {
  throw new BlobContainmentError(rule);
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function normalizeEntry(entry: BlobListEntry): BlobEvidenceEntry {
  if (
    typeof entry.pathname !== 'string'
    || !entry.pathname.startsWith(CHATBOT_PREFIX)
    || entry.pathname.includes('..')
    || typeof entry.url !== 'string'
    || !Number.isSafeInteger(entry.size)
    || entry.size < 0
  ) {
    fail('INVALID_BLOB_LIST_ENTRY');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(entry.url);
  } catch {
    fail('INVALID_BLOB_LIST_ENTRY');
  }
  let decodedPathname: string;
  try {
    decodedPathname = decodeURIComponent(parsedUrl.pathname.slice(1));
  } catch {
    fail('INVALID_BLOB_LIST_ENTRY');
  }
  if (
    parsedUrl.protocol !== 'https:'
    || parsedUrl.hostname !== BLOB_HOST
    || parsedUrl.username !== ''
    || parsedUrl.password !== ''
    || parsedUrl.search !== ''
    || parsedUrl.hash !== ''
    || decodedPathname !== entry.pathname
  ) {
    fail('INVALID_BLOB_LIST_ENTRY');
  }

  const uploadedAt = entry.uploadedAt instanceof Date
    ? entry.uploadedAt
    : new Date(entry.uploadedAt);
  if (Number.isNaN(uploadedAt.getTime())) fail('INVALID_BLOB_LIST_ENTRY');

  return {
    pathname: entry.pathname,
    url: parsedUrl.toString(),
    size: entry.size,
    uploadedAt: uploadedAt.toISOString(),
  };
}

function assertSharedSafety(entries: unknown, rule: string): asserts entries is BlobEvidenceEntry[] {
  try {
    assertSafeBlobInventory(entries);
  } catch {
    fail(rule);
  }
}

function normalizeAndValidateEntries(entries: BlobListEntry[], rule: string): BlobEvidenceEntry[] {
  const normalized = entries.map(normalizeEntry);
  normalized.sort((left, right) => compareText(left.pathname, right.pathname));
  if (new Set(normalized.map((entry) => entry.pathname)).size !== normalized.length) {
    fail('DUPLICATE_BLOB_PATHNAME');
  }
  assertSharedSafety(normalized, rule);
  return normalized;
}

async function listCompletePrefix(
  dependencies: BlobContainmentDependencies,
): Promise<BlobEvidenceEntry[]> {
  const entries: BlobListEntry[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  do {
    const page = await dependencies.list(cursor);
    if (!Array.isArray(page.blobs) || typeof page.hasMore !== 'boolean') {
      fail('INVALID_BLOB_LIST_PAGE');
    }
    entries.push(...page.blobs);
    if (!page.hasMore) break;
    if (!page.cursor || page.cursor === cursor || seenCursors.has(page.cursor)) {
      fail('INVALID_BLOB_LIST_CURSOR');
    }
    seenCursors.add(page.cursor);
    cursor = page.cursor;
  } while (true);

  return normalizeAndValidateEntries(entries, 'UNSAFE_CURRENT_BLOB_EVIDENCE');
}

function assertKnownObjectsPresent(entries: BlobEvidenceEntry[]): void {
  const pathnames = new Set(entries.map((entry) => entry.pathname));
  if (KNOWN_CHATBOT_PATHNAMES.some((pathname) => !pathnames.has(pathname))) {
    fail('KNOWN_CHATBOT_BLOB_MISSING');
  }
}

function readEvidenceInventory(
  path: string,
  dependencies: BlobContainmentDependencies,
  unsafeRule: string,
): { contents: string; entries: BlobEvidenceEntry[] } {
  const contents = dependencies.readEvidence(path);
  let value: unknown;
  try {
    value = JSON.parse(contents) as unknown;
  } catch {
    fail('INVALID_BLOB_EVIDENCE_JSON');
  }
  assertSharedSafety(value, unsafeRule);
  const entries = normalizeAndValidateEntries(value, unsafeRule);
  return { contents, entries };
}

function assertCurrentIsPreserved(
  current: BlobEvidenceEntry[],
  preservedBefore: BlobEvidenceEntry[],
): void {
  const preserved = new Map(
    preservedBefore.map((entry) => [entry.pathname, canonicalEvidenceJson(entry)]),
  );
  for (const entry of current) {
    if (preserved.get(entry.pathname) !== canonicalEvidenceJson(entry)) {
      fail('CURRENT_INVENTORY_NOT_IN_PRESERVED_BEFORE');
    }
  }
}

function determineState(
  current: BlobEvidenceEntry[],
  dependencies: BlobContainmentDependencies,
): { state: BlobContainmentState; before: BlobEvidenceEntry[] } {
  if (!dependencies.exists(BEFORE_EVIDENCE)) {
    if (current.length === 0) fail('PRESERVED_BEFORE_EVIDENCE_REQUIRED');
    try {
      assertKnownObjectsPresent(current);
    } catch {
      fail('PRESERVED_BEFORE_EVIDENCE_REQUIRED');
    }
    return { state: 'FRESH', before: current };
  }

  const saved = readEvidenceInventory(
    BEFORE_EVIDENCE,
    dependencies,
    'UNSAFE_PRESERVED_BEFORE_EVIDENCE',
  );
  assertKnownObjectsPresent(saved.entries);
  if (current.length === 0) return { state: 'ALREADY_CONTAINED', before: saved.entries };
  assertCurrentIsPreserved(current, saved.entries);
  return { state: 'RESUME', before: saved.entries };
}

function validateExistingAfterEvidence(dependencies: BlobContainmentDependencies): boolean {
  if (!dependencies.exists(AFTER_EVIDENCE)) return false;
  const existing = readEvidenceInventory(
    AFTER_EVIDENCE,
    dependencies,
    'UNSAFE_AFTER_BLOB_EVIDENCE',
  );
  if (existing.entries.length !== 0) fail('BLOB_AFTER_NOT_EMPTY');
  return true;
}

function cacheBustedUrl(url: string, timestamp: number, index: number): string {
  const parsed = new URL(url);
  parsed.searchParams.set('containment', `${timestamp}-${index}`);
  return parsed.toString();
}

function parseArguments(arguments_: string[]): boolean {
  if (arguments_.length === 0) return false;
  if (arguments_.length === 1 && arguments_[0] === '--execute') return true;
  fail('INVALID_ARGUMENT');
}

async function probeOriginalInventory(
  before: BlobEvidenceEntry[],
  dependencies: BlobContainmentDependencies,
): Promise<BlobProbe[]> {
  const timestamp = dependencies.now().getTime();
  if (!Number.isFinite(timestamp)) fail('INVALID_TIME');
  const probes: BlobProbe[] = [];
  for (const [index, entry] of before.entries()) {
    const response = await dependencies.fetch(
      cacheBustedUrl(entry.url, timestamp, index),
      { method: 'GET', cache: 'no-store', redirect: 'manual' },
    );
    probes.push({ pathname: entry.pathname, status: response.status });
    if (response.status !== 404) fail('BLOB_PROBE_NOT_404');
  }
  return probes;
}

export async function containChatbotBlobs(
  arguments_: string[],
  dependencies: BlobContainmentDependencies,
): Promise<BlobContainmentResult> {
  const execute = parseArguments(arguments_);
  const current = await listCompletePrefix(dependencies);
  const { state, before } = determineState(current, dependencies);
  const hasExistingAfterEvidence = validateExistingAfterEvidence(dependencies);

  if (!execute) {
    dependencies.output(canonicalEvidenceJson({
      inventory: current,
      mode: 'dry-run',
      state,
    }));
    return { mode: 'dry-run', state, before, after: current, probes: [] };
  }

  if (state === 'FRESH') {
    dependencies.writeEvidence(BEFORE_EVIDENCE, canonicalEvidenceJson(before));
  }

  let after = current;
  if (current.length > 0) {
    await dependencies.delete(current.map((entry) => entry.url));
    for (let attempt = 0; attempt < RELIST_ATTEMPTS; attempt += 1) {
      after = await listCompletePrefix(dependencies);
      if (after.length === 0) break;
      if (attempt < RELIST_ATTEMPTS - 1) await dependencies.sleep(RELIST_DELAY_MS);
    }
    if (after.length !== 0) fail('BLOB_PREFIX_NOT_EMPTY');
  }

  if (!hasExistingAfterEvidence) {
    dependencies.writeEvidence(AFTER_EVIDENCE, canonicalEvidenceJson([]));
  }
  const probes = await probeOriginalInventory(before, dependencies);
  return { mode: 'execute', state, before, after, probes };
}

function writeEvidenceFresh(path: string, contents: string): void {
  const absolutePath = resolve(path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  const temporaryPath = `${absolutePath}.tmp-${process.pid}`;
  rmSync(temporaryPath, { force: true });
  try {
    writeFileSync(temporaryPath, contents, { flag: 'wx', mode: 0o600 });
    linkSync(temporaryPath, absolutePath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

function defaultDependencies(): BlobContainmentDependencies {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) fail('MISSING_BLOB_READ_WRITE_TOKEN');
  return {
    async list(cursor) {
      const page = await listBlobs({ prefix: CHATBOT_PREFIX, cursor, token });
      return {
        blobs: page.blobs,
        cursor: page.cursor,
        hasMore: page.hasMore,
      };
    },
    async delete(urls) {
      await deleteBlob(urls, { token });
    },
    async fetch(url, init) {
      return fetch(url, init);
    },
    now: () => new Date(),
    sleep: (milliseconds) => new Promise((resolvePromise) => {
      setTimeout(resolvePromise, milliseconds);
    }),
    exists: existsSync,
    readEvidence: (path) => readFileSync(path, 'utf8'),
    writeEvidence: writeEvidenceFresh,
    output: (contents) => process.stdout.write(contents),
  };
}

async function main(): Promise<void> {
  await containChatbotBlobs(process.argv.slice(2), defaultDependencies());
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const rule = error instanceof BlobContainmentError ? error.rule : 'UNEXPECTED_ERROR';
    process.stderr.write(`Blob containment failed: ${rule}\n`);
    process.exitCode = 1;
  });
}
