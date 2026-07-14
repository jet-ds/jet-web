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
  private activeConversationCleanup: Promise<CleanupFailure[]> | null = null;
  private activeResourceCleanup: Promise<CleanupFailure[]> | null = null;
  private loadOperation: LoadOperation | null = null;
  private activeLoad: Promise<void> | null = null;
  private sessionCreationEpoch = 0;
  private activeSessionCreation: Promise<void> | null = null;
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
    if (this.activeSessionCreation) {
      throw createRuntimeError(
        'generation-failed',
        "Jet's Ghost accepts only one active session creation.",
        true,
      );
    }

    const epoch = ++this.sessionCreationEpoch;
    const creation = this.performSessionCreation(engine, preface, epoch);
    this.activeSessionCreation = creation;

    try {
      await creation;
    } finally {
      if (this.activeSessionCreation === creation) {
        this.activeSessionCreation = null;
      }
    }
  }

  private async performSessionCreation(
    engine: LiteRtEngine,
    preface: ModelMessage[],
    epoch: number,
  ): Promise<void> {
    this.invalidateGeneration();
    const previous = this.conversation;
    this.conversation = null;
    if (previous) this.pendingConversationCleanup = previous;
    const cleanupFailures = await this.cleanupPendingConversation();
    if (cleanupFailures.length > 0) {
      throw cleanupRuntimeError(cleanupFailures);
    }
    if (!this.isSessionCreationActive(epoch, engine)) return;

    let created: LiteRtConversation;
    try {
      created = await engine.createConversation({
        preface: {
          messages: preface.map(({ role, content }) => ({ role, content })),
        },
        prefillPrefaceOnInit: true,
        sessionConfig: {
          maxOutputTokens: JETS_GHOST_CONTEXT.responseReserve,
        },
      });
    } catch (cause) {
      if (!this.isSessionCreationActive(epoch, engine)) return;
      throw createRuntimeError(
        'generation-failed',
        "Jet's Ghost could not start the local conversation.",
        true,
        cause,
      );
    }

    if (!this.isSessionCreationActive(epoch, engine)) {
      this.pendingConversationCleanup = created;
      const staleCleanupFailures = await this.cleanupPendingConversation();
      if (staleCleanupFailures.length > 0) {
        throw cleanupRuntimeError(staleCleanupFailures);
      }
      return;
    }

    this.conversation = created;
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
    this.invalidateGeneration();
    this.invalidateSessionCreation();
    if (this.loadOperation) this.loadOperation.stopRequested = true;
    this.cancelConversation(this.conversation);
  }

  async reset(): Promise<void> {
    this.invalidateGeneration();
    this.invalidateSessionCreation();
    const conversation = this.conversation;
    this.conversation = null;
    this.cancelConversation(conversation);
    if (conversation) this.pendingConversationCleanup = conversation;

    await this.waitForActiveSessionCreation();

    const failures = await this.cleanupPendingConversation();
    if (failures.length > 0) throw cleanupRuntimeError(failures);
  }

  async unload(): Promise<void> {
    this.invalidateGeneration();
    this.invalidateSessionCreation();
    if (this.loadOperation) this.loadOperation.stopRequested = true;

    const conversation = this.conversation;
    this.conversation = null;
    this.cancelConversation(conversation);
    if (conversation) this.pendingConversationCleanup = conversation;

    const activeSessionCreation = this.activeSessionCreation;
    if (activeSessionCreation) {
      this.adoptPendingCleanup(this.engine, this.liteRt);
      this.engine = null;
      this.liteRt = null;
      try {
        await activeSessionCreation;
      } catch (cause) {
        if (isCleanupRuntimeError(cause)) throw cause;
      }
    }

    const activeLoad = this.activeLoad;
    if (activeLoad) {
      try {
        await activeLoad;
      } catch (cause) {
        if (isCleanupRuntimeError(cause)) throw cause;
        // A model-load failure reports through load(); cleanup still continues here.
      }
    }

    this.adoptPendingCleanup(this.engine, this.liteRt);
    this.engine = null;
    this.liteRt = null;

    const failures = await this.cleanupPendingResources();
    if (failures.length > 0) throw cleanupRuntimeError(failures);
  }

  private invalidateGeneration(): void {
    this.operationGeneration += 1;
    this.activeGeneration = null;
  }

  private invalidateSessionCreation(): void {
    this.sessionCreationEpoch += 1;
  }

  private isSessionCreationActive(
    epoch: number,
    engine: LiteRtEngine,
  ): boolean {
    return this.sessionCreationEpoch === epoch && this.engine === engine;
  }

  private cancelConversation(conversation: LiteRtConversation | null): void {
    if (!conversation) return;
    try {
      conversation.cancel();
    } catch {
      // The public cancellation contract is synchronous and content-free.
    }
  }

  private async waitForActiveSessionCreation(): Promise<void> {
    const creation = this.activeSessionCreation;
    if (!creation) return;

    try {
      await creation;
    } catch (cause) {
      if (isCleanupRuntimeError(cause)) throw cause;
    }
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
    if (this.activeConversationCleanup) {
      return this.activeConversationCleanup;
    }

    const cleanup = this.performPendingConversationCleanup();
    this.activeConversationCleanup = cleanup;
    try {
      return await cleanup;
    } finally {
      if (this.activeConversationCleanup === cleanup) {
        this.activeConversationCleanup = null;
      }
    }
  }

  private async performPendingConversationCleanup(): Promise<CleanupFailure[]> {
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
    if (this.activeResourceCleanup) return this.activeResourceCleanup;

    const cleanup = this.performPendingResourceCleanup();
    this.activeResourceCleanup = cleanup;
    try {
      return await cleanup;
    } finally {
      if (this.activeResourceCleanup === cleanup) {
        this.activeResourceCleanup = null;
      }
    }
  }

  private async performPendingResourceCleanup(): Promise<CleanupFailure[]> {
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
