import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  assertProductionArtifactsContainNoFakeRuntime,
  findForbiddenProductionArtifacts,
} from '../../../scripts/verify-production-artifacts';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function temporaryBuildDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'jets-ghost-production-artifacts-'));
  temporaryDirectories.push(directory);
  return directory;
}

describe('ordinary production artifact containment', () => {
  it('accepts a clean emitted build tree', () => {
    const directory = temporaryBuildDirectory();
    mkdirSync(join(directory, '_astro'));
    writeFileSync(join(directory, 'index.html'), '<main>Production site</main>');
    writeFileSync(join(directory, '_astro', 'experience.js'), 'const local = true;');

    expect(findForbiddenProductionArtifacts(directory)).toEqual([]);
    expect(() => assertProductionArtifactsContainNoFakeRuntime(directory)).not.toThrow();
  });

  it('rejects every fake-runtime marker in nested emitted artifacts', () => {
    const directory = temporaryBuildDirectory();
    const nested = join(directory, '_astro');
    mkdirSync(nested);
    const markers = [
      'FakeRuntime',
      'runtime=fake',
      '__JETS_GHOST_E2E__',
      "Jet's published work connects local-first AI with systems thinking [S1].",
    ];
    markers.forEach((marker, index) => {
      writeFileSync(join(nested, `chunk-${index}.js`), `/* ${marker} */`);
    });

    expect(findForbiddenProductionArtifacts(directory).map(({ marker }) => marker)).toEqual(markers);
    expect(() => assertProductionArtifactsContainNoFakeRuntime(directory)).toThrow(
      /FORBIDDEN_PRODUCTION_ARTIFACT_CONTENT/,
    );
  });
});
