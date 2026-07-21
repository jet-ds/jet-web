import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from '@playwright/test';
import { SITE } from '../src/config/site';

interface CaptureOptions {
  outputPath: string;
  overwrite: boolean;
}

function jpegDimensions(bytes: Buffer): { width: number; height: number } {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8)
    throw new Error('OUTPUT_NOT_JPEG');
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error('OUTPUT_JPEG_INVALID_MARKER');
    const marker = bytes[offset + 1];
    offset += 2;
    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      (marker >= 0xd0 && marker <= 0xd7)
    )
      continue;
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      throw new Error('OUTPUT_JPEG_INVALID_SEGMENT');
    }
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return {
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }
  throw new Error('OUTPUT_JPEG_DIMENSIONS_MISSING');
}

export function assertLoopbackOrigin(origin: string): URL {
  const parsed = new URL(origin);
  if (
    parsed.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(parsed.hostname) ||
    parsed.username !== '' ||
    parsed.password !== ''
  ) {
    throw new Error('CAPTURE_ORIGIN_MUST_BE_LOOPBACK_HTTP');
  }
  return parsed;
}

function parseArguments(
  arguments_: string[],
  repositoryRoot: string,
): CaptureOptions {
  let outputPath = resolve(
    repositoryRoot,
    `public${SITE.defaultOpenGraphImage.path}`,
  );
  let overwrite = false;
  for (const argument of arguments_) {
    if (argument === '--overwrite') {
      overwrite = true;
      continue;
    }
    if (argument.startsWith('--output=')) {
      outputPath = resolve(repositoryRoot, argument.slice('--output='.length));
      continue;
    }
    throw new Error(`UNKNOWN_ARGUMENT:${argument}`);
  }

  const imageRoot = resolve(repositoryRoot, 'public/images');
  const pathFromImageRoot = relative(imageRoot, outputPath);
  if (
    pathFromImageRoot === '' ||
    isAbsolute(pathFromImageRoot) ||
    pathFromImageRoot === '..' ||
    pathFromImageRoot.startsWith(`..${sep}`)
  ) {
    throw new Error('CAPTURE_OUTPUT_OUTSIDE_PUBLIC_IMAGES');
  }
  if (existsSync(outputPath) && !overwrite)
    throw new Error('CAPTURE_OUTPUT_EXISTS_USE_OVERWRITE');
  return { outputPath, overwrite };
}

async function availablePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close();
        reject(new Error('CAPTURE_PORT_UNAVAILABLE'));
        return;
      }
      server.close((error) => {
        if (error) reject(error);
        else resolvePort(address.port);
      });
    });
  });
}

function build(repositoryRoot: string): void {
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: repositoryRoot,
    env: process.env,
    shell: false,
    stdio: 'inherit',
  });
  if (result.error || result.status !== 0)
    throw new Error('CAPTURE_BUILD_FAILED');
}

