import { readFileSync } from 'node:fs';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { blogSchema, worksSchema } from '../../../src/schemas/content';
import { formatTitle } from '../../../src/utils/seo';

interface ParsedContentMetadata {
  title: string;
  seoTitle?: string;
  image?: {
    url: string;
    alt: string;
    width?: number;
    height?: number;
  };
}

function frontmatter(path: string): Record<string, unknown> {
  return matter(readFileSync(path, 'utf8')).data;
}

describe('content SEO metadata', () => {
  it.each([
    {
      path: 'src/data/blog/how-to-install-claude-code-cli-2026.mdx',
      fullTitle: 'How to Install and Get Started With Claude Code CLI in 2026',
      seoTitle: 'How to Install Claude Code CLI in 2026',
    },
    {
      path: 'src/data/blog/vibe-coding-vs-agentic-coding-why-the-distinction-matters.mdx',
      fullTitle: 'Vibe Coding vs Agentic Coding: Why the Distinction Matters',
      seoTitle: 'Vibe Coding vs Agentic Coding: Key Differences',
    },
  ])('gives $path a deliberate compact SEO title without replacing its content title', ({
    path,
    fullTitle,
    seoTitle,
  }) => {
    const parsed = blogSchema.parse(frontmatter(path)) as ParsedContentMetadata;

    expect(parsed.title).toBe(fullTitle);
    expect(parsed.seoTitle).toBe(seoTitle);
    expect(formatTitle(parsed.seoTitle ?? parsed.title).length).toBeLessThanOrEqual(60);
  });

  it('gives the research work a compact SEO title without replacing its paper title', () => {
    const parsed = worksSchema.parse(frontmatter(
      'src/data/works/recursive-convergence-hypothesis.mdx',
    )) as ParsedContentMetadata;

    expect(parsed.title).toBe(
      'The Recursive Convergence Hypothesis: Emergent Sentience as a Structural Attractor of Recursive ASI',
    );
    expect(parsed.seoTitle).toBe('Recursive Convergence Hypothesis: AI Sentience');
    expect(formatTitle(parsed.seoTitle ?? parsed.title).length).toBeLessThanOrEqual(60);
  });

  it.each([
    'src/data/blog/how-to-install-claude-code-cli-2026.mdx',
    'src/data/blog/vibe-coding-vs-agentic-coding-why-the-distinction-matters.mdx',
  ])('records verified intrinsic OpenGraph dimensions for %s', (path) => {
    const parsed = blogSchema.parse(frontmatter(path)) as ParsedContentMetadata;

    expect(parsed.image).toMatchObject({
      width: 1920,
      height: 1080,
    });
  });

  it('requires intrinsic dimensions whenever a blog image is configured', () => {
    const data = frontmatter('src/data/blog/how-to-install-claude-code-cli-2026.mdx');
    data.image = {
      url: 'https://example.com/image.png',
      alt: 'Example image',
    };

    expect(blogSchema.safeParse(data).success).toBe(false);
  });
});
