/**
 * Inert compatibility seam for the retired hosted RAG artifact runtime.
 *
 * The legacy initialization module remains in the repository until Task 9,
 * but no active route can reach it. Keep these signatures temporarily so the
 * dead module graph type-checks without restoring generated URLs, IndexedDB
 * cache reuse, or network access.
 */

import type { ArtifactManifest, CachedResources } from '../types/chatbot';
import { ChatbotError } from '../types/chatbot';

export async function checkCache(): Promise<CachedResources | null> {
  return null;
}

export async function fetchArtifacts(
  _cachedArtifacts?: CachedResources['artifacts'],
): Promise<{
  embeddings: ArrayBuffer;
  manifest: ArtifactManifest;
  chunks: string[];
}> {
  throw new ChatbotError(
    'artifacts-fetch-failed',
    'Hosted chatbot artifacts are retired.',
    false,
  );
}
