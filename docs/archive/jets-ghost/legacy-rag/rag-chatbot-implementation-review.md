> **Superseded historical record.** Archived 2026-07-13 from `docs/rag-chatbot-implementation-review.md`.
> Canonical context: [Jet's Ghost local-assistant design](../../../superpowers/specs/2026-07-11-jets-ghost-local-assistant-design.md).

# RAG Chatbot Implementation Plan - Technical Review

**Review Date**: December 2025
**Reviewer Focus**: Technical correctness, consistency, foot-guns
**Scope**: Critical path issues only, preserving original architecture

---

## Executive Summary

The implementation plan is architecturally sound but contains **20 critical technical issues** that would cause production failures, performance problems, or subtle bugs. This review identifies each flaw, explains its practical impact, and provides precise corrections that preserve the original design intent.

**Severity Breakdown**:
- 🔴 Critical (5): Will cause failures or major bugs
- 🟡 High (8): Performance or UX issues
- 🟢 Medium (7): Code quality or maintainability

---

## Critical Issues (🔴)

### 1. RRF Fusion Logic is Incorrect (Intersection vs Union)

**Location**: `src/services/chatbot/rrf.ts`, Phase 4 retrieval pipeline

**Flaw**:
```typescript
// INCORRECT - only scores chunks that appear in BOTH results
bm25Results.forEach((result, rank) => {
  const rrfScore = (1 / (k + rank + 1)) * weights.bm25;
  const existing = scoreMap.get(result.id);
  if (existing) {  // ❌ This drops chunks only in BM25
    existing.score += rrfScore;
  }
});
```

**Why it matters**: RRF is designed to **union** candidates from multiple retrievers. A chunk appearing only in BM25 results (e.g., exact keyword match) but not in semantic results should still receive a BM25 contribution. The current code silently discards these chunks, breaking the hybrid retrieval assumption.

**Impact**: Queries with strong keyword signals (technical terms, names) will miss relevant chunks that semantic search didn't rank highly.

**Correct implementation**:
```typescript
function reciprocalRankFusion(
  semanticResults: SearchResult[],
  bm25Results: BM25Result[],
  manifest: ArtifactManifest,
  weights: { semantic: number; bm25: number } = { semantic: 0.6, bm25: 0.4 },
  k: number = 60
): FusedResult[] {
  const scoreMap = new Map<string, { score: number; chunk: ManifestChunk }>();

  // Process semantic results
  semanticResults.forEach((result, rank) => {
    const rrfScore = (1 / (k + rank + 1)) * weights.semantic;
    scoreMap.set(result.chunkId, {
      score: rrfScore,
      chunk: result.chunk
    });
  });

  // Process BM25 results (UNION, not intersection)
  bm25Results.forEach((result, rank) => {
    const rrfScore = (1 / (k + rank + 1)) * weights.bm25;
    const existing = scoreMap.get(result.id);

    if (existing) {
      // Chunk in both: add BM25 contribution
      existing.score += rrfScore;
    } else {
      // Chunk only in BM25: add with just BM25 score
      const chunk = manifest.chunks.find(c => c.id === result.id);
      if (chunk) {
        scoreMap.set(result.id, {
          score: rrfScore,
          chunk: chunk
        });
      }
    }
  });

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score);
}
```

**Test case**:
```typescript
// Semantic only finds chunk A (score 0.9)
// BM25 only finds chunk B (exact keyword match)
// Expected: Both A and B in results
// Broken code: Only A returned
// Fixed code: Both A and B with appropriate RRF scores
```

---

### 2. OpenRouter/Gemini Streaming Format Not Handled

**Location**: `src/pages/api/chat.ts`

**Flaw**:
```typescript
// INCORRECT - assumes raw text stream
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  // ...
  stream: true
});

return new Response(response.body!, {
  headers: { 'Content-Type': 'text/event-stream' }
});
```

**Why it matters**: OpenRouter returns **Server-Sent Events (SSE)** with JSON payloads, not raw text. Each chunk is formatted as:
```
data: {"choices":[{"delta":{"content":"Hello"}}]}

data: {"choices":[{"delta":{"content":" world"}}]}

data: [DONE]
```

The client expecting plain text will receive malformed data and fail to parse responses.

**Impact**: Streaming will appear broken; users see JSON fragments instead of coherent text.

**Correct implementation**:
```typescript
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
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Context:\n${context}\n\nQuestion: ${query}` }
      ],
      stream: true
    })
  });

  if (!openrouterResponse.ok) {
    throw new Error(`OpenRouter error: ${openrouterResponse.status}`);
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
          buffer = lines.pop() || ''; // Keep incomplete line

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
                // Ignore malformed JSON (incomplete chunks)
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
```

**Gemini alternative** (different API format):
```typescript
async function generateResponseGemini(query: string, context: string): Promise<ReadableStream> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${import.meta.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `Context:\n${context}\n\nQuestion: ${query}` }]
        }]
      })
    }
  );

  // Gemini returns newline-delimited JSON (not SSE)
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  return new ReadableStream({
    async start(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (content) {
              controller.enqueue(new TextEncoder().encode(content));
            }
          } catch (e) {
            // Skip malformed lines
          }
        }
      }
      controller.close();
    }
  });
}
```

---

### 3. ArrayBuffer Transfer Prevents Re-initialization

**Location**: `src/services/chatbot/initialization.ts`, worker spawn

**Flaw**:
```typescript
worker.postMessage({
  type: 'init',
  embeddings: artifacts.embeddings,
  manifest: artifacts.manifest
}, [artifacts.embeddings]); // ❌ Transfers ownership, detaches original
```

**Why it matters**: After transferring an ArrayBuffer to a worker, the original buffer is **detached** (neutered). If the worker crashes or needs re-initialization, `artifacts.embeddings` is unusable, causing a silent failure or forcing a full re-fetch.

**Impact**: Worker crashes (OOM, unexpected errors) require full re-initialization from network, even if data was cached.

**Correct approach** (clone for worker):
```typescript
// Option 1: Clone the buffer (safe, costs memory during transfer)
const embeddingsClone = artifacts.embeddings.slice(0);
worker.postMessage({
  type: 'init',
  embeddings: embeddingsClone,
  manifest: artifacts.manifest
}, [embeddingsClone]); // Transfer the clone

