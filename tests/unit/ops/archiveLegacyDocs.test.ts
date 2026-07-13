import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ARCHIVE_ENTRIES,
  archiveBanner,
  cleanupLegacyDocs,
  createLegacyDocsArchive,
  verifyLegacyDocsArchive,
  type ArchiveGitAdapter,
  type ArchiveOptions,
  type ArchiveRuntime,
} from '../../../scripts/archive-legacy-docs';

const ACTIVE_ARTICLE = 'Untracked/how-to-install-and-get-started-with-codex-cli-2026.mdx';
const temporaryRoots: string[] = [];

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function write(path: string, contents: string | Buffer, mode?: number): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, mode === undefined ? undefined : { mode });
}

type Fixture = {
  expectedInventory: Buffer;
  initialInventory: Buffer;
  git: ArchiveGitAdapter;
  options: ArchiveOptions;
  reads: string[];
  repositoryRoot: string;
  runtime: ArchiveRuntime;
  sourceBodies: Map<string, Buffer>;
  sourceModes: Map<string, number>;
  sourceRoot: string;
  taggedFiles: Map<string, Buffer>;
};

function makeFixture(): Fixture {
  const repositoryRoot = mkdtempSync(join(tmpdir(), 'jet-web-archive-repository-'));
  temporaryRoots.push(repositoryRoot);
  const sourceRoot = join(repositoryRoot, 'protected-original');
  const privateRoot = join(repositoryRoot, 'private-operator-state');
  mkdirSync(sourceRoot, { recursive: true });
  mkdirSync(privateRoot, { recursive: true, mode: 0o700 });

  const sourceBodies = new Map(
    ARCHIVE_ENTRIES.map((entry, index) => [
      entry.sourcePath,
      Buffer.from(`# Historical source ${index + 1}\n\nBody for ${entry.sourcePath}.\n`),
    ]),
  );
  const requestedModes = [0o600, 0o640, 0o644, 0o604, 0o620, 0o600, 0o640];
  const sourceModes = new Map<string, number>();
  [...sourceBodies].forEach(([path, body], index) => {
    const sourcePath = join(sourceRoot, path);
    write(sourcePath, body, requestedModes[index]);
    sourceModes.set(path, lstatSync(sourcePath).mode & 0o777);
  });
  write(join(sourceRoot, ACTIVE_ARTICLE), Buffer.from('private active draft; never open\n'));

  const approvedInventoryRecords = [
    ...ARCHIVE_ENTRIES.map((entry) => `?? ${entry.sourcePath}`),
    `?? ${ACTIVE_ARTICLE}`,
  ].sort();
  const expectedInventory = Buffer.from(`${approvedInventoryRecords.join('\n')}\n`);
  const initialInventoryRecords = [
    ...approvedInventoryRecords,
    '?? legacy-task-0-only-entry.md',
  ].sort();
  const initialInventory = Buffer.from(`${initialInventoryRecords.join('\0')}\0`);
  const hashes = [...sourceBodies]
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([path, body]) => `${sha256(body)}  ${path}`)
    .join('\n');
  const attestation = {
    schemaVersion: '1.0.0',
    approvedSha: 'a'.repeat(40),
    inventory: {
      sha256: sha256(initialInventory),
      entryCount: initialInventoryRecords.length,
    },
    approvedTask11Inventory: {
      sha256: sha256(expectedInventory),
      entryCount: approvedInventoryRecords.length,
    },
    authorizedArchiveSources: [...sourceBodies]
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([path, body]) => ({ path, sha256: sha256(body) })),
  };

  const sourceHashesPath = join(privateRoot, 'authorized-archive-source-hashes.txt');
  const initialInventoryPath = join(privateRoot, 'original-status.z');
  const approvedInventoryPath = join(privateRoot, 'task-11-approved-status.txt');
  const attestationPath = join(
    repositoryRoot,
    'docs/verification/baselines/core-1.0.0/operator-state-attestation.json',
  );
  write(sourceHashesPath, `${hashes}\n`, 0o600);
  write(initialInventoryPath, initialInventory, 0o600);
  write(approvedInventoryPath, expectedInventory, 0o600);
  write(attestationPath, `${JSON.stringify(attestation, null, 2)}\n`);

  const taggedFiles = new Map<string, Buffer>();
  const gitState = {
    annotated: true,
    introductionCommit: 'b'.repeat(40),
    isAncestor: true,
    inventory: expectedInventory,
  };
  const git: ArchiveGitAdapter = {
    currentInventory: () => gitState.inventory,
    isAnnotatedTag: () => gitState.annotated,
    manifestIntroductionCommit: () => gitState.introductionCommit,
    isAncestor: () => gitState.isAncestor,
    readTaggedFile: (_releaseRef, path) => {
      const bytes = taggedFiles.get(path);
      if (!bytes) throw new Error(`TAGGED_PATH_MISSING:${path}`);
      return bytes;
    },
  };
  const reads: string[] = [];
  const runtime: ArchiveRuntime = {
    fileSystem: {
      exists: existsSync,
      lstat: lstatSync,
      readFile: (path) => {
        reads.push(path);
        return readFileSync(path);
      },
      writeFile: (path, contents, mode) => write(path, contents, mode),
      mkdir: (path, mode) => mkdirSync(path, { recursive: true, mode }),
      chmod: chmodSync,
      unlink: (path) => rmSync(path),
      removeTree: (path) => rmSync(path, { recursive: true, force: true }),
    },
    git,
  };
  const options: ArchiveOptions = {
    repositoryRoot,
    sourceRoot,
    sourceHashesPath,
    initialInventoryPath,
    inventoryPath: approvedInventoryPath,
    attestationPath,
  };

  return {
    expectedInventory,
    initialInventory,
    git,
    options,
    reads,
    repositoryRoot,
    runtime,
    sourceBodies,
    sourceModes,
    sourceRoot,
    taggedFiles,
  };
}

