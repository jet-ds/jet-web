/**
 * RAG Chatbot Build Pipeline - Phase 1: Content Discovery
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.5
 *
 * This script implements the build-time pipeline for generating
 * embeddings and artifacts for the database-less RAG chatbot.
 */

import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import { chunkAll, type Chunk } from '../src/utils/chunking.js';
import { pipeline } from '@huggingface/transformers';
import { setFloat16 } from '@petamoriken/float16';
import { createHash } from 'crypto';

// ============================================================================
// Phase 1: Content Discovery
// ============================================================================

/**
 * ContentItem represents a normalized content entry from Astro collections
 *
 * Spec: docs/rag-chatbot-implementation-plan.md - Phase 1, lines 132-145
 */
interface ContentItem {
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
 * Discovers and loads all content from Astro collections
 *
 * Process (spec lines 148-154):
 * 1. Load all collections: blog + works
 * 2. Filter out drafts
 * 3. Extract raw MDX body
 * 4. Strip MDX components, keep prose
 * 5. Normalize whitespace
 *
 * @returns Array of normalized content items
 */
async function discoverContent(): Promise<ContentItem[]> {
  console.log('📚 Phase 1: Content Discovery');

  // Step 1: Load collections in parallel
  const [blogEntries, worksEntries] = await Promise.all([
    getCollection('blog'),
    getCollection('works')
  ]);

  console.log(`   Found ${blogEntries.length} blog posts, ${worksEntries.length} works`);

  // Step 2: Filter out drafts
  const publishedBlog = blogEntries.filter(entry => !entry.data.draft);
  const publishedWorks = worksEntries.filter(entry => !entry.data.draft);

  console.log(`   Published: ${publishedBlog.length} blog posts, ${publishedWorks.length} works`);

  // Step 3-5: Render, extract, normalize
  const blogItems = await Promise.all(
    publishedBlog.map(entry => processEntry(entry, 'blog'))
  );

  const worksItems = await Promise.all(
    publishedWorks.map(entry => processEntry(entry, 'works'))
  );

  const allItems = [...blogItems, ...worksItems].filter(item => item !== null) as ContentItem[];

  console.log(`   ✓ Processed ${allItems.length} total content items\n`);

  return allItems;
}

/**
 * Processes a single collection entry
 *
 * @param entry - Astro collection entry
 * @param type - Collection type (blog or works)
 * @returns Normalized ContentItem or null if empty
 */
async function processEntry(
  entry: CollectionEntry<'blog'> | CollectionEntry<'works'>,
  type: 'blog' | 'works'
): Promise<ContentItem | null> {
  try {
    // Step 3: Extract raw MDX body directly from entry
    const rawBody = entry.body || '';

    // Step 4: Strip MDX components, keep prose
    const strippedContent = stripMDXComponents(rawBody);

    // Step 5: Normalize whitespace
    const normalizedContent = normalizeWhitespace(strippedContent);

    // Exclusion: Empty content (spec lines 155-158)
    if (!normalizedContent.trim()) {
      console.warn(`   ⚠️  Skipping empty content: ${entry.id}`);
      return null;
    }

    // Extract metadata based on collection type
    const metadata = type === 'blog'
      ? {
          tags: entry.data.tags || [],
          pubDate: entry.data.pubDate,
          author: entry.data.author
        }
      : {
          tags: entry.data.tags || [],
          date: entry.data.date
        };

    return {
      id: entry.id,
      slug: entry.slug,
      type,
      title: entry.data.title,
      content: normalizedContent,
      metadata
    };

  } catch (error) {
    console.error(`   ✗ Error processing ${entry.id}:`, error);
    return null;
  }
}

/**
 * Strips MDX components and JSX syntax, keeping only prose
 *
 * Strategy:
 * - Remove JSX tags: <Component {...props}>
 * - Remove imports/exports
 * - Keep markdown syntax
 * - Preserve code blocks
 *
 * @param content - Raw MDX content
 * @returns Cleaned prose content
 */
function stripMDXComponents(content: string): string {
  let cleaned = content;

  // Remove import/export statements
  cleaned = cleaned.replace(/^import\s+.*$/gm, '');
  cleaned = cleaned.replace(/^export\s+.*$/gm, '');

  // Remove JSX components (self-closing and paired)
  // Preserve markdown syntax like <em> and <strong>
  cleaned = cleaned.replace(/<([A-Z][A-Za-z0-9]*)[^>]*\/>/g, '');
  cleaned = cleaned.replace(/<([A-Z][A-Za-z0-9]*)[^>]*>[\s\S]*?<\/\1>/g, '');

  // Remove JSX expressions in curly braces
  cleaned = cleaned.replace(/\{[^}]+\}/g, '');

