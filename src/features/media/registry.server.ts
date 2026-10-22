import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import {
  assetKeyPattern,
  parseMediaDescriptor,
  resolveMediaPresentation,
  type MediaDescriptor,
  type MediaPresentation,
} from './contract';
export function loadMediaAsset(
  key: string,
  root = process.cwd(),
): MediaDescriptor {
  if (!assetKeyPattern.test(key)) throw new Error('INVALID_MEDIA_KEY');
  const base = resolve(root, 'src/data/media');
  const path = resolve(base, `${key}.json`);
  try {
    const rootRel = relative(realpathSync(root), realpathSync(base));
    if (
      isAbsolute(rootRel) ||
      rootRel === '..' ||
      rootRel.startsWith(`..${sep}`) ||
      lstatSync(base).isSymbolicLink()
    )
      throw new Error('UNSAFE_MEDIA_PATH');
    const rel = relative(realpathSync(base), realpathSync(path));
    if (
      isAbsolute(rel) ||
      rel === '..' ||
      rel.startsWith(`..${sep}`) ||
      lstatSync(path).isSymbolicLink()
    )
      throw new Error('UNSAFE_MEDIA_PATH');
    return parseMediaDescriptor(key, JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    throw new Error(`INVALID_MEDIA_ASSET:${key}`);
  }
}
export interface ResolvedContentImage extends MediaPresentation {
  asset: string;
  alt: string;
  darkAsset?: string;
  darkUrl?: string;
  darkSrcSet?: string;
  social: MediaPresentation;
  carousel: MediaPresentation;
  darkCarousel?: MediaPresentation;
}
export function resolveContentImage(
  reference: { asset: string; alt: string; darkAsset?: string },
  lane: 'blog' | 'works',
  root = process.cwd(),
): ResolvedContentImage {
  if (
    !reference.asset.startsWith(`${lane}/`) ||
    (reference.darkAsset && !reference.darkAsset.startsWith(`${lane}/`))
  )
    throw new Error('WRONG_MEDIA_LANE');
  const asset = loadMediaAsset(reference.asset, root);
  const dark = reference.darkAsset
    ? loadMediaAsset(reference.darkAsset, root)
    : undefined;
  const detail = resolveMediaPresentation(asset, 'detail');
  return {
    ...detail,
    asset: reference.asset,
    alt: reference.alt,
    social: resolveMediaPresentation(asset, 'social'),
    carousel: resolveMediaPresentation(asset, 'carousel'),
    ...(dark
      ? {
          darkAsset: reference.darkAsset,
          darkUrl: resolveMediaPresentation(dark, 'detail').url,
          darkSrcSet: resolveMediaPresentation(dark, 'detail').srcSet,
          darkCarousel: resolveMediaPresentation(dark, 'carousel'),
        }
      : {}),
  };
}
