import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

const readSource = (path: string) => readFileSync(path, 'utf8');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return /\.(?:astro|tsx)$/u.test(entry.name) ? [path] : [];
    });
}

function anchorContaining(source: string, marker: string): string {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return '';

  const anchorStart = source.lastIndexOf('<a', markerIndex);
  const anchorEnd = source.indexOf('</a>', markerIndex);
  return anchorStart === -1 || anchorEnd === -1
    ? ''
    : source.slice(anchorStart, anchorEnd + 4);
}

describe('annotation consistency contracts', () => {
  test('the action-consumer inventory stays deliberate', () => {
    const actualConsumers = sourceFiles('src')
      .filter((path) => /<Button\b|data-action-variant=/u.test(readSource(path)))
      .map((path) => relative('.', path))
      .sort();

    expect(actualConsumers).toEqual([
      'src/components/ui/Button.astro',
      'src/features/jets-ghost/JetsGhostExperience.tsx',
      'src/layouts/WorkLayout.astro',
      'src/pages/about.astro',
      'src/pages/blog/index.astro',
      'src/pages/contact.astro',
      'src/pages/index.astro',
      'src/pages/licenses/jets-ghost.astro',
      'src/pages/works/index.astro',
    ]);
  });

  test.each([
    {
      file: 'src/pages/index.astro',
      forbidden: ['About Me', 'Get in Touch', 'View All', 'Contact Me', 'Learn More'],
      required: ['About me', 'Get in touch', 'View all', 'Contact me', 'Learn more'],
    },
    {
      file: 'src/features/jets-ghost/JetsGhostExperience.tsx',
      forbidden: ['Visit Blog', 'Visit Works'],
      required: ['Visit blog', 'Visit works'],
    },
    {
      file: 'src/layouts/WorkLayout.astro',
      forbidden: ['View Repository', 'Live Demo', 'Back to Works'],
      required: ['View repository', 'Live demo', 'Back to works'],
    },
    {
      file: 'src/layouts/BlogLayout.astro',
      forbidden: ['Back to Blog'],
      required: ['Back to blog'],
    },
  ])('uses sentence-case action copy in $file', ({ file, forbidden, required }) => {
    const source = readSource(file);

    for (const copy of forbidden) expect(source).not.toContain(copy);
    for (const copy of required) expect(source).toContain(copy);
  });

  test('sentence case preserves proper names and acronyms by allowlist', () => {
    expect(readSource('src/pages/contact.astro')).toContain('Get in Touch');
    expect(readSource('src/pages/about.astro')).toMatch(
      /github: 'GitHub',[\s\S]*linkedin: 'LinkedIn',[\s\S]*ssrn: 'SSRN',[\s\S]*scholar: 'Google Scholar'/u,
    );
    expect(readSource('src/data/works/recursive-convergence-hypothesis.mdx'))
      .toContain('label: "View on SSRN"');
    expect(readSource('src/pages/licenses/jets-ghost.astro'))
      .toContain("Back to Jet's Ghost");
    expect(readSource('src/features/jets-ghost/JetsGhostExperience.tsx'))
      .toContain("Load Jet&apos;s Ghost · about 2 GB");
  });

  test('sentence-case edits preserve action variants and densities', () => {
    const home = readSource('src/pages/index.astro');
    expect(home).toContain(
      '<Button href="/contact/" variant="accent" density="immersive">Contact me</Button>',
    );
    expect(home).toContain(
      '<Button href="/about/" variant="brand" density="immersive">Learn more</Button>',
    );

    const workLayout = readSource('src/layouts/WorkLayout.astro');
    expect(workLayout).toMatch(
      /variant="outline"\s+density="compact"\s*>\s*View repository/u,
    );
    expect(workLayout).toMatch(
      /variant="secondary"\s+density="compact"\s*>\s*Live demo/u,
    );

    const ghost = readSource('src/features/jets-ghost/JetsGhostExperience.tsx');
    for (const label of ['Visit blog', 'Visit works']) {
      const anchor = anchorContaining(ghost, `>${label}</a>`);
      expect(anchor).toContain('data-action-variant="outline"');
      expect(anchor).toContain('data-action-density="immersive"');
      expect(anchor).toMatch(/className="[^"]*\baction\b[^"]*"/u);
      expect(anchor).not.toContain('text-link');
    }
  });

  test('cards, navigation, citations, and source disclosures keep their own link semantics', () => {
    for (const file of [
      'src/components/blog/BlogCard.astro',
      'src/components/blog/TableOfContents.astro',
      'src/components/layout/Footer.astro',
      'src/components/navigation/LiquidGlassDock.tsx',
      'src/components/works/WorkCard.astro',
      'src/pages/blog/[slug].astro',
      'src/pages/index.astro',
    ]) {
      expect(readSource(file), file).not.toContain('text-link');
    }

    const ghost = readSource('src/features/jets-ghost/JetsGhostExperience.tsx');
    const citation = anchorContaining(
      ghost,
      'aria-label={`${part} ${source.title}`}',
    );
    const sourceDisclosureLink = anchorContaining(
      ghost,
      'aria-label={`[${id}] ${source.title}`}',
    );
    expect(citation).not.toContain('text-link');
    expect(sourceDisclosureLink).not.toContain('text-link');
    expect(ghost).toMatch(
      /data-testid="response-source-disclosure"[\s\S]*?<button[\s\S]*?className="[^"]*\baction\b/u,
    );

    const licenseNotice = anchorContaining(
      readSource('src/pages/licenses/jets-ghost.astro'),
      'Read third-party notices',
    );
    expect(licenseNotice).toMatch(/class="[^"]*\baction\b[^"]*"/u);
    expect(licenseNotice).not.toContain('text-link');
  });
});
