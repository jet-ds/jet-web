/**
 * Artifact Loader Utility
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.7
 * Spec: Phase 2 - Lazy Loading Infrastructure
 *
 * Handles lazy loading of RAG chatbot artifacts with IndexedDB caching:
 * - embeddings.bin (FP16 binary embeddings)
 * - chunks.bin (length-prefixed binary chunk text)
 * - manifest.json (metadata)
 *
 * Cache Strategy:
 * - Zero-network validation using bundled config
 * - IndexedDB for artifact persistence
 * - Immutable artifacts (build hash in URLs)
 */

import { openDB, type IDBPDatabase } from 'idb';
import type {
  ArtifactManifest,
  ArtifactConfig,
  CachedResources,
  ChatbotDB,
} from '../types/chatbot';
import { ChatbotError } from '../types/chatbot';

// Import bundled artifact config (generated at build time)
import artifactConfig from '../config/chatbot-artifacts.json';

// ============================================================================
// IndexedDB Setup
// ============================================================================

/**
 * Opens or creates the chatbot cache database
 *
 * Database Schema:
 * - Store: 'artifacts'
 * - Key: 'current'
 * - Value: { buildHash, timestamp, embeddings, manifest, chunks }
 */
async function getCacheDB(): Promise<IDBPDatabase<ChatbotDB>> {
  return openDB<ChatbotDB>('chatbot-cache', 1, {
    upgrade(db) {
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains('artifacts')) {
        db.createObjectStore('artifacts');
      }
    },
  });
}

// ============================================================================
// Cache Checking
// ============================================================================

/**
 * Checks IndexedDB for cached artifacts
 *
 * Validation Strategy (Zero-Network):
 * 1. Load bundled chatbot-artifacts.json (build hash embedded)
 * 2. Check IndexedDB for cached artifacts
 * 3. Compare build hashes
 * 4. Return cached artifacts if hash matches, null otherwise
 *
 * @returns Cached resources if valid, null if cache miss/invalid
 */
export async function checkCache(): Promise<CachedResources | null> {
  // Check if IndexedDB is available
  if (!('indexedDB' in window)) {
    console.warn('[Artifact Loader] IndexedDB not available');
    return null;
  }

  try {
    const db = await getCacheDB();
    const cachedArtifacts = await db.get('artifacts', 'current');

    if (cachedArtifacts) {
      // CRITICAL: Compare build hash from bundled config (zero-network validation)
      const configHash = (artifactConfig as ArtifactConfig).buildHash;

      if (cachedArtifacts.buildHash === configHash) {
        console.log('[Artifact Loader] ✓ Cache hit (hash match):', configHash);
        return {
          model: {
            timestamp: Date.now(),
            available: true, // Transformers.js handles its own caching
          },
          artifacts: cachedArtifacts,
        };
      } else {
        console.log('[Artifact Loader] ✗ Cache invalidated (hash mismatch)');
        console.log('  Cached:', cachedArtifacts.buildHash);
        console.log('  Current:', configHash);
      }
    }

    return null;
  } catch (error) {
    console.warn('[Artifact Loader] IndexedDB error:', error);
    return null;
  }
}

// ============================================================================
// Binary Parsing
// ============================================================================

/**
 * Parses binary chunk text buffer (length-prefixed strings)
 *
 * Format (per spec):
 * - 4-byte uint32 (little-endian): text length
 * - N bytes UTF-8: text content
 * - Repeat for each chunk
 *
 * @param buffer - Binary chunk text buffer
 * @param numChunks - Expected number of chunks (from manifest)
 * @returns Array of chunk text strings
 */
export function parseChunkTextBuffer(
  buffer: ArrayBuffer,
  numChunks: number
): string[] {
  const view = new DataView(buffer);
  const decoder = new TextDecoder('utf-8');
  const chunks: string[] = [];
  let offset = 0;

  for (let i = 0; i < numChunks; i++) {
    // Read 4-byte length prefix (little-endian)
    if (offset + 4 > buffer.byteLength) {
      throw new Error(
        `Malformed chunks.bin: incomplete length prefix at chunk ${i}`
      );
    }

    const length = view.getUint32(offset, true); // true = little-endian
    offset += 4;

    // Read UTF-8 text
    if (offset + length > buffer.byteLength) {
      throw new Error(
        `Malformed chunks.bin: incomplete text at chunk ${i} (expected ${length} bytes)`
      );
    }

    const textBytes = new Uint8Array(buffer, offset, length);
    const text = decoder.decode(textBytes);
    chunks.push(text);
    offset += length;
  }

  // Verify we consumed the entire buffer
  if (offset !== buffer.byteLength) {
    console.warn(
      `[Artifact Loader] chunks.bin has extra bytes: ${buffer.byteLength - offset} remaining`
    );
  }

  return chunks;
}

