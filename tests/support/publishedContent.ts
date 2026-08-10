import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import matter from 'gray-matter';
import { loadTrackedContentPaths } from '../../src/content/gitTracking';
import {
  blogSchema,
  profileSchema,
  worksSchema,
} from '../../src/schemas/content';

export type PublishedContent = {
  kind: 'blog' | 'work';
  route: string;
  title: string;
  shortTitle?: string;
  seoTitle?: string;
  description: string;
  seoDescription?: string;
  summary?: string;
  date: Date;
  featured: boolean;
  assistant: boolean;
  entityType: 'BlogPosting' | 'ScholarlyArticle' | 'CreativeWork';
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
      return [
        {
          kind: 'blog',
          route: `/${path.replace(/^src\/data\//u, '').replace(/\.mdx$/u, '')}/`,
          title: data.title,
          shortTitle: data.shortTitle,
          seoTitle: data.seoTitle,
          description: data.description,
          seoDescription: data.seoDescription,
          summary: data.summary,
          date: data.pubDate,
          featured: false,
          assistant: data.assistant,
          entityType: 'BlogPosting',
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
          route: `/${path.replace(/^src\/data\//u, '').replace(/\.mdx$/u, '')}/`,
          title: data.title,
          shortTitle: data.shortTitle,
          seoTitle: data.seoTitle,
          description: data.description,
          seoDescription: data.seoDescription,
          summary: data.summary,
          date: data.date,
          featured: data.featured,
          assistant: data.assistant,
          entityType:
            data.type === 'research' ? 'ScholarlyArticle' : 'CreativeWork',
          image: data.image,
          links: data.links,
          identifier,
        },
      ];
    });
  return [...blogs, ...works];
}

export function publishedAssistantSourceRoutes(): string[] {
  const root = process.cwd();
  const trackedPaths = [...loadTrackedContentPaths(root)];
  const contentRoutes = publishedContent()
    .filter(({ assistant }) => assistant)
    .map(({ route }) => route);
  const profileRoutes = trackedPaths
    .filter(
      (path) => path.startsWith('src/data/profile/') && path.endsWith('.mdx'),
    )
    .flatMap((path): string[] => {
      const data = profileSchema.parse(
        matter(readFileSync(resolve(root, path), 'utf8')).data,
      );
      return data.status === 'published' && data.assistant ? ['/about/'] : [];
    });

  return [...contentRoutes, ...profileRoutes].sort();
}
