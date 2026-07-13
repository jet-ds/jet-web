import { describe, expect, it } from 'vitest';
import { blogSchema } from '../../../src/schemas/content';
import { isAssistantEligible, isPublished } from '../../../src/content/policy';

const baseBlog = {
  title: 'Example',
  description: 'Example description',
  pubDate: '2026-07-11',
  tags: [],
};

describe('publication policy', () => {
  it('requires an explicit status', () => {
    expect(blogSchema.safeParse(baseBlog).success).toBe(false);
  });

  it('defaults assistant inclusion to false', () => {
    const parsed = blogSchema.parse({ ...baseBlog, status: 'published' });
    expect(parsed.assistant).toBe(false);
  });

  it('publishes only published entries', () => {
    expect(isPublished({ status: 'published', assistant: false })).toBe(true);
    expect(isPublished({ status: 'draft', assistant: true })).toBe(false);
  });

  it('requires both published and assistant enabled', () => {
    expect(isAssistantEligible({ status: 'published', assistant: true })).toBe(true);
    expect(isAssistantEligible({ status: 'published', assistant: false })).toBe(false);
    expect(isAssistantEligible({ status: 'draft', assistant: true })).toBe(false);
  });
});
