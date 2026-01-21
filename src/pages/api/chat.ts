/**
 * Chat API Endpoint - Streaming RAG Responses
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.7
 * Spec: Phase 4 - LLM Integration
 *
 * Receives user query with retrieved context, calls OpenRouter API for
 * streaming response generation. Returns Server-Sent Events (SSE) stream.
 *
 * Rate Limiting: Best-effort in-memory (not effective in serverless)
 * For production: Use Vercel KV, Upstash, or middleware
 */

import type { APIRoute } from 'astro';

// Mark this endpoint as server-rendered (not static)
export const prerender = false;

/**
 * Chat request payload
 */
interface ChatRequest {
  query: string;
  context: string; // Pre-formatted context with attribution
  sources: Array<{
    title: string;
    url: string;
  }>;
}

/**
 * POST /api/chat - Generate streaming response from retrieved context
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const { query, context } = (await request.json()) as ChatRequest;

    // Validate input
    if (!query || !context) {
      return new Response('Missing query or context', { status: 400 });
    }

    // Rate limiting (best-effort)
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (await isRateLimited(ip)) {
      return new Response('Rate limit exceeded. Please try again in a minute.', {
        status: 429,
      });
    }

    // Generate streaming response
    const stream = await generateResponse(query, context);

    // Return SSE stream
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[Chat API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * Generate streaming response using OpenRouter API
 *
 * Process:
 * 1. Call OpenRouter with Llama 3.1 8B Instruct
 * 2. Parse SSE format (data: {...})
 * 3. Extract content deltas
 * 4. Stream to client
 *
 * @param query - User query
 * @param context - Retrieved chunks with attribution
 * @returns ReadableStream of text chunks
 */
async function generateResponse(
  query: string,
  context: string
): Promise<ReadableStream> {
  const apiKey = import.meta.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  // Call OpenRouter API
  let response: Response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://jet-web.vercel.app', // Optional: for OpenRouter analytics
        'X-Title': 'Jet Blog RAG Chatbot', // Optional: for OpenRouter analytics
      },
      body: JSON.stringify({
        model: 'xiaomi/mimo-v2-flash:free',
        route: 'fallback',
        models: [
          'xiaomi/mimo-v2-flash:free',
          'google/gemma-3-27b-it:free',
          'meta-llama/llama-3.3-70b-instruct:free',
        ],
        messages: [
          {
            role: 'system',
            content: `You are Jet Sanchez's blog assistant, helping visitors explore content about AI research, marketing engineering, and practical AI systems.

IDENTITY & CONTEXT:
- You represent Jet's blog at jetsanchez.com
- The blog covers AI research, AI safety, marketing engineering, SEO/GEO strategy, and agentic AI
- Jet is a marketing engineer and AI researcher at Digital Squad

CRITICAL CITATION RULES:
- Cite sources using superscript numbers (¹, ², ³) at the end of sentences
- Example: "Claude Code uses React 19.² The architecture is well-designed.¹"
- ONLY cite sources that directly support your statement
- If you use information from Source 2, cite it as ²

RESPONSE GUIDELINES:
- Answer ONLY based on the provided context
- If context doesn't contain the answer, say "I don't have information about that in Jet's blog content"
- Be concise (2-4 sentences) but informative
- Use a friendly, knowledgeable tone
- DO NOT make up information`,
          },
          {
            role: 'user',
            content: `Context:\n${context}\n\nQuestion: ${query}`,
          },
        ],
        stream: true,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });
  } catch (fetchError) {
    console.error('[generateResponse] Fetch error:', fetchError);
    throw new Error(`Failed to reach OpenRouter API: ${fetchError instanceof Error ? fetchError.message : 'Network error'}`);
  }

  if (!response.ok) {
    const error = await response.text();
    console.error('[generateResponse] OpenRouter error response:', error);
    throw new Error(
      `OpenRouter API error (${response.status}): ${error}`
    );
  }

  // Transform OpenRouter SSE to plain text chunks
  return parseOpenRouterSSE(response.body!);
}

/**
 * Extract content from OpenRouter SSE JSON
 *
 * @param data - SSE data string to parse
 * @returns Extracted content or null if invalid
 */
function extractContentFromSSE(data: string): string | null {
  try {
    const json = JSON.parse(data);
    return json.choices?.[0]?.delta?.content || null;
  } catch {
    return null;
  }
}

/**
 * Parse OpenRouter Server-Sent Events (SSE) format
 *
 * OpenRouter SSE format:
 * data: {"choices":[{"delta":{"content":"text"}}]}
 * data: [DONE]
 *
 * @param stream - OpenRouter response body stream
 * @returns ReadableStream of text chunks
 */
function parseOpenRouterSSE(stream: ReadableStream<Uint8Array>): ReadableStream {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Process any remaining data in buffer before closing
            if (buffer.trim()) {
              const lines = buffer.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  if (data && data !== '[DONE]') {
                    const content = extractContentFromSSE(data);
                    if (content) {
                      controller.enqueue(new TextEncoder().encode(content));
                    } else if (data) {
                      console.warn('[Chat API] Malformed SSE data in final buffer:', data);
                    }
                  }
                }
              }
            }
            controller.close();
            return;
          }

          // Decode chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });

          // Split by newlines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          // Process each complete line
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();

              // Check for end of stream
              if (data === '[DONE]') {
                controller.close();
                return;
              }

              // Extract and enqueue content
              const content = extractContentFromSSE(data);
              if (content) {
                controller.enqueue(new TextEncoder().encode(content));
              } else if (data) {
                console.warn('[Chat API] Malformed SSE data:', data);
              }
            }
          }
        }
      } catch (error) {
        console.error('[Chat API] Stream error:', error);
        controller.error(error);
      }
    },
  });
}

/**
 * Best-effort in-memory rate limiting
 *
 * WARNING: Not effective in Vercel serverless environment (each invocation
 * is isolated). For production, use:
 * - Vercel KV (Redis)
 * - Upstash
 * - Middleware with persistent storage
 *
 * Limit: 5 requests per minute per IP
 */
const rateLimitMap = new Map<string, number[]>();

async function isRateLimited(ip: string): Promise<boolean> {
  const now = Date.now();
  const limit = 5; // requests per window
  const windowMs = 60 * 1000; // 1 minute

  // Get timestamps for this IP
  let timestamps = rateLimitMap.get(ip) || [];

  // Remove timestamps outside the window
  timestamps = timestamps.filter((ts) => now - ts < windowMs);

  // Check if limit exceeded
  if (timestamps.length >= limit) {
    return true; // Rate limited
  }

  // Add current timestamp
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);

  // Cleanup old entries (memory management)
  if (rateLimitMap.size > 1000) {
    const keysToDelete: string[] = [];
    for (const [key, ts] of rateLimitMap.entries()) {
      if (ts.every((t) => now - t > windowMs)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => rateLimitMap.delete(key));
  }

  return false; // Not rate limited
}
