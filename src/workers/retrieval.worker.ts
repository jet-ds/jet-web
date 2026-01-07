/**
 * Retrieval Worker - Similarity Search
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.7
 * Spec: Phase 3 - Retrieval Pipeline
 *
 * Runs semantic search using dot product similarity on pre-deserialized
 * FP32 embeddings. Worker initialization deserializes FP16 → FP32 once,
 * then all searches use the FP32 arrays for fast computation.
 *
 * Message Protocol:
 * - init: { type: 'init', embeddings: ArrayBuffer, manifest: ArtifactManifest }
 * - search: { type: 'search', id: string, queryEmbedding: ArrayBuffer }
 * - Response: { type: 'search-results', id: string, results: SearchResult[] }
 */

import { deserializeAllEmbeddings, dotProduct } from '../utils/fp16';
import type { ArtifactManifest } from '../types/chatbot';
import { EMBEDDING_CONFIG } from '../types/chatbot';

/**
 * Search result from semantic similarity
 */
export interface SearchResult {
  chunkId: string;
  score: number; // Cosine similarity (dot product of L2-normalized vectors)
  chunk: ArtifactManifest['chunks'][0];
}

/**
 * Worker state - embeddings are deserialized once during init
 */
let embeddingsFp32: Float32Array[] = [];
let manifest: ArtifactManifest | null = null;

/**
 * Message handler - processes init and search requests
 */
self.addEventListener('message', (e: MessageEvent) => {
  const { type } = e.data;

  if (type === 'init') {
    handleInit(e.data);
  } else if (type === 'search') {
    handleSearch(e.data);
  }
});

/**
 * Initialize worker with embeddings and manifest
 *
 * Process:
 * 1. Receive FP16 embeddings as ArrayBuffer (transferred from main thread)
 * 2. Deserialize all embeddings FP16 → FP32 (one-time cost)
 * 3. Store in worker memory for fast similarity search
 * 4. Send 'ready' signal to main thread
 *
 * @param data - { type: 'init', embeddings: ArrayBuffer, manifest: ArtifactManifest }
 */
function handleInit(data: {
  type: 'init';
  embeddings: ArrayBuffer;
  manifest: ArtifactManifest;
}) {
  console.log('[Worker] Initializing with embeddings');

  manifest = data.manifest;
  const numEmbeddings = manifest.chunks.length;

  // Deserialize all FP16 → FP32 (one-time conversion)
  embeddingsFp32 = deserializeAllEmbeddings(
    data.embeddings,
    numEmbeddings,
    EMBEDDING_CONFIG.dimensions
  );

  console.log(`[Worker] ✓ Deserialized ${numEmbeddings} embeddings to FP32`);

  // Signal ready to main thread
  self.postMessage({ type: 'ready' });
}

/**
 * Perform similarity search
 *
 * Process:
 * 1. Receive query embedding (FP32 Float32Array)
 * 2. Compute dot product with all chunk embeddings (cosine similarity)
 * 3. Sort by descending score
 * 4. Return top-50 results with chunk metadata
 *
 * Performance: ~1-5ms for 100 chunks, ~10-50ms for 1000 chunks
 *
 * @param data - { type: 'search', id: string, queryEmbedding: ArrayBuffer }
 */
function handleSearch(data: {
  type: 'search';
  id: string;
  queryEmbedding: ArrayBuffer;
}) {
  if (!manifest || embeddingsFp32.length === 0) {
    console.error('[Worker] Not initialized');
    self.postMessage({
      type: 'error',
      id: data.id,
      error: 'Worker not initialized',
    });
    return;
  }

  // Convert query embedding buffer to Float32Array
  const queryEmbedding = new Float32Array(data.queryEmbedding);

  const results: SearchResult[] = [];

  // Compute similarity for all chunks
  for (let i = 0; i < embeddingsFp32.length; i++) {
    const chunkEmbedding = embeddingsFp32[i];
    const similarity = dotProduct(queryEmbedding, chunkEmbedding);

    const chunkMeta = manifest.chunks[i];
    results.push({
      chunkId: chunkMeta.id,
      score: similarity,
      chunk: chunkMeta,
    });
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);

  // Return top-50 for fusion
  const topResults = results.slice(0, 50);

  self.postMessage({
    type: 'search-results',
    id: data.id,
    results: topResults,
  });
}
