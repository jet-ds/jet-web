/**
 * Shared Content Collection Schemas
 *
 * These schemas are used by both:
 * - Astro content collections (src/content/config.ts)
 * - Build scripts (scripts/content-loader.ts)
 *
 * Using zod directly (not astro:content) so they can be imported
 * in standalone Node.js scripts.
 */

import { z } from 'zod';

/**
 * Blog post frontmatter schema
 */
export const blogSchema = z.object({
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

/**
 * Works item frontmatter schema
 */
export const worksSchema = z.object({
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
  // For research papers
  venue: z.string().optional(),
  abstract: z.string().optional(),
  // For projects
  technologies: z.array(z.string()).optional(),
  repository: z.string().optional(),
  demo: z.string().optional(),
});

/**
 * Type inference from schemas
 */
export type BlogFrontmatter = z.infer<typeof blogSchema>;
export type WorksFrontmatter = z.infer<typeof worksSchema>;
