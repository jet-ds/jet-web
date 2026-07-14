import { JETS_GHOST_MODEL } from '../config';
import {
  createRuntimeError,
  type CapabilityReport,
  type CapabilityStorageEstimate,
} from './types';

const STORAGE_SAFETY_MARGIN_BYTES = 512 * 1024 * 1024;

export const MIN_RECOMMENDED_AVAILABLE_STORAGE_BYTES = (
  JETS_GHOST_MODEL.bytes + STORAGE_SAFETY_MARGIN_BYTES
);

export interface CapabilityEnvironment {
  secureContext: boolean;
  gpu?: {
    requestAdapter(): Promise<unknown | null>;
  };
  storage?: {
    estimate(): Promise<{
      quota?: number;
      usage?: number;
    }>;
  };
}

function browserEnvironment(): CapabilityEnvironment {
  const browserNavigator = globalThis.navigator;

  return {
    secureContext: globalThis.isSecureContext === true,
    gpu: browserNavigator?.gpu,
    storage: browserNavigator?.storage,
  };
}

function unsupportedReport(
  environment: CapabilityEnvironment,
  code: 'insecure-context' | 'webgpu-unavailable' | 'adapter-unavailable',
  message: string,
  adapterAvailable = false,
  cause?: unknown,
): CapabilityReport {
  return {
    supported: false,
    warnings: [],
    failures: [createRuntimeError(code, message, false, cause)],
    secureContext: environment.secureContext,
    webGpuAvailable: environment.gpu !== undefined,
    adapterAvailable,
    storageEstimate: null,
  };
}

function finiteNonNegative(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function toStorageEstimate(
  estimate: { quota?: number; usage?: number },
): CapabilityStorageEstimate {
  const quotaBytes = finiteNonNegative(estimate.quota);
  const usageBytes = finiteNonNegative(estimate.usage);
  const availableBytes = quotaBytes === null || usageBytes === null
    ? null
    : Math.max(0, quotaBytes - usageBytes);

  return { quotaBytes, usageBytes, availableBytes };
}

export async function checkBrowserCapabilities(
  environment: CapabilityEnvironment = browserEnvironment(),
): Promise<CapabilityReport> {
  if (!environment.secureContext) {
    return unsupportedReport(
      environment,
      'insecure-context',
      "Jet's Ghost requires a secure browser context.",
    );
  }

  if (!environment.gpu) {
    return unsupportedReport(
      environment,
      'webgpu-unavailable',
      "This browser does not expose the WebGPU support Jet's Ghost needs.",
    );
  }

  let adapter: unknown | null;
  try {
    adapter = await environment.gpu.requestAdapter();
  } catch (cause) {
    return unsupportedReport(
      environment,
      'adapter-unavailable',
      "This browser could not provide a WebGPU adapter for Jet's Ghost.",
      false,
      cause,
    );
  }

  if (adapter === null) {
    return unsupportedReport(
      environment,
      'adapter-unavailable',
      "This browser could not provide a WebGPU adapter for Jet's Ghost.",
    );
  }

  const warnings: CapabilityReport['warnings'] = [];
  let storageEstimate: CapabilityStorageEstimate | null = null;

  if (environment.storage) {
    try {
      storageEstimate = toStorageEstimate(await environment.storage.estimate());
      if (
        storageEstimate.availableBytes !== null
        && storageEstimate.availableBytes < MIN_RECOMMENDED_AVAILABLE_STORAGE_BYTES
      ) {
        warnings.push(createRuntimeError(
          'storage-warning',
          'Reported browser storage may be too low for the local model download.',
          true,
        ));
      }
    } catch (cause) {
      warnings.push(createRuntimeError(
        'storage-warning',
        'Browser storage availability could not be estimated reliably.',
        true,
        cause,
      ));
    }
  }

  return {
    supported: true,
    warnings,
    failures: [],
    secureContext: true,
    webGpuAvailable: true,
    adapterAvailable: true,
    storageEstimate,
  };
}
