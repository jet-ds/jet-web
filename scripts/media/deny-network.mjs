/** Build-purity probe: record and reject any Blob request, including optimizer reads. */
import http from 'node:http';
import https from 'node:https';
import { createRequire } from 'node:module';
import { syncBuiltinESMExports } from 'node:module';
import { appendFileSync } from 'node:fs';
function check(input) {
  const value =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input?.url ?? input?.hostname ?? input?.host ?? '');
  if (
    /(?:^|\.)blob\.vercel-storage\.com(?:[/:]|$)/u.test(value) ||
    value.includes('.blob.vercel-storage.com')
  ) {
    if (process.env.JET_MEDIA_NETWORK_LOG)
      appendFileSync(
        process.env.JET_MEDIA_NETWORK_LOG,
        'Blocked Blob request\n',
      );
    throw new Error('BUILD_MEDIA_NETWORK_FORBIDDEN');
  }
}
const fetchOriginal = globalThis.fetch;
globalThis.fetch = function (input, ...rest) {
  check(input);
  return fetchOriginal.call(this, input, ...rest);
};
for (const module of [http, https])
  for (const name of ['get', 'request']) {
    const original = module[name];
    module[name] = function (...args) {
      check(args[0]);
      return original.apply(this, args);
    };
  }
syncBuiltinESMExports();

// The Blob SDK uses Undici directly rather than global fetch or node:https.
const require = createRequire(import.meta.url);
const sdkRequire = createRequire(require.resolve('@vercel/blob'));
const { Dispatcher, getGlobalDispatcher, setGlobalDispatcher } =
  sdkRequire('undici');
const dispatcher = getGlobalDispatcher();
class MediaProbeDispatcher extends Dispatcher {
  dispatch(options, handler) {
    check(String(options.origin));
    return dispatcher.dispatch(options, handler);
  }
  close(...args) {
    return dispatcher.close(...args);
  }
  destroy(...args) {
    return dispatcher.destroy(...args);
  }
}
setGlobalDispatcher(new MediaProbeDispatcher());
