import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

export interface StructuredDataIssue {
  path: string;
  code:
    | 'canonical-schema-mismatch'
    | 'duplicate-canonical'
    | 'duplicate-itemlist-url'
    | 'duplicate-schema-id'
    | 'invalid-itemlist'
    | 'invalid-itemlist-destination'
    | 'invalid-json-ld'
    | 'invalid-schema-context'
    | 'invalid-schema-type'
    | 'itemlist-destination-not-visible'
    | 'main-entity-link-mismatch'
    | 'missing-canonical'
    | 'missing-json-ld'
    | 'missing-robots'
    | 'non-contiguous-itemlist-position'
    | 'unresolved-main-entity';
  detail: string;
}

type JsonObject = Record<string, unknown>;

const PAGE_ENTITY_TYPES = new Set([
  'BlogPosting',
  'CreativeWork',
  'Review',
  'ScholarlyArticle',
  'SoftwareApplication',
]);

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringProperty(value: unknown, property: string): string | null {
  if (!isObject(value)) return null;
  const candidate = value[property];
  return typeof candidate === 'string' ? candidate : null;
}

function emittedHtmlRoutes(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name, 'en'))
    .flatMap((entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return emittedHtmlRoutes(path);
      return entry.isFile() && entry.name === 'index.html' ? [path] : [];
    });
}

function isVisibleAnchor(anchor: HTMLAnchorElement): boolean {
  for (
    let element: HTMLElement | null = anchor;
    element;
    element = element.parentElement
  ) {
    if (
      element.hidden ||
      element.hasAttribute('inert') ||
      element.getAttribute('aria-hidden') === 'true' ||
      /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:;|$)/iu.test(
        element.getAttribute('style') ?? '',
      )
    ) {
      return false;
    }
  }
  return true;
}

function requiresCanonicalAgreement(type: string | null): boolean {
  return (
    type === 'WebPage' ||
    type === 'WebSite' ||
    type === 'ItemList' ||
    (type !== null && PAGE_ENTITY_TYPES.has(type))
  );
}

function addItemListIssues(
  issues: StructuredDataIssue[],
  path: string,
  schema: JsonObject,
  canonical: string,
  visibleDestinations: ReadonlySet<string>,
): void {
  const list = schema.itemListElement;
  if (!Array.isArray(list)) {
    issues.push({
      path,
      code: 'invalid-itemlist',
      detail: 'itemListElement must be an array',
    });
    return;
  }

  const itemUrls: string[] = [];
  for (const [index, item] of list.entries()) {
    const position = isObject(item) ? item.position : undefined;
    if (position !== index + 1) {
      issues.push({
        path,
        code: 'non-contiguous-itemlist-position',
        detail: `item ${index + 1} has position ${String(position)}`,
      });
    }

    const url = stringProperty(item, 'url');
    if (url === null) {
      issues.push({
        path,
        code: 'invalid-itemlist-destination',
        detail: `item ${index + 1} has no URL`,
      });
      continue;
    }
    itemUrls.push(url);

    let destination: URL;
    try {
      destination = new URL(url);
    } catch {
      issues.push({
        path,
        code: 'invalid-itemlist-destination',
        detail: url,
      });
      continue;
    }
    const pageOrigin = new URL(canonical).origin;
    if (
      destination.protocol !== 'https:' ||
      destination.origin !== pageOrigin ||
      destination.search !== '' ||
      destination.hash !== '' ||
      !destination.pathname.endsWith('/')
    ) {
      issues.push({
        path,
        code: 'invalid-itemlist-destination',
        detail: url,
      });
    }

    const entityId = stringProperty(isObject(item) ? item.item : null, '@id');
    if (entityId === null || !entityId.startsWith(`${url}#`)) {
      issues.push({
        path,
        code: 'invalid-itemlist-destination',
        detail: `item ${index + 1} has an invalid entity identity`,
      });
    }

    if (!visibleDestinations.has(url)) {
      issues.push({
        path,
        code: 'itemlist-destination-not-visible',
        detail: url,
      });
    }
  }

  const seen = new Set<string>();
  for (const url of itemUrls) {
    if (seen.has(url)) {
      issues.push({ path, code: 'duplicate-itemlist-url', detail: url });
    }
    seen.add(url);
  }
}

