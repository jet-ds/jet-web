/**
 * RAG Chatbot Build Pipeline - Phase 1: Content Discovery
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.6
 *
 * This script implements the build-time pipeline for generating
 * embeddings and artifacts for the database-less RAG chatbot.
 *
 * Architecture: Uses filesystem-based content loading (gray-matter)
 * instead of astro:content virtual module for standalone execution.
 */

// Load environment variables from .env.local
import 'dotenv/config';

import { discoverContent, type ContentItem } from './content-loader.js';
import { chunkAll, type Chunk } from '../src/utils/chunking.js';
import { pipeline } from '@huggingface/transformers';
import { setFloat16 } from '@petamoriken/float16';
import { createHash } from 'crypto';
import { put } from '@vercel/blob';
import { writeFile } from 'fs/promises';

// ============================================================================
// Phase 1: Content Discovery - Now handled by content-loader.ts
// ============================================================================
// Content loading moved to filesystem-based approach in content-loader.ts
// because astro:content is a Vite virtual module only available within
// Astro's build context. See scripts/content-loader.ts for implementation.

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
// Phase 5: Artifact Upload
// ============================================================================

/**
 * Artifact configuration written to runtime
 */
interface ArtifactConfig {
  embeddingsUrl: string;
  chunksUrl: string;
  manifestUrl: string;
  version: string;
  buildHash: string;
}

/**
 * Uploads artifacts to Vercel Blob Storage
 *
 * Process (spec lines 448-503):
 * 1. Upload embeddings.bin with build hash in filename
 * 2. Upload chunks.bin with build hash in filename
 * 3. Upload manifest.json with build hash in filename
 * 4. Write URLs to src/config/chatbot-artifacts.json for runtime
 * 5. Set long cache headers (1 year) - immutable files
 *
 * @param artifacts - Serialized artifacts from Phase 4
 * @returns Artifact URLs configuration
 */
async function uploadArtifacts(artifacts: SerializedArtifacts): Promise<ArtifactConfig> {
  console.log('☁️  Phase 5: Artifact Upload');

  const buildHash = artifacts.manifest.buildHash;

  // Check for BLOB_READ_WRITE_TOKEN
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN environment variable is required.\n' +
      'Set it in .env.local for local development or in Vercel project settings.'
    );
  }

  console.log(`   Uploading to Vercel Blob (hash: ${buildHash})`);

  // Upload embeddings.bin
  console.log('   Uploading embeddings.bin...');
  const embeddingsBlob = await put(
    `chatbot/embeddings-${buildHash}.bin`,
    artifacts.embeddingsBuffer,
    {
      access: 'public',
      contentType: 'application/octet-stream',
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000 // 1 year (immutable)
    }
  );
  console.log(`   ✓ Embeddings: ${embeddingsBlob.url}`);

  // Upload chunks.bin
  console.log('   Uploading chunks.bin...');
  const chunksBlob = await put(
    `chatbot/chunks-${buildHash}.bin`,
    artifacts.chunkTextBuffer,
    {
      access: 'public',
      contentType: 'application/octet-stream',
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000
    }
  );
  console.log(`   ✓ Chunks: ${chunksBlob.url}`);

  // Upload manifest.json
  console.log('   Uploading manifest.json...');
  const manifestBlob = await put(
    `chatbot/manifest-${buildHash}.json`,
    JSON.stringify(artifacts.manifest, null, 2),
    {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000
    }
  );
  console.log(`   ✓ Manifest: ${manifestBlob.url}`);

  // Write URLs to local config for runtime
  const config: ArtifactConfig = {
    embeddingsUrl: embeddingsBlob.url,
    chunksUrl: chunksBlob.url,
    manifestUrl: manifestBlob.url,
    version: artifacts.manifest.version,
    buildHash: buildHash
  };

  console.log('   Writing config to src/config/chatbot-artifacts.json...');
  await writeFile(
    'src/config/chatbot-artifacts.json',
    JSON.stringify(config, null, 2) + '\n'
  );
  console.log('   ✓ Config written\n');

  return config;
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

    // Phase 5: Artifact Upload
    const config = await uploadArtifacts(artifacts);

    console.log('✓ Phase 5 Complete');
    console.log(`  Build hash: ${config.buildHash}`);
    console.log(`  Artifacts uploaded to Vercel Blob\n`);

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
