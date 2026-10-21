// @vitest-environment node
import { it, expect } from 'vitest';
import { verifyLegacySource } from '../../../scripts/media/migrate';
import { sha256 } from '../../../scripts/media/publish';
it('verifies both the original filename hash and persisted full cache identity', () => {
  const bytes = Buffer.from('legacy source');
  const digest = sha256(bytes);
  const name = `blog/example-${digest.slice(0, 8)}.png`;
  expect(verifyLegacySource(name, bytes.length, bytes, digest)).toBe(digest);
  expect(() =>
    verifyLegacySource(name, bytes.length, Buffer.from('tamper source')),
  ).toThrow('INVALID_LEGACY_CACHE');
  expect(() =>
    verifyLegacySource(name, bytes.length, bytes, 'f'.repeat(64)),
  ).toThrow('INVALID_LEGACY_CACHE');
});
