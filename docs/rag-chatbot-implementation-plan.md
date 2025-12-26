# Database-Less RAG Chatbot - Implementation Plan

**Status**: Implementation Ready (Revised)
**Date**: December 2025
**Project**: jet-web (Astro Personal Website)
**Specification Version**: 1.5 (final correction pass - bulletproof)

> **Primary Reference**: This plan implements the architecture defined in `docs/rag-chatbot-architecture.md` with explicit architectural constraints and implementation details.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Build-Time Pipeline](#build-time-pipeline)
3. [Runtime Flow](#runtime-flow)
4. [File Structure](#file-structure)
5. [Component Specifications](#component-specifications)
6. [API Contracts](#api-contracts)
7. [State Management](#state-management)
8. [Precision Discipline](#precision-discipline)
9. [Loading States & UX Narrative](#loading-states--ux-narrative)
10. [Error Handling & Failure Modes](#error-handling--failure-modes)
11. [Cache Invalidation & Versioning](#cache-invalidation--versioning)
12. [Testing Strategy](#testing-strategy)
13. [Implementation Phases](#implementation-phases)

---

## Architecture Overview

### Core Principles

1. **Activation Boundary**: No resource loading until explicit user action
2. **Modal Lifecycle**: Complete resource cleanup on unmount
3. **Precision Discipline**: FP16 storage, FP32 arrays, float64 accumulation (explicit)
4. **Explainability**: Separable retrieval and generation with attribution
5. **Session-Local State**: No cross-session persistence
6. **First-Class Failures**: Explicit error states and degradation paths
7. **Narrative Loading**: Informative, not generic, loading states
8. **Minimal Hybrid Output**: Only API routes are dynamic
9. **Compiled Artifacts**: Versioned, immutable, cache-invalidatable
10. **No Implicit Preloading**: All loading is user-triggered

### System Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│ BUILD TIME (Static)                                         │
│                                                             │
│  MDX Content → Chunk → Embed → Serialize → Vercel Blob     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ PAGE LOAD (Zero Loading)                                    │
│                                                             │
│  /chatbot → Render UI Shell → IDLE (no resources loaded)   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              ↓ USER CLICKS "Start Chat"
┌─────────────────────────────────────────────────────────────┐
│ ACTIVATION (Lazy Loading)                                   │
│                                                             │
│  Load Model → Fetch Artifacts → Initialize Retrieval       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ INTERACTION (Session-Local)                                 │
│                                                             │
│  Query → Retrieve → Generate → Display (with attribution)  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              ↓ MODAL CLOSE / NEW CHAT
┌─────────────────────────────────────────────────────────────┐
│ CLEANUP (Resource Release)                                  │
│                                                             │
│  Clear State → Release Workers → GC Model References       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Build-Time**:
- Node.js script for embedding generation
- `@huggingface/transformers` (Node.js mode)
- `@petamoriken/float16` for FP16 conversion (production-ready IEEE 754)
- `@vercel/blob` SDK for artifact upload
- TypeScript for type safety

**Runtime**:
- React 19 (Astro island, client-only)
- `@huggingface/transformers` (browser mode, lazy-loaded)
- `minisearch` for BM25 (lazy-loaded)
- Web Workers for off-thread processing
- IndexedDB for caching (with fallback)

**Server (Astro Hybrid)**:
- Astro v5 API routes (minimal)
- OpenRouter or Gemini API client
- Rate limiting middleware

---

## Build-Time Pipeline

### Pipeline Overview

```
[1] Content Discovery
     ↓
[2] Chunking
     ↓
[3] Embedding Generation
     ↓
[4] Serialization (FP16)
     ↓
[5] Artifact Upload
     ↓
[6] Manifest Generation
```

### Phase 1: Content Discovery

**Location**: `scripts/build-embeddings.ts`

**Input**: Astro Content Collections
**Output**: Array of `ContentItem[]`

```typescript
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
```

**Process**:
1. Load all collections: `getCollection('blog')`, `getCollection('works')`
2. Filter out drafts: `filter(item => !item.data.draft)`
3. Render to extract body: `await item.render()`
4. Strip MDX components, keep prose
5. Normalize whitespace

**Exclusions**:
- Posts with `draft: true`
- Empty content (after stripping)
- Future-dated posts (optional)

---

### Phase 2: Chunking

**Location**: `src/utils/chunking.ts`

**Strategy**: Semantic chunking by heading boundaries

**Parameters**:
```typescript
const CHUNKING_CONFIG = {
  targetTokens: 256,        // Target chunk size
  maxTokens: 512,           // Hard limit
  minTokens: 64,            // Minimum viable chunk
  overlapTokens: 32,        // Overlap for context continuity
  tokenEstimator: (text: string) => Math.ceil(text.length / 4)
};
```

**Algorithm**:
```typescript
interface Chunk {
  id: string;               // "blog/welcome#intro-0"
  parentId: string;         // "blog/welcome"
  text: string;             // Chunk content
  tokens: number;           // Estimated token count
  metadata: {
    type: 'blog' | 'works';
    title: string;          // Post title
    section?: string;       // Heading if available
    tags: string[];
    url: string;            // Canonical URL to post
    index: number;          // Chunk index in document
  };
}

function chunkDocument(item: ContentItem): Chunk[] {
  const chunks: Chunk[] = [];
  const sections = splitByHeadings(item.content); // h2, h3 boundaries

  for (const section of sections) {
    const sectionChunks = splitByTokenLimit(
      section.content,
      CHUNKING_CONFIG.targetTokens,
      CHUNKING_CONFIG.maxTokens
    );

    for (let i = 0; i < sectionChunks.length; i++) {
      chunks.push({
        id: `${item.id}#${section.heading || 'intro'}-${i}`,
        parentId: item.id,
        text: sectionChunks[i],
        tokens: estimateTokens(sectionChunks[i]),
        metadata: {
          type: item.type,
          title: item.title,
          section: section.heading,
          tags: item.metadata.tags,
          url: `/${item.type}/${item.slug}`,
          index: i
        }
      });
    }
  }

  return chunks;
}
```

**Heading Extraction**:
- Parse markdown headings (`## Heading`, `### Subheading`)
- Use Astro's `headings` array from `render()` output
- Fallback: regex-based extraction

**Overlap Strategy**:
```typescript
function chunkWithOverlap(
  text: string,
  targetTokens: number,
  maxTokens: number,
  overlapTokens: number
): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);

  let currentChunk = '';
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    if (currentTokens + paraTokens > maxTokens) {
      if (currentChunk) chunks.push(currentChunk.trim());

      // Start new chunk with overlap from previous
      const overlapText = getLastNTokens(currentChunk, overlapTokens);
      currentChunk = overlapText + '\n\n' + para;
      currentTokens = estimateTokens(currentChunk);
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
      currentTokens += paraTokens;
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

function getLastNTokens(text: string, n: number): string {
  const words = text.split(/\s+/);
  const estimatedTokens = words.length * 0.75;
  if (estimatedTokens <= n) return text;
  const wordsToKeep = Math.ceil(n / 0.75);
  return words.slice(-wordsToKeep).join(' ');
}
```

**Output**: Array of `Chunk[]` (all documents combined, with 32-token overlap)

---

### Phase 3: Embedding Generation

**Location**: `scripts/build-embeddings.ts`

**Model**: `Xenova/all-MiniLM-L6-v2` (Node.js mode)

**Process**:
```typescript
import { pipeline } from '@huggingface/transformers';

async function generateEmbeddings(chunks: Chunk[]): Promise<EmbeddingResult[]> {
  // Load model (Node.js environment)
  const extractor = await pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2',
    { quantized: true }
  );

  const batchSize = 32;
  const results: EmbeddingResult[] = [];

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

    console.log(`Processed ${i + batch.length}/${chunks.length} chunks`);
  }

  return results;
}
```

**Output Precision**: FP32 (native model output)
**Normalization**: L2-normalized (for cosine similarity via dot product)
**Dimensions**: 384 (all-MiniLM-L6-v2 output size)

---

### Phase 4: Serialization (FP16)

**Location**: `scripts/build-embeddings.ts`

**Precision Conversion**: FP32 → FP16 for storage

**Rationale**:
- 50% size reduction (1.5 KB → 768 B per embedding)
- Acceptable precision loss (2-5% in similarity scores)
- Will convert back to FP32 for accumulation at runtime

**Implementation**:
```typescript
import { setFloat16, getFloat16 } from '@petamoriken/float16';

function serializeEmbeddings(
  embeddings: EmbeddingResult[],
  chunks: Chunk[]
): SerializedArtifacts {
  // Convert FP32 to FP16 using production-ready library
  const buffer = new ArrayBuffer(embeddings.length * 384 * 2);
  const view = new DataView(buffer);

  let offset = 0;
  for (const embedding of embeddings) {
    for (let i = 0; i < 384; i++) {
      setFloat16(view, offset, embedding.embedding[i], true);
      offset += 2;
    }
  }

  // Serialize chunk text to binary (length-prefixed strings)
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

  // Create manifest (metadata only, no chunk text)
  const manifest: ArtifactManifest = {
    version: '1.0.0',
    buildTime: new Date().toISOString(),
    buildHash: computeContentHash(chunks),
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

  return {
    embeddingsBuffer: buffer,
    manifest,
    chunkTextBuffer: chunkTextBuffer.buffer // Binary chunk text storage
  };
}
```

**Artifacts**:
1. `embeddings.bin` (binary FP16 ArrayBuffer, ~768 B per embedding)
2. `manifest.json` (JSON metadata only, ~50 KB)
3. `chunks.bin` (binary chunk text, length-prefixed strings, ~300 KB)

---

### Phase 5: Artifact Upload

**Location**: `scripts/build-embeddings.ts`

**Destination**: Vercel Blob Storage

**Process**:
```typescript
import { put } from '@vercel/blob';

async function uploadArtifacts(artifacts: SerializedArtifacts) {
  const buildHash = artifacts.manifest.buildHash;

  // CORRECTED: Include build hash in filenames for automatic cache invalidation
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

  // Write URLs to local config for runtime
  const config = {
    embeddingsUrl: embeddingsBlob.url,
    chunksUrl: chunksBlob.url,
    manifestUrl: manifestBlob.url,
    version: artifacts.manifest.version,
    buildHash: buildHash
  };

  await writeFile(
    'src/config/chatbot-artifacts.json',
    JSON.stringify(config, null, 2)
  );

  console.log('✓ Embeddings uploaded:', embeddingsBlob.url);
  console.log('✓ Chunks uploaded:', chunksBlob.url);
  console.log('✓ Manifest uploaded:', manifestBlob.url);
  console.log('✓ Build hash:', buildHash);
}
```

**Cache Strategy** (CORRECTED):
- Long cache headers (1 year)
- Cache invalidation via build hash in URLs (not manifest fetch)
- When content changes → build hash changes → URLs change → automatic invalidation

**Environment**:
- `BLOB_READ_WRITE_TOKEN` required (set in `.env.local` and Vercel)

---

### Phase 6: Manifest Generation

**Schema**:
```typescript
interface ArtifactManifest {
  version: string;           // "1.0.0" (semantic versioning)
  buildTime: string;         // ISO timestamp
  buildHash: string;         // Content hash for cache invalidation

  model: {
    name: string;            // "Xenova/all-MiniLM-L6-v2"
    dimensions: number;      // 384
    normalization: 'l2';     // Always L2 for this system
  };

  storage: {
    precision: 'fp16';                   // Embedding storage format
    accumulationPrecision: 'float64';    // Similarity computation precision (JS default)
  };

  chunks: ManifestChunk[];

  stats: {
    totalChunks: number;
    totalTokens: number;
    avgTokensPerChunk: number;
  };
}

interface ManifestChunk {
  id: string;                // "blog/welcome#intro-0"
  parentId: string;          // "blog/welcome"
  // text removed - stored separately in chunks.bin (binary format)
  tokens: number;            // Estimated token count
  metadata: {
    type: 'blog' | 'works';
    title: string;           // Post title
    section?: string;        // Heading
    tags: string[];
    url: string;             // Canonical URL
    index: number;           // Chunk index
  };
  embeddingOffset: number;   // Offset in embeddings.bin (in FP16 values, also serves as chunk index × 384)
}

// Chunk text storage (binary format, parsed to array)
type ChunkTextArray = string[]; // Array of chunk texts, indexed by position
```

**Build Hash Computation**:
```typescript
import { createHash } from 'crypto';

function computeContentHash(chunks: Chunk[]): string {
  // Hash based on chunk IDs and text (not embeddings)
  // Ensures cache invalidation when content changes
  const content = chunks
    .map(c => `${c.id}:${c.text}`)
    .join('|');

  return createHash('sha256')
    .update(content)
    .digest('hex')
    .slice(0, 16); // First 16 chars sufficient
}
```

---

### Build Script Integration

**Location**: `package.json`

```json
{
  "scripts": {
    "build:embeddings": "tsx scripts/build-embeddings.ts",
    "build:site": "astro build",
    "build": "npm run build:embeddings && npm run build:site",
    "dev": "astro dev",
    "dev:embeddings": "tsx scripts/build-embeddings.ts && astro dev"
  }
}
```

**CI/CD (Vercel)**:
```bash
# vercel build command
npm run build

# Requires environment variable:
# BLOB_READ_WRITE_TOKEN=<vercel-blob-token>
```

---

## Runtime Flow

### Lifecycle States

```typescript
type ChatbotState =
  | 'uninitialized'    // Page loaded, no resources
  | 'initializing'     // User clicked "Start", loading resources
  | 'ready'            // Model + artifacts loaded, ready for queries
  | 'retrieving'       // Processing query, searching chunks
  | 'generating'       // Sending context to LLM
  | 'streaming'        // Receiving LLM response
  | 'error'            // Fatal error (with specific error type)
  | 'cleaned-up';      // Modal closed, resources released
```

### State Transitions

```
uninitialized
    ↓ [User clicks "Start Chat"]
initializing (loading model, artifacts, worker)
    ↓ [Success]
ready
    ↓ [User sends query]
retrieving (embed query, search chunks)
    ↓ [Chunks retrieved]
generating (send to API)
    ↓ [API responds]
streaming (display tokens)
    ↓ [Complete]
ready (ready for next query)
    ↓ [User clicks "New Chat"]
ready (clear messages, keep model loaded)
    ↓ [User closes modal]
cleaned-up (release all resources)
```

### Phase 1: Uninitialized (Page Load)

**State**: `uninitialized`

**What Happens**:
- Page renders with chatbot UI shell
- No network requests
- No IndexedDB access
- No worker initialization
- No model loading

**UI**:
```tsx
<ChatbotModal>
  <WelcomeScreen>
    <h2>Chat with my blog content</h2>
    <p>Ask questions about posts, research, and projects</p>
    <button onClick={handleStartChat}>
      Start Chat
    </button>
  </WelcomeScreen>
</ChatbotModal>
```

**Invariant**: Navigation to `/chatbot` or opening modal must not trigger any resource loading.

---

### Phase 2: Initialization (User Activation)

**State**: `initializing`

**Trigger**: User clicks "Start Chat" button

**Substates** (sequential):
```typescript
type InitializationSubstate =
  | 'checking-cache'      // Check IndexedDB for cached resources
  | 'loading-model'       // Download/load embedding model
  | 'fetching-artifacts'  // Fetch embeddings.bin + manifest.json
  | 'initializing-search' // Set up MiniSearch index
  | 'spawning-worker'     // Initialize Web Worker
  | 'complete';           // Ready for queries
```

**Detailed Flow**:

```typescript
async function initializeChatbot(
  onProgress: (substate: InitializationSubstate, progress: number) => void
): Promise<void> {
  try {
    // 1. Check cache
    onProgress('checking-cache', 0);
    const cache = await checkCache();

    // 2. Load model
    onProgress('loading-model', 10);
    const model = await loadModel(cache?.model);

    // 3. Fetch artifacts
    onProgress('fetching-artifacts', 40);
    const artifacts = await fetchArtifacts(cache?.artifacts);

    // 4. Initialize search
    onProgress('initializing-search', 70);
    const searchIndex = await initializeSearch(artifacts.manifest, artifacts.chunks);

    // 5. Spawn worker
    onProgress('spawning-worker', 90);
    const worker = await spawnWorker(artifacts.embeddings, artifacts.manifest);

    onProgress('complete', 100);

    // Store in state manager
    setChatbotResources({ model, artifacts, searchIndex, worker });

  } catch (error) {
    handleInitializationError(error);
  }
}
```

**Sub-Phase 2.1: Check Cache**

```typescript
interface CachedResources {
  model: {
    timestamp: number;
    available: boolean;
  };
  artifacts: {
    buildHash: string;
    timestamp: number;
    embeddings: ArrayBuffer;
    manifest: ArtifactManifest;
    chunks: string[]; // REQUIRED: chunks accessed at runtime
  } | null;
}

// CORRECTED: Use IndexedDB with proper schema definition
import { openDB, IDBPDatabase } from 'idb';
import artifactConfig from '@/config/chatbot-artifacts.json';

interface ChatbotDB {
  artifacts: {
    key: string;
    value: {
      buildHash: string;
      timestamp: number;
      embeddings: ArrayBuffer;
      manifest: ArtifactManifest;
      chunks: string[]; // Binary chunks parsed to array
    };
  };
}

async function getCacheDB(): Promise<IDBPDatabase<ChatbotDB>> {
  return openDB<ChatbotDB>('chatbot-cache', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('artifacts')) {
        db.createObjectStore('artifacts');
      }
    }
  });
}

async function checkCache(): Promise<CachedResources | null> {
  if (!('indexedDB' in window)) return null;

  try {
    const db = await getCacheDB();
    const cachedArtifacts = await db.get('artifacts', 'current');

    if (cachedArtifacts) {
      // CORRECTED: Compare build hash from bundled config (no network request)
      if (cachedArtifacts.buildHash === artifactConfig.buildHash) {
        return {
          model: { timestamp: Date.now(), available: true },
          artifacts: cachedArtifacts
        };
      }
      // Hash mismatch: cache invalidated
      console.log('Cache invalidated: build hash mismatch');
    }

    return null;
  } catch (error) {
    console.warn('IndexedDB unavailable, will fetch fresh:', error);
    return null;
  }
}
```

**Sub-Phase 2.2: Load Model**

```typescript
async function loadModel(cachedModel?: CachedResources['model']) {
  const { pipeline } = await import('@huggingface/transformers');

  // Transformers.js handles IndexedDB caching internally
  const extractor = await pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2',
    {
      quantized: true,
      // Will use cache if available
      progress_callback: (progress) => {
        // Report download progress
        emitProgress('loading-model', progress.progress * 100);
      }
    }
  );

  return extractor;
}
```

**Sub-Phase 2.3: Fetch Artifacts**

```typescript
async function fetchArtifacts(cachedArtifacts?: CachedResources['artifacts']) {
  // Use cache if valid
  if (cachedArtifacts) {
    return {
      embeddings: cachedArtifacts.embeddings,
      manifest: cachedArtifacts.manifest,
      chunks: cachedArtifacts.chunks
    };
  }

  // Fetch fresh (binary chunks)
  const [embeddingsResponse, manifestResponse, chunksResponse] = await Promise.all([
    fetch(ARTIFACT_CONFIG.embeddingsUrl),
    fetch(ARTIFACT_CONFIG.manifestUrl),
    fetch(ARTIFACT_CONFIG.chunksUrl)
  ]);

  if (!embeddingsResponse.ok || !manifestResponse.ok || !chunksResponse.ok) {
    throw new Error('Failed to fetch artifacts');
  }

  const embeddings = await embeddingsResponse.arrayBuffer();
  const manifest: ArtifactManifest = await manifestResponse.json();
  const chunksBuffer = await chunksResponse.arrayBuffer();

  // Parse binary chunk text (length-prefixed strings)
  const chunks = parseChunkTextBuffer(chunksBuffer, manifest.chunks.length);

  // Cache in IndexedDB if available
  try {
    const db = await getCacheDB();
    await db.put('artifacts', {
      buildHash: manifest.buildHash,
      timestamp: Date.now(),
      embeddings,
      manifest,
      chunks
    }, 'current');
  } catch (error) {
    console.warn('Could not cache artifacts:', error);
  }

  return { embeddings, manifest, chunks };
}

function parseChunkTextBuffer(buffer: ArrayBuffer, numChunks: number): string[] {
  const view = new DataView(buffer);
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let offset = 0;

  for (let i = 0; i < numChunks; i++) {
    // Read 4-byte length prefix
    const length = view.getUint32(offset, true);
    offset += 4;

    // Read UTF-8 text
    const textBytes = new Uint8Array(buffer, offset, length);
    const text = decoder.decode(textBytes);
    chunks.push(text);
    offset += length;
  }

  return chunks;
}
```

**Sub-Phase 2.4: Initialize Search**

```typescript
// CORRECTED: Async batching to prevent main thread blocking + binary chunks
async function initializeSearch(
  manifest: ArtifactManifest,
  chunks: string[]
): Promise<MiniSearch> {
  const MiniSearch = (await import('minisearch')).default;

  const searchIndex = new MiniSearch({
    fields: ['text', 'title', 'section'],
    storeFields: ['id', 'title', 'section', 'url'],
    searchOptions: {
      boost: { title: 3, section: 2, text: 1 },
      fuzzy: 0.2,
      prefix: true
    }
  });

  // Add chunks in batches to prevent UI blocking
  const batchSize = 50;

  for (let i = 0; i < manifest.chunks.length; i += batchSize) {
    const batch = manifest.chunks.slice(i, i + batchSize).map((meta, idx) => ({
      id: meta.id,
      text: chunks[i + idx], // Get text from binary chunks array (indexed by position)
      title: meta.metadata.title,
      section: meta.metadata.section || '',
      url: meta.metadata.url
    }));

    searchIndex.addAll(batch);

    // Yield to event loop every batch
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return searchIndex;
}
```

**Sub-Phase 2.5: Spawn Worker**

```typescript
async function spawnWorker(
  embeddings: ArrayBuffer,
  manifest: ArtifactManifest
): Promise<Worker> {
  const worker = new Worker(
    new URL('../workers/retrieval.worker.ts', import.meta.url),
    { type: 'module' }
  );

  // CORRECTED: Clone buffer before transfer (enables re-initialization)
  const embeddingsClone = embeddings.slice(0);

  worker.postMessage({
    type: 'init',
    embeddings: embeddingsClone,
    manifest: manifest
  }, [embeddingsClone]); // Transfer the clone

  // Wait for worker ready signal
  await new Promise((resolve) => {
    worker.addEventListener('message', (e) => {
      if (e.data.type === 'ready') resolve(null);
    }, { once: true });
  });

  return worker;
}
```

**Failure Handling**:
- If IndexedDB unavailable: Continue without caching
- If model load fails: Show error, offer retry
- If artifact fetch fails: Check offline, offer retry
- If worker spawn fails: Fallback to main thread (with warning)

---

### Phase 3: Ready State

**State**: `ready`

**UI**:
```tsx
<ChatInterface>
  <MessageList messages={messages} />
  <InputBar
    onSend={handleSendMessage}
    disabled={state !== 'ready'}
    placeholder="Ask about blog content..."
  />
  <ActionBar>
    <button onClick={handleNewChat}>New Chat</button>
  </ActionBar>
</ChatInterface>
```

**Allowed Actions**:
- User can type query
- User can click "New Chat" (clears messages, stays in ready state)
- User can close modal (transitions to cleaned-up state)

---

### Phase 4: Retrieval

**State**: `retrieving`

**Trigger**: User sends message

**Flow**:

```typescript
async function handleSendMessage(query: string) {
  setState('retrieving');

  try {
    // 1. Embed query (on main thread, ~15-250ms)
    const queryEmbedding = await embedQuery(query);

    // 2. Send to worker for similarity search
    const semanticResults = await searchSemantic(queryEmbedding);

    // 3. BM25 search (main thread, <10ms)
    const bm25Results = searchIndex.search(query, { limit: 50 });

    // 4. Fuse with RRF
    const fusedResults = reciprocalRankFusion(
      semanticResults,
      bm25Results,
      artifacts.manifest,
      artifacts.chunks,
      { semantic: 0.6, bm25: 0.4 }
    );

    // 5. CORRECTED: Select top-K within token budget
    const topK = selectTopKWithinBudget(fusedResults, artifacts.chunks, 2000);

    // 6. Prepare context (resolve chunk text by index)
    const context = topK.map(result => {
      // Chunk index is derived from embeddingOffset (offset / 384)
      const chunkIndex = result.chunk.embeddingOffset / 384;
      return {
        text: artifacts.chunks[chunkIndex],
        title: result.chunk.metadata.title,
        url: result.chunk.metadata.url,
        score: result.score
      };
    });

    setState('generating');
    return context;

  } catch (error) {
    handleRetrievalError(error);
  }
}
```

**Embed Query** (main thread):

```typescript
async function embedQuery(query: string): Promise<Float32Array> {
  const embedding = await model(query, {
    pooling: 'mean',
    normalize: true
  });

  // Extract as Float32Array
  return new Float32Array(embedding.data.slice(0, 384));
}
```

**Search Semantic** (worker with promise wrapper):

```typescript
// Main thread: Promise wrapper for worker communication
let messageId = 0;

async function searchSemantic(queryEmbedding: Float32Array): Promise<SearchResult[]> {
  return new Promise((resolve, reject) => {
    const id = messageId++;
    const timeout = setTimeout(() => {
      reject(new Error('Worker search timeout'));
    }, 5000);

    const messageHandler = (e: MessageEvent) => {
      if (e.data.type === 'search-results' && e.data.id === id) {
        clearTimeout(timeout);
        worker.removeEventListener('message', messageHandler);
        resolve(e.data.results);
      }
    };

    worker.addEventListener('message', messageHandler);
    // CRITICAL: Do NOT transfer query embedding (small buffer, may be needed on main thread)
    worker.postMessage({
      type: 'search',
      id,
      queryEmbedding: queryEmbedding.buffer
    }); // No transferable list - copy instead of transfer
  });
}

// In retrieval.worker.ts
import { getFloat16 } from '@petamoriken/float16';

let embeddingsFp32: Float32Array;
let manifest: ArtifactManifest;

self.addEventListener('message', (e) => {
  if (e.data.type === 'init') {
    const fp16Buffer = new Uint16Array(e.data.embeddings);
    manifest = e.data.manifest;

    // CORRECTED: Convert FP16→FP32 once during initialization
    embeddingsFp32 = new Float32Array(fp16Buffer.length);
    const view = new DataView(fp16Buffer.buffer);

    for (let i = 0; i < fp16Buffer.length; i++) {
      embeddingsFp32[i] = getFloat16(view, i * 2, true);
    }

    self.postMessage({ type: 'ready' });
  }
  else if (e.data.type === 'search') {
    const { id, queryEmbedding } = e.data;
    const query = new Float32Array(queryEmbedding);

    const results = [];
    const numChunks = embeddingsFp32.length / 384;

    // Use pre-converted FP32 embeddings
    for (let i = 0; i < numChunks; i++) {
      const chunkEmbedding = embeddingsFp32.subarray(i * 384, (i + 1) * 384);
      const similarity = dotProduct(query, chunkEmbedding);

      // Resolve chunk metadata from manifest
      const chunkMeta = manifest.chunks[i];
      results.push({
        chunkId: chunkMeta.id,
        score: similarity,
        chunk: chunkMeta
      });
    }

    results.sort((a, b) => b.score - a.score);

    self.postMessage({
      type: 'search-results',
      id,
      results: results.slice(0, 50)
    });
  }
});

function dotProduct(a: Float32Array, b: Float32Array): number {
  let sum = 0; // float64 accumulator (FP32 array values promoted to float64)
  for (let i = 0; i < 384; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}
```

**Reciprocal Rank Fusion** (CORRECTED: unions candidates):

```typescript
function reciprocalRankFusion(
  semanticResults: SearchResult[],
  bm25Results: BM25Result[],
  manifest: ArtifactManifest,
  chunks: string[],
  weights: { semantic: number; bm25: number } = { semantic: 0.6, bm25: 0.4 },
  k: number = 60
): FusedResult[] {
  // Pre-build chunk lookup map for O(1) access
  const chunkMap = new Map(manifest.chunks.map(c => [c.id, c]));
  const scoreMap = new Map<string, { score: number; chunk: ManifestChunk }>();

  // Semantic contribution
  semanticResults.forEach((result, rank) => {
    const rrfScore = (1 / (k + rank + 1)) * weights.semantic;
    scoreMap.set(result.chunkId, {
      score: rrfScore,
      chunk: result.chunk
    });
  });

  // BM25 contribution (CORRECTED: must union, not just add to existing)
  bm25Results.forEach((result, rank) => {
    const rrfScore = (1 / (k + rank + 1)) * weights.bm25;
    const existing = scoreMap.get(result.id);

    if (existing) {
      // Chunk in both: add BM25 score
      existing.score += rrfScore;
    } else {
      // Chunk only in BM25: add with BM25 score only
      const chunkMeta = chunkMap.get(result.id);
      if (chunkMeta) {
        scoreMap.set(result.id, {
          score: rrfScore,
          chunk: chunkMeta
        });
      }
    }
  });

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score);
}

// CORRECTED: Token budget enforcement
function selectTopKWithinBudget(
  fusedResults: FusedResult[],
  chunks: string[],
  maxTokens: number = 2000,
  minChunks: number = 3
): FusedResult[] {
  const selected: FusedResult[] = [];
  let totalTokens = 0;

  for (const result of fusedResults) {
    const chunkTokens = result.chunk.tokens;

    if (selected.length >= minChunks && totalTokens + chunkTokens > maxTokens) {
      break; // Budget exhausted
    }

    selected.push(result);
    totalTokens += chunkTokens;
  }

  return selected;
}
```

---

### Phase 5: Generation

**State**: `generating`

**Flow**:

```typescript
async function generateResponse(query: string, context: RetrievedChunk[]) {
  setState('generating');

  // Prepare context with attribution
  const contextText = context
    .map((chunk, idx) => `[${idx + 1}] ${chunk.text}\nSource: ${chunk.title} (${chunk.url})`)
    .join('\n\n');

  // Call API
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      context: contextText,
      sources: context.map(c => ({ title: c.title, url: c.url }))
    })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  setState('streaming');
  return response.body; // ReadableStream
}
```

---

### Phase 6: Streaming

**State**: `streaming`

**Flow**:

```typescript
async function streamResponse(stream: ReadableStream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  let assistantMessage = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      assistantMessage += chunk;

      // Update UI incrementally
      updateMessage(assistantMessage);
    }

    setState('ready');

  } catch (error) {
    handleStreamError(error);
  }
}
```

**UI Updates**:
- Typewriter effect (character-by-character reveal)
- Show sources panel alongside response
- Highlight cited chunks

---

### Phase 7: Cleanup

**State**: `cleaned-up`

**Trigger**:
- User closes modal
- User navigates away from chatbot page

**Cleanup Actions**:

```typescript
function cleanupChatbot() {
  // 1. Terminate worker
  if (worker) {
    worker.terminate();
    worker = null;
  }

  // 2. Release model reference (GC eligible)
  model = null;

  // 3. Clear in-memory artifacts
  artifacts = null;
  searchIndex = null;

  // 4. Clear messages
  messages = [];

  // 5. Remove event listeners
  removeAllEventListeners();

  // 6. Reset state
  setState('uninitialized');

  // Note: IndexedDB cache persists (intentional)
}

// React cleanup
useEffect(() => {
  return () => {
    cleanupChatbot();
  };
}, []);
```

**Invariant**: After cleanup, memory footprint should return to baseline (no model, no embeddings in RAM).

---

## File Structure

```
/
├── scripts/
│   ├── build-embeddings.ts              # Build-time embedding generation
│   └── utils/
│       ├── chunking.ts                  # Chunking logic
│       ├── fp16.ts                      # FP16 conversion utilities
│       └── hash.ts                      # Content hashing
│
├── src/
│   ├── components/
│   │   └── chatbot/
│   │       ├── Chatbot.tsx              # Main chatbot island (React)
│   │       ├── ChatInterface.tsx        # Ready-state UI
│   │       ├── WelcomeScreen.tsx        # Uninitialized UI
│   │       ├── LoadingScreen.tsx        # Initialization UI
│   │       ├── MessageList.tsx          # Message display
│   │       ├── MessageItem.tsx          # Individual message
│   │       ├── InputBar.tsx             # Query input
│   │       ├── SourcesPanel.tsx         # Retrieved chunk attribution
│   │       ├── ErrorScreen.tsx          # Error states
│   │       └── ActionBar.tsx            # New Chat, etc.
│   │
│   ├── workers/
│   │   └── retrieval.worker.ts          # Web Worker for similarity search
│   │
│   ├── services/
│   │   ├── chatbot/
│   │   │   ├── initialization.ts        # Initialization orchestration
│   │   │   ├── retrieval.ts             # Retrieval logic
│   │   │   ├── generation.ts            # LLM API calls
│   │   │   ├── cache.ts                 # IndexedDB caching
│   │   │   ├── rrf.ts                   # Reciprocal Rank Fusion
│   │   │   └── cleanup.ts               # Resource cleanup
│   │   └── embeddings/
│   │       ├── model.ts                 # Model loading wrapper
│   │       └── inference.ts             # Query embedding
│   │
│   ├── stores/
│   │   └── chatbot.ts                   # State management (Zustand/Jotai)
│   │
│   ├── hooks/
│   │   ├── useChatbot.ts                # Main chatbot hook
│   │   ├── useChatbotInitialization.ts  # Initialization logic
│   │   ├── useChatbotRetrieval.ts       # Retrieval logic
│   │   └── useChatbotGeneration.ts      # Generation logic
│   │
│   ├── pages/
│   │   ├── chatbot.astro                # Chatbot page (optional)
│   │   └── api/
│   │       └── chat.ts                  # LLM API route (hybrid output)
│   │
│   ├── config/
│   │   └── chatbot-artifacts.json       # Generated artifact URLs (from build)
│   │
│   └── types/
│       └── chatbot.ts                   # TypeScript types
│
├── public/
│   └── (no chatbot assets, all on Vercel Blob)
│
├── docs/
│   ├── rag-chatbot-architecture.md      # Architecture research
│   └── rag-chatbot-implementation-plan.md # This document
│
├── .env.local
│   # BLOB_READ_WRITE_TOKEN=...
│   # OPENROUTER_API_KEY=...
│
├── package.json
│   # Scripts: build:embeddings, build
│
└── astro.config.mjs
    # output: 'hybrid' (for API routes)
```

---

## Component Specifications

### Chatbot.tsx (Main Island)

**Location**: `src/components/chatbot/Chatbot.tsx`

**Responsibility**: Top-level orchestration and state management

```tsx
import { useState, useEffect } from 'react';
import { WelcomeScreen } from './WelcomeScreen';
import { LoadingScreen } from './LoadingScreen';
import { ChatInterface } from './ChatInterface';
import { ErrorScreen } from './ErrorScreen';
import { useChatbot } from '@/hooks/useChatbot';

export interface ChatbotProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Chatbot({ isOpen, onClose }: ChatbotProps) {
  const {
    state,
    initSubstate,
    initProgress,
    messages,
    error,
    initialize,
    sendMessage,
    newChat,
    cleanup
  } = useChatbot();

  // Cleanup on unmount or close
  useEffect(() => {
    if (!isOpen && state !== 'uninitialized') {
      cleanup();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => cleanup();
  }, []);

  const handleStartChat = async () => {
    try {
      await initialize();
    } catch (err) {
      // Error handled by hook
    }
  };

  return (
    <div className="chatbot-container">
      {state === 'uninitialized' && (
        <WelcomeScreen onStart={handleStartChat} />
      )}

      {state === 'initializing' && (
        <LoadingScreen
          substate={initSubstate}
          progress={initProgress}
        />
      )}

      {(['ready', 'retrieving', 'generating', 'streaming'] as const).includes(state) && (
        <ChatInterface
          messages={messages}
          state={state}
          onSendMessage={sendMessage}
          onNewChat={newChat}
          onClose={onClose}
        />
      )}

      {state === 'error' && (
        <ErrorScreen
          error={error}
          onRetry={handleStartChat}
          onClose={onClose}
        />
      )}
    </div>
  );
}
```

---

### LoadingScreen.tsx

**Location**: `src/components/chatbot/LoadingScreen.tsx`

**Responsibility**: Narrative loading UI

```tsx
import type { InitializationSubstate } from '@/types/chatbot';

interface LoadingScreenProps {
  substate: InitializationSubstate;
  progress: number;
}

const LOADING_MESSAGES: Record<InitializationSubstate, string> = {
  'checking-cache': 'Checking local cache...',
  'loading-model': 'Loading AI model (23 MB, one-time download)...',
  'fetching-artifacts': 'Fetching blog embeddings...',
  'initializing-search': 'Preparing search index...',
  'spawning-worker': 'Initializing background workers...',
  'complete': 'Ready!'
};

export function LoadingScreen({ substate, progress }: LoadingScreenProps) {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="spinner" />
        <h3>{LOADING_MESSAGES[substate]}</h3>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="progress-text">{Math.round(progress)}%</p>

        {substate === 'loading-model' && (
          <p className="loading-hint">
            This may take 30-60 seconds on first load. Subsequent loads will be instant.
          </p>
        )}
      </div>
    </div>
  );
}
```

---

### ChatInterface.tsx

**Location**: `src/components/chatbot/ChatInterface.tsx`

**Responsibility**: Main chat UI

```tsx
import { MessageList } from './MessageList';
import { InputBar } from './InputBar';
import { ActionBar } from './ActionBar';
import { SourcesPanel } from './SourcesPanel';
import type { Message, ChatbotState } from '@/types/chatbot';

interface ChatInterfaceProps {
  messages: Message[];
  state: ChatbotState;
  onSendMessage: (query: string) => Promise<void>;
  onNewChat: () => void;
  onClose: () => void;
}

export function ChatInterface({
  messages,
  state,
  onSendMessage,
  onNewChat,
  onClose
}: ChatInterfaceProps) {
  const lastMessage = messages[messages.length - 1];
  const showSources = lastMessage?.type === 'assistant' && lastMessage.sources;

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <h2>Chat with Blog Content</h2>
        <button onClick={onClose} className="close-button">×</button>
      </div>

      <div className="chat-body">
        <MessageList messages={messages} />

        {showSources && (
          <SourcesPanel sources={lastMessage.sources} />
        )}
      </div>

      <div className="chat-footer">
        <InputBar
          onSend={onSendMessage}
          disabled={state !== 'ready'}
          placeholder={
            state === 'retrieving' ? 'Searching...' :
            state === 'generating' ? 'Generating response...' :
            'Ask about blog content...'
          }
        />
        <ActionBar onNewChat={onNewChat} />
      </div>
    </div>
  );
}
```

---

### SourcesPanel.tsx

**Location**: `src/components/chatbot/SourcesPanel.tsx`

**Responsibility**: Display attributed sources

```tsx
interface Source {
  title: string;
  url: string;
  score: number;
}

interface SourcesPanelProps {
  sources: Source[];
}

export function SourcesPanel({ sources }: SourcesPanelProps) {
  return (
    <aside className="sources-panel">
      <h3>Sources</h3>
      <ul>
        {sources.map((source, idx) => (
          <li key={idx}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.title}
            </a>
            <span className="source-score">
              {(source.score * 100).toFixed(0)}% relevance
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
```

---

### useChatbot.ts (Main Hook)

**Location**: `src/hooks/useChatbot.ts`

**Responsibility**: State orchestration

```tsx
import { useState, useCallback } from 'react';
import type { ChatbotState, InitializationSubstate, Message } from '@/types/chatbot';
import { initializeChatbot } from '@/services/chatbot/initialization';
import { retrieveAndGenerate } from '@/services/chatbot/retrieval';
import { cleanup as cleanupResources } from '@/services/chatbot/cleanup';

export function useChatbot() {
  const [state, setState] = useState<ChatbotState>('uninitialized');
  const [initSubstate, setInitSubstate] = useState<InitializationSubstate>('checking-cache');
  const [initProgress, setInitProgress] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const initialize = useCallback(async () => {
    setState('initializing');
    setError(null);

    try {
      await initializeChatbot((substate, progress) => {
        setInitSubstate(substate);
        setInitProgress(progress);
      });

      setState('ready');
    } catch (err) {
      setError(err as Error);
      setState('error');
      throw err;
    }
  }, []);

  const sendMessage = useCallback(async (query: string) => {
    if (state !== 'ready') return;

    // Add user message
    setMessages(prev => [...prev, { type: 'user', content: query }]);

    try {
      setState('retrieving');

      // Retrieve and generate
      const { response, sources } = await retrieveAndGenerate(query, {
        onStateChange: setState,
        onStreamChunk: (chunk) => {
          setMessages(prev => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage?.type === 'assistant') {
              return [
                ...prev.slice(0, -1),
                { ...lastMessage, content: lastMessage.content + chunk }
              ];
            } else {
              return [...prev, { type: 'assistant', content: chunk, sources }];
            }
          });
        }
      });

      setState('ready');

    } catch (err) {
      setError(err as Error);
      setState('error');
    }
  }, [state]);

  const newChat = useCallback(() => {
    setMessages([]);
    setState('ready');
  }, []);

  const cleanup = useCallback(() => {
    cleanupResources();
    setMessages([]);
    setState('uninitialized');
  }, []);

  return {
    state,
    initSubstate,
    initProgress,
    messages,
    error,
    initialize,
    sendMessage,
    newChat,
    cleanup
  };
}
```

---

## API Contracts

### POST /api/chat

**Location**: `src/pages/api/chat.ts`

**Input**:
```typescript
interface ChatRequest {
  query: string;
  context: string;  // Pre-formatted context with attribution
  sources: Array<{
    title: string;
    url: string;
  }>;
}
```

**Output**: Server-Sent Events (SSE) stream

**Implementation**:
```typescript
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { query, context, sources } = await request.json();

    // Validate input
    if (!query || !context) {
      return new Response('Missing query or context', { status: 400 });
    }

    // Rate limiting (simple IP-based)
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (await isRateLimited(ip)) {
      return new Response('Rate limit exceeded', { status: 429 });
    }

    // Call LLM API
    const stream = await generateResponse(query, context);

    // Stream response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return new Response('Internal server error', { status: 500 });
  }
};

// CORRECTED: Parse OpenRouter SSE format (not raw stream)
async function generateResponse(query: string, context: string): Promise<ReadableStream> {
  const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-8b-instruct',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that answers questions based on blog content.

CRITICAL INSTRUCTIONS:
- Answer ONLY based on the provided context
- If the context doesn't contain the answer, say "I don't have information about that in the blog content"
- Cite sources using the format [Source Title](URL) when relevant
- Be concise and accurate
- Do not make up information`
        },
        {
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${query}`
        }
      ],
      stream: true,
      max_tokens: 500,
      temperature: 0.7
    })
  });

  if (!openrouterResponse.ok) {
    throw new Error(`OpenRouter API error: ${openrouterResponse.status}`);
  }

  // Transform SSE to plain text chunks
  const reader = openrouterResponse.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();

              if (data === '[DONE]') {
                controller.close();
                return;
              }

              try {
                const json = JSON.parse(data);
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(new TextEncoder().encode(content));
                }
              } catch (e) {
                // Ignore malformed JSON
              }
            }
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });
}

// BEST-EFFORT in-memory rate limiting
// WARNING: Not effective in serverless (Vercel) - each invocation is isolated
// For production: use external rate limiting (Vercel KV, Upstash, or middleware)
const rateLimitMap = new Map<string, number[]>();

async function isRateLimited(ip: string): Promise<boolean> {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];

  // Remove timestamps older than 1 minute
  const recentTimestamps = timestamps.filter(t => now - t < 60000);

  if (recentTimestamps.length >= 10) {
    return true; // Max 10 requests per minute (within single serverless instance)
  }

  recentTimestamps.push(now);
  rateLimitMap.set(ip, recentTimestamps);

  return false;
}
```

---

## State Management

### Store Schema

**Location**: `src/stores/chatbot.ts`

**Implementation**: Zustand (lightweight, no context needed)

```typescript
import { create } from 'zustand';
import type { ChatbotState, Message } from '@/types/chatbot';

interface ChatbotStore {
  // State
  state: ChatbotState;
  messages: Message[];
  error: Error | null;

  // Resources
  model: any | null;
  artifacts: {
    embeddings: ArrayBuffer;
    manifest: ArtifactManifest;
    chunks: string[]; // REQUIRED: chunks accessed at runtime
  } | null;
  searchIndex: any | null;
  worker: Worker | null;

  // Actions
  setState: (state: ChatbotState) => void;
  setError: (error: Error | null) => void;
  addMessage: (message: Message) => void;
  updateLastMessage: (content: string) => void;
  clearMessages: () => void;

  setResources: (resources: {
    model: any;
    artifacts: any;
    searchIndex: any;
    worker: Worker;
  }) => void;

  cleanup: () => void;
}

export const useChatbotStore = create<ChatbotStore>((set, get) => ({
  // Initial state
  state: 'uninitialized',
  messages: [],
  error: null,
  model: null,
  artifacts: null,
  searchIndex: null,
  worker: null,

  // Actions
  setState: (state) => set({ state }),
  setError: (error) => set({ error }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),

  updateLastMessage: (content) => set((state) => {
    const messages = [...state.messages];
    const lastMessage = messages[messages.length - 1];
    if (lastMessage) {
      lastMessage.content = content;
    }
    return { messages };
  }),

  clearMessages: () => set({ messages: [] }),

  setResources: (resources) => set(resources),

  cleanup: () => {
    const { worker } = get();
    if (worker) {
      worker.terminate();
    }
    set({
      state: 'uninitialized',
      messages: [],
      error: null,
      model: null,
      artifacts: null,
      searchIndex: null,
      worker: null
    });
  }
}));
```

---

## Precision Discipline

### Explicit Precision Boundaries

**Storage Precision**: FP16 (16-bit IEEE 754 half-precision)
**Array Precision**: FP32 (Float32Array in JavaScript)
**Accumulation Precision**: float64 (JavaScript number type default)
**Rationale**: Balance storage efficiency with numerical stability

### Conversion Points

**Build-time (FP32 → FP16)**:
```typescript
// scripts/build-embeddings.ts
function serializeToFp16(embedding: number[]): Uint16Array {
  const fp16 = new Uint16Array(384);
  for (let i = 0; i < 384; i++) {
    fp16[i] = floatToFp16(embedding[i]); // FP32 → FP16
  }
  return fp16;
}
```

**Runtime (FP16 → FP32)**:
```typescript
// src/workers/retrieval.worker.ts
function deserializeFromFp16(fp16Buffer: Uint16Array, offset: number): Float32Array {
  const fp32 = new Float32Array(384);
  for (let i = 0; i < 384; i++) {
    fp32[i] = fp16ToFloat(fp16Buffer[offset + i]); // FP16 → FP32
  }
  return fp32;
}
```

**Similarity Computation (FP32 arrays with float64 accumulation)**:
```typescript
function dotProduct(a: Float32Array, b: Float32Array): number {
  // CRITICAL: FP32 arrays, float64 accumulation (JavaScript default)
  let sum = 0; // float64 accumulator (JS numbers are always float64)
  for (let i = 0; i < 384; i++) {
    sum += a[i] * b[i]; // FP32 × FP32 → promoted to float64 for accumulation
  }
  return sum;
}
```

### Precision Invariants

1. **Storage**: Embeddings stored as FP16 (Uint16Array, 2 bytes per value)
2. **Deserialization**: FP16 → FP32 (Float32Array) before any computation
3. **Accumulation**: All similarity computations use float64 (JS number type)
4. **Never**: Mix FP16 computation directly (causes numerical instability)

### Testing Precision

```typescript
// Test: Verify FP16 roundtrip error is acceptable
test('fp16 conversion preserves similarity', () => {
  const original = new Float32Array(384).map(() => Math.random() * 2 - 1);
  const fp16 = floatToFp16Array(original);
  const roundtrip = fp16ToFloatArray(fp16);

  const originalNorm = l2Normalize(original);
  const roundtripNorm = l2Normalize(roundtrip);

  const similarity = dotProduct(originalNorm, roundtripNorm);

  expect(similarity).toBeGreaterThan(0.95); // <5% loss acceptable
});
```

---

## Loading States & UX Narrative

### Loading State Philosophy

**Principle**: Communicate *what* is happening, not just *that* something is happening.

### Loading Messages

| Substate | Message | Duration (Typical) |
|----------|---------|-------------------|
| `checking-cache` | "Checking local cache..." | <500ms |
| `loading-model` | "Loading AI model (23 MB, one-time download)..." | 30-60s (first), 2-3s (cached) |
| `fetching-artifacts` | "Fetching blog embeddings..." | 1-3s |
| `initializing-search` | "Preparing search index..." | <1s |
| `spawning-worker` | "Initializing background workers..." | <500ms |
| `complete` | "Ready!" | Instant transition |

### Progress Indicators

**Model Loading**:
```tsx
<div className="loading-detail">
  <p>Downloading AI model: {downloadedMB} / 23 MB</p>
  <p>This enables intelligent search across all blog content</p>
  <p className="hint">Cached after first load — future sessions will be instant</p>
</div>
```

**Retrieval**:
```tsx
<div className="retrieval-status">
  <p>Searching {totalChunks} blog chunks...</p>
  <div className="spinner-small" />
</div>
```

**Generation**:
```tsx
<div className="generation-status">
  <p>Generating response from {sourceCount} sources...</p>
  <div className="typing-indicator">●●●</div>
</div>
```

### Error Messages (Narrative)

**Model Load Failure**:
```
"Could not load AI model. This might be due to:
• Slow or interrupted network connection
• Browser storage quota exceeded
• Unsupported browser

[Retry] [Learn More]"
```

**Offline**:
```
"You appear to be offline. The chatbot requires an internet connection for:
• First-time model download (if not cached)
• Fetching latest blog content
• Generating responses

[Retry when online]"
```

---

## Error Handling & Failure Modes

### Failure Taxonomy

```typescript
type ChatbotError =
  | 'model-load-failed'
  | 'artifacts-fetch-failed'
  | 'indexeddb-unavailable'
  | 'worker-spawn-failed'
  | 'retrieval-failed'
  | 'api-error'
  | 'rate-limited'
  | 'offline'
  | 'quota-exceeded'
  | 'unknown';
```

### Error Handling Strategies

#### 1. IndexedDB Unavailable

**Scenario**: Private browsing, storage disabled, quota exceeded

**Handling**:
```typescript
async function checkCache(): Promise<CachedResources | null> {
  try {
    const db = await openDB('chatbot-cache', 1);
    return await getCachedResources(db);
  } catch (error) {
    console.warn('IndexedDB unavailable, proceeding without cache:', error);
    // Continue without caching (fetch fresh every time)
    return null;
  }
}
```

**User Impact**: Slower initialization on every session (no caching)

**UI**:
```
"ℹ️ Note: Browser storage is unavailable. The AI model will be re-downloaded each session."
```

---

#### 2. Partial Artifact Fetch

**Scenario**: Network interruption during artifact download

**Handling**:
```typescript
async function fetchArtifacts() {
  try {
    const [embeddingsResponse, manifestResponse, chunksResponse] = await Promise.all([
      fetch(ARTIFACT_CONFIG.embeddingsUrl),
      fetch(ARTIFACT_CONFIG.manifestUrl),
      fetch(ARTIFACT_CONFIG.chunksUrl)
    ]);

    if (!embeddingsResponse.ok || !manifestResponse.ok || !chunksResponse.ok) {
      throw new Error(`HTTP ${embeddingsResponse.status}`);
    }

    const embeddings = await embeddingsResponse.arrayBuffer();
    const manifest = await manifestResponse.json();
    const chunksBuffer = await chunksResponse.arrayBuffer();

    // Validate integrity
    if (embeddings.byteLength !== manifest.chunks.length * 384 * 2) {
      throw new Error('Artifact size mismatch');
    }

    const chunks = parseChunkTextBuffer(chunksBuffer, manifest.chunks.length);

    return { embeddings, manifest, chunks };

  } catch (error) {
    if (!navigator.onLine) {
      throw new ChatbotError('offline', 'You are offline');
    }
    throw new ChatbotError('artifacts-fetch-failed', error.message);
  }
}
```

**Recovery**: Retry with exponential backoff

---

#### 3. Model Load Failure

**Scenario**: Network error, unsupported browser, memory exhaustion

**Handling**:
```typescript
async function loadModel() {
  try {
    const { pipeline } = await import('@huggingface/transformers');

    const extractor = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      {
        quantized: true,
        progress_callback: (progress) => {
          if (progress.status === 'error') {
            throw new Error(progress.message);
          }
        }
      }
    );

    return extractor;

  } catch (error) {
    // Check for specific error types
    if (error.message.includes('quota')) {
      throw new ChatbotError('quota-exceeded', 'Browser storage quota exceeded');
    }
    if (error.message.includes('memory')) {
      throw new ChatbotError('low-memory', 'Insufficient memory to load model');
    }
    throw new ChatbotError('model-load-failed', error.message);
  }
}
```

**Recovery**: Clear cache, retry, or show degraded experience

---

#### 4. Low-Memory Abort

**Scenario**: Device runs out of memory during initialization

**Handling**:
```typescript
// BEST-EFFORT memory pressure detection
// WARNING: Chrome-only, unreliable, not available in Firefox/Safari
// Use as a hint, not a guarantee - actual OOM errors cannot be prevented
if ('memory' in performance) {
  const memory = (performance as any).memory;
  const usedMemoryMB = memory.usedJSHeapSize / 1024 / 1024;
  const totalMemoryMB = memory.jsHeapSizeLimit / 1024 / 1024;

  if (usedMemoryMB / totalMemoryMB > 0.9) {
    console.warn('Memory pressure detected (Chrome-only heuristic), aborting initialization');
    throw new ChatbotError('low-memory', 'Insufficient memory');
  }
}
```

**User Impact**: Cannot use chatbot on low-memory devices

**UI**:
```
"⚠️ Your device doesn't have enough memory to run the chatbot.
Try closing other tabs or using a device with more RAM."
```

---

#### 5. Offline Behavior

**Scenario**: User goes offline during initialization or query

**Detection**:
```typescript
window.addEventListener('offline', () => {
  if (state === 'initializing') {
    setError(new ChatbotError('offline', 'Connection lost'));
  }
});

window.addEventListener('online', () => {
  if (error?.type === 'offline') {
    // Offer to retry
    showRetryButton();
  }
});
```

**Handling**:
- If cached: Allow queries (retrieval works offline)
- If not cached: Show offline error
- For generation: Always requires connection (API call)

---

#### 6. API Errors

**Scenario**: OpenRouter/Gemini API failures

**Handling**:
```typescript
async function generateResponse(query: string, context: string) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ query, context }),
      signal: AbortSignal.timeout(30000) // 30s timeout
    });

    if (response.status === 429) {
      throw new ChatbotError('rate-limited', 'Too many requests. Please wait a moment.');
    }

    if (response.status === 500) {
      throw new ChatbotError('api-error', 'LLM API error. Please try again.');
    }

    if (!response.ok) {
      throw new ChatbotError('api-error', `HTTP ${response.status}`);
    }

    return response.body;

  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new ChatbotError('api-error', 'Request timed out');
    }
    throw error;
  }
}
```

**Recovery**: Retry button, fallback message

---

### Error Recovery UI

```tsx
function ErrorScreen({ error, onRetry, onClose }: ErrorScreenProps) {
  const errorMessages: Record<ChatbotError['type'], string> = {
    'model-load-failed': 'Failed to load AI model. Check your connection and try again.',
    'artifacts-fetch-failed': 'Failed to fetch blog content. Check your connection.',
    'indexeddb-unavailable': 'Browser storage unavailable. Proceeding without cache.',
    'worker-spawn-failed': 'Failed to initialize background worker. Try refreshing.',
    'retrieval-failed': 'Search failed. Please try a different query.',
    'api-error': 'Could not generate response. Please try again.',
    'rate-limited': 'Too many requests. Please wait a moment.',
    'offline': 'You are offline. Chatbot requires an internet connection.',
    'quota-exceeded': 'Browser storage quota exceeded. Clear site data and retry.',
    'unknown': 'An unexpected error occurred.'
  };

  return (
    <div className="error-screen">
      <h2>⚠️ Error</h2>
      <p>{errorMessages[error.type]}</p>
      <div className="error-actions">
        <button onClick={onRetry}>Retry</button>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
```

---

## Cache Invalidation & Versioning

### Artifact Versioning Strategy

**Build Hash**: SHA-256 of all chunk IDs + content
**Manifest Version**: Semantic versioning (1.0.0)

### Cache Validation Flow

```typescript
import artifactConfig from '@/config/chatbot-artifacts.json';

async function validateCache(): Promise<boolean> {
  try {
    // 1. Get cached artifacts
    const cached = await getCachedArtifacts();
    if (!cached) return false;

    // 2. ZERO-NETWORK validation: compare against bundled config
    // 3. Compare build hashes (no network request)
    if (cached.buildHash !== artifactConfig.buildHash) {
      console.log('Cache invalidated: build hash mismatch');
      await clearArtifactCache();
      return false;
    }

    // 4. Check version compatibility (from manifest)
    const cachedVersion = parseVersion(cached.manifest.version);
    const bundledVersion = parseVersion(artifactConfig.version);

    if (cachedVersion.major !== bundledVersion.major) {
      console.log('Cache invalidated: major version change');
      await clearArtifactCache();
      return false;
    }

    return true;

  } catch (error) {
    console.warn('Cache validation failed:', error);
    return false;
  }
}
```

### Force Refresh Mechanism

**User-Triggered**:
```tsx
<button onClick={async () => {
  await clearArtifactCache();
  await initialize();
}}>
  Refresh Content
</button>
```

**Automatic on Deploy**:
- Build hash changes → cache invalidated
- User sees "Updating content..." on next initialization

### Versioning Schema

```typescript
interface Version {
  major: number; // Breaking changes (incompatible format)
  minor: number; // New features (backward compatible)
  patch: number; // Bug fixes
}

// Example version progression:
// 1.0.0 → Initial release
// 1.1.0 → Add new metadata fields (compatible)
// 2.0.0 → Change binary format (incompatible, forces re-download)
```

---

## Testing Strategy

### Unit Tests

**Location**: `src/**/*.test.ts`

**Coverage**:
1. Chunking algorithm
2. FP16 conversion (precision loss bounds)
3. RRF fusion logic
4. Dot product computation
5. Cache validation

**Example**:
```typescript
import { describe, test, expect } from 'vitest';
import { chunkDocument } from '@/utils/chunking';

describe('chunkDocument', () => {
  test('chunks by heading boundaries', () => {
    const content = `
## Introduction
This is the intro.

## Details
This is a longer section with more content.
    `;

    const chunks = chunkDocument({
      id: 'test',
      content,
      title: 'Test',
      type: 'blog',
      metadata: { tags: [] }
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0].metadata.section).toBe('Introduction');
    expect(chunks[1].metadata.section).toBe('Details');
  });

  test('respects token limits', () => {
    const longContent = 'word '.repeat(1000); // ~1000 tokens

    const chunks = chunkDocument({
      id: 'test',
      content: longContent,
      title: 'Test',
      type: 'blog',
      metadata: { tags: [] }
    });

    chunks.forEach(chunk => {
      expect(chunk.tokens).toBeLessThanOrEqual(512);
      expect(chunk.tokens).toBeGreaterThanOrEqual(64);
    });
  });
});
```

---

### Integration Tests

**Location**: `tests/integration/`

**Scenarios**:
1. Full initialization flow (mocked network)
2. Query → retrieval → generation pipeline
3. Cache hit/miss scenarios
4. Error recovery flows

**Example**:
```typescript
import { describe, test, expect, beforeAll } from 'vitest';
import { initializeChatbot } from '@/services/chatbot/initialization';

describe('Chatbot initialization', () => {
  beforeAll(() => {
    // Mock Transformers.js
    vi.mock('@huggingface/transformers');
  });

  test('initializes successfully with fresh cache', async () => {
    const progress: string[] = [];

    await initializeChatbot((substate) => {
      progress.push(substate);
    });

    expect(progress).toContain('checking-cache');
    expect(progress).toContain('loading-model');
    expect(progress).toContain('fetching-artifacts');
    expect(progress).toContain('complete');
  });

  test('uses cached artifacts when valid (zero artifact fetches)', async () => {
    // Pre-populate cache with current build hash
    await populateCache();

    const fetchSpy = vi.spyOn(global, 'fetch');

    await initializeChatbot(() => {});

    // Zero artifact fetches - validation uses bundled config only
    // Note: Model loading (Transformers.js) will still fetch model files
    const artifactFetches = fetchSpy.mock.calls.filter(call =>
      call[0].includes('embeddings.bin') ||
      call[0].includes('manifest.json') ||
      call[0].includes('chunks.bin')
    );
    expect(artifactFetches).toHaveLength(0);
  });
});
```

---

### E2E Tests

**Tool**: Playwright

**Scenarios**:
1. User opens chatbot → initializes → asks question → receives answer
2. User closes modal → resources released
3. Offline handling
4. Error states

**Example**:
```typescript
import { test, expect } from '@playwright/test';

test('chatbot full flow', async ({ page }) => {
  await page.goto('/chatbot');

  // 1. Click "Start Chat"
  await page.click('button:has-text("Start Chat")');

  // 2. Wait for initialization
  await expect(page.locator('.loading-screen')).toBeVisible();
  await expect(page.locator('.chat-interface')).toBeVisible({ timeout: 60000 });

  // 3. Send query
  await page.fill('input[placeholder*="Ask"]', 'What is this blog about?');
  await page.click('button:has-text("Send")');

  // 4. Wait for response
  await expect(page.locator('.message.assistant')).toBeVisible({ timeout: 10000 });

  // 5. Verify sources
  await expect(page.locator('.sources-panel')).toBeVisible();

  // 6. Close modal
  await page.click('.close-button');

  // 7. Verify cleanup (no visible chat UI)
  await expect(page.locator('.chat-interface')).not.toBeVisible();
});
```

---

## Implementation Phases

### Phase 1: Build-Time Pipeline (Week 1)

**Goal**: Generate embeddings and upload to Vercel Blob

**Tasks**:
- [ ] Create `scripts/build-embeddings.ts`
- [ ] Implement chunking logic (`src/utils/chunking.ts`)
- [ ] Implement FP16 conversion (`src/utils/fp16.ts`)
- [ ] Set up Vercel Blob integration
- [ ] Generate and upload artifacts
- [ ] Verify artifact integrity

**Deliverable**: `embeddings.bin` and `manifest.json` on Vercel Blob

**Validation**:
```bash
npm run build:embeddings
# Should output:
# ✓ Chunked 4 posts into 23 chunks
# ✓ Generated 23 embeddings (384 dims each)
# ✓ Serialized to FP16 (17.6 KB)
# ✓ Uploaded to Vercel Blob
# ✓ Build hash: a1b2c3d4e5f6g7h8
```

---

### Phase 2: Lazy Loading Infrastructure (Week 2)

**Goal**: Implement activation boundary and resource loading

**Tasks**:
- [ ] Create chatbot state machine
- [ ] Implement WelcomeScreen (uninitialized state)
- [ ] Implement LoadingScreen (narrative loading)
- [ ] Create initialization service
- [ ] Implement cache validation
- [ ] Add IndexedDB caching
- [ ] Implement cleanup logic

**Deliverable**: Chatbot initializes only on user action

**Validation**:
- Page load: No network requests, no IndexedDB access
- Click "Start Chat": Model + artifacts load
- Close modal: Resources released

---

### Phase 3: Retrieval Pipeline (Week 3)

**Goal**: Implement semantic + BM25 hybrid search

**Tasks**:
- [ ] Create Web Worker for similarity search
- [ ] Implement FP16 → FP32 deserialization
- [ ] Implement dot product similarity (FP32 accumulation)
- [ ] Integrate MiniSearch for BM25
- [ ] Implement RRF fusion
- [ ] Add retrieval service

**Deliverable**: Query returns top-K chunks with sources

**Validation**:
```typescript
const chunks = await retrieve('What is Astro?');
console.log(chunks);
// [
//   { id: 'blog/building-with-astro#intro-0', score: 0.87, ... },
//   { id: 'blog/astro-features#performance-1', score: 0.82, ... },
//   ...
// ]
```

---

### Phase 4: LLM Integration (Week 4)

**Goal**: Generate responses from retrieved context

**Tasks**:
- [ ] Create `/api/chat` endpoint
- [ ] Implement OpenRouter/Gemini integration
- [ ] Add streaming response handler
- [ ] Implement rate limiting
- [ ] Add error handling
- [ ] Create ChatInterface UI
- [ ] Add SourcesPanel for attribution

**Deliverable**: Fully functional RAG chatbot

**Validation**:
- User sends query
- System retrieves relevant chunks
- LLM generates grounded response
- Sources displayed with attribution

---

### Phase 5: Error Handling & Polish (Week 5)

**Goal**: Production-ready error handling and UX

**Tasks**:
- [ ] Implement all error states (11 types)
- [ ] Add retry mechanisms
- [ ] Handle offline gracefully
- [ ] Add quota exceeded detection
- [ ] Implement "New Chat" functionality
- [ ] Add loading animations
- [ ] Polish UI/UX

**Deliverable**: Robust, production-ready chatbot

---

### Phase 6: Testing & Optimization (Week 6)

**Goal**: Comprehensive testing and performance tuning

**Tasks**:
- [ ] Write unit tests (chunking, FP16, RRF)
- [ ] Write integration tests (initialization, retrieval)
- [ ] Write E2E tests (full flow)
- [ ] Performance profiling
- [ ] Optimize bundle size
- [ ] Add telemetry (optional)

**Deliverable**: Well-tested, optimized system

---

## Configuration Files

### Astro Config (Hybrid Output)

**Location**: `astro.config.mjs`

```javascript
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'hybrid', // Enable API routes
  integrations: [
    react(),
    tailwind()
  ],
  vite: {
    optimizeDeps: {
      exclude: ['@huggingface/transformers'] // Large, lazy-loaded
    }
  }
});
```

---

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "astro dev",
    "build:embeddings": "tsx scripts/build-embeddings.ts",
    "build:site": "astro build",
    "build": "npm run build:embeddings && npm run build:site",
    "preview": "astro preview",
    "test": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@astrojs/react": "^3.0.0",
    "@astrojs/tailwind": "^5.0.0",
    "@huggingface/transformers": "^3.0.0",
    "@petamoriken/float16": "^3.8.0",
    "@vercel/blob": "^0.20.0",
    "idb": "^8.0.0",
    "minisearch": "^6.3.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "@types/react": "^19.0.0",
    "astro": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "tsx": "^4.7.0",
    "typescript": "^5.9.0",
    "vitest": "^1.0.0"
  }
}
```

---

### Environment Variables

**`.env.local`**:
```bash
# Vercel Blob
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_XXXXXXXXXX

# LLM API (choose one)
OPENROUTER_API_KEY=sk-or-v1-XXXXXXXXXX
# or
GEMINI_API_KEY=XXXXXXXXXX
```

**Vercel Dashboard**:
- Add `BLOB_READ_WRITE_TOKEN`
- Add `OPENROUTER_API_KEY` or `GEMINI_API_KEY`

---

## Success Criteria

### Functional Requirements

- ✅ Page load triggers zero resource loading
- ✅ User clicks "Start Chat" → resources load with progress
- ✅ Initialization completes in <60s (first load), <5s (cached)
- ✅ Query retrieves relevant chunks in <100ms
- ✅ LLM response streams in <3s (first token)
- ✅ Sources displayed with attribution
- ✅ "New Chat" clears messages, keeps resources loaded
- ✅ Modal close releases all resources
- ✅ Offline detection and graceful degradation
- ✅ All 11 error types handled with recovery

### Non-Functional Requirements

- ✅ Bundle size: Chatbot island <50 KB (before lazy loads)
- ✅ Memory footprint: <200 MB during active use
- ✅ IndexedDB usage: <50 MB (model + artifacts)
- ✅ Monthly cost: <$1 (Vercel Blob + LLM API)
- ✅ Browser support: Chrome, Firefox, Safari (latest 2 versions)
- ✅ Mobile: Works on iOS/Android with 4GB+ RAM
- ✅ Accessibility: Keyboard navigable, screen reader friendly

### Quality Metrics

- ✅ Test coverage: >80% (unit + integration)
- ✅ E2E coverage: Critical paths tested
- ✅ Retrieval accuracy: Top-5 contains answer >80% of queries
- ✅ FP16 precision loss: <5% similarity score degradation
- ✅ Cache hit rate: >90% after first load

---

## Open Questions & Future Enhancements

### Open Questions

1. **Reranking**: Should we add a reranking step (API call) for top-K refinement?
2. **Multi-turn**: Support conversation history (session-local) or keep stateless?
3. **Analytics**: Track query patterns (anonymized) for content insights?
4. **Suggested questions**: Pre-generate common questions at build time?

### Future Enhancements

**Phase 7+**:
- [ ] Query history (localStorage, session-scoped)
- [ ] Export conversation as markdown
- [ ] Feedback loop (thumbs up/down on responses)
- [ ] Highlighted citations (link chunks to exact post locations)
- [ ] Voice input (Web Speech API)
- [ ] Multi-language support (detect query language)
- [ ] Semantic search UI (standalone, not chat-based)
- [ ] Admin dashboard (query analytics, retrieval quality metrics)

---

## Appendix: Type Definitions

### Complete Type Definitions

**Location**: `src/types/chatbot.ts`

```typescript
// State Types
export type ChatbotState =
  | 'uninitialized'
  | 'initializing'
  | 'ready'
  | 'retrieving'
  | 'generating'
  | 'streaming'
  | 'error'
  | 'cleaned-up';

export type InitializationSubstate =
  | 'checking-cache'
  | 'loading-model'
  | 'fetching-artifacts'
  | 'initializing-search'
  | 'spawning-worker'
  | 'complete';

// Message Types
export interface Message {
  type: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  timestamp?: number;
}

export interface Source {
  title: string;
  url: string;
  score: number;
}

// Chunk Types
export interface Chunk {
  id: string;
  parentId: string;
  text: string;
  tokens: number;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  type: 'blog' | 'works';
  title: string;
  section?: string;
  tags: string[];
  url: string;
  index: number;
}

// Artifact Types
export interface ArtifactManifest {
  version: string;
  buildTime: string;
  buildHash: string;
  model: {
    name: string;
    dimensions: number;
    normalization: 'l2';
  };
  storage: {
    precision: 'fp16';
    accumulationPrecision: 'float64'; // JS accumulation is always float64
  };
  chunks: ManifestChunk[];
  stats: {
    totalChunks: number;
    totalTokens: number;
    avgTokensPerChunk: number;
  };
}

export interface ManifestChunk {
  id: string;
  parentId: string;
  // text removed - stored separately in chunks.bin (binary format)
  tokens: number;
  metadata: ChunkMetadata;
  embeddingOffset: number;
}

export interface SerializedArtifacts {
  embeddingsBuffer: ArrayBuffer;
  manifest: ArtifactManifest;
  chunkTextBuffer: ArrayBuffer;
}

// Search Result Types
export interface SearchResult {
  chunkId: string;
  score: number;
  chunk: ManifestChunk;
}

export interface FusedResult {
  chunkId: string;
  score: number;
  chunk: ManifestChunk;
}

// Error Types
export type ChatbotErrorType =
  | 'model-load-failed'
  | 'artifacts-fetch-failed'
  | 'indexeddb-unavailable'
  | 'worker-spawn-failed'
  | 'retrieval-failed'
  | 'api-error'
  | 'rate-limited'
  | 'offline'
  | 'quota-exceeded'
  | 'unknown';

export class ChatbotError extends Error {
  constructor(
    public type: ChatbotErrorType,
    message: string
  ) {
    super(message);
    this.name = 'ChatbotError';
  }
}

// Cache Types
export interface CachedResources {
  model: {
    timestamp: number;
    available: boolean;
  };
  artifacts: {
    buildHash: string;
    timestamp: number;
    embeddings: ArrayBuffer;
    manifest: ArtifactManifest;
    chunks: string[]; // REQUIRED: chunks accessed at runtime
  } | null;
}

// API Types
export interface ChatRequest {
  query: string;
  context: string;
  sources: Array<{
    title: string;
    url: string;
  }>;
}

export interface ChatResponse {
  type: 'chunk' | 'complete' | 'error';
  content: string;
}
```

---

## Document Change Log

**Version 1.5** (Final Correction Pass - Bulletproof)
- **ESM/TypeScript**: Moved `import artifactConfig` to module scope (not inside functions)
- **Cache Validation**: Fixed version access to use `cached.manifest.version` (not `cached.version`)
- **Zustand Store**: Added `chunks: string[]` to artifacts type definition
- **Test Clarity**: Clarified "zero artifact fetches" (model loading still occurs, not mocked)
- **Type Completeness**: Added missing `SerializedArtifacts` interface definition

**Version 1.4** (Correction-Only Pass)
- **Worker Message Passing**: Do NOT transfer query embedding buffer (small, may be needed on main thread)
- **InitializationSubstate**: Fixed mismatch - use 'initializing-search' consistently (not 'loading-search')
- **CachedResources Contract**: Added chunks: string[] to artifacts (required at runtime)
- **Test Consistency**: Updated integration test to expect zero network requests for cached artifacts
- **Error Handling Example**: Updated fetchArtifacts example to include all three artifacts (embeddings, manifest, chunks)

**Version 1.3** (Final Surgical Consistency Pass)
- **Cache Validation**: Zero-network validation using bundled config (no manifest fetch)
- **Worker Results**: Resolve chunk metadata (chunkId, chunk) before returning from worker
- **Worker Signature**: Only accepts embeddings + manifest (removed model, searchIndex params)
- **Chunk Storage Format**: Changed from JSON to binary (length-prefixed strings in chunks.bin)
- **Chunk Retrieval**: Use embeddingOffset to derive chunk array index (offset / 384)
- **Precision Wording**: Corrected ALL mentions - FP16 storage → FP32 arrays → float64 accumulation
- **Type Definitions**: Updated ManifestChunk, ChunkTextArray, storage.accumulationPrecision: 'float64'

**Version 1.2** (Final Consistency Pass)
- **Type Definitions**: Removed `text: string` from ManifestChunk interface (text externalized)
- **RRF Performance**: Pre-build chunk lookup Map for O(1) access instead of O(n) linear search
- **Precision Clarity**: Corrected dot product comments to reflect float64 accumulation (not FP32)
- **Rate Limiting Caveat**: Added warning that in-memory rate limiting doesn't work in serverless (Vercel)
- **Memory Detection Caveat**: Added warning that memory pressure detection is Chrome-only and unreliable

**Version 1.1** (Revised - Technical Corrections)
- **FP16 Conversion**: Use `@petamoriken/float16` library instead of hand-rolled IEEE 754 code
- **Manifest Separation**: Chunk text moved to separate file (reduces manifest from ~1 MB to ~50 KB)
- **Cache Invalidation**: Build hash embedded in artifact URLs for zero-network validation
- **RRF Fusion**: Fixed to union candidates (not intersect) - chunks in only one retriever now included
- **SSE Parsing**: Correct OpenRouter Server-Sent Events format parsing implemented
- **Worker Transfer**: Clone ArrayBuffer before transfer to enable re-initialization
- **Worker FP16→FP32**: Convert once during worker init (not per query) for 2-5ms speedup
- **IndexedDB Schema**: Proper schema definition with upgrade callback
- **MiniSearch Async**: Batch initialization with yields to prevent UI blocking
- **Chunk Overlap**: Implement 32-token overlap with sliding window
- **Token Budget**: Enforce 2K token context window limit with `selectTopKWithinBudget()`
- **Dependencies**: Added `@petamoriken/float16` and `idb` to package.json

**Version 1.0** (Initial)
- Complete implementation plan
- All architectural constraints incorporated
- Build-time and runtime flows specified
- File structure and component specifications
- Error handling and testing strategies
- 6-phase implementation roadmap

---

**Document Status**: ✅ Ready for Implementation (v1.5 - Bulletproof)

This implementation plan is a complete, rigorous specification that can be used to build the database-less RAG chatbot system. All architectural constraints have been addressed, **critical technical corrections incorporated (v1.1)**, **consistency passes completed (v1.2, v1.3)**, **correction passes completed (v1.4, v1.5)**, and **exhaustively verified for internal consistency**.

**All Fixes Implemented**:
1. ✅ RRF fusion correctly unions semantic + BM25 candidates
2. ✅ OpenRouter SSE streaming format properly parsed
3. ✅ Worker ArrayBuffer cloned before transfer (enables recovery)
4. ✅ FP16 conversion uses production-ready library
5. ✅ Manifest size reduced 95% (text separated)
6. ✅ Cache validation requires zero network requests (bundled config comparison)
7. ✅ FP16→FP32 conversion happens once (not per query)
8. ✅ IndexedDB schema properly defined
9. ✅ Token budget enforced to prevent context overflow
10. ✅ Chunk overlap implemented for context continuity
11. ✅ Type definitions consistent (ManifestChunk.text removed)
12. ✅ RRF lookup optimized (O(1) Map instead of O(n) find)
13. ✅ Precision wording corrected throughout (float64 accumulation)
14. ✅ Rate limiting caveats added (serverless limitation noted)
15. ✅ Memory detection caveats added (Chrome-only, unreliable)
16. ✅ Worker results resolve chunk metadata (chunkId + chunk before return)
17. ✅ Worker initialization signature cleaned (only embeddings + manifest)
18. ✅ Chunk storage format changed to binary (length-prefixed strings)
19. ✅ Chunk retrieval uses embeddingOffset for array indexing
20. ✅ All precision mentions corrected (FP16 → FP32 arrays → float64)
21. ✅ Query embedding buffer NOT transferred (copy instead, preserves main thread access)
22. ✅ InitializationSubstate consistent ('initializing-search' not 'loading-search')
23. ✅ CachedResources includes chunks: string[] (runtime contract complete)
24. ✅ Integration tests reflect zero-network cache validation model
25. ✅ Error handling examples updated to include all three artifacts
26. ✅ Import statements moved to module scope (invalid ESM/TypeScript fixed)
27. ✅ Cache validation accesses cached.manifest.version (not cached.version)
28. ✅ Zustand store artifacts type includes chunks: string[]
29. ✅ Test comments clarified: "zero artifact fetches" (model loading separate)
30. ✅ SerializedArtifacts interface defined (embeddingsBuffer, manifest, chunkTextBuffer)

**Next Steps**:
1. Set up development environment
2. Install dependencies (`@petamoriken/float16`, `idb`, etc.)
3. Begin Phase 1 (Build-Time Pipeline)
4. Follow 6-phase roadmap to completion

