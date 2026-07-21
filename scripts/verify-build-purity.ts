import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertProductionArtifactsContainNoFakeRuntime } from './verify-production-artifacts';

type Snapshot = {
  files: Map<string, string | null>;
  status: string;
};

function runGit(arguments_: string[], encoding: 'buffer'): Buffer;
function runGit(arguments_: string[], encoding: 'utf8'): string;
function runGit(arguments_: string[], encoding: 'buffer' | 'utf8'): Buffer | string {
  const result = spawnSync('git', arguments_, {
    cwd: process.cwd(),
    encoding: encoding === 'utf8' ? 'utf8' : undefined,
    maxBuffer: 64 * 1024 * 1024,
    shell: false,
  });
  if (result.error || result.status !== 0) throw new Error('GIT_SNAPSHOT_FAILED');
  return result.stdout;
}

function hashFile(path: string): string | null {
  try {
    return createHash('sha256').update(readFileSync(path)).digest('hex');
  } catch (error) {
    if (isMissingFileError(error)) return null;
    throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'ENOENT'
  );
}

function captureSnapshot(): Snapshot {
  const listed = runGit(
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    'buffer',
  );
  const paths = listed.toString('utf8').split('\0').filter(Boolean);
  const files = new Map<string, string | null>();
  for (const path of paths) files.set(path, hashFile(path));
  return {
    files,
    status: runGit(['status', '--porcelain=v1', '-uall'], 'utf8'),
  };
}

function statusPaths(status: string): string[] {
  return status
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      const path = line.slice(3);
      return path.includes(' -> ') ? path.split(' -> ') : [path];
    });
}

function changedPaths(before: Snapshot, after: Snapshot): string[] {
  const changed = new Set<string>();
  const paths = new Set([...before.files.keys(), ...after.files.keys()]);
  for (const path of paths) {
    if (!before.files.has(path) || !after.files.has(path)) {
      changed.add(path);
      continue;
    }
    if (before.files.get(path) !== after.files.get(path)) changed.add(path);
  }
  if (before.status !== after.status) {
    for (const path of [...statusPaths(before.status), ...statusPaths(after.status)]) {
      changed.add(path);
    }
  }
  return [...changed].sort();
}

function runBuild(): void {
  const environment = { ...process.env };
  delete environment.PUBLIC_EGREGORE_E2E;
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: process.cwd(),
    env: environment,
    shell: false,
    stdio: 'inherit',
  });
  if (result.error || result.status !== 0) throw new Error('BUILD_FAILED');
}

export function verifyBuildPurity(): void {
  const before = captureSnapshot();
  runBuild();
  assertProductionArtifactsContainNoFakeRuntime(resolve('dist'));
  const after = captureSnapshot();
  const changed = changedPaths(before, after);
  if (changed.length > 0) {
    throw new Error(`BUILD_MUTATED_INPUTS:${changed.join(',')}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    verifyBuildPurity();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNEXPECTED_ERROR';
    process.stderr.write(`Build purity verification failed: ${message}\n`);
    process.exitCode = 1;
  }
}
