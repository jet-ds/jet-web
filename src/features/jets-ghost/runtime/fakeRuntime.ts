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
  failures?: Partial<Record<FakeRuntimeFailurePoint, boolean | number>>;
  scheduler?: FakeRuntimeScheduler;
  recorder?: FakeRuntimeRecorder;
  recordResourceLifecycle?: boolean;
  emitLateChunkAfterCancellation?: boolean;
}

export interface FakeRuntimeScheduler {
  waitForChunk(operationId: number, chunkIndex: number): Promise<void>;
  waitForCapability?(operationId: number): Promise<void>;
  waitForLoad?(operationId: number): Promise<void>;
  waitForUnload?(operationId: number): Promise<void>;
}

export interface FakeRuntimeCall {
  method:
    | 'checkCapabilities'
    | 'load'
    | 'createSession'
    | 'generate'
    | 'cancel'
    | 'reset'
    | 'unload'
    | 'repository.load'
    | 'runtime.load'
    | 'engine.create'
    | 'conversation.create'
    | 'conversation.delete'
    | 'repository.unload'
    | 'engine.delete'
    | 'sdk.unload';
  operationId: number;
  runtimeId: number;
}

export class FakeRuntimeRecorder {
  private readonly callLog: FakeRuntimeCall[] = [];
  private nextOperationId = 1;

  constructor(readonly runtimeId: number) {}

  get calls(): readonly FakeRuntimeCall[] {
    return Object.freeze(this.callLog.map((call) => Object.freeze({ ...call })));
  }

  record(method: FakeRuntimeCall['method']): number {
    const operationId = this.nextOperationId;
    this.nextOperationId += 1;
    this.callLog.push({ method, operationId, runtimeId: this.runtimeId });
    return operationId;
  }
}

export function createAuditedRuntime(
  runtime: LocalModelRuntime,
  recorder: FakeRuntimeRecorder,
): LocalModelRuntime {
  return {
    checkCapabilities: () => {
      recorder.record('checkCapabilities');
      return runtime.checkCapabilities();
    },
    load: (options) => {
      recorder.record('load');
      return runtime.load(options);
    },
    createSession: (preface) => {
      recorder.record('createSession');
      return runtime.createSession(preface);
    },
    generate: (message, handlers) => {
      recorder.record('generate');
      return runtime.generate(message, handlers);
    },
    cancel: () => {
      recorder.record('cancel');
      runtime.cancel();
    },
    reset: () => {
      recorder.record('reset');
      return runtime.reset();
    },
    unload: () => {
      recorder.record('unload');
      return runtime.unload();
    },
  };
}

const DEFAULT_CAPABILITY_REPORT: CapabilityReport = {
  supported: true,
  warnings: [],
  failures: [],
  secureContext: true,
  webGpuAvailable: true,
  adapterAvailable: true,
  browser: {
    family: 'unknown',
    version: null,
  },
  storageEstimate: null,
};

const DEFAULT_SCHEDULER: FakeRuntimeScheduler = {
  waitForChunk: async () => undefined,
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
  private readonly failures: Partial<Record<FakeRuntimeFailurePoint, boolean | number>>;
  private readonly scheduler: FakeRuntimeScheduler;
  private readonly recorder: FakeRuntimeRecorder;
  private readonly recordResourceLifecycle: boolean;
  private readonly emitLateChunkAfterCancellation: boolean;
  private activeGeneration: ActiveGeneration | null = null;
  private hasEngine = false;
  private hasConversation = false;

  constructor(options: FakeRuntimeOptions) {
    if (options.testOnly !== true) {
      throw new Error('FakeRuntime is test-only and requires explicit test authorization.');
    }

    this.responseChunks = [...(options.responseChunks ?? ['Test response.'])];
    this.capabilityReport = options.capabilityReport ?? DEFAULT_CAPABILITY_REPORT;
    this.failures = { ...options.failures };
    this.scheduler = options.scheduler ?? DEFAULT_SCHEDULER;
    this.recorder = options.recorder ?? new FakeRuntimeRecorder(1);
    this.recordResourceLifecycle = options.recordResourceLifecycle ?? false;
    this.emitLateChunkAfterCancellation = options.emitLateChunkAfterCancellation ?? false;
  }

  get calls(): readonly FakeRuntimeCall[] {
    return this.recorder.calls;
  }

  private record(method: FakeRuntimeCall['method']): number {
    return this.recorder.record(method);
  }

  private configuredFailure(
    point: Exclude<FakeRuntimeFailurePoint, 'capability'>,
  ): void {
    const configured = this.failures[point];
    if (!configured) return;

    if (typeof configured === 'number') {
      if (configured <= 0) return;
      this.failures[point] = configured - 1;
    }

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
    const operationId = this.record('checkCapabilities');
    await this.scheduler.waitForCapability?.(operationId);

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
    const operationId = this.record(
      this.recordResourceLifecycle ? 'runtime.load' : 'load',
    );
    options.onPhase?.('runtime');
    this.configuredFailure('load');
    await this.scheduler.waitForLoad?.(operationId);
    if (this.recordResourceLifecycle) this.record('engine.create');
    this.hasEngine = true;
    options.onPhase?.('model');
  }

  async createSession(_preface: ModelMessage[]): Promise<void> {
    this.record(
      this.recordResourceLifecycle ? 'conversation.create' : 'createSession',
    );
    this.hasConversation = true;
  }

  async generate(
    _message: string,
    handlers: GenerationHandlers,
  ): Promise<GenerationResult> {
    const operationId = this.record('generate');
    if (this.activeGeneration) {
      throw createRuntimeError(
        'generation-failed',
        'The test runtime accepts only one active generation.',
        true,
      );
    }

    const generation: ActiveGeneration = {
      operationId,
      cancelled: false,
    };
    this.activeGeneration = generation;

    try {
      this.configuredFailure('generation');

      for (const [chunkIndex, chunk] of this.responseChunks.entries()) {
        await this.scheduler.waitForChunk(generation.operationId, chunkIndex);
        if (
          generation.cancelled
          || this.activeGeneration?.operationId !== generation.operationId
        ) {
          if (this.emitLateChunkAfterCancellation) handlers.onText(chunk);
          break;
        }
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
    if (this.recordResourceLifecycle && this.activeGeneration === null) return;
    this.record('cancel');
    if (this.activeGeneration) {
      this.activeGeneration.cancelled = true;
    }
  }

  async reset(): Promise<void> {
    if (this.recordResourceLifecycle) {
      if (this.hasConversation) this.record('conversation.delete');
    } else {
      this.record('reset');
    }
    this.invalidateActiveGeneration();
    this.configuredFailure('reset');
    this.hasConversation = false;
  }

  async unload(): Promise<void> {
    if (!this.recordResourceLifecycle) this.record('unload');
    this.invalidateActiveGeneration();
    const operationId = this.calls.at(-1)?.operationId ?? 0;
    await this.scheduler.waitForUnload?.(operationId);
    if (this.recordResourceLifecycle && this.hasEngine) this.record('engine.delete');
    this.configuredFailure('unload');
    if (this.recordResourceLifecycle && this.hasEngine) this.record('sdk.unload');
    this.hasEngine = false;
    this.hasConversation = false;
  }
}
