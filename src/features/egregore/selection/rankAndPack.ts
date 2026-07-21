import type {
  ChunkId,
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeSection,
  SectionId,
} from '../corpus/types';
import { measureSourcePayloadItem } from '../sourcePayload';
import { estimateTokensFromCharacters } from '../tokenEstimate';
import type { SelectedSource, SelectionInput, SelectionResult } from './types';

type CandidateReason = SelectedSource['selectionReason'];

interface Candidate {
  chunk: KnowledgeChunk;
  document: KnowledgeDocument;
  section: KnowledgeSection;
  reason: CandidateReason;
  score?: number;
}

interface ExpansionNomination {
  score: number;
  sectionId: SectionId;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function candidateReasonOrder(reason: CandidateReason): number {
  if (reason === 'lexical-match') return 0;
  if (reason === 'heading-expansion') return 1;
  return 2;
}

function compareCandidates(left: Candidate, right: Candidate): number {
  return (
    (right.score ?? Number.NEGATIVE_INFINITY) -
      (left.score ?? Number.NEGATIVE_INFINITY) ||
    candidateReasonOrder(left.reason) - candidateReasonOrder(right.reason) ||
    left.document.order - right.document.order ||
    left.section.order - right.section.order ||
    left.chunk.order - right.chunk.order ||
    compareText(left.chunk.id, right.chunk.id)
  );
}

function selectedSource(
  candidate: Candidate,
  citationId: `S${number}`,
  input: SelectionInput,
): SelectedSource {
  return {
    citationId,
    documentId: candidate.document.id,
    documentOrder: candidate.document.order,
    sectionId: candidate.section.id,
    sectionOrder: candidate.section.order,
    chunkId: candidate.chunk.id,
    chunkOrder: candidate.chunk.order,
    title: candidate.document.title,
    canonicalUrl: candidate.document.canonicalUrl,
    heading: candidate.section.heading,
    text: candidate.chunk.text,
    estimatedTokens: candidate.chunk.estimatedTokens,
    selectionReason: candidate.reason,
    ...(candidate.score === undefined ? {} : { rankingScore: candidate.score }),
    provenance: {
      sourcePath: candidate.document.sourcePath,
      sourceHash: candidate.document.sourceHash,
      chunkContentHash: candidate.chunk.contentHash,
      sourceCommit: input.knowledgeBase.package.sourceCommit,
      corpusVersion: input.knowledgeBase.package.corpusVersion,
    },
  };
}

function resolveCandidate(
  input: SelectionInput,
  chunkId: ChunkId,
  reason: CandidateReason,
  score?: number,
): Candidate {
  const { knowledgeBase } = input;
  const chunk = knowledgeBase.chunksById.get(chunkId);
  if (chunk === undefined) {
    throw new Error(`Search or neighbor resolved an unknown chunk: ${chunkId}`);
  }
  const document = knowledgeBase.documentsById.get(chunk.documentId);
  const section = knowledgeBase.sectionsById.get(chunk.sectionId);
  if (document === undefined || section === undefined) {
    throw new Error(
      `Chunk has an unknown document or section parent: ${chunkId}`,
    );
  }
  if (section.documentId !== document.id) {
    throw new Error(
      `Chunk has inconsistent document and section parents: ${chunkId}`,
    );
  }
  return { chunk, document, section, reason, score };
}

function nominateExpansion(
  nominations: Map<ChunkId, ExpansionNomination>,
  chunkId: ChunkId,
  score: number,
  sectionId: SectionId,
): void {
  const current = nominations.get(chunkId);
  if (current !== undefined && current.sectionId !== sectionId) {
    throw new Error(
      `Neighbor nomination crosses a section boundary: ${chunkId}`,
    );
  }
  if (current === undefined || score > current.score) {
    nominations.set(chunkId, { score, sectionId });
  }
}

export function rankAndPackContext(input: SelectionInput): SelectionResult {
  const startedAt = performance.now();
  const { knowledgeBase } = input;
  const rawResults = knowledgeBase.searchIndex
    .search(input.query)
    .sort(
      (left, right) =>
        right.score - left.score ||
        compareText(String(left.id), String(right.id)),
    );

  const direct = new Map<ChunkId, Candidate>();
  const expansions = new Map<ChunkId, ExpansionNomination>();
  for (const result of rawResults) {
    const id = result.id as ChunkId;
    const existing = direct.get(id);
    if (existing !== undefined) {
      if ((existing.score ?? Number.NEGATIVE_INFINITY) < result.score) {
        existing.score = result.score;
      }
      continue;
    }

    const candidate = resolveCandidate(
      input,
      id,
      'lexical-match',
      result.score,
    );
    direct.set(id, candidate);
    const neighbors = knowledgeBase.neighborsByChunkId.get(id);
    if (neighbors === undefined) {
      throw new Error(`Missing neighbor lookup entry for chunk: ${id}`);
    }
    for (const neighborId of [neighbors.previous, neighbors.next]) {
      if (neighborId !== undefined) {
        nominateExpansion(
          expansions,
          neighborId,
          result.score * 0.5,
          candidate.section.id,
        );
      }
    }
  }

  const candidates = [...direct.values()];
  let expansionCandidateCount = 0;
  for (const [id, nomination] of expansions) {
    const directCandidate = direct.get(id);
    if (directCandidate !== undefined) {
      if (directCandidate.section.id !== nomination.sectionId) {
        throw new Error(`Neighbor lookup crosses a section boundary: ${id}`);
      }
      continue;
    }
    const candidate = resolveCandidate(
      input,
      id,
      'heading-expansion',
      nomination.score,
    );
    if (candidate.section.id !== nomination.sectionId) {
      throw new Error(`Neighbor lookup crosses a section boundary: ${id}`);
    }
    candidates.push(candidate);
    expansionCandidateCount += 1;
  }
  candidates.sort(compareCandidates);

  const completeCorpusIncluded =
    knowledgeBase.package.statistics.fullCorpusKnowledgeTokens <=
    input.budget.knowledgeLimit;
  if (completeCorpusIncluded) {
    const selectedIds = new Set(
      candidates.map((candidate) => candidate.chunk.id),
    );
    for (const chunk of knowledgeBase.package.chunks) {
      if (!selectedIds.has(chunk.id)) {
        candidates.push(resolveCandidate(input, chunk.id, 'complete-corpus'));
      }
    }
  }

  const sources: SelectedSource[] = [];
  let serializedCharacters = 2;
  let rejectedForBudgetCount = 0;
  for (const candidate of candidates) {
    const citationId = `S${sources.length + 1}` as const;
    const source = selectedSource(candidate, citationId, input);
    const item = measureSourcePayloadItem(source);
    const nextCharacters =
      serializedCharacters + item.characters + (sources.length === 0 ? 0 : 1);
    if (
      estimateTokensFromCharacters(nextCharacters) > input.budget.knowledgeLimit
    ) {
      rejectedForBudgetCount += 1;
      continue;
    }
    sources.push(source);
    serializedCharacters = nextCharacters;
  }

  const knowledgeTokens = estimateTokensFromCharacters(serializedCharacters);
  if (
    completeCorpusIncluded &&
    (sources.length !== knowledgeBase.package.statistics.chunkCount ||
      knowledgeTokens !==
        knowledgeBase.package.statistics.fullCorpusKnowledgeTokens)
  ) {
    throw new Error(
      'Packed full-corpus payload does not match the verified statistic.',
    );
  }

  return {
    pipeline: 'minisearch-rank-pack',
    indexSha256: knowledgeBase.indexSha256,
    indexConfigVersion: knowledgeBase.indexConfigVersion,
    miniSearchVersion: knowledgeBase.miniSearchVersion,
    stemmerVersion: knowledgeBase.stemmerVersion,
    corpusVersion: knowledgeBase.package.corpusVersion,
    sources,
    estimatedTokens: knowledgeTokens,
    diagnostics: {
      directMatchCount: direct.size,
      expansionCandidateCount,
      packedCount: sources.length,
      rejectedForBudgetCount,
      completeCorpusIncluded,
      knowledgeTokens,
      rankingMs: performance.now() - startedAt,
    },
  };
}
