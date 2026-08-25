const DRAG_COMMIT_THRESHOLD = 48;
const HORIZONTAL_INTENT_RATIO = 1.25;

function requireItemCount(itemCount: number): void {
  if (!Number.isInteger(itemCount) || itemCount <= 0) {
    throw new RangeError('A carousel index requires a non-empty collection.');
  }
}

export function wrapIndex(
  index: number,
  delta: number,
  itemCount: number,
): number {
  requireItemCount(itemCount);
  return (((index + delta) % itemCount) + itemCount) % itemCount;
}

export function getRecededIndices(
  activeIndex: number,
  itemCount: number,
  maximumLayers: number,
): number[] {
  requireItemCount(itemCount);
  if (!Number.isInteger(maximumLayers) || maximumLayers < 0) {
    throw new RangeError(
      'Receding layer count must be a non-negative integer.',
    );
  }

  return Array.from(
    { length: Math.min(maximumLayers, itemCount - 1) },
    (_, layerIndex) => wrapIndex(activeIndex, layerIndex + 1, itemCount),
  );
}

export function resolveDragDelta(offsetX: number, offsetY: number): -1 | 0 | 1 {
  const horizontalDistance = Math.abs(offsetX);
  const verticalDistance = Math.abs(offsetY);
  if (
    horizontalDistance < DRAG_COMMIT_THRESHOLD ||
    horizontalDistance < verticalDistance * HORIZONTAL_INTENT_RATIO
  ) {
    return 0;
  }
  return offsetX < 0 ? 1 : -1;
}

export function resolveRecededSelection(
  activeIndex: number,
  selectedIndex: number,
  itemCount: number,
  wasDrag: boolean,
): number {
  return wasDrag
    ? wrapIndex(activeIndex, 0, itemCount)
    : wrapIndex(selectedIndex, 0, itemCount);
}
