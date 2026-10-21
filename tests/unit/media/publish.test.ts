import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import {
  prepareMedia,
  publishPreparedMedia,
  type MediaStorage,
  type PublishJournal,
} from '../../../scripts/media/publish';
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
function storage() {
  const objects = new Map<
    string,
    { bytes: Uint8Array; access: 'public' | 'private'; contentType: string }
  >();
  const api: MediaStorage = {
    async inspect(path, access) {
      const v = objects.get(path);
      return v
        ? {
            bytes: v.bytes.length,
            sha256: hash(v.bytes),
            access: v.access,
            contentType: v.contentType,
            cacheControl: 'public, max-age=31536000',
            url:
              access === 'public'
                ? `https://vyge4wbmw8jgd8rh.public.blob.vercel-storage.com/${path}`
                : 'private',
          }
        : null;
    },
    async put(path, bytes, access, contentType) {
      if (objects.has(path)) throw new Error('overwrite');
      objects.set(path, { bytes, access, contentType });
    },
  };
  return { api, objects };
}
describe('publish-time media', () => {
  it('prepares finite budgeted images locally and preserves the original bytes', async () => {
    const bytes = await sharp({
      create: { width: 1920, height: 1080, channels: 3, background: '#234567' },
    })
      .png()
      .toBuffer();
    const p = await prepareMedia('blog/example', bytes);
    expect(p.original.bytes).toEqual(bytes);
    expect(p.descriptor.source.sha256).toBe(hash(bytes));
    expect(p.outputs).toHaveLength(6);
    expect(p.outputs.find((o) => o.role === 'social')).toMatchObject({
      format: 'jpeg',
      width: 1200,
      height: 675,
    });
    for (const o of p.outputs)
      expect(o.bytes.length).toBeLessThanOrEqual(o.maxBytes);
  });
  it('resumes verified uploads after failure and only commits a complete descriptor', async () => {
    const bytes = await sharp({
      create: { width: 1920, height: 1080, channels: 3, background: '#234567' },
    })
      .png()
      .toBuffer();
    const p = await prepareMedia('blog/example', bytes);
    const { api, objects } = storage();
    const journal: PublishJournal = {};
    let descriptor: unknown = 'old';
    const put = api.put;
    let calls = 0;
    api.put = async (...args) => {
      if (++calls === 3) throw new Error('interrupted');
      return put(...args);
    };
    const save = async () => {};
    const commit = async (value: unknown) => {
      descriptor = value;
    };
    await expect(
      publishPreparedMedia(p, api, journal, save, commit),
    ).rejects.toThrow('interrupted');
    expect(descriptor).toBe('old');
    expect(objects.size).toBe(2);
    api.put = put;
    await publishPreparedMedia(p, api, journal, save, commit);
    expect(descriptor).toEqual(p.descriptor);
    expect(objects.size).toBe(7);
    await publishPreparedMedia(p, api, journal, save, commit);
    expect(objects.size).toBe(7);
  });
  it('orients EXIF sources, handles the full-size portrait, and rejects real animation', async () => {
    const rotated = await sharp({
      create: { width: 1080, height: 1920, channels: 3, background: 'blue' },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const result = await prepareMedia('blog/oriented', rotated);
    expect(result.descriptor.source).toMatchObject({
      width: 1920,
      height: 1080,
    });
    const portrait = await sharp({
      create: { width: 3060, height: 4080, channels: 3, background: 'blue' },
    })
      .jpeg()
      .toBuffer();
    const about = await prepareMedia('about/portrait', portrait);
    expect(about.descriptor.source).toMatchObject({
      width: 3060,
      height: 4080,
    });
    expect(about.outputs.map((o) => [o.width, o.height])).toEqual([
      [400, 533],
      [800, 1067],
      [1200, 1600],
    ]);
    const animation = await sharp(
      Buffer.from([
        255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 255, 0, 0,
        255, 0, 0, 255,
      ]),
      { raw: { width: 2, height: 4, channels: 3, pageHeight: 2 } },
    )
      .gif({ delay: [100, 100] })
      .toBuffer();
    await expect(prepareMedia('blog/animated', animation)).rejects.toThrow(
      'ANIMATED_SOURCE_UNSUPPORTED',
    );
  });
  it('rejects a reused public object with a conflicting cache policy', async () => {
    const bytes = await sharp({
      create: { width: 1920, height: 1080, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
    const p = await prepareMedia('blog/example', bytes);
    const { api } = storage();
    const inspect = api.inspect;
    api.inspect = async (...args) => {
      const item = await inspect(...args);
      return item && item.access === 'public'
        ? { ...item, cacheControl: 'public, max-age=60' }
        : item;
    };
    let committed = false;
    await expect(
      publishPreparedMedia(
        p,
        api,
        {},
        async () => {},
        async () => {
          committed = true;
        },
      ),
    ).rejects.toThrow('OBJECT_CONFLICT');
    expect(committed).toBe(false);
  });
  it('rejects unsupported dimensions, animation, oversized input and unexpected objects', async () => {
    const small = await sharp({
      create: { width: 10, height: 10, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    await expect(prepareMedia('blog/example', small)).rejects.toThrow(
      'SOURCE_DIMENSIONS',
    );
    await expect(prepareMedia('blog/../escape', small)).rejects.toThrow(
      'INVALID_MEDIA_KEY',
    );
    await expect(
      prepareMedia('blog/example', Buffer.alloc(20 * 1024 * 1024 + 1)),
    ).rejects.toThrow('SOURCE_TOO_LARGE');
    const bytes = await sharp({
      create: { width: 1920, height: 1080, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
    const p = await prepareMedia('blog/example', bytes);
    const { api, objects } = storage();
    objects.set(p.original.path, {
      bytes: Buffer.from('wrong'),
      access: 'private',
      contentType: 'image/png',
    });
    await expect(
      publishPreparedMedia(
        p,
        api,
        {},
        async () => {},
        async () => {},
      ),
    ).rejects.toThrow('OBJECT_CONFLICT');
  });
});
