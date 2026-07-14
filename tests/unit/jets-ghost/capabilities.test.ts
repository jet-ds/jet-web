import { describe, expect, it, vi } from 'vitest';
import {
  MIN_RECOMMENDED_AVAILABLE_STORAGE_BYTES,
  checkBrowserCapabilities,
  type CapabilityEnvironment,
} from '../../../src/features/jets-ghost/runtime/capabilities';

function capabilityEnvironment(
  overrides: Partial<CapabilityEnvironment> = {},
): CapabilityEnvironment {
  return {
    secureContext: true,
    gpu: {
      requestAdapter: vi.fn().mockResolvedValue({}),
    },
    storage: {
      estimate: vi.fn().mockResolvedValue({
        quota: MIN_RECOMMENDED_AVAILABLE_STORAGE_BYTES * 2,
        usage: 0,
      }),
    },
    ...overrides,
  };
}

describe('browser capability checks', () => {
  it('rejects an insecure context before requesting a GPU adapter', async () => {
    const requestAdapter = vi.fn().mockResolvedValue({});

    const report = await checkBrowserCapabilities(capabilityEnvironment({
      secureContext: false,
      gpu: { requestAdapter },
    }));

    expect(report).toMatchObject({
      supported: false,
      secureContext: false,
      webGpuAvailable: true,
      adapterAvailable: false,
    });
    expect(report.failures.map(({ code }) => code)).toEqual(['insecure-context']);
    expect(requestAdapter).not.toHaveBeenCalled();
  });

  it('rejects a browser without WebGPU', async () => {
    const report = await checkBrowserCapabilities(capabilityEnvironment({ gpu: undefined }));

    expect(report).toMatchObject({
      supported: false,
      secureContext: true,
      webGpuAvailable: false,
      adapterAvailable: false,
    });
    expect(report.failures.map(({ code }) => code)).toEqual(['webgpu-unavailable']);
  });

  it('rejects a null WebGPU adapter', async () => {
    const report = await checkBrowserCapabilities(capabilityEnvironment({
      gpu: { requestAdapter: vi.fn().mockResolvedValue(null) },
    }));

    expect(report.supported).toBe(false);
    expect(report.adapterAvailable).toBe(false);
    expect(report.failures.map(({ code }) => code)).toEqual(['adapter-unavailable']);
  });

  it('reports low storage as a warning without blocking support', async () => {
    const report = await checkBrowserCapabilities(capabilityEnvironment({
      storage: {
        estimate: vi.fn().mockResolvedValue({
          quota: MIN_RECOMMENDED_AVAILABLE_STORAGE_BYTES,
          usage: 1,
        }),
      },
    }));

    expect(report.supported).toBe(true);
    expect(report.failures).toEqual([]);
    expect(report.warnings.map(({ code }) => code)).toEqual(['storage-warning']);
    expect(report.storageEstimate).toEqual({
      quotaBytes: MIN_RECOMMENDED_AVAILABLE_STORAGE_BYTES,
      usageBytes: 1,
      availableBytes: MIN_RECOMMENDED_AVAILABLE_STORAGE_BYTES - 1,
    });
  });

  it('supports a secure browser with WebGPU and an adapter', async () => {
    const requestAdapter = vi.fn().mockResolvedValue({ name: 'test-adapter' });

    const report = await checkBrowserCapabilities(capabilityEnvironment({
      gpu: { requestAdapter },
    }));

    expect(report).toEqual({
      supported: true,
      warnings: [],
      failures: [],
      secureContext: true,
      webGpuAvailable: true,
      adapterAvailable: true,
      storageEstimate: {
        quotaBytes: MIN_RECOMMENDED_AVAILABLE_STORAGE_BYTES * 2,
        usageBytes: 0,
        availableBytes: MIN_RECOMMENDED_AVAILABLE_STORAGE_BYTES * 2,
      },
    });
    expect(requestAdapter).toHaveBeenCalledTimes(1);
  });
});
