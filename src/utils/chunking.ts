/**
 * RAG Chatbot - Phase 2: Chunking
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.6
 * Spec: Lines 162-277
 *
 * Implements semantic chunking by heading boundaries with overlap
 * for context continuity in RAG retrieval.
 */

import type { ContentItem, Chunk } from '../types/chatbot.js';
import { CHUNKING_CONFIG } from '../types/chatbot.js';

// Re-export for backward compatibility
export type { Chunk };
export { CHUNKING_CONFIG };

/**
 * Section represents a content section split by headings
 */
interface Section {
  heading?: string;
  content: string;
}

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Estimates token count using simple heuristic: chars / 4
 * Spec: Line 175
 *
 * This is a conservative estimate:
 * - 1 token ≈ 4 characters for English text
 * - Actual: ~0.75 words per token, ~5 chars per word
 * - Our estimate: chars / 4 is slightly conservative
 *
 * @param text - Text to estimate
 * @returns Estimated token count
 */
function estimateTokens(text: string): number {
  return CHUNKING_CONFIG.tokenEstimator(text);
}

// ============================================================================
// Heading Extraction
// ============================================================================

/**
 * Splits content by markdown heading boundaries (h2, h3)
 * Spec: Lines 229-232
 *
 * Strategy:
 * - Parse ## and ### headings
 * - Create sections with heading + content
 * - Preserve content before first heading as "intro"
 *
 * @param content - Markdown content
 * @returns Array of sections with optional headings
 */
export function splitByHeadings(content: string): Section[] {
  const sections: Section[] = [];
  const lines = content.split('\n');

  let currentHeading: string | undefined;
  let currentContent: string[] = [];

  for (const line of lines) {
    // Match h2 or h3 headings
    const headingMatch = line.match(/^(##|###)\s+(.+)$/);

    if (headingMatch) {
      // Save previous section
      if (currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join('\n').trim()
        });
      }

      // Start new section
      currentHeading = headingMatch[2].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Save final section
  if (currentContent.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join('\n').trim()
    });
  }

  return sections.filter(s => s.content.length > 0);
}

// ============================================================================
// Overlap Helpers
// ============================================================================

/**
 * Extracts last N tokens from text for overlap
 * Spec: Lines 268-274
 *
 * Strategy:
 * - Split by whitespace to get words
 * - Estimate tokens: ~0.75 tokens per word
 * - Return last N tokens worth of words
 *
 * @param text - Source text
 * @param n - Number of tokens to extract
 * @returns Last N tokens of text
 */
export function getLastNTokens(text: string, n: number): string {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const estimatedTokens = words.length * 0.75;

  if (estimatedTokens <= n) return text;

  const wordsToKeep = Math.ceil(n / 0.75);
  return words.slice(-wordsToKeep).join(' ');
}

// ============================================================================
// Chunking with Overlap
// ============================================================================

/**
 * Chunks text with overlap for context continuity
 * Spec: Lines 234-275
 *
 * Strategy:
 * - Split by paragraph boundaries
 * - Accumulate paragraphs until target/max tokens
 * - When exceeding max, start new chunk with overlap
 * - Overlap: last N tokens from previous chunk
 *
 * @param text - Text to chunk
 * @param targetTokens - Target chunk size
 * @param maxTokens - Hard limit
 * @param overlapTokens - Overlap size
 * @returns Array of chunked text
 */
export function chunkWithOverlap(
  text: string,
  targetTokens: number,
  maxTokens: number,
  overlapTokens: number
): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

  let currentChunk = '';
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    if (currentTokens + paraTokens > maxTokens) {
      // Chunk would exceed max, save current and start new
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }

      // Start new chunk with overlap from previous
      const overlapText = getLastNTokens(currentChunk, overlapTokens);
      currentChunk = overlapText + '\n\n' + para;
      currentTokens = estimateTokens(currentChunk);
    } else {
      // Add paragraph to current chunk
      currentChunk += (currentChunk ? '\n\n' : '') + para;
      currentTokens += paraTokens;
    }
  }

  // Save final chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Splits section content by token limit
 * Used by chunkDocument to split large sections
 *
 * @param content - Section content
 * @param targetTokens - Target chunk size
 * @param maxTokens - Hard limit
 * @returns Array of chunked text
 */
export function splitByTokenLimit(
  content: string,
  targetTokens: number,
  maxTokens: number
): string[] {
  return chunkWithOverlap(
    content,
    targetTokens,
    maxTokens,
    CHUNKING_CONFIG.overlapTokens
  );
}

// ============================================================================
// Main Chunking Function
// ============================================================================

/**
 * Chunks a ContentItem into semantic chunks by heading boundaries
 * Spec: Lines 196-226
 *
 * Process:
 * 1. Split content by h2/h3 headings into sections
 * 2. For each section, split by token limit if needed
 * 3. Create Chunk objects with proper IDs and metadata
 * 4. Apply overlap between chunks
 *
 * @param item - ContentItem from Phase 1
 * @returns Array of Chunks ready for embedding
 */
export function chunkDocument(item: ContentItem): Chunk[] {
  const chunks: Chunk[] = [];
  const sections = splitByHeadings(item.content);

  let globalIndex = 0;

  for (const section of sections) {
    // Split section by token limit (with overlap)
    const sectionChunks = splitByTokenLimit(
      section.content,
      CHUNKING_CONFIG.targetTokens,
      CHUNKING_CONFIG.maxTokens
    );

    for (let i = 0; i < sectionChunks.length; i++) {
      const chunkText = sectionChunks[i];
      const tokens = estimateTokens(chunkText);

      // Skip chunks below minimum threshold
      if (tokens < CHUNKING_CONFIG.minTokens) {
        console.warn(`  ⚠️  Skipping small chunk (${tokens} tokens): ${item.id}#${section.heading || 'intro'}-${i}`);
        continue;
      }

      chunks.push({
        id: `${item.id}#${section.heading || 'intro'}-${i}`,
        parentId: item.id,
        text: chunkText,
        tokens,
        metadata: {
          type: item.type,
          title: item.title,
          section: section.heading,
          tags: item.metadata.tags,
          url: `/${item.type}/${item.slug}`,
          index: globalIndex
        }
      });

      globalIndex++;
    }
  }

  return chunks;
}

/**
 * Chunks multiple ContentItems
 *
 * @param items - Array of ContentItems
 * @returns Combined array of all chunks
 */
export function chunkAll(items: ContentItem[]): Chunk[] {
  const allChunks: Chunk[] = [];

  for (const item of items) {
    const itemChunks = chunkDocument(item);
    allChunks.push(...itemChunks);
  }

  return allChunks;
}
