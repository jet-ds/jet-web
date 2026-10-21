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
import { resolveContentImage } from '../features/media/registry.server';
import { assetKeyPattern } from '../features/media/contract';

const publicationFields = {
  status: z.enum(['draft', 'published']),
  assistant: z.boolean().default(false),
};

const presentationSchema = z.object({
  url: z.string(),
  width: z.number(),
  height: z.number(),
  srcSet: z.string().optional(),
});
const blogImageSchema = presentationSchema.extend({
  asset: z.string().optional(),
  alt: z.string(),
  social: presentationSchema.optional(),
  carousel: presentationSchema.optional(),
});
const worksImageSchema = blogImageSchema.extend({
  darkAsset: z.string().optional(),
  darkUrl: z.string().optional(),
  darkSrcSet: z.string().optional(),
  darkCarousel: presentationSchema.optional(),
});
function requirePublishedDisplayFields(
  data: {
    status: 'draft' | 'published';
    summary?: string;
    image?: { alt: string; width: number; height: number };
  },
  context: z.RefinementCtx,
): void {
  if (data.status !== 'published') return;
  if (data.summary === undefined)
    context.addIssue({
      code: 'custom',
      path: ['summary'],
      message: 'Published content requires an authored summary.',
    });
  if (!data.image)
    context.addIssue({
      code: 'custom',
      path: ['image'],
      message: 'Published content requires a featured image.',
    });
  else {
    if (!data.image.alt.trim())
      context.addIssue({
        code: 'custom',
        path: ['image', 'alt'],
        message: 'Published images require descriptive alternative text.',
      });
    if (data.image.width !== 1920 || data.image.height !== 1080)
      context.addIssue({
        code: 'custom',
        path: ['image'],
        message: 'Published image dimensions must be exactly 1920x1080 pixels.',
      });
  }
}
function authoredImage(lane: 'blog' | 'works', root: string) {
  const base = z
    .object({ asset: z.string().regex(assetKeyPattern), alt: z.string() })
    .strict();
  const input =
    lane === 'works'
      ? base.extend({ darkAsset: z.string().regex(assetKeyPattern).optional() })
      : base;
  return input.transform((reference, context) => {
    try {
      return resolveContentImage(reference, lane, root);
    } catch {
      context.addIssue({
        code: 'custom',
        message:
          'Image requires a complete, valid descriptor in its collection lane.',
      });
      return z.NEVER;
    }
  });
}
/**
 * Blog post frontmatter schema
 */
export const resolvedBlogSchema = z
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
  .superRefine((data, context) => requirePublishedDisplayFields(data, context));

/**
 * Works item frontmatter schema
 */
export const resolvedWorksSchema = z
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
  .superRefine((data, context) => requirePublishedDisplayFields(data, context));

export function createContentSchemas(root = process.cwd()) {
  return {
    blogSchema: z
      .object({
        ...resolvedBlogSchema.shape,
        image: authoredImage('blog', root).optional(),
      })
      .superRefine(requirePublishedDisplayFields),
    worksSchema: z
      .object({
        ...resolvedWorksSchema.shape,
        image: authoredImage('works', root).optional(),
      })
      .superRefine(requirePublishedDisplayFields),
  };
}
export const { blogSchema, worksSchema } = createContentSchemas();

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
  organizationUrl: z.url(),
  award: z.string().optional(),
  researchAreas: z.array(z.string()),
  technicalFocus: z.array(z.string()),
  connectText: z.string(),
});

/**
 * Type inference from schemas
 */
export type BlogFrontmatter = z.infer<typeof resolvedBlogSchema>;
export type WorksFrontmatter = z.infer<typeof resolvedWorksSchema>;
export type ProfileFrontmatter = z.infer<typeof profileSchema>;
