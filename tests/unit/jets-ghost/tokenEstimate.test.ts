import { describe, expect, it } from 'vitest';
import { estimateTokens as estimateTokensFromSegment } from '../../../src/features/jets-ghost/corpus/segment';
import {
  estimateTokens,
  estimateTokensFromCharacters,
} from '../../../src/features/jets-ghost/tokenEstimate';

describe('shared browser-safe token estimator', () => {
  it.each([
    [0, 0],
    [1, 1],
    [4, 1],
    [5, 2],
    [9_011 * 4, 9_011],
  ])('estimates %i serialized characters as %i tokens', (characters, tokens) => {
    expect(estimateTokensFromCharacters(characters)).toBe(tokens);
    expect(estimateTokens('x'.repeat(characters))).toBe(tokens);
  });

  it('preserves the corpus segmenter public export as the shared implementation', () => {
    expect(estimateTokensFromSegment).toBe(estimateTokens);
  });
});
