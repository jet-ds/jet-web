import { EGREGORE_MODEL, EGREGORE_MODEL_CACHE } from '../config';

export type ModelSource = string | ReadableStream<Uint8Array>;

export type ModelSourceResolution =
  | { kind: 'cached'; source: ReadableStream<Uint8Array> }
  | { kind: 'uncached-url'; source: string; reason: 'cache-unavailable' };

export interface ModelArtifactStore {
  hasCurrent(): Promise<boolean>;
  resolveForLoad(options: {
    allowUncached: boolean;
  }): Promise<ModelSourceResolution>;
  removeCurrent(): Promise<void>;
}

interface ModelArtifactConfig {
  repositoryRevision: string;
  filename: string;
  url: string;
  bytes: number;
  sha256: string;
  maxRedirects: number;
  trustedOrigins: readonly { hostname: string; allowSubdomains: boolean }[];
}

interface ModelArtifactStoreOptions {
  cacheStorage?: CacheStorage;
  fetch?: typeof fetch;
  model?: ModelArtifactConfig;
  schemaVersion?: string;
}

export class ModelArtifactStoreUnavailableError extends Error {
  constructor() {
    super('Egregore cannot persist the local model in this browser.');
    this.name = 'ModelArtifactStoreUnavailableError';
  }
}

function modelCacheName(
  model: ModelArtifactConfig,
  schemaVersion: string,
): string {
  return `egregore-model-${schemaVersion}-${model.sha256}`;
}

function modelCacheKey(model: ModelArtifactConfig): Request {
  return new Request(
    `https://jetsanchez.com/__egregore-model__/${model.repositoryRevision}/${model.filename}`,
  );
}

function responseHasExpectedDelivery(
  response: Response,
  model: ModelArtifactConfig,
): boolean {
  if (!response.ok || response.body === null) return false;
  if (
    response.url !== '' &&
    !isTrustedModelUrl(response.url, model.trustedOrigins)
  ) {
    return false;
  }

  const declaredLength =
    response.headers.get('content-length') ??
    response.headers.get('x-linked-size');
  return declaredLength !== null && Number(declaredLength) === model.bytes;
}

function isTrustedModelUrl(
  value: string,
  trustedOrigins: ModelArtifactConfig['trustedOrigins'],
): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.port === '' &&
      url.username === '' &&
      url.password === '' &&
      trustedOrigins.some(
        ({ hostname, allowSubdomains }) =>
          url.hostname === hostname ||
          (allowSubdomains && url.hostname.endsWith(`.${hostname}`)),
      )
    );
  } catch {
    return false;
  }
}

export function createModelArtifactStore(
  options: ModelArtifactStoreOptions = {},
): ModelArtifactStore {
  const model = options.model ?? EGREGORE_MODEL;
  const schemaVersion =
    options.schemaVersion ?? EGREGORE_MODEL_CACHE.schemaVersion;
  const cacheStorage = options.cacheStorage ?? globalThis.caches;
  const fetchModel = options.fetch ?? globalThis.fetch.bind(globalThis);
  const currentCacheName = modelCacheName(model, schemaVersion);
  const cacheKey = modelCacheKey(model);
  let mustUseUncachedUrl = false;

  const getCache = async (): Promise<Cache> => {
    if (cacheStorage === undefined)
      throw new ModelArtifactStoreUnavailableError();
    try {
      const names = await cacheStorage.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              /^egregore-model-v\d+-/u.test(name) && name !== currentCacheName,
          )
          .map((name) => cacheStorage.delete(name)),
      );
      return await cacheStorage.open(currentCacheName);
    } catch {
      mustUseUncachedUrl = true;
      throw new ModelArtifactStoreUnavailableError();
    }
  };

  return {
    async hasCurrent(): Promise<boolean> {
      const cache = await getCache();
      const response = await cache.match(cacheKey);
      return response?.body !== null && response !== undefined;
    },

    async resolveForLoad({ allowUncached }): Promise<ModelSourceResolution> {
      if (mustUseUncachedUrl) {
        if (allowUncached) {
          return {
            kind: 'uncached-url',
            source: model.url,
            reason: 'cache-unavailable',
          };
        }
        throw new ModelArtifactStoreUnavailableError();
      }

      let cache: Cache;
      try {
        cache = await getCache();
      } catch (cause) {
        if (
          allowUncached &&
          cause instanceof ModelArtifactStoreUnavailableError
        ) {
          return {
            kind: 'uncached-url',
            source: model.url,
            reason: 'cache-unavailable',
          };
        }
        throw cause;
      }

      const cached = await cache.match(cacheKey);
      if (cached?.body !== null && cached !== undefined) {
        return { kind: 'cached', source: cached.body };
      }

      let response: Response;
      try {
        response = await fetchModel(model.url, {
          credentials: 'omit',
          redirect: 'follow',
        });
      } catch {
        throw new Error('Egregore could not transfer the local model.');
      }

      if (!responseHasExpectedDelivery(response, model)) {
        throw new Error('Egregore received an invalid local model delivery.');
      }

      try {
        await cache.put(cacheKey, response);
      } catch {
        mustUseUncachedUrl = true;
        if (allowUncached) {
          return {
            kind: 'uncached-url',
            source: model.url,
            reason: 'cache-unavailable',
          };
        }
        throw new ModelArtifactStoreUnavailableError();
      }

      const committed = await cache.match(cacheKey);
      if (committed?.body === null || committed === undefined) {
        throw new Error('Egregore could not read the downloaded local model.');
      }
      return { kind: 'cached', source: committed.body };
    },

    async removeCurrent(): Promise<void> {
      if (cacheStorage === undefined) return;
      try {
        const cache = await cacheStorage.open(currentCacheName);
        await cache.delete(cacheKey);
      } catch {
        throw new ModelArtifactStoreUnavailableError();
      }
    },
  };
}
