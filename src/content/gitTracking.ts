import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

const CONTENT_PATHS = [
  'src/data/blog',
  'src/data/works',
  'src/data/profile',
] as const;

function isContained(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target);
  return (
    pathFromRoot === '' ||
    (!isAbsolute(pathFromRoot) &&
      pathFromRoot !== '..' &&
      !pathFromRoot.startsWith(`..${sep}`))
  );
}

function gitEnvironment(root: string): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const key of [
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_COMMON_DIR',
    'GIT_DIR',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_WORK_TREE',
  ]) {
    delete environment[key];
  }
  environment.GIT_CEILING_DIRECTORIES = dirname(root);
  return environment;
}

export function loadTrackedContentPaths(
  root: string = process.cwd(),
): Set<string> {
  const resolvedRoot = resolve(root);
  const result = spawnSync('git', ['ls-files', '-z', '--', ...CONTENT_PATHS], {
    cwd: resolvedRoot,
    encoding: 'buffer',
    env: gitEnvironment(resolvedRoot),
    shell: false,
  });

  if (result.error !== undefined) {
    throw new Error(
      `Unable to read Git tracked content: ${result.error.message}`,
    );
  }
  if (result.status !== 0) {
    const stderr = result.stderr.toString('utf8').trim();
    throw new Error(
      `Unable to read Git tracked content${stderr === '' ? '.' : `: ${stderr}`}`,
    );
  }

  const output = result.stdout.toString('utf8');
  if (output !== '' && !output.endsWith('\0')) {
    throw new Error('Git tracked-content output was not NUL terminated.');
  }

  const trackedPaths = new Set<string>();
  for (const path of output.split('\0')) {
    if (path === '') continue;

    const absolutePath = resolve(resolvedRoot, path);
    if (!isContained(resolvedRoot, absolutePath)) {
      throw new Error(
        `Git returned a content path outside the repository root: ${path}`,
      );
    }
    if (
      !CONTENT_PATHS.some(
        (contentPath) =>
          path === contentPath || path.startsWith(`${contentPath}/`),
      )
    ) {
      throw new Error(`Git returned an unexpected content path: ${path}`);
    }

    trackedPaths.add(path);
  }

  return trackedPaths;
}