// ============================================================================
// Artifact Fetching
// ============================================================================

/**
 * Fetches artifacts from Vercel Blob Storage
 *
 * Process:
 * 1. Fetch all three artifacts in parallel (embeddings.bin, chunks.bin, manifest.json)
 * 2. Parse binary chunk text
 * 3. Cache in IndexedDB
 * 4. Return artifacts
 *
 * @param cachedArtifacts - Optional cached artifacts (if valid, returns immediately)
 * @returns Fresh or cached artifacts
 */
export async function fetchArtifacts(
  cachedArtifacts?: CachedResources['artifacts']
): Promise<{
  embeddings: ArrayBuffer;
  manifest: ArtifactManifest;
  chunks: string[];
}> {
  // Use cache if valid
  if (cachedArtifacts) {
    console.log('[Artifact Loader] Using cached artifacts');
    return {
      embeddings: cachedArtifacts.embeddings,
      manifest: cachedArtifacts.manifest,
      chunks: cachedArtifacts.chunks,
    };
  }

  try {
    console.log('[Artifact Loader] Fetching fresh artifacts from Vercel Blob');

    const config = artifactConfig as ArtifactConfig;

    // Detect offline status before fetching
    if (!navigator.onLine) {
      throw new ChatbotError(
        'offline',
        'No internet connection. Chatbot requires network access.',
        false
      );
    }

    // Fetch all artifacts in parallel
    const [embeddingsResponse, manifestResponse, chunksResponse] =
      await Promise.all([
        fetch(config.embeddingsUrl),
        fetch(config.manifestUrl),
        fetch(config.chunksUrl),
      ]);

    // Check for errors
    if (!embeddingsResponse.ok) {
      throw new Error(
        `Failed to fetch embeddings: ${embeddingsResponse.status} ${embeddingsResponse.statusText}`
      );
    }
    if (!manifestResponse.ok) {
      throw new Error(
        `Failed to fetch manifest: ${manifestResponse.status} ${manifestResponse.statusText}`
      );
    }
    if (!chunksResponse.ok) {
      throw new Error(
        `Failed to fetch chunks: ${chunksResponse.status} ${chunksResponse.statusText}`
      );
    }

    // Parse responses
    const embeddings = await embeddingsResponse.arrayBuffer();
    const manifest: ArtifactManifest = await manifestResponse.json();
    const chunksBuffer = await chunksResponse.arrayBuffer();

    console.log('[Artifact Loader] ✓ Artifacts fetched');
    console.log('  Embeddings:', (embeddings.byteLength / 1024).toFixed(2), 'KB');
    console.log('  Chunks:', (chunksBuffer.byteLength / 1024).toFixed(2), 'KB');
    console.log('  Manifest chunks:', manifest.chunks.length);

    // Parse binary chunk text
    const chunks = parseChunkTextBuffer(chunksBuffer, manifest.chunks.length);

    console.log('[Artifact Loader] ✓ Chunk text parsed:', chunks.length, 'chunks');

    // Cache in IndexedDB (best-effort, don't fail if caching fails)
    try {
      const db = await getCacheDB();
      await db.put(
        'artifacts',
        {
          buildHash: manifest.buildHash,
          timestamp: Date.now(),
          embeddings,
          manifest,
          chunks,
        },
        'current'
      );
      console.log('[Artifact Loader] ✓ Cached to IndexedDB');
    } catch (cacheError) {
      // Check for quota exceeded
      if (cacheError instanceof Error && cacheError.name === 'QuotaExceededError') {
        console.warn('[Artifact Loader] Storage quota exceeded');
        throw new ChatbotError(
          'quota-exceeded',
          'Browser storage quota exceeded. Clear site data and retry.',
          false
        );
      }
      console.warn('[Artifact Loader] Could not cache artifacts:', cacheError);
      // Non-fatal for other cache errors: continue without caching
    }

    return { embeddings, manifest, chunks };
  } catch (error) {
    // Handle typed errors
    if (error instanceof ChatbotError) {
      throw error;
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ChatbotError(
        'offline',
        'Network error. Please check your connection.',
        false
      );
    }

    // Handle other artifact fetch failures
    console.error('[Artifact Loader] Fetch failed:', error);
    throw new ChatbotError(
      'artifacts-fetch-failed',
      error instanceof Error ? error.message : 'Failed to fetch artifacts',
      true // Recoverable with retry
    );
  }
}
