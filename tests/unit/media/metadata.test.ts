import { it, expect } from 'vitest';
import { generateSEOProps } from '../../../src/utils/seo';
import { mediaDescriptor } from '../../fixtures/media';
it('permits correctly dimensioned social renditions and rejects original/private metadata bypasses', () => {
  const social = mediaDescriptor('blog/example').renditions.find(
    (r) => r.role === 'social',
  )!;
  expect(
    generateSEOProps({ image: social.url, imageWidth: 1200, imageHeight: 675 })
      .image,
  ).toBe(social.url);
  for (const image of [
    'https://vyge4wbmw8jgd8rh.public.blob.vercel-storage.com/images/about/about-hero-b0ab33a5.jpg',
    'https://example.private.blob.vercel-storage.com/originals/image.jpg',
    'https://VYGE4WBMW8JGD8RH.PUBLIC.BLOB.VERCEL-STORAGE.COM/images/blog/spider-man-brand-new-day-fcef4196.png',
    social.url + '?token=secret',
  ])
    expect(() =>
      generateSEOProps({ image, imageWidth: 1200, imageHeight: 675 }),
    ).toThrow('INVALID_SOCIAL_RENDITION');
  expect(() =>
    generateSEOProps({
      image: social.url,
      imageWidth: 1920,
      imageHeight: 1080,
    }),
  ).toThrow('INVALID_SOCIAL_RENDITION');
});
