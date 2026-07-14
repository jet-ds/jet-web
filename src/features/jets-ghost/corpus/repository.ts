import MiniSearch from 'minisearch';
import {
  INDEX_CONFIG_VERSION,
  loadSearchIndex,
  MINISEARCH_VERSION,
  STEMMER_VERSION,
} from '../selection/searchIndex';
import { serializeSourcePayload } from '../sourcePayload';
import type {
  ChunkId,
  CorpusManifest,
  DocumentId,
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgePackage,
  KnowledgeSection,
  SearchDocument,
  SearchIndexArtifact,
  SectionId,
} from './types';
import { canonicalSerialize } from './canonical';

const MANIFEST_PATH = '/assistant/corpus/manifest.json';
const CONTENT_PATH = '/assistant/corpus/content.json';
const INDEX_PATH = '/assistant/corpus/index.json';

export interface LoadedKnowledgeBase {
  package: KnowledgePackage;
  searchIndex: MiniSearch<SearchDocument>;
  documentsById: ReadonlyMap<DocumentId, KnowledgeDocument>;
  sectionsById: ReadonlyMap<SectionId, KnowledgeSection>;
  chunksById: ReadonlyMap<ChunkId, KnowledgeChunk>;
  neighborsByChunkId: ReadonlyMap<ChunkId, { previous?: ChunkId; next?: ChunkId }>;
  indexSha256: string;
  indexConfigVersion: '1.0.0';
  miniSearchVersion: '7.2.0';
  stemmerVersion: '2.0.1';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonnegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0;
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
}

function assertStatistics(value: unknown): void {
  if (!isRecord(value)) {
    throw new Error('Corpus statistics are invalid.');
  }
  for (const field of [
    'documentCount',
    'sectionCount',
    'chunkCount',
    'estimatedContentTokens',
    'fullCorpusKnowledgeTokens',
  ]) {
    if (!isNonnegativeInteger(value[field])) {
      throw new Error(`Corpus statistic ${field} is invalid.`);
    }
  }
}

function parseManifest(value: unknown): CorpusManifest {
  if (!isRecord(value)) {
    throw new Error('Corpus manifest is invalid.');
  }
  if (value.schemaVersion !== '1.0.0' || value.segmentationVersion !== '1.0.0') {
    throw new Error('Corpus manifest schema or segmentation version mismatch.');
  }
  if (
    !isSha256(value.corpusVersion)
    || !isSha256(value.contentSha256)
    || !isSha256(value.indexSha256)
    || typeof value.sourceCommit !== 'string'
    || value.sourceCommit === ''
  ) {
    throw new Error('Corpus manifest provenance or hashes are invalid.');
  }
  if (
    value.indexConfigVersion !== INDEX_CONFIG_VERSION
    || value.miniSearchVersion !== MINISEARCH_VERSION
    || value.stemmerVersion !== STEMMER_VERSION
  ) {
    throw new Error('Corpus manifest index dependency version mismatch.');
  }
  if (!isNonnegativeInteger(value.indexedChunkCount)) {
    throw new Error('Corpus manifest indexed chunk count is invalid.');
  }
  assertStatistics(value.statistics);
  return value as unknown as CorpusManifest;
}

function assertDocument(value: unknown): asserts value is KnowledgeDocument {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || !isNonnegativeInteger(value.order)
    || (value.collection !== 'blog' && value.collection !== 'works')
    || typeof value.slug !== 'string'
    || typeof value.title !== 'string'
    || typeof value.description !== 'string'
    || typeof value.canonicalUrl !== 'string'
    || !Array.isArray(value.tags)
    || !value.tags.every((tag) => typeof tag === 'string')
    || typeof value.author !== 'string'
    || typeof value.publishedAt !== 'string'
    || typeof value.sourcePath !== 'string'
    || !isSha256(value.sourceHash)
  ) {
    throw new Error('Corpus document is invalid.');
  }
}

function assertSection(value: unknown): asserts value is KnowledgeSection {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.documentId !== 'string'
    || typeof value.heading !== 'string'
    || !Array.isArray(value.headingPath)
    || !value.headingPath.every((part) => typeof part === 'string')
    || !isNonnegativeInteger(value.order)
  ) {
    throw new Error('Corpus section is invalid.');
  }
}