function verifyRoute(root: string, path: string): StructuredDataIssue[] {
  const routePath = relative(root, path);
  const html = readFileSync(path, 'utf8');
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const issues: StructuredDataIssue[] = [];
  const canonicalLinks = [
    ...document.querySelectorAll<HTMLLinkElement>('link[rel~="canonical"]'),
  ];
  if (canonicalLinks.length === 0) {
    issues.push({
      path: routePath,
      code: 'missing-canonical',
      detail: 'no canonical link',
    });
  }
  if (canonicalLinks.length > 1) {
    issues.push({
      path: routePath,
      code: 'duplicate-canonical',
      detail: `${canonicalLinks.length} canonical links`,
    });
  }
  if (document.querySelector('meta[name="robots"]') === null) {
    issues.push({
      path: routePath,
      code: 'missing-robots',
      detail: 'no robots meta tag',
    });
  }

  const canonical = canonicalLinks[0]?.getAttribute('href') ?? null;
  const schemas: JsonObject[] = [];
  const schemaScripts = [
    ...document.querySelectorAll<HTMLScriptElement>(
      'script[type="application/ld+json"]',
    ),
  ];
  if (schemaScripts.length === 0) {
    issues.push({
      path: routePath,
      code: 'missing-json-ld',
      detail: 'no JSON-LD blocks',
    });
  }
  for (const [index, script] of schemaScripts.entries()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script.textContent ?? '');
    } catch {
      issues.push({
        path: routePath,
        code: 'invalid-json-ld',
        detail: `block ${index + 1}`,
      });
      continue;
    }
    if (!isObject(parsed)) {
      issues.push({
        path: routePath,
        code: 'invalid-json-ld',
        detail: `block ${index + 1} is not an object`,
      });
      continue;
    }
    schemas.push(parsed);
    if (parsed['@context'] !== 'https://schema.org') {
      issues.push({
        path: routePath,
        code: 'invalid-schema-context',
        detail: `block ${index + 1}`,
      });
    }
    if (stringProperty(parsed, '@type') === null) {
      issues.push({
        path: routePath,
        code: 'invalid-schema-type',
        detail: `block ${index + 1}`,
      });
    }
  }

  const schemaIds = new Set<string>();
  for (const schema of schemas) {
    const id = stringProperty(schema, '@id');
    if (id === null) continue;
    if (schemaIds.has(id)) {
      issues.push({
        path: routePath,
        code: 'duplicate-schema-id',
        detail: id,
      });
    }
    schemaIds.add(id);
  }

  if (canonical !== null) {
    const visibleDestinations = new Set(
      [...document.querySelectorAll<HTMLAnchorElement>('a[href]')]
        .filter(isVisibleAnchor)
        .flatMap((anchor) => {
          const href = anchor.getAttribute('href');
          if (href === null) return [];
          try {
            return [new URL(href, canonical).toString()];
          } catch {
            return [];
          }
        }),
    );

    for (const schema of schemas) {
      const type = stringProperty(schema, '@type');
      const schemaUrl = stringProperty(schema, 'url');
      if (requiresCanonicalAgreement(type) && schemaUrl !== canonical) {
        issues.push({
          path: routePath,
          code: 'canonical-schema-mismatch',
          detail: `${type ?? 'unknown'} URL ${schemaUrl ?? 'missing'}`,
        });
      }
      if (
        type === 'WebPage' &&
        stringProperty(schema, '@id') !== `${canonical}#webpage`
      ) {
        issues.push({
          path: routePath,
          code: 'canonical-schema-mismatch',
          detail: `WebPage identity ${String(schema['@id'])}`,
        });
      }

      if (type === 'WebPage') {
        const mainEntityId = stringProperty(schema.mainEntity, '@id');
        if (mainEntityId !== null && !schemaIds.has(mainEntityId)) {
          issues.push({
            path: routePath,
            code: 'unresolved-main-entity',
            detail: mainEntityId,
          });
        }
      }

      const mainEntityOfPageId = stringProperty(schema.mainEntityOfPage, '@id');
      if (
        mainEntityOfPageId !== null &&
        mainEntityOfPageId !== `${canonical}#webpage`
      ) {
        issues.push({
          path: routePath,
          code: 'main-entity-link-mismatch',
          detail: mainEntityOfPageId,
        });
      }

      if (type === 'ItemList') {
        addItemListIssues(
          issues,
          routePath,
          schema,
          canonical,
          visibleDestinations,
        );
      }
    }
  }

  dom.window.close();
  return issues;
}

export function verifyStructuredDataArtifacts(
  distDirectory: string,
): StructuredDataIssue[] {
  const root = resolve(distDirectory);
  if (!statSync(root).isDirectory()) {
    throw new Error('STRUCTURED_DATA_DIRECTORY_MISSING');
  }

  return emittedHtmlRoutes(root)
    .flatMap((path) => verifyRoute(root, path))
    .sort((left, right) =>
      `${left.path}:${left.code}:${left.detail}`.localeCompare(
        `${right.path}:${right.code}:${right.detail}`,
        'en',
      ),
    );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const directory = process.argv[2] ?? resolve('dist');
    const issues = verifyStructuredDataArtifacts(directory);
    if (issues.length > 0) {
      throw new Error(
        issues
          .map(({ path, code, detail }) => `${path}:${code}:${detail}`)
          .join('\n'),
      );
    }
    process.stdout.write(
      'Structured-data artifacts are parseable, canonically linked, and internally consistent.\n',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNEXPECTED_ERROR';
    process.stderr.write(`Structured-data verification failed:\n${message}\n`);
    process.exitCode = 1;
  }
}
