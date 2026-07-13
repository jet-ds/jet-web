import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import {
  dirname,
  isAbsolute,
  posix,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';

export type ArchiveStatus = 'superseded' | 'historical' | 'deferred';

export interface ArchiveEntry {
  sourcePath: string;
  archivePath: string;
  status: ArchiveStatus;
  successorPath: string;
  successorLabel: string;
}

const coreDesign = 'docs/superpowers/specs/2026-07-11-v1-modernization-design.md';
const ghostDesign = 'docs/superpowers/specs/2026-07-11-jets-ghost-local-assistant-design.md';

export const ARCHIVE_ENTRIES: readonly ArchiveEntry[] = [
  {
    sourcePath: 'EMBEDDING_STORAGE_RESEARCH.md',
    archivePath: 'docs/archive/jets-ghost/legacy-rag/embedding-storage-research.md',
    status: 'superseded',
    successorPath: ghostDesign,
    successorLabel: "Jet's Ghost local-assistant design",
  },
  {
    sourcePath: 'docs/jets-ghost-v1.5-spec.md',
    archivePath: 'docs/archive/jets-ghost/legacy-rag/jets-ghost-v1.5-spec.md',
    status: 'superseded',
    successorPath: ghostDesign,
    successorLabel: "Jet's Ghost local-assistant design",
  },
  {
    sourcePath: 'docs/rag-chatbot-implementation-review.md',
    archivePath: 'docs/archive/jets-ghost/legacy-rag/rag-chatbot-implementation-review.md',
    status: 'superseded',
    successorPath: ghostDesign,
    successorLabel: "Jet's Ghost local-assistant design",
  },
  {
    sourcePath: 'docs/liquid-glass-dock-v2-log.md',
    archivePath: 'docs/archive/site/implementation-logs/liquid-glass-dock-v2.md',
    status: 'historical',
    successorPath: coreDesign,
    successorLabel: 'v1 modernization design',
  },
  {
    sourcePath: 'Untracked/docs/emdash-news-theme-spec.md',
    archivePath: 'docs/archive/deferred-concepts/emdash-news-theme-spec.md',
    status: 'deferred',
    successorPath: coreDesign,
    successorLabel: 'v1 modernization design',
  },
  {
    sourcePath: 'Untracked/docs/page-analyzer-spec.md',
    archivePath: 'docs/archive/deferred-concepts/page-analyzer-spec.md',
    status: 'deferred',
    successorPath: coreDesign,
    successorLabel: 'v1 modernization design',
  },
  {
    sourcePath: 'Untracked/docs/schema-visualizer-spec.md',
    archivePath: 'docs/archive/deferred-concepts/schema-visualizer-spec.md',
    status: 'deferred',
    successorPath: coreDesign,
    successorLabel: 'v1 modernization design',
  },
];

const ACTIVE_ARTICLE = 'Untracked/how-to-install-and-get-started-with-codex-cli-2026.mdx';
const ARCHIVE_DATE = '2026-07-13';
const MANIFEST_PATH = 'docs/archive/archive-manifest.json';
const SHA256_PATTERN = /^[a-f\d]{64}$/u;

export function archiveBanner(entry: ArchiveEntry): string {
  const labels: Record<ArchiveStatus, string> = {
    superseded: 'Superseded historical record',
    historical: 'Completed historical record',
    deferred: 'Deferred concept',
  };
  const successorHref = posix.relative(posix.dirname(entry.archivePath), entry.successorPath);
  return [
    `> **${labels[entry.status]}.** Archived ${ARCHIVE_DATE} from \`${entry.sourcePath}\`.`,
    `> Canonical context: [${entry.successorLabel}](${successorHref}).`,
    '',
    '',
  ].join('\n');
}

interface ArchiveStat {
  mode: number;
  isFile(): boolean;
  isSymbolicLink(): boolean;
}

export interface ArchiveFileSystemAdapter {
  exists(path: string): boolean;
  lstat(path: string): ArchiveStat;
  readFile(path: string): Buffer;
  writeFile(path: string, contents: string | Buffer, mode?: number): void;
  mkdir(path: string, mode: number): void;
  chmod(path: string, mode: number): void;
  unlink(path: string): void;
  removeTree(path: string): void;
}

export interface ArchiveGitAdapter {
  currentInventory(sourceRoot: string): Buffer;
  isAnnotatedTag(releaseRef: string): boolean;
  manifestIntroductionCommit(): string | null;
  isAncestor(commit: string, releaseRef: string): boolean;
  readTaggedFile(releaseRef: string, path: string): Buffer;
}

export interface ArchiveRuntime {
  fileSystem: ArchiveFileSystemAdapter;
  git: ArchiveGitAdapter;
}

export interface ArchiveOptions {
  repositoryRoot: string;
  sourceRoot: string;
  sourceHashesPath: string;
  initialInventoryPath: string;
  inventoryPath: string;
  attestationPath: string;
  releaseRef?: string;
}

export interface ArchiveManifestEntry {
  sourcePath: string;
  archivePath: string;
  status: ArchiveStatus;
  successorPath: string;
  sourceSha256: string;
  archiveSha256: string;
}

export interface ArchiveManifest {
  schemaVersion: '1.0.0';
  archiveDate: string;
  entries: ArchiveManifestEntry[];
}

interface AttestedInventory {
  sha256: string;
  entryCount: number;
}

interface OperatorAttestation {
  schemaVersion: '1.0.0';
  approvedSha: string;
  inventory: AttestedInventory;
  approvedTask11Inventory: AttestedInventory;
  authorizedArchiveSources: Array<{ path: string; sha256: string }>;
}

interface ValidatedSource {
  entry: ArchiveEntry;
  bytes: Buffer;
  mode: number;
  sha256: string;
}

interface Preflight {
  approvedInventory: Buffer;
  sources: ValidatedSource[];
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function exactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  return JSON.stringify(Object.keys(value).sort(compareText))
    === JSON.stringify([...expected].sort(compareText));
}

function parseJsonObject(bytes: Buffer, errorCode: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(bytes.toString('utf8'));
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new Error(errorCode);
  }
}

