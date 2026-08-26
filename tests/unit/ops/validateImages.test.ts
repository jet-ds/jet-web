import sharp from 'sharp';
import { beforeAll, describe, expect, it, vi } from 'vitest';

interface ValidateImagesModule {
  decodeImageMetadata(
    bytes: Uint8Array,
  ): Promise<{ format: string; width: number; height: number }>;
  validateRemoteImage(
    reference: {
      url: string;
      contentType: 'blog' | 'works';
      contentId: string;
      field: 'image.url' | 'image.darkUrl';
      width: number;
      height: number;
    },
    options: {
      fetch: typeof fetch;
      maxBytes?: number;
    },
  ): Promise<{ ok: boolean; error?: string }>;
}

let validateImages: ValidateImagesModule;

beforeAll(async () => {
  const fetchSpy = vi.fn(async () =>
    Promise.resolve(
      new Response('not used', {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    ),
  );
  vi.stubGlobal('fetch', fetchSpy);

  validateImages =
    (await import('../../../scripts/validate-images')) as unknown as ValidateImagesModule;

  expect(fetchSpy).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

async function fixture(
  format: 'jpeg' | 'png' | 'webp' | 'avif' | 'gif',
): Promise<Buffer> {
  const image = sharp({
    create: {
      width: 4,
      height: 3,
      channels: 4,
      background: { r: 20, g: 40, b: 60, alpha: 1 },
    },
  });

  return image.toFormat(format).toBuffer();
}

function reference(width = 4, height = 3) {
  return {
    url: 'https://assets.public.blob.vercel-storage.com/images/blog/invented-a1b2c3d4.webp',
    contentType: 'blog' as const,
    contentId: 'invented',
    field: 'image.url' as const,
    width,
    height,
  };
}

function imageResponse(bytes: Uint8Array, contentType = 'image/webp') {
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-length': String(bytes.byteLength),
    },
  });
}

function headerlessImageResponse(
  bytes: Uint8Array,
  contentType = 'image/webp',
) {
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return new Response(body, {
    status: 200,
    headers: { 'content-type': contentType },
  });
}

function trackedResponse(options: {
  bytes?: Uint8Array;
  contentType?: string;
  contentLength?: number;
  status?: number;
  statusText?: string;
}) {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (options.bytes) controller.enqueue(options.bytes);
    },
    cancel() {
      cancelled = true;
    },
  });
  const headers = new Headers();
  if (options.contentType) headers.set('content-type', options.contentType);
  if (options.contentLength !== undefined) {
    headers.set('content-length', String(options.contentLength));
  }

  return {
    response: new Response(stream, {
      status: options.status ?? 200,
      statusText: options.statusText,
      headers,
    }),
    wasCancelled: () => cancelled,
  };
}