function assertChunk(value: unknown): asserts value is KnowledgeChunk {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.documentId !== 'string'
    || typeof value.sectionId !== 'string'
    || typeof value.text !== 'string'
    || !isNonnegativeInteger(value.estimatedTokens)
    || !isNonnegativeInteger(value.order)
    || !isSha256(value.contentHash)
    || !isNonnegativeInteger(value.sameTextOccurrence)
  ) {
    throw new Error('Corpus chunk is invalid.');
  }
}

function parseContent(value: unknown): KnowledgePackage {
  if (
    !isRecord(value)
    || value.schemaVersion !== '1.0.0'
    || value.segmentationVersion !== '1.0.0'
    || !isSha256(value.corpusVersion)
    || typeof value.sourceCommit !== 'string'
    || !Array.isArray(value.documents)
    || !Array.isArray(value.sections)
    || !Array.isArray(value.chunks)
  ) {
    throw new Error('Corpus content package is invalid.');
  }
  value.documents.forEach(assertDocument);
  value.sections.forEach(assertSection);
  value.chunks.forEach(assertChunk);
  assertStatistics(value.statistics);
  return value as unknown as KnowledgePackage;
}

function parseIndex(value: unknown): SearchIndexArtifact {
  if (
    !isRecord(value)
    || typeof value.corpusVersion !== 'string'
    || typeof value.indexConfigVersion !== 'string'
    || typeof value.miniSearchVersion !== 'string'
    || typeof value.stemmerVersion !== 'string'
    || !isNonnegativeInteger(value.chunkCount)
    || !Array.isArray(value.chunkIds)
    || !value.chunkIds.every((id) => typeof id === 'string')
    || !isRecord(value.index)
  ) {
    throw new Error('Search index artifact is invalid.');
  }
  return value as unknown as SearchIndexArtifact;
}

function equalStatistics(
  left: CorpusManifest['statistics'],
  right: KnowledgePackage['statistics'],
): boolean {
  return left.documentCount === right.documentCount
    && left.sectionCount === right.sectionCount
    && left.chunkCount === right.chunkCount
    && left.estimatedContentTokens === right.estimatedContentTokens
    && left.fullCorpusKnowledgeTokens === right.fullCorpusKnowledgeTokens;
}

function buildLookupMaps(content: KnowledgePackage): Pick<
  LoadedKnowledgeBase,
  'documentsById' | 'sectionsById' | 'chunksById' | 'neighborsByChunkId'
> {
  const documentsById = new Map<DocumentId, KnowledgeDocument>();
  content.documents.forEach((document, index) => {
    if (document.order !== index || documentsById.has(document.id)) {
      throw new Error(`Duplicate or noncanonical document order: ${document.id}`);
    }
    documentsById.set(document.id, document);
  });

  const sectionsById = new Map<SectionId, KnowledgeSection>();
  const nextSectionOrder = new Map<DocumentId, number>();
  let previousDocumentOrder = -1;
  for (const section of content.sections) {
    const document = documentsById.get(section.documentId);
    if (document === undefined || sectionsById.has(section.id)) {
      throw new Error(`Duplicate section or missing document parent: ${section.id}`);
    }
    const expectedOrder = nextSectionOrder.get(document.id) ?? 0;
    if (section.order !== expectedOrder || document.order < previousDocumentOrder) {
      throw new Error(`Noncanonical section order: ${section.id}`);
    }
    previousDocumentOrder = document.order;
    nextSectionOrder.set(document.id, expectedOrder + 1);
    sectionsById.set(section.id, section);
  }

  const chunksById = new Map<ChunkId, KnowledgeChunk>();
  const nextChunkOrder = new Map<DocumentId, number>();
  const previousSectionOrder = new Map<DocumentId, number>();
  previousDocumentOrder = -1;
  for (const chunk of content.chunks) {
    const document = documentsById.get(chunk.documentId);
    const section = sectionsById.get(chunk.sectionId);
    if (
      document === undefined
      || section === undefined
      || section.documentId !== chunk.documentId
      || chunksById.has(chunk.id)
    ) {
      throw new Error(`Duplicate chunk or missing/inconsistent parent: ${chunk.id}`);
    }
    const expectedOrder = nextChunkOrder.get(document.id) ?? 0;
    const priorSectionOrder = previousSectionOrder.get(document.id) ?? -1;
    if (
      chunk.order !== expectedOrder
      || document.order < previousDocumentOrder
      || section.order < priorSectionOrder
    ) {
      throw new Error(`Noncanonical chunk order: ${chunk.id}`);
    }
    previousDocumentOrder = document.order;
    previousSectionOrder.set(document.id, section.order);
    nextChunkOrder.set(document.id, expectedOrder + 1);
    chunksById.set(chunk.id, chunk);
  }

  const chunksBySection = new Map<SectionId, KnowledgeChunk[]>();
  for (const chunk of content.chunks) {
    const siblings = chunksBySection.get(chunk.sectionId) ?? [];
    siblings.push(chunk);
    chunksBySection.set(chunk.sectionId, siblings);
  }
  const neighborsByChunkId = new Map<ChunkId, { previous?: ChunkId; next?: ChunkId }>();
  for (const siblings of chunksBySection.values()) {
    siblings.forEach((chunk, index) => {
      neighborsByChunkId.set(chunk.id, {
        ...(siblings[index - 1] === undefined ? {} : { previous: siblings[index - 1].id }),
        ...(siblings[index + 1] === undefined ? {} : { next: siblings[index + 1].id }),
      });
    });
  }

  return { documentsById, sectionsById, chunksById, neighborsByChunkId };
}

