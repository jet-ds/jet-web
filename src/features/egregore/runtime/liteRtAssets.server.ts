import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const packageJsonPath = require.resolve('@litert-lm/core/package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
  version?: string;
};

if (packageJson.version !== '0.14.0') {
  throw new Error('LITERT_PACKAGE_VERSION_MISMATCH');
}

const packageWasmDirectory = join(dirname(packageJsonPath), 'wasm');

export const LITERT_LM_WASM_ASSETS = [
  'litertlm_wasm_internal.js',
  'litertlm_wasm_internal.wasm',
  'litertlm_wasm_asyncify_internal.js',
  'litertlm_wasm_asyncify_internal.wasm',
  'litertlm_wasm_compat_internal.js',
  'litertlm_wasm_compat_internal.wasm',
  'litertlm_wasm_compat_asyncify_internal.js',
  'litertlm_wasm_compat_asyncify_internal.wasm',
] as const;

export type LiteRtAsset = (typeof LITERT_LM_WASM_ASSETS)[number];

export function isLiteRtAsset(asset: string | undefined): asset is LiteRtAsset {
  return LITERT_LM_WASM_ASSETS.some((allowedAsset) => allowedAsset === asset);
}

export function resolveLiteRtAssetPath(asset: string): string {
  if (!isLiteRtAsset(asset)) {
    throw new Error('LITERT_ASSET_NOT_ALLOWED');
  }

  return join(packageWasmDirectory, asset);
}

export function getLiteRtAssetContentType(asset: LiteRtAsset): string {
  return asset.endsWith('.wasm')
    ? 'application/wasm'
    : 'text/javascript; charset=utf-8';
}
