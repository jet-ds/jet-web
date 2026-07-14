import MiniSearch, { type AsPlainObject, type Options } from 'minisearch';
import { stemmer } from 'stemmer';
import { normalizeCanonicalString } from '../corpus/canonical';
import type {
  ChunkId,
  KnowledgePackage,
  SearchDocument,
  SearchIndexArtifact,
} from '../corpus/types';

export const INDEX_CONFIG_VERSION = '1.0.0' as const;
export const MINISEARCH_VERSION = '7.2.0' as const;
export const STEMMER_VERSION = '2.0.1' as const;

export const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'does', 'for', 'from',
  'how', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the',
  'their', 'this', 'to', 'what', 'when', 'where', 'which', 'why', 'with',
]);

export const MINISEARCH_OPTIONS = {
  idField: 'id',
  fields: ['title', 'description', 'tags', 'heading', 'body'],
  storeFields: ['id'],
  processTerm: (term: string) => {
    const normalized = normalizeCanonicalString(term).toLowerCase();
    return STOP_WORDS.has(normalized) ? null : stemmer(normalized);
  },
  searchOptions: {
    boost: {
      title: 5,
      description: 2,
      tags: 4,
      heading: 3,
      body: 1,
    },
    combineWith: 'OR',
    prefix: (term: string) => term.length >= 5,
  },
} satisfies Options<SearchDocument>;

function searchDocuments(content: KnowledgePackage): SearchDocument[] {
  const documentsById = new Map(content.documents.map((document) => [document.id, document]));
  const sectionsById = new Map(content.sections.map((section) => [section.id, section]));

  return content.chunks.map((chunk) => {
    const document = documentsById.get(chunk.documentId);
    const section = sectionsById.get(chunk.sectionId);
    if (document === undefined || section === undefined) {
      throw new Error(`Cannot index chunk with missing parent: ${chunk.id}`);
    }
    if (section.documentId !== document.id) {
      throw new Error(`Cannot index chunk with inconsistent parents: ${chunk.id}`);
    }

    return {
      id: chunk.id,
      title: normalizeCanonicalString(document.title),
      description: normalizeCanonicalString(document.description),
      tags: document.tags.map(normalizeCanonicalString).join(' '),
      heading: normalizeCanonicalString(section.heading),
      body: normalizeCanonicalString(chunk.text),
    };
  });
}

export function buildSearchIndexArtifact(content: KnowledgePackage): SearchIndexArtifact {
  const miniSearch = new MiniSearch<SearchDocument>(MINISEARCH_OPTIONS);
  const documents = searchDocuments(content);
  miniSearch.addAll(documents);

  return {
    corpusVersion: content.corpusVersion,
    indexConfigVersion: INDEX_CONFIG_VERSION,
    miniSearchVersion: MINISEARCH_VERSION,
    stemmerVersion: STEMMER_VERSION,
    chunkCount: documents.length,
    chunkIds: documents.map((document) => document.id as ChunkId),
    index: miniSearch.toJSON(),
  };
}

export async function loadSearchIndex(
  artifact: SearchIndexArtifact,
  expectedCorpusVersion: string = artifact.corpusVersion,
): Promise<MiniSearch<SearchDocument>> {
  if (artifact.corpusVersion !== expectedCorpusVersion) {
    throw new Error('Search index corpus version mismatch.');
  }
  if (artifact.indexConfigVersion !== INDEX_CONFIG_VERSION) {
    throw new Error('Search index configuration version mismatch.');
  }
  if (artifact.miniSearchVersion !== MINISEARCH_VERSION) {
    throw new Error('Search index MiniSearch version mismatch.');
  }
  if (artifact.stemmerVersion !== STEMMER_VERSION) {
    throw new Error('Search index stemmer version mismatch.');
  }

  return MiniSearch.loadJSAsync<SearchDocument>(
    artifact.index as AsPlainObject,
    MINISEARCH_OPTIONS,
  );
}
