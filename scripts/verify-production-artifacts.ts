import {
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FORBIDDEN_PRODUCTION_ARTIFACT_MARKERS = [
  'FakeRuntime',
  'runtime=fake',
  '__JETS_GHOST_E2E__',
  "Jet's published work connects local-first AI with systems thinking [S1].",
] as const;

export interface ForbiddenProductionArtifact {
  path: string;
  marker: typeof FORBIDDEN_PRODUCTION_ARTIFACT_MARKERS[number];
}

function emittedFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return emittedFiles(path);
      if (entry.isFile() || entry.isSymbolicLink()) return [path];
      return [];
    });
}

export function findForbiddenProductionArtifacts(
  directory = resolve('dist'),
): ForbiddenProductionArtifact[] {
  const root = resolve(directory);
  if (!statSync(root).isDirectory()) {
    throw new Error('PRODUCTION_ARTIFACT_DIRECTORY_MISSING');
  }

  const findings: ForbiddenProductionArtifact[] = [];
  for (const path of emittedFiles(root)) {
    const content = readFileSync(path);
    for (const marker of FORBIDDEN_PRODUCTION_ARTIFACT_MARKERS) {
      if (content.includes(Buffer.from(marker))) {
        findings.push({
          path: relative(root, path),
          marker,
        });
      }
    }
  }
  return findings;
}

export function assertProductionArtifactsContainNoFakeRuntime(
  directory = resolve('dist'),
): void {
  const findings = findForbiddenProductionArtifacts(directory);
  if (findings.length === 0) return;
  throw new Error(`FORBIDDEN_PRODUCTION_ARTIFACT_CONTENT:${findings
    .map(({ marker, path }) => `${path}:${marker}`)
    .join(',')}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assertProductionArtifactsContainNoFakeRuntime(process.argv[2] ?? resolve('dist'));
    process.stdout.write('Production artifacts contain no Jet\'s Ghost fake-runtime seam.\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNEXPECTED_ERROR';
    process.stderr.write(`Production artifact verification failed: ${message}\n`);
    process.exitCode = 1;
  }
}
