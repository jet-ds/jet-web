import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import tailwindConfig from '../../tailwind.config.mjs';

const globalStyles = readFileSync('src/styles/global.css', 'utf8');

function requireObjectRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object record.`);
  }

  return value as Record<string, unknown>;
}

function tokenBlock(selector: ':root' | '.dark'): string {
  return globalStyles.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'u'))?.[1] ?? '';
}

function tokenValue(block: string, name: string): string {
  return block.match(new RegExp(`--color-${name}:\\s*([^;]+);`, 'u'))?.[1].trim() ?? '';
}

function ruleBody(selector: string): string {
  return globalStyles.match(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`, 'u'))?.[1] ?? '';
}

describe('machine-readable design-system contracts', () => {
  it('maps semantic foreground and interactive roles to the established scale', () => {
    const light = tokenBlock(':root');

    expect(tokenValue(light, 'text-secondary')).toBe('oklch(0.4521 0.022 250.82)');
    expect(tokenValue(light, 'text-tertiary')).toBe('oklch(0.5122 0.03 253.72)');
    expect(tokenValue(light, 'brand-base')).toBe('oklch(0.4956 0.0566 248.16)');
  });

  it('keeps broad brand sections distinct from soft actions in both themes', () => {
    const light = tokenBlock(':root');
    const dark = tokenBlock('.dark');
    const theme = requireObjectRecord(tailwindConfig.theme, 'Tailwind theme');
    const extensions = requireObjectRecord(theme['extend'], 'Tailwind theme extensions');
    const colors = requireObjectRecord(extensions['colors'], 'Tailwind extended colors');

    expect(tokenValue(light, 'section-brand')).toBe('oklch(0.9502 0.0069 247.9)');
    expect(tokenValue(dark, 'section-brand')).toBe('oklch(0.3536 0.0306 248.71)');
    expect(tokenValue(light, 'section-brand')).not.toBe(tokenValue(light, 'brand-subtle'));
    expect(tokenValue(dark, 'section-brand')).not.toBe(tokenValue(dark, 'brand-subtle'));
    expect(colors['section-brand'])
      .toBe('var(--color-section-brand)');
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
    expect(globalStyles).toMatch(/\.action--filter\[aria-pressed=['"]true['"]\]/u);
  });
});