function parseInventoryAttestation(value: unknown, errorCode: string): AttestedInventory {
  if (
    typeof value !== 'object'
    || value === null
    || Array.isArray(value)
    || !exactKeys(value as Record<string, unknown>, ['sha256', 'entryCount'])
  ) throw new Error(errorCode);
  const record = value as Record<string, unknown>;
  if (
    typeof record.sha256 !== 'string'
    || !SHA256_PATTERN.test(record.sha256)
    || typeof record.entryCount !== 'number'
    || !Number.isInteger(record.entryCount)
    || record.entryCount < 0
  ) throw new Error(errorCode);
  return { sha256: record.sha256, entryCount: record.entryCount };
}

function parseAttestation(bytes: Buffer): OperatorAttestation {
  const value = parseJsonObject(bytes, 'ATTESTATION_INVALID');
  if (!exactKeys(value, [
    'schemaVersion',
    'approvedSha',
    'inventory',
    'approvedTask11Inventory',
    'authorizedArchiveSources',
  ])) throw new Error('ATTESTATION_INVALID');
  if (
    value.schemaVersion !== '1.0.0'
    || typeof value.approvedSha !== 'string'
    || !/^[a-f\d]{40}$/u.test(value.approvedSha)
    || !Array.isArray(value.authorizedArchiveSources)
  ) throw new Error('ATTESTATION_INVALID');

  const sources = value.authorizedArchiveSources.map((source) => {
    if (
      typeof source !== 'object'
      || source === null
      || Array.isArray(source)
      || !exactKeys(source as Record<string, unknown>, ['path', 'sha256'])
    ) throw new Error('ATTESTATION_INVALID');
    const record = source as Record<string, unknown>;
    if (
      typeof record.path !== 'string'
      || typeof record.sha256 !== 'string'
      || !SHA256_PATTERN.test(record.sha256)
    ) throw new Error('ATTESTATION_INVALID');
    return { path: record.path, sha256: record.sha256 };
  });

  return {
    schemaVersion: '1.0.0',
    approvedSha: value.approvedSha,
    inventory: parseInventoryAttestation(value.inventory, 'ATTESTATION_INVALID'),
    approvedTask11Inventory: parseInventoryAttestation(
      value.approvedTask11Inventory,
      'ATTESTATION_INVALID',
    ),
    authorizedArchiveSources: sources,
  };
}

