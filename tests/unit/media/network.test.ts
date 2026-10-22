// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { it, expect } from 'vitest';
it.each(['globalThis.fetch', "(await import('undici')).fetch"])(
  'blocks %s before a Blob connection can occur',
  (api) => {
    const directory = mkdtempSync(resolve(tmpdir(), 'jet-media-probe-'));
    const log = resolve(directory, 'requests');
    try {
      const result = spawnSync(
        process.execPath,
        [
          '--import',
          resolve('scripts/media/deny-network.mjs'),
          '--input-type=module',
          '-e',
          `await ${api}('https://blocked.public.blob.vercel-storage.com/image.webp')`,
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          env: { ...process.env, JET_MEDIA_NETWORK_LOG: log },
        },
      );
      expect(result.status).not.toBe(0);
      expect(readFileSync(log, 'utf8')).toContain('Blocked Blob request');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
