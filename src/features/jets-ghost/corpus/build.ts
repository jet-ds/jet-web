import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { SITE } from '../../../config/site';
import { isAssistantEligible } from '../../../content/policy';
import {
  blogSchema,
  worksSchema,
  type BlogFrontmatter,
  type WorksFrontmatter,
} from '../../../schemas/content';
import {
  buildSearchIndexArtifact,
  INDEX_CONFIG_VERSION,
  MINISEARCH_VERSION,
  STEMMER_VERSION,
} from '../selection/searchIndex';
import { normalizeMdx } from './normalize';
import { estimateTokens, SEGMENTATION_VERSION, segmentDocument } from './segment';
import type {
  CorpusManifest,
  DocumentId,
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgePackage,
  KnowledgeSection,
  SearchIndexArtifact,
} from './types';

const execFileAsync = promisify(execFile);
const SCHEMA_VERSION = '1.0.0' as const;

interface AssistantSourceBase {
  slug: string;
  sourcePath: string;
  tracked: boolean;
  body: string;
}

export type AssistantSourceEntry =
  | (AssistantSourceBase & {
      collection: 'blog';
      data: BlogFrontmatter;
    })
  | (AssistantSourceBase & {
      collection: 'works';
      data: WorksFrontmatter;
    });

export interface KnowledgeBaseBuild {
  manifest: CorpusManifest;
  content: KnowledgePackage;
  index: SearchIndexArtifact;
}

interface CanonicalObject {
  [key: string]: CanonicalValue;
}

type CanonicalValue = null | boolean | number | string | CanonicalValue[] | CanonicalObject;

function canonicalValue(value: unknown, seen: Set<object>): CanonicalValue {
  if (value === null || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.replace(/\r\n?/g, '\n').normalize('NFC');
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Canonical JSON rejects non-finite numbers.');
    }
    return value;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TypeError('Canonical JSON rejects invalid dates.');
    }
    return value.toISOString();
  }
  if (typeof value !== 'object') {
    throw new TypeError(`Canonical JSON rejects ${typeof value} values.`);
  }
  if (seen.has(value)) {
    throw new TypeError('Canonical JSON rejects cyclic values.');
  }

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => canonicalValue(item, seen));
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Canonical JSON accepts only plain objects.');
    }
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue((value as Record<string, unknown>)[key], seen)]),
    );
  } finally {
    seen.delete(value);
  }
}

