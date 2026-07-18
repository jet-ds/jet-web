import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { worksSchema } from '../../../src/schemas/content';

function readSource(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('theme-aware Works images', () => {
  it('preserves a dark-mode image and verified intrinsic dimensions', () => {
    const parsed = worksSchema.parse({
      title: 'Digital Squad Timesheet',
      description: 'A weekly operations platform.',
      type: 'project',
      date: '2026-07-18',
      status: 'published',
      assistant: true,
      image: {
        url: 'https://example.com/timesheet-light.png',
        darkUrl: 'https://example.com/timesheet-dark.png',
        alt: 'Digital Squad Timesheet weekly dashboard',
        width: 1920,
        height: 1080,
      },
    });

    expect(parsed.image).toEqual({
      url: 'https://example.com/timesheet-light.png',
      darkUrl: 'https://example.com/timesheet-dark.png',
      alt: 'Digital Squad Timesheet weekly dashboard',
      width: 1920,
      height: 1080,
    });
  });

  it('keeps every Works cover surface on the shared theme-aware abstraction', () => {
    const workCard = readSource('../../../src/components/works/WorkCard.astro');
    const workLayout = readSource('../../../src/layouts/WorkLayout.astro');
    const contentTeaser = readSource('../../../src/components/content/ContentTeaserCard.astro');

    for (const source of [workCard, workLayout, contentTeaser]) {
      expect(source).toContain('ThemeAwareImage');
      expect(source).toContain('darkSrc=');
    }
  });

  it('keeps standalone image validation Astro-runtime-free and covers dark images', () => {
    const validator = readSource('../../../scripts/validate-images.ts');

    expect(validator).not.toContain("from 'astro:content'");
    expect(validator).toContain('darkUrl');
  });
});
