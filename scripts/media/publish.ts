import { createHash } from 'node:crypto';
import sharp from 'sharp';
import {
  assetKeyPattern,
  parseMediaDescriptor,
  PIPELINE_VERSION,
  PUBLIC_MEDIA_HOST,
  renditionPath,
  renditionSpecs,
  type MediaDescriptor,
  type MediaLane,
  type RenditionSpec,
} from '../../src/features/media/contract';

export const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');
export interface PreparedOutput extends RenditionSpec {
  path: string;
  bytes: Uint8Array;
  sha256: string;
  contentType: string;
}
export interface PreparedMedia {
  key: string;
  original: {
    path: string;
    bytes: Uint8Array;
    sha256: string;
    contentType: string;
  };
  outputs: PreparedOutput[];
  descriptor: MediaDescriptor;
}
export async function prepareMedia(
  key: string,
  bytes: Uint8Array,
): Promise<PreparedMedia> {
  if (!assetKeyPattern.test(key)) throw new Error('INVALID_MEDIA_KEY');
  if (bytes.length > 20 * 1024 * 1024) throw new Error('SOURCE_TOO_LARGE');
  const metadata = await sharp(bytes, {
    limitInputPixels: 64000000,
    animated: true,
  }).metadata();
  if ((metadata.pages ?? 1) !== 1)
    throw new Error('ANIMATED_SOURCE_UNSUPPORTED');
  const format =
    metadata.format === 'heif' && metadata.mediaType === 'image/avif'
      ? 'avif'
      : metadata.format;
  if (!format || !['jpeg', 'png', 'webp', 'avif', 'gif'].includes(format))
    throw new Error('UNSUPPORTED_SOURCE');
  const oriented = metadata.autoOrient;
  const width = oriented?.width ?? metadata.width;
  const height = oriented?.height ?? metadata.height;
  const lane = key.split('/')[0] as MediaLane;
  const expected = lane === 'about' ? [1200, 1600] : [1920, 1080];
  if (
    !width ||
    !height ||
    (lane === 'about'
      ? width < 1200 || height < 1600 || width * 4 !== height * 3
      : width !== expected[0] || height !== expected[1])
  )
    throw new Error(`SOURCE_DIMENSIONS:${key}`);
  const sourceHash = sha256(bytes);
  const outputs: PreparedOutput[] = [];
  for (const spec of renditionSpecs(lane)) {
    let encoded: Buffer | undefined;
    let measuredBytes = 0;
    for (
      let quality = spec.format === 'webp' ? 82 : 80;
      quality >= 70;
      quality -= 2
    ) {
      let image = sharp(bytes, { limitInputPixels: 64000000 })
        .rotate()
        .resize({ width: spec.width, withoutEnlargement: true });
      image =
        spec.format === 'jpeg'
          ? image
              .flatten({ background: '#ffffff' })
              .jpeg({ quality, mozjpeg: true })
          : image.webp({ quality });
      const candidate = await image.toBuffer();
      measuredBytes = candidate.length;
      if (candidate.length <= spec.maxBytes) {
        encoded = candidate;
        break;
      }
    }
    if (!encoded)
      throw new Error(
        `RENDITION_BUDGET:${spec.role}:${measuredBytes}:${spec.maxBytes}`,
      );
    const dimensions = await sharp(encoded).metadata();
    if (!dimensions.width || !dimensions.height)
      throw new Error('INVALID_ENCODED_DIMENSIONS');
    const digest = sha256(encoded);
    outputs.push({
      ...spec,
      width: dimensions.width,
      height: dimensions.height,
      bytes: encoded,
      sha256: digest,
      contentType: `image/${spec.format}`,
      path: renditionPath(key, sourceHash, spec.role, digest, spec.format),
    });
  }
  const descriptor = parseMediaDescriptor(key, {
    schemaVersion: 1,
    pipelineVersion: PIPELINE_VERSION,
    source: { sha256: sourceHash, width, height, format },
    renditions: outputs.map((r) => ({
      role: r.role,
      width: r.width,
      height: r.height,
      format: r.format,
      bytes: r.bytes.length,
      sha256: r.sha256,
      url: `https://${PUBLIC_MEDIA_HOST}/${r.path}`,
    })),
  });
  return {
    key,
    descriptor,
    outputs,
    original: {
      path: `originals/${key}/${sourceHash}.${format === 'jpeg' ? 'jpg' : format}`,
      bytes,
      sha256: sourceHash,
      contentType: `image/${format}`,
    },
  };
}
export type MediaAccess = 'public' | 'private';
export interface ObjectIdentity {
  bytes: number;
  sha256: string;
  access: MediaAccess;
  contentType: string;
  url: string;
  cacheControl: string;
  etag?: string;
}
export interface MediaStorage {
  inspect(
    path: string,
    access: MediaAccess,
    previous?: ObjectIdentity,
  ): Promise<ObjectIdentity | null>;
  put(
    path: string,
    bytes: Uint8Array,
    access: MediaAccess,
    contentType: string,
  ): Promise<void>;
}
export type PublishJournal = Record<string, ObjectIdentity>;
export async function publishPreparedMedia(
  prepared: PreparedMedia,
  storage: MediaStorage,
  journal: PublishJournal,
  saveJournal: () => Promise<void>,
  commitDescriptor: (descriptor: MediaDescriptor) => Promise<void>,
): Promise<void> {
  const targets = [
    { ...prepared.original, access: 'private' as const },
    ...prepared.outputs.map((r) => ({ ...r, access: 'public' as const })),
  ];
  for (const target of targets) {
    let actual = await storage.inspect(
      target.path,
      target.access,
      journal[`${target.access}:${target.path}`],
    );
    if (!actual) {
      await storage.put(
        target.path,
        target.bytes,
        target.access,
        target.contentType,
      );
      actual = await storage.inspect(target.path, target.access);
    }
    if (
      !actual ||
      actual.bytes !== target.bytes.length ||
      actual.sha256 !== target.sha256 ||
      actual.access !== target.access ||
      actual.contentType !== target.contentType ||
      !/(?:^|,)\s*max-age=31536000(?:\s*,|\s*$)/u.test(actual.cacheControl) ||
      (target.access === 'public' &&
        actual.url !== `https://${PUBLIC_MEDIA_HOST}/${target.path}`)
    )
      throw new Error(`OBJECT_CONFLICT:${target.path}`);
    journal[`${target.access}:${target.path}`] = actual;
    await saveJournal();
  }
  await commitDescriptor(prepared.descriptor);
}