describe('remote image validation', () => {
  it.each(['jpeg', 'png', 'webp', 'avif', 'gif'] as const)(
    'decodes deterministic %s metadata through the supported decoder',
    async (format) => {
      const metadata = await validateImages.decodeImageMetadata(
        await fixture(format),
      );

      expect(metadata).toEqual({ format, width: 4, height: 3 });
    },
  );

  it('rejects bytes that are not a supported image', async () => {
    await expect(
      validateImages.decodeImageMetadata(Buffer.from('not an image')),
    ).rejects.toThrow(/supported image|decode/iu);
  });

  it.each([
    {
      name: 'empty payload',
      response: new Response(null, {
        headers: {
          'content-type': 'image/png',
          'content-length': '0',
        },
      }),
      error: /empty|payload/iu,
    },
    {
      name: 'oversized payload',
      response: new Response('payload', {
        headers: {
          'content-type': 'image/png',
          'content-length': '100',
        },
      }),
      error: /exceeds|large/iu,
    },
  ])('rejects a $name before decoding', async ({ response, error }) => {
    const fetchImage = vi.fn(async () => response) as unknown as typeof fetch;

    const result = await validateImages.validateRemoteImage(reference(), {
      fetch: fetchImage,
      maxBytes: 32,
    });

    expect(result).toEqual({ ok: false, error: expect.stringMatching(error) });
  });

  it('accepts a bounded headerless image response', async () => {
    const bytes = await fixture('webp');
    const fetchImage = vi.fn(async () =>
      headerlessImageResponse(bytes),
    ) as unknown as typeof fetch;

    await expect(
      validateImages.validateRemoteImage(reference(), {
        fetch: fetchImage,
        maxBytes: bytes.byteLength,
      }),
    ).resolves.toEqual({ ok: true });
  });

  it('rejects and cancels a headerless stream that exceeds the byte limit', async () => {
    const bytes = await fixture('png');
    const tracked = trackedResponse({ bytes, contentType: 'image/png' });
    const fetchImage = vi.fn(
      async () => tracked.response,
    ) as unknown as typeof fetch;

    const result = await validateImages.validateRemoteImage(reference(), {
      fetch: fetchImage,
      maxBytes: bytes.byteLength - 1,
    });

    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/exceeds|large|limit/iu),
    });
    expect(tracked.wasCancelled()).toBe(true);
  });

  it('rejects an empty headerless image response', async () => {
    const response = new Response(null, {
      headers: { 'content-type': 'image/png' },
    });
    const fetchImage = vi.fn(async () => response) as unknown as typeof fetch;

    await expect(
      validateImages.validateRemoteImage(reference(), { fetch: fetchImage }),
    ).resolves.toEqual({
      ok: false,
      error: expect.stringMatching(/empty|missing|payload/iu),
    });
  });

  it.each([
    {
      name: 'HTTP error',
      makeResponse: () =>
        trackedResponse({
          status: 503,
          statusText: 'Unavailable',
          contentType: 'image/png',
        }),
      error: /HTTP 503/iu,
    },
    {
      name: 'invalid content type',
      makeResponse: () => trackedResponse({ contentType: 'text/plain' }),
      error: /content-type/iu,
    },
    {
      name: 'declared oversized payload',
      makeResponse: () =>
        trackedResponse({
          contentType: 'image/png',
          contentLength: 100,
        }),
      error: /exceeds|large|limit/iu,
    },
  ])(
    'cancels the response body after an early $name exit',
    async ({ makeResponse, error }) => {
      const tracked = makeResponse();
      const fetchImage = vi.fn(
        async () => tracked.response,
      ) as unknown as typeof fetch;

      const result = await validateImages.validateRemoteImage(reference(), {
        fetch: fetchImage,
        maxBytes: 32,
      });

      expect(result).toEqual({
        ok: false,
        error: expect.stringMatching(error),
      });
      expect(tracked.wasCancelled()).toBe(true);
    },
  );

  it('rejects a stream that exceeds its declared bounded payload', async () => {
    const bytes = await fixture('png');
    const response = imageResponse(bytes, 'image/png');
    response.headers.set('content-length', '1');
    const fetchImage = vi.fn(async () => response) as unknown as typeof fetch;

    const result = await validateImages.validateRemoteImage(reference(), {
      fetch: fetchImage,
      maxBytes: bytes.byteLength + 1,
    });

    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/declared|payload|length/iu),
    });
  });

  it('reports network failures without throwing', async () => {
    const fetchImage = vi.fn(async () => {
      throw new Error('invented network failure');
    }) as unknown as typeof fetch;

    await expect(
      validateImages.validateRemoteImage(reference(), { fetch: fetchImage }),
    ).resolves.toEqual({ ok: false, error: 'invented network failure' });
  });

  it('compares decoded intrinsic dimensions with the declared dimensions', async () => {
    const bytes = await fixture('webp');
    const fetchImage = vi.fn(async () =>
      imageResponse(bytes),
    ) as unknown as typeof fetch;

    await expect(
      validateImages.validateRemoteImage(reference(1920, 1080), {
        fetch: fetchImage,
      }),
    ).resolves.toEqual({
      ok: false,
      error: expect.stringMatching(/4x3.*1920x1080/iu),
    });
  });

  it('accepts a bounded supported image whose intrinsic dimensions match', async () => {
    const bytes = await fixture('webp');
    const fetchImage = vi.fn(async () =>
      imageResponse(bytes),
    ) as unknown as typeof fetch;

    await expect(
      validateImages.validateRemoteImage(reference(), { fetch: fetchImage }),
    ).resolves.toEqual({ ok: true });
  });
});
