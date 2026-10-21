import { describe, expect, it } from 'vitest';
import {
  parseMediaDescriptor,
  renditionSpecs,
  resolveMediaPresentation,
  type MediaDescriptor,
} from '../../../src/features/media/contract';

const hash = 'a'.repeat(64);
function descriptor(): MediaDescriptor {
  return {
    schemaVersion: 1,
    pipelineVersion: 'v1',
    source: { sha256: hash, width: 1920, height: 1080, format: 'png' },
    renditions: renditionSpecs('blog').map((r) => ({
      role: r.role,
      width: r.width,
      height: r.height,
      format: r.format,
      bytes: 1000,
      sha256: hash,
      url: `https://vyge4wbmw8jgd8rh.public.blob.vercel-storage.com/images/v1/blog/example/${hash}/${r.role}-${hash}.${r.format === 'jpeg' ? 'jpg' : 'webp'}`,
    })),
  };
}
describe('published media contract', () => {
  it('resolves actual responsive and social dimensions without exposing source data', () => {
    const parsed = parseMediaDescriptor('blog/example', descriptor());
    const detail = resolveMediaPresentation(parsed, 'detail');
    const social = resolveMediaPresentation(parsed, 'social');
    expect(detail).toMatchObject({ width: 1920, height: 1080 });
    expect(detail.srcSet).toContain('480w');
    expect(social).toMatchObject({ width: 1200, height: 675 });
    expect(JSON.stringify(detail)).not.toContain('source');
  });
  it('fails closed on incomplete, oversized, unsafe, or misidentified renditions', () => {
    const base = descriptor();
    expect(() =>
      parseMediaDescriptor('blog/example', {
        ...base,
        renditions: base.renditions.slice(1),
      }),
    ).toThrow();
    expect(() => parseMediaDescriptor('works/example', base)).toThrow();
    for (const bad of [
      { bytes: 99999999 },
      { width: 1 },
      { url: 'https://evil.test/image.webp' },
      { url: base.renditions[0].url + '?token=secret' },
      { sha256: 'b'.repeat(64) },
    ]) {
      expect(() =>
        parseMediaDescriptor('blog/example', {
          ...base,
          renditions: [
            { ...base.renditions[0], ...bad },
            ...base.renditions.slice(1),
          ],
        }),
      ).toThrow();
    }
    expect(() => parseMediaDescriptor('blog/../example', base)).toThrow();
    expect(() =>
      parseMediaDescriptor('blog/example', { ...base, privateUrl: 'secret' }),
    ).toThrow();
  });
});
