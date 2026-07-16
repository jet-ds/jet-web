import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const buttonSource = readSource('../../src/components/ui/Button.astro');
const globalStyles = readSource('../../src/styles/global.css');
const ghostSource = readSource('../../src/features/jets-ghost/JetsGhostExperience.tsx');
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
