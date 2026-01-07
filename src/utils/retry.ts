/**
 * Retry Utility with Exponential Backoff
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.7
 * Spec: Phase 5 - Error Handling & Polish
 *
 * Implements retry logic for recoverable errors with exponential backoff.
 */

import { ChatbotError, isRecoverableError } from '../types/chatbot';

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
};

/**
 * Retry a function with exponential backoff
 *
 * Process:
 * 1. Attempt the operation
 * 2. If it fails with a recoverable error, wait and retry
 * 3. Use exponential backoff: delay = min(initialDelay * backoffMultiplier^attempt, maxDelay)
 * 4. If max retries exceeded, throw the last error
 *
 * @param fn - Async function to retry
 * @param config - Retry configuration
 * @returns Result of the function
 * @throws Last error if all retries exhausted
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | ChatbotError;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // Don't retry if error is not recoverable
      if (error instanceof ChatbotError && !isRecoverableError(error.type)) {
        throw error;
      }

      // Don't retry if we've exhausted retries
      if (attempt === config.maxRetries) {
        console.error(`[Retry] Max retries (${config.maxRetries}) exceeded`);
        throw lastError;
      }

      // Calculate exponential backoff delay
      const delay = Math.min(
        config.initialDelay * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelay
      );

      console.warn(
        `[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`,
        lastError.message
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript requires it
  throw lastError!;
}

/**
 * Retry configuration for specific operations
 */
export const RETRY_CONFIGS = {
  /** Model loading: More retries, longer delays */
  modelLoad: {
    maxRetries: 3,
    initialDelay: 2000,
    maxDelay: 15000,
    backoffMultiplier: 2,
  } as RetryConfig,

  /** Artifact fetching: Standard retries */
  artifactFetch: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  } as RetryConfig,

  /** API calls: Faster retries */
  apiCall: {
    maxRetries: 2,
    initialDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 2,
  } as RetryConfig,
};
