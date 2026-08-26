import type { CollectionDisplayRecord } from '../collections/types';

export type DepthCarouselItem = Omit<CollectionDisplayRecord, 'search'>;

export interface DepthCarouselProps {
  label: string;
  items: readonly DepthCarouselItem[];
}
