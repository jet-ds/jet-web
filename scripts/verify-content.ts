import {
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { SITE } from '../src/config/site';
import { loadTrackedContentPaths } from '../src/content/gitTracking';
import { isAssistantEligible } from '../src/content/policy';
import {
  type ContentPolicyError,
  type ContentValidationRecord,
  validateContentRecords,
} from '../src/content/validation';
import { blogSchema, profileSchema, worksSchema } from '../src/schemas/content';

type CollectionName = 'blog' | 'works' | 'profile';

interface ParsedContentRecord {
  collection: CollectionName;
  data: Record<string, unknown>;
  validation: ContentValidationRecord;
}

interface ContentFile {
  collection: CollectionName;
  collectionRoot: string;
  path: string;
}

const repositoryRoot = resolve(fileURLToPath(import.meta.url), '../..');
const contentCollections = [
  { collection: 'blog' as const, directory: 'src/data/blog' },
  { collection: 'works' as const, directory: 'src/data/works' },
  { collection: 'profile' as const, directory: 'src/data/profile' },
];

function isContained(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target);
  return (
    pathFromRoot === '' ||
    (!isAbsolute(pathFromRoot) &&
      pathFromRoot !== '..' &&
      !pathFromRoot.startsWith(`..${sep}`))
  );
}

function resolveContained(root: string, ...segments: string[]): string {
  const target = resolve(root, ...segments);
  if (!isContained(root, target)) {
    throw new Error(`Path escapes the content verification root: ${target}`);
  }
  return target;
}

function repositoryRelativePath(root: string, path: string): string {
  const relativePath = relative(root, path);
  if (!isContained(root, path) || relativePath === '') {
    throw new Error(`Content path is outside the repository root: ${path}`);
  }
  return relativePath.split(sep).join('/');
}

function resolveRoot(arguments_: string[]): string {
  if (
    arguments_.length > 1 ||
    (arguments_.length === 1 && !arguments_[0].startsWith('--root='))
  ) {
    throw new Error(
      'Usage: verify-content.ts [--root=<absolute-or-relative-path>]',
    );
  }

  const requestedRoot =
    arguments_.length === 0
      ? repositoryRoot
      : arguments_[0].slice('--root='.length);
  if (requestedRoot === '' || requestedRoot.includes('\0')) {
    throw new Error(
      'Content verification root must be a non-empty filesystem path.',
    );
  }

  let root: string;
  try {
    root = realpathSync(resolve(process.cwd(), requestedRoot));
  } catch {
    throw new Error(
      `Content verification root does not exist: ${requestedRoot}`,
    );
  }
  if (!statSync(root).isDirectory()) {
    throw new Error(
      `Content verification root is not a directory: ${requestedRoot}`,
    );
  }
  return root;
}

function readCollectionFiles(root: string): ContentFile[] {
  const files: ContentFile[] = [];

  for (const definition of contentCollections) {
    const collectionRoot = resolveContained(root, definition.directory);
    let realCollectionRoot: string;
    try {
      realCollectionRoot = realpathSync(collectionRoot);
    } catch {
      throw new Error(
        `Required content directory does not exist: ${definition.directory}`,
      );
    }
    if (
      !isContained(root, realCollectionRoot) ||
      lstatSync(collectionRoot).isSymbolicLink()
    ) {
      throw new Error(
        `Content directory escapes the repository root: ${definition.directory}`,
      );
    }

    const visit = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
        (left, right) => left.name.localeCompare(right.name, 'en'),
      )) {
        const path = resolveContained(root, directory, entry.name);
        if (entry.isSymbolicLink()) {
          throw new Error(
            `Symbolic links are not allowed in content directories: ${repositoryRelativePath(root, path)}`,
          );
        }
        if (entry.isDirectory()) {
          visit(path);
          continue;
        }
        if (
          entry.isFile() &&
          ['.md', '.mdx'].includes(extname(entry.name).toLowerCase())
        ) {
          files.push({
            collection: definition.collection,
            collectionRoot,
            path,
          });
        }
      }
    };

    visit(collectionRoot);
  }

  return files;
}

function publishedUrls(
  data: Record<string, unknown>,
): ContentValidationRecord['links'] {
  const urls: ContentValidationRecord['links'] = [];

  if (Array.isArray(data.links)) {
    data.links.forEach((value, index) => {
      if (typeof value !== 'object' || value === null || !('url' in value))
        return;
      urls.push({
        label:
          'label' in value && typeof value.label === 'string'
            ? value.label
            : `links[${index}].url`,
        url: value.url,
      });
    });
  }

  if (
    typeof data.image === 'object' &&
    data.image !== null &&
    'url' in data.image
  ) {
    urls.push({ label: 'image.url', url: data.image.url });

    if ('darkUrl' in data.image && data.image.darkUrl !== undefined) {
      urls.push({ label: 'image.darkUrl', url: data.image.darkUrl });
    }
  }

  for (const field of ['repository', 'demo'] as const) {
    if (Object.hasOwn(data, field) && data[field] !== undefined) {
      urls.push({ label: field, url: data[field] });
    }
  }

  return urls;
}

