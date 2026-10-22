// @vitest-environment node
import {
  mkdtemp,
  mkdir,
  writeFile,
  symlink,
  rm,
  readFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { it, expect } from 'vitest';
import { readStagedImage, atomicJson } from '../../../scripts/media/files';
it('rejects unsafe source paths and escaping symlinks without reading an outside source', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'jet-media-files-'));
  try {
    await mkdir(resolve(root, 'Untracked/media-staging/blog'), {
      recursive: true,
    });
    await writeFile(resolve(root, 'outside.png'), 'private');
    await symlink(
      resolve(root, 'outside.png'),
      resolve(root, 'Untracked/media-staging/blog/example.png'),
    );
    await expect(readStagedImage('../outside.png', root)).rejects.toThrow(
      'INVALID_STAGING_PATH',
    );
    await expect(readStagedImage('blog/example.png', root)).rejects.toThrow(
      'INVALID_STAGED_SOURCE',
    );
    await atomicJson(resolve(root, 'descriptor.json'), { previous: true });
    await atomicJson(resolve(root, 'descriptor.json'), { complete: true });
    expect(
      JSON.parse(await readFile(resolve(root, 'descriptor.json'), 'utf8')),
    ).toEqual({ complete: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
