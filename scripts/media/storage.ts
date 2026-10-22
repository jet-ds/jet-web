import { BlobNotFoundError, get, head, put } from '@vercel/blob';
import { sha256, type MediaAccess, type MediaStorage } from './publish';
const publicStore = 'vYgE4WbMW8JGD8rh';
export function createMediaStorage(
  environment: NodeJS.ProcessEnv = process.env,
): MediaStorage {
  const publicToken = environment.BLOB_READ_WRITE_TOKEN;
  const privateToken = environment.BLOB_ORIGINALS_READ_WRITE_TOKEN;
  if (
    !publicToken?.startsWith(`vercel_blob_rw_${publicStore}_`) ||
    !privateToken?.startsWith('vercel_blob_rw_zuQm74IfTNAGny0B_')
  )
    throw new Error('MEDIA_CREDENTIAL_STORE_MISMATCH');
  const token = (access: MediaAccess) =>
    access === 'public' ? publicToken : privateToken;
  return {
    async inspect(path, access, previous) {
      try {
        const metadata = await head(path, { token: token(access) });
        if (metadata.size > 20 * 1024 * 1024)
          throw new Error('REMOTE_OBJECT_TOO_LARGE');
        if (
          previous?.etag &&
          previous.etag === metadata.etag &&
          previous.bytes === metadata.size &&
          previous.contentType === metadata.contentType &&
          previous.cacheControl === metadata.cacheControl &&
          previous.url === metadata.url &&
          previous.access === access
        )
          return previous;
        const response = await get(path, { access, token: token(access) });
        if (!response || response.statusCode !== 200)
          throw new Error('OBJECT_READBACK_FAILED');
        const reader = response.stream.getReader();
        const chunks: Uint8Array[] = [];
        let length = 0;
        try {
          while (true) {
            const item = await reader.read();
            if (item.done) break;
            length += item.value.length;
            if (length > 20 * 1024 * 1024)
              throw new Error('REMOTE_OBJECT_TOO_LARGE');
            chunks.push(item.value);
          }
        } finally {
          await reader.cancel();
        }
        const bytes = Buffer.concat(chunks);
        if (
          bytes.length !== metadata.size ||
          response.blob.size !== metadata.size ||
          response.blob.etag !== metadata.etag ||
          response.blob.contentType !== metadata.contentType ||
          response.blob.cacheControl !== metadata.cacheControl
        )
          throw new Error('OBJECT_CHANGED_DURING_READ');
        return {
          bytes: bytes.length,
          sha256: sha256(bytes),
          access,
          contentType: metadata.contentType,
          url: metadata.url,
          cacheControl: metadata.cacheControl,
          etag: metadata.etag,
        };
      } catch (error) {
        if (error instanceof BlobNotFoundError) return null;
        throw new Error('MEDIA_OBJECT_VERIFICATION_FAILED');
      }
    },
    async put(path, bytes, access, contentType) {
      try {
        await put(path, Buffer.from(bytes), {
          token: token(access),
          access,
          contentType,
          addRandomSuffix: false,
          allowOverwrite: false,
          cacheControlMaxAge: 31536000,
        });
      } catch {
        throw new Error('MEDIA_UPLOAD_FAILED');
      }
    },
  };
}
