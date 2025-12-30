/**
 * Filesystem Content Loader
 *
 * Reads MDX files directly from the filesystem and validates them
 * against the content collection schemas. This approach bypasses
 * Astro's virtual module system (astro:content) which is only
 * available within Astro's build context.
 *
 * Why not use getCollection()?
 * - astro:content is a Vite virtual module
 * - Only available during Astro's build process
 * - Cannot be imported in standalone Node.js scripts
 *
 * This approach:
 * - Works in standalone scripts (tsx, node)
 * - Validates using the same Zod schemas
 * - Reads the same MDX files Astro uses
 * - Simple, reliable, and portable
 */

import { readdir, readFile } from 'fs/promises';
import matter from 'gray-matter';
import path from 'path';
import { z } from 'zod';

// Define schemas inline (must match src/content/config.ts)
const blogSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  author: z.string().default('Jet'),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  image: z.object({
    url: z.string(),
    alt: z.string(),
  }).optional(),
});

const worksSchema = z.object({
  title: z.string(),
  description: z.string(),
  type: z.enum(['research', 'project', 'other']),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  links: z.array(z.object({
    label: z.string(),
    url: z.string(),
  })).optional(),
  venue: z.string().optional(),
  abstract: z.string().optional(),
  technologies: z.array(z.string()).optional(),
  repository: z.string().optional(),
  demo: z.string().optional(),
});

/**
 * Content item interface (matches build script expectations)
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
 * Load a single content collection from the filesystem
 */
async function loadCollection(
  collectionName: 'blog' | 'works',
  schema: z.ZodSchema
): Promise<ContentItem[]> {
  const contentDir = path.join(process.cwd(), 'src/content', collectionName);

  let files: string[];
  try {
    files = await readdir(contentDir);
  } catch (error) {
    console.warn(`⚠️  Could not read ${collectionName} directory:`, error);
    return [];
  }

  const mdxFiles = files.filter(f => f.endsWith('.mdx') || f.endsWith('.md'));

  const items = await Promise.all(
    mdxFiles.map(async (file) => {
      const filePath = path.join(contentDir, file);

      try {
        const rawContent = await readFile(filePath, 'utf-8');
        const { data, content } = matter(rawContent);

        // Validate frontmatter with schema
        let validated;
        try {
          validated = schema.parse(data);
        } catch (error) {
          console.warn(`⚠️  Invalid frontmatter in ${collectionName}/${file}:`);
          if (error instanceof z.ZodError) {
            error.errors.forEach(err => {
              console.warn(`   - ${err.path.join('.')}: ${err.message}`);
            });
          }
          return null;
        }

        // Skip drafts (blog only)
        if (collectionName === 'blog' && validated.draft) {
          console.log(`   Skipping draft: ${file}`);
          return null;
        }

        const slug = file.replace(/\.(mdx|md)$/, '');

        return {
          id: `${collectionName}/${slug}`,
          slug,
          type: collectionName,
          title: validated.title,
          content: content.trim(),
          metadata: {
            tags: validated.tags || [],
            pubDate: collectionName === 'blog' ? validated.pubDate : undefined,
            date: collectionName === 'works' ? validated.date : undefined,
            author: validated.author,
          },
        } as ContentItem;
      } catch (error) {
        console.error(`❌ Error reading ${collectionName}/${file}:`, error);
        return null;
      }
    })
  );

  return items.filter((item): item is ContentItem => item !== null);
}

/**
 * Discover all content from blog and works collections
 *
 * This replaces the Astro-specific getCollection() approach
 * with direct filesystem reading.
 */
export async function discoverContent(): Promise<ContentItem[]> {
  console.log('📁 Phase 1: Content Discovery (Filesystem)');

  const [blogItems, worksItems] = await Promise.all([
    loadCollection('blog', blogSchema),
    loadCollection('works', worksSchema),
  ]);

  const total = blogItems.length + worksItems.length;
  console.log(`   Found ${total} entries (${blogItems.length} blog, ${worksItems.length} works)`);

  if (total === 0) {
    console.warn('⚠️  No content found! Check that src/content/{blog,works} contain MDX files.');
  }

  return [...blogItems, ...worksItems];
}
