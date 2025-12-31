/**
 * Generation Service - Retrieve + Generate Pipeline
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.7
 * Spec: Phase 4 - LLM Integration
 *
 * Orchestrates the full RAG pipeline:
 * 1. Retrieve relevant chunks (hybrid search)
 * 2. Format context with attribution
 * 3. Call LLM API with streaming
 * 4. Return response and sources
 */

import { retrieve, type RetrievedChunk } from './retrieval';
import type { ChatbotState } from '../types/chatbot';

/**
 * Generation result with sources
 */
export interface GenerationResult {
  response: string; // Full generated response
  sources: Array<{
    title: string;
    url: string;
    score?: number;
    section?: string;
  }>;
}

/**
 * Generation options
 */
export interface GenerationOptions {
  onStateChange?: (state: ChatbotState) => void;
  onStreamChunk?: (chunk: string) => void;
  maxTokens?: number; // Context token budget (default 2000)
}

/**
 * Retrieval context (from initialized chatbot)
 */
interface RetrievalContext {
  model: any;
  worker: Worker;
  searchIndex: any;
  artifacts: {
    embeddings: ArrayBuffer;
    manifest: any;
    chunks: string[];
  };
}

/**
 * Format retrieved chunks as context for LLM
 *
 * @param chunks - Retrieved chunks with metadata
 * @returns Formatted context string with attribution
 */
function formatContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map(
      (chunk, idx) =>
        `[Source ${idx + 1}] ${chunk.title}${chunk.section ? ` - ${chunk.section}` : ''}\n${chunk.text}\nURL: ${chunk.url}\n`
    )
    .join('\n---\n\n');
}

/**
 * Retrieve and generate response using RAG pipeline
 *
 * Process:
 * 1. Retrieve relevant chunks (hybrid search)
 * 2. Format context with attribution
 * 3. Call /api/chat with streaming
 * 4. Stream response chunks to callback
 * 5. Return full response and sources
 *
 * @param query - User query
 * @param context - Retrieval context (initialized resources)
 * @param options - Generation options (callbacks, token budget)
 * @returns Generated response with sources
 */
export async function retrieveAndGenerate(
  query: string,
  context: RetrievalContext,
  options: GenerationOptions = {}
): Promise<GenerationResult> {
  const { onStateChange, onStreamChunk, maxTokens = 2000 } = options;

  // 1. Retrieve relevant chunks
  onStateChange?.('retrieving');
  const chunks = await retrieve(context, query, maxTokens);

  if (chunks.length === 0) {
    throw new Error('No relevant content found for your query');
  }

  // 2. Format context
  const formattedContext = formatContext(chunks);

  // 3. Prepare sources for attribution
  const sources = chunks.map((chunk) => ({
    title: chunk.title,
    url: chunk.url,
    score: chunk.score,
    section: chunk.section,
  }));

  // 4. Call /api/chat with streaming
  onStateChange?.('generating');

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      context: formattedContext,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error (${response.status}): ${error}`);
  }

  // 5. Stream response
  onStateChange?.('streaming');

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      fullResponse += chunk;

      // Call chunk callback for UI updates
      onStreamChunk?.(chunk);
    }
  } catch (error) {
    console.error('[Generation] Stream error:', error);
    throw new Error('Streaming failed');
  }

  return {
    response: fullResponse,
    sources,
  };
}
