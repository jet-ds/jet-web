// @vitest-environment node

import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { chromium } from '@playwright/test';
import { expect, it } from 'vitest';
import { routePreviewRequest } from '../../../scripts/capture-production-baseline';

type ReceivedHeaders = Map<string, Array<string | undefined>>;

async function listen(server: Server): Promise<string> {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;
  const closed = new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) rejectClose(error);
      else resolveClose();
    });
  });
  server.closeAllConnections();
  await closed;
}

function record(headers: ReceivedHeaders, path: string, value: string | undefined): void {
  headers.set(path, [...(headers.get(path) ?? []), value]);
}

it('does not propagate the preview header through redirects or into cross-origin fonts', async () => {
  const originAHeaders: ReceivedHeaders = new Map();
  const originBHeaders: ReceivedHeaders = new Map();

  const originBServer = createServer((request, response) => {
    const path = request.url ?? '/';
    record(
      originBHeaders,
      path,
      request.headers['x-vercel-skip-toolbar'] as string | undefined,
    );
    if (path === '/landing') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><title>Redirect landing</title>');
      return;
    }
    if (path === '/routing-test.woff2') {
      response.writeHead(200, {
        'access-control-allow-origin': '*',
        'content-type': 'font/woff2',
      });
      response.end(Buffer.from('invalid-test-font'));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  const originB = await listen(originBServer);

  const originAServer = createServer((request, response) => {
    const path = request.url ?? '/';
    record(
      originAHeaders,
      path,
      request.headers['x-vercel-skip-toolbar'] as string | undefined,
    );
    if (path === '/redirect') {
      response.writeHead(302, { location: `${originB}/landing` });
      response.end();
      return;
    }
    if (path === '/font-page') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html>
        <script src="/same-origin.js"></script>
        <p>Exercise the cross-origin font request.</p>`);
      return;
    }
    if (path === '/same-origin.js') {
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      response.end('document.documentElement.dataset.routed = "true";');
      return;
    }
    response.writeHead(404);
    response.end();
  });
  const originA = await listen(originAServer);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  try {
    await context.route('**/*', (requestRoute) => routePreviewRequest(requestRoute, originA));
    const page = await context.newPage();

    await page.goto(`${originA}/redirect`);
    expect(page.url()).toBe(`${originB}/landing`);

    await page.goto(`${originA}/font-page`);
    expect(page.url()).toBe(`${originA}/font-page`);
    expect(await page.locator('p').textContent()).toContain('cross-origin font request');
    expect(originAHeaders.get('/same-origin.js')).toEqual(['1']);

    const fontPage = await context.newPage();
    const fontUrl = `${originB}/routing-test.woff2`;
    const fontRequest = fontPage.waitForRequest(fontUrl, { timeout: 5_000 });
    const fontNavigation = fontPage.goto(fontUrl).catch(() => null);
    await fontRequest;
    await fontNavigation;
    await fontPage.close();

    expect(originAHeaders.get('/redirect')).toEqual(['1']);
    expect(originAHeaders.get('/same-origin.js')).toEqual(['1']);
    expect(originBHeaders.get('/landing')).toEqual([undefined]);
    expect(originBHeaders.get('/routing-test.woff2')).toEqual([undefined]);
  } finally {
    await context.close();
    await browser.close();
    await Promise.all([close(originAServer), close(originBServer)]);
  }
}, 15_000);

it('redacts request details when preview routing fails', async () => {
  const privateRequestDetail = 'private-cookie-value';
  const failingRoute = {
    request: () => ({
      url: () => 'https://preview.example/asset.js',
      headers: () => ({ cookie: privateRequestDetail }),
    }),
    fetch: async () => {
      throw new Error(`browser request failed cookie=${privateRequestDetail}`);
    },
    fulfill: async () => {},
    continue: async () => {},
  } as Parameters<typeof routePreviewRequest>[0];

  await expect(
    routePreviewRequest(failingRoute, 'https://preview.example'),
  ).rejects.toThrow(/^PREVIEW_ROUTE_FAILED$/u);
});