async function responseText(response: Response, label: string): Promise<string> {
  if (!response.ok) {
    throw new Error(`${label} request failed with status ${response.status}.`);
  }
  return response.text();
}

export class StaticKnowledgeRepository {
  private loaded: LoadedKnowledgeBase | undefined;
  private loading: Promise<LoadedKnowledgeBase> | undefined;

  load(signal?: AbortSignal): Promise<LoadedKnowledgeBase> {
    if (this.loaded !== undefined) {
      return Promise.resolve(this.loaded);
    }
    if (this.loading !== undefined) {
      return this.loading;
    }

    const loading = this.loadFresh(signal)
      .then((loaded) => {
        if (this.loading === loading) {
          this.loaded = loaded;
        }
        return loaded;
      })
      .finally(() => {
        if (this.loading === loading) {
          this.loading = undefined;
        }
      });
    this.loading = loading;
    return loading;
  }

  unload(): void {
    this.loaded = undefined;
    this.loading = undefined;
  }

  private async loadFresh(signal?: AbortSignal): Promise<LoadedKnowledgeBase> {
    const request = (path: string) => fetch(path, {
      credentials: 'omit',
      ...(signal === undefined ? {} : { signal }),
    });
    const [manifestResponse, contentResponse, indexResponse] = await Promise.all([
      request(MANIFEST_PATH),
      request(CONTENT_PATH),
      request(INDEX_PATH),
    ]);
    const [manifestText, contentText, indexText] = await Promise.all([
      responseText(manifestResponse, 'Corpus manifest'),
      responseText(contentResponse, 'Corpus content'),
      responseText(indexResponse, 'Search index'),
    ]);
    const manifest = parseManifest(parseJson(manifestText, 'Corpus manifest'));
    const content = parseContent(parseJson(contentText, 'Corpus content'));
    const index = parseIndex(parseJson(indexText, 'Search index'));

    const [contentSha256, indexSha256] = await Promise.all([
      sha256(contentText),
      sha256(indexText),
    ]);
    if (contentSha256 !== manifest.contentSha256 || indexSha256 !== manifest.indexSha256) {
      throw new Error('Corpus content or index byte hash mismatch.');
    }
    if (
      content.corpusVersion !== manifest.corpusVersion
      || index.corpusVersion !== manifest.corpusVersion
      || content.sourceCommit !== manifest.sourceCommit
    ) {
      throw new Error('Corpus artifact version or provenance mismatch.');
    }
    for (const chunk of content.chunks) {
      if (await sha256(chunk.text) !== chunk.contentHash) {
        throw new Error(`Corpus chunk content hash mismatch: ${chunk.id}`);
      }
    }
    const computedCorpusVersion = await sha256(canonicalSerialize({
      schemaVersion: content.schemaVersion,
      segmentationVersion: content.segmentationVersion,
      documents: content.documents,
      sections: content.sections,
      chunks: content.chunks,
    }));
    if (computedCorpusVersion !== content.corpusVersion) {
      throw new Error('Corpus version does not match canonical package identities and content.');
    }
    const maps = buildLookupMaps(content);
    const fullCorpusPayload = content.chunks.map((chunk, index) => {
      const document = maps.documentsById.get(chunk.documentId);
      const section = maps.sectionsById.get(chunk.sectionId);
      if (document === undefined || section === undefined) {
        throw new Error(`Cannot validate source payload parentage: ${chunk.id}`);
      }
      return {
        citationId: `S${index + 1}` as const,
        documentId: document.id,
        sectionId: section.id,
        chunkId: chunk.id,
        title: document.title,
        canonicalUrl: document.canonicalUrl,
        heading: section.heading,
        text: chunk.text,
      };
    });
    const fullCorpusKnowledgeTokens = serializeSourcePayload(fullCorpusPayload).estimatedTokens;
    if (
      content.schemaVersion !== manifest.schemaVersion
      || content.segmentationVersion !== manifest.segmentationVersion
      || !equalStatistics(manifest.statistics, content.statistics)
      || manifest.statistics.documentCount !== content.documents.length
      || manifest.statistics.sectionCount !== content.sections.length
      || manifest.statistics.chunkCount !== content.chunks.length
      || manifest.statistics.estimatedContentTokens !== content.chunks.reduce(
        (total, chunk) => total + chunk.estimatedTokens,
        0,
      )
      || manifest.statistics.fullCorpusKnowledgeTokens !== fullCorpusKnowledgeTokens
    ) {
      throw new Error('Corpus manifest and content statistics mismatch.');
    }
    if (
      index.indexConfigVersion !== manifest.indexConfigVersion
      || index.miniSearchVersion !== manifest.miniSearchVersion
      || index.stemmerVersion !== manifest.stemmerVersion
      || index.chunkCount !== manifest.indexedChunkCount
      || index.chunkCount !== content.chunks.length
      || index.chunkIds.length !== content.chunks.length
    ) {
      throw new Error('Search index manifest contract mismatch.');
    }

    const expectedChunkIds = content.chunks.map((chunk) => chunk.id);
    const indexChunkIds = new Set(index.chunkIds);
    if (
      indexChunkIds.size !== index.chunkIds.length
      || index.chunkIds.some((id, position) => id !== expectedChunkIds[position])
    ) {
      throw new Error('Search index chunk coverage mismatch.');
    }
    const serializedDocumentIds = index.index.documentIds;
    const serializedStoredFields = index.index.storedFields;
    if (!isRecord(serializedDocumentIds) || !isRecord(serializedStoredFields)) {
      throw new Error('Serialized search index identity tables are invalid.');
    }
    const internalDocumentIds = Object.values(serializedDocumentIds);
    const internalStoredIds = Object.values(serializedStoredFields).map((fields) => (
      isRecord(fields) ? fields.id : undefined
    ));
    if (
      internalDocumentIds.length !== expectedChunkIds.length
      || internalStoredIds.length !== expectedChunkIds.length
      || new Set(internalDocumentIds).size !== expectedChunkIds.length
      || new Set(internalStoredIds).size !== expectedChunkIds.length
      || internalDocumentIds.some((id) => typeof id !== 'string' || !indexChunkIds.has(id as ChunkId))
      || internalStoredIds.some((id) => typeof id !== 'string' || !indexChunkIds.has(id as ChunkId))
    ) {
      throw new Error('Serialized search index contains unknown or duplicate chunk identities.');
    }

    const searchIndex = await loadSearchIndex(index, content.corpusVersion);
    if (searchIndex.documentCount !== content.chunks.length) {
      throw new Error('Hydrated search index document coverage mismatch.');
    }
    const hydratedIds = searchIndex.search(MiniSearch.wildcard).map((result) => result.id);
    if (
      hydratedIds.length !== expectedChunkIds.length
      || new Set(hydratedIds).size !== expectedChunkIds.length
      || hydratedIds.some((id) => !indexChunkIds.has(id as ChunkId))
    ) {
      throw new Error('Hydrated search index contains unknown or duplicate chunk identities.');
    }

    return {
      package: content,
      searchIndex,
      ...maps,
      indexSha256,
      indexConfigVersion: INDEX_CONFIG_VERSION,
      miniSearchVersion: MINISEARCH_VERSION,
      stemmerVersion: STEMMER_VERSION,
    };
  }
}
