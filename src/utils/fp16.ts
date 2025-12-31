/**
 * FP16 Deserialization Utilities
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.7
 * Spec: Precision Discipline section
 *
 * Handles conversion of FP16 binary embeddings to FP32 Float32Array
 * for use in similarity computations.
 *
 * Precision Flow:
 * 1. Storage: FP16 (2 bytes per value, 50% size reduction)
 * 2. Deserialization: FP16 → FP32 (Float32Array)
 * 3. Computation: float64 accumulation (JavaScript default)
 */

import { getFloat16 } from '@petamoriken/float16';

/**
 * Deserializes a single embedding from FP16 buffer to FP32 Float32Array
 *
 * Process:
 * 1. Read 384 × 2 bytes (FP16) from buffer at specified offset
 * 2. Convert each FP16 value to FP32 using @petamoriken/float16
 * 3. Return Float32Array for efficient dot product computation
 *
 * @param fp16Buffer - DataView over embeddings.bin ArrayBuffer
 * @param embeddingIndex - Index of embedding to extract (0-based)
 * @param dimensions - Embedding dimensions (default: 384)
 * @returns Float32Array with deserialized embedding
 */
export function deserializeEmbedding(
  fp16Buffer: DataView,
  embeddingIndex: number,
  dimensions: number = 384
): Float32Array {
  const fp32 = new Float32Array(dimensions);
  const byteOffset = embeddingIndex * dimensions * 2; // 2 bytes per FP16

  for (let i = 0; i < dimensions; i++) {
    // Read FP16 value (little-endian) and convert to FP32
    const fp16Value = getFloat16(fp16Buffer, byteOffset + i * 2, true);
    fp32[i] = fp16Value;
  }

  return fp32;
}

/**
 * Deserializes all embeddings from FP16 buffer to FP32 Float32Array[]
 *
 * Used for one-time deserialization in Web Worker initialization.
 * After this, all embeddings are stored as Float32Array for fast access.
 *
 * @param embeddingsBuffer - Full embeddings.bin ArrayBuffer
 * @param numEmbeddings - Total number of embeddings
 * @param dimensions - Embedding dimensions (default: 384)
 * @returns Array of Float32Array embeddings
 */
export function deserializeAllEmbeddings(
  embeddingsBuffer: ArrayBuffer,
  numEmbeddings: number,
  dimensions: number = 384
): Float32Array[] {
  const view = new DataView(embeddingsBuffer);
  const embeddings: Float32Array[] = [];

  for (let i = 0; i < numEmbeddings; i++) {
    embeddings.push(deserializeEmbedding(view, i, dimensions));
  }

  return embeddings;
}

/**
 * Computes dot product between two FP32 embeddings
 *
 * CRITICAL: Uses float64 accumulation (JavaScript default)
 * - Input: Float32Array (FP32 values)
 * - Accumulation: float64 (JavaScript number type)
 * - Output: number (float64)
 *
 * Since embeddings are L2-normalized, dot product = cosine similarity
 *
 * @param a - First embedding (Float32Array)
 * @param b - Second embedding (Float32Array)
 * @returns Dot product (cosine similarity for normalized vectors)
 */
export function dotProduct(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(
      `Dimension mismatch: ${a.length} !== ${b.length}`
    );
  }

  let sum = 0; // float64 accumulator (JavaScript default)

  for (let i = 0; i < a.length; i++) {
    // FP32 × FP32 → promoted to float64 for accumulation
    sum += a[i] * b[i];
  }

  return sum;
}

/**
 * L2 normalization (for query embeddings that may not be normalized)
 *
 * @param vector - Embedding vector
 * @returns L2-normalized vector (unit vector)
 */
export function l2Normalize(vector: Float32Array): Float32Array {
  const norm = Math.sqrt(dotProduct(vector, vector));

  if (norm === 0) {
    throw new Error('Cannot normalize zero vector');
  }

  const normalized = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    normalized[i] = vector[i] / norm;
  }

  return normalized;
}
