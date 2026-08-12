import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EGREGORE_IDENTITY } from '../src/config/egregore';
import {
  LITERT_LM_WASM_ASSETS,
  resolveLiteRtAssetPath,
} from '../src/features/egregore/runtime/liteRtAssets.server';

export const FORBIDDEN_PRODUCTION_ARTIFACT_MARKERS = [
  'FakeRuntime',
  'runtime=fake',
  '__EGREGORE_E2E__',
  'egregore:qualification-observation',
  'qualificationObserver',
  'retrieval-context-selection-start',
  'retrieval-context-selection-end',
  'prompt-assembly-start',
  'prompt-assembly-end',
  'generation-send',
  'generation-first-nonempty',
  'retrieval-context-selection-ms',
  'prompt-assembly-ms',
  'send-to-first-nonempty-ms',
  'total-generation-ms',
  "Jet's published work connects local-first AI with systems thinking [S1].",
  'stop-recovery',
  'late-event',
  'EGREGORE_SOURCE_SENTINEL_4a6c1b',
  'local-first-agentic-systems',
] as const;

export interface ForbiddenProductionArtifact {
  path: string;
  marker: (typeof FORBIDDEN_PRODUCTION_ARTIFACT_MARKERS)[number];
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
  throw new Error(
    `FORBIDDEN_PRODUCTION_ARTIFACT_CONTENT:${findings
      .map(({ marker, path }) => `${path}:${marker}`)
      .join(',')}`,
  );
}

const REQUIRED_LICENSE_ARTIFACTS = [
  {
    emittedPath: 'licenses/THIRD_PARTY_NOTICES.md',
    sourcePath: 'THIRD_PARTY_NOTICES.md',
  },
  {
    emittedPath: 'licenses/apache-2.0.txt',
    sourcePath: 'LICENSES/Apache-2.0.txt',
  },
  {
    emittedPath: 'licenses/minisearch-7.2.0-MIT.txt',
    sourcePath: 'LICENSES/minisearch-7.2.0-MIT.txt',
  },
  {
    emittedPath: 'licenses/stemmer-2.0.1-MIT.txt',
    sourcePath: 'LICENSES/stemmer-2.0.1-MIT.txt',
  },
  {
    emittedPath: 'assistant/runtime/litert-lm/0.14.0/LICENSE.txt',
    sourcePath: 'LICENSES/Apache-2.0.txt',
  },
] as const;

const REQUIRED_LICENSE_PAGE_FRAGMENTS = [
  `${EGREGORE_IDENTITY.name} model and open-source licenses`,
  'Gemma 4 E2B',
  '/licenses/THIRD_PARTY_NOTICES.md',
  '/licenses/apache-2.0.txt',
  '/licenses/minisearch-7.2.0-MIT.txt',
  '/licenses/stemmer-2.0.1-MIT.txt',
  '/assistant/runtime/litert-lm/0.14.0/LICENSE.txt',
] as const;

const LICENSE_PAGE_ARTIFACT = `${EGREGORE_IDENTITY.licensePath.slice(1)}index.html`;

export function assertProductionLicenseArtifacts(
  directory = resolve('dist'),
): void {
  const root = resolve(directory);
  for (const artifact of REQUIRED_LICENSE_ARTIFACTS) {
    const emittedPath = resolve(root, artifact.emittedPath);
    if (!existsSync(emittedPath)) {
      throw new Error(
        `PRODUCTION_LICENSE_ARTIFACT_MISSING:${artifact.emittedPath}`,
      );
    }

    const emitted = readFileSync(emittedPath);
    const expected = readFileSync(resolve(artifact.sourcePath));
    if (!emitted.equals(expected)) {
      throw new Error(
        `PRODUCTION_LICENSE_ARTIFACT_MISMATCH:${artifact.emittedPath}`,
      );
    }
  }

  const licensePagePath = resolve(root, LICENSE_PAGE_ARTIFACT);
  if (!existsSync(licensePagePath)) {
    throw new Error(
      `PRODUCTION_LICENSE_ARTIFACT_MISSING:${LICENSE_PAGE_ARTIFACT}`,
    );
  }

  const licensePage = readFileSync(licensePagePath, 'utf8');
  for (const fragment of REQUIRED_LICENSE_PAGE_FRAGMENTS) {
    if (!licensePage.includes(fragment)) {
      throw new Error(
        `PRODUCTION_LICENSE_PAGE_INCOMPLETE:${LICENSE_PAGE_ARTIFACT}:${fragment}`,
      );
    }
  }
}

export function assertProductionRuntimeArtifacts(
  directory = resolve('dist'),
): void {
  const root = resolve(directory);
  for (const asset of LITERT_LM_WASM_ASSETS) {
    const emittedRelativePath = `assistant/runtime/litert-lm/0.14.0/${asset}`;
    const emittedPath = resolve(root, emittedRelativePath);
    if (!existsSync(emittedPath)) {
      throw new Error(
        `PRODUCTION_RUNTIME_ARTIFACT_MISSING:${emittedRelativePath}`,
      );
    }

    const emitted = readFileSync(emittedPath);
    const expected = readFileSync(resolveLiteRtAssetPath(asset));
    if (!emitted.equals(expected)) {
      throw new Error(
        `PRODUCTION_RUNTIME_ARTIFACT_MISMATCH:${emittedRelativePath}`,
      );
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const directory = process.argv[2] ?? resolve('dist');
    assertProductionArtifactsContainNoFakeRuntime(directory);
    assertProductionLicenseArtifacts(directory);
    assertProductionRuntimeArtifacts(directory);
    process.stdout.write(
      `Production artifacts contain no ${EGREGORE_IDENTITY.name} fake-runtime seam; the runtime and license surfaces are complete and byte-exact.\n`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNEXPECTED_ERROR';
    process.stderr.write(
      `Production artifact verification failed: ${message}\n`,
    );
    process.exitCode = 1;
  }
}
