/**
 * Chatbot Initialization Service
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.7
 * Spec: Phase 2 - Initialization (User Activation)
 *
 * Orchestrates the complete initialization sequence:
 * 1. Check IndexedDB cache
 * 2. Load embedding model (Transformers.js)
 * 3. Fetch artifacts (embeddings, chunks, manifest)
 * 4. Initialize BM25 search index (MiniSearch)
 * 5. Spawn Web Worker for semantic search
 *
 * Progress reporting via callback for UX narrative loading states.
 */

import MiniSearch from 'minisearch';
import type { InitializationSubstate, ArtifactManifest } from '../types/chatbot';
import { EMBEDDING_CONFIG } from '../types/chatbot';
import { checkCache, fetchArtifacts } from '../utils/artifact-loader';

/**
 * Progress callback type for initialization updates
 */
export type ProgressCallback = (
  substate: InitializationSubstate,
  progress: number
) => void;

/**
 * InitializationResult contains all loaded resources
 */
export interface InitializationResult {
  model: any; // Transformers.js pipeline
  artifacts: {
    embeddings: ArrayBuffer;
    manifest: ArtifactManifest;
    chunks: string[];
  };
  searchIndex: MiniSearch;
  worker: Worker; // Placeholder for Phase 3
}

// ============================================================================
// Sub-Phase 2.2: Load Embedding Model
// ============================================================================

/**
 * Loads the embedding model using Transformers.js
 *
 * Model: Xenova/all-MiniLM-L6-v2 (384 dimensions)
 * - First load: Downloads ~23 MB (cached to IndexedDB by Transformers.js)
 * - Subsequent loads: Instant (loads from cache)
 *
 * @param onProgress - Progress callback
 * @returns Transformers.js feature-extraction pipeline
 */
async function loadModel(onProgress: (progress: number) => void): Promise<any> {
  const { pipeline } = await import('@huggingface/transformers');

  console.log('[Init] Loading embedding model:', EMBEDDING_CONFIG.model);

  const extractor = await pipeline(
    'feature-extraction',
    EMBEDDING_CONFIG.model,
    {
      dtype: 'q8', // Use quantized model for faster inference (v3.x API)
      progress_callback: (progressData: any) => {
        // Report download progress (0-100)
        const progress = (progressData.progress || 0) * 100;
        onProgress(progress);
      },
    }
  );

  console.log('[Init] ✓ Model loaded');
  return extractor;
}

// ============================================================================
// Sub-Phase 2.4: Initialize Search Index
// ============================================================================

/**
 * Initializes MiniSearch BM25 index with chunk text
 *
 * Process (async batching to prevent UI blocking):
 * 1. Create MiniSearch instance with field configuration
 * 2. Add chunks in batches of 50 to yield to main thread
 * 3. Return initialized index
 *
 * @param manifest - Artifact manifest with chunk metadata
 * @param chunks - Parsed chunk text array
 * @returns Initialized MiniSearch instance
 */
