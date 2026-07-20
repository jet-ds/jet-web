import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

const homepage = readSource('../../../src/pages/index.astro');
const contentCard = readSource('../../../src/components/content/ContentCard.astro');
const blogCard = readSource('../../../src/components/blog/BlogCard.astro');
const workCard = readSource('../../../src/components/works/WorkCard.astro');

describe('shared content card source contract', () => {
  it('delegates Home content to the same Blog and Work adapters as collection pages', () => {
    expect(homepage).toContain(
      "import BlogCard from '../components/blog/BlogCard.astro';",
    );
    expect(homepage).toContain(
      "import WorkCard from '../components/works/WorkCard.astro';",
    );
    expect(homepage).toMatch(/latestPosts\.map[\s\S]*?<BlogCard/u);
    expect(homepage).toMatch(/featuredWorks\.map[\s\S]*?<WorkCard/u);
    expect(homepage.match(/variant="compact"/gu)).toHaveLength(2);
    expect(homepage).not.toContain('ContentTeaserCard');
    expect(homepage).not.toMatch(/<Card\s+href=/u);
  });

  it('keeps human card copy separate from canonical and SEO fields', () => {
    for (const adapter of [blogCard, workCard]) {
      expect(adapter).toContain('shortTitle?: string;');
      expect(adapter).toContain('summary?: string;');
      expect(adapter).toContain('shortTitle ?? title');
      expect(adapter).toContain('summary ?? description');
      expect(adapter).not.toMatch(/\bseoTitle\b/u);
      expect(adapter).not.toMatch(/\bseoDescription\b/u);
    }
    expect(contentCard).not.toMatch(/\bseoTitle\b/u);
    expect(contentCard).not.toMatch(/\bseoDescription\b/u);
    expect(homepage).not.toMatch(/\.data\.seoTitle\b/u);
    expect(homepage).not.toMatch(/\.data\.seoDescription\b/u);
  });

  it('keeps single-author attribution on article pages instead of repeating it in cards', () => {
    expect(blogCard).not.toContain('author: string;');
    expect(blogCard).not.toContain('{author}');
    expect(homepage).not.toContain('author={post.data.author}');
  });

  it('composes one media-first dominant-action presentation primitive', () => {
    for (const adapter of [blogCard, workCard]) {
      expect(adapter).toContain("import ContentCard from '../content/ContentCard.astro';");
      expect(adapter).toContain('<ContentCard');
    }
    expect(contentCard).toContain("import Card from '../ui/Card.astro';");
    expect(contentCard).toContain('<Card');
    expect(contentCard).toContain('href={href}');
    expect(contentCard).toContain("import ThemeAwareImage from '../ui/ThemeAwareImage.astro';");
    expect(contentCard).toContain('<ThemeAwareImage');
    expect(contentCard).toContain('darkSrc={image.darkUrl}');
    expect(contentCard.indexOf('{image &&')).toBeLessThan(contentCard.indexOf('<Heading'));
  });
});
