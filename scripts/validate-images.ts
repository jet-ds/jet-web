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
import { blogSchema, worksSchema } from '../src/schemas/content';

type CollectionName = 'blog' | 'works';
type SupportedImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif';

export interface ImageReference {
  url: string;
  contentType: CollectionName;
  contentId: string;
  field: 'image.url' | 'image.darkUrl';
  width: number;
  height: number;
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
        references.push({
          url: parsed.image.url,
          contentType: collection.name,
          contentId,
          field: 'image.url',
          width: parsed.image.width,
          height: parsed.image.height,
        });

        if (
          collection.name === 'works' &&
          'darkUrl' in parsed.image &&
          parsed.image.darkUrl
        ) {
          references.push({
            url: parsed.image.darkUrl,
            contentType: collection.name,
            contentId,
            field: 'image.darkUrl',
            width: parsed.image.width,
            height: parsed.image.height,
          });
        }
      }
    };

    visit(collectionRoot);
  }

  return references;
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
  if (contentLengthHeader === null) {
    throw new Error('Image response requires a Content-Length header.');
  }

  const contentLength = Number(contentLengthHeader);
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    throw new Error('Image response payload is empty or invalid.');
  }
  if (contentLength > maxBytes) {
    throw new Error(
      `Image response payload exceeds the ${maxBytes}-byte safety limit.`,
    );
  }
  if (response.body === null) {
    throw new Error('Image response payload is missing.');
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes || totalBytes > contentLength) {
        await reader.cancel();
        throw new Error(
          'Image response payload exceeds its declared bounded length.',
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (totalBytes !== contentLength) {
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
  const maxBytes = options.maxBytes ?? maximumImageBytes;

  try {
    const response = await fetchImage(reference.url, {
      method: 'GET',
      redirect: 'follow',
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.toLowerCase().startsWith('image/')) {
      return { ok: false, error: `Invalid content-type: ${contentType}` };
    }

    const bytes = await readBoundedResponse(response, maxBytes);
    const metadata = await decodeImageMetadata(bytes);
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