function parseInitialInventory(bytes: Buffer): string[] {
  if (bytes.length === 0 || bytes.at(-1) !== 0) throw new Error('INITIAL_INVENTORY_FORMAT_INVALID');
  const records = bytes.toString('utf8').split('\0');
  records.pop();
  if (records.some((record) => record === '')) throw new Error('INITIAL_INVENTORY_FORMAT_INVALID');
  return records;
}

function parseApprovedInventory(bytes: Buffer): string[] {
  if (bytes.length === 0 || bytes.at(-1) !== 0x0a || bytes.includes(0)) {
    throw new Error('TASK_11_INVENTORY_FORMAT_INVALID');
  }
  const records = bytes.toString('utf8').split('\n');
  records.pop();
  if (records.some((record) => record === '')) throw new Error('TASK_11_INVENTORY_FORMAT_INVALID');
  const sorted = [...records].sort(compareText);
  if (JSON.stringify(records) !== JSON.stringify(sorted) || new Set(records).size !== records.length) {
    throw new Error('TASK_11_INVENTORY_FORMAT_INVALID');
  }
  return records;
}

function parseSourceHashes(bytes: Buffer): Array<{ path: string; sha256: string }> {
  const lines = bytes.toString('utf8').split('\n').filter(Boolean);
  const records = lines.map((line) => {
    const match = /^([a-f\d]{64}) {2}(.+)$/u.exec(line);
    if (!match) throw new Error('SOURCE_HASH_ALLOWLIST_INVALID');
    return { sha256: match[1], path: match[2] };
  });
  if (new Set(records.map(({ path }) => path)).size !== records.length) {
    throw new Error('SOURCE_HASH_ALLOWLIST_INVALID');
  }
  return records.sort((left, right) => compareText(left.path, right.path));
}

function expectedAuthorizedPaths(): string[] {
  return ARCHIVE_ENTRIES.map(({ sourcePath }) => sourcePath).sort(compareText);
}

function sameSourceRecords(
  left: Array<{ path: string; sha256: string }>,
  right: Array<{ path: string; sha256: string }>,
): boolean {
  const normalize = (records: Array<{ path: string; sha256: string }>) => [...records]
    .sort((a, b) => compareText(a.path, b.path))
    .map(({ path, sha256: digest }) => `${path}\0${digest}`);
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function containedPath(root: string, repositoryPath: string, errorCode: string): string {
  const target = resolve(root, ...repositoryPath.split('/'));
  const fromRoot = relative(root, target);
  if (
    fromRoot === ''
    || isAbsolute(fromRoot)
    || fromRoot === '..'
    || fromRoot.startsWith(`..${sep}`)
  ) throw new Error(errorCode);
  return target;
}

function sourcePreflight(options: ArchiveOptions, runtime: ArchiveRuntime): Preflight {
  if (!isAbsolute(options.repositoryRoot) || !isAbsolute(options.sourceRoot)) {
    throw new Error('ARCHIVE_ROOT_NOT_ABSOLUTE');
  }
  const attestation = parseAttestation(runtime.fileSystem.readFile(options.attestationPath));
  const initialInventory = runtime.fileSystem.readFile(options.initialInventoryPath);
  const approvedInventory = runtime.fileSystem.readFile(options.inventoryPath);
  const sourceHashes = parseSourceHashes(runtime.fileSystem.readFile(options.sourceHashesPath));

  const initialRecords = parseInitialInventory(initialInventory);
  if (
    sha256(initialInventory) !== attestation.inventory.sha256
    || initialRecords.length !== attestation.inventory.entryCount
    || attestation.inventory.entryCount !== 9
  ) throw new Error('INITIAL_INVENTORY_ATTESTATION_MISMATCH');

  const approvedRecords = parseApprovedInventory(approvedInventory);
  if (
    sha256(approvedInventory) !== attestation.approvedTask11Inventory.sha256
    || approvedRecords.length !== attestation.approvedTask11Inventory.entryCount
    || attestation.approvedTask11Inventory.entryCount !== 8
  ) throw new Error('TASK_11_INVENTORY_ATTESTATION_MISMATCH');

  const expectedRecords = [
    ...ARCHIVE_ENTRIES.map(({ sourcePath }) => `?? ${sourcePath}`),
    `?? ${ACTIVE_ARTICLE}`,
  ].sort(compareText);
  if (JSON.stringify(approvedRecords) !== JSON.stringify(expectedRecords)) {
    throw new Error('TASK_11_INVENTORY_UNEXPECTED_PATHS');
  }
  if (!runtime.git.currentInventory(options.sourceRoot).equals(approvedInventory)) {
    throw new Error('SOURCE_INVENTORY_MISMATCH');
  }

  if (
    JSON.stringify(sourceHashes.map(({ path }) => path)) !== JSON.stringify(expectedAuthorizedPaths())
    || !sameSourceRecords(sourceHashes, attestation.authorizedArchiveSources)
  ) throw new Error('SOURCE_HASH_ALLOWLIST_MISMATCH');

  const hashByPath = new Map(sourceHashes.map((record) => [record.path, record.sha256]));
  const sources = ARCHIVE_ENTRIES.map((entry) => {
    const path = containedPath(options.sourceRoot, entry.sourcePath, 'SOURCE_PATH_INVALID');
    let stat: ArchiveStat;
    try {
      stat = runtime.fileSystem.lstat(path);
    } catch {
      throw new Error(`SOURCE_NOT_REGULAR_FILE:${entry.sourcePath}`);
    }
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`SOURCE_NOT_REGULAR_FILE:${entry.sourcePath}`);
    }
    const bytes = runtime.fileSystem.readFile(path);
    const actualSha256 = sha256(bytes);
    if (actualSha256 !== hashByPath.get(entry.sourcePath)) {
      throw new Error(`SOURCE_HASH_MISMATCH:${entry.sourcePath}`);
    }
    return { entry, bytes, mode: stat.mode & 0o777, sha256: actualSha256 };
  });
  return { approvedInventory, sources };
}

