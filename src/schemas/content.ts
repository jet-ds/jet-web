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
import { isImmutableContentImageUrl } from '../content/validation';

const publicationFields = {
  status: z.enum(['draft', 'published']),
  assistant: z.boolean().default(false),
};

const blogImageSchema = z.object({
  url: z.string(),
  alt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const worksImageSchema = blogImageSchema.extend({
  darkUrl: z.string().optional(),
});

function requirePublishedDisplayFields(
  data: {
    status: 'draft' | 'published';
    summary?: string;
    image?: {
      url: string;
      darkUrl?: string;
      alt: string;
      width: number;
      height: number;
    };
  },
  context: z.RefinementCtx,
  collection: 'blog' | 'works',
): void {
  if (data.status !== 'published') return;

  if (data.summary === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['summary'],
      message: 'Published content requires an authored summary.',
    });
  }

  if (data.image === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['image'],
      message: 'Published content requires a featured image.',
    });
    return;
  }

  if (!isImmutableContentImageUrl(data.image.url, collection)) {
    context.addIssue({
      code: 'custom',
      path: ['image', 'url'],
      message: 'Published images require an immutable HTTPS Blob URL.',
    });
  }
  if (
    data.image.darkUrl !== undefined &&
    !isImmutableContentImageUrl(data.image.darkUrl, collection)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['image', 'darkUrl'],
      message: 'Published dark images require an immutable HTTPS Blob URL.',
    });
  }
  if (data.image.alt.trim() === '') {
    context.addIssue({
      code: 'custom',
      path: ['image', 'alt'],
      message: 'Published images require descriptive alternative text.',
    });
  }
  if (data.image.width !== 1920) {
    context.addIssue({
      code: 'custom',
      path: ['image', 'width'],
      message: 'Published image width must be exactly 1920 pixels.',
    });
  }
  if (data.image.height !== 1080) {
    context.addIssue({
      code: 'custom',
      path: ['image', 'height'],
      message: 'Published image height must be exactly 1080 pixels.',
    });
  }
}

/**
 * Blog post frontmatter schema
 */
export const blogSchema = z
  .object({
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
    image: blogImageSchema.optional(),
  })
  .superRefine((data, context) =>
    requirePublishedDisplayFields(data, context, 'blog'),
  );

/**
 * Works item frontmatter schema
 */
export const worksSchema = z
  .object({
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
    homepagePriority: z.number().int().positive().optional(),
    image: worksImageSchema.optional(),
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
  })
  .superRefine((data, context) =>
    requirePublishedDisplayFields(data, context, 'works'),
  );

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
