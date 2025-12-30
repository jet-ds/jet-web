import { defineCollection } from 'astro:content';
import { blogSchema, worksSchema } from '../schemas/content';

const blogCollection = defineCollection({
  type: 'content',
  schema: blogSchema,
});

const worksCollection = defineCollection({
  type: 'content',
  schema: worksSchema,
});

export const collections = {
  blog: blogCollection,
  works: worksCollection,
};
