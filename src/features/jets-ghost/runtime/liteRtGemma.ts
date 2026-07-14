import {
  JETS_GHOST_CONTEXT,
  JETS_GHOST_MODEL,
  JETS_GHOST_PATHS,
} from '../config';
import { checkBrowserCapabilities } from './capabilities';
import {
  createRuntimeError,
  type CapabilityReport,
  type GenerationHandlers,
  type GenerationResult,
  type LoadOptions,
  type LocalModelRuntime,
  type ModelMessage,
  type RuntimeError,
} from './types';

type LiteRtModule = typeof import('@litert-lm/core');
type LiteRtModuleLoader = () => Promise<LiteRtModule>;
type LiteRtEngine = Awaited<ReturnType<LiteRtModule['Engine']['create']>>;
type LiteRtConversation = Awaited<ReturnType<LiteRtEngine['createConversation']>>;

type CleanupFailure = 'conversation' | 'engine' | 'runtime';

type CleanupRuntimeError = RuntimeError & {
  cleanupFailures: readonly CleanupFailure[];
};

interface LoadOperation {
  stopRequested: boolean;
}

function cleanupRuntimeError(
  failures: readonly CleanupFailure[],
): CleanupRuntimeError {
  const error = createRuntimeError(
    'engine-cleanup-failed',
    "Jet's Ghost could not fully release the local model runtime.",
    true,
    new Error('runtime-cleanup-failed'),
  ) as CleanupRuntimeError;
  error.cleanupFailures = Object.freeze([...failures]);
  return error;
}

function isRuntimeError(cause: unknown): cause is RuntimeError {
  return cause instanceof Error && cause.name === 'JetsGhostRuntimeError';
}

function isCleanupRuntimeError(cause: unknown): cause is CleanupRuntimeError {
  return isRuntimeError(cause)
    && cause.code === 'engine-cleanup-failed'
    && Array.isArray((cause as Partial<CleanupRuntimeError>).cleanupFailures);
}

export class LiteRtGemmaRuntime implements LocalModelRuntime {
  private liteRt: LiteRtModule | null = null;
  private engine: LiteRtEngine | null = null;
  private conversation: LiteRtConversation | null = null;
  private pendingConversationCleanup: LiteRtConversation | null = null;
  private pendingEngineCleanup: LiteRtEngine | null = null;
  private pendingRuntimeCleanup: LiteRtModule | null = null;
  private loadOperation: LoadOperation | null = null;
  private activeLoad: Promise<void> | null = null;
  private operationGeneration = 0;
  private activeGeneration: number | null = null;

  constructor(
    private readonly loadModule: LiteRtModuleLoader = () => import('@litert-lm/core'),
  ) {}

  checkCapabilities(): Promise<CapabilityReport> {
    return checkBrowserCapabilities();
  }

  async load(options: LoadOptions): Promise<void> {
    if (
      this.activeLoad
      || this.engine
      || this.liteRt
      || this.hasPendingCleanup()
    ) {
      throw createRuntimeError(
        'model-load-failed',
        "Jet's Ghost local model runtime is already loaded.",
        true,
      );
    }

    const operation: LoadOperation = { stopRequested: false };
    this.loadOperation = operation;
    const loading = this.performLoad(operation, options);
    this.activeLoad = loading;

    try {
      await loading;
    } finally {
      if (this.activeLoad === loading) this.activeLoad = null;
      if (this.loadOperation === operation) this.loadOperation = null;
    }
  }

  private async performLoad(
    operation: LoadOperation,
    options: LoadOptions,
  ): Promise<void> {
    let liteRt: LiteRtModule | null = null;
    let engine: LiteRtEngine | null = null;

    try {
      liteRt = await this.loadModule();
      if (operation.stopRequested) return;
      this.liteRt = liteRt;

      options.onPhase?.('runtime');
      await liteRt.loadLiteRtLm(JETS_GHOST_PATHS.liteRtWasm);
      if (operation.stopRequested) {
        this.liteRt = null;
        this.adoptPendingCleanup(null, liteRt);
        const failures = await this.cleanupPendingResources();
        if (failures.length > 0) throw cleanupRuntimeError(failures);
        return;
      }

      options.onPhase?.('model');
      engine = await liteRt.Engine.create({
        model: JETS_GHOST_MODEL.url,
        mainExecutorSettings: {
          maxNumTokens: JETS_GHOST_CONTEXT.maxContextTokens,
        },
      });
      if (operation.stopRequested) {
        this.liteRt = null;
        this.adoptPendingCleanup(engine, liteRt);
        const failures = await this.cleanupPendingResources();
        if (failures.length > 0) throw cleanupRuntimeError(failures);
        return;
      }

      this.engine = engine;
    } catch (cause) {
      if (isRuntimeError(cause)) throw cause;

      this.engine = null;
      this.liteRt = null;
      this.adoptPendingCleanup(engine, liteRt);
      const failures = await this.cleanupPendingResources();
      if (failures.length > 0) throw cleanupRuntimeError(failures);
      throw createRuntimeError(
        'model-load-failed',
        "Jet's Ghost could not load the local model.",
        true,
        cause,
      );
    }
  }