function manifestPath(options: ArchiveOptions): string {
  return containedPath(options.repositoryRoot, MANIFEST_PATH, 'MANIFEST_PATH_INVALID');
}

function parseManifest(bytes: Buffer, errorCode: string): ArchiveManifest {
  const value = parseJsonObject(bytes, errorCode);
  if (!exactKeys(value, ['schemaVersion', 'archiveDate', 'entries'])) throw new Error(errorCode);
  if (value.schemaVersion !== '1.0.0' || value.archiveDate !== ARCHIVE_DATE || !Array.isArray(value.entries)) {
    throw new Error(errorCode);
  }
  if (value.entries.length !== ARCHIVE_ENTRIES.length) throw new Error(errorCode);
  const entries = value.entries.map((candidate, index) => {
    if (
      typeof candidate !== 'object'
      || candidate === null
      || Array.isArray(candidate)
      || !exactKeys(candidate as Record<string, unknown>, [
        'sourcePath',
        'archivePath',
        'status',
        'successorPath',
        'sourceSha256',
        'archiveSha256',
      ])
    ) throw new Error(errorCode);
    const record = candidate as Record<string, unknown>;
    const expected = ARCHIVE_ENTRIES[index];
    if (
      record.sourcePath !== expected.sourcePath
      || record.archivePath !== expected.archivePath
      || record.status !== expected.status
      || record.successorPath !== expected.successorPath
      || typeof record.sourceSha256 !== 'string'
      || !SHA256_PATTERN.test(record.sourceSha256)
      || typeof record.archiveSha256 !== 'string'
      || !SHA256_PATTERN.test(record.archiveSha256)
    ) throw new Error(errorCode);
    return record as unknown as ArchiveManifestEntry;
  });
  return { schemaVersion: '1.0.0', archiveDate: ARCHIVE_DATE, entries };
}

