/** One-time operator migration. Invoked exclusively through upload-image. */
import { list } from '@vercel/blob';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { PUBLIC_MEDIA_HOST } from '../../src/features/media/contract';
import { atomicJson } from './files';
import {
  prepareMedia,
  publishPreparedMedia,
  sha256,
  type PublishJournal,
} from './publish';
import { createMediaStorage } from './storage';

export const legacyImages = [
  ['about/about-hero-b0ab33a5.jpg', 9702383, true],
  ['blog/claude-code-guide-d74ab81e.png', 1280853, true],
  [
    'blog/eu-ai-act-regulating-technology-no-longer-exists-2ea9ebb2.jpg',
    1412896,
    true,
  ],
  ['blog/human-agency-agentic-age-23cc521c.webp', 286260, true],
  ['blog/philippines-ai-adoption-telemetry-6877427a.webp', 209520, false],
  ['blog/philippines-ai-adoption-telemetry-cb72b50a.webp', 211598, true],
  ['blog/spider-man-brand-new-day-fcef4196.png', 1995861, true],
  ['blog/test-image-184931fa.png', 565865, false],
  ['blog/vibe-coding-vs-agentic-coding-a1cec53a.png', 2211404, true],
  ['works/broad-reach-uneven-depth-2f36bce5.webp', 208392, true],
  ['works/digital-squad-timesheet-dashboard-dark-3df8f1fd.png', 141066, true],
  ['works/digital-squad-timesheet-dashboard-light-6571cb6d.png', 140578, true],
  ['works/recursive-convergence-hypothesis-422923f6.webp', 140968, true],
  ['works/test-image-184931fa.png', 565865, false],
] as const;
export function verifyLegacySource(
  name: string,
  size: number,
  bytes: Buffer,
  expectedHash?: string,
): string {
  const digest = sha256(bytes);
  const prefix = /-([a-f0-9]{8})\.[a-z]+$/u.exec(name)?.[1];
  if (
    bytes.length !== size ||
    !prefix ||
    !digest.startsWith(prefix) ||
    (expectedHash !== undefined && expectedHash !== digest)
  )
    throw new Error('INVALID_LEGACY_CACHE');
  return digest;
}
export async function cacheLegacySources(root = process.cwd()): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token?.startsWith('vercel_blob_rw_vYgE4WbMW8JGD8rh_'))
    throw new Error('MEDIA_CREDENTIAL_STORE_MISMATCH');
  const sourceManifestPath = resolve(
    root,
    'Untracked/media-migration/source-hashes.json',
  );
  let sourceHashes: Record<string, string> = {};
  try {
    sourceHashes = JSON.parse(await readFile(sourceManifestPath, 'utf8'));
  } catch (error) {
    if (!(
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ))
      throw new Error('INVALID_LEGACY_CACHE_MANIFEST');
  }
  const verifySource = async (name: string, size: number, bytes: Buffer) => {
    const digest = verifyLegacySource(name, size, bytes, sourceHashes[name]);
    sourceHashes[name] = digest;
    await atomicJson(sourceManifestPath, sourceHashes);
  };
  const inventory = await list({ token, limit: 1000, prefix: 'images/' });
  for (const [name, size] of legacyImages) {
    const path = `images/${name}`;
    const found = inventory.blobs.find((item) => item.pathname === path);
    const url = `https://${PUBLIC_MEDIA_HOST}/${path}`;
    if (!found || found.size !== size || found.url !== url)
      throw new Error('LEGACY_INVENTORY_CHANGED');
    const local = resolve(root, 'Untracked/media-migration/sources', name);
    let cached: Buffer | undefined;
    try {
      cached = await readFile(local);
    } catch (error) {
      if (!(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ))
        throw error;
    }
    if (cached) {
      await verifySource(name, size, cached);
      continue;
    }
    const response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(60000),
    });
    if (
      !response.ok ||
      Number(response.headers.get('content-length')) !== size
    ) {
      await response.body?.cancel();
      throw new Error('LEGACY_DOWNLOAD_FAILED');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('LEGACY_DOWNLOAD_FAILED');
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.length;
        if (length > size) throw new Error('LEGACY_DOWNLOAD_TOO_LARGE');
        chunks.push(part.value);
      }
    } finally {
      await reader.cancel();
    }
    if (length !== size) throw new Error('LEGACY_DOWNLOAD_TRUNCATED');
    const downloaded = Buffer.concat(chunks);
    await verifySource(name, size, downloaded);
    await mkdir(resolve(local, '..'), { recursive: true });
    await writeFile(local, downloaded, { flag: 'wx', mode: 0o600 });
  }
  console.log(
    `Cached ${legacyImages.length} legacy sources; no repeat downloads of cached originals.`,
  );
}
export async function migrateLegacyImages(root = process.cwd()): Promise<void> {
  const storage = createMediaStorage(); // Validate both credentials before downloading/publishing.
  await cacheLegacySources(root);
  const receipts = [];
  for (const [name, , active] of legacyImages) {
    const bytes = await readFile(
      resolve(root, 'Untracked/media-migration/sources', name),
    );
    const key = name.replace(/-[a-f0-9]{8}\.[a-z]+$/u, '');
    const hash = sha256(bytes);
    const journalPath = resolve(
      root,
      'Untracked/media-migration/receipts',
      `${name}.json`,
    );
    let journal: PublishJournal = {};
    try {
      journal = JSON.parse(await readFile(journalPath, 'utf8'));
    } catch (error) {
      if (!(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ))
        throw new Error('INVALID_OPERATION_JOURNAL');
    }
    let originalPath: string;
    if (active) {
      const prepared = await prepareMedia(key, bytes);
      originalPath = prepared.original.path;
      await publishPreparedMedia(
        prepared,
        storage,
        journal,
        () => atomicJson(journalPath, journal),
        (descriptor) =>
          atomicJson(
            resolve(root, 'src/data/media', `${key}.json`),
            descriptor,
          ),
      );
    } else {
      const metadata = await sharp(bytes, {
        animated: true,
        limitInputPixels: 64000000,
      }).metadata();
      const format = metadata.format;
      if (
        !format ||
        !['jpeg', 'png', 'webp', 'gif'].includes(format) ||
        (metadata.pages ?? 1) !== 1
      )
        throw new Error('UNSUPPORTED_LEGACY_SOURCE');
      originalPath = `originals/${key}/${hash}.${format === 'jpeg' ? 'jpg' : format}`;
      const receiptKey = `private:${originalPath}`;
      let object = await storage.inspect(
        originalPath,
        'private',
        journal[receiptKey],
      );
      if (!object) {
        await storage.put(originalPath, bytes, 'private', `image/${format}`);
        object = await storage.inspect(originalPath, 'private');
      }
      if (
        !object ||
        object.sha256 !== hash ||
        object.bytes !== bytes.length ||
        object.access !== 'private' ||
        object.contentType !== `image/${format}` ||
        !/(?:^|,)\s*max-age=31536000(?:\s*,|\s*$)/u.test(object.cacheControl)
      )
        throw new Error('ARCHIVE_VERIFICATION_FAILED');
      journal[receiptKey] = object;
      await atomicJson(journalPath, journal);
    }
    receipts.push({
      legacyUrl: `https://${PUBLIC_MEDIA_HOST}/images/${name}`,
      bytes: bytes.length,
      sha256: hash,
      key,
      originalPath,
      status: active ? 'published' : 'archived-only',
    });
    await atomicJson(
      resolve(root, 'Untracked/media-migration/manifest.json'),
      receipts,
    );
    console.log(
      `Verified ${key}: ${active ? 'archived and published' : 'archived only'}`,
    );
  }
}
