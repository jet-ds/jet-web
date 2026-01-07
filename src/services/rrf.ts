/**
 * Reciprocal Rank Fusion (RRF)
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.7
 * Spec: Phase 3 - Retrieval Pipeline
 *
 * Fuses semantic and BM25 search results using reciprocal rank scoring.
 * CRITICAL: Uses union (not intersection) - chunks from either retriever
 * are included in final results.
 *
 * RRF Formula: score = 1 / (k + rank + 1)
 * - k: constant (default 60) to prevent top ranks from dominating
 * - rank: 0-indexed position in ranked list
 *
 * Performance: O(n + m) where n = semantic results, m = BM25 results
 */

import type { ArtifactManifest } from '../types/chatbot';
import type { SearchResult } from '../workers/retrieval.worker';

/**
 * BM25 search result from MiniSearch
 */
export interface BM25Result {
  id: string; // Chunk ID
  score: number; // BM25 score
  // MiniSearch includes other fields, but we only need id and score
}

/**
 * Fused result with combined RRF score
 */
export interface FusedResult {
  chunkId: string;
  score: number; // Combined RRF score
  chunk: ArtifactManifest['chunks'][0];
}

/**
 * RRF fusion weights
 */
export interface RRFWeights {
  semantic: number; // Weight for semantic similarity (default 0.6)
  bm25: number; // Weight for keyword search (default 0.4)
}

/**
 * Fuses semantic and BM25 results using Reciprocal Rank Fusion
 *
 * Process:
 * 1. Pre-build chunk lookup map for O(1) access
 * 2. Score semantic results: (1 / (k + rank + 1)) * semantic_weight
 * 3. Score BM25 results: (1 / (k + rank + 1)) * bm25_weight
 * 4. Union candidates: add scores for chunks in both, include chunks in only one
 * 5. Sort by descending combined score
 *
 * @param semanticResults - Top-K results from semantic similarity search
 * @param bm25Results - Top-K results from BM25 keyword search
 * @param manifest - Artifact manifest with chunk metadata
 * @param weights - Weighting for semantic vs BM25 (default 60/40 split)
 * @param k - RRF constant (default 60)
 * @returns Fused results sorted by combined RRF score
 */
export function reciprocalRankFusion(
  semanticResults: SearchResult[],
  bm25Results: BM25Result[],
  manifest: ArtifactManifest,
  weights: RRFWeights = { semantic: 0.6, bm25: 0.4 },
  k: number = 60
): FusedResult[] {
  // Pre-build chunk lookup map for O(1) access
  const chunkMap = new Map(manifest.chunks.map((c) => [c.id, c]));
  const scoreMap = new Map<
    string,
    { score: number; chunk: ArtifactManifest['chunks'][0] }
  >();

  // Semantic contribution
  semanticResults.forEach((result, rank) => {
    const rrfScore = (1 / (k + rank + 1)) * weights.semantic;
    scoreMap.set(result.chunkId, {
      score: rrfScore,
      chunk: result.chunk,
    });
  });

  // BM25 contribution (CRITICAL: must union, not just add to existing)
  bm25Results.forEach((result, rank) => {
    const rrfScore = (1 / (k + rank + 1)) * weights.bm25;
    const existing = scoreMap.get(result.id);

    if (existing) {
      // Chunk in both retrievers: add BM25 score to existing
      existing.score += rrfScore;
    } else {
      // Chunk only in BM25: add with BM25 score only
      const chunkMeta = chunkMap.get(result.id);
      if (chunkMeta) {
        scoreMap.set(result.id, {
          score: rrfScore,
          chunk: chunkMeta,
        });
      }
    }
  });

  // Convert to array and sort by descending score
  return Array.from(scoreMap.values())
    .map((entry) => ({
      chunkId: entry.chunk.id,
      score: entry.score,
      chunk: entry.chunk,
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Selects top-K chunks within token budget
 *
 * Process:
 * 1. Iterate through fused results (already sorted by score)
 * 2. Add chunks until token budget exhausted
 * 3. Ensure minimum chunk count (even if exceeds budget)
 *
 * @param fusedResults - Fused results sorted by RRF score
 * @param maxTokens - Maximum token budget for context (default 2000)
 * @param minChunks - Minimum chunks to include (default 3)
 * @returns Selected chunks within token budget
 */
export function selectTopKWithinBudget(
  fusedResults: FusedResult[],
  maxTokens: number = 2000,
  minChunks: number = 3
): FusedResult[] {
  const selected: FusedResult[] = [];
  let totalTokens = 0;

  for (const result of fusedResults) {
    const chunkTokens = result.chunk.tokens;

    // Stop if budget exhausted (but ensure minimum chunks)
    if (selected.length >= minChunks && totalTokens + chunkTokens > maxTokens) {
      break;
    }

    selected.push(result);
    totalTokens += chunkTokens;
  }

  return selected;
}
