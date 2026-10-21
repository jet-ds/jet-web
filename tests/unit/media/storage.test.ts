// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
const sdk = vi.hoisted(() => ({ head: vi.fn(), get: vi.fn(), put: vi.fn() }));
vi.mock('@vercel/blob', () => ({
  ...sdk,
  BlobNotFoundError: class extends Error {},
}));
import { createMediaStorage } from '../../../scripts/media/storage';
import { sha256 } from '../../../scripts/media/publish';
const publicToken = 'vercel_blob_rw_vYgE4WbMW8JGD8rh_fake';
const privateToken = 'vercel_blob_rw_zuQm74IfTNAGny0B_fake';
const environment = {
  BLOB_READ_WRITE_TOKEN: publicToken,
  BLOB_ORIGINALS_READ_WRITE_TOKEN: privateToken,
};
const bytes = Buffer.from('bounded object');
const metadata = {
  size: bytes.length,
  contentType: 'image/webp',
  url: 'https://public.example/image.webp',
  etag: 'verified-etag',
  cacheControl: 'public, max-age=31536000',
};
beforeEach(() => vi.resetAllMocks());
describe('media storage boundary', () => {
  it('rejects swapped/missing store credentials before making requests', () => {
    expect(() =>
      createMediaStorage({
        BLOB_READ_WRITE_TOKEN: privateToken,
        BLOB_ORIGINALS_READ_WRITE_TOKEN: publicToken,
      }),
    ).toThrow('MEDIA_CREDENTIAL_STORE_MISMATCH');
    expect(() => createMediaStorage({})).toThrow(
      'MEDIA_CREDENTIAL_STORE_MISMATCH',
    );
    expect(sdk.head).not.toHaveBeenCalled();
  });
  it('reads bytes once, validates metadata, then reuses an unchanged ETag receipt', async () => {
    sdk.head.mockResolvedValue(metadata);
    sdk.get.mockImplementation(async () => ({
      statusCode: 200,
      blob: metadata,
      stream: new ReadableStream({
        start(c) {
          c.enqueue(bytes);
          c.close();
        },
      }),
    }));
    const storage = createMediaStorage(environment);
    const receipt = await storage.inspect('images/test.webp', 'public');
    expect(receipt).toMatchObject({
      sha256: sha256(bytes),
      bytes: bytes.length,
    });
    expect(sdk.head).toHaveBeenCalledWith('images/test.webp', {
      token: publicToken,
    });
    await storage.inspect('images/test.webp', 'public', receipt ?? undefined);
    expect(sdk.get).toHaveBeenCalledTimes(1);
    await storage.put('originals/test.webp', bytes, 'private', 'image/webp');
    expect(sdk.put).toHaveBeenCalledWith(
      'originals/test.webp',
      bytes,
      expect.objectContaining({
        token: privateToken,
        access: 'private',
        allowOverwrite: false,
        addRandomSuffix: false,
        cacheControlMaxAge: 31536000,
      }),
    );
  });
  it('rejects truncated readback instead of accepting its hash as verified', async () => {
    sdk.head.mockResolvedValue({ ...metadata, size: bytes.length + 1 });
    sdk.get.mockResolvedValue({
      statusCode: 200,
      blob: { ...metadata, size: bytes.length + 1 },
      stream: new ReadableStream({
        start(c) {
          c.enqueue(bytes);
          c.close();
        },
      }),
    });
    await expect(
      createMediaStorage(environment).inspect('images/test.webp', 'public'),
    ).rejects.toThrow('MEDIA_OBJECT_VERIFICATION_FAILED');
  });
});
