/**
 * Shared types and constants for RAG Chatbot
 *
 * This file provides shared interfaces and constants used across
 * the build pipeline (scripts/) and runtime (src/).
 *
 * Centralizing these prevents duplication and ensures consistency.
 */

// ============================================================================
// Content Types
// ============================================================================

/**
 * ContentItem represents normalized content from Astro collections
 *
 * Used by content loader and chunking pipeline
 */
export interface ContentItem {
  id: string;              // "blog/welcome-to-my-blog"
  slug: string;            // "welcome-to-my-blog"
  type: 'blog' | 'works';  // Collection type
  title: string;
  content: string;         // Raw MDX body
  metadata: {
    tags: string[];
    pubDate?: Date;
    date?: Date;
    author?: string;
  };
}

/**
 * ChunkMetadata contains metadata for a single chunk
 */
export interface ChunkMetadata {
  type: 'blog' | 'works';
  title: string;          // Post title
  section?: string;       // Heading if available
  tags: string[];
  url: string;            // Canonical URL to post
  index: number;          // Chunk index in document
}

/**
 * Chunk represents a semantic unit of content for embedding
 */
export interface Chunk {
  id: string;               // "blog/welcome#intro-0"
  parentId: string;         // "blog/welcome"
  text: string;             // Chunk content
  tokens: number;           // Estimated token count
  metadata: ChunkMetadata;
}

// ============================================================================
// Embedding Types
// ============================================================================

/**
 * EmbeddingResult represents a chunk with its generated embedding vector
 */
export interface EmbeddingResult {
  chunkId: string;         // Chunk ID reference
  embedding: number[];     // 384-dim FP32 vector (L2-normalized)
  dimensions: number;      // Always 384 for all-MiniLM-L6-v2
}

// ============================================================================
// Constants - Build Pipeline
// ============================================================================

/**
 * Embedding generation configuration
 */
export const EMBEDDING_CONFIG = {
  /** Model name for Transformers.js */
  model: 'Xenova/all-MiniLM-L6-v2',
  /** Embedding vector dimensions */
  dimensions: 384,
  /** Batch size for embedding generation */
  batchSize: 32,
  /** Normalization method */
  normalization: 'l2' as const,
} as const;

/**
 * Chunking configuration
 */
export const CHUNKING_CONFIG = {
  /** Target chunk size in tokens */
  targetTokens: 256,
  /** Hard limit for chunk size */
  maxTokens: 512,
  /** Minimum viable chunk size */
  minTokens: 64,
  /** Overlap between chunks for context continuity */
  overlapTokens: 32,
  /** Token estimation function (chars / 4) */
  tokenEstimator: (text: string) => Math.ceil(text.length / 4),
} as const;

/**
 * Cache configuration for Vercel Blob
 */
export const CACHE_CONFIG = {
  /** Cache max age in seconds (1 year for immutable artifacts) */
  maxAgeSeconds: 31536000,
} as const;

/**
 * Artifact versioning
 */
export const ARTIFACT_VERSION = '1.0.0';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate total tokens from chunks array
 */
export function getTotalTokens(chunks: Chunk[]): number {
  return chunks.reduce((sum, c) => sum + c.tokens, 0);
}

/**
 * Calculate average tokens per chunk
 */
export function getAverageTokens(chunks: Chunk[]): number {
  if (chunks.length === 0) return 0;
  return Math.round(getTotalTokens(chunks) / chunks.length);
}
