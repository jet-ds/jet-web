import { describe, expect, it } from 'vitest';
import type { SelectedSource } from '../../../src/features/egregore/selection/types';
import {
  extractValidCitations,
  getCitedDocumentSources,
} from '../../../src/features/egregore/prompt/citations';

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

    expect(
      extractValidCitations(
        'Second claim [S2], first claim [S1], repeated [S2] [S1].',
        [first, second],
      ),
    ).toEqual([
      { id: 'S2', source: second },
      { id: 'S1', source: first },
    ]);
  });

  it('rejects unknown and citation-shaped but unselected IDs', () => {
    const selected = source('S1', 'Selected');

    expect(
      extractValidCitations(
        'Valid [S1], forged [S99], leading-zero [S01], malformed [Sx] and bare S1.',
        [selected],
      ),
    ).toEqual([{ id: 'S1', source: selected }]);
  });

  it('returns no citations when the current turn selected no sources', () => {
    expect(
      extractValidCitations('A confident but unsupported answer [S1].', []),
    ).toEqual([]);
  });

  it('presents only validated cited documents, not uncited selected context', () => {
    const cited = source('S1', 'Cited');
    const uncited = source('S2', 'Selected but unused');
    const citations = extractValidCitations('Supported claim [S1].', [
      cited,
      uncited,
    ]);

    expect(getCitedDocumentSources(citations)).toEqual([
      { id: 'S1', source: cited },
    ]);
  });

  it('collapses cited chunks with the same canonical URL to the first citation', () => {
    const firstChunk = source('S2', 'First cited chunk');
    const secondChunk = {
      ...source('S3', 'Second cited chunk'),
      canonicalUrl: firstChunk.canonicalUrl,
      title: 'Same document, later chunk',
    };

    expect(
      getCitedDocumentSources([
        { id: 'S2', source: firstChunk },
        { id: 'S3', source: secondChunk },
      ]),
    ).toEqual([{ id: 'S2', source: firstChunk }]);
  });

  it('preserves first-citation order across different documents', () => {
    const firstCited = source('S3', 'First cited document');
    const secondCited = source('S1', 'Second cited document');

    expect(
      getCitedDocumentSources([
        { id: 'S3', source: firstCited },
        { id: 'S1', source: secondCited },
      ]),
    ).toEqual([
      { id: 'S3', source: firstCited },
      { id: 'S1', source: secondCited },
    ]);
  });
});
