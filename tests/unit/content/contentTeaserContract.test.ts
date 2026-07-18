import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

const homepage = readSource('../../../src/pages/index.astro');
const contentTeaser = readSource('../../../src/components/content/ContentTeaserCard.astro');

describe('homepage content teaser source contract', () => {
  it('delegates both Home content collections to the shared teaser', () => {
    expect(homepage).toContain(
      "import ContentTeaserCard from '../components/content/ContentTeaserCard.astro';",
    );
    expect(homepage.match(/<ContentTeaserCard/gu)).toHaveLength(2);
    expect(homepage).toMatch(/latestPosts\.map[\s\S]*?<ContentTeaserCard/u);
    expect(homepage).toMatch(/featuredWorks\.map[\s\S]*?<ContentTeaserCard/u);
    expect(homepage).not.toMatch(/<Card\s+href=/u);
  });

  it('keeps canonical display copy separate from SEO override fields', () => {
    expect(contentTeaser).toContain('title: string;');
    expect(contentTeaser).toContain('description: string;');
    expect(contentTeaser).not.toMatch(/\bseoTitle\b/u);
    expect(contentTeaser).not.toMatch(/\bseoDescription\b/u);
    expect(homepage).not.toMatch(/\.data\.seoTitle\b/u);
    expect(homepage).not.toMatch(/\.data\.seoDescription\b/u);
  });

  it('composes the shared dominant-action and theme-image primitives', () => {
    expect(contentTeaser).toContain("import Card from '../ui/Card.astro';");
    expect(contentTeaser).toContain('<Card href={href}');
    expect(contentTeaser).toContain("import ThemeAwareImage from '../ui/ThemeAwareImage.astro';");
    expect(contentTeaser).toContain('<ThemeAwareImage');
    expect(contentTeaser).toContain('darkSrc={image.darkUrl}');
  });
});
