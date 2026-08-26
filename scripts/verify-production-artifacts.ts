import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EGREGORE_IDENTITY } from '../src/config/egregore';
import { NAV_ITEMS, SITE } from '../src/config/site';
import {
  LITERT_LM_WASM_ASSETS,
  resolveLiteRtAssetPath,
} from '../src/features/egregore/runtime/liteRtAssets.server';

export const FORBIDDEN_PRODUCTION_ARTIFACT_MARKERS = [
  'FakeRuntime',
  'runtime=fake',
  '__EGREGORE_E2E__',
  'egregore:e2e-scheduler-release',
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
    emittedPath: 'licenses/react-markdown-10.1.0-MIT.txt',
    sourcePath: 'LICENSES/react-markdown-10.1.0-MIT.txt',
  },
  {
    emittedPath: 'licenses/remark-gfm-4.0.1-MIT.txt',
    sourcePath: 'LICENSES/remark-gfm-4.0.1-MIT.txt',
  },
  {
    emittedPath: 'licenses/egregore-markdown-renderer-dependencies.txt',
    sourcePath: 'LICENSES/egregore-markdown-renderer-dependencies.txt',
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
  '/licenses/react-markdown-10.1.0-MIT.txt',
  '/licenses/remark-gfm-4.0.1-MIT.txt',
  '/licenses/egregore-markdown-renderer-dependencies.txt',
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

interface AnchorProjection {
  href: string;
  label: string;
}

function decodeHtml(value: string): string {
  const namedEntities: Readonly<Record<string, string>> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    quot: '"',
  };
  return value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/giu,
    (entity, decimal: string, hexadecimal: string, named: string) => {
      if (decimal !== undefined)
        return String.fromCodePoint(Number.parseInt(decimal, 10));
      if (hexadecimal !== undefined)
        return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      return namedEntities[named.toLowerCase()] ?? entity;
    },
  );
}

function readQuotedAttribute(
  attributes: string,
  attribute: string,
): string | null {
  const match = attributes.match(
    new RegExp(`(?:^|\\s)${attribute}\\s*=\\s*(["'])(.*?)\\1`, 'iu'),
  );
  return match === null ? null : decodeHtml(match[2]);
}

export function assertProductionEgregoreViewportContract(
  directory = resolve('dist'),
): void {
  const root = resolve(directory);
  const pagePath = resolve(root, 'chatbot/index.html');
  if (!existsSync(pagePath)) {
    throw new Error(
      'PRODUCTION_EGREGORE_VIEWPORT_CONTRACT_MISSING:chatbot/index.html',
    );
  }

  const html = readFileSync(pagePath, 'utf8');
  const componentPaths = [
    ...html.matchAll(/<astro-island\b([^>]*)>/giu),
  ].flatMap(([, attributes]) => {
    const componentUrl = readQuotedAttribute(attributes, 'component-url');
    return componentUrl?.startsWith('/_astro/') === true
      ? [componentUrl.slice(1)]
      : [];
  });
  const owner = componentPaths.find((componentPath) => {
    const emittedPath = resolve(root, componentPath);
    if (!existsSync(emittedPath)) return false;
    const component = readFileSync(emittedPath, 'utf8');
    return (
      component.includes('data-egregore-role') &&
      component.includes('egregore-shell')
    );
  });
  if (owner === undefined) {
    throw new Error('PRODUCTION_EGREGORE_VIEWPORT_CONTRACT_MISSING:component');
  }

  const component = readFileSync(resolve(root, owner), 'utf8');
  if (!component.includes('h-[100svh]')) {
    throw new Error(
      `PRODUCTION_EGREGORE_VIEWPORT_CONTRACT_MISSING:${owner}:100svh`,
    );
  }
}

function extractAnchorProjections(surface: string): AnchorProjection[] {
  return [...surface.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/giu)].flatMap(
    ([, attributes, innerHtml]) => {
      const href = readQuotedAttribute(attributes, 'href');
      if (href === null) return [];
      const explicitLabel = readQuotedAttribute(attributes, 'aria-label');
      const label = decodeHtml(innerHtml.replace(/<[^>]*>/gu, ' '))
        .replace(/\s+/gu, ' ')
        .trim();
      return [{ href, label: explicitLabel ?? label }];
    },
  );
}

function assertNavigationLinks(
  surface: string,
  surfaceName: 'footer' | 'noscript',
): void {
  const expected = NAV_ITEMS.map(({ href, label }) => ({ href, label }));
  const expectedHrefs = new Set<string>(expected.map(({ href }) => href));
  const expectedLabels = new Set<string>(expected.map(({ label }) => label));
  const projected = extractAnchorProjections(surface).filter(
    ({ href, label }) => expectedHrefs.has(href) || expectedLabels.has(label),
  );
  if (JSON.stringify(projected) !== JSON.stringify(expected)) {
    throw new Error(
      `PRODUCTION_NAVIGATION_PROJECTION_INCOMPLETE:${surfaceName}`,
    );
  }
}

function expectNavigationProjection(
  projected: readonly { name: string; url: string }[],
): void {
  const expected = NAV_ITEMS.map(({ href, label }) => ({
    name: label,
    url: new URL(href, SITE.siteUrl).toString(),
  }));
  if (JSON.stringify(projected) !== JSON.stringify(expected)) {
    throw new Error('PRODUCTION_NAVIGATION_PROJECTION_INCOMPLETE:json-ld');
  }
}

export function assertProductionNavigationProjection(
  directory = resolve('dist'),
): void {
  const indexPath = resolve(directory, 'index.html');
  if (!existsSync(indexPath)) {
    throw new Error('PRODUCTION_NAVIGATION_ARTIFACT_MISSING:index.html');
  }
  const html = readFileSync(indexPath, 'utf8');
  const noscript = html.match(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/u)?.[1];
  const footer = html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/u)?.[1];
  if (noscript === undefined)
    throw new Error('PRODUCTION_NAVIGATION_SURFACE_MISSING:noscript');
  if (footer === undefined)
    throw new Error('PRODUCTION_NAVIGATION_SURFACE_MISSING:footer');
  assertNavigationLinks(noscript, 'noscript');
  assertNavigationLinks(footer, 'footer');

  const navigationSchema = [
    ...html.matchAll(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gu,
    ),
  ]
    .map((match) => {
      try {
        return JSON.parse(match[1]) as {
          '@type'?: unknown;
          hasPart?: unknown;
        };
      } catch {
        return null;
      }
    })
    .find((schema) => schema?.['@type'] === 'SiteNavigationElement');
  if (navigationSchema === undefined || navigationSchema === null)
    throw new Error('PRODUCTION_NAVIGATION_SURFACE_MISSING:json-ld');

  const projected = Array.isArray(navigationSchema.hasPart)
    ? navigationSchema.hasPart.flatMap((record) => {
        if (typeof record !== 'object' || record === null) return [];
        const name = Reflect.get(record, 'name');
        const url = Reflect.get(record, 'url');
        return typeof name === 'string' && typeof url === 'string'
          ? [{ name, url }]
          : [];
      })
    : [];
  expectNavigationProjection(projected);
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
    assertProductionEgregoreViewportContract(directory);
    assertProductionNavigationProjection(directory);
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
