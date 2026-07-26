import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import {
  ModelArtifactStoreUnavailableError,
  createModelArtifactStore,
} from '../../../src/features/egregore/runtime/modelArtifactStore';

interface ModelFixture {
  packageVersion: string;
  repositoryRevision: string;
  filename: string;
  url: string;
  bytes: number;
  sha256: string;
  maxRedirects: number;
  trustedOrigins: readonly { hostname: string; allowSubdomains: boolean }[];
}

class MemoryCache {
  readonly puts: Array<{ request: Request; response: Response }> = [];
  private readonly responses = new Map<string, Response>();

  async match(request: Request): Promise<Response | undefined> {
    return this.responses.get(request.url)?.clone();
  }

  async put(request: Request, response: Response): Promise<void> {
    this.puts.push({ request, response });
    this.responses.set(request.url, response.clone());
  }

  async delete(request: Request): Promise<boolean> {
    return this.responses.delete(request.url);
  }
}

class MemoryCacheStorage {
  readonly caches = new Map<string, MemoryCache>();
  readonly deleted: string[] = [];

  async open(name: string): Promise<MemoryCache> {
    const existing = this.caches.get(name);
    if (existing !== undefined) return existing;
    const created = new MemoryCache();
    this.caches.set(name, created);
    return created;
  }

  async keys(): Promise<string[]> {
    return [...this.caches.keys()];
  }

  async delete(name: string): Promise<boolean> {
    this.deleted.push(name);
    return this.caches.delete(name);
  }
}

function modelFixture(body = 'pinned model'): ModelFixture {
  return {
    packageVersion: '0.14.0',
    repositoryRevision: 'fixture-revision',
    filename: 'fixture.litertlm',
    url: 'https://models.example/fixture.litertlm',
    bytes: new TextEncoder().encode(body).byteLength,
    sha256: createHash('sha256').update(body).digest('hex'),
    maxRedirects: 5,
    trustedOrigins: [{ hostname: 'models.example', allowSubdomains: false }],
  };
}

function cacheName(model: ModelFixture, schemaVersion = 'v1'): string {
  return `egregore-model-${schemaVersion}-${model.sha256}`;
}

function cacheKey(model: ModelFixture): Request {
  return new Request(
    `https://jetsanchez.com/__egregore-model__/${model.repositoryRevision}/${model.filename}`,
  );
}

function modelResponse(model: ModelFixture, body = 'pinned model'): Response {
  const response = new Response(body, {
    status: 200,
    headers: { 'content-length': String(model.bytes) },
  });
  Object.defineProperty(response, 'url', {
    value: model.url,
  });
  return response;
}

function makeStore(
  cacheStorage: MemoryCacheStorage | undefined,
  model = modelFixture(),
  options: {
    fetch?: typeof fetch;
    schemaVersion?: string;
  } = {},
) {
  return createModelArtifactStore({
    cacheStorage: cacheStorage as CacheStorage | undefined,
    fetch:
      options.fetch ??
      (vi.fn(async () => modelResponse(model)) as unknown as typeof fetch),
    model,
    schemaVersion: options.schemaVersion,
  });
}

