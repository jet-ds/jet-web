import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
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
  }),
});

const worksCollection = defineCollection({
  type: 'content',
  schema: z.object({
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
  }),
});

export const collections = {
  blog: blogCollection,
  works: worksCollection,
};
