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
  assertProductionArtifactsContainNoFakeRuntime,
  assertProductionEgregoreViewportContract,
  assertProductionNavigationProjection,
  findForbiddenProductionArtifacts,
} from '../../../scripts/verify-production-artifacts';
import { NAV_ITEMS, SITE } from '../../../src/config/site';
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

function writePreMarkdownProductionSurface(directory: string): void {
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

function writeRendererLicenseArtifacts(directory: string): void {
  for (const filename of [
    'react-markdown-10.1.0-MIT.txt',
    'remark-gfm-4.0.1-MIT.txt',
    'egregore-markdown-renderer-dependencies.txt',
  ]) {
    cpSync(join('LICENSES', filename), join(directory, 'licenses', filename));
  }
}

function writeNavigationProjection(directory: string): void {
  writeFileSync(
    join(directory, 'index.html'),
    [
      '<noscript><nav>',
      ...NAV_ITEMS.map(({ href, label }) => `<a href="${href}">${label}</a>`),
      '</nav></noscript>',
      '<footer>',
      ...NAV_ITEMS.map(({ href, label }) => `<a href="${href}">${label}</a>`),
      '</footer>',
      '<script type="application/ld+json">',
      JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SiteNavigationElement',
        hasPart: NAV_ITEMS.map(({ href, label }) => ({
          '@type': 'WebPage',
          name: label,
          url: new URL(href, SITE.siteUrl).toString(),
        })),
      }),
      '</script>',
    ].join('\n'),
  );
}

function writeEgregoreViewportContract(directory: string): void {
  const componentDirectory = join(directory, '_astro');
  const pageDirectory = join(directory, 'chatbot');
  mkdirSync(componentDirectory, { recursive: true });
  mkdirSync(pageDirectory, { recursive: true });
  writeFileSync(
    join(pageDirectory, 'index.html'),
    '<astro-island component-url="/_astro/EgregoreExperience.fixture.js"></astro-island>',
  );
  writeFileSync(
    join(componentDirectory, 'EgregoreExperience.fixture.js'),
    '({className:"egregore-shell h-[100svh]","data-egregore-role":"shell"})',
  );
}

function writeExactProductionSurface(directory: string): void {
  writePreMarkdownProductionSurface(directory);
  writeRendererLicenseArtifacts(directory);
  writeNavigationProjection(directory);
  writeEgregoreViewportContract(directory);
  const pagePath = join(directory, 'licenses', 'egregore', 'index.html');
  writeFileSync(
    pagePath,
    [
      readFileSync(pagePath, 'utf8'),
      '/licenses/react-markdown-10.1.0-MIT.txt',
      '/licenses/remark-gfm-4.0.1-MIT.txt',
      '/licenses/egregore-markdown-renderer-dependencies.txt',
    ].join('\n'),
  );
}

describe('ordinary production artifact containment', () => {
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

  it('rejects test and qualification markers in nested emitted artifacts', () => {
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
      'local-first-agentic-systems',
      'egregore:qualification-observation',
      'retrieval-context-selection-ms',
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

  it('rejects the pre-Markdown renderer license artifact surface', () => {
    const directory = temporaryBuildDirectory();
    writePreMarkdownProductionSurface(directory);

    const result = runProductionArtifactVerifier(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'PRODUCTION_LICENSE_ARTIFACT_MISSING:licenses/react-markdown-10.1.0-MIT.txt',
    );
  });

  it('rejects a license page that omits the renderer license links', () => {
    const directory = temporaryBuildDirectory();
    writePreMarkdownProductionSurface(directory);
    writeRendererLicenseArtifacts(directory);

    const result = runProductionArtifactVerifier(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'PRODUCTION_LICENSE_PAGE_INCOMPLETE:licenses/egregore/index.html:/licenses/react-markdown-10.1.0-MIT.txt',
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

  it('rejects a shared navigation surface that diverges from NAV_ITEMS', () => {
    const directory = temporaryBuildDirectory();
    writeNavigationProjection(directory);
    const indexPath = join(directory, 'index.html');
    writeFileSync(
      indexPath,
      readFileSync(indexPath, 'utf8').replace(
        `<a href="${NAV_ITEMS[0].href}">${NAV_ITEMS[0].label}</a>`,
        '',
      ),
    );

    expect(() => assertProductionNavigationProjection(directory)).toThrow(
      /PRODUCTION_NAVIGATION_PROJECTION_INCOMPLETE:noscript/u,
    );
  });

  it('rejects a shared navigation destination with the wrong accessible label', () => {
    const directory = temporaryBuildDirectory();
    writeNavigationProjection(directory);
    const indexPath = join(directory, 'index.html');
    writeFileSync(
      indexPath,
      readFileSync(indexPath, 'utf8').replace(
        `<a href="${NAV_ITEMS[0].href}">${NAV_ITEMS[0].label}</a>`,
        `<a href="${NAV_ITEMS[0].href}">Not ${NAV_ITEMS[0].label}</a>`,
      ),
    );

    expect(() => assertProductionNavigationProjection(directory)).toThrow(
      /PRODUCTION_NAVIGATION_PROJECTION_INCOMPLETE:noscript/u,
    );
  });

  it('rejects reordered shared navigation links', () => {
    const directory = temporaryBuildDirectory();
    writeNavigationProjection(directory);
    const indexPath = join(directory, 'index.html');
    const first = `<a href="${NAV_ITEMS[0].href}">${NAV_ITEMS[0].label}</a>`;
    const second = `<a href="${NAV_ITEMS[1].href}">${NAV_ITEMS[1].label}</a>`;
    writeFileSync(
      indexPath,
      readFileSync(indexPath, 'utf8').replace(
        `${first}\n${second}`,
        `${second}\n${first}`,
      ),
    );

    expect(() => assertProductionNavigationProjection(directory)).toThrow(
      /PRODUCTION_NAVIGATION_PROJECTION_INCOMPLETE:noscript/u,
    );
  });

  it('rejects reordered JSON-LD navigation records', () => {
    const directory = temporaryBuildDirectory();
    writeNavigationProjection(directory);
    const indexPath = join(directory, 'index.html');
    const html = readFileSync(indexPath, 'utf8');
    const first = JSON.stringify({
      '@type': 'WebPage',
      name: NAV_ITEMS[0].label,
      url: new URL(NAV_ITEMS[0].href, SITE.siteUrl).toString(),
    });
    const second = JSON.stringify({
      '@type': 'WebPage',
      name: NAV_ITEMS[1].label,
      url: new URL(NAV_ITEMS[1].href, SITE.siteUrl).toString(),
    });
    writeFileSync(
      indexPath,
      html.replace(`${first},${second}`, `${second},${first}`),
    );

    expect(() => assertProductionNavigationProjection(directory)).toThrow(
      /PRODUCTION_NAVIGATION_PROJECTION_INCOMPLETE:json-ld/u,
    );
  });

  it('rejects an emitted Egregore shell without standardized 100svh ownership', () => {
    const directory = temporaryBuildDirectory();
    writeEgregoreViewportContract(directory);
    const componentPath = join(
      directory,
      '_astro',
      'EgregoreExperience.fixture.js',
    );
    writeFileSync(
      componentPath,
      readFileSync(componentPath, 'utf8').replace('h-[100svh]', 'h-screen'),
    );

    expect(() => assertProductionEgregoreViewportContract(directory)).toThrow(
      /PRODUCTION_EGREGORE_VIEWPORT_CONTRACT_MISSING:.*:100svh/u,
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
