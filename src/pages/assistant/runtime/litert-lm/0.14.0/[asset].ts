import { readFile } from 'node:fs/promises';
import {
  LITERT_LM_WASM_ASSETS,
  getLiteRtAssetContentType,
  isLiteRtAsset,
  resolveLiteRtAssetPath,
} from '../../../../../features/egregore/runtime/liteRtAssets.server';

export const prerender = true;

export function getStaticPaths() {
  return LITERT_LM_WASM_ASSETS.map((asset) => ({
    params: { asset },
  }));
}

export async function GET({
  params,
}: {
  params: Record<string, string | undefined>;
}): Promise<Response> {
  const { asset } = params;

  if (!isLiteRtAsset(asset)) {
    return new Response(null, { status: 404 });
  }

  const bytes = await readFile(resolveLiteRtAssetPath(asset));

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': getLiteRtAssetContentType(asset),
    },
  });
}
