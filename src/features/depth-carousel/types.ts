import type { CollectionDisplayRecord } from '../collections/types';

export type DepthCarouselItem = Omit<
  CollectionDisplayRecord,
  'image' | 'search'
> & {
  image: Omit<CollectionDisplayRecord['image'], 'height' | 'width'> & {
    height: number;
    width: number;
  };
};

export interface DepthCarouselProps {
  label: string;
  items: readonly DepthCarouselItem[];
}
