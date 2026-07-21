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
    expect(truncateDescription('Already concise.', 18)).toBe(
      'Already concise.',
    );
  });
});
