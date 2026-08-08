import type { LoadedKnowledgeBase } from '../corpus/repository';
import type { ChunkId, DocumentId, SectionId } from '../corpus/types';

export interface ContextBudget {
  maxContextTokens: number;
  systemLimit: number;
  questionLimit: number;
  responseReserve: number;
  knowledgeLimit: number;
  estimatorHeadroom: number;
}

export interface SelectedSource {
  citationId: `S${number}`;
  documentId: DocumentId;
  documentOrder: number;
  sectionId: SectionId;
  sectionOrder: number;
  chunkId: ChunkId;
  chunkOrder: number;
  title: string;
  canonicalUrl: string;
  heading: string;
  text: string;
  estimatedTokens: number;
  selectionReason: 'lexical-match' | 'heading-expansion' | 'complete-corpus';
  rankingScore?: number;
  provenance: {
    sourcePath: string;
    sourceHash: string;
    chunkContentHash: string;
    sourceCommit: string;
    corpusVersion: string;
  };
}

export interface SelectionInput {
  query: string;
  knowledgeBase: LoadedKnowledgeBase;
  budget: ContextBudget;
}

export interface SelectionDiagnostics {
  directMatchCount: number;
  expansionCandidateCount: number;
  packedCount: number;
  rejectedForBudgetCount: number;
  completeCorpusIncluded: boolean;
  knowledgeTokens: number;
  rankingMs: number;
}

export interface SelectionResult {
  pipeline: 'minisearch-rank-pack';
  indexSha256: string;
  indexConfigVersion: '1.1.0';
  miniSearchVersion: '7.2.0';
  stemmerVersion: '2.0.1';
  corpusVersion: string;
  sources: SelectedSource[];
  estimatedTokens: number;
  diagnostics: SelectionDiagnostics;
}
