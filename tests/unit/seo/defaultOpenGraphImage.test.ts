import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { replaceValidatedCapture } from '../../../scripts/capture-og-image';
import { SITE } from '../../../src/config/site';
import { generateSEOProps } from '../../../src/utils/seo';

const expected = {
  path: '/images/og-default.jpg',
  url: 'https://jetsanchez.com/images/og-default.jpg',
  width: 1920,
  height: 1080,
  alt: "Jet Sanchez's homepage hero with a blue and mustard Grainient background",
  maxBytes: 2_000_000,
} as const;

function jpegDimensions(bytes: Buffer): { width: number; height: number } {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('NOT_A_JPEG');
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error('INVALID_JPEG_MARKER');
    const marker = bytes[offset + 1];
    offset += 2;
    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      (marker >= 0xd0 && marker <= 0xd7)
    )
      continue;
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      throw new Error('INVALID_JPEG_SEGMENT');
    }
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return {
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }
  throw new Error('JPEG_DIMENSIONS_NOT_FOUND');
}

describe('default OpenGraph image', () => {
  it('defines one shared exact image contract and applies it to default SEO props', () => {
    const configured = (
      SITE as typeof SITE & { defaultOpenGraphImage?: unknown }
    ).defaultOpenGraphImage;
    expect(configured).toEqual(expected);
    expect(generateSEOProps({})).toMatchObject({
      image: expected.url,
      imageAlt: expected.alt,
      imageWidth: expected.width,
      imageHeight: expected.height,
    });
  });

  it('does not attach false default dimensions or alt text to custom images', () => {
    const custom = generateSEOProps({
      image: 'https://example.com/custom.jpg',
    }) as ReturnType<typeof generateSEOProps> & {
      imageHeight?: number;
      imageWidth?: number;
    };
    expect(custom.imageAlt).toBeUndefined();
    expect(custom.imageWidth).toBeUndefined();
    expect(custom.imageHeight).toBeUndefined();
  });

  it('commits a valid 1920x1080 JPEG below the size ceiling', () => {
    const assetPath = `public${expected.path}`;
    const present = existsSync(assetPath);
    expect(present).toBe(true);
    if (!present) return;

    const bytes = readFileSync(assetPath);
    expect(bytes.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(jpegDimensions(bytes)).toEqual({
      width: expected.width,
      height: expected.height,
    });
    expect(statSync(assetPath).size).toBeLessThanOrEqual(expected.maxBytes);
  });

  it('preserves the approved destination and removes temporary residue when validation fails', () => {
    const root = mkdtempSync(join(tmpdir(), 'jet-web-og-replacement-'));
    try {
      const outputPath = join(root, 'og-default.jpg');
      const temporaryPath = join(root, '.og-default.jpg.invalid.tmp');
      const approved = Buffer.from('approved destination bytes\n');
      writeFileSync(outputPath, approved);
      writeFileSync(temporaryPath, Buffer.from('not a jpeg\n'));

      expect(() => replaceValidatedCapture(temporaryPath, outputPath)).toThrow(
        'OUTPUT_NOT_JPEG',
      );
      expect(readFileSync(outputPath)).toEqual(approved);
      expect(existsSync(temporaryPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('atomically installs a fully validated temporary capture', () => {
    const root = mkdtempSync(join(tmpdir(), 'jet-web-og-replacement-'));
    try {
      const outputPath = join(root, 'og-default.jpg');
      const temporaryPath = join(root, '.og-default.jpg.valid.tmp');
      const approved = Buffer.from('previous approved destination\n');
      const replacement = readFileSync(`public${expected.path}`);
      writeFileSync(outputPath, approved);
      writeFileSync(temporaryPath, replacement);

      replaceValidatedCapture(temporaryPath, outputPath);

      expect(readFileSync(outputPath)).toEqual(replacement);
      expect(existsSync(temporaryPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
