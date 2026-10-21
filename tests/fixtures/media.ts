import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { afterAll } from 'vitest';
import { createContentSchemas } from '../../src/schemas/content';
import {
  PIPELINE_VERSION,
  PUBLIC_MEDIA_HOST,
  renditionPath,
  renditionSpecs,
  type MediaDescriptor,
  type MediaLane,
} from '../../src/features/media/contract';
export function mediaDescriptor(key: string): MediaDescriptor {
  const lane = key.split('/')[0] as MediaLane;
  const sourceHash = 'a'.repeat(64);
  return {
    schemaVersion: 1,
    pipelineVersion: PIPELINE_VERSION,
    source: {
      sha256: sourceHash,
      width: lane === 'about' ? 1200 : 1920,
      height: lane === 'about' ? 1600 : 1080,
      format: 'png',
    },
    renditions: renditionSpecs(lane).map((s, i) => {
      const hash = (i + 1).toString().repeat(64);
      return {
        role: s.role,
        url: `https://${PUBLIC_MEDIA_HOST}/${renditionPath(key, sourceHash, s.role, hash, s.format)}`,
        width: s.width,
        height: s.height,
        format: s.format,
        bytes: 1000,
        sha256: hash,
      };
    }),
  };
}
export function writeMediaFixture(root: string, key: string): void {
  const path = resolve(root, 'src/data/media', `${key}.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(mediaDescriptor(key)));
}
export function fixtureContentSchemas() {
  const root = mkdtempSync(resolve(tmpdir(), 'jet-media-schema-'));
  for (const key of ['blog/example', 'works/example', 'works/example-dark'])
    writeMediaFixture(root, key);
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  return { ...createContentSchemas(root), root };
}