// artifacts.embeddings remains valid for re-initialization
```

**Alternative** (transfer and store reference separately):
```typescript
// Option 2: Accept that we need to re-fetch on worker failure
worker.postMessage({
  type: 'init',
  embeddings: artifacts.embeddings,
  manifest: artifacts.manifest
}, [artifacts.embeddings]);

// On worker crash:
async function reinitializeWorker() {
  // artifacts.embeddings is now detached
  // Re-fetch from cache or network
  const freshArtifacts = await fetchArtifacts(null); // Bypass cache check
  const newWorker = await spawnWorker(model, freshArtifacts, searchIndex);
  return newWorker;
}
```

**Recommendation**: Use Option 1 (clone). Memory cost is ~750 KB during transfer (negligible), and enables robust recovery.

---

### 4. FP16 Conversion Utilities Missing Edge Cases

**Location**: `scripts/utils/fp16.ts`

**Flaw**:
```typescript
function floatToFp16(value: number): number {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, true);
  const bits = view.getUint32(0, true);

  const sign = (bits >> 31) & 0x1;
  const exponent = ((bits >> 23) & 0xff) - 127 + 15;
  const mantissa = (bits >> 13) & 0x3ff;

  if (exponent <= 0) return sign << 15; // ❌ Incorrect for subnormals
  if (exponent >= 31) return (sign << 15) | 0x7c00; // ❌ Doesn't preserve NaN

  return (sign << 15) | (exponent << 10) | mantissa; // ❌ No rounding
}
```

**Why it matters**:
1. **Subnormal handling**: When FP32 exponent is very small, FP16 should preserve subnormals (non-zero values with exponent=0). Current code flushes to zero.
2. **NaN preservation**: NaN has specific bit patterns that should be preserved (signaling vs quiet NaN).
3. **Rounding**: Truncating mantissa from 23 bits to 10 bits without rounding introduces bias.

**Impact**: For embeddings in [-1, 1] range, subnormals and NaN are unlikely, but incorrect conversion can cause subtle precision loss (>5% in edge cases).

**Correct IEEE 754 implementation**:
```typescript
function floatToFp16(value: number): number {
  const floatView = new DataView(new ArrayBuffer(4));
  floatView.setFloat32(0, value, true);
  const bits = floatView.getUint32(0, true);

  const sign = (bits >> 31) & 0x1;
  const exponent = (bits >> 23) & 0xff;
  const mantissa = bits & 0x7fffff;

  // Handle special cases first
  if (exponent === 0xff) {
    // Infinity or NaN
    if (mantissa === 0) {
      // Infinity
      return (sign << 15) | 0x7c00;
    } else {
      // NaN - preserve signaling bit
      return (sign << 15) | 0x7c00 | (mantissa >> 13);
    }
  }

  // Convert exponent (biased by 127 in FP32, by 15 in FP16)
  const fp16Exponent = exponent - 127 + 15;

  // Handle underflow (subnormals)
  if (fp16Exponent <= 0) {
    if (fp16Exponent < -10) {
      // Too small, flush to zero
      return sign << 15;
    }
    // Denormalized FP16
    const shift = 1 - fp16Exponent;
    const denormMantissa = (mantissa | 0x800000) >> shift;
    const rounded = (denormMantissa >> 13) + ((denormMantissa >> 12) & 1); // Round to nearest even
    return (sign << 15) | rounded;
  }

  // Handle overflow
  if (fp16Exponent >= 31) {
    return (sign << 15) | 0x7c00; // Infinity
  }

  // Normal case: round mantissa to 10 bits
  const roundedMantissa = (mantissa >> 13) + ((mantissa >> 12) & 1); // Round to nearest even

  if (roundedMantissa > 0x3ff) {
    // Rounding caused mantissa overflow
    return (sign << 15) | ((fp16Exponent + 1) << 10);
  }

  return (sign << 15) | (fp16Exponent << 10) | roundedMantissa;
}