  async createSession(preface: ModelMessage[]): Promise<void> {
    const engine = this.engine;
    if (!engine) {
      throw createRuntimeError(
        'model-load-failed',
        "Jet's Ghost local model is not loaded.",
        true,
      );
    }

    this.invalidateGeneration();
    const previous = this.conversation;
    this.conversation = null;
    if (previous) this.pendingConversationCleanup = previous;
    const cleanupFailures = await this.cleanupPendingConversation();
    if (cleanupFailures.length > 0) {
      throw cleanupRuntimeError(cleanupFailures);
    }

    try {
      this.conversation = await engine.createConversation({
        preface: {
          messages: preface.map(({ role, content }) => ({ role, content })),
        },
        prefillPrefaceOnInit: true,
        sessionConfig: {
          maxOutputTokens: JETS_GHOST_CONTEXT.responseReserve,
        },
      });
    } catch (cause) {
      throw createRuntimeError(
        'generation-failed',
        "Jet's Ghost could not start the local conversation.",
        true,
        cause,
      );
    }
  }

  async generate(
    message: string,
    handlers: GenerationHandlers,
  ): Promise<GenerationResult> {
    const conversation = this.conversation;
    if (!conversation) {
      throw createRuntimeError(
        'generation-failed',
        "Jet's Ghost does not have an active conversation.",
        true,
      );
    }
    if (this.activeGeneration !== null) {
      throw createRuntimeError(
        'generation-failed',
        "Jet's Ghost accepts only one active generation.",
        true,
      );
    }

    const operationId = ++this.operationGeneration;
    this.activeGeneration = operationId;

    try {
      const stream = conversation.sendMessageStreaming({
        role: 'user',
        content: message,
      });

      generation: for await (const chunk of stream) {
        if (!this.isActiveGeneration(operationId)) break;

        if (typeof chunk.content === 'string') {
          handlers.onText(chunk.content);
          continue;
        }

        if (!Array.isArray(chunk.content)) continue;
        for (const part of chunk.content) {
          if (!this.isActiveGeneration(operationId)) break generation;
          if (part.type === 'text' && typeof part.text === 'string') {
            handlers.onText(part.text);
          }
        }
      }

      return {
        finishReason: this.isActiveGeneration(operationId)
          ? 'completed'
          : 'cancelled',
      };
    } catch (cause) {
      if (!this.isActiveGeneration(operationId)) {
        return { finishReason: 'cancelled' };
      }
      throw createRuntimeError(
        'generation-failed',
        "Jet's Ghost could not complete the response.",
        true,
        cause,
      );
    } finally {
      if (this.activeGeneration === operationId) {
        this.activeGeneration = null;
      }
    }
  }

  cancel(): void {
    if (this.loadOperation) this.loadOperation.stopRequested = true;
    this.conversation?.cancel();
    this.invalidateGeneration();
  }

  async reset(): Promise<void> {
    this.invalidateGeneration();
    const conversation = this.conversation;
    this.conversation = null;
    if (conversation) this.pendingConversationCleanup = conversation;

    const failures = await this.cleanupPendingConversation();
    if (failures.length > 0) throw cleanupRuntimeError(failures);
  }

  async unload(): Promise<void> {
    this.invalidateGeneration();
    if (this.loadOperation) this.loadOperation.stopRequested = true;

    const activeLoad = this.activeLoad;
    if (activeLoad) {
      try {
        await activeLoad;
      } catch (cause) {
        if (isCleanupRuntimeError(cause)) throw cause;
        // A model-load failure reports through load(); cleanup still continues here.
      }
    }

    if (this.conversation) {
      this.pendingConversationCleanup = this.conversation;
    }
    this.adoptPendingCleanup(this.engine, this.liteRt);
    this.conversation = null;
    this.engine = null;
    this.liteRt = null;

    const failures = await this.cleanupPendingResources();
    if (failures.length > 0) throw cleanupRuntimeError(failures);
  }

  private invalidateGeneration(): void {
    this.operationGeneration += 1;
    this.activeGeneration = null;
  }

  private isActiveGeneration(operationId: number): boolean {
    return this.activeGeneration === operationId
      && this.operationGeneration === operationId;
  }

  private hasPendingCleanup(): boolean {
    return this.pendingConversationCleanup !== null
      || this.pendingEngineCleanup !== null
      || this.pendingRuntimeCleanup !== null;
  }

  private adoptPendingCleanup(
    engine: LiteRtEngine | null,
    liteRt: LiteRtModule | null,
  ): void {
    if (engine) this.pendingEngineCleanup = engine;
    if (liteRt) this.pendingRuntimeCleanup = liteRt;
  }

  private async cleanupPendingConversation(): Promise<CleanupFailure[]> {
    const failures: CleanupFailure[] = [];
    const conversation = this.pendingConversationCleanup;

    if (conversation) {
      try {
        await conversation.delete();
        if (this.pendingConversationCleanup === conversation) {
          this.pendingConversationCleanup = null;
        }
      } catch {
        failures.push('conversation');
      }
    }

    return failures;
  }

  private async cleanupPendingResources(): Promise<CleanupFailure[]> {
    const failures = await this.cleanupPendingConversation();
    const engine = this.pendingEngineCleanup;

    if (engine) {
      try {
        await engine.delete();
        if (this.pendingEngineCleanup === engine) {
          this.pendingEngineCleanup = null;
        }
      } catch {
        failures.push('engine');
      }
    }

    const liteRt = this.pendingRuntimeCleanup;
    if (liteRt) {
      try {
        liteRt.unloadLiteRtLm();
        if (this.pendingRuntimeCleanup === liteRt) {
          this.pendingRuntimeCleanup = null;
        }
      } catch {
        failures.push('runtime');
      }
    }

    return failures;
  }
}
