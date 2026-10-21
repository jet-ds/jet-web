// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { it, expect } from 'vitest';
import { writeMediaFixture } from '../../fixtures/media';
import {
  loadMediaAsset,
  resolveContentImage,
} from '../../../src/features/media/registry.server';
import { verifyMedia } from '../../../scripts/media/verify';
it('validates local identity/lane and rejects untracked descriptors or public staging', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'jet-media-registry-'));
  try {
    for (const lane of ['about', 'blog', 'works'])
      mkdirSync(resolve(root, 'public/images-staging', lane), {
        recursive: true,
      });
    for (const key of ['about/about-hero', 'blog/example', 'works/example'])
      writeMediaFixture(root, key);
    spawnSync('git', ['init', '--quiet'], { cwd: root });
    expect(() => loadMediaAsset('blog/../escape', root)).toThrow(
      'INVALID_MEDIA_KEY',
    );
    expect(() =>
      resolveContentImage(
        { asset: 'works/example', alt: 'Wrong lane' },
        'blog',
        root,
      ),
    ).toThrow('WRONG_MEDIA_LANE');
    expect(() => verifyMedia(root)).toThrow('UNTRACKED_MEDIA_DESCRIPTOR');
    spawnSync('git', ['add', 'src/data/media'], { cwd: root });
    expect(() => verifyMedia(root)).not.toThrow();
    const dto = resolveContentImage(
      { asset: 'blog/example', alt: 'A scene' },
      'blog',
      root,
    );
    expect(dto.social).toMatchObject({ width: 1200, height: 675 });
    expect(JSON.stringify(dto)).not.toMatch(/originals|private|sha256|source/);
    writeFileSync(
      resolve(root, 'public/images-staging/about/secret.jpg'),
      'private original',
    );
    expect(() => verifyMedia(root)).toThrow('PUBLIC_MEDIA_STAGING_FORBIDDEN');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