  return cleaned;
}

/**
 * Normalizes whitespace while preserving paragraph structure
 *
 * Strategy:
 * - Collapse multiple spaces to single space
 * - Preserve paragraph breaks (double newline)
 * - Trim leading/trailing whitespace
 *
 * @param content - Content with irregular whitespace
 * @returns Normalized content
 */
function normalizeWhitespace(content: string): string {
  return content
    // Preserve paragraph breaks
    .replace(/\n{3,}/g, '\n\n')
    // Collapse multiple spaces
    .replace(/ {2,}/g, ' ')
    // Trim each line
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Final trim
    .trim();
}

// ============================================================================
// Phase 3: Embedding Generation
// ============================================================================

/**
 * EmbeddingResult represents a chunk with its generated embedding vector
 *
 * Spec: docs/rag-chatbot-implementation-plan.md - Phase 3, lines 281-337
 */
interface EmbeddingResult {
  chunkId: string;         // Chunk ID reference
  embedding: number[];     // 384-dim FP32 vector (L2-normalized)
  dimensions: number;      // Always 384 for all-MiniLM-L6-v2
}

/**
 * Generates embeddings for all chunks using Transformers.js
 *
 * Model: Xenova/all-MiniLM-L6-v2 (384 dimensions)
 * Process (spec lines 288-331):
 * 1. Load feature-extraction pipeline with quantization
 * 2. Process chunks in batches (batch size 32)
 * 3. Generate embeddings with mean pooling
 * 4. L2-normalize for cosine similarity via dot product
 * 5. Extract Float32 arrays (384 dimensions)
 *
 * @param chunks - Array of chunks from Phase 2
 * @returns Array of embedding results with chunk IDs
 */
async function generateEmbeddings(chunks: Chunk[]): Promise<EmbeddingResult[]> {
  console.log('🧠 Phase 3: Embedding Generation');
  console.log('   Loading model: Xenova/all-MiniLM-L6-v2');

  // Load model (Node.js environment with quantization)
  const extractor = await pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2',
    { quantized: true }
  );

  console.log('   ✓ Model loaded');

  const batchSize = 32;
  const results: EmbeddingResult[] = [];

  console.log(`   Processing ${chunks.length} chunks in batches of ${batchSize}...`);

  // Process in batches for efficiency
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map(c => c.text);

    // Generate embeddings with L2 normalization
    const embeddings = await extractor(texts, {
      pooling: 'mean',
      normalize: true  // L2-normalize for cosine similarity
    });

    // Extract Float32 arrays (model outputs FP32)
    for (let j = 0; j < batch.length; j++) {
      const embedding = Array.from(embeddings.data.slice(
        j * 384,
        (j + 1) * 384
      )) as number[]; // 384 dimensions

      results.push({
        chunkId: batch[j].id,
        embedding: embedding, // FP32 from model
        dimensions: 384
      });
    }

    console.log(`   Processed ${Math.min(i + batchSize, chunks.length)}/${chunks.length} chunks`);
  }

  console.log('   ✓ All embeddings generated');
  console.log(`   Total embeddings: ${results.length}`);
  console.log(`   Dimensions: ${results[0]?.dimensions || 0}`);
  console.log(`   Precision: FP32 (L2-normalized)\n`);

  return results;
}

// ============================================================================
// Phase 4: Serialization
// ============================================================================