function startPreview(repositoryRoot: string, port: number): ChildProcess {
  return spawn(
    'npm',
    ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: repositoryRoot,
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

async function waitForPreview(
  origin: string,
  preview: ChildProcess,
): Promise<void> {
  const deadline = Date.now() + 20_000;
  let lastError = 'preview did not start';
  while (Date.now() < deadline) {
    if (preview.exitCode !== null) {
      throw new Error(`CAPTURE_PREVIEW_EXITED:${preview.exitCode}`);
    }
    try {
      const response = await fetch(origin, { cache: 'no-store' });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : 'preview request failed';
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`CAPTURE_PREVIEW_TIMEOUT:${lastError}`);
}

async function stopPreview(preview: ChildProcess | undefined): Promise<void> {
  if (!preview || preview.exitCode !== null) return;
  preview.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((resolveExit) =>
      preview.once('exit', () => resolveExit()),
    ),
    new Promise<void>((resolveTimeout) => setTimeout(resolveTimeout, 3_000)),
  ]);
  if (preview.exitCode === null) preview.kill('SIGKILL');
}

function verifyOutput(path: string): void {
  const bytes = readFileSync(path);
  const dimensions = jpegDimensions(bytes);
  if (
    dimensions.width !== SITE.defaultOpenGraphImage.width ||
    dimensions.height !== SITE.defaultOpenGraphImage.height
  ) {
    throw new Error(
      `CAPTURE_DIMENSIONS_MISMATCH:${dimensions.width}x${dimensions.height}`,
    );
  }
  if (statSync(path).size > SITE.defaultOpenGraphImage.maxBytes) {
    throw new Error('CAPTURE_OUTPUT_TOO_LARGE');
  }
}

export function replaceValidatedCapture(
  temporaryPath: string,
  outputPath: string,
): void {
  const temporary = resolve(temporaryPath);
  const output = resolve(outputPath);
  if (temporary === output || dirname(temporary) !== dirname(output)) {
    throw new Error('CAPTURE_TEMPORARY_FILE_MUST_BE_SIBLING');
  }
  try {
    verifyOutput(temporary);
    renameSync(temporary, output);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

export async function captureDefaultOpenGraphImage(
  arguments_: string[],
  repositoryRoot: string,
): Promise<void> {
  const options = parseArguments(arguments_, repositoryRoot);
  mkdirSync(dirname(options.outputPath), { recursive: true });
  const temporaryPath = resolve(
    dirname(options.outputPath),
    `.${basename(options.outputPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  build(repositoryRoot);
  const port = await availablePort();
  const origin = assertLoopbackOrigin(`http://127.0.0.1:${port}`).origin;
  let preview: ChildProcess | undefined;
  let browser: Browser | undefined;

  try {
    preview = startPreview(repositoryRoot, port);
    await waitForPreview(origin, preview);
    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      colorScheme: 'light',
      reducedMotion: 'no-preference',
    });
    await context.addInitScript(() => {
      const captureWindow = window as unknown as Window & {
        __JET_OG_CAPTURE_DIAGNOSTICS__: {
          drawCount: number;
          rafCount: number;
          wrapperError: string | null;
          wrapperInstalled: boolean;
        };
        __JET_OG_WEBGL_DRAW_COMPLETE__?: boolean;
      };
      localStorage.clear();
      Object.defineProperty(window, '__JET_OG_CAPTURE_DIAGNOSTICS__', {
        configurable: true,
        value: {
          drawCount: 0,
          rafCount: 0,
          wrapperError: null,
          wrapperInstalled: false,
        },
      });
      const nativeRequestAnimationFrame =
        window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback: FrameRequestCallback): number =>
        nativeRequestAnimationFrame(() => {
          const diagnostics = captureWindow.__JET_OG_CAPTURE_DIAGNOSTICS__;
          diagnostics.rafCount += 1;
          callback(1000);
        });
      try {
        const prototype = WebGL2RenderingContext.prototype;
        const nativeDrawArrays = prototype.drawArrays;
        prototype.drawArrays = new Proxy(nativeDrawArrays, {
          apply(target, thisArgument, argumentsList) {
            const result = Reflect.apply(target, thisArgument, argumentsList);
            const diagnostics = captureWindow.__JET_OG_CAPTURE_DIAGNOSTICS__;
            diagnostics.drawCount += 1;
            Object.defineProperty(window, '__JET_OG_WEBGL_DRAW_COMPLETE__', {
              configurable: true,
              value: true,
            });
            return result;
          },
        });
        captureWindow.__JET_OG_CAPTURE_DIAGNOSTICS__.wrapperInstalled = true;
      } catch (error) {
        captureWindow.__JET_OG_CAPTURE_DIAGNOSTICS__.wrapperError =
          String(error);
      }
    });
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.locator('h1').waitFor({ state: 'visible' });
    await page.locator('#site-navigation-dock').waitFor({ state: 'visible' });
    try {
      await page.waitForFunction(
        () =>
          (window as Window & { __JET_OG_WEBGL_DRAW_COMPLETE__?: boolean })
            .__JET_OG_WEBGL_DRAW_COMPLETE__ === true,
        undefined,
        { timeout: 20_000 },
      );
    } catch {
      const state = await page.evaluate(() => ({
        canvasCount: document.querySelectorAll('canvas').length,
        diagnostics: (
          window as Window & { __JET_OG_CAPTURE_DIAGNOSTICS__?: unknown }
        ).__JET_OG_CAPTURE_DIAGNOSTICS__,
        documentHidden: document.hidden,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        webgl2Available: typeof WebGL2RenderingContext === 'function',
      }));
      throw new Error(`WEBGL_DRAW_TIMEOUT:${JSON.stringify(state)}`);
    }
    await page.evaluate(async () => {
      const fontSpecifications = [
        '700 16px Brawler',
        '400 16px Work Sans',
        '500 16px Work Sans',
        '600 16px Work Sans',
        '700 16px Work Sans',
      ];
      for (const specification of fontSpecifications) {
        const loaded = await Promise.race([
          document.fonts.load(specification),
          new Promise<never>((_resolve, reject) => {
            setTimeout(
              () => reject(new Error(`FONT_LOAD_TIMEOUT:${specification}`)),
              15_000,
            );
          }),
        ]);
        if (loaded.length === 0 || !document.fonts.check(specification)) {
          throw new Error(`FONT_FALLBACK_DETECTED:${specification}`);
        }
      }
      await document.fonts.ready;
    });
    await page.screenshot({
      path: temporaryPath,
      type: 'jpeg',
      quality: 90,
      fullPage: false,
    });
    await context.close();
    replaceValidatedCapture(temporaryPath, options.outputPath);
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    await browser?.close();
    await stopPreview(preview);
  }
}

const repositoryRoot = resolve(fileURLToPath(import.meta.url), '../..');

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  captureDefaultOpenGraphImage(process.argv.slice(2), repositoryRoot).catch(
    (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'UNEXPECTED_ERROR';
      process.stderr.write(`OpenGraph capture failed: ${message}\n`);
      process.exitCode = 1;
    },
  );
}
