import { access, readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

type RoutingArtifact = {
  config: {
    version?: unknown;
    framework?: { slug?: unknown };
    routes?: unknown;
  };
  functionDirectories: string[];
  staticFiles: string[];
};

export function validateRoutingMiddlewareArtifact(
  artifact: RoutingArtifact,
): string[] {
  const failures: string[] = [];
  if (artifact.config.version !== 3) {
    failures.push('Build Output API config must use version 3');
  }
  if (artifact.config.framework?.slug !== 'astro') {
    failures.push('Build Output API config must identify Astro');
  }

  const routes = Array.isArray(artifact.config.routes)
    ? artifact.config.routes
    : [];
  const middlewareRoute = routes.find(
    (route) =>
      typeof route === 'object' &&
      route !== null &&
      Reflect.get(route, 'middlewarePath') === 'middleware',
  );
  if (middlewareRoute === undefined) {
    failures.push('Routing middleware route is missing');
  }

  if (
    artifact.functionDirectories.length !== 1 ||
    artifact.functionDirectories[0] !== 'middleware.func'
  ) {
    failures.push('Only middleware.func may exist in Vercel functions output');
  }
  if (!artifact.staticFiles.includes('index.html')) {
    failures.push('Static root document is missing');
  }
  return failures;
}

async function main(): Promise<void> {
  const outputDirectory = resolve(process.argv[2] ?? '.vercel/output');
  const config = JSON.parse(
    await readFile(resolve(outputDirectory, 'config.json'), 'utf8'),
  ) as RoutingArtifact['config'];
  const functionDirectories = (
    await readdir(resolve(outputDirectory, 'functions'), {
      withFileTypes: true,
    })
  )
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => name)
    .sort();
  await access(resolve(outputDirectory, 'static/index.html'));

  const failures = validateRoutingMiddlewareArtifact({
    config,
    functionDirectories,
    staticFiles: ['index.html'],
  });
  if (failures.length > 0) {
    throw new Error(failures.join('\n'));
  }

  console.log(
    'Routing middleware artifact verified: static Astro output plus middleware.func',
  );
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  resolve(invokedPath) === fileURLToPath(import.meta.url)
) {
  await main();
}