function parseContentRecord(
  root: string,
  file: ContentFile,
  trackedPaths: ReadonlySet<string>,
): ParsedContentRecord {
  const path = repositoryRelativePath(root, file.path);
  const parsed = matter(readFileSync(file.path, 'utf8'));
  const relativeEntryPath = relative(file.collectionRoot, file.path)
    .split(sep)
    .join('/');
  const canonicalSlug = relativeEntryPath.slice(
    0,
    -extname(relativeEntryPath).length,
  );
  const canonicalId = `${file.collection}:${canonicalSlug}`.normalize('NFC');
  const canonicalUrl =
    file.collection === 'profile'
      ? new URL('/about/', SITE.siteUrl).toString()
      : new URL(
          `/${file.collection}/${canonicalSlug}`,
          SITE.siteUrl,
        ).toString();
  const data = parsed.data as Record<string, unknown>;

  return {
    collection: file.collection,
    data,
    validation: {
      path,
      tracked: trackedPaths.has(path),
      canonicalId,
      canonicalUrl,
      status: data.status,
      assistant: data.assistant,
      links: publishedUrls(data),
    },
  };
}

function schemaErrors(record: ParsedContentRecord): ContentPolicyError[] {
  const schema =
    record.collection === 'blog'
      ? blogSchema
      : record.collection === 'works'
        ? worksSchema
        : profileSchema;
  const result = schema.safeParse(record.data);
  if (result.success) return [];

  return result.error.issues.map((issue) => ({
    code: 'schema-invalid',
    path: record.validation.path,
    message: `${issue.path.join('.') || 'frontmatter'}: ${issue.message}`,
  }));
}

function compareErrors(
  left: ContentPolicyError,
  right: ContentPolicyError,
): number {
  return (
    left.path.localeCompare(right.path, 'en') ||
    left.code.localeCompare(right.code, 'en') ||
    left.message.localeCompare(right.message, 'en')
  );
}

function escapeDiagnosticText(value: string): string {
  const commonEscapes: Record<string, string> = {
    '\0': '\\0',
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\v': '\\v',
    '\f': '\\f',
    '\r': '\\r',
    '\\': '\\\\',
  };

  return value.replace(
    // eslint-disable-next-line no-control-regex -- Diagnostics escape every ASCII control byte instead of emitting it.
    /[\\\u0000-\u001f\u007f\u2028\u2029]/gu,
    (character) =>
      commonEscapes[character] ??
      `\\u${character.codePointAt(0)?.toString(16).padStart(4, '0')}`,
  );
}

export async function main(): Promise<void> {
  const root = resolveRoot(process.argv.slice(2));
  const trackedPaths = loadTrackedContentPaths(root);
  const parseErrors: ContentPolicyError[] = [];
  const records: ParsedContentRecord[] = [];

  for (const file of readCollectionFiles(root)) {
    try {
      records.push(parseContentRecord(root, file, trackedPaths));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      parseErrors.push({
        code: 'schema-invalid',
        path: repositoryRelativePath(root, file.path),
        message: `Unable to parse frontmatter: ${message}`,
      });
    }
  }

  const policyErrors = validateContentRecords(
    records.map((record) => record.validation),
  );
  const invalidPolicyPaths = new Set(policyErrors.map((error) => error.path));
  const validationErrors = records.flatMap((record) =>
    invalidPolicyPaths.has(record.validation.path) ? [] : schemaErrors(record),
  );
  const errors = [...parseErrors, ...policyErrors, ...validationErrors].sort(
    compareErrors,
  );

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(
        `${escapeDiagnosticText(error.path)} [${error.code}]: ${escapeDiagnosticText(error.message)}`,
      );
    }
    process.exitCode = 1;
    return;
  }

  const eligibleSources = records.filter(
    (record) =>
      record.validation.tracked &&
      (record.validation.status === 'draft' ||
        record.validation.status === 'published') &&
      (record.validation.assistant === undefined ||
        typeof record.validation.assistant === 'boolean') &&
      isAssistantEligible({
        status: record.validation.status,
        assistant: record.validation.assistant,
      }),
  );
  console.log(
    `Content policy verified: ${records.length} entries; ${eligibleSources.length} tracked assistant sources`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