describe('Egregore model artifact store', () => {
  it('returns the committed cache stream without transferring the model again', async () => {
    const model = modelFixture();
    const cacheStorage = new MemoryCacheStorage();
    const cache = await cacheStorage.open(cacheName(model));
    await cache.put(cacheKey(model), modelResponse(model));
    const fetchModel = vi.fn<typeof fetch>();
    const store = makeStore(cacheStorage, model, { fetch: fetchModel });

    const resolution = await store.resolveForLoad({ allowUncached: false });

    expect(resolution.kind).toBe('cached');
    if (resolution.kind !== 'cached')
      throw new Error('Expected cached source.');
    await expect(new Response(resolution.source).text()).resolves.toBe(
      'pinned model',
    );
    expect(fetchModel).not.toHaveBeenCalled();
  });

  it('validates and commits one transferred response before returning its cache stream', async () => {
    const model = modelFixture();
    const cacheStorage = new MemoryCacheStorage();
    const fetchModel = vi.fn(async () => modelResponse(model));
    const store = makeStore(cacheStorage, model, { fetch: fetchModel });

    expect(fetchModel).not.toHaveBeenCalled();
    const resolution = await store.resolveForLoad({ allowUncached: false });

    const cache = await cacheStorage.open(cacheName(model));
    expect(fetchModel).toHaveBeenCalledOnce();
    expect(fetchModel).toHaveBeenCalledWith(model.url, {
      credentials: 'omit',
      redirect: 'follow',
    });
    expect(cache.puts).toHaveLength(1);
    expect(cache.puts[0]?.request.url).toBe(cacheKey(model).url);
    expect(resolution.kind).toBe('cached');
    if (resolution.kind !== 'cached')
      throw new Error('Expected cached source.');
    await expect(new Response(resolution.source).text()).resolves.toBe(
      'pinned model',
    );
  });

  it('keeps the cache identity independent of the application version', async () => {
    const model = modelFixture();
    const cacheStorage = new MemoryCacheStorage();
    const cache = await cacheStorage.open(cacheName(model));
    await cache.put(cacheKey(model), modelResponse(model));
    const fetchModel = vi.fn<typeof fetch>();

    const store = makeStore(cacheStorage, model, { fetch: fetchModel });
    await expect(store.hasCurrent()).resolves.toBe(true);

    expect(await cacheStorage.keys()).toEqual([cacheName(model)]);
    expect(fetchModel).not.toHaveBeenCalled();
  });

  it('changes identity for a model revision and removes only obsolete Egregore cache namespaces', async () => {
    const oldModel = modelFixture('old model');
    const nextModel = modelFixture('next model');
    const cacheStorage = new MemoryCacheStorage();
    await cacheStorage.open(cacheName(oldModel));
    await cacheStorage.open('egregore-model-v0-stale');
    await cacheStorage.open('unrelated-cache');
    const store = makeStore(cacheStorage, nextModel);

    await store.resolveForLoad({ allowUncached: false });

    expect(await cacheStorage.keys()).toEqual([
      'unrelated-cache',
      cacheName(nextModel),
    ]);
    expect(cacheStorage.deleted).toEqual([
      cacheName(oldModel),
      'egregore-model-v0-stale',
    ]);
  });

  it('changes identity when the cache schema changes without touching unrelated caches', async () => {
    const model = modelFixture();
    const cacheStorage = new MemoryCacheStorage();
    await cacheStorage.open(cacheName(model, 'v1'));
    await cacheStorage.open('unrelated-cache');
    const store = makeStore(cacheStorage, model, { schemaVersion: 'v2' });

    await store.resolveForLoad({ allowUncached: false });

    expect(await cacheStorage.keys()).toEqual([
      'unrelated-cache',
      cacheName(model, 'v2'),
    ]);
  });

  it.each([
    ['an interrupted transfer', () => Promise.reject(new Error('interrupted'))],
    [
      'an invalid delivery response',
      (model: ModelFixture) =>
        Promise.resolve(
          new Response('short', {
            status: 200,
            headers: { 'content-length': String(model.bytes - 1) },
          }),
        ),
    ],
  ])('leaves no current entry after %s', async (_label, response) => {
    const model = modelFixture();
    const cacheStorage = new MemoryCacheStorage();
    const fetchModel = vi.fn(() => response(model));
    const store = makeStore(cacheStorage, model, { fetch: fetchModel });

    await expect(
      store.resolveForLoad({ allowUncached: false }),
    ).rejects.toThrow();
    await expect(store.hasCurrent()).resolves.toBe(false);
    expect((await cacheStorage.open(cacheName(model))).puts).toHaveLength(0);
  });

  it('requires a later visitor-authorized retry before using an uncached URL', async () => {
    const model = modelFixture();
    const store = makeStore(undefined, model);

    await expect(
      store.resolveForLoad({ allowUncached: false }),
    ).rejects.toBeInstanceOf(ModelArtifactStoreUnavailableError);
    await expect(
      store.resolveForLoad({ allowUncached: true }),
    ).resolves.toEqual({
      kind: 'uncached-url',
      source: model.url,
      reason: 'cache-unavailable',
    });
  });

  it('requires the same visitor-authorized uncached retry after a cache write failure', async () => {
    const model = modelFixture();
    const cacheStorage = new MemoryCacheStorage();
    const cache = await cacheStorage.open(cacheName(model));
    cache.put = vi.fn(async () => {
      throw new DOMException('Quota exceeded.', 'QuotaExceededError');
    });
    const fetchModel = vi.fn(async () => modelResponse(model));
    const store = makeStore(cacheStorage, model, { fetch: fetchModel });

    await expect(
      store.resolveForLoad({ allowUncached: false }),
    ).rejects.toBeInstanceOf(ModelArtifactStoreUnavailableError);
    await expect(
      store.resolveForLoad({ allowUncached: true }),
    ).resolves.toEqual({
      kind: 'uncached-url',
      source: model.url,
      reason: 'cache-unavailable',
    });
    expect(fetchModel).toHaveBeenCalledOnce();
  });

  it('removes the downloaded model only when explicitly requested', async () => {
    const model = modelFixture();
    const cacheStorage = new MemoryCacheStorage();
    const cache = await cacheStorage.open(cacheName(model));
    await cache.put(cacheKey(model), modelResponse(model));
    const store = makeStore(cacheStorage, model);

    await expect(store.hasCurrent()).resolves.toBe(true);
    await store.removeCurrent();

    await expect(store.hasCurrent()).resolves.toBe(false);
  });
});
