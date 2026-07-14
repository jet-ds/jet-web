import { getCollection } from 'astro:content';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { SITE } from '../../../config/site';
import { loadTrackedContentPaths } from '../../../content/gitTracking';
import {
  assertGeneratedAssistantSources,
  type ContentValidationRecord,
} from '../../../content/validation';
import {
  buildKnowledgeBase,
  readGitHead,
  resolveSourceCommit,
  type AssistantSourceEntry,
  type KnowledgeBaseBuild,
} from './build';

function canonicalUrl(collection: 'blog' | 'works', slug: string): string {
  return new URL(`/${collection}/${slug}/`, SITE.siteUrl).toString();
}

function repositorySourcePath(root: string, filePath: string | undefined): string {
  if (filePath === undefined || filePath.trim() === '') {
    return '';
  }
  const absolutePath = isAbsolute(filePath) ? filePath : resolve(root, filePath);
  const pathFromRoot = relative(root, absolutePath);
  if (
    isAbsolute(pathFromRoot)
    || pathFromRoot === '..'
    || pathFromRoot.startsWith(`..${sep}`)
  ) {
    throw new Error(`Assistant source is outside the repository: ${filePath}`);
  }
  return pathFromRoot.split(sep).join('/');
}

function validationRecord(entry: AssistantSourceEntry): ContentValidationRecord {
  return {
    path: entry.sourcePath,
    tracked: entry.tracked,
    canonicalId: `${entry.collection}:${entry.slug}`,
    canonicalUrl: canonicalUrl(entry.collection, entry.slug),
    status: entry.data.status,
    assistant: entry.data.assistant,
    links: entry.collection === 'works'
      ? (entry.data.links ?? []).map((link) => ({ ...link }))
      : [],
  };
}

async function buildFromAstroCollections(): Promise<KnowledgeBaseBuild> {
  const root = process.cwd();
  const [blog, works] = await Promise.all([
    getCollection('blog'),
    getCollection('works'),
  ]);
  const trackedPaths = loadTrackedContentPaths(root);
  const entries: AssistantSourceEntry[] = [
    ...blog.map((entry) => {
      const sourcePath = repositorySourcePath(root, entry.filePath);
      return {
        collection: 'blog' as const,
        slug: entry.id,
        sourcePath,
        tracked: sourcePath !== '' && trackedPaths.has(sourcePath),
        body: entry.body ?? '',
        data: entry.data,
      };
    }),
    ...works.map((entry) => {
      const sourcePath = repositorySourcePath(root, entry.filePath);
      return {
        collection: 'works' as const,
        slug: entry.id,
        sourcePath,
        tracked: sourcePath !== '' && trackedPaths.has(sourcePath),
        body: entry.body ?? '',
        data: entry.data,
      };
    }),
  ];
  const sourceCommit = resolveSourceCommit({
    gitHead: await readGitHead(root),
    vercelSha: process.env.VERCEL_GIT_COMMIT_SHA,
    githubSha: process.env.GITHUB_SHA,
  });
  const result = buildKnowledgeBase(entries, sourceCommit);
  const generatedErrors = assertGeneratedAssistantSources(
    entries.map(validationRecord),
    result.content.documents.map((document) => document.id),
  );
  if (generatedErrors.length > 0) {
    throw new Error(generatedErrors.map((error) => error.message).join('\n'));
  }
  return result;
}

let memoizedAstroBuild: Promise<KnowledgeBaseBuild> | undefined;

export function loadAstroKnowledgeBase(): Promise<KnowledgeBaseBuild> {
  memoizedAstroBuild ??= buildFromAstroCollections();
  return memoizedAstroBuild;
}
