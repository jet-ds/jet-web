import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const buttonSource = readSource('../../src/components/ui/Button.astro');
const globalStyles = readSource('../../src/styles/global.css');
const ghostSource = readSource('../../src/features/jets-ghost/JetsGhostExperience.tsx');
const linkSource = readSource('../../src/components/ui/Link.astro');
const tagSource = readSource('../../src/components/ui/Tag.astro');

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
    const restRule = globalStyles.match(/\.text-link\s*\{([^}]*)\}/u)?.[1] ?? '';
    expect(restRule).toContain('color: var(--color-brand-text);');
    expect(restRule).toContain('font-weight: 500;');
    expect(restRule).toContain('text-decoration: none;');
    expect(restRule).toContain('text-underline-offset: 4px;');
    expect(restRule).toContain('transition-property: color, text-decoration-color;');

    const interactionRule = globalStyles.match(
      /\.text-link:hover,\s*\.text-link:focus-visible\s*\{([^}]*)\}/u,
    )?.[1] ?? '';
    expect(interactionRule).toContain('color: var(--color-brand-hover);');
    expect(interactionRule).toContain('text-decoration: underline;');

    const focusVisibleRule = [...globalStyles.matchAll(
      /\.text-link:focus-visible\s*\{([^}]*)\}/gu,
    )].map((match) => match[1]).find((rule) => rule.includes('outline:')) ?? '';
    expect(focusVisibleRule).toContain('outline: 2px solid var(--color-brand-base);');
    expect(focusVisibleRule).toContain('outline-offset: 2px;');
    expect(globalStyles).not.toMatch(/\.text-link:focus(?!-visible)/u);
    expect(globalStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.text-link,\s*\.action\s*\{\s*transition: none;/u,
    );
    expect(linkSource).toContain("primary: 'text-link'");
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
