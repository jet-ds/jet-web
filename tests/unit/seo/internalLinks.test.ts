import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceExtensions = new Set(['.astro', '.mdx', '.ts', '.tsx']);

function isExtensionBearingPath(pathname: string): boolean {
  const finalSegment = pathname.replace(/\/+$/u, '').split('/').at(-1) ?? '';
  return finalSegment.includes('.');
}

function isCanonicalInternalHref(rawHref: string): boolean {
  const href = rawHref.trim();

  if (href === '' || href.startsWith('#')) return true;
  if (/^[a-z][a-z\d+.-]*:/iu.test(href) || href.startsWith('//')) return true;

  const pathname = href.split(/[?#]/u, 1)[0];
  if (pathname === '/') return true;
  if (isExtensionBearingPath(pathname)) return true;

  return pathname.startsWith('/') && pathname.endsWith('/');
}

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return sourceExtensions.has(extname(entry.name)) ? [path] : [];
  });
}

function literalHrefs(source: string): Array<{ href: string; offset: number }> {
  const patterns = [
    /href\s*=\s*"([^"]*)"/gu,
    /href\s*=\s*'([^']*)'/gu,
    /href\s*=\s*\{\s*`([^`]*)`\s*\}/gu,
    /href\s*=\s*\{\s*"([^"]*)"\s*\}/gu,
    /href\s*=\s*\{\s*'([^']*)'\s*\}/gu,
    /\]\(([^)\s]+)(?:\s+["'][^)]*["'])?\)/gu,
    /const\s+\w*(?:href|path|url)\s*=\s*`([^`]*)`/giu,
  ];

  return patterns.flatMap((pattern) => [...source.matchAll(pattern)]
    .filter((match) => !match[1].startsWith('${'))
    .map((match) => ({
      href: match[1],
      offset: match.index,
    })));
}

describe('internal human-page links', () => {
  it.each([
    '/',
    '/about/',
    '/blog/example/#section',
    '/images/portrait.webp',
    '/assistant/corpus/manifest.json',
    '/licenses/apache-2.0.txt',
    '#section',
    'https://example.com/about',
    'mailto:hello@example.com',
  ])('permits canonical, asset, fragment, external, or machine href %s', (href) => {
    expect(isCanonicalInternalHref(href)).toBe(true);
  });

  it.each([
    '/about',
    '/blog/example',
    '/works?type=research',
    '/blog/example#section',
    '?tag=astro',
    'relative-page',
  ])('rejects slashless internal HTML-route href %s', (href) => {
    expect(isCanonicalInternalHref(href)).toBe(false);
  });

  it('keeps every literal source href on the canonical route shape', () => {
    const failures = sourceFiles('src').flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return literalHrefs(source)
        .filter(({ href }) => !isCanonicalInternalHref(href))
        .map(({ href, offset }) => ({
          file: relative('.', file),
          line: source.slice(0, offset).split('\n').length,
          href,
        }));
    });

    expect(failures).toEqual([]);
  });
});
