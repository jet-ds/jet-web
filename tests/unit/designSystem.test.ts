import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const buttonSource = readSource('../../src/components/ui/Button.astro');
const footerSource = readSource('../../src/components/layout/Footer.astro');
const globalStyles = readSource('../../src/styles/global.css');
const ghostSource = readSource('../../src/features/jets-ghost/JetsGhostExperience.tsx');
const linkSource = readSource('../../src/components/ui/Link.astro');
const licensePageSource = readSource('../../src/pages/licenses/jets-ghost.astro');
const blogLayoutSource = readSource('../../src/layouts/BlogLayout.astro');
const workLayoutSource = readSource('../../src/layouts/WorkLayout.astro');
const blogEntrySource = readSource('../../src/pages/blog/[slug].astro');
const workEntrySource = readSource('../../src/pages/works/[slug].astro');
const chatbotPageSource = readSource('../../src/pages/chatbot.astro');
const homePageSource = readSource('../../src/pages/index.astro');
const sectionSource = readSource('../../src/components/layout/Section.astro');
const tailwindSource = readSource('../../tailwind.config.mjs');
const tagSource = readSource('../../src/components/ui/Tag.astro');

function ruleBody(source: string, selector: string): string {
  const ruleStart = source.indexOf(`${selector} {`);
  if (ruleStart === -1) return '';

  const bodyStart = ruleStart + selector.length + 2;
  const bodyEnd = source.indexOf('}', bodyStart);
  return bodyEnd === -1 ? '' : source.slice(bodyStart, bodyEnd);
}