export function canonicalSerialize(value: unknown): string {
  return JSON.stringify(canonicalValue(value, new Set()));
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function computeSourceHash(
  data: BlogFrontmatter | WorksFrontmatter,
  body: string,
): string {
  return sha256(canonicalSerialize({ data, body }));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalUrl(collection: 'blog' | 'works', slug: string): string {
  return new URL(`/${collection}/${slug}/`, SITE.siteUrl).toString();
}

function validateBase(entry: AssistantSourceEntry): void {
  if (entry.collection !== 'blog' && entry.collection !== 'works') {
    throw new Error('Assistant source collection must be blog or works.');
  }
  if (
    typeof entry.slug !== 'string'
    || entry.slug.trim() === ''
    || entry.slug.startsWith('/')
    || entry.slug.endsWith('/')
    || entry.slug.includes('\\')
    || entry.slug.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    throw new Error(`Invalid assistant source slug: ${String(entry.slug)}.`);
  }
  if (typeof entry.body !== 'string') {
    throw new Error(`Assistant source body must be a string: ${entry.slug}.`);
  }
  if (typeof entry.sourcePath !== 'string' || typeof entry.tracked !== 'boolean') {
    throw new Error(`Assistant source provenance is invalid: ${entry.slug}.`);
  }
}

function validateAndNormalizeEntry(entry: AssistantSourceEntry): AssistantSourceEntry {
  validateBase(entry);
  const data = entry.collection === 'blog'
    ? blogSchema.parse(entry.data)
    : worksSchema.parse(entry.data);

  if (data.assistant === true && data.status !== 'published') {
    throw new Error(`Assistant-enabled content must be published: ${entry.collection}:${entry.slug}.`);
  }
  if (isAssistantEligible(data) && !entry.tracked) {
    throw new Error(`Assistant source must be tracked by Git: ${entry.collection}:${entry.slug}.`);
  }
  if (isAssistantEligible(data) && entry.sourcePath.trim() === '') {
    throw new Error(`Assistant source requires a repository source path: ${entry.collection}:${entry.slug}.`);
  }

  return { ...entry, data } as AssistantSourceEntry;
}

function assertUnique<T>(
  values: readonly T[],
  identity: (value: T) => string,
  label: string,
): void {
  const seen = new Set<string>();
  for (const value of values) {
    const id = identity(value);
    if (seen.has(id)) {
      throw new Error(`Duplicate ${label}: ${id}`);
    }
    seen.add(id);
  }
}

function documentFromEntry(entry: AssistantSourceEntry, order: number): KnowledgeDocument {
  const id = `${entry.collection}:${entry.slug}` as DocumentId;
  const isBlog = entry.collection === 'blog';
  const publishedAt = isBlog ? entry.data.pubDate : entry.data.date;
  const updatedAt = isBlog ? entry.data.updatedDate : undefined;

  return {
    id,
    order,
    collection: entry.collection,
    slug: entry.slug,
    title: entry.data.title,
    description: entry.data.description,
    canonicalUrl: canonicalUrl(entry.collection, entry.slug),
    tags: [...entry.data.tags],
    author: isBlog ? entry.data.author : SITE.author,
    publishedAt: publishedAt.toISOString(),
    ...(updatedAt === undefined ? {} : { updatedAt: updatedAt.toISOString() }),
    sourcePath: entry.sourcePath,
    sourceHash: computeSourceHash(entry.data, entry.body),
  };
}

function narrowFullCorpusKnowledgeTokens(
  documents: readonly KnowledgeDocument[],
  sections: readonly KnowledgeSection[],
  chunks: readonly KnowledgeChunk[],
): number {
  const documentsById = new Map(documents.map((document) => [document.id, document]));
  const sectionsById = new Map(sections.map((section) => [section.id, section]));
  const payload = chunks.map((chunk, index) => {
    const document = documentsById.get(chunk.documentId);
    const section = sectionsById.get(chunk.sectionId);
    if (document === undefined || section === undefined) {
      throw new Error(`Cannot measure chunk with missing parent: ${chunk.id}`);
    }
    return {
      citationId: `S${index + 1}`,
      documentId: document.id,
      sectionId: section.id,
      chunkId: chunk.id,
      title: document.title,
      url: document.canonicalUrl,
      heading: section.heading,
      content: chunk.text,
    };
  });
  return estimateTokens(canonicalSerialize(payload));
}

export function buildKnowledgeBase(
  entries: AssistantSourceEntry[],
  sourceCommit: string,
): KnowledgeBaseBuild {
  if (typeof sourceCommit !== 'string' || sourceCommit.trim() === '') {
    throw new Error('Knowledge package requires a source commit.');
  }

  const eligible = entries
    .map(validateAndNormalizeEntry)
    .filter((entry) => isAssistantEligible(entry.data))
    .sort((left, right) => (
      compareText(left.collection, right.collection) || compareText(left.slug, right.slug)
    ));

  const documents: KnowledgeDocument[] = [];
  const sections: KnowledgeSection[] = [];
  const chunks: KnowledgeChunk[] = [];

  eligible.forEach((entry, documentOrder) => {
    const document = documentFromEntry(entry, documentOrder);
    const segmented = segmentDocument({
      documentId: document.id,
      sections: normalizeMdx(entry.body),
    });
    documents.push(document);
    sections.push(...segmented.sections);
    chunks.push(...segmented.chunks);
  });

  assertUnique(documents, (document) => document.id, 'document id');
  assertUnique(documents, (document) => document.canonicalUrl, 'canonical URL');
  assertUnique(sections, (section) => section.id, 'section id');
  assertUnique(chunks, (chunk) => chunk.id, 'chunk id');

  const statistics = {
    documentCount: documents.length,
    sectionCount: sections.length,
    chunkCount: chunks.length,
    estimatedContentTokens: chunks.reduce((total, chunk) => total + chunk.estimatedTokens, 0),
    fullCorpusKnowledgeTokens: narrowFullCorpusKnowledgeTokens(documents, sections, chunks),
  };
  const corpusVersion = sha256(canonicalSerialize({
    schemaVersion: SCHEMA_VERSION,
    segmentationVersion: SEGMENTATION_VERSION,
    documents,
    sections,
    chunks,
  }));
  const content: KnowledgePackage = {
    schemaVersion: SCHEMA_VERSION,
    segmentationVersion: SEGMENTATION_VERSION,
    corpusVersion,
    sourceCommit,
    documents,
    sections,
    chunks,
    statistics,
  };
  const index = buildSearchIndexArtifact(content);
  const contentSha256 = sha256(canonicalSerialize(content));
  const indexSha256 = sha256(canonicalSerialize(index));
  const manifest: CorpusManifest = {
    schemaVersion: SCHEMA_VERSION,
    segmentationVersion: SEGMENTATION_VERSION,
    corpusVersion,
    sourceCommit,
    contentSha256,
    indexSha256,
    indexConfigVersion: INDEX_CONFIG_VERSION,
    miniSearchVersion: MINISEARCH_VERSION,
    stemmerVersion: STEMMER_VERSION,
    indexedChunkCount: chunks.length,
    statistics,
  };

  return { manifest, content, index };
}

export interface SourceCommitInput {
  gitHead: string;
  vercelSha?: string;
  githubSha?: string;
}

export function resolveSourceCommit(input: SourceCommitInput): string {
  const gitHead = input.gitHead.trim();
  if (gitHead === '') {
    throw new Error('Git HEAD is required for knowledge-package provenance.');
  }

  for (const [provider, supplied] of [
    ['Vercel', input.vercelSha],
    ['GitHub', input.githubSha],
  ] as const) {
    if (supplied !== undefined && supplied.trim() !== '' && supplied.trim() !== gitHead) {
      throw new Error(`${provider} source commit mismatch with Git HEAD.`);
    }
  }
  return gitHead;
}

function cleanGitEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const key of [
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_COMMON_DIR',
    'GIT_DIR',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_WORK_TREE',
  ]) {
    delete environment[key];
  }
  return environment;
}

export async function readGitHead(root: string = process.cwd()): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      env: cleanGitEnvironment(),
      encoding: 'utf8',
    });
    const gitHead = stdout.trim();
    if (gitHead === '') {
      throw new Error('git rev-parse returned an empty value.');
    }
    return gitHead;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Unable to resolve Git HEAD: ${message}`);
  }
}
