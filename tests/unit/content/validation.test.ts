import { describe, expect, it } from 'vitest';
import {
  assertGeneratedAssistantSources,
  type ContentPolicyError,
  type ContentValidationRecord,
  validateContentRecords,
} from '../../../src/content/validation';

function record(overrides: Partial<ContentValidationRecord> = {}): ContentValidationRecord {
  return {
    path: 'src/data/blog/example.mdx',
    tracked: true,
    canonicalId: 'blog:example',
    canonicalUrl: 'https://jetsanchez.com/blog/example',
    status: 'published',
    assistant: false,
    links: [],
    ...overrides,
  };
}

function expectRule(
  errors: ContentPolicyError[],
  code: ContentPolicyError['code'],
  path: string,
): void {
  expect(errors).toContainEqual(expect.objectContaining({ code, path }));
}

describe('content validation', () => {
  it.each([
    {
      name: 'missing status',
      overrides: { status: undefined },
      code: 'missing-status',
    },
    {
      name: 'unsupported status',
      overrides: { status: 'archived' },
      code: 'unsupported-status',
    },
    {
      name: 'non-boolean explicit assistant flag',
      overrides: { assistant: 'true' },
      code: 'invalid-assistant-flag',
    },
    {
      name: 'assistant-enabled draft',
      overrides: { status: 'draft', assistant: true },
      code: 'assistant-not-published',
    },
    {
      name: 'untracked published entry',
      overrides: { tracked: false },
      code: 'published-untracked',
    },
    {
      name: 'HTTP canonical URL',
      overrides: { canonicalUrl: 'http://jetsanchez.com/blog/example' },
      code: 'invalid-canonical-url',
    },
    {
      name: 'relative canonical URL',
      overrides: { canonicalUrl: '/blog/example' },
      code: 'invalid-canonical-url',
    },
    {
      name: 'malformed canonical URL',
      overrides: { canonicalUrl: 'not a URL' },
      code: 'invalid-canonical-url',
    },
    {
      name: 'HTTP published link URL',
      overrides: { links: [{ label: 'Reference', url: 'http://example.com/reference' }] },
      code: 'invalid-link-url',
    },
    {
      name: 'relative published link URL',
      overrides: { links: [{ label: 'Reference', url: '/reference' }] },
      code: 'invalid-link-url',
    },
    {
      name: 'non-string published link URL',
      overrides: { links: [{ label: 'Reference', url: 42 }] },
      code: 'invalid-link-url',
    },
  ] satisfies Array<{
    name: string;
    overrides: Partial<ContentValidationRecord>;
    code: ContentPolicyError['code'];
  }>)('reports $name with a stable path-qualified rule', ({ overrides, code }) => {
    const input = record(overrides);
    expectRule(validateContentRecords([input]), code, input.path);
  });

  it('does not apply publication predicates after invalid raw fields', () => {
    const input = record({
      tracked: false,
      status: 'archived',
      assistant: true,
    });

    expect(validateContentRecords([input])).toEqual([
      expect.objectContaining({
        code: 'unsupported-status',
        path: input.path,
      }),
    ]);
  });

  it('allows omitted assistant because the shared schema defaults it to false', () => {
    expect(validateContentRecords([record({ assistant: undefined })])).toEqual([]);
  });

  it('validates published links but leaves draft links for authoring', () => {
    expect(validateContentRecords([record({
      status: 'draft',
      assistant: false,
      links: [{ label: 'Work in progress', url: '#' }],
    })])).toEqual([]);
  });

  it('detects canonical IDs that normalize to the same Unicode value', () => {
    const first = record({ canonicalId: 'blog:caf\u00e9' });
    const duplicate = record({
      path: 'src/data/blog/cafe-combining.mdx',
      canonicalId: 'blog:cafe\u0301',
      canonicalUrl: 'https://jetsanchez.com/blog/cafe-combining',
    });

    expectRule(
      validateContentRecords([first, duplicate]),
      'duplicate-canonical-id',
      duplicate.path,
    );
  });

  it('detects canonical URLs that are equal after URL normalization', () => {
    const first = record({ canonicalUrl: 'https://JETsanchez.com:443/blog/example' });
    const duplicate = record({
      path: 'src/data/blog/duplicate-url.mdx',
      canonicalId: 'blog:duplicate-url',
      canonicalUrl: 'https://jetsanchez.com/blog/example',
    });

    expectRule(
      validateContentRecords([first, duplicate]),
      'duplicate-canonical-url',
      duplicate.path,
    );
  });

  it.each([
    {
      name: 'missing',
      records: [record()],
      generatedId: 'blog:missing',
      path: 'generated:blog:missing',
    },
    {
      name: 'ineligible',
      records: [record({ status: 'draft', assistant: false })],
      generatedId: 'blog:example',
      path: 'src/data/blog/example.mdx',
    },
    {
      name: 'untracked',
      records: [record({ tracked: false, assistant: true })],
      generatedId: 'blog:example',
      path: 'src/data/blog/example.mdx',
    },
  ])('rejects a $name generated assistant source', ({ records, generatedId, path }) => {
    expectRule(
      assertGeneratedAssistantSources(records, [generatedId]),
      'generated-source-ineligible',
      path,
    );
  });

  it('accepts an untracked disabled draft without making it a generated source', () => {
    const draft = record({ tracked: false, status: 'draft', assistant: false });

    expect(validateContentRecords([draft])).toEqual([]);
    expect(assertGeneratedAssistantSources([draft], [])).toEqual([]);
    expectRule(
      assertGeneratedAssistantSources([draft], [draft.canonicalId]),
      'generated-source-ineligible',
      draft.path,
    );
  });
});