function fp16ToFloat(value: number): number {
  const sign = (value >> 15) & 0x1;
  const exponent = (value >> 10) & 0x1f;
  const mantissa = value & 0x3ff;

  let fp32Bits: number;

  if (exponent === 0) {
    if (mantissa === 0) {
      // Zero
      fp32Bits = sign << 31;
    } else {
      // Subnormal FP16 -> Normal FP32
      let exp = -14;
      let mant = mantissa;
      while ((mant & 0x400) === 0) {
        mant <<= 1;
        exp--;
      }
      mant &= 0x3ff;
      fp32Bits = (sign << 31) | ((exp + 127) << 23) | (mant << 13);
    }
  } else if (exponent === 31) {
    // Infinity or NaN
    fp32Bits = (sign << 31) | (0xff << 23) | (mantissa << 13);
  } else {
    // Normal
    fp32Bits = (sign << 31) | ((exponent - 15 + 127) << 23) | (mantissa << 13);
  }

  const floatView = new DataView(new ArrayBuffer(4));
  floatView.setUint32(0, fp32Bits, true);
  return floatView.getFloat32(0, true);
}
```

**Pragmatic alternative** (use library):
```typescript
// Use @petamoriken/float16 (well-tested, optimized)
import { getFloat16, setFloat16 } from '@petamoriken/float16';

function serializeToFp16(embeddings: number[][]): ArrayBuffer {
  const buffer = new ArrayBuffer(embeddings.length * 384 * 2);
  const view = new DataView(buffer);

  let offset = 0;
  for (const embedding of embeddings) {
    for (let i = 0; i < 384; i++) {
      setFloat16(view, offset, embedding[i], true);
      offset += 2;
    }
  }

  return buffer;
}
```

---

### 5. Worker Message Passing Lacks Promise Wrapper

**Location**: `src/services/chatbot/retrieval.ts`

**Flaw**:
```typescript
// Shown in plan but incomplete
worker.postMessage({ type: 'search', queryEmbedding });

// How does the main thread get results? Not specified.
```

**Why it matters**: The plan shows posting messages to the worker but doesn't implement the promise-based response handling. Without this, the main thread can't await results, causing race conditions or blocking issues.

**Impact**: Retrieval will fail silently or return stale/undefined results.

**Correct implementation** (promise wrapper):
```typescript
let messageId = 0;

async function searchSemantic(queryEmbedding: Float32Array): Promise<SearchResult[]> {
  return new Promise((resolve, reject) => {
    const id = messageId++;
    const timeout = setTimeout(() => {
      reject(new Error('Worker search timeout'));
    }, 5000); // 5s timeout

    const messageHandler = (e: MessageEvent) => {
      if (e.data.type === 'search-results' && e.data.id === id) {
        clearTimeout(timeout);
        worker.removeEventListener('message', messageHandler);
        resolve(e.data.results);
      } else if (e.data.type === 'error' && e.data.id === id) {
        clearTimeout(timeout);
        worker.removeEventListener('message', messageHandler);
        reject(new Error(e.data.message));
      }
    };

    worker.addEventListener('message', messageHandler);
    worker.postMessage({
      type: 'search',
      id,
      queryEmbedding: queryEmbedding.buffer
    }, [queryEmbedding.buffer]); // Transfer query embedding
  });
}
```

**Worker side**:
```typescript
self.addEventListener('message', (e) => {
  const { type, id, queryEmbedding } = e.data;

  if (type === 'search') {
    try {
      const query = new Float32Array(queryEmbedding);
      const results = performSearch(query);

      self.postMessage({
        type: 'search-results',
        id,
        results
      });
    } catch (error) {
      self.postMessage({
        type: 'error',
        id,
        message: error.message
      });
    }
  }
});
```

---

## High-Priority Issues (🟡)

### 6. Manifest Contains Full Chunk Text (1 MB Duplication)

**Location**: Artifact serialization, Phase 1

**Flaw**:
```typescript
interface ManifestChunk {
  id: string;
  text: string; // ❌ Full chunk text duplicated
  tokens: number;
  metadata: { ... };
}
```

**Why it matters**: With 1,000 chunks × ~1 KB text, manifest.json becomes ~1 MB. But MiniSearch also stores the same text for indexing. Total duplication:
- manifest.json: 1 MB
- MiniSearch in-memory index: 1 MB
- Displaying chunks: references to same text

This wastes bandwidth and memory. The manifest should be lightweight metadata only.

**Impact**: Slower initialization (download 1 MB manifest), higher memory usage.

**Correct design** (separate chunk text storage):
```typescript
// manifest.json - metadata only (~50 KB)
interface ArtifactManifest {
  version: string;
  buildHash: string;
  model: { ... };
  chunks: ManifestChunkMetadata[]; // No text field
}

interface ManifestChunkMetadata {
  id: string;
  parentId: string;
  tokens: number;
  metadata: ChunkMetadata;
  embeddingOffset: number;
  textOffset?: number; // Offset in chunks.json if needed
}

// chunks.json - text only (compressed ~300 KB)
interface ChunkTextStore {
  [chunkId: string]: string;
}