async function initializeSearch(
  manifest: ArtifactManifest,
  chunks: string[]
): Promise<MiniSearch> {
  console.log('[Init] Initializing search index');

  const searchIndex = new MiniSearch({
    fields: ['text', 'title', 'section'], // Fields to index
    storeFields: ['id', 'title', 'section', 'url'], // Fields to store
    searchOptions: {
      boost: { title: 3, section: 2, text: 1 }, // Title matches most important
      fuzzy: 0.2, // Allow 20% fuzzy matching
      prefix: true, // Enable prefix matching
    },
  });

  const batchSize = 50;
  let processedCount = 0;

  // Add chunks in batches to prevent UI blocking
  for (let i = 0; i < manifest.chunks.length; i += batchSize) {
    const batch = manifest.chunks.slice(i, i + batchSize).map((meta, idx) => ({
      id: meta.id,
      text: chunks[i + idx], // Get text from chunks array (indexed by position)
      title: meta.metadata.title,
      section: meta.metadata.section || '',
      url: meta.metadata.url,
    }));

    searchIndex.addAll(batch);
    processedCount += batch.length;

    // Yield to main thread every batch
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  console.log('[Init] ✓ Search index ready:', processedCount, 'chunks indexed');
  return searchIndex;
}

// ============================================================================
// Sub-Phase 2.5: Spawn Web Worker
// ============================================================================

/**
 * Spawns Web Worker for semantic search
 *
 * Process:
 * 1. Create worker from retrieval.worker.ts
 * 2. Clone embeddings buffer (enables re-initialization)
 * 3. Transfer cloned buffer to worker with manifest
 * 4. Wait for 'ready' signal (worker deserializes FP16 → FP32)
 * 5. Return initialized worker
 *
 * @param embeddings - Embeddings ArrayBuffer (FP16)
 * @param manifest - Artifact manifest
 * @returns Initialized worker instance
 */
async function spawnWorker(
  embeddings: ArrayBuffer,
  manifest: ArtifactManifest
): Promise<Worker> {
  console.log('[Init] Spawning Web Worker');

  // Create worker from module
  const worker = new Worker(
    new URL('../workers/retrieval.worker.ts', import.meta.url),
    { type: 'module' }
  );

  // CRITICAL: Clone buffer before transfer (enables re-initialization)
  const embeddingsClone = embeddings.slice(0);

  // Post init message with embeddings and manifest
  worker.postMessage(
    {
      type: 'init',
      embeddings: embeddingsClone,
      manifest: manifest,
    },
    [embeddingsClone] // Transfer ownership of cloned buffer
  );

  // Wait for worker ready signal
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Worker initialization timeout'));
    }, 30000); // 30s timeout for deserialization

    const messageHandler = (e: MessageEvent) => {
      if (e.data.type === 'ready') {
        clearTimeout(timeout);
        worker.removeEventListener('message', messageHandler);
        worker.removeEventListener('error', errorHandler);
        resolve();
      }
    };

    const errorHandler = (e: ErrorEvent) => {
      clearTimeout(timeout);
      worker.removeEventListener('message', messageHandler);
      worker.removeEventListener('error', errorHandler);
      reject(new Error(`Worker error: ${e.message}`));
    };

    worker.addEventListener('message', messageHandler);
    worker.addEventListener('error', errorHandler);
  });

  console.log('[Init] ✓ Worker ready');
  return worker;
}

// ============================================================================
// Main Initialization Function
// ============================================================================

/**
 * Initializes the RAG chatbot with all required resources
 *
 * Sequential Substates:
 * 1. checking-cache (0-10%)
 * 2. loading-model (10-40%)
 * 3. fetching-artifacts (40-70%)
 * 4. initializing-search (70-90%)
 * 5. spawning-worker (90-99%)
 * 6. complete (100%)
 *
 * @param onProgress - Progress callback for UI updates
 * @returns All initialized resources
 * @throws Error if initialization fails
 */
export async function initializeChatbot(
  onProgress: ProgressCallback
): Promise<InitializationResult> {
  try {
    // ==================== Sub-Phase 1: Check Cache ====================
    onProgress('checking-cache', 0);
    const cache = await checkCache();

    // ==================== Sub-Phase 2: Load Model ====================
    onProgress('loading-model', 10);
    const model = await loadModel((modelProgress) => {
      // Map model progress (0-100) to overall progress (10-40%)
      const overallProgress = 10 + (modelProgress * 0.3);
      onProgress('loading-model', overallProgress);
    });

    // ==================== Sub-Phase 3: Fetch Artifacts ====================
    onProgress('fetching-artifacts', 40);
    const artifacts = await fetchArtifacts(cache?.artifacts || undefined);

    // ==================== Sub-Phase 4: Initialize Search ====================
    onProgress('initializing-search', 70);
    const searchIndex = await initializeSearch(artifacts.manifest, artifacts.chunks);

    // ==================== Sub-Phase 5: Spawn Worker ====================
    onProgress('spawning-worker', 90);
    const worker = await spawnWorker(artifacts.embeddings, artifacts.manifest);

    // ==================== Complete ====================
    onProgress('complete', 100);

    console.log('[Init] ✅ Initialization complete');
    console.log('  Model:', EMBEDDING_CONFIG.model);
    console.log('  Chunks:', artifacts.chunks.length);
    console.log('  Build hash:', artifacts.manifest.buildHash);

    return {
      model,
      artifacts,
      searchIndex,
      worker,
    };
  } catch (error) {
    console.error('[Init] ❌ Initialization failed:', error);
    throw error;
  }
}
