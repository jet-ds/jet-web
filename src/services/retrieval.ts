/**
 * Retrieval Service - Hybrid Search Orchestration
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.7
 * Spec: Phase 3 - Retrieval Pipeline
 *
 * Orchestrates hybrid search combining:
 * 1. Semantic similarity (via Web Worker)
 * 2. BM25 keyword search (via MiniSearch)
 * 3. Reciprocal Rank Fusion
 * 4. Token budget enforcement
 *
 * Returns top-K chunks with text and metadata for LLM context.
 */

import { reciprocalRankFusion, selectTopKWithinBudget } from './rrf';
import type { SearchResult } from '../workers/retrieval.worker';
import type { BM25Result } from './rrf';
import { EMBEDDING_CONFIG } from '../types/chatbot';

/**
 * Retrieved chunk with full text for LLM context
 */
export interface RetrievedChunk {
  id: string;
  text: string;
  score: number;
  title: string;
  section?: string;
  url: string;
  tokens: number;
}

/**
 * Retrieval context - stores initialized resources
 */
interface RetrievalContext {
  model: any; // Transformers.js pipeline
  worker: Worker;
  searchIndex: any; // MiniSearch instance
  artifacts: {
    embeddings: ArrayBuffer;
    manifest: any;
    chunks: string[];
  };
}

/**
 * Embed query using Transformers.js model
 *
 * Process:
 * 1. Run model inference (15-250ms depending on backend)
 * 2. Extract 384-dim embedding
 * 3. L2-normalize for cosine similarity (via dot product)
 *
 * @param model - Transformers.js feature-extraction pipeline
 * @param query - User query text
 * @returns L2-normalized query embedding (Float32Array)
 */
async function embedQuery(model: any, query: string): Promise<Float32Array> {
  // Generate embedding
  const output = await model(query, {
    pooling: 'mean',
    normalize: true, // L2-normalize for cosine similarity
  });

  // Extract Float32Array (384 dimensions)
  const embedding = new Float32Array(EMBEDDING_CONFIG.dimensions);
  for (let i = 0; i < EMBEDDING_CONFIG.dimensions; i++) {
    embedding[i] = output.data[i];
  }

  return embedding;
}

/**
 * Search semantic similarity via Web Worker
 *
 * Process:
 * 1. Generate unique request ID
 * 2. Post query embedding to worker
 * 3. Wait for 'search-results' message
 * 4. Return top-50 results
 *
 * Performance: ~1-10ms for typical content library
 *
 * @param worker - Retrieval worker instance
 * @param queryEmbedding - L2-normalized query embedding
 * @returns Top-50 semantic similarity results
 */
function searchSemantic(
  worker: Worker,
  queryEmbedding: Float32Array
): Promise<SearchResult[]> {
  const id = `search-${Date.now()}-${Math.random()}`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Worker search timeout'));
    }, 10000); // 10s timeout

    const messageHandler = (e: MessageEvent) => {
      if (e.data.type === 'search-results' && e.data.id === id) {
        clearTimeout(timeout);
        worker.removeEventListener('message', messageHandler);
        resolve(e.data.results);
      } else if (e.data.type === 'error' && e.data.id === id) {
        clearTimeout(timeout);
        worker.removeEventListener('message', messageHandler);
        reject(new Error(e.data.error));
      }
    };

    worker.addEventListener('message', messageHandler);

    // Post query embedding (copy, don't transfer - may be needed on main thread)
    worker.postMessage({
      type: 'search',
      id,
      queryEmbedding: queryEmbedding.buffer,
    });
  });
}

/**
 * Retrieve relevant chunks using hybrid search
 *
 * Process:
 * 1. Embed query (semantic representation)
 * 2. Semantic search (Web Worker, dot product similarity)
 * 3. BM25 search (MiniSearch, keyword matching)
 * 4. RRF fusion (combine rankings with 60/40 weight)
 * 5. Token budget selection (top-K within 2000 tokens)
 * 6. Resolve chunk text from artifacts
 *
 * @param context - Retrieval context with initialized resources
 * @param query - User query
 * @param maxTokens - Maximum context tokens (default 2000)
 * @returns Retrieved chunks with full text and metadata
 */
export async function retrieve(
  context: RetrievalContext,
  query: string,
  maxTokens: number = 2000
): Promise<RetrievedChunk[]> {
  // 1. Embed query (~15-250ms)
  const queryEmbedding = await embedQuery(context.model, query);

  // 2. Semantic search (Web Worker, ~1-10ms)
  const semanticResults = await searchSemantic(context.worker, queryEmbedding);

  // 3. BM25 search (MiniSearch, <10ms)
  const bm25Results: BM25Result[] = context.searchIndex.search(query, {
    limit: 50,
  });

  // 4. Fuse with RRF (60% semantic, 40% BM25)
  const fusedResults = reciprocalRankFusion(
    semanticResults,
    bm25Results,
    context.artifacts.manifest,
    { semantic: 0.6, bm25: 0.4 }
  );

  // 5. Select top-K within token budget
  const topK = selectTopKWithinBudget(fusedResults, maxTokens, 3);

  // 6. Resolve chunk text and prepare for LLM
  return topK.map((result) => {
    // Find chunk text by matching chunk ID to manifest index
    const chunkIndex = context.artifacts.manifest.chunks.findIndex(
      (c: any) => c.id === result.chunkId
    );

    return {
      id: result.chunkId,
      text: context.artifacts.chunks[chunkIndex] || '',
      score: result.score,
      title: result.chunk.metadata.title,
      section: result.chunk.metadata.section,
      url: result.chunk.metadata.url,
      tokens: result.chunk.tokens,
    };
  });
}
