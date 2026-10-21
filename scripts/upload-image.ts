/** Explicit operator-only image publishing. Never imported by a build. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { atomicJson, readStagedImage } from './media/files';
import {
  prepareMedia,
  publishPreparedMedia,
  type PublishJournal,
} from './media/publish';
import { createMediaStorage } from './media/storage';
import { migrateLegacyImages, cacheLegacySources } from './media/migrate';
export async function uploadImage(
  argument: string,
  root = process.cwd(),
): Promise<void> {
  const input = await readStagedImage(argument, root);
  const prepared = await prepareMedia(input.key, input.bytes);
  const storage = createMediaStorage();
  const journalPath = resolve(
    root,
    'Untracked/media-operations',
    `${input.key}-${prepared.descriptor.source.sha256}.json`,
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
  await publishPreparedMedia(
    prepared,
    storage,
    journal,
    () => atomicJson(journalPath, journal),
    (descriptor) =>
      atomicJson(
        resolve(root, 'src/data/media', `${input.key}.json`),
        descriptor,
      ),
  );
  console.log(
    `Published ${input.key}: ${prepared.outputs.length} verified renditions. Reference image.asset and author its alt text.`,
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  dotenv.config({ path: '.env.local', quiet: true });
  if (process.argv.length !== 3) {
    console.error('Usage: npm run upload-image <about|blog|works>/<filename>');
    process.exitCode = 1;
  } else
    (process.argv[2] === '--migrate-legacy'
      ? migrateLegacyImages()
      : process.argv[2] === '--cache-legacy'
        ? cacheLegacySources()
        : uploadImage(process.argv[2])
    ).catch((error) => {
      console.error(
        error instanceof Error &&
          /^[A-Z_]+(?::[a-z0-9/-]+)?$/u.test(error.message)
          ? error.message
          : 'IMAGE_PUBLISH_FAILED',
      );
      process.exitCode = 1;
    });
}