describe('design-system role contracts', () => {
  test('semantic colors map to established numbered scale steps', () => {
    expect(globalStyles).not.toContain('oklch(0.55 0.0375 252.38)');
    expect(globalStyles).not.toContain('oklch(0.562 0.0587 245.59)');
    expect(globalStyles).toContain(
      '--color-text-secondary: oklch(0.4521 0.022 250.82);',
    );
    expect(globalStyles).toContain(
      '--color-text-tertiary: oklch(0.5122 0.03 253.72);',
    );
    expect(globalStyles).toContain(
      '--color-brand-base: oklch(0.4956 0.0566 248.16);',
    );
  });

  test('filter controls use the shared compact action recipe and aria-pressed state', () => {
    expect(buttonSource).toContain("'filter'");
    expect(globalStyles).toMatch(/\.action--filter\s*\{/u);
    expect(globalStyles).toMatch(/\.action--filter\[aria-pressed=['"]true['"]\]/u);
  });

  test('primary inline links share one framework-neutral interaction recipe', () => {
    const proseLinkSelector = '.prose :where(a):not(:where([class~="not-prose"] *))';
    const restRule = ruleBody(
      globalStyles,
      `.text-link,\n  ${proseLinkSelector}`,
    );
    expect(restRule).toContain('color: var(--color-brand-text);');
    expect(restRule).toContain('font-weight: 500;');
    expect(restRule).toContain('text-decoration: none;');
    expect(restRule).toContain('text-underline-offset: 4px;');
    expect(restRule).toContain('transition-property: color, text-decoration-color;');

    const interactionRule = ruleBody(
      globalStyles,
      `.text-link:hover,\n  .text-link:focus-visible,\n  ${proseLinkSelector}:hover,\n  ${proseLinkSelector}:focus-visible`,
    );
    expect(interactionRule).toContain('color: var(--color-brand-hover);');
    expect(interactionRule).toContain('text-decoration: underline;');

    const focusVisibleRule = ruleBody(
      globalStyles,
      `.text-link:focus-visible,\n  ${proseLinkSelector}:focus-visible`,
    );
    expect(focusVisibleRule).toContain('outline: 2px solid var(--color-brand-base);');
    expect(focusVisibleRule).toContain('outline-offset: 2px;');
    expect(globalStyles).not.toMatch(/\.text-link:focus(?!-visible)/u);
    expect(ruleBody(
      globalStyles,
      `.text-link,\n    ${proseLinkSelector},\n    .action`,
    )).toContain('transition: none;');
    expect(globalStyles).not.toMatch(
      /\.prose :where\(a\):not\(:where\(\[class~="not-prose"\] \*\)\)\s*\{\s*@apply/u,
    );
    expect(linkSource).toContain("primary: 'text-link'");
  });

  test('active prose and direct inline links adopt the shared recipe', () => {
    expect(blogLayoutSource).toMatch(
      /<a href="\/blog\/" class="[^"]*\btext-link\b[^"]*"/u,
    );
    expect(workLayoutSource).toMatch(
      /<a href="\/works\/" class="[^"]*\btext-link\b[^"]*"/u,
    );
    expect(chatbotPageSource.match(/<a class="text-link" href="\/(?:blog|works)\/">/gu))
      .toHaveLength(2);
    expect(licensePageSource.match(/<Link href="[^"]+" variant="primary"(?: class="[^"]+")?>/gu))
      .toHaveLength(5);
  });

  test('Blog, Works, and license back links share one text-link model', () => {
    expect(blogLayoutSource).toMatch(
      /<a href="\/blog\/" class="[^"]*\btext-link\b[^"]*">\s*<span[^>]*>←<\/span> Back to blog\s*<\/a>/u,
    );
    expect(workLayoutSource).toMatch(
      /<a href="\/works\/" class="[^"]*\btext-link\b[^"]*">\s*<span[^>]*>←<\/span> Back to works\s*<\/a>/u,
    );
    expect(licensePageSource).toMatch(
      /<Link href="\/chatbot\/" variant="primary" class="inline-flex items-center gap-1">\s*<span[^>]*>←<\/span> Back to Jet's Ghost\s*<\/Link>/u,
    );
    expect(licensePageSource).not.toMatch(
      /<Link href="\/chatbot\/" variant="muted"/u,
    );
    expect(footerSource.match(/variant="muted"/gu)).toHaveLength(6);
    expect(footerSource).not.toContain('text-link');
  });

  test('prose ownership stops at the rendered MDX content boundary', () => {
    for (const layoutSource of [blogLayoutSource, workLayoutSource]) {
      expect(layoutSource).toContain('<slot />');
      expect(layoutSource).not.toMatch(
        /<div class="prose prose-lg dark:prose-invert max-w-none">\s*<slot \/>\s*<\/div>/u,
      );
    }

    for (const entrySource of [blogEntrySource, workEntrySource]) {
      expect(entrySource).toMatch(
        /<article class="prose prose-lg dark:prose-invert max-w-none">\s*<Content \/>\s*<\/article>/u,
      );
    }
  });

  test('broad blue sections have a semantic surface distinct from soft actions', () => {
    const lightTokens = globalStyles.match(/:root\s*\{([\s\S]*?)\n  \}/u)?.[1] ?? '';
    const darkTokens = globalStyles.match(/\.dark\s*\{([\s\S]*?)\n  \}/u)?.[1] ?? '';
    const tokenValue = (tokens: string, name: string) => (
      tokens.match(new RegExp(`--color-${name}:\\s*([^;]+);`, 'u'))?.[1].trim() ?? ''
    );

    expect(tokenValue(lightTokens, 'section-brand'))
      .toBe('oklch(0.9502 0.0069 247.9)');
    expect(tokenValue(darkTokens, 'section-brand'))
      .toBe('oklch(0.3536 0.0306 248.71)');
    expect(tokenValue(lightTokens, 'section-brand'))
      .not.toBe(tokenValue(lightTokens, 'brand-subtle'));
    expect(tokenValue(darkTokens, 'section-brand'))
      .not.toBe(tokenValue(darkTokens, 'brand-subtle'));
    expect(tailwindSource).toContain("'section-brand': 'var(--color-section-brand)'");
    expect(sectionSource).toContain("brand: 'bg-section-brand'");
    expect(sectionSource).not.toContain("brand: 'bg-brand-subtle'");
    expect(homePageSource).toContain(
      '<Section spacing="default" background="brand">',
    );
    expect(homePageSource).not.toContain(
      '<Section spacing="default" background="accent">',
    );
    expect(globalStyles).toMatch(
      /\.action--soft\s*\{[^}]*background-color: var\(--color-brand-subtle\);/su,
    );
    expect(globalStyles).toMatch(
      /\.action--accent\s*\{[^}]*background-color: var\(--color-accent-base\);/su,
    );
  });

  test('action densities guarantee square minimum touch targets', () => {
    for (const [density, size] of [
      ['compact', '2.75rem'],
      ['default', '2.75rem'],
      ['immersive', '3rem'],
    ] as const) {
      const rule = globalStyles.match(new RegExp(`\\.action--${density}\\s*\\{([^}]*)\\}`, 'u'))?.[1] ?? '';
      expect(rule).toContain(`min-width: ${size};`);
      expect(rule).toContain(`min-height: ${size};`);
    }
  });

  test('Ghost status and Stop controls use honest semantic roles', () => {
    expect(globalStyles).toContain('--color-status-idle');
    expect(globalStyles).toContain('--color-control-stop-fill');
    expect(ghostSource).not.toContain('bg-text-disabled');
    expect(ghostSource).not.toContain('bg-text-primary text-bg-base');
  });

  test('Tag exposes only the variants represented by real usage', () => {
    expect(tagSource).not.toMatch(/\b(success|warning|error)\b/u);
    expect(tagSource).toContain("variant?: 'default' | 'primary';");
  });
});
