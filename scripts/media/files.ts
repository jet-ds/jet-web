import {
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  writeFile,
  rm,
} from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { assetKeyPattern } from '../../src/features/media/contract';
export async function readStagedImage(
  argument: string,
  root = process.cwd(),
): Promise<{ key: string; bytes: Buffer }> {
  const match =
    /^((?:about|blog|works)\/[a-z0-9]+(?:-[a-z0-9]+)*)\.(jpg|jpeg|png|webp|avif|gif)$/u.exec(
      argument,
    );
  if (!match || !assetKeyPattern.test(match[1]))
    throw new Error('INVALID_STAGING_PATH');
  const base = resolve(root, 'Untracked/media-staging');
  const path = resolve(base, argument);
  const baseStat = await lstat(base);
  const baseRel = relative(await realpath(root), await realpath(base));
  if (
    baseStat.isSymbolicLink() ||
    isAbsolute(baseRel) ||
    baseRel === '..' ||
    baseRel.startsWith(`..${sep}`)
  )
    throw new Error('INVALID_STAGING_PATH');
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 20 * 1024 * 1024)
    throw new Error('INVALID_STAGED_SOURCE');
  const rel = relative(await realpath(base), await realpath(path));
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`))
    throw new Error('INVALID_STAGING_PATH');
  return { key: match[1], bytes: await readFile(path) };
}
export async function atomicJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      mode: 0o600,
      flag: 'wx',
    });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}
