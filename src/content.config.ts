import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { blogSchema, worksSchema } from './schemas/content';

const blogCollection = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/data/blog' }),
  schema: blogSchema,
});

const worksCollection = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/data/works' }),
  schema: worksSchema,
});

export const collections = {
  blog: blogCollection,
  works: worksCollection,
};
