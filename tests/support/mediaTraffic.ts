/** Local browser qualification never consumes live Blob transfer. */
import type { BrowserContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { loadMediaAsset } from '../../src/features/media/registry.server';
import {
  PUBLIC_MEDIA_HOST,
  type MediaRendition,
} from '../../src/features/media/contract';
const bodies = new Map<string, Buffer>();
export async function installMediaTrafficFixture(
  context: BrowserContext,
): Promise<void> {
  const renditions = new Map<string, MediaRendition>();
  for (const lane of ['about', 'blog', 'works'])
    for (const name of readdirSync(resolve('src/data/media', lane))) {
      if (!name.endsWith('.json')) continue;
      for (const rendition of loadMediaAsset(`${lane}/${name.slice(0, -5)}`)
        .renditions)
        renditions.set(rendition.url, rendition);
    }
  await context.route(
    /https:\/\/[^/]+\.blob\.vercel-storage\.com\//iu,
    async (route) => {
      const url = route.request().url();
      const rendition = renditions.get(url);
      if (!rendition || new URL(url).hostname !== PUBLIC_MEDIA_HOST) {
        await route.abort('blockedbyclient');
        throw new Error('UNEXPECTED_BROWSER_MEDIA_REQUEST');
      }
      let body = bodies.get(url);
      if (!body) {
        try {
          body = await readFile(
            resolve(
              'Untracked/media-migration/renditions',
              new URL(url).pathname.slice(1),
            ),
          );
          if (
            createHash('sha256').update(body).digest('hex') !== rendition.sha256
          )
            throw new Error('INVALID_QA_RENDITION_CACHE');
        } catch (error) {
          if (!(
            error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 'ENOENT'
          ))
            throw error;
          // Clean CI has descriptors but no private source cache. Qualify layout/loading
          // with an explicitly synthetic, dimension-accurate image, never a live fetch.
          body = await sharp({
            create: {
              width: rendition.width,
              height: rendition.height,
              channels: 3,
              background: '#64748b',
            },
          })
            .toFormat(rendition.format)
            .toBuffer();
        }
        bodies.set(url, body);
      }
      await route.fulfill({
        status: 200,
        contentType: `image/${rendition.format}`,
        body,
      });
    },
  );
}
