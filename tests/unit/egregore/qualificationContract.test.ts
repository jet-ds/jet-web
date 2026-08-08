import { describe, expect, it } from 'vitest';

import {
  QUALIFICATION_CASE_ORDER,
  localQualificationSpansRequired,
  orderQualificationCases,
  resolveQualificationRunContract,
  validateUnloadLifecycleEvidence,
} from '../../manual/qualificationContract';

describe('real-model qualification contract', () => {
  it('requires detailed spans only from the local qualification build', () => {
    expect(localQualificationSpansRequired(undefined)).toBe(true);
    expect(
      localQualificationSpansRequired('https://preview.example/chatbot/'),
    ).toBe(false);
  });

  it('makes a warm resume cache-only and requires the existing browser context', () => {
    expect(
      resolveQualificationRunContract({
        mode: 'warm-resume',
        cdpEndpoint: 'http://127.0.0.1:9222',
        removeDownloadedModel: false,
      }),
    ).toEqual({
      mode: 'warm-resume',
      activationPath: 'warm-only',
      storagePrecondition: 'readable-committed-cache',
      cdpEndpoint: 'http://127.0.0.1:9222',
      cacheDisposition: 'preserve',
    });

    expect(() =>
      resolveQualificationRunContract({
        mode: 'warm-resume',
        removeDownloadedModel: false,
      }),
    ).toThrow('WARM_RESUME_CDP_ENDPOINT_REQUIRED');

    expect(
      resolveQualificationRunContract({
        mode: 'warm-resume',
        cdpEndpoint: 'ws://127.0.0.1:9222/devtools/browser/test',
        removeDownloadedModel: true,
      }).cacheDisposition,
    ).toBe('remove-after-unload');
  });

  it('keeps fresh qualification and smoke behavior explicit', () => {
    expect(
      resolveQualificationRunContract({
        mode: 'qualification',
        removeDownloadedModel: false,
      }),
    ).toMatchObject({
      activationPath: 'cold-then-warm',
      storagePrecondition: 'fresh',
      cacheDisposition: 'preserve',
    });
    expect(
      resolveQualificationRunContract({
        mode: 'smoke',
        removeDownloadedModel: false,
      }),
    ).toMatchObject({
      activationPath: 'smoke',
      storagePrecondition: 'fresh',
    });
    expect(() =>
      resolveQualificationRunContract({
        mode: 'qualification',
        cdpEndpoint: 'http://127.0.0.1:9222',
        removeDownloadedModel: false,
      }),
    ).toThrow('EXISTING_BROWSER_CONTEXT_NOT_ALLOWED');
  });

  it('freezes the corrected accumulating qualification order', () => {
    const cases = [...QUALIFICATION_CASE_ORDER]
      .reverse()
      .map((id) => ({ id, marker: id.toUpperCase() }));

    expect(orderQualificationCases(cases).map(({ id }) => id)).toEqual(
      QUALIFICATION_CASE_ORDER,
    );
    expect(() => orderQualificationCases(cases.slice(1))).toThrow(
      'QUALIFICATION_CASE_MISSING',
    );
    expect(() => orderQualificationCases([...cases, cases[0]!])).toThrow(
      'QUALIFICATION_CASE_DUPLICATE',
    );
  });

  it('requires one successful device destroy and retained-reference clear per unload', () => {
    expect(
      validateUnloadLifecycleEvidence({
        deviceDestroyCount: 1,
        deviceReferenceClearCount: 1,
        runtimeUnloadCount: 1,
      }),
    ).toEqual([]);
    expect(
      validateUnloadLifecycleEvidence({
        deviceDestroyCount: 0,
        deviceReferenceClearCount: 0,
        runtimeUnloadCount: 1,
      }),
    ).toEqual([
      'WEBGPU_DEVICE_DESTROY_NOT_OBSERVED',
      'WEBGPU_DEVICE_REFERENCE_CLEAR_NOT_OBSERVED',
    ]);
  });
});