function verifyArchivedBytes(
  entry: ArchiveEntry,
  archived: Buffer,
  manifestEntry: ArchiveManifestEntry,
  tagged: boolean,
): void {
  const prefix = tagged ? 'TAGGED_' : '';
  if (tagged && sha256(archived) !== manifestEntry.archiveSha256) {
    throw new Error(`${prefix}ARCHIVE_HASH_MISMATCH:${entry.archivePath}`);
  }
  const banner = Buffer.from(archiveBanner(entry));
  if (!archived.subarray(0, banner.length).equals(banner)) {
    throw new Error(`${prefix}ARCHIVE_BANNER_MISMATCH:${entry.archivePath}`);
  }
  const body = archived.subarray(banner.length);
  if (sha256(body) !== manifestEntry.sourceSha256) {
    throw new Error(`${prefix}ARCHIVED_BODY_HASH_MISMATCH:${entry.archivePath}`);
  }
  if (!tagged && sha256(archived) !== manifestEntry.archiveSha256) {
    throw new Error(`${prefix}ARCHIVE_HASH_MISMATCH:${entry.archivePath}`);
  }
}

export function createLegacyDocsArchive(
  options: ArchiveOptions,
  runtime: ArchiveRuntime,
): ArchiveManifest {
  const preflight = sourcePreflight(options, runtime);
  const destinations = ARCHIVE_ENTRIES.map((entry) => (
    containedPath(options.repositoryRoot, entry.archivePath, 'ARCHIVE_PATH_INVALID')
  ));
  for (const destination of [...destinations, manifestPath(options)]) {
    if (runtime.fileSystem.exists(destination)) throw new Error('ARCHIVE_DESTINATION_EXISTS');
  }

  const entries = preflight.sources.map((source, index): ArchiveManifestEntry => {
    const archived = Buffer.concat([Buffer.from(archiveBanner(source.entry)), source.bytes]);
    const destination = destinations[index];
    runtime.fileSystem.mkdir(dirname(destination), 0o755);
    runtime.fileSystem.writeFile(destination, archived);
    return {
      sourcePath: source.entry.sourcePath,
      archivePath: source.entry.archivePath,
      status: source.entry.status,
      successorPath: source.entry.successorPath,
      sourceSha256: source.sha256,
      archiveSha256: sha256(archived),
    };
  });
  const manifest: ArchiveManifest = {
    schemaVersion: '1.0.0',
    archiveDate: ARCHIVE_DATE,
    entries,
  };
  const target = manifestPath(options);
  runtime.fileSystem.mkdir(dirname(target), 0o755);
  runtime.fileSystem.writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export function verifyLegacyDocsArchive(
  options: ArchiveOptions,
  runtime: ArchiveRuntime,
): ArchiveManifest {
  const preflight = sourcePreflight(options, runtime);
  const manifest = parseManifest(
    runtime.fileSystem.readFile(manifestPath(options)),
    'ARCHIVE_MANIFEST_INVALID',
  );
  for (const [index, entry] of ARCHIVE_ENTRIES.entries()) {
    const manifestEntry = manifest.entries[index];
    if (manifestEntry.sourceSha256 !== preflight.sources[index].sha256) {
      throw new Error(`MANIFEST_SOURCE_HASH_MISMATCH:${entry.sourcePath}`);
    }
    const path = containedPath(options.repositoryRoot, entry.archivePath, 'ARCHIVE_PATH_INVALID');
    let stat: ArchiveStat;
    try {
      stat = runtime.fileSystem.lstat(path);
    } catch {
      throw new Error(`ARCHIVE_NOT_REGULAR_FILE:${entry.archivePath}`);
    }
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`ARCHIVE_NOT_REGULAR_FILE:${entry.archivePath}`);
    }
    verifyArchivedBytes(entry, runtime.fileSystem.readFile(path), manifestEntry, false);
  }
  return manifest;
}

function verifyTaggedArchive(
  runtime: ArchiveRuntime,
  preflight: Preflight,
  releaseRef: string,
): void {
  let manifest: ArchiveManifest;
  try {
    manifest = parseManifest(
      runtime.git.readTaggedFile(releaseRef, MANIFEST_PATH),
      'TAGGED_MANIFEST_INVALID',
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'TAGGED_MANIFEST_INVALID') throw error;
    throw new Error('TAGGED_MANIFEST_INVALID');
  }
  for (const [index, entry] of ARCHIVE_ENTRIES.entries()) {
    const manifestEntry = manifest.entries[index];
    if (manifestEntry.sourceSha256 !== preflight.sources[index].sha256) {
      throw new Error(`TAGGED_MANIFEST_SOURCE_HASH_MISMATCH:${entry.sourcePath}`);
    }
    let archived: Buffer;
    try {
      archived = runtime.git.readTaggedFile(releaseRef, entry.archivePath);
    } catch {
      throw new Error(`TAGGED_ARCHIVE_MISSING:${entry.archivePath}`);
    }
    verifyArchivedBytes(entry, archived, manifestEntry, true);
  }
}

