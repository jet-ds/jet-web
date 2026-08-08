import { readFileSync } from 'node:fs';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { blogSchema, worksSchema } from '../../../src/schemas/content';
import { formatTitle } from '../../../src/utils/seo';

interface ParsedContentMetadata {
  title: string;
  seoTitle?: string;
}

function frontmatter(path: string): Record<string, unknown> {
  return matter(readFileSync(path, 'utf8')).data;
}

describe('content SEO metadata', () => {
  it.each([
    {
      path: 'src/data/blog/how-to-install-claude-code-cli-2026.mdx',
      kind: 'blog',
    },
    {
      path: 'src/data/blog/vibe-coding-vs-agentic-coding-why-the-distinction-matters.mdx',
      kind: 'blog',
    },
    {
      path: 'src/data/works/recursive-convergence-hypothesis.mdx',
      kind: 'work',
    },
    {
      path: 'src/data/works/broad-reach-uneven-depth.mdx',
      kind: 'work',
    },
    {
      path: 'src/data/works/digital-squad-timesheet.mdx',
      kind: 'work',
    },
  ])(
    'gives $path a distinct SEO title that fits the rendered title limit',
    ({ path, kind }) => {
      const schema = kind === 'blog' ? blogSchema : worksSchema;
      const parsed = schema.parse(frontmatter(path)) as ParsedContentMetadata;

      expect(parsed.seoTitle).toBeTruthy();
      expect(parsed.seoTitle).not.toBe(parsed.title);
      expect(
        formatTitle(parsed.seoTitle ?? parsed.title).length,
      ).toBeLessThanOrEqual(60);
    },
  );

  it('requires intrinsic dimensions whenever a blog image is configured', () => {
    const data = frontmatter(
      'src/data/blog/how-to-install-claude-code-cli-2026.mdx',
    );
    data.image = {
      url: 'https://example.com/image.png',
      alt: 'Example image',
    };

    expect(blogSchema.safeParse(data).success).toBe(false);
  });
});
