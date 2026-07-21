import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { establishDeploymentProtectionBypass } from '../../support/deploymentProtection';

const deploymentSuite = readFileSync(
  resolve(process.cwd(), 'tests/deployment/core-production.spec.ts'),
  'utf8',
);
const realModelSuite = readFileSync(
  resolve(process.cwd(), 'tests/manual/egregore-real-model.spec.ts'),
  'utf8',
);
const productionConfig = readFileSync(
  resolve(process.cwd(), 'playwright.production.config.ts'),
  'utf8',
);

describe('deployment protection test support', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mints the cookie outside Playwright without following the same-origin bootstrap redirect', async () => {
    const origin = 'https://preview.vercel.app';
    const fetch = vi.fn().mockResolvedValue({
      status: 307,
      redirected: false,
      headers: {
        get: (name: string) =>
          name === 'location' ? `${origin}/chatbot/` : null,
        getSetCookie: () => [
          '_vercel_jwt=header.payload.signature; Path=/; HttpOnly; Secure',
        ],
      },
    });
    const addCookies = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('fetch', fetch);

    await establishDeploymentProtectionBypass({ addCookies }, origin, 'secret');

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(`${origin}/chatbot/`, {
      headers: {
        'x-vercel-protection-bypass': 'secret',
        'x-vercel-set-bypass-cookie': 'true',
      },
      redirect: 'manual',
      signal: expect.any(AbortSignal),
    });
    expect(addCookies).toHaveBeenCalledWith([
      {
        name: '_vercel_jwt',
        value: 'header.payload.signature',
        url: origin,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ]);
  });

  it('does nothing without a secret and replaces a rejected fetch with a content-free error', async () => {
    const secretSentinel = 'FAKE_REVIEW_SECRET';
    const fetch = vi
      .fn()
      .mockRejectedValue(new Error(`network ${secretSentinel}`));
    const addCookies = vi.fn().mockResolvedValue(undefined);
    const context = { addCookies };
    vi.stubGlobal('fetch', fetch);

    await establishDeploymentProtectionBypass(
      context,
      'https://preview.vercel.app',
      undefined,
    );
    expect(fetch).not.toHaveBeenCalled();

    let rejection: unknown;
    try {
      await establishDeploymentProtectionBypass(
        context,
        'https://preview.vercel.app',
        secretSentinel,
      );
    } catch (error) {
      rejection = error;
    }
    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toBe(
      'DEPLOYMENT_PROTECTION_REQUEST_FAILED',
    );
    expect((rejection as Error).message).not.toContain(secretSentinel);
    expect(addCookies).not.toHaveBeenCalled();
  });

  it('replaces a rejected Playwright cookie install with a content-free error', async () => {
    const cookieSentinel = 'header.payload.signature';
    const fetch = vi.fn().mockResolvedValue({
      status: 200,
      redirected: false,
      headers: {
        get: () => null,
        getSetCookie: () => [`_vercel_jwt=${cookieSentinel}; Path=/`],
      },
    });
    const addCookies = vi
      .fn()
      .mockRejectedValue(new Error(`cookie ${cookieSentinel}`));
    vi.stubGlobal('fetch', fetch);

    let rejection: unknown;
    try {
      await establishDeploymentProtectionBypass(
        { addCookies },
        'https://preview.vercel.app',
        'secret',
      );
    } catch (error) {
      rejection = error;
    }
    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toBe(
      'DEPLOYMENT_PROTECTION_COOKIE_INSTALL_FAILED',
    );
    expect((rejection as Error).message).not.toContain(cookieSentinel);
  });

  it('refuses a cross-origin redirect without resending or installing the credential', async () => {
    const fetch = vi.fn().mockResolvedValue({
      status: 302,
      redirected: false,
      headers: {
        get: (name: string) =>
          name === 'location' ? 'https://attacker.example/' : null,
        getSetCookie: () => ['_vercel_jwt=header.payload.signature; Path=/'],
      },
    });
    const addCookies = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('fetch', fetch);

    await expect(
      establishDeploymentProtectionBypass(
        { addCookies },
        'https://preview.vercel.app',
        'secret',
      ),
    ).rejects.toThrow('DEPLOYMENT_PROTECTION_REDIRECT_FORBIDDEN');
    expect(fetch).toHaveBeenCalledOnce();
    expect(addCookies).not.toHaveBeenCalled();
  });

  it('rejects non-Vercel origins before the credential reaches the network', async () => {
    const fetch = vi.fn();
    const addCookies = vi.fn();
    vi.stubGlobal('fetch', fetch);

    await expect(
      establishDeploymentProtectionBypass(
        { addCookies },
        'https://attacker.example',
        'secret',
      ),
    ).rejects.toThrow('DEPLOYMENT_PROTECTION_ORIGIN_FORBIDDEN');
    expect(fetch).not.toHaveBeenCalled();
    expect(addCookies).not.toHaveBeenCalled();
  });

  it('uses the cookie-sharing browser context for protected deployment readback', () => {
    expect(deploymentSuite).toContain('establishDeploymentProtectionBypass(');
    expect(deploymentSuite).toContain(
      'process.env.VERCEL_AUTOMATION_BYPASS_SECRET',
    );
    expect(deploymentSuite).toContain('const request = context.request;');
  });

  it('establishes the same protected-Preview boundary before real-model navigation', () => {
    expect(realModelSuite).toContain('establishDeploymentProtectionBypass(');
    expect(realModelSuite).toContain(
      'process.env.VERCEL_AUTOMATION_BYPASS_SECRET',
    );
  });

  it('does not retain browser artifacts that could contain a bypass credential', () => {
    expect(productionConfig).toContain("preserveOutput: 'never',");
    expect(productionConfig).toContain("trace: 'off',");
    expect(productionConfig).toContain("screenshot: 'off',");
    expect(productionConfig).toContain("video: 'off',");
  });
});
