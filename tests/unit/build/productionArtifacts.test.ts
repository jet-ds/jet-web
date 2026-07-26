import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { afterEach, describe, expect, it } from 'vitest';

import {
  FORBIDDEN_PRODUCTION_ARTIFACT_MARKERS,
  assertProductionArtifactsContainNoFakeRuntime,
  findForbiddenProductionArtifacts,
} from '../../../scripts/verify-production-artifacts';
import {
  LITERT_LM_WASM_ASSETS,
  resolveLiteRtAssetPath,
} from '../../../src/features/egregore/runtime/liteRtAssets.server';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function temporaryBuildDirectory(): string {
  const directory = mkdtempSync(
    join(tmpdir(), 'egregore-production-artifacts-'),
  );
  temporaryDirectories.push(directory);
  return directory;
}

function runProductionArtifactVerifier(directory: string) {
  return spawnSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/verify-production-artifacts.ts', directory],
    {
      cwd: resolve('.'),
      encoding: 'utf8',
    },
  );
}

function writeExactProductionSurface(directory: string): void {
  const licensePageDirectory = join(directory, 'licenses', 'egregore');
  const liteRtDirectory = join(
    directory,
    'assistant',
    'runtime',
    'litert-lm',
    '0.14.0',
  );
  mkdirSync(licensePageDirectory, { recursive: true });
  mkdirSync(liteRtDirectory, { recursive: true });
  cpSync(
    'THIRD_PARTY_NOTICES.md',
    join(directory, 'licenses', 'THIRD_PARTY_NOTICES.md'),
  );
  cpSync(
    'LICENSES/Apache-2.0.txt',
    join(directory, 'licenses', 'apache-2.0.txt'),
  );
  cpSync(
    'LICENSES/minisearch-7.2.0-MIT.txt',
    join(directory, 'licenses', 'minisearch-7.2.0-MIT.txt'),
  );
  cpSync(
    'LICENSES/stemmer-2.0.1-MIT.txt',
    join(directory, 'licenses', 'stemmer-2.0.1-MIT.txt'),
  );
  cpSync('LICENSES/Apache-2.0.txt', join(liteRtDirectory, 'LICENSE.txt'));
  for (const asset of LITERT_LM_WASM_ASSETS) {
    cpSync(resolveLiteRtAssetPath(asset), join(liteRtDirectory, asset));
  }
  writeFileSync(
    join(licensePageDirectory, 'index.html'),
    [
      'Egregore model and open-source licenses',
      'Gemma 4 E2B',
      '/licenses/THIRD_PARTY_NOTICES.md',
      '/licenses/apache-2.0.txt',
      '/licenses/minisearch-7.2.0-MIT.txt',
      '/licenses/stemmer-2.0.1-MIT.txt',
      '/assistant/runtime/litert-lm/0.14.0/LICENSE.txt',
    ].join('\n'),
  );
}

describe('ordinary production artifact containment', () => {
  it('forbids qualification-only observation seams from production output', () => {
    expect(FORBIDDEN_PRODUCTION_ARTIFACT_MARKERS).toContain(
      'egregore:qualification-observation',
    );
  });

  it('accepts a clean emitted build tree', () => {
    const directory = temporaryBuildDirectory();
    mkdirSync(join(directory, '_astro'));
    writeFileSync(
      join(directory, 'index.html'),
      '<main>Production site</main>',
    );
    writeFileSync(
      join(directory, '_astro', 'experience.js'),
      'const local = true;',
    );

    expect(findForbiddenProductionArtifacts(directory)).toEqual([]);
    expect(() =>
      assertProductionArtifactsContainNoFakeRuntime(directory),
    ).not.toThrow();
  });

  it('rejects every fake-runtime marker in nested emitted artifacts', () => {
    const directory = temporaryBuildDirectory();
    const nested = join(directory, '_astro');
    mkdirSync(nested);
    const markers = [
      'FakeRuntime',
      'runtime=fake',
      '__EGREGORE_E2E__',
      "Jet's published work connects local-first AI with systems thinking [S1].",
      'stop-recovery',
      'late-event',
      'EGREGORE_SOURCE_SENTINEL_4a6c1b',
    ];
    markers.forEach((marker, index) => {
      writeFileSync(join(nested, `chunk-${index}.js`), `/* ${marker} */`);
    });

    expect(
      findForbiddenProductionArtifacts(directory).map(({ marker }) => marker),
    ).toEqual(markers);
    expect(() =>
      assertProductionArtifactsContainNoFakeRuntime(directory),
    ).toThrow(/FORBIDDEN_PRODUCTION_ARTIFACT_CONTENT/);
  });

  it('rejects a build that omits the stable license surface', () => {
    const directory = temporaryBuildDirectory();
    writeFileSync(
      join(directory, 'index.html'),
      '<main>Production site</main>',
    );

    const result = runProductionArtifactVerifier(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('PRODUCTION_LICENSE_ARTIFACT_MISSING');
  });

  it('rejects a public license endpoint whose bytes changed', () => {
    const directory = temporaryBuildDirectory();
    writeExactProductionSurface(directory);
    writeFileSync(join(directory, 'licenses', 'apache-2.0.txt'), 'altered');

    const result = runProductionArtifactVerifier(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('PRODUCTION_LICENSE_ARTIFACT_MISMATCH');
  });

  it('rejects a canonical license page without the Egregore notice identity', () => {
    const directory = temporaryBuildDirectory();
    writeExactProductionSurface(directory);
    const pagePath = join(directory, 'licenses', 'egregore', 'index.html');
    writeFileSync(
      pagePath,
      readFileSync(pagePath, 'utf8').replace(
        'Egregore model and open-source licenses',
        'Local assistant model and open-source licenses',
      ),
    );

    const result = runProductionArtifactVerifier(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'PRODUCTION_LICENSE_PAGE_INCOMPLETE:licenses/egregore/index.html:Egregore model and open-source licenses',
    );
  });

  it('rejects a build that omits an emitted LiteRT runtime asset', () => {
    const directory = temporaryBuildDirectory();
    writeExactProductionSurface(directory);
    const asset = LITERT_LM_WASM_ASSETS[0];
    rmSync(
      join(directory, 'assistant', 'runtime', 'litert-lm', '0.14.0', asset),
    );

    const result = runProductionArtifactVerifier(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `PRODUCTION_RUNTIME_ARTIFACT_MISSING:assistant/runtime/litert-lm/0.14.0/${asset}`,
    );
  });

  it('rejects an emitted LiteRT runtime asset whose bytes changed', () => {
    const directory = temporaryBuildDirectory();
    writeExactProductionSurface(directory);
    const asset = LITERT_LM_WASM_ASSETS[1];
    writeFileSync(
      join(directory, 'assistant', 'runtime', 'litert-lm', '0.14.0', asset),
      'altered',
    );

    const result = runProductionArtifactVerifier(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `PRODUCTION_RUNTIME_ARTIFACT_MISMATCH:assistant/runtime/litert-lm/0.14.0/${asset}`,
    );
  });

  it('accepts the exact complete emitted runtime and license surfaces', () => {
    const directory = temporaryBuildDirectory();
    writeExactProductionSurface(directory);

    const result = runProductionArtifactVerifier(directory);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('complete and byte-exact');
  });
});
