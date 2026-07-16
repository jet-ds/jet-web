import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatTitle, truncateDescription } from '../../../src/utils/seo';

describe('SEO text presentation', () => {
  it('uses one pipe separator for the site-name suffix', () => {
    expect(formatTitle('About')).toBe('About | Jet Sanchez');
    expect(formatTitle('Jet Sanchez')).toBe('Jet Sanchez');
  });

  it('truncates at a word boundary with one ellipsis glyph', () => {
    const description = 'Alpha beta gamma delta epsilon';
    const truncated = truncateDescription(description, 18);

    expect(truncated).toBe('Alpha beta gamma…');
    expect(truncated.length).toBeLessThanOrEqual(18);
    expect(truncated).not.toContain('...');
  });

  it('leaves descriptions within the limit unchanged', () => {
    expect(truncateDescription('Already concise.', 18)).toBe('Already concise.');
  });

  it("uses a colon in the Jet's Ghost page-specific title", () => {
    const source = readFileSync('src/pages/chatbot.astro', 'utf8');
    expect(source).toContain(`const title = "Jet's Ghost: Local-First AI Assistant";`);
    expect(source).not.toContain(`const title = "Jet's Ghost — Local-First AI Assistant";`);
  });

  it('does not retain hyphen-separated source-only filter titles', () => {
    for (const file of ['src/pages/blog/index.astro', 'src/pages/works/index.astro']) {
      const source = readFileSync(file, 'utf8');
      const titleAssignments = source.match(/const\s+(?:pageTitle|seoTitle)\s*=\s*[\s\S]*?;/gu) ?? [];
      for (const assignment of titleAssignments) {
        expect(assignment).not.toMatch(/\s-\s/u);
      }
    }
  });

  it.each([
    [
      'src/pages/blog/index.astro',
      "Explore Jet Sanchez's articles on AI, agentic software development, local-first tools, technical workflows, and the systems shaping modern work.",
    ],
    [
      'src/pages/works/index.astro',
      "Explore Jet Sanchez's research papers, software projects, and applied AI experiments spanning agentic systems, AI governance, and emerging technology.",
    ],
    [
      'src/pages/contact.astro',
      'Contact Jet Sanchez for AI research, marketing engineering, SEO and GEO strategy, systems design, speaking, or collaboration opportunities.',
    ],
  ])('uses a useful page-specific listing description in %s', (file, description) => {
    const source = readFileSync(file, 'utf8');

    expect(description.length).toBeGreaterThanOrEqual(120);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(source).toContain(description);
    if (file !== 'src/pages/contact.astro') {
      expect(source).toContain('description={pageDescription}');
    }
  });

  it.each([
    {
      file: 'src/pages/blog/index.astro',
      heading: 'Blog',
      subheading: 'Explore my articles on AI, agentic software development, local-first tools, technical workflows, and the systems shaping modern work.',
    },
    {
      file: 'src/pages/works/index.astro',
      heading: 'Works',
      subheading: 'Explore my research papers, software projects, and applied AI experiments spanning agentic systems, AI governance, and emerging technology.',
    },
  ])('keeps first-person visible listing copy independent from metadata in $file', ({
    file,
    heading,
    subheading,
  }) => {
    const source = readFileSync(file, 'utf8');
    const subheadingAssignment = source.match(
      /const pageSubheading = (['"])(.*?)\1;/u,
    )?.[2] ?? '';
    const visibleHeader = source.match(
      new RegExp(`<h1[^>]*>${heading}</h1>\\s*<p[^>]*>([\\s\\S]*?)<\\/p>`, 'u'),
    )?.[1] ?? '';

    expect(subheadingAssignment).toBe(subheading);
    expect(subheadingAssignment).not.toContain("Jet Sanchez's");
    expect(visibleHeader).toContain('{pageSubheading}');
    expect(visibleHeader).not.toContain('{pageDescription}');
  });
});
