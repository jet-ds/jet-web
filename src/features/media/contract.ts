import { z } from 'zod';

export const PUBLIC_MEDIA_HOST =
  'vyge4wbmw8jgd8rh.public.blob.vercel-storage.com';
export const PIPELINE_VERSION = 'v1';
export const assetKeyPattern =
  /^(about|blog|works)\/[a-z0-9]+(?:-[a-z0-9]+)*$/u;
export type MediaLane = 'about' | 'blog' | 'works';
export interface RenditionSpec {
  role: string;
  width: number;
  height: number;
  format: 'webp' | 'jpeg';
  maxBytes: number;
}
export function renditionSpecs(lane: MediaLane): readonly RenditionSpec[] {
  return lane === 'about'
    ? [
        {
          role: 'portrait-small',
          width: 400,
          height: 533,
          format: 'webp',
          maxBytes: 100000,
        },
        {
          role: 'portrait-medium',
          width: 800,
          height: 1067,
          format: 'webp',
          maxBytes: 200000,
        },
        {
          role: 'portrait-detail',
          width: 1200,
          height: 1600,
          format: 'webp',
          maxBytes: 350000,
        },
      ]
    : [
        {
          role: 'responsive-small',
          width: 480,
          height: 270,
          format: 'webp',
          maxBytes: 60000,
        },
        {
          role: 'responsive-medium',
          width: 960,
          height: 540,
          format: 'webp',
          maxBytes: 160000,
        },
        {
          role: 'carousel',
          width: 1152,
          height: 648,
          format: 'webp',
          maxBytes: 220000,
        },
        {
          role: 'responsive-large',
          width: 1440,
          height: 810,
          format: 'webp',
          maxBytes: 300000,
        },
        {
          role: 'detail',
          width: 1920,
          height: 1080,
          format: 'webp',
          maxBytes: 500000,
        },
        {
          role: 'social',
          width: 1200,
          height: 675,
          format: 'jpeg',
          maxBytes: 200000,
        },
      ];
}
const digest = z.string().regex(/^[a-f0-9]{64}$/u);
const sourceSchema = z
  .object({
    sha256: digest,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    format: z.enum(['jpeg', 'png', 'webp', 'avif', 'gif']),
  })
  .strict();
const renditionSchema = z
  .object({
    role: z.string(),
    url: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    format: z.enum(['webp', 'jpeg']),
    bytes: z.number().int().positive(),
    sha256: digest,
  })
  .strict();
const descriptorSchema = z
  .object({
    schemaVersion: z.literal(1),
    pipelineVersion: z.literal(PIPELINE_VERSION),
    source: sourceSchema,
    renditions: z.array(renditionSchema),
  })
  .strict();
export type MediaDescriptor = z.infer<typeof descriptorSchema>;
export type MediaRendition = MediaDescriptor['renditions'][number];
export function renditionPath(
  key: string,
  sourceHash: string,
  role: string,
  outputHash: string,
  format: 'webp' | 'jpeg',
): string {
  return `images/${PIPELINE_VERSION}/${key}/${sourceHash}/${role}-${outputHash}.${format === 'jpeg' ? 'jpg' : 'webp'}`;
}
export function parseMediaDescriptor(
  key: string,
  input: unknown,
): MediaDescriptor {
  if (!assetKeyPattern.test(key)) throw new Error('INVALID_MEDIA_KEY');
  const parsed = descriptorSchema.parse(input);
  const lane = key.split('/')[0] as MediaLane;
  const [width, height] = lane === 'about' ? [1200, 1600] : [1920, 1080];
  if (
    lane === 'about'
      ? parsed.source.width < 1200 ||
        parsed.source.height < 1600 ||
        parsed.source.width * 4 !== parsed.source.height * 3 ||
        parsed.source.width * parsed.source.height > 64000000
      : parsed.source.width !== width || parsed.source.height !== height
  )
    throw new Error('INVALID_SOURCE_DIMENSIONS');
  const specs = renditionSpecs(lane);
  if (parsed.renditions.length !== specs.length)
    throw new Error('INCOMPLETE_RENDITIONS');
  for (const spec of specs) {
    const matches = parsed.renditions.filter((r) => r.role === spec.role);
    if (matches.length !== 1) throw new Error('INCOMPLETE_RENDITIONS');
    const r = matches[0];
    if (
      r.width !== spec.width ||
      Math.abs(r.height - spec.height) >
        (lane === 'about' && spec.width < 1200 ? 1 : 0) ||
      r.format !== spec.format ||
      r.bytes > spec.maxBytes
    )
      throw new Error('INVALID_RENDITION');
    const expected = `https://${PUBLIC_MEDIA_HOST}/${renditionPath(key, parsed.source.sha256, r.role, r.sha256, r.format)}`;
    if (r.url !== expected) throw new Error('INVALID_RENDITION_URL');
  }
  return parsed;
}
export interface MediaPresentation {
  url: string;
  width: number;
  height: number;
  srcSet?: string;
}
export function resolveMediaPresentation(
  asset: MediaDescriptor,
  role: string,
): MediaPresentation {
  const r = asset.renditions.find((item) => item.role === role);
  if (!r) throw new Error('MISSING_RENDITION');
  const variants = asset.renditions
    .filter((item) => item.format === r.format)
    .sort((a, b) => a.width - b.width);
  return {
    url: r.url,
    width: r.width,
    height: r.height,
    ...(r.format === 'webp'
      ? {
          srcSet: variants
            .map((item) => `${item.url} ${item.width}w`)
            .join(', '),
        }
      : {}),
  };
}