/**
 * ArtifactManifest contains metadata for the RAG chatbot artifacts
 *
 * Spec: docs/rag-chatbot-implementation-plan.md - Phase 4, lines 395-421
 */
interface ArtifactManifest {
  version: string;
  buildTime: string;
  buildHash: string;
  model: {
    name: string;
    dimensions: number;
    normalization: string;
  };
  storage: {
    precision: string;
    accumulationPrecision: string;
  };
  chunks: {
    id: string;
    parentId: string;
    tokens: number;
    metadata: {
      type: 'blog' | 'works';
      title: string;
      section?: string;
      tags: string[];
      url: string;
      index: number;
    };
    embeddingOffset: number;
  }[];
  stats: {
    totalChunks: number;
    totalTokens: number;
    avgTokensPerChunk: number;
  };
}

/**
 * SerializedArtifacts represents the three output files
 *
 * Spec: docs/rag-chatbot-implementation-plan.md - Phase 4, lines 423-427
 */
interface SerializedArtifacts {
  embeddingsBuffer: ArrayBuffer;  // FP16 binary embeddings
  chunkTextBuffer: ArrayBuffer;   // Length-prefixed chunk text
  manifest: ArtifactManifest;     // Metadata JSON
}

/**
 * Computes SHA-256 hash of chunks and metadata for cache invalidation
 *
 * Hashes chunk content, IDs, metadata, and chunking config to ensure
 * hash changes when any of these change (not just text content).
 *
 * @param chunks - Array of chunks to hash
 * @returns Hex-encoded SHA-256 hash (first 16 chars)
 */
function computeContentHash(chunks: Chunk[]): string {
  // Include everything that should invalidate the cache:
  // 1. Chunk text content
  // 2. Chunk IDs (detects slug changes, reordering)
  // 3. Metadata (title, tags, sections, URLs)
  // 4. Chunking config (detects strategy changes)
  const hashInput = JSON.stringify({
    chunks: chunks.map(c => ({
      id: c.id,
      text: c.text,
      tokens: c.tokens,
      metadata: c.metadata
    })),
    config: {
      targetTokens: 256,
      maxTokens: 512,
      minTokens: 64,
      overlapTokens: 32
    },
    version: '1.0.0'
  });

  const hash = createHash('sha256').update(hashInput).digest('hex');
  return hash.substring(0, 16); // First 16 chars for filename
}

/**
 * Serializes embeddings and chunks to binary artifacts
 *
 * Process (spec lines 355-428):
 * 1. Convert FP32 embeddings to FP16 binary (50% size reduction)
 * 2. Serialize chunk text to binary (length-prefixed strings)
 * 3. Create manifest with metadata (no chunk text)
 * 4. Return three artifacts ready for upload
 *
 * @param embeddings - FP32 embeddings from Phase 3
 * @param chunks - Chunks from Phase 2
 * @returns Serialized artifacts (embeddings.bin, chunks.bin, manifest.json)
 */