function inventoryAfterRemoval(approvedInventory: Buffer): Buffer {
  const removed = new Set(ARCHIVE_ENTRIES.map(({ sourcePath }) => `?? ${sourcePath}`));
  const remaining = parseApprovedInventory(approvedInventory).filter((record) => !removed.has(record));
  return Buffer.from(`${remaining.join('\n')}\n`);
}

function errorCause(error: unknown): string {
  return error instanceof Error ? error.message : 'UNEXPECTED_ERROR';
}

function verifiedBackupBytes(
  backup: string,
  source: ValidatedSource,
  runtime: ArchiveRuntime,
  phase: 'BACKUP' | 'ROLLBACK',
): Buffer {
  let stat: ArchiveStat;
  try {
    stat = runtime.fileSystem.lstat(backup);
  } catch {
    throw new Error(`${phase}_BACKUP_NOT_REGULAR:${source.entry.sourcePath}`);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${phase}_BACKUP_NOT_REGULAR:${source.entry.sourcePath}`);
  }
  if ((stat.mode & 0o777) !== 0o600) {
    throw new Error(`${phase}_BACKUP_MODE_MISMATCH:${source.entry.sourcePath}`);
  }
  let bytes: Buffer;
  try {
    bytes = runtime.fileSystem.readFile(backup);
  } catch (error) {
    throw new Error(`${phase}_BACKUP_READ_FAILED:${source.entry.sourcePath}:${errorCause(error)}`);
  }
  if (sha256(bytes) !== source.sha256) {
    throw new Error(`${phase}_BACKUP_HASH_MISMATCH:${source.entry.sourcePath}`);
  }
  return bytes;
}

function restoreAndVerifySources(
  backupRoot: string,
  options: ArchiveOptions,
  preflight: Preflight,
  runtime: ArchiveRuntime,
): void {
  preflight.sources.forEach((source, index) => {
    const backup = resolve(backupRoot, `${String(index).padStart(2, '0')}.bin`);
    const bytes = verifiedBackupBytes(backup, source, runtime, 'ROLLBACK');
    const target = containedPath(options.sourceRoot, source.entry.sourcePath, 'SOURCE_PATH_INVALID');
    try {
      runtime.fileSystem.writeFile(target, bytes, source.mode);
      runtime.fileSystem.chmod(target, source.mode);
    } catch (error) {
      throw new Error(`ROLLBACK_RESTORE_FAILED:${source.entry.sourcePath}:${errorCause(error)}`);
    }

    let stat: ArchiveStat;
    try {
      stat = runtime.fileSystem.lstat(target);
    } catch {
      throw new Error(`ROLLBACK_TARGET_NOT_REGULAR:${source.entry.sourcePath}`);
    }
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`ROLLBACK_TARGET_NOT_REGULAR:${source.entry.sourcePath}`);
    }
    if ((stat.mode & 0o777) !== source.mode) {
      throw new Error(`ROLLBACK_TARGET_MODE_MISMATCH:${source.entry.sourcePath}`);
    }
    let restored: Buffer;
    try {
      restored = runtime.fileSystem.readFile(target);
    } catch (error) {
      throw new Error(`ROLLBACK_TARGET_READ_FAILED:${source.entry.sourcePath}:${errorCause(error)}`);
    }
    if (sha256(restored) !== source.sha256) {
      throw new Error(`ROLLBACK_TARGET_HASH_MISMATCH:${source.entry.sourcePath}`);
    }
  });

  if (!runtime.git.currentInventory(options.sourceRoot).equals(preflight.approvedInventory)) {
    throw new Error('ROLLBACK_INVENTORY_MISMATCH');
  }
}

export function cleanupLegacyDocs(
  options: ArchiveOptions & { releaseRef: string },
  runtime: ArchiveRuntime,
): { removedPaths: string[] } {
  const preflight = sourcePreflight(options, runtime);
  if (options.releaseRef === '') throw new Error('RELEASE_REF_REQUIRED');
  if (!runtime.git.isAnnotatedTag(options.releaseRef)) throw new Error('RELEASE_REF_NOT_ANNOTATED_TAG');
  const archiveCommit = runtime.git.manifestIntroductionCommit();
  if (!archiveCommit || !runtime.git.isAncestor(archiveCommit, options.releaseRef)) {
    throw new Error('ARCHIVE_COMMIT_NOT_IN_RELEASE');
  }
  verifyTaggedArchive(runtime, preflight, options.releaseRef);

  const backupRoot = resolve(dirname(options.inventoryPath), 'archive-cleanup-backups');
  if (runtime.fileSystem.exists(backupRoot)) throw new Error('CLEANUP_BACKUP_ALREADY_EXISTS');
  runtime.fileSystem.mkdir(backupRoot, 0o700);
  let backupsReady = false;
  try {
    preflight.sources.forEach((source, index) => {
      const backup = resolve(backupRoot, `${String(index).padStart(2, '0')}.bin`);
      runtime.fileSystem.writeFile(backup, source.bytes, 0o600);
      runtime.fileSystem.chmod(backup, 0o600);
      verifiedBackupBytes(backup, source, runtime, 'BACKUP');
    });
    backupsReady = true;
    for (const source of preflight.sources) {
      runtime.fileSystem.unlink(containedPath(
        options.sourceRoot,
        source.entry.sourcePath,
        'SOURCE_PATH_INVALID',
      ));
    }
    const expected = inventoryAfterRemoval(preflight.approvedInventory);
    if (!runtime.git.currentInventory(options.sourceRoot).equals(expected)) {
      throw new Error('CLEANUP_POSTCONDITION_MISMATCH');
    }
    runtime.fileSystem.removeTree(backupRoot);
    return { removedPaths: ARCHIVE_ENTRIES.map(({ sourcePath }) => sourcePath) };
  } catch (error) {
    const originalCause = errorCause(error);
    if (!backupsReady) {
      runtime.fileSystem.removeTree(backupRoot);
      throw new Error(`CLEANUP_BACKUP_FAILED:${originalCause}`);
    }
    try {
      restoreAndVerifySources(backupRoot, options, preflight, runtime);
    } catch (rollbackError) {
      throw new Error(
        `CLEANUP_ROLLBACK_FAILED:original=${originalCause};rollback=${errorCause(rollbackError)}`,
      );
    }
    try {
      runtime.fileSystem.removeTree(backupRoot);
    } catch (rollbackError) {
      throw new Error(
        `CLEANUP_ROLLBACK_FAILED:original=${originalCause};rollback=ROLLBACK_BACKUP_DELETE_FAILED:${errorCause(rollbackError)}`,
      );
    }
    throw new Error(`CLEANUP_ROLLED_BACK:${originalCause}`);
  }
}

function runGit(
  repositoryRoot: string,
  arguments_: string[],
  encoding: 'buffer',
): Buffer;
function runGit(
  repositoryRoot: string,
  arguments_: string[],
  encoding: 'utf8',
): string;
function runGit(
  repositoryRoot: string,
  arguments_: string[],
  encoding: 'buffer' | 'utf8',
): Buffer | string {
  const result = spawnSync('git', arguments_, {
    cwd: repositoryRoot,
    encoding: encoding === 'utf8' ? 'utf8' : undefined,
    maxBuffer: 64 * 1024 * 1024,
    shell: false,
  });
  if (result.error || result.status !== 0) throw new Error('GIT_ARCHIVE_CHECK_FAILED');
  return result.stdout;
}

function productionRuntime(options: ArchiveOptions): ArchiveRuntime {
  const fileSystem: ArchiveFileSystemAdapter = {
    exists: existsSync,
    lstat: lstatSync,
    readFile: readFileSync,
    writeFile: (path, contents, mode) => writeFileSync(
      path,
      contents,
      mode === undefined ? undefined : { mode },
    ),
    mkdir: (path, mode) => mkdirSync(path, { recursive: true, mode }),
    chmod: chmodSync,
    unlink: unlinkSync,
    removeTree: (path) => rmSync(path, { recursive: true, force: true }),
  };
  return {
    fileSystem,
    git: {
      currentInventory: (sourceRoot) => runGit(
        sourceRoot,
        ['status', '--porcelain=v1', '-uall'],
        'buffer',
      ),
      isAnnotatedTag: (releaseRef) => {
        try {
          return runGit(options.repositoryRoot, ['cat-file', '-t', releaseRef], 'utf8').trim() === 'tag';
        } catch {
          return false;
        }
      },
      manifestIntroductionCommit: () => {
        const commit = runGit(
          options.repositoryRoot,
          ['log', '--diff-filter=A', '--format=%H', '-n', '1', '--', MANIFEST_PATH],
          'utf8',
        ).trim();
        return commit || null;
      },
      isAncestor: (commit, releaseRef) => {
        const result = spawnSync('git', ['merge-base', '--is-ancestor', commit, releaseRef], {
          cwd: options.repositoryRoot,
          encoding: 'utf8',
          shell: false,
        });
        return !result.error && result.status === 0;
      },
      readTaggedFile: (releaseRef, path) => runGit(
        options.repositoryRoot,
        ['show', `${releaseRef}:${path}`],
        'buffer',
      ),
    },
  };
}

type ArchiveMode = 'create' | 'verify' | 'cleanup';

function parseCliArguments(arguments_: string[], repositoryRoot: string): {
  mode: ArchiveMode;
  options: ArchiveOptions;
} {
  let mode: ArchiveMode | undefined;
  const values = new Map<string, string>();
  for (const argument of arguments_) {
    if (['--create', '--verify', '--cleanup'].includes(argument)) {
      if (mode) throw new Error('EXACTLY_ONE_ARCHIVE_MODE_REQUIRED');
      mode = argument.slice(2) as ArchiveMode;
      continue;
    }
    const match = /^--([a-z-]+)=(.+)$/u.exec(argument);
    if (!match || values.has(match[1])) throw new Error(`INVALID_ARGUMENT:${argument}`);
    values.set(match[1], match[2]);
  }
  if (!mode) throw new Error('EXACTLY_ONE_ARCHIVE_MODE_REQUIRED');
  const required = ['source-root', 'source-hashes', 'initial-inventory', 'inventory', 'attestation'];
  for (const name of required) if (!values.has(name)) throw new Error(`MISSING_ARGUMENT:${name}`);
  const allowed = new Set([...required, 'release-ref']);
  for (const name of values.keys()) if (!allowed.has(name)) throw new Error(`INVALID_ARGUMENT:${name}`);
  if (mode === 'cleanup' && !values.has('release-ref')) throw new Error('MISSING_ARGUMENT:release-ref');
  if (mode !== 'cleanup' && values.has('release-ref')) throw new Error('INVALID_ARGUMENT:release-ref');

  const sourceRoot = values.get('source-root')!;
  if (!isAbsolute(sourceRoot)) throw new Error('SOURCE_ROOT_NOT_ABSOLUTE');
  const toPath = (name: string) => resolve(repositoryRoot, values.get(name)!);
  return {
    mode,
    options: {
      repositoryRoot,
      sourceRoot,
      sourceHashesPath: toPath('source-hashes'),
      initialInventoryPath: toPath('initial-inventory'),
      inventoryPath: toPath('inventory'),
      attestationPath: toPath('attestation'),
      releaseRef: values.get('release-ref'),
    },
  };
}

const repositoryRoot = resolve(fileURLToPath(import.meta.url), '../..');

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { mode, options } = parseCliArguments(process.argv.slice(2), repositoryRoot);
    const runtime = productionRuntime(options);
    if (mode === 'create') {
      const result = createLegacyDocsArchive(options, runtime);
      process.stdout.write(`Archived ${result.entries.length} authorized documents.\n`);
    } else if (mode === 'verify') {
      const result = verifyLegacyDocsArchive(options, runtime);
      process.stdout.write(`Verified ${result.entries.length} authorized archived documents.\n`);
    } else {
      const result = cleanupLegacyDocs(
        { ...options, releaseRef: options.releaseRef! },
        runtime,
      );
      process.stdout.write(`Removed ${result.removedPaths.length} integrated source documents.\n`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNEXPECTED_ERROR';
    process.stderr.write(`Legacy documentation archive failed: ${message}\n`);
    process.exitCode = 1;
  }
}