function captureTaggedArchive(fixture: Fixture): void {
  for (const path of [
    'docs/archive/archive-manifest.json',
    ...ARCHIVE_ENTRIES.map((entry) => entry.archivePath),
  ]) {
    fixture.taggedFiles.set(path, readFileSync(join(fixture.repositoryRoot, path)));
  }
}

function cleanupBackupRoot(fixture: Fixture): string {
  return join(dirname(fixture.options.inventoryPath), 'archive-cleanup-backups');
}

function expectAllSourcesRestored(fixture: Fixture): void {
  for (const entry of ARCHIVE_ENTRIES) {
    const path = join(fixture.sourceRoot, entry.sourcePath);
    const stat = lstatSync(path);
    expect(stat.isFile()).toBe(true);
    expect(stat.isSymbolicLink()).toBe(false);
    expect(stat.mode & 0o777).toBe(fixture.sourceModes.get(entry.sourcePath));
    expect(readFileSync(path)).toEqual(fixture.sourceBodies.get(entry.sourcePath));
  }
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('legacy documentation archive', () => {
  it('uses the exact seven-source map and a neutral deferred-concepts taxonomy', () => {
    expect(ARCHIVE_ENTRIES).toHaveLength(7);
    expect(ARCHIVE_ENTRIES.map((entry) => [entry.sourcePath, entry.archivePath])).toEqual([
      ['EMBEDDING_STORAGE_RESEARCH.md', 'docs/archive/jets-ghost/legacy-rag/embedding-storage-research.md'],
      ['docs/jets-ghost-v1.5-spec.md', 'docs/archive/jets-ghost/legacy-rag/jets-ghost-v1.5-spec.md'],
      ['docs/rag-chatbot-implementation-review.md', 'docs/archive/jets-ghost/legacy-rag/rag-chatbot-implementation-review.md'],
      ['docs/liquid-glass-dock-v2-log.md', 'docs/archive/site/implementation-logs/liquid-glass-dock-v2.md'],
      ['Untracked/docs/emdash-news-theme-spec.md', 'docs/archive/deferred-concepts/emdash-news-theme-spec.md'],
      ['Untracked/docs/page-analyzer-spec.md', 'docs/archive/deferred-concepts/page-analyzer-spec.md'],
      ['Untracked/docs/schema-visualizer-spec.md', 'docs/archive/deferred-concepts/schema-visualizer-spec.md'],
    ]);
    expect(ARCHIVE_ENTRIES.slice(4).every((entry) => entry.status === 'deferred')).toBe(true);
  });

  it('creates and verifies Markdown banners and deterministic hashes', () => {
    const fixture = makeFixture();

    const created = createLegacyDocsArchive(fixture.options, fixture.runtime);
    const verified = verifyLegacyDocsArchive(fixture.options, fixture.runtime);

    expect(verified).toEqual(created);
    expect(created.entries).toHaveLength(7);
    for (const entry of ARCHIVE_ENTRIES) {
      const sourceBody = fixture.sourceBodies.get(entry.sourcePath)!;
      const archived = readFileSync(join(fixture.repositoryRoot, entry.archivePath));
      expect(archived).toEqual(Buffer.concat([Buffer.from(archiveBanner(entry)), sourceBody]));
      const manifestEntry = created.entries.find((candidate) => (
        candidate.sourcePath === entry.sourcePath
      ));
      expect(manifestEntry).toMatchObject({
        archivePath: entry.archivePath,
        sourceSha256: sha256(sourceBody),
        archiveSha256: sha256(archived),
        status: entry.status,
      });
    }
  });

  it('never opens the active Codex article during create or verify', () => {
    const fixture = makeFixture();
    createLegacyDocsArchive(fixture.options, fixture.runtime);
    verifyLegacyDocsArchive(fixture.options, fixture.runtime);

    expect(fixture.reads.some((path) => path.endsWith(ACTIVE_ARTICLE))).toBe(false);
  });

  it('validates the immutable NUL Task 0 and newline Task 11 inventories separately', () => {
    const initialDrift = makeFixture();
    write(
      initialDrift.options.initialInventoryPath,
      Buffer.concat([initialDrift.initialInventory, Buffer.from('?? task-0-drift.md\0')]),
      0o600,
    );
    expect(() => createLegacyDocsArchive(initialDrift.options, initialDrift.runtime))
      .toThrow('INITIAL_INVENTORY_ATTESTATION_MISMATCH');

    const approvedDrift = makeFixture();
    write(
      approvedDrift.options.inventoryPath,
      Buffer.from(
        approvedDrift.expectedInventory.toString('utf8')
          .replace('schema-visualizer-spec.md', 'schema-visualizer-spec.mx'),
      ),
      0o600,
    );
    expect(() => createLegacyDocsArchive(approvedDrift.options, approvedDrift.runtime))
      .toThrow('TASK_11_INVENTORY_ATTESTATION_MISMATCH');
  });

  it('rejects source hash drift, archived-body drift, symlinks, and missing/unexpected state', () => {
    const sourceDrift = makeFixture();
    write(join(sourceDrift.sourceRoot, ARCHIVE_ENTRIES[0].sourcePath), 'changed\n');
    expect(() => createLegacyDocsArchive(sourceDrift.options, sourceDrift.runtime))
      .toThrow('SOURCE_HASH_MISMATCH');

    const archiveDrift = makeFixture();
    createLegacyDocsArchive(archiveDrift.options, archiveDrift.runtime);
    const markdownEntry = ARCHIVE_ENTRIES[1];
    write(
      join(archiveDrift.repositoryRoot, markdownEntry.archivePath),
      `${archiveBanner(markdownEntry)}mutated\n`,
    );
    expect(() => verifyLegacyDocsArchive(archiveDrift.options, archiveDrift.runtime))
      .toThrow('ARCHIVED_BODY_HASH_MISMATCH');

    const symlink = makeFixture();
    rmSync(join(symlink.sourceRoot, ARCHIVE_ENTRIES[2].sourcePath));
    symlinkSync('/dev/null', join(symlink.sourceRoot, ARCHIVE_ENTRIES[2].sourcePath));
    expect(() => createLegacyDocsArchive(symlink.options, symlink.runtime))
      .toThrow('SOURCE_NOT_REGULAR_FILE');

    const missing = makeFixture();
    rmSync(join(missing.sourceRoot, ARCHIVE_ENTRIES[3].sourcePath));
    expect(() => createLegacyDocsArchive(missing.options, missing.runtime))
      .toThrow('SOURCE_NOT_REGULAR_FILE');

    const destination = makeFixture();
    write(join(destination.repositoryRoot, ARCHIVE_ENTRIES[0].archivePath), 'unexpected\n');
    expect(() => createLegacyDocsArchive(destination.options, destination.runtime))
      .toThrow('ARCHIVE_DESTINATION_EXISTS');
  });

  it('rejects cleanup when the annotated release does not contain the archive commit', () => {
    const fixture = makeFixture();
    createLegacyDocsArchive(fixture.options, fixture.runtime);
    captureTaggedArchive(fixture);
    fixture.git.isAncestor = () => false;

    expect(() => cleanupLegacyDocs(
      { ...fixture.options, releaseRef: 'v2.0.0' },
      fixture.runtime,
    )).toThrow('ARCHIVE_COMMIT_NOT_IN_RELEASE');
    expect(ARCHIVE_ENTRIES.every((entry) => existsSync(join(fixture.sourceRoot, entry.sourcePath))))
      .toBe(true);
  });

  it('rejects tagged manifest or destination drift even when worktree verification passes', () => {
    const manifestDrift = makeFixture();
    createLegacyDocsArchive(manifestDrift.options, manifestDrift.runtime);
    captureTaggedArchive(manifestDrift);
    manifestDrift.taggedFiles.set(
      'docs/archive/archive-manifest.json',
      Buffer.from('{"schemaVersion":"drifted"}\n'),
    );
    expect(() => cleanupLegacyDocs(
      { ...manifestDrift.options, releaseRef: 'v2.0.0' },
      manifestDrift.runtime,
    )).toThrow('TAGGED_MANIFEST_INVALID');

    const blobDrift = makeFixture();
    createLegacyDocsArchive(blobDrift.options, blobDrift.runtime);
    captureTaggedArchive(blobDrift);
    blobDrift.taggedFiles.set(ARCHIVE_ENTRIES[0].archivePath, Buffer.from('tagged drift\n'));
    expect(() => cleanupLegacyDocs(
      { ...blobDrift.options, releaseRef: 'v2.0.0' },
      blobDrift.runtime,
    )).toThrow('TAGGED_ARCHIVE_HASH_MISMATCH');
  });

  it('rejects cleanup before mutation when the original inventory drifted', () => {
    const fixture = makeFixture();
    createLegacyDocsArchive(fixture.options, fixture.runtime);
    captureTaggedArchive(fixture);
    fixture.git.currentInventory = () => Buffer.concat([
      fixture.expectedInventory,
      Buffer.from('?? unexpected.md\n'),
    ]);

    expect(() => cleanupLegacyDocs(
      { ...fixture.options, releaseRef: 'v2.0.0' },
      fixture.runtime,
    )).toThrow('SOURCE_INVENTORY_MISMATCH');
  });

  it('removes exactly seven mapped sources and leaves the active article', () => {
    const fixture = makeFixture();
    createLegacyDocsArchive(fixture.options, fixture.runtime);
    captureTaggedArchive(fixture);
    const remaining = Buffer.from(`?? ${ACTIVE_ARTICLE}\n`);
    let inventoryCalls = 0;
    fixture.git.currentInventory = () => (
      inventoryCalls++ === 0 ? fixture.expectedInventory : remaining
    );

    const result = cleanupLegacyDocs(
      { ...fixture.options, releaseRef: 'v2.0.0' },
      fixture.runtime,
    );

    expect(result.removedPaths).toEqual(ARCHIVE_ENTRIES.map((entry) => entry.sourcePath));
    expect(ARCHIVE_ENTRIES.every((entry) => !existsSync(join(fixture.sourceRoot, entry.sourcePath))))
      .toBe(true);
    expect(readFileSync(join(fixture.sourceRoot, ACTIVE_ARTICLE), 'utf8'))
      .toBe('private active draft; never open\n');
    expect(fixture.reads.some((path) => path.endsWith(ACTIVE_ARTICLE))).toBe(false);
  });

  it('restores all seven sources from verified private backups after unlink failure', () => {
    const unlinkFailure = makeFixture();
    createLegacyDocsArchive(unlinkFailure.options, unlinkFailure.runtime);
    captureTaggedArchive(unlinkFailure);
    const originalUnlink = unlinkFailure.runtime.fileSystem.unlink;
    let unlinkCalls = 0;
    unlinkFailure.runtime.fileSystem.unlink = (path) => {
      if (unlinkCalls++ === 3) throw new Error('INJECTED_UNLINK_FAILURE');
      originalUnlink(path);
    };
    expect(() => cleanupLegacyDocs(
      { ...unlinkFailure.options, releaseRef: 'v2.0.0' },
      unlinkFailure.runtime,
    )).toThrow('CLEANUP_ROLLED_BACK:INJECTED_UNLINK_FAILURE');
    expectAllSourcesRestored(unlinkFailure);
    const backupReads = unlinkFailure.reads
      .filter((path) => path.includes('archive-cleanup-backups'));
    expect(backupReads).toHaveLength(ARCHIVE_ENTRIES.length * 2);
    for (let index = 0; index < ARCHIVE_ENTRIES.length; index += 1) {
      expect(backupReads.filter((path) => path.endsWith(`${String(index).padStart(2, '0')}.bin`)))
        .toHaveLength(2);
    }
    expect(existsSync(cleanupBackupRoot(unlinkFailure))).toBe(false);
  });

  it('verifies restored inventory after a failed cleanup postcondition', () => {
    const postcondition = makeFixture();
    createLegacyDocsArchive(postcondition.options, postcondition.runtime);
    captureTaggedArchive(postcondition);
    let inventoryCalls = 0;
    postcondition.git.currentInventory = () => {
      inventoryCalls += 1;
      return inventoryCalls === 2
        ? Buffer.from('?? wrong-postcondition.md\n')
        : postcondition.expectedInventory;
    };
    expect(() => cleanupLegacyDocs(
      { ...postcondition.options, releaseRef: 'v2.0.0' },
      postcondition.runtime,
    )).toThrow('CLEANUP_ROLLED_BACK:CLEANUP_POSTCONDITION_MISMATCH');
    expect(inventoryCalls).toBe(3);
    expectAllSourcesRestored(postcondition);
    expect(existsSync(cleanupBackupRoot(postcondition))).toBe(false);
  });

  it('retains private backups and reports both causes when restored bytes fail proof', () => {
    const fixture = makeFixture();
    createLegacyDocsArchive(fixture.options, fixture.runtime);
    captureTaggedArchive(fixture);
    const target = join(fixture.sourceRoot, ARCHIVE_ENTRIES[0].sourcePath);
    const originalWrite = fixture.runtime.fileSystem.writeFile;
    fixture.runtime.fileSystem.writeFile = (path, contents, mode) => {
      originalWrite(path, path === target ? Buffer.from('corrupted restore\n') : contents, mode);
    };
    const originalUnlink = fixture.runtime.fileSystem.unlink;
    let unlinkCalls = 0;
    fixture.runtime.fileSystem.unlink = (path) => {
      if (unlinkCalls++ === 3) throw new Error('INJECTED_UNLINK_FAILURE');
      originalUnlink(path);
    };

    expect(() => cleanupLegacyDocs(
      { ...fixture.options, releaseRef: 'v2.0.0' },
      fixture.runtime,
    )).toThrow(
      'CLEANUP_ROLLBACK_FAILED:original=INJECTED_UNLINK_FAILURE;rollback=ROLLBACK_TARGET_HASH_MISMATCH',
    );
    expect(existsSync(cleanupBackupRoot(fixture))).toBe(true);
    expect(readFileSync(join(cleanupBackupRoot(fixture), '00.bin')))
      .toEqual(fixture.sourceBodies.get(ARCHIVE_ENTRIES[0].sourcePath));
  });

  it('retains private backups when restored file mode fails proof', () => {
    const fixture = makeFixture();
    createLegacyDocsArchive(fixture.options, fixture.runtime);
    captureTaggedArchive(fixture);
    const target = join(fixture.sourceRoot, ARCHIVE_ENTRIES[0].sourcePath);
    const originalChmod = fixture.runtime.fileSystem.chmod;
    fixture.runtime.fileSystem.chmod = (path, mode) => {
      originalChmod(path, path === target ? 0o644 : mode);
    };
    const originalUnlink = fixture.runtime.fileSystem.unlink;
    let unlinkCalls = 0;
    fixture.runtime.fileSystem.unlink = (path) => {
      if (unlinkCalls++ === 3) throw new Error('INJECTED_UNLINK_FAILURE');
      originalUnlink(path);
    };

    expect(() => cleanupLegacyDocs(
      { ...fixture.options, releaseRef: 'v2.0.0' },
      fixture.runtime,
    )).toThrow(
      'CLEANUP_ROLLBACK_FAILED:original=INJECTED_UNLINK_FAILURE;rollback=ROLLBACK_TARGET_MODE_MISMATCH',
    );
    expect(existsSync(cleanupBackupRoot(fixture))).toBe(true);
  });

  it('retains private backups when restored inventory fails proof', () => {
    const fixture = makeFixture();
    createLegacyDocsArchive(fixture.options, fixture.runtime);
    captureTaggedArchive(fixture);
    let inventoryCalls = 0;
    fixture.git.currentInventory = () => {
      inventoryCalls += 1;
      return inventoryCalls === 1
        ? fixture.expectedInventory
        : Buffer.from('?? wrong-postcondition.md\n');
    };

    expect(() => cleanupLegacyDocs(
      { ...fixture.options, releaseRef: 'v2.0.0' },
      fixture.runtime,
    )).toThrow(
      'CLEANUP_ROLLBACK_FAILED:original=CLEANUP_POSTCONDITION_MISMATCH;rollback=ROLLBACK_INVENTORY_MISMATCH',
    );
    expect(inventoryCalls).toBe(3);
    expectAllSourcesRestored(fixture);
    expect(existsSync(cleanupBackupRoot(fixture))).toBe(true);
  });
});