function serializeEmbeddings(
  embeddings: EmbeddingResult[],
  chunks: Chunk[]
): SerializedArtifacts {
  console.log('💾 Phase 4: Serialization');

  // Step 1: Convert FP32 to FP16 binary
  console.log('   Converting embeddings: FP32 → FP16');
  const buffer = new ArrayBuffer(embeddings.length * 384 * 2); // 2 bytes per FP16
  const view = new DataView(buffer);

  let offset = 0;
  for (const embedding of embeddings) {
    for (let i = 0; i < 384; i++) {
      setFloat16(view, offset, embedding.embedding[i], true); // little-endian
      offset += 2;
    }
  }

  const embeddingsSizeKB = (buffer.byteLength / 1024).toFixed(2);
  console.log(`   ✓ Embeddings: ${embeddingsSizeKB} KB (FP16)`);

  // Step 2: Serialize chunk text to binary (length-prefixed strings)
  console.log('   Serializing chunk text');
  const encoder = new TextEncoder();
  const chunkTextBuffers: Uint8Array[] = [];
  let totalChunkTextSize = 0;

  for (const chunk of chunks) {
    const textBytes = encoder.encode(chunk.text);
    const lengthBuffer = new Uint8Array(4);
    new DataView(lengthBuffer.buffer).setUint32(0, textBytes.length, true);

    chunkTextBuffers.push(lengthBuffer);
    chunkTextBuffers.push(textBytes);
    totalChunkTextSize += 4 + textBytes.length;
  }

  // Concatenate all chunk text buffers
  const chunkTextBuffer = new Uint8Array(totalChunkTextSize);
  let chunkTextOffset = 0;
  for (const buf of chunkTextBuffers) {
    chunkTextBuffer.set(buf, chunkTextOffset);
    chunkTextOffset += buf.length;
  }

  const chunkTextSizeKB = (chunkTextBuffer.byteLength / 1024).toFixed(2);
  console.log(`   ✓ Chunk text: ${chunkTextSizeKB} KB (binary)`);

  // Step 3: Create manifest (metadata only, no chunk text)
  console.log('   Generating manifest');
  const buildHash = computeContentHash(chunks);

  const manifest: ArtifactManifest = {
    version: '1.0.0',
    buildTime: new Date().toISOString(),
    buildHash,
    model: {
      name: 'Xenova/all-MiniLM-L6-v2',
      dimensions: 384,
      normalization: 'l2'
    },
    storage: {
      precision: 'fp16',
      accumulationPrecision: 'float64' // JS accumulation is always float64
    },
    chunks: chunks.map((chunk, idx) => ({
      id: chunk.id,
      parentId: chunk.parentId,
      // text removed - stored separately in chunks.bin
      tokens: chunk.tokens,
      metadata: chunk.metadata,
      embeddingOffset: idx * 384
    })),
    stats: {
      totalChunks: chunks.length,
      totalTokens: chunks.reduce((sum, c) => sum + c.tokens, 0),
      avgTokensPerChunk: chunks.reduce((sum, c) => sum + c.tokens, 0) / chunks.length
    }
  };

  const manifestSizeKB = (JSON.stringify(manifest).length / 1024).toFixed(2);
  console.log(`   ✓ Manifest: ${manifestSizeKB} KB (JSON)`);

  const totalSizeKB = (
    buffer.byteLength +
    chunkTextBuffer.byteLength +
    JSON.stringify(manifest).length
  ) / 1024;
  console.log(`   Total artifacts: ${totalSizeKB.toFixed(2)} KB`);
  console.log(`   Build hash: ${buildHash}\n`);

  return {
    embeddingsBuffer: buffer,
    chunkTextBuffer: chunkTextBuffer.buffer,
    manifest
  };
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  try {
    console.log('🤖 RAG Chatbot Build Pipeline');
    console.log('   Implementation Plan v1.5 (Bulletproof)\n');

    // Phase 1: Content Discovery
    const contentItems = await discoverContent();

    console.log('✓ Phase 1 Complete');
    console.log(`  Total items: ${contentItems.length}\n`);

    // Phase 2: Chunking
    console.log('📝 Phase 2: Chunking');
    const chunks = chunkAll(contentItems);

    console.log(`   Created ${chunks.length} chunks`);
    console.log(`   Tokens: ${chunks.reduce((sum, c) => sum + c.tokens, 0)} total`);
    console.log(`   Average: ${Math.round(chunks.reduce((sum, c) => sum + c.tokens, 0) / chunks.length)} tokens/chunk`);

    console.log('✓ Phase 2 Complete');
    console.log(`  Total chunks: ${chunks.length}\n`);

    // Phase 3: Embedding Generation
    const embeddings = await generateEmbeddings(chunks);

    console.log('✓ Phase 3 Complete');
    console.log(`  Total embeddings: ${embeddings.length}\n`);

    // Phase 4: Serialization
    const artifacts = serializeEmbeddings(embeddings, chunks);

    console.log('✓ Phase 4 Complete');
    console.log(`  Artifacts ready: embeddings.bin, chunks.bin, manifest.json\n`);

    // TODO: Phase 5 - Artifact Upload
    // TODO: Phase 6 - Manifest Generation

  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { discoverContent, type ContentItem };
