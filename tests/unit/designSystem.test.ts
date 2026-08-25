import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const globalStyles = readFileSync('src/styles/global.css', 'utf8');
const themeStyles = existsSync('src/styles/theme.css')
  ? readFileSync('src/styles/theme.css', 'utf8')
  : '';
const themeDeclarations = Array.from(
  themeStyles.matchAll(/@theme(?:\s+inline)?\s*\{([^}]*)\}/gu),
  (match) => match[1],
).join('\n');

function normalizeCssValue(value: string): string {
  return value
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/\s+/gu, ' ')
    .replace(/\(\s+/gu, '(')
    .replace(/\s+\)/gu, ')')
    .trim();
}

function declarationValue(styles: string, name: string): string {
  return normalizeCssValue(
    styles.match(new RegExp(`${name}:\\s*([^;]+);`, 'u'))?.[1] ?? '',
  );
}

function tokenBlock(selector: ':root' | '.dark'): string {
  return (
    globalStyles.match(
      new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'u'),
    )?.[1] ?? ''
  );
}

function tokenValue(block: string, name: string): string {
  return declarationValue(block, `--color-${name}`);
}

function ruleBody(selector: string): string {
  return (
    globalStyles.match(
      new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`, 'u'),
    )?.[1] ?? ''
  );
}

describe('machine-readable design-system contracts', () => {
  it('loads the utility theme and typography plugin through the global stylesheet', () => {
    expect(
      globalStyles.match(/@import\s+['"]\.\/theme\.css['"]\s*;/gu),
    ).toHaveLength(1);
    expect(globalStyles).toMatch(
      /^@import\s+['"]tailwindcss['"]\s*;\s*@import\s+['"]\.\/theme\.css['"]\s*;/u,
    );
    expect(themeStyles).toContain("@plugin '@tailwindcss/typography';");
    expect(globalStyles).not.toContain('@config');
  });

  it('generates palette, font, fluid type, and fluid spacing utilities from theme variables', () => {
    for (const palette of ['brand', 'accent', 'neutral'] as const) {
      for (let step = 1; step <= 11; step += 1) {
        expect(
          declarationValue(themeDeclarations, `--color-${palette}-${step}`),
          `--color-${palette}-${step}`,
        ).toMatch(/^oklch\(/u);
      }
    }

    expect(declarationValue(themeDeclarations, '--font-sans')).toContain(
      'Work Sans',
    );
    expect(declarationValue(themeDeclarations, '--font-serif')).toContain(
      'Brawler',
    );
    expect(declarationValue(themeDeclarations, '--font-mono')).toContain(
      'JetBrains Mono',
    );

    for (const [utility, runtime] of Object.entries({
      xs: '--step--2',
      sm: '--step--1',
      base: '--step-0',
      lg: '--step-1',
      xl: '--step-2',
      '2xl': '--step-3',
      '3xl': '--step-4',
      '4xl': '--step-5',
      '5xl': '--step-6',
      '6xl': '--step-7',
      '7xl': '--step-7',
    })) {
      expect(declarationValue(themeDeclarations, `--text-${utility}`)).toBe(
        `var(${runtime})`,
      );
    }

    for (const spacing of [
      '5xs',
      '4xs',
      '3xs',
      '2xs',
      'xs',
      's',
      'm',
      'l',
      'xl',
      '2xl',
      '3xl',
      '4xl',
      '5xl',
      '5xs-4xs',
      '4xs-3xs',
      '3xs-2xs',
      '2xs-xs',
      'xs-s',
      's-m',
      'm-l',
      'l-xl',
      'xl-2xl',
      '2xl-3xl',
      '3xl-4xl',
      '4xl-5xl',
      's-l',
      'gutter',
      'section',
      'section-lg',
      'card',
      'stack-xs',
      'stack-s',
      'stack-m',
      'stack-l',
    ]) {
      expect(
        declarationValue(themeDeclarations, `--spacing-${spacing}`),
        `--spacing-${spacing}`,
      ).toBe(`var(--space-${spacing})`);
    }
  });

  it('generates every selector-scoped semantic color role as a utility', () => {
    for (const role of [
      'bg-base',
      'bg-subtle',
      'bg-ui',
      'bg-hover',
      'bg-active',
      'surface-base',
      'surface-raised',
      'surface-overlay',
      'section-brand',
      'text-primary',
      'text-secondary',
      'text-tertiary',
      'text-disabled',
      'border-subtle',
      'border-default',
      'border-strong',
      'brand-base',
      'brand-hover',
      'brand-active',
      'brand-subtle',
      'brand-text',
      'brand-contrast',
      'code-block-text',
      'control-disabled-fill',
      'control-disabled-foreground',
      'control-stop-fill',
      'control-stop-hover',
      'control-stop-foreground',
      'status-idle',
      'status-ready',
      'status-active',
      'accent-base',
      'accent-hover',
      'accent-subtle',
      'accent-text',
      'accent-contrast',
    ]) {
      expect(
        declarationValue(themeDeclarations, `--color-${role}`),
        `--color-${role}`,
      ).toBe(`var(--color-${role})`);
    }
  });

  it('preserves the exact Utopia runtime clamps consumed by text and spacing utilities', () => {
    expect(declarationValue(globalStyles, '--step--2')).toBe(
      'clamp(0.7378rem, 0.8051rem + -0.0747vw, 0.7901rem)',
    );
    expect(declarationValue(globalStyles, '--step-0')).toBe(
      'clamp(1rem, 0.9821rem + 0.0893vw, 1.0625rem)',
    );
    expect(declarationValue(globalStyles, '--step-7')).toBe(
      'clamp(2.2807rem, 1.8446rem + 2.1806vw, 3.8071rem)',
    );
    expect(declarationValue(globalStyles, '--space-5xs')).toBe(
      'clamp(0.25rem, 0.25rem + 0vw, 0.25rem)',
    );
    expect(declarationValue(globalStyles, '--space-m-l')).toBe(
      'clamp(1.5rem, 1.3214rem + 0.8929vw, 2.125rem)',
    );
    expect(declarationValue(globalStyles, '--space-s-l')).toBe(
      'clamp(1rem, 0.6786rem + 1.6071vw, 2.125rem)',
    );
  });

  it('maps semantic foreground and interactive roles to the established scale', () => {
    const light = tokenBlock(':root');

    expect(tokenValue(light, 'text-secondary')).toBe(
      'oklch(0.4521 0.022 250.82)',
    );
    expect(tokenValue(light, 'text-tertiary')).toBe(
      'oklch(0.5122 0.03 253.72)',
    );
    expect(tokenValue(light, 'brand-base')).toBe('oklch(0.4956 0.0566 248.16)');
  });

  it('keeps broad brand sections distinct from soft actions in both themes', () => {
    const light = tokenBlock(':root');
    const dark = tokenBlock('.dark');

    expect(tokenValue(light, 'section-brand')).toBe(
      'oklch(0.9502 0.0069 247.9)',
    );
    expect(tokenValue(dark, 'section-brand')).toBe(
      'oklch(0.3536 0.0306 248.71)',
    );
    expect(tokenValue(light, 'section-brand')).not.toBe(
      tokenValue(light, 'brand-subtle'),
    );
    expect(tokenValue(dark, 'section-brand')).not.toBe(
      tokenValue(dark, 'brand-subtle'),
    );
  });

  it('retains the class-based dark variant and accessibility media behavior', () => {
    expect(globalStyles).toContain(
      '@custom-variant dark (&:where(.dark, .dark *));',
    );
    expect(globalStyles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(globalStyles).toContain('@media (forced-colors: active)');
    expect(globalStyles).toMatch(
      /@media \(forced-colors: active\)[\s\S]*?\.action:focus-visible\s*\{[\s\S]*?outline-color:\s*Highlight;/u,
    );
  });

  it('defines every shared action density with the minimum touch target', () => {
    for (const [density, size] of [
      ['compact', '2.75rem'],
      ['default', '2.75rem'],
      ['immersive', '3rem'],
    ] as const) {
      const rule = ruleBody(`action--${density}`);
      expect(rule).toContain(`min-width: ${size};`);
      expect(rule).toContain(`min-height: ${size};`);
    }
  });

  it('expresses filter state through the shared recipe and aria-pressed', () => {
    expect(ruleBody('action--filter')).not.toBe('');
    expect(globalStyles).toMatch(
      /\.action--filter\[aria-pressed=['"]true['"]\]/u,
    );
  });
});
