import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const cardSource = readSource('../../src/components/ui/Card.astro');
const buttonSource = readSource('../../src/components/ui/Button.astro');
const globalStyles = readSource('../../src/styles/global.css');
const licenseSource = readSource('../../src/pages/licenses/jets-ghost.astro');
const aboutSource = readSource('../../src/pages/about.astro');
const contactSource = readSource('../../src/pages/contact.astro');

const countMatches = (source: string, pattern: RegExp) => source.match(pattern)?.length ?? 0;

describe('annotation 2 shared card system', () => {
  test('Card exposes base and subtle semantic surfaces with shared structure and Utopia padding', () => {
    expect(cardSource).toContain("surface?: 'base' | 'subtle';");
    expect(cardSource).toContain("surface = 'base'");
    expect(cardSource).toContain("base: 'bg-surface-base'");
    expect(cardSource).toContain("subtle: 'bg-bg-subtle'");
    expect(cardSource).toContain(
      "border border-border-default rounded-lg transition-colors",
    );
    expect(cardSource).toContain("sm: 'p-s'");
    expect(cardSource).toContain("md: 'p-m'");
    expect(cardSource).toContain("lg: 'p-card'");
  });

  test('Licenses consumes four subtle Cards while preserving valid section and list structure', () => {
    expect(licenseSource).toContain(
      "import Card from '../../components/ui/Card.astro';",
    );
    expect(countMatches(licenseSource, /<Card\s+surface="subtle"/gu)).toBe(4);
    expect(licenseSource).not.toContain(
      'rounded-xl border border-border-default bg-bg-subtle p-card',
    );

    const libraryList = /<ul class="grid gap-xs">([\s\S]*?)<\/ul>/u.exec(licenseSource)?.[1] ?? '';
    expect(countMatches(libraryList, /<li>/gu)).toBe(3);
    expect(countMatches(libraryList, /<li>\s*<Card\s+surface="subtle"/gu)).toBe(3);
    expect(libraryList).not.toMatch(/<ul[^>]*>\s*<Card/gu);
    expect(licenseSource).toMatch(
      /<section aria-labelledby="model-license"[\s\S]*?<Card\s+surface="subtle"/u,
    );
  });

  test('About uses the subtle surface for content cards and leaves the portrait image-first', () => {
    const portraitSection = aboutSource.slice(aboutSource.indexOf('<!-- Image Card -->'));
    const portraitCardOpeningTag = /<Card([^>]*)>/u.exec(portraitSection)?.[1] ?? '';

    expect(countMatches(aboutSource, /<Card\s+surface="subtle"/gu)).toBe(3);
    expect(aboutSource).toMatch(
      /<Card padding="none" class="overflow-hidden">[\s\S]*?<OptimizedImage/u,
    );
    expect(portraitCardOpeningTag).not.toContain('surface="subtle"');
    expect(aboutSource).not.toContain('bg-bg-subtle');
  });

  test('About Connect keeps compact shared soft actions without page-local surface overrides', () => {
    const connectSection = aboutSource.slice(aboutSource.indexOf('<!-- Connect Section -->'));
    const buttonOpeningTag = /<Button([\s\S]*?)>/u.exec(connectSection)?.[1] ?? '';

    expect(countMatches(connectSection, /<Button\b/gu)).toBe(1);
    expect(buttonOpeningTag).toContain('variant="brand"');
    expect(buttonOpeningTag).toContain('density="compact"');
    expect(buttonOpeningTag).not.toContain('class=');
    expect(connectSection).toContain('aria-hidden="true">↗</span>');
    expect(connectSection).toContain('(opens in a new tab)');

    const softRule = globalStyles.match(/\.action--soft\s*\{([^}]*)\}/u)?.[1] ?? '';
    expect(softRule).toContain('background-color: var(--color-brand-subtle);');
    expect(softRule).not.toContain('transparent');
  });

  test('Button makes every shared variant class literal purge-safe', () => {
    const literalClasses = {
      primary: 'action--brand',
      accent: 'action--accent',
      brand: 'action--soft',
      secondary: 'action--neutral',
      outline: 'action--outline',
      ghost: 'action--ghost',
      filter: 'action--filter',
    } as const;

    for (const [variant, className] of Object.entries(literalClasses)) {
      expect(buttonSource).toContain(`${variant}: '${className}'`);
    }
    expect(buttonSource).not.toContain('action--${resolvedVariant}');
  });

  test('Button makes every shared density class literal purge-safe', () => {
    for (const [density, className] of Object.entries({
      compact: 'action--compact',
      default: 'action--default',
      immersive: 'action--immersive',
    })) {
      expect(buttonSource).toContain(`${density}: '${className}'`);
    }
    expect(buttonSource).not.toContain('action--${density}');
  });

  test('Contact renders only Email and Links Cards with one stable destination list', () => {
    expect(contactSource).toContain(
      "import Link from '../components/ui/Link.astro';",
    );
    expect(countMatches(contactSource, /<Card\s+surface="subtle"/gu)).toBe(2);
    expect(countMatches(contactSource, /<Card\b/gu)).toBe(2);
    expect(contactSource).toContain('const contactLinks = [');
    expect(contactSource).not.toMatch(/activeSocialLinks|professionalLinks|\bicon:/u);
    expect(contactSource).not.toMatch(/Response Time|business days/u);
    expect(contactSource).not.toContain('bg-bg-subtle');

    const destinations = [
      ['GitHub', 'Code, experiments, and open-source work'],
      ['LinkedIn', 'Professional profile and updates'],
      ['SSRN', 'Research papers and publications'],
      ['Google Scholar', 'Academic citations and research profile'],
    ] as const;

    let previousIndex = -1;
    for (const [name, description] of destinations) {
      const index = contactSource.indexOf(`name: '${name}'`);
      expect(index).toBeGreaterThan(previousIndex);
      expect(countMatches(contactSource, new RegExp(`name: '${name}'`, 'gu'))).toBe(1);
      expect(countMatches(contactSource, new RegExp(description, 'gu'))).toBe(1);
      previousIndex = index;
    }

    for (const key of ['github', 'linkedin', 'ssrn', 'scholar']) {
      expect(countMatches(contactSource, new RegExp(`SOCIAL_LINKS\\.${key}`, 'gu'))).toBe(1);
    }
  });

  test('Contact email actions consume the shared inline Link and accent/default Button recipes', () => {
    expect(contactSource).toMatch(
      /<Link\s+href=\{`mailto:\$\{SITE\.email\}`\}\s+variant="primary">\s*\{SITE\.email\}\s*<\/Link>/u,
    );
    expect(contactSource).toMatch(
      /<Button[\s\S]*?href=\{`mailto:\$\{SITE\.email\}`\}[\s\S]*?variant="accent"[\s\S]*?density="default"[\s\S]*?>\s*Send email\s*<\/Button>/u,
    );

    expect(buttonSource).toContain("accent: 'accent'");
    const accentRule = globalStyles.match(/\.action--accent\s*\{([^}]*)\}/u)?.[1] ?? '';
    expect(accentRule).toContain('background-color: var(--color-accent-base);');
    expect(accentRule).not.toContain('transparent');

    const defaultRule = globalStyles.match(/\.action--default\s*\{([^}]*)\}/u)?.[1] ?? '';
    expect(defaultRule).toContain('min-width: 2.75rem;');
    expect(defaultRule).toContain('min-height: 2.75rem;');
    expect(defaultRule).toContain('padding-inline: var(--space-s);');
    expect(defaultRule).toContain('border-radius: 0.5rem;');
  });
});
