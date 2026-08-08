export type CollectionName = 'blog' | 'works' | 'profile';
export type DocumentId = `${CollectionName}:${string}`;
export type SectionId = `${DocumentId}#${string}`;
export type ChunkId = `${SectionId}:${string}:${number}`;

export interface KnowledgePackage {
  schemaVersion: '1.0.0';
  segmentationVersion: '1.0.0';
  corpusVersion: string;
  sourceCommit: string;
  documents: KnowledgeDocument[];
  sections: KnowledgeSection[];
  chunks: KnowledgeChunk[];
  statistics: CorpusStatistics;
}

export interface KnowledgeDocument {
  id: DocumentId;
  order: number;
  collection: CollectionName;
  slug: string;
  title: string;
  description: string;
  canonicalUrl: string;
  tags: string[];
  author: string;
  publishedAt: string;
  updatedAt?: string;
  sourcePath: string;
  sourceHash: string;
}

export interface KnowledgeSection {
  id: SectionId;
  documentId: DocumentId;
  heading: string;
  headingPath: string[];
  order: number;
}

export interface KnowledgeChunk {
  id: ChunkId;
  documentId: DocumentId;
  sectionId: SectionId;
  text: string;
  estimatedTokens: number;
  order: number;
  contentHash: string;
  sameTextOccurrence: number;
}

export interface SearchDocument {
  id: ChunkId;
  title: string;
  description: string;
  tags: string;
  heading: string;
  body: string;
}

export interface CorpusStatistics {
  documentCount: number;
  sectionCount: number;
  chunkCount: number;
  estimatedContentTokens: number;
  fullCorpusKnowledgeTokens: number;
}

export interface SearchIndexArtifact {
  corpusVersion: string;
  indexConfigVersion: '1.1.0';
  miniSearchVersion: '7.2.0';
  stemmerVersion: '2.0.1';
  chunkCount: number;
  chunkIds: ChunkId[];
  index: Record<string, unknown>;
}

export interface NormalizedSection {
  heading: string;
  headingPath: string[];
  text: string;
  order: number;
}

export interface CorpusManifest {
  schemaVersion: '1.0.0';
  segmentationVersion: '1.0.0';
  corpusVersion: string;
  sourceCommit: string;
  contentSha256: string;
  indexSha256: string;
  indexConfigVersion: '1.1.0';
  miniSearchVersion: '7.2.0';
  stemmerVersion: '2.0.1';
  indexedChunkCount: number;
  statistics: CorpusStatistics;
}
