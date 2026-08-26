import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type IncomingHttpHeaders } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import analyticsPolicyMiddleware, { config } from '../middleware.js';

const port = Number.parseInt(process.env.PORT ?? '4323', 10);
const outputRoot = resolve(
  process.cwd(),
  process.env.ANALYTICS_FIXTURE_OUTPUT_DIR ?? '.analytics-dist',
);

const contentTypes: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
};

function isMatchedDocument(pathname: string): boolean {
  return config.matcher.some((matcher) => {
    if (matcher === '/') return pathname === '/';
    const basePath = matcher.replace('/:path*', '');
    return pathname === basePath || pathname.startsWith(`${basePath}/`);
  });
}

function requestHeaders(headers: IncomingHttpHeaders): Headers {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) result.append(name, item);
    } else if (value !== undefined) {
      result.set(name, value);
    }
  }
  return result;
}

function outputPath(pathname: string): string | undefined {
  const decodedPathname = decodeURIComponent(pathname);
  const relativePath = decodedPathname.endsWith('/')
    ? `${decodedPathname.slice(1)}index.html`
    : decodedPathname.slice(1);
  const candidate = resolve(outputRoot, relativePath || 'index.html');
  if (
    candidate !== outputRoot &&
    !candidate.startsWith(`${outputRoot}${sep}`)
  ) {
    return undefined;
  }
  return candidate;
}

const server = createServer(async (request, response) => {
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405).end();
      return;
    }

    const requestUrl = new URL(
      request.url ?? '/',
      `http://${request.headers.host ?? `localhost:${port}`}`,
    );
    const filePath = outputPath(requestUrl.pathname);
    if (filePath === undefined || !(await stat(filePath)).isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }

    const responseHeaders = new Headers({
      'Cache-Control': 'no-store',
      'Content-Type':
        contentTypes[extname(filePath)] ?? 'application/octet-stream',
    });

    if (isMatchedDocument(requestUrl.pathname)) {
      const middlewareResponse = analyticsPolicyMiddleware(
        new Request(requestUrl, { headers: requestHeaders(request.headers) }),
      );
      const policyCookie = middlewareResponse.headers.get('set-cookie');
      if (policyCookie !== null) {
        responseHeaders.set('Set-Cookie', policyCookie);
      }
    }

    response.writeHead(200, Object.fromEntries(responseHeaders));
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? Reflect.get(error, 'code')
        : undefined;
    if (code === 'ENOENT') {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(500).end('Fixture error');
  }
});

server.listen(port, 'localhost');

function close(): void {
  server.close(() => process.exit(0));
}

process.on('SIGINT', close);
process.on('SIGTERM', close);
