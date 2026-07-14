import type { JetsGhostErrorCode } from '../errors';
import {
  createRuntimeError,
  type CapabilityReport,
  type GenerationHandlers,
  type GenerationResult,
  type LoadOptions,
  type LocalModelRuntime,
  type ModelMessage,
} from './types';

export type FakeRuntimeFailurePoint =
  | 'capability'
  | 'load'
  | 'generation'
  | 'reset'
  | 'unload';

export interface FakeRuntimeOptions {
  testOnly: true;
  responseChunks?: readonly string[];
  capabilityReport?: CapabilityReport;
  failures?: Partial<Record<FakeRuntimeFailurePoint, boolean>>;
}

export interface FakeRuntimeCall {
  method:
    | 'checkCapabilities'
    | 'load'
    | 'createSession'
    | 'generate'
    | 'cancel'
    | 'reset'
    | 'unload';
  operationId: number;
}

const DEFAULT_CAPABILITY_REPORT: CapabilityReport = {
  supported: true,
  warnings: [],
  failures: [],
  secureContext: true,
  webGpuAvailable: true,
  adapterAvailable: true,
  storageEstimate: null,
};

const FAILURE_DETAILS: Record<
  Exclude<FakeRuntimeFailurePoint, 'capability'>,
  { code: JetsGhostErrorCode; message: string }
> = {
  load: {
    code: 'model-load-failed',
    message: 'The test runtime was configured to fail while loading.',
  },
  generation: {
    code: 'generation-failed',
    message: 'The test runtime was configured to fail during generation.',
  },
  reset: {
    code: 'engine-cleanup-failed',
    message: 'The test runtime was configured to fail while resetting.',
  },
  unload: {
    code: 'engine-cleanup-failed',
    message: 'The test runtime was configured to fail while unloading.',
  },
};

interface ActiveGeneration {
  operationId: number;
  cancelled: boolean;
}

export class FakeRuntime implements LocalModelRuntime {
  private readonly responseChunks: readonly string[];
  private readonly capabilityReport: CapabilityReport;
  private readonly failures: Partial<Record<FakeRuntimeFailurePoint, boolean>>;
  private readonly callLog: FakeRuntimeCall[] = [];
  private nextOperationId = 1;
  private activeGeneration: ActiveGeneration | null = null;

  constructor(options: FakeRuntimeOptions) {
    if (options.testOnly !== true) {
      throw new Error('FakeRuntime is test-only and requires explicit test authorization.');
    }

    this.responseChunks = [...(options.responseChunks ?? ['Test response.'])];
    this.capabilityReport = options.capabilityReport ?? DEFAULT_CAPABILITY_REPORT;
    this.failures = { ...options.failures };
  }

  get calls(): readonly FakeRuntimeCall[] {
    return this.callLog;
  }

  private record(method: FakeRuntimeCall['method']): number {
    const operationId = this.nextOperationId;
    this.nextOperationId += 1;
    this.callLog.push({ method, operationId });
    return operationId;
  }

  private configuredFailure(
    point: Exclude<FakeRuntimeFailurePoint, 'capability'>,
  ): void {
    if (!this.failures[point]) return;

    const failure = FAILURE_DETAILS[point];
    throw createRuntimeError(failure.code, failure.message, true);
  }

  private invalidateActiveGeneration(): void {
    if (this.activeGeneration) {
      this.activeGeneration.cancelled = true;
      this.activeGeneration = null;
    }
  }

  async checkCapabilities(): Promise<CapabilityReport> {
    this.record('checkCapabilities');

    if (this.failures.capability) {
      return {
        ...DEFAULT_CAPABILITY_REPORT,
        supported: false,
        adapterAvailable: false,
        failures: [createRuntimeError(
          'adapter-unavailable',
          'The test runtime was configured without a WebGPU adapter.',
          false,
        )],
      };
    }

    return this.capabilityReport;
  }

  async load(options: LoadOptions): Promise<void> {
    this.record('load');
    options.onPhase?.('runtime');
    this.configuredFailure('load');
    options.onPhase?.('model');
  }

  async createSession(_preface: ModelMessage[]): Promise<void> {
    this.record('createSession');
  }

  async generate(
    _message: string,
    handlers: GenerationHandlers,
  ): Promise<GenerationResult> {
    const generation: ActiveGeneration = {
      operationId: this.record('generate'),
      cancelled: false,
    };
    this.activeGeneration = generation;

    try {
      this.configuredFailure('generation');

      for (const chunk of this.responseChunks) {
        await Promise.resolve();
        if (generation.cancelled) break;
        handlers.onText(chunk);
      }

      return {
        finishReason: generation.cancelled ? 'cancelled' : 'completed',
      };
    } finally {
      if (this.activeGeneration?.operationId === generation.operationId) {
        this.activeGeneration = null;
      }
    }
  }

  cancel(): void {
    this.record('cancel');
    if (this.activeGeneration) {
      this.activeGeneration.cancelled = true;
    }
  }

  async reset(): Promise<void> {
    this.record('reset');
    this.invalidateActiveGeneration();
    this.configuredFailure('reset');
  }

  async unload(): Promise<void> {
    this.record('unload');
    this.invalidateActiveGeneration();
    this.configuredFailure('unload');
  }
}
