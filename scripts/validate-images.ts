/**
 * Validates remote content images and their intrinsic dimensions.
 *
 * Usage: npm run validate-images
 */

import { readdirSync, readFileSync } from 'node:fs';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import sharp from 'sharp';
import { createContentSchemas } from '../src/schemas/content';
import { loadMediaAsset } from '../src/features/media/registry.server';
import { sha256 } from './media/publish';

type CollectionName = 'blog' | 'works';
type SupportedImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif';

export interface ImageReference {
  url: string;
  contentType: CollectionName;
  contentId: string;
  field: 'image.url' | 'image.darkUrl';
  width: number;
  height: number;
  bytes?: number;
  sha256?: string;
  format?: SupportedImageFormat;
}

interface ValidationResult extends ImageReference {
  status: 'success' | 'error';
  error?: string;
}

interface RemoteImageOptions {
  fetch?: typeof fetch;
  maxBytes?: number;
}

const repositoryRoot = resolve(fileURLToPath(import.meta.url), '../..');
const maximumImageBytes = 5 * 1024 * 1024;
const supportedFormats = new Set<SupportedImageFormat>([
  'jpeg',
  'png',
  'webp',
  'avif',
  'gif',
]);
const collections = [
  { name: 'blog' as const, directory: 'src/data/blog' },
  { name: 'works' as const, directory: 'src/data/works' },
];

export function readContentImages(root = repositoryRoot): ImageReference[] {
  const references: ImageReference[] = [];
  const { blogSchema, worksSchema } = createContentSchemas(root);

  for (const collection of collections) {
    const collectionRoot = resolve(root, collection.directory);

    const visit = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) {
          visit(path);
          continue;
        }
        if (
          !entry.isFile() ||
          !['.md', '.mdx'].includes(extname(entry.name).toLowerCase())
        ) {
          continue;
        }

        const source = matter(readFileSync(path, 'utf8')).data;
        const parsed =
          collection.name === 'blog'
            ? blogSchema.parse(source)
            : worksSchema.parse(source);
        if (!parsed.image) continue;

        const contentId = relative(collectionRoot, path)
          .slice(0, -extname(path).length)
          .split(sep)
          .join('/');
        for (const assetKey of [
          parsed.image.asset,
          ...('darkAsset' in parsed.image ? [parsed.image.darkAsset] : []),
        ]) {
          if (typeof assetKey !== 'string') continue;
          for (const rendition of loadMediaAsset(assetKey, root).renditions)
            references.push({
              ...rendition,
              contentType: collection.name,
              contentId: `${contentId}:${rendition.role}`,
              field: 'image.url',
            });
        }
      }
    };

    visit(collectionRoot);
  }

  for (const rendition of loadMediaAsset('about/about-hero', root).renditions)
    references.push({
      ...rendition,
      contentType: 'blog',
      contentId: `about:${rendition.role}`,
      field: 'image.url',
    });
  return [...new Map(references.map((item) => [item.url, item])).values()];
}

export async function decodeImageMetadata(
  bytes: Uint8Array,
): Promise<{ format: SupportedImageFormat; width: number; height: number }> {
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try {
    metadata = await sharp(bytes, {
      animated: false,
      limitInputPixels: 1920 * 1080 * 4,
    }).metadata();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to decode a supported image: ${message}`);
  }

  const format =
    metadata.format === 'heif' && metadata.mediaType === 'image/avif'
      ? 'avif'
      : metadata.format;
  if (
    format === undefined ||
    !supportedFormats.has(format as SupportedImageFormat) ||
    metadata.width === undefined ||
    metadata.height === undefined
  ) {
    throw new Error(
      'Unable to decode a supported image format and dimensions.',
    );
  }

  return {
    format: format as SupportedImageFormat,
    width: metadata.width,
    height: metadata.height,
  };
}

async function readBoundedResponse(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  const contentLengthHeader = response.headers.get('content-length');
  const contentLength =
    contentLengthHeader === null ? undefined : Number(contentLengthHeader);
  if (
    contentLength !== undefined &&
    (!Number.isSafeInteger(contentLength) || contentLength <= 0)
  ) {
    await response.body?.cancel();
    throw new Error('Image response payload is empty or invalid.');
  }
  if (contentLength !== undefined && contentLength > maxBytes) {
    await response.body?.cancel();
    throw new Error(
      `Image response payload exceeds the ${maxBytes}-byte safety limit.`,
    );
  }
  if (response.body === null) {
    throw new Error('Image response payload is empty or missing.');
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (
        totalBytes > maxBytes ||
        (contentLength !== undefined && totalBytes > contentLength)
      ) {
        await reader.cancel();
        throw new Error(
          'Image response payload exceeds its bounded length or safety limit.',
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) {
    throw new Error('Image response payload is empty.');
  }
  if (contentLength !== undefined && totalBytes !== contentLength) {
    throw new Error(
      `Image response payload length ${totalBytes} does not match declared length ${contentLength}.`,
    );
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function validateRemoteImage(
  reference: ImageReference,
  options: RemoteImageOptions = {},
): Promise<{ ok: boolean; error?: string }> {
  const fetchImage = options.fetch ?? fetch;
  const maxBytes = options.maxBytes ?? reference.bytes ?? maximumImageBytes;

  try {
    const response = await fetchImage(reference.url, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return {
        ok: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.toLowerCase().startsWith('image/')) {
      await response.body?.cancel();
      return { ok: false, error: `Invalid content-type: ${contentType}` };
    }

    const bytes = await readBoundedResponse(response, maxBytes);
    if (reference.bytes !== undefined && bytes.length !== reference.bytes)
      throw new Error('Rendition byte count mismatch.');
    if (reference.sha256 !== undefined && sha256(bytes) !== reference.sha256)
      throw new Error('Rendition SHA-256 mismatch.');
    const metadata = await decodeImageMetadata(bytes);
    if (
      reference.format !== undefined &&
      (metadata.format !== reference.format ||
        contentType.split(';')[0].trim().toLowerCase() !==
          `image/${reference.format}`)
    )
      throw new Error('Rendition format or MIME mismatch.');
    if (
      metadata.width !== reference.width ||
      metadata.height !== reference.height
    ) {
      return {
        ok: false,
        error: `Intrinsic dimensions ${metadata.width}x${metadata.height} do not match declared ${reference.width}x${reference.height}.`,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function main(): Promise<void> {
  console.log('🔍 Validating remote images...\n');

  const results: ValidationResult[] = [];
  for (const reference of readContentImages()) {
    const validation = await validateRemoteImage(reference);
    results.push({
      ...reference,
      status: validation.ok ? 'success' : 'error',
      error: validation.error,
    });
  }

  const errors = results.filter((result) => result.status === 'error');
  const successes = results.filter((result) => result.status === 'success');

  if (successes.length > 0) {
    console.log(`✅ ${successes.length} image(s) validated successfully\n`);
  }

  if (errors.length > 0) {
    console.error(`❌ ${errors.length} image validation error(s):\n`);
    for (const { contentType, contentId, field, url, error } of errors) {
      console.error(`  [${contentType}/${contentId} ${field}]`);
      console.error(`  URL: ${url}`);
      console.error(`  Error: ${error}\n`);
    }
    process.exitCode = 1;
    return;
  }

  if (results.length === 0) {
    console.log('ℹ️  No images found to validate');
  } else {
    console.log('✨ All images validated successfully!');
  }
}

const executablePath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (executablePath === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error('❌ Validation script failed:');
    console.error(error);
    process.exitCode = 1;
  });
}
