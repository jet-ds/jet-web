import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

export interface DocLinkOptions {
  repositoryRoot: string;
}

export interface DocLinkDependencies {
  trackedMarkdown(): string[];
  readFile(path: string): string;
  exists(path: string): boolean;
}

export interface DocLinkResult {
  checkedDocuments: number;
  checkedLinks: number;
}

interface MarkdownNode {
  type?: string;
  url?: string;
  identifier?: string;
}

const markdownExtension = /\.md$/iu;
const externalScheme = /^[A-Za-z][A-Za-z\d+.-]*:/u;

function isScannedDocument(path: string): boolean {
  if (!markdownExtension.test(path)) return false;
  if (!path.startsWith('docs/archive/')) return true;
  return path === 'docs/archive/README.md';
}

function filesystemTarget(documentPath: string, destination: string): string | null {
  if (
    destination.startsWith('#')
    || destination.startsWith('//')
    || destination.startsWith('/')
    || externalScheme.test(destination)
  ) {
    return null;
  }

  const pathOnly = destination.split(/[?#]/u, 1)[0];
  if (pathOnly === '') return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(pathOnly);
  } catch {
    throw new Error(`INVALID_LINK_ENCODING:${documentPath}:${destination}`);
  }
  if (decoded.includes('\0') || decoded.includes('\\')) {
    throw new Error(`INVALID_LINK_PATH:${documentPath}:${destination}`);
  }

  const target = posix.normalize(posix.join(posix.dirname(documentPath), decoded));
  if (posix.isAbsolute(target) || target === '..' || target.startsWith('../')) {
    throw new Error(`LINK_ESCAPES_REPOSITORY:${documentPath}:${destination}`);
  }
  return target;
}

function linkedDestinations(markdown: string): string[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const destinations: string[] = [];
  const references = new Set<string>();
  const definitions = new Map<string, string>();

  visit(tree, (node) => {
    const candidate = node as MarkdownNode;
    if ((candidate.type === 'link' || candidate.type === 'image') && candidate.url) {
      destinations.push(candidate.url);
      return;
    }
    if (
      (candidate.type === 'linkReference' || candidate.type === 'imageReference')
      && candidate.identifier
    ) {
      references.add(candidate.identifier.toLowerCase());
      return;
    }
    if (candidate.type === 'definition' && candidate.identifier && candidate.url) {
      definitions.set(candidate.identifier.toLowerCase(), candidate.url);
    }
  });

  for (const identifier of references) {
    const destination = definitions.get(identifier);
    if (destination) destinations.push(destination);
  }
  return destinations;
}

export async function verifyTrackedMarkdownLinks(
  options: DocLinkOptions,
  dependencies: DocLinkDependencies,
): Promise<DocLinkResult> {
  if (!isAbsolute(options.repositoryRoot)) {
    throw new Error('REPOSITORY_ROOT_NOT_ABSOLUTE');
  }

  const candidates = new Set(dependencies.trackedMarkdown());
  const archiveIndex = 'docs/archive/README.md';
  if (dependencies.exists(archiveIndex)) candidates.add(archiveIndex);
  const documents = [...candidates]
    .filter(isScannedDocument)
    .sort((left, right) => left.localeCompare(right, 'en'));
  const failures = new Map<string, Set<string>>();
  let checkedLinks = 0;

  for (const documentPath of documents) {
    const markdown = dependencies.readFile(documentPath);
    for (const destination of linkedDestinations(markdown)) {
      const target = filesystemTarget(documentPath, destination);
      if (target === null) continue;
      checkedLinks += 1;
      if (dependencies.exists(target)) continue;
      const missing = failures.get(documentPath) ?? new Set<string>();
      missing.add(target);
      failures.set(documentPath, missing);
    }
  }

  if (failures.size > 0) {
    const details = [...failures]
      .map(([documentPath, missing]) => (
        `${documentPath}: ${[...missing].sort((left, right) => left.localeCompare(right, 'en')).join(', ')}`
      ))
      .join('\n');
    throw new Error(`BROKEN_DOCUMENTATION_LINKS:\n${details}`);
  }

  return { checkedDocuments: documents.length, checkedLinks };
}

function gitTrackedMarkdown(repositoryRoot: string): string[] {
  const result = spawnSync('git', ['ls-files', '-z', '--', '*.md'], {
    cwd: repositoryRoot,
    encoding: 'buffer',
    shell: false,
  });
  if (result.error || result.status !== 0) throw new Error('GIT_MARKDOWN_LIST_FAILED');
  return result.stdout.toString('utf8').split('\0').filter(Boolean);
}

function repositoryPath(repositoryRoot: string, path: string): string {
  const absolute = resolve(repositoryRoot, ...path.split('/'));
  const fromRoot = relative(repositoryRoot, absolute);
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new Error(`LINK_ESCAPES_REPOSITORY:${path}`);
  }
  return absolute;
}

function productionDependencies(repositoryRoot: string): DocLinkDependencies {
  return {
    trackedMarkdown: () => gitTrackedMarkdown(repositoryRoot),
    readFile: (path) => readFileSync(repositoryPath(repositoryRoot, path), 'utf8'),
    exists: (path) => existsSync(repositoryPath(repositoryRoot, path)),
  };
}

const repositoryRoot = resolve(fileURLToPath(import.meta.url), '../..');

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyTrackedMarkdownLinks(
    { repositoryRoot },
    productionDependencies(repositoryRoot),
  ).then((result) => {
    process.stdout.write(
      `Documentation links verified: ${result.checkedDocuments} documents, ${result.checkedLinks} relative links.\n`,
    );
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'UNEXPECTED_ERROR';
    process.stderr.write(`Documentation link verification failed: ${message}\n`);
    process.exitCode = 1;
  });
}
