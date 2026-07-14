import { describe, expect, it } from 'vitest';
import type { SelectedSource } from '../../../src/features/jets-ghost/selection/types';
import { extractValidCitations } from '../../../src/features/jets-ghost/prompt/citations';

function source(citationId: `S${number}`, text: string): SelectedSource {
  const suffix = citationId.slice(1);
  return {
    citationId,
    documentId: `blog:document-${suffix}`,
    documentOrder: Number(suffix),
    sectionId: `blog:document-${suffix}#section`,
    sectionOrder: 0,
    chunkId: `blog:document-${suffix}#section:${suffix.padStart(64, '0')}:0`,
    chunkOrder: 0,
    title: `Document ${suffix}`,
    canonicalUrl: `https://jetsanchez.com/blog/document-${suffix}/`,
    heading: 'Heading',
    text,
    estimatedTokens: 2,
    selectionReason: 'lexical-match',
    provenance: {
      sourcePath: `src/data/blog/document-${suffix}.mdx`,
      sourceHash: suffix.padStart(64, 'a'),
      chunkContentHash: suffix.padStart(64, 'b'),
      sourceCommit: 'commit-sha',
      corpusVersion: 'c'.repeat(64),
    },
  } as SelectedSource;
}

describe('citation allowlisting', () => {
  it('resolves selected citations in response order and deduplicates repeated IDs', () => {
    const first = source('S1', 'First');
    const second = source('S2', 'Second');

    expect(extractValidCitations(
      'Second claim [S2], first claim [S1], repeated [S2] [S1].',
      [first, second],
    )).toEqual([
      { id: 'S2', source: second },
      { id: 'S1', source: first },
    ]);
  });

  it('rejects unknown and citation-shaped but unselected IDs', () => {
    const selected = source('S1', 'Selected');

    expect(extractValidCitations(
      'Valid [S1], forged [S99], leading-zero [S01], malformed [Sx] and bare S1.',
      [selected],
    )).toEqual([{ id: 'S1', source: selected }]);
  });

  it('returns no citations when the current turn selected no sources', () => {
    expect(extractValidCitations('A confident but unsupported answer [S1].', []))
      .toEqual([]);
  });
});
