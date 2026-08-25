import { describe, expect, it } from 'vitest';
import {
  getRecededIndices,
  resolveDragDelta,
  resolveRecededSelection,
  wrapIndex,
} from '../../../src/features/depth-carousel/carouselState';

describe('depth carousel state', () => {
  it.each([
    { index: 0, delta: 1, count: 3, expected: 1 },
    { index: 2, delta: 1, count: 3, expected: 0 },
    { index: 0, delta: -1, count: 3, expected: 2 },
    { index: 1, delta: 8, count: 5, expected: 4 },
    { index: 1, delta: -8, count: 5, expected: 3 },
    { index: 0, delta: 99, count: 1, expected: 0 },
  ])(
    'wraps index $index by $delta across $count finite items',
    ({ index, delta, count, expected }) => {
      expect(wrapIndex(index, delta, count)).toBe(expected);
    },
  );

  it.each([0, -1])('rejects the empty item count %s', (itemCount) => {
    expect(() => wrapIndex(0, 1, itemCount)).toThrow(RangeError);
  });

  it('returns only unique finite receded selections in canonical circular order', () => {
    expect(getRecededIndices(4, 5, 3)).toEqual([0, 1, 2]);
    expect(getRecededIndices(1, 3, 3)).toEqual([2, 0]);
    expect(getRecededIndices(0, 1, 3)).toEqual([]);
  });

  it('promotes a selected receded item unless the click follows a drag', () => {
    expect(resolveRecededSelection(0, 2, 5, false)).toBe(2);
    expect(resolveRecededSelection(0, 2, 5, true)).toBe(0);
  });

  it.each([
    { x: -47, y: 0, expected: 0 },
    { x: 47, y: 0, expected: 0 },
    { x: -80, y: 72, expected: 0 },
    { x: 80, y: -72, expected: 0 },
    { x: -80, y: 20, expected: 1 },
    { x: 80, y: -20, expected: -1 },
  ])(
    'commits only deliberate horizontal drag ($x, $y)',
    ({ x, y, expected }) => {
      expect(resolveDragDelta(x, y)).toBe(expected);
    },
  );
});
