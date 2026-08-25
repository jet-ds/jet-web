import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import matter from 'gray-matter';
import { loadTrackedContentPaths } from '../../src/content/gitTracking';
import {
  resolveBlogCollection,
  resolveHomepageBlog,
  resolveHomepageWorks,
  resolveWorksCollection,
  type BlogEntry,
  type WorkEntry,
} from '../../src/features/collections/resolveCollections';
import type { CollectionDisplayRecord } from '../../src/features/collections/types';
import {
  blogSchema,
  profileSchema,
  worksSchema,
} from '../../src/schemas/content';

export type PublishedContent = {
  kind: 'blog' | 'work';
  sourceId: `blog:${string}` | `works:${string}`;
  route: string;
  title: string;
  shortTitle?: string;
  seoTitle?: string;
  description: string;
  seoDescription?: string;
  summary?: string;
  date: Date;
  dateModified?: Date;
  assistant: boolean;
  entityType: 'BlogPosting' | 'ScholarlyArticle' | 'CreativeWork';
  openGraphType: 'article' | 'website';
  image?: { width?: number; height?: number };
  links?: Array<{ label: string; url: string }>;
  identifier?: string;
  author?: string;
  review?: {
    itemType: 'movie';
    itemName: string;
    ratingValue: number;
    bestRating: 5;
  };
};

export type PublishedAssistantSource = {
  id: `blog:${string}` | `works:${string}` | `profile:${string}`;
  route: string;
};

export function publishedContent(): PublishedContent[] {
  const root = process.cwd();
  const trackedPaths = [...loadTrackedContentPaths(root)];
  const blogs = trackedPaths
    .filter(
      (path) => path.startsWith('src/data/blog/') && path.endsWith('.mdx'),
    )
    .flatMap((path): PublishedContent[] => {
      const data = blogSchema.parse(
        matter(readFileSync(resolve(root, path), 'utf8')).data,
      );
      if (data.status !== 'published') return [];
      const slug = path
        .replace(/^src\/data\/blog\//u, '')
        .replace(/\.mdx$/u, '');
      return [
        {
          kind: 'blog',
          sourceId: `blog:${slug}`,
          route: `/blog/${slug}/`,
          title: data.title,
          shortTitle: data.shortTitle,
          seoTitle: data.seoTitle,
          description: data.description,
          seoDescription: data.seoDescription,
          summary: data.summary,
          date: data.pubDate,
          dateModified: data.updatedDate ?? data.pubDate,
          assistant: data.assistant,
          entityType: 'BlogPosting',
          openGraphType: 'article',
          image: data.image,
          author: data.author,
          review: data.review,
        },
      ];
    });
  const works = trackedPaths
    .filter(
      (path) => path.startsWith('src/data/works/') && path.endsWith('.mdx'),
    )
    .flatMap((path): PublishedContent[] => {
      const data = worksSchema.parse(
        matter(readFileSync(resolve(root, path), 'utf8')).data,
      );
      if (data.status !== 'published') return [];
      const slug = path
        .replace(/^src\/data\/works\//u, '')
        .replace(/\.mdx$/u, '');
      const identifier =
        data.type === 'research'
          ? data.links?.find(
              ({ url }) =>
                url.startsWith('https://doi.org/') ||
                url.startsWith('https://dx.doi.org/'),
            )?.url
          : undefined;
      return [
        {
          kind: 'work',
          sourceId: `works:${slug}`,
          route: `/works/${slug}/`,
          title: data.title,
          shortTitle: data.shortTitle,
          seoTitle: data.seoTitle,
          description: data.description,
          seoDescription: data.seoDescription,
          summary: data.summary,
          date: data.date,
          assistant: data.assistant,
          entityType:
            data.type === 'research' ? 'ScholarlyArticle' : 'CreativeWork',
          openGraphType: data.type === 'research' ? 'article' : 'website',
          dateModified: data.type === 'research' ? data.date : undefined,
          image: data.image,
          links: [
            ...(data.links ?? []),
            ...(data.repository
              ? [{ label: 'View repository', url: data.repository }]
              : []),
            ...(data.demo ? [{ label: 'Live demo', url: data.demo }] : []),
          ],
          identifier,
        },
      ];
    });
  return [...blogs, ...works];
}

export type ResolvedPublishedCollections = {
  homepage: readonly CollectionDisplayRecord[];
  blog: readonly CollectionDisplayRecord[];
  works: readonly CollectionDisplayRecord[];
};

export function resolvedPublishedCollections(): ResolvedPublishedCollections {
  const root = process.cwd();
  const trackedPaths = [...loadTrackedContentPaths(root)];
  const blogs = trackedPaths
    .filter(
      (path) => path.startsWith('src/data/blog/') && path.endsWith('.mdx'),
    )
    .map((path): BlogEntry => {
      const source = matter(readFileSync(resolve(root, path), 'utf8'));
      return {
        id: path.replace(/^src\/data\/blog\//u, '').replace(/\.mdx$/u, ''),
        body: source.content,
        data: blogSchema.parse(source.data),
      };
    });
  const works = trackedPaths
    .filter(
      (path) => path.startsWith('src/data/works/') && path.endsWith('.mdx'),
    )
    .map((path): WorkEntry => {
      const source = matter(readFileSync(resolve(root, path), 'utf8'));
      return {
        id: path.replace(/^src\/data\/works\//u, '').replace(/\.mdx$/u, ''),
        body: source.content,
        data: worksSchema.parse(source.data),
      };
    });

  return {
    homepage: [
      ...resolveHomepageBlog(blogs, 3),
      ...resolveHomepageWorks(works, 3),
    ],
    blog: resolveBlogCollection(blogs),
    works: resolveWorksCollection(works),
  };
}

export function publishedAssistantSources(): PublishedAssistantSource[] {
  const root = process.cwd();
  const trackedPaths = [...loadTrackedContentPaths(root)];
  const contentSources = publishedContent()
    .filter(({ assistant }) => assistant)
    .map(({ sourceId, route }) => ({ id: sourceId, route }));
  const profileSources = trackedPaths
    .filter(
      (path) => path.startsWith('src/data/profile/') && path.endsWith('.mdx'),
    )
    .flatMap((path): PublishedAssistantSource[] => {
      const data = profileSchema.parse(
        matter(readFileSync(resolve(root, path), 'utf8')).data,
      );
      const slug = path
        .replace(/^src\/data\/profile\//u, '')
        .replace(/\.mdx$/u, '');
      return data.status === 'published' && data.assistant
        ? [{ id: `profile:${slug}`, route: '/about/' }]
        : [];
    });

  return [...contentSources, ...profileSources].sort((left, right) =>
    left.id.localeCompare(right.id, 'en'),
  );
}
