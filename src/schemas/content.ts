/**
 * Shared Content Collection Schemas
 *
 * These schemas are used by both:
 * - Astro content collections (src/content.config.ts)
 * - Build scripts (scripts/content-loader.ts)
 *
 * Using zod directly (not astro:content) so they can be imported
 * in standalone Node.js scripts.
 */

import { z } from 'zod';

const publicationFields = {
  status: z.enum(['draft', 'published']),
  assistant: z.boolean().default(false),
};

/**
 * Blog post frontmatter schema
 */
export const blogSchema = z.object({
  title: z.string(),
  shortTitle: z.string().trim().min(1).max(80).optional(),
  seoTitle: z.string().trim().min(1).optional(),
  seoDescription: z.string().trim().min(1).max(160).optional(),
  description: z.string(),
  summary: z.string().trim().min(1).max(160).optional(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  author: z.string().default('Jet Sanchez'),
  tags: z.array(z.string()).default([]),
  ...publicationFields,
  review: z
    .object({
      itemType: z.literal('movie'),
      itemName: z.string().trim().min(1),
      ratingValue: z.number().int().min(1).max(5),
      bestRating: z.literal(5),
    })
    .optional(),
  image: z
    .object({
      url: z.string(),
      alt: z.string(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional(),
});

/**
 * Works item frontmatter schema
 */
export const worksSchema = z.object({
  title: z.string(),
  shortTitle: z.string().trim().min(1).max(80).optional(),
  seoTitle: z.string().trim().min(1).optional(),
  seoDescription: z.string().trim().min(1).max(160).optional(),
  description: z.string(),
  summary: z.string().trim().min(1).max(160).optional(),
  type: z.enum(['research', 'project', 'other']),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  ...publicationFields,
  featured: z.boolean().default(false),
  image: z
    .object({
      url: z.string(),
      darkUrl: z.string().optional(),
      alt: z.string(),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
    })
    .optional(),
  links: z
    .array(
      z.object({
        label: z.string(),
        url: z.string(),
      }),
    )
    .optional(),
  // For research papers
  venue: z.string().optional(),
  abstract: z.string().optional(),
  // For projects
  technologies: z.array(z.string()).optional(),
  repository: z.string().optional(),
  demo: z.string().optional(),
});

/**
 * Canonical public profile used by About, Person structured data, and Egregore.
 */
export const profileSchema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  author: z.string(),
  ...publicationFields,
  role: z.string(),
  organization: z.string(),
  researchAreas: z.array(z.string()),
  technicalFocus: z.array(z.string()),
  connectText: z.string(),
});

/**
 * Type inference from schemas
 */
export type BlogFrontmatter = z.infer<typeof blogSchema>;
export type WorksFrontmatter = z.infer<typeof worksSchema>;
export type ProfileFrontmatter = z.infer<typeof profileSchema>;
