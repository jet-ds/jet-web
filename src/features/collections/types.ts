export interface CollectionImage {
  url: string;
  darkUrl?: string;
  srcSet?: string;
  darkSrcSet?: string;
  carousel?: { url: string; width: number; height: number; srcSet?: string };
  darkCarousel?: {
    url: string;
    width: number;
    height: number;
    srcSet?: string;
  };
  alt: string;
  width: 1920;
  height: 1080;
}

export interface CollectionDisplayRecord {
  id: string;
  href: string;
  kind: 'blog' | 'research' | 'project' | 'other';
  title: string;
  summary: string;
  image: CollectionImage;
  date: string;
  facts: readonly string[];
  search?: {
    title: string;
    shortTitle?: string;
    description: string;
    summary: string;
    tags: readonly string[];
  };
}
