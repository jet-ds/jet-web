import { readdirSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTrackedContentPaths } from '../../src/content/gitTracking';
import { loadMediaAsset } from '../../src/features/media/registry.server';
export function verifyMedia(root = process.cwd()): void {
  const staging = resolve(root, 'public/images-staging');
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (
        entry.isSymbolicLink() ||
        (!entry.isDirectory() && entry.name !== '.gitkeep')
      )
        throw new Error('PUBLIC_MEDIA_STAGING_FORBIDDEN');
      if (entry.isDirectory()) visit(path);
    }
  };
  visit(staging);
  const tracked = loadTrackedContentPaths(root);
  for (const lane of ['about', 'blog', 'works']) {
    const directory = resolve(root, 'src/data/media', lane);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (
        !entry.isFile() ||
        !entry.name.endsWith('.json') ||
        lstatSync(resolve(directory, entry.name)).isSymbolicLink()
      )
        throw new Error('INVALID_MEDIA_DESCRIPTOR_FILE');
      const key = `${lane}/${entry.name.slice(0, -5)}`;
      loadMediaAsset(key, root);
      if (!tracked.has(`src/data/media/${key}.json`))
        throw new Error(`UNTRACKED_MEDIA_DESCRIPTOR:${key}`);
    }
  }
  loadMediaAsset('about/about-hero', root);
  console.log(
    'Media verified locally: descriptor identities, budgets, Git tracking, and staging boundary.',
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    verifyMedia();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'MEDIA_VERIFICATION_FAILED',
    );
    process.exitCode = 1;
  }
}
