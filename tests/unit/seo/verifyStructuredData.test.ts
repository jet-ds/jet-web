import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyStructuredDataArtifacts } from '../../../scripts/verify-structured-data';

const temporaryDirectories: string[] = [];

function temporaryDist(): string {
  const directory = mkdtempSync(join(tmpdir(), 'jet-web-schema-'));
  temporaryDirectories.push(directory);
  return directory;
}

function writeRoute(distDirectory: string, route: string, body: string): void {
  const path = join(distDirectory, route, 'index.html');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}

function jsonLd(value: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('built structured-data verification', () => {
  it('accepts a canonically linked unknown future route without an allowlist', () => {
    const dist = temporaryDist();
    const canonical = 'https://jetsanchez.com/future-insight/';
    writeRoute(
      dist,
      'future-insight',
      `<!doctype html><html><head>
        <link rel="canonical" href="${canonical}">
        <meta name="robots" content="index, follow">
        ${jsonLd({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${canonical}#webpage`,
          url: canonical,
          mainEntity: { '@id': `${canonical}#creativework` },
        })}
        ${jsonLd({
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          '@id': `${canonical}#creativework`,
          url: canonical,
          mainEntityOfPage: { '@id': `${canonical}#webpage` },
        })}
      </head><body><a href="/future-insight/">Future insight</a></body></html>`,
    );

    expect(verifyStructuredDataArtifacts(dist)).toEqual([]);
  });

  it('reports malformed and inconsistent page-local schema relationships deterministically', () => {
    const dist = temporaryDist();
    const canonical = 'https://jetsanchez.com/invalid/';
    writeRoute(
      dist,
      'invalid',
      `<!doctype html><html><head>
        <link rel="canonical" href="${canonical}">
        <meta name="robots" content="index, follow">
        <script type="application/ld+json">{"@context":</script>
        ${jsonLd({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': 'https://jetsanchez.com/different/#webpage',
          url: 'https://jetsanchez.com/different/',
          mainEntity: { '@id': `${canonical}#missing-entity` },
        })}
      </head><body></body></html>`,
    );

    expect(verifyStructuredDataArtifacts(dist)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'invalid-json-ld' }),
        expect.objectContaining({ code: 'canonical-schema-mismatch' }),
        expect.objectContaining({ code: 'unresolved-main-entity' }),
      ]),
    );
  });

  it('rejects a canonical schema type whose page URL is absent', () => {
    const dist = temporaryDist();
    const canonical = 'https://jetsanchez.com/missing-schema-url/';
    writeRoute(
      dist,
      'missing-schema-url',
      `<!doctype html><html><head>
        <link rel="canonical" href="${canonical}">
        <meta name="robots" content="index, follow">
        ${jsonLd({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${canonical}#webpage`,
          url: canonical,
        })}
        ${jsonLd({
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          '@id': `${canonical}#invented-list`,
          itemListElement: [],
        })}
      </head><body></body></html>`,
    );

    expect(verifyStructuredDataArtifacts(dist)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'canonical-schema-mismatch' }),
      ]),
    );
  });

  it('reports duplicate, non-contiguous, and non-visible ItemList destinations', () => {
    const dist = temporaryDist();
    const canonical = 'https://jetsanchez.com/collection/';
    const first = 'https://jetsanchez.com/collection/first/';
    writeRoute(
      dist,
      'collection',
      `<!doctype html><html><head>
        <link rel="canonical" href="${canonical}">
        <meta name="robots" content="index, follow">
        ${jsonLd({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${canonical}#webpage`,
          url: canonical,
        })}
        ${jsonLd({
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          '@id': `${canonical}#invented-list`,
          url: canonical,
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              url: first,
              item: { '@id': `${first}#creativework` },
            },
            {
              '@type': 'ListItem',
              position: 3,
              url: first,
              item: { '@id': `${first}#creativework` },
            },
          ],
        })}
      </head><body><a href="/collection/somewhere-else/">Elsewhere</a></body></html>`,
    );

    const issues = verifyStructuredDataArtifacts(dist);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'duplicate-itemlist-url' }),
        expect.objectContaining({ code: 'non-contiguous-itemlist-position' }),
        expect.objectContaining({ code: 'itemlist-destination-not-visible' }),
      ]),
    );
    expect(issues).toEqual(
      [...issues].sort((left, right) =>
        `${left.path}:${left.code}:${left.detail}`.localeCompare(
          `${right.path}:${right.code}:${right.detail}`,
          'en',
        ),
      ),
    );
  });
});