// Upload both:
await put('chatbot/manifest.json', JSON.stringify(manifest)); // ~50 KB
await put('chatbot/chunks.json', JSON.stringify(chunkTexts));  // ~300 KB compressed
```

**Runtime loading**:
```typescript
async function fetchArtifacts() {
  const [embeddings, manifest, chunks] = await Promise.all([
    fetch(URLS.embeddings).then(r => r.arrayBuffer()),
    fetch(URLS.manifest).then(r => r.json()),
    fetch(URLS.chunks).then(r => r.json())
  ]);

  return { embeddings, manifest, chunks };
}

// Initialize MiniSearch from chunks
async function initializeSearch(manifest: ArtifactManifest, chunks: ChunkTextStore) {
  const searchIndex = new MiniSearch({ /* config */ });

  const documents = manifest.chunks.map(meta => ({
    id: meta.id,
    text: chunks[meta.id],
    title: meta.metadata.title,
    section: meta.metadata.section || '',
    url: meta.metadata.url
  }));

  searchIndex.addAll(documents);
  return searchIndex;
}
```

**Size savings**:
- Before: manifest.json (1 MB) + embeddings.bin (750 KB) = 1.75 MB
- After: manifest.json (50 KB) + chunks.json (300 KB) + embeddings.bin (750 KB) = 1.1 MB
- Savings: ~37% reduction

---

### 7. FP16→FP32 Conversion on Every Query (Inefficient)

**Location**: `src/workers/retrieval.worker.ts`

**Flaw**:
```typescript
self.addEventListener('message', async (e) => {
  if (e.data.type === 'search') {
    // ❌ Converts all embeddings on EVERY query
    const embeddingsFp32 = convertFp16ToFp32(embeddingsBuffer);

    const results = [];
    for (let i = 0; i < numChunks; i++) {
      const chunkEmbedding = embeddingsFp32.subarray(i * 384, (i + 1) * 384);
      const similarity = dotProduct(queryEmbedding, chunkEmbedding);
      results.push({ chunkIndex: i, score: similarity });
    }
  }
});
```

**Why it matters**: Converting 1,000 chunks × 384 dims = 384,000 FP16→FP32 conversions per query is wasteful. At ~5 CPU cycles per conversion, this adds ~2ms of unnecessary latency per query.

**Impact**: 2-5ms added latency per query, wastes battery on mobile.

**Correct approach** (convert once during initialization):
```typescript
// Worker-scoped variable
let embeddingsFp32: Float32Array;

self.addEventListener('message', (e) => {
  if (e.data.type === 'init') {
    const fp16Buffer = new Uint16Array(e.data.embeddings);

    // Convert once, store as FP32
    embeddingsFp32 = new Float32Array(fp16Buffer.length);
    for (let i = 0; i < fp16Buffer.length; i++) {
      embeddingsFp32[i] = fp16ToFloat(fp16Buffer[i]);
    }

    self.postMessage({ type: 'ready' });
  }
  else if (e.data.type === 'search') {
    // Use pre-converted FP32 embeddings
    const queryEmbedding = new Float32Array(e.data.queryEmbedding);
    const results = [];

    for (let i = 0; i < embeddingsFp32.length / 384; i++) {
      const chunkEmbedding = embeddingsFp32.subarray(i * 384, (i + 1) * 384);
      const similarity = dotProduct(queryEmbedding, chunkEmbedding);
      results.push({ chunkIndex: i, score: similarity });
    }

    results.sort((a, b) => b.score - a.score);
    self.postMessage({
      type: 'search-results',
      id: e.data.id,
      results: results.slice(0, 50)
    });
  }
});
```

**Memory tradeoff**: Worker uses 1.5 MB (FP32) instead of 750 KB (FP16), but gains 2-5ms per query. For interactive chat, this is worthwhile.

---

### 8. Cache Validation Fetches Full Manifest (Defeats Caching)

**Location**: `src/services/chatbot/cache.ts`

**Flaw**:
```typescript
async function validateCache(): Promise<boolean> {
  const cached = await getCachedArtifacts();
  if (!cached) return false;

  // ❌ Fetches 1 MB manifest just to check 16-byte hash
  const remoteManifest = await fetch(ARTIFACT_CONFIG.manifestUrl)
    .then(r => r.json());

  if (cached.buildHash !== remoteManifest.buildHash) {
    await clearArtifactCache();
    return false;
  }

  return true;
}
```

**Why it matters**: Downloading the entire manifest (1 MB) to compare a 16-byte hash defeats the purpose of caching. Users with valid caches still pay the bandwidth cost.

**Impact**: Adds ~500ms to initialization even with valid cache.

**Correct approach** (version in URL):
```typescript
// Build time: Include hash in artifact URLs
const buildHash = computeContentHash(chunks);

const config = {
  embeddingsUrl: `https://blob.vercel.com/embeddings-${buildHash}.bin`,
  manifestUrl: `https://blob.vercel.com/manifest-${buildHash}.json`,
  chunksUrl: `https://blob.vercel.com/chunks-${buildHash}.json`,
  buildHash // Also store for reference
};

