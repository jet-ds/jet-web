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
 * 3. Render to extract body
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
    // Step 3: Render to extract body
    const rendered = await entry.render();
    const rawBody = rendered.body || '';

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
// Main Execution
// ============================================================================

async function main() {
  try {
    console.log('🤖 RAG Chatbot Build Pipeline');
    console.log('   Implementation Plan v1.5 (Bulletproof)\n');

    // Phase 1: Content Discovery
    const contentItems = await discoverContent();

    console.log('✓ Phase 1 Complete');
    console.log(`  Total items: ${contentItems.length}`);

    // TODO: Phase 2 - Chunking
    // TODO: Phase 3 - Embedding Generation
    // TODO: Phase 4 - Serialization
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
