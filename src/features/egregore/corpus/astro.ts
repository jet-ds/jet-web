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
import type { BlogFrontmatter, WorksFrontmatter } from '../../../schemas/content';

interface AstroBlogEntry {
  id: string;
  filePath?: string;
  body?: string;
  data: BlogFrontmatter;
}

interface AstroWorksEntry {
  id: string;
  filePath?: string;
  body?: string;
  data: WorksFrontmatter;
}

interface AstroCorpusCollections {
  blog: AstroBlogEntry[];
  works: AstroWorksEntry[];
}

export interface AstroCorpusDependencies {
  root: string;
  environment: Record<string, string | undefined>;
  loadCollections(): Promise<AstroCorpusCollections>;
  loadTrackedPaths(root: string): Set<string>;
  readHead(root: string): Promise<string>;
}

function canonicalUrl(collection: 'blog' | 'works', slug: string): string {
  return new URL(`/${collection}/${slug}/`, SITE.siteUrl).toString();
}

export function repositorySourcePath(root: string, filePath: string | undefined): string {
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

export async function buildFromAstroCollections(
  dependencies: AstroCorpusDependencies,
): Promise<KnowledgeBaseBuild> {
  const { blog, works } = await dependencies.loadCollections();
  const trackedPaths = dependencies.loadTrackedPaths(dependencies.root);
  const entries: AssistantSourceEntry[] = [
    ...blog.map((entry) => {
      const sourcePath = repositorySourcePath(dependencies.root, entry.filePath);
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
      const sourcePath = repositorySourcePath(dependencies.root, entry.filePath);
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
    gitHead: await dependencies.readHead(dependencies.root),
    vercelSha: dependencies.environment.VERCEL_GIT_COMMIT_SHA,
    githubSha: dependencies.environment.GITHUB_SHA,
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

export function createAstroKnowledgeBaseLoader(
  dependencies: AstroCorpusDependencies,
): () => Promise<KnowledgeBaseBuild> {
  let memoizedBuild: Promise<KnowledgeBaseBuild> | undefined;
  return () => {
    memoizedBuild ??= buildFromAstroCollections(dependencies);
    return memoizedBuild;
  };
}

const productionDependencies: AstroCorpusDependencies = {
  root: process.cwd(),
  environment: process.env,
  loadCollections: async () => {
    const [blog, works] = await Promise.all([
      getCollection('blog'),
      getCollection('works'),
    ]);
    return { blog, works };
  },
  loadTrackedPaths: loadTrackedContentPaths,
  readHead: readGitHead,
};

export const loadAstroKnowledgeBase = createAstroKnowledgeBaseLoader(productionDependencies);