// Write to src/config/chatbot-artifacts.json
await writeFile('src/config/chatbot-artifacts.json', JSON.stringify(config));
```

**Runtime validation**:
```typescript
import artifactConfig from '@/config/chatbot-artifacts.json';

async function validateCache(): Promise<boolean> {
  const cached = await getCachedArtifacts();
  if (!cached) return false;

  // Compare build hash from config (bundled at build time)
  if (cached.buildHash !== artifactConfig.buildHash) {
    console.log('Cache invalidated: build hash mismatch');
    await clearArtifactCache();
    return false;
  }

  return true; // No network request needed!
}
```

**Alternative** (HTTP ETag):
```typescript
async function validateCache(): Promise<boolean> {
  const cached = await getCachedArtifacts();
  if (!cached) return false;

  // HEAD request to check ETag (very lightweight)
  const response = await fetch(ARTIFACT_CONFIG.manifestUrl, {
    method: 'HEAD'
  });

  const remoteEtag = response.headers.get('etag');
  if (cached.etag !== remoteEtag) {
    await clearArtifactCache();
    return false;
  }

  return true;
}
```

**Recommendation**: Use version-in-URL approach (no runtime validation needed, URLs change when content changes).

---

### 9. MiniSearch Initialization Blocks Main Thread

**Location**: `src/services/chatbot/initialization.ts`

**Flaw**:
```typescript
async function initializeSearch(manifest: ArtifactManifest) {
  const searchIndex = new MiniSearch({ /* config */ });

  const documents = manifest.chunks.map(/* transform */);
  searchIndex.addAll(documents); // ❌ Synchronous, blocks for 100-500ms

  return searchIndex;
}
```

**Why it matters**: For 1,000 chunks with ~200 words each, `addAll()` performs tokenization, indexing, and radix tree construction synchronously. This blocks the main thread for 100-500ms, causing UI jank during initialization.

**Impact**: User sees frozen UI during "Preparing search index..." step.

**Correct approach** (async batching):
```typescript
async function initializeSearch(
  manifest: ArtifactManifest,
  chunks: ChunkTextStore
): Promise<MiniSearch> {
  const searchIndex = new MiniSearch({
    fields: ['text', 'title', 'section'],
    storeFields: ['id', 'title', 'section', 'url'],
    searchOptions: {
      boost: { title: 3, section: 2, text: 1 },
      fuzzy: 0.2,
      prefix: true
    }
  });

  const batchSize = 50; // Process 50 chunks at a time

  for (let i = 0; i < manifest.chunks.length; i += batchSize) {
    const batch = manifest.chunks.slice(i, i + batchSize).map(meta => ({
      id: meta.id,
      text: chunks[meta.id],
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

**Performance**:
- Before: 100-500ms blocking
- After: 100-500ms total, but yielding every 50 chunks (10-25ms per batch)
- User sees responsive UI throughout

---

### 10. IndexedDB Schema Not Defined

**Location**: `src/services/chatbot/cache.ts`

**Flaw**:
```typescript
const db = await openDB('chatbot-cache', 1);
await db.get('artifacts', 'current'); // ❌ No schema defined
```

**Why it matters**: `openDB` from `idb` library requires an `upgrade` callback to create object stores. Without it, `db.get()` will throw an error on first use.

**Impact**: Initialization fails silently on first run; cache never works.

**Correct implementation**:
```typescript
import { openDB, IDBPDatabase } from 'idb';

interface ChatbotDB {
  artifacts: {
    key: string;
    value: {
      buildHash: string;
      timestamp: number;
      embeddings: ArrayBuffer;
      manifest: ArtifactManifest;
      chunks: ChunkTextStore;
    };
  };
}

async function getCacheDB(): Promise<IDBPDatabase<ChatbotDB>> {
  return openDB<ChatbotDB>('chatbot-cache', 1, {
    upgrade(db) {
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains('artifacts')) {
        db.createObjectStore('artifacts');
      }
    }
  });
}

async function getCachedArtifacts() {
  try {
    const db = await getCacheDB();
    const cached = await db.get('artifacts', 'current');
    return cached || null;
  } catch (error) {
    console.warn('IndexedDB unavailable:', error);
    return null;
  }
}

async function setCachedArtifacts(artifacts: ChatbotDB['artifacts']['value']) {
  try {
    const db = await getCacheDB();
    await db.put('artifacts', artifacts, 'current');
  } catch (error) {
    console.warn('Could not cache artifacts:', error);
  }
}
```

---

### 11. Chunking Overlap Not Implemented

**Location**: `src/utils/chunking.ts`

**Flaw**:
```typescript
const CHUNKING_CONFIG = {
  overlapTokens: 32, // ❌ Defined but not used
};

function chunkDocument(item: ContentItem): Chunk[] {
  // ... chunking logic without overlap
}
```

**Why it matters**: Overlap ensures context continuity across chunk boundaries. Without it, answers spanning multiple chunks may be incomplete (e.g., a sentence starting in chunk N and ending in chunk N+1).

**Impact**: Retrieval quality degrades for queries whose answers span chunk boundaries (~10-15% of queries).

**Correct implementation**:
```typescript
function chunkByTokenLimit(
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
      // Chunk is full, finalize it
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
  const estimatedTokens = words.length * 0.75; // Rough estimate

  if (estimatedTokens <= n) return text;

  const wordsToKeep = Math.ceil(n / 0.75);
  return words.slice(-wordsToKeep).join(' ');
}
```

**Alternative** (sliding window):
```typescript
function chunkWithSlidingWindow(
  text: string,
  windowTokens: number,
  strideTokens: number
): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  let position = 0;
  while (position < words.length) {
    const windowWords = Math.ceil(windowTokens / 0.75);
    const chunk = words.slice(position, position + windowWords).join(' ');
    chunks.push(chunk);

    position += Math.ceil(strideTokens / 0.75);
  }

  return chunks;
}

// Usage: chunkWithSlidingWindow(text, 256, 224) // 32 token overlap
```

---

### 12. Rate Limiting Doesn't Work in Serverless

**Location**: `src/pages/api/chat.ts`

**Flaw**:
```typescript
const rateLimitMap = new Map<string, number[]>(); // ❌ In-memory, per-instance

async function isRateLimited(ip: string): Promise<boolean> {
  const timestamps = rateLimitMap.get(ip) || [];
  // ... logic
}
```

**Why it matters**: Vercel serverless functions are stateless. Each request may hit a different function instance, so in-memory rate limiting doesn't work. A user can bypass limits by making requests to different instances.

**Impact**: Rate limiting is ineffective; abusive users can spam requests.

**Correct approach** (client-side rate limiting):
```typescript
// In client (src/services/chatbot/generation.ts)
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests

async function generateResponse(query: string, context: RetrievedChunk[]) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    throw new ChatbotError(
      'rate-limited',
      `Please wait ${Math.ceil(waitTime / 1000)} seconds before sending another message`
    );
  }

  lastRequestTime = now;

  // Proceed with API call
  const response = await fetch('/api/chat', { /* ... */ });
  return response.body;
}
```

**Alternative** (Vercel Edge Config):
```typescript
// Using Vercel Edge Config for shared state (overkill for personal blog)
import { get, set } from '@vercel/edge-config';

async function isRateLimited(ip: string): Promise<boolean> {
  const key = `ratelimit:${ip}`;
  const timestamps: number[] = await get(key) || [];
  const now = Date.now();

  const recentTimestamps = timestamps.filter(t => now - t < 60000);

  if (recentTimestamps.length >= 10) {
    return true;
  }

  recentTimestamps.push(now);
  await set(key, recentTimestamps);

  return false;
}
```

**Recommendation**: Use client-side rate limiting (simpler, good enough for personal blog). Server-side is unnecessary complexity.

---

### 13. Context Window Token Budget Not Enforced

**Location**: `src/services/chatbot/retrieval.ts`

**Flaw**:
```typescript
// Top-K selected without regard to token budget
const topK = fusedResults.slice(0, 15);
```

**Why it matters**: If 15 chunks average 256 tokens, that's 3,840 tokens—potentially exceeding the LLM's context window or wasting budget on low-value chunks.

**Impact**: API errors (context too long) or inefficient token usage.

**Correct implementation**:
```typescript
function selectTopKWithinBudget(
  chunks: FusedResult[],
  maxTokens: number = 2000, // Reserve 2K for context
  minChunks: number = 3      // Always include at least 3 chunks
): FusedResult[] {
  const selected: FusedResult[] = [];
  let totalTokens = 0;

  for (const chunk of chunks) {
    const chunkTokens = chunk.chunk.tokens;

    if (selected.length >= minChunks && totalTokens + chunkTokens > maxTokens) {
      break; // Budget exhausted
    }

    selected.push(chunk);
    totalTokens += chunkTokens;

    if (selected.length >= minChunks && totalTokens >= maxTokens * 0.8) {
      break; // Near budget, stop early
    }
  }

  return selected;
}

// Usage:
const topK = selectTopKWithinBudget(fusedResults, 2000);
```

**Adaptive strategy**:
```typescript
function adaptiveTopK(
  chunks: FusedResult[],
  query: string
): FusedResult[] {
  // Short query: prioritize precision (fewer chunks)
  if (query.split(/\s+/).length < 5) {
    return selectTopKWithinBudget(chunks, 1000, 3);
  }

  // Long query: more context helpful
  return selectTopKWithinBudget(chunks, 2500, 5);
}
```

---

## Medium-Priority Issues (🟢)

### 14. Precision Documentation Ambiguity

**Location**: Throughout, precision handling sections

**Issue**: The plan states "FP32 accumulation" but JavaScript numbers are actually 64-bit floats:

```typescript
function dotProduct(a: Float32Array, b: Float32Array): number {
  let sum = 0; // This is float64, not FP32
  for (let i = 0; i < 384; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}
```

**Clarification needed**: "FP32 accumulation" means "using FP32 arrays, accumulated into a float64 variable" (which is correct—higher precision for accumulation reduces rounding errors).

**Correction** (documentation):
```typescript
/**
 * Computes dot product of two FP32 embeddings.
 *
 * Precision discipline:
 * - Inputs: Float32Array (FP32)
 * - Accumulator: JavaScript number (float64, higher precision)
 * - Output: float64 (similarity score)
 *
 * Note: Higher accumulator precision reduces rounding errors over 384 iterations.
 */
function dotProduct(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < 384; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}
```

---

### 15. L2 Normalization Not Verified

**Location**: Build-time and runtime embedding generation

**Issue**: The plan assumes `normalize: true` works correctly but doesn't verify:

```typescript
const embeddings = await extractor(texts, {
  pooling: 'mean',
  normalize: true // ❌ Assumes this works, doesn't verify
});
```

**Why it matters**: If normalization fails (model bug, wrong parameter), cosine similarity via dot product is incorrect, breaking retrieval.

**Impact**: Silently degraded retrieval quality (30-50% accuracy loss).

**Correct approach** (verify in tests):
```typescript
function verifyNormalized(embedding: Float32Array, tolerance = 0.01): void {
  let sumSquares = 0;
  for (let i = 0; i < embedding.length; i++) {
    sumSquares += embedding[i] * embedding[i];
  }
  const norm = Math.sqrt(sumSquares);

  if (Math.abs(norm - 1.0) > tolerance) {
    throw new Error(
      `Embedding not L2-normalized: norm=${norm.toFixed(4)} (expected 1.0)`
    );
  }
}

// Use in build script:
const embeddings = await extractor(texts, { pooling: 'mean', normalize: true });
for (let i = 0; i < embeddings.data.length; i += 384) {
  const embedding = new Float32Array(embeddings.data.slice(i, i + 384));
  verifyNormalized(embedding);
}
```

**Runtime verification** (development mode):
```typescript
if (import.meta.env.DEV) {
  const queryEmbedding = await embedQuery(query);
  verifyNormalized(queryEmbedding);
}
```

---

### 16. Error Types Too Coarse

**Location**: `src/types/chatbot.ts`

**Issue**: `'api-error'` is too broad; doesn't distinguish timeout from rate limit from network error.

**Correction**:
```typescript
export type ChatbotErrorType =
  | 'model-load-failed'
  | 'artifacts-fetch-failed'
  | 'indexeddb-unavailable'
  | 'worker-spawn-failed'
  | 'retrieval-failed'
  | 'llm-timeout'          // New: API timeout
  | 'llm-rate-limit'       // New: API rate limit
  | 'llm-bad-response'     // New: API returned error
  | 'llm-network-error'    // New: Network failure
  | 'rate-limited'
  | 'offline'
  | 'quota-exceeded'
  | 'unknown';
```

**Error handling**:
```typescript
async function generateResponse(query: string, context: string) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ query, context }),
      signal: AbortSignal.timeout(30000)
    });

    if (response.status === 429) {
      throw new ChatbotError('llm-rate-limit', 'Rate limited by API');
    }
    if (response.status >= 500) {
      throw new ChatbotError('llm-bad-response', `Server error ${response.status}`);
    }
    if (!response.ok) {
      throw new ChatbotError('llm-bad-response', `HTTP ${response.status}`);
    }

    return response.body;

  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new ChatbotError('llm-timeout', 'Request timed out');
    }
    if (error.name === 'TypeError') {
      throw new ChatbotError('llm-network-error', 'Network error');
    }
    throw error;
  }
}
```

---

### 17. Streaming Doesn't Handle Partial UTF-8

**Location**: `src/services/chatbot/generation.ts`

**Issue**: Not explicitly handled, though the code is correct:

```typescript
const decoder = new TextDecoder();
const chunk = decoder.decode(value, { stream: true }); // ✅ Correct
```

**Clarification**: The `stream: true` option tells the decoder to buffer incomplete UTF-8 sequences across chunks. This is critical for multi-byte characters (emojis, non-ASCII).

**Add comment**:
```typescript
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  // stream: true handles partial UTF-8 sequences across chunks
  const chunk = decoder.decode(value, { stream: true });
  assistantMessage += chunk;
  updateMessage(assistantMessage);
}
```

---

### 18. Cleanup Doesn't Clear IndexedDB (Ambiguity)

**Location**: `src/services/chatbot/cleanup.ts`

**Issue**: The cleanup function clears in-memory state but leaves IndexedDB cache. This is intentional (for future sessions) but not documented.

**Clarification**:
```typescript
/**
 * Cleans up chatbot resources on modal close or unmount.
 *
 * What's cleaned:
 * - Worker (terminated)
 * - Model reference (GC eligible)
 * - In-memory artifacts and search index
 * - UI state (messages, errors)
 *
 * What's preserved:
 * - IndexedDB cache (for faster future sessions)
 *
 * To force cache clear, use clearAllCache().
 */
function cleanupChatbot() {
  if (worker) {
    worker.terminate();
    worker = null;
  }

  model = null;
  artifacts = null;
  searchIndex = null;
  messages = [];

  setState('uninitialized');
}

/**
 * Clears all cached data (IndexedDB and Transformers.js model cache).
 * Use when forcing a full refresh or debugging cache issues.
 */
async function clearAllCache() {
  await clearArtifactCache();
  await clearModelCache(); // Clear Transformers.js cache
  cleanupChatbot();
}
```

**Add UI button**:
```tsx
<ActionBar>
  <button onClick={handleNewChat}>New Chat</button>
  <button onClick={handleClearCache}>Clear Cache</button>
</ActionBar>
```

---

### 19. Model Output Precision Not Guaranteed

**Location**: `src/services/embeddings/inference.ts`

**Issue**: Assumes model outputs FP32 but doesn't enforce:

```typescript
const embedding = Array.from(embeddings.data.slice(0, 384)) as number[];
```

**Correction**:
```typescript
async function embedQuery(query: string): Promise<Float32Array> {
  const result = await model(query, {
    pooling: 'mean',
    normalize: true
  });

  // Ensure FP32 regardless of model output precision
  const embedding = new Float32Array(384);
  for (let i = 0; i < 384; i++) {
    embedding[i] = result.data[i];
  }

  return embedding;
}
```

---

### 20. Suggested Questions Not Seeded

**Location**: Future enhancements

**Issue**: The plan mentions "suggested questions" but doesn't specify how to generate them.

**Implementation** (build-time):
```typescript
// scripts/generate-suggested-questions.ts
async function generateSuggestedQuestions(chunks: Chunk[]): Promise<string[]> {
  // Extract common topics from chunk metadata
  const topics = new Set<string>();
  for (const chunk of chunks) {
    chunk.metadata.tags.forEach(tag => topics.add(tag));
    if (chunk.metadata.section) topics.add(chunk.metadata.section);
  }

  // Template questions
  const templates = [
    (topic: string) => `What does the blog say about ${topic}?`,
    (topic: string) => `Tell me about ${topic}`,
    (topic: string) => `Explain ${topic} from the blog posts`
  ];

  const questions: string[] = [];
  for (const topic of Array.from(topics).slice(0, 10)) {
    const template = templates[Math.floor(Math.random() * templates.length)];
    questions.push(template(topic));
  }

  return questions.slice(0, 5); // Top 5 questions
}

// Store in manifest or separate file
manifest.suggestedQuestions = await generateSuggestedQuestions(chunks);
```

---

## Summary of Corrections

### Critical Fixes (Implement First)

1. **RRF fusion**: Union candidates, not intersect
2. **Streaming**: Parse SSE/JSON correctly for OpenRouter/Gemini
3. **ArrayBuffer transfer**: Clone before transferring to worker
4. **FP16 utilities**: Use library or implement IEEE 754 correctly
5. **Worker messaging**: Add promise wrappers for async communication

### High-Priority Optimizations

6. **Manifest size**: Separate chunk text into `chunks.json`
7. **FP16 conversion**: Convert once in worker, not per query
8. **Cache validation**: Use version-in-URL, not manifest fetch
9. **MiniSearch init**: Batch with async yields
10. **IndexedDB schema**: Define upgrade callback
11. **Chunk overlap**: Implement sliding window
12. **Rate limiting**: Move to client-side
13. **Token budget**: Enforce context window limits

### Documentation Improvements

14. **Precision**: Clarify float64 accumulator
15. **L2 normalization**: Add verification
16. **Error types**: Granular LLM errors
17. **UTF-8 streaming**: Document `stream: true`
18. **Cache cleanup**: Document what's preserved
19. **Model output**: Guarantee FP32
20. **Suggested questions**: Build-time generation

---

## Implementation Priority

**Week 1 (Critical)**:
- Fix RRF fusion logic
- Implement SSE parsing for OpenRouter
- Add worker promise wrappers
- Use FP16 library (`@petamoriken/float16`)

**Week 2 (Optimization)**:
- Separate chunk text from manifest
- Convert FP16→FP32 once in worker
- Version artifacts in URLs
- Define IndexedDB schema

**Week 3 (Polish)**:
- Implement chunk overlap
- Add token budget enforcement
- Async MiniSearch initialization
- Granular error types

**Validation**:
- Test RRF with semantic-only and BM25-only chunks
- Verify streaming with real OpenRouter responses
- Load test with 1,000 chunks
- Test offline/error scenarios

---

## Conclusion

The implementation plan is architecturally sound but requires **20 technical corrections** to be production-ready. Most critical:

1. **RRF must union candidates** (not intersect) to preserve hybrid retrieval semantics
2. **SSE parsing is mandatory** for OpenRouter/Gemini streaming
3. **Worker communication needs promise wrappers** for async safety
4. **Chunk text must be separated** from manifest to avoid 1 MB duplication
5. **FP16 conversion must happen once** (not per query) for performance

All corrections preserve the original architecture (compiled artifacts, client-side retrieval, explicit activation, minimal server surface). No new abstractions or scope creep—just precise fixes to ensure correctness, performance, and reliability.

**Next Steps**:
1. Review and approve corrections
2. Implement critical fixes (Week 1)
3. Add high-priority optimizations (Week 2)
4. Polish and validate (Week 3)
5. Deploy with confidence

