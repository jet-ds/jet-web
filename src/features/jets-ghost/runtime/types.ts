import type {
  JetsGhostError,
  JetsGhostErrorCode,
} from '../errors';

export interface CapabilityStorageEstimate {
  quotaBytes: number | null;
  usageBytes: number | null;
  availableBytes: number | null;
}

export interface CapabilityReport {
  supported: boolean;
  warnings: JetsGhostError[];
  failures: JetsGhostError[];
  secureContext: boolean;
  webGpuAvailable: boolean;
  adapterAvailable: boolean;
  storageEstimate: CapabilityStorageEstimate | null;
}

export type RuntimeLoadPhase = 'runtime' | 'model';

export interface LoadOptions {
  onPhase?: (phase: RuntimeLoadPhase) => void;
}

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerationHandlers {
  onText: (text: string) => void;
}

export interface GenerationResult {
  finishReason: 'completed' | 'cancelled';
}

export interface LocalModelRuntime {
  checkCapabilities(): Promise<CapabilityReport>;
  load(options: LoadOptions): Promise<void>;
  createSession(preface: ModelMessage[]): Promise<void>;
  generate(
    message: string,
    handlers: GenerationHandlers,
  ): Promise<GenerationResult>;
  cancel(): void;
  reset(): Promise<void>;
  unload(): Promise<void>;
}

export type RuntimeError = Error & JetsGhostError;

function safeDiagnosticCause(
  code: JetsGhostErrorCode,
  cause?: unknown,
): string {
  if (cause instanceof Error) {
    return cause.name || 'Error';
  }

  return cause === undefined ? code : typeof cause;
}

export function createRuntimeError(
  code: JetsGhostErrorCode,
  message: string,
  recoverable: boolean,
  cause?: unknown,
): RuntimeError {
  const error = new Error(message) as RuntimeError;
  error.name = 'JetsGhostRuntimeError';
  error.code = code;
  error.recoverable = recoverable;
  error.diagnosticCause = safeDiagnosticCause(code, cause);
  return error;
}
