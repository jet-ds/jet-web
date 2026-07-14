import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  estimateTokens,
  SEGMENTATION,
  SEGMENTATION_VERSION,
  segmentDocument,
} from '../../../src/features/jets-ghost/corpus/segment';

const repeatedCode = `\`\`\`txt\n${'same content '.repeat(90).trim()}\n\`\`\``;
const repeatedChunkFixture = {
  documentId: 'blog:repeated' as const,
  sections: [{
    heading: 'Repeated',
    headingPath: ['Repeated'],
    text: `${repeatedCode}\n\n${repeatedCode}`,
    order: 0,
  }],
};

const collisionFixture = {
  documentId: 'blog:collision' as const,
  sections: [{
    heading: 'Collision',
    headingPath: ['Collision'],
    text: `\`\`\`txt\n${'first block '.repeat(90).trim()}\n\`\`\`\n\n\`\`\`txt\n${'second block '.repeat(90).trim()}\n\`\`\``,
    order: 0,
  }],
};

describe('knowledge segmentation', () => {
  it('exposes the approved version and token policy', () => {
    expect(SEGMENTATION_VERSION).toBe('1.0.0');
    expect(SEGMENTATION).toEqual({
      targetTokens: 256,
      maxTokens: 512,
      overlapTokens: 32,
    });
    expect(estimateTokens('12345')).toBe(2);
  });

  it('keeps stable section ids and content-hashed chunk ids', () => {
    const result = segmentDocument({
      documentId: 'blog:example',
      sections: [{ heading: 'Install', headingPath: ['Install'], text: 'Run the installer.', order: 0 }],
    });
    const expectedHash = createHash('sha256').update('Run the installer.').digest('hex');

    expect(result.sections[0].id).toBe('blog:example#install');
    expect(result.chunks[0].id).toBe(`blog:example#install:${expectedHash}:0`);
    expect(result.chunks[0].contentHash).toBe(expectedHash);
  });

  it('slugifies full heading paths and appends ordinals to duplicate paths', () => {
    const result = segmentDocument({
      documentId: 'works:guide',
      sections: [
        { heading: 'Install', headingPath: ['Install'], text: 'First.', order: 0 },
        { heading: 'Linux', headingPath: ['Install', 'Linux'], text: 'Second.', order: 1 },
        { heading: 'Linux', headingPath: ['Install', 'Linux'], text: 'Third.', order: 2 },
      ],
    });

    expect(result.sections.map((section) => section.id)).toEqual([
      'works:guide#install',
      'works:guide#install-linux',
      'works:guide#install-linux-2',
    ]);
  });

  it('reserves section ids even when empty natural and ordinalized slugs collide', () => {
    const result = segmentDocument({
      documentId: 'blog:empty-collisions',
      sections: [
        { heading: 'Foo', headingPath: ['Foo'], text: '', order: 0 },
        { heading: 'Foo', headingPath: ['Foo'], text: '', order: 1 },
        { heading: 'Foo 2', headingPath: ['Foo 2'], text: '', order: 2 },
      ],
    });
    const sectionIds = result.sections.map((section) => section.id);

    expect(sectionIds).toEqual([
      'blog:empty-collisions#foo',
      'blog:empty-collisions#foo-2',
      'blog:empty-collisions#foo-2-2',
    ]);
    expect(new Set(sectionIds).size).toBe(sectionIds.length);
  });

  it('advances duplicate ordinals past interleaved natural slug reservations', () => {
    const result = segmentDocument({
      documentId: 'blog:interleaved-collisions',
      sections: [
        { heading: 'Foo 2', headingPath: ['Foo 2'], text: 'Natural ordinal.', order: 0 },
        { heading: 'Foo', headingPath: ['Foo'], text: 'Base slug.', order: 1 },
        { heading: 'Foo', headingPath: ['Foo'], text: 'Repeated base slug.', order: 2 },
      ],
    });
    const sectionIds = result.sections.map((section) => section.id);

    expect(sectionIds).toEqual([
      'blog:interleaved-collisions#foo-2',
      'blog:interleaved-collisions#foo',
      'blog:interleaved-collisions#foo-3',
    ]);
    expect(new Set(sectionIds).size).toBe(sectionIds.length);
  });

  it('never exceeds the 512-token hard limit', () => {
    const text = Array.from({ length: 600 }, (_, index) => `word${index}`).join(' ');
    const result = segmentDocument({
      documentId: 'blog:large',
      sections: [{ heading: 'Large', headingPath: ['Large'], text, order: 0 }],
    });

    expect(result.chunks.length).toBeGreaterThan(1);
    expect(result.chunks.every((chunk) => chunk.estimatedTokens <= 512)).toBe(true);
  });

  it('keeps fenced code blocks intact when they fit the hard limit', () => {
    const code = `\`\`\`ts\n${'const value = true;\n'.repeat(55).trim()}\n\`\`\``;
    const result = segmentDocument({
      documentId: 'blog:code',
      sections: [{
        heading: 'Code',
        headingPath: ['Code'],
        text: `Intro paragraph.\n\n${code}\n\nClosing paragraph.`,
        order: 0,
      }],
    });

    expect(result.chunks.some((chunk) => chunk.text === code)).toBe(true);
  });

  it('splits oversized code and unbroken text without violating the hard limit', () => {
    const oversizedCode = `\`\`\`txt\n${'x'.repeat(4_500)}\n\`\`\``;
    const result = segmentDocument({
      documentId: 'blog:oversized',
      sections: [{
        heading: 'Oversized',
        headingPath: ['Oversized'],
        text: `${oversizedCode}\n\n${'y'.repeat(4_500)}`,
        order: 0,
      }],
    });

    expect(result.chunks.length).toBeGreaterThan(4);
    expect(result.chunks.every((chunk) => chunk.estimatedTokens <= 512)).toBe(true);
  });

  it('gives repeated identical chunks distinct deterministic ids', () => {
    const result = segmentDocument(repeatedChunkFixture);

    expect(new Set(result.chunks.map((chunk) => chunk.id)).size).toBe(result.chunks.length);
    expect(result.chunks.map((chunk) => chunk.sameTextOccurrence)).toEqual([0, 1]);
  });

  it('does not create chunks for empty sections', () => {
    const result = segmentDocument({
      documentId: 'blog:empty',
      sections: [{ heading: 'Introduction', headingPath: ['Introduction'], text: '', order: 0 }],
    });

    expect(result.sections).toHaveLength(1);
    expect(result.chunks).toEqual([]);
  });

  it('fails closed when the digest provider produces a final id collision', () => {
    expect(() => segmentDocument(collisionFixture, { digest: () => '0'.repeat(64) }))
      .toThrow(/duplicate chunk id/i);
  });

  it('rejects digest providers that do not return a full SHA-256 hex digest', () => {
    expect(() => segmentDocument(repeatedChunkFixture, { digest: () => 'not-a-sha256' }))
      .toThrow(/sha-256 digest/i);
  });
});
