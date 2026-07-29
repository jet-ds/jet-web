export const REAL_MODEL_MODES = [
  'qualification',
  'warm-resume',
  'smoke',
] as const;

export type RealModelMode = (typeof REAL_MODEL_MODES)[number];

export const QUALIFICATION_CASE_ORDER = [
  'recursive-convergence-claim',
  'who-is-jet',
  'what-does-jet-do',
  'digital-squad-timesheet',
  'claude-native-installation',
  'private-note-abstention',
] as const;

type QualificationActivationPath = 'cold-then-warm' | 'warm-only' | 'smoke';
type QualificationStoragePrecondition = 'fresh' | 'readable-committed-cache';
type QualificationCacheDisposition = 'preserve' | 'remove-after-unload';

export interface QualificationRunContract {
  mode: RealModelMode;
  activationPath: QualificationActivationPath;
  storagePrecondition: QualificationStoragePrecondition;
  cdpEndpoint?: string;
  cacheDisposition: QualificationCacheDisposition;
}

export interface QualificationRunInput {
  mode: string | undefined;
  cdpEndpoint?: string;
  removeDownloadedModel: boolean;
}

export interface AccumulatingConversationEvidence {
  conversationCreateCount: number;
  completedTurnCount: number;
  tokenCounts: readonly number[];
}

export interface UnloadLifecycleEvidence {
  deviceDestroyCount: number;
  deviceReferenceClearCount: number;
  runtimeUnloadCount: number;
}

export function localQualificationSpansRequired(
  externalBaseUrl: string | undefined,
): boolean {
  return externalBaseUrl === undefined;
}

function validatedCdpEndpoint(value: string | undefined): string | undefined {
  const endpoint = value?.trim();
  if (!endpoint) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error('CDP_ENDPOINT_INVALID');
  }
  if (
    !['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol) ||
    parsed.username !== '' ||
    parsed.password !== ''
  ) {
    throw new Error('CDP_ENDPOINT_INVALID');
  }
  return endpoint;
}

export function resolveQualificationRunContract(
  input: QualificationRunInput,
): QualificationRunContract {
  if (!REAL_MODEL_MODES.includes(input.mode as RealModelMode)) {
    throw new Error('UNKNOWN_REAL_MODEL_MODE');
  }

  const mode = input.mode as RealModelMode;
  const cdpEndpoint = validatedCdpEndpoint(input.cdpEndpoint);
  const cacheDisposition = input.removeDownloadedModel
    ? 'remove-after-unload'
    : 'preserve';

  if (mode === 'warm-resume') {
    if (cdpEndpoint === undefined) {
      throw new Error('WARM_RESUME_CDP_ENDPOINT_REQUIRED');
    }
    return {
      mode,
      activationPath: 'warm-only',
      storagePrecondition: 'readable-committed-cache',
      cdpEndpoint,
      cacheDisposition,
    };
  }

  if (cdpEndpoint !== undefined) {
    throw new Error('EXISTING_BROWSER_CONTEXT_NOT_ALLOWED');
  }

  return {
    mode,
    activationPath: mode === 'qualification' ? 'cold-then-warm' : 'smoke',
    storagePrecondition: 'fresh',
    cacheDisposition,
  };
}

export function orderQualificationCases<T extends { id: string }>(
  cases: readonly T[],
): T[] {
  const byId = new Map<string, T>();
  for (const visitorCase of cases) {
    if (byId.has(visitorCase.id)) {
      throw new Error('QUALIFICATION_CASE_DUPLICATE');
    }
    byId.set(visitorCase.id, visitorCase);
  }

  return QUALIFICATION_CASE_ORDER.map((id) => {
    const visitorCase = byId.get(id);
    if (visitorCase === undefined) {
      throw new Error('QUALIFICATION_CASE_MISSING');
    }
    return visitorCase;
  });
}

export function validateAccumulatingConversationEvidence(
  evidence: AccumulatingConversationEvidence,
): string[] {
  const failures: string[] = [];
  if (evidence.conversationCreateCount !== 1) {
    failures.push('CONVERSATION_CREATE_COUNT_INVALID');
  }
  if (evidence.tokenCounts.length !== evidence.completedTurnCount + 1) {
    failures.push('CONVERSATION_TOKEN_CHECKPOINT_COUNT_INVALID');
  }
  if (
    evidence.tokenCounts.some(
      (count) => !Number.isSafeInteger(count) || count < 0,
    )
  ) {
    failures.push('CONVERSATION_TOKEN_COUNT_INVALID');
  } else if (
    evidence.tokenCounts.some(
      (count, index) => index > 0 && count <= evidence.tokenCounts[index - 1]!,
    )
  ) {
    failures.push('CONVERSATION_TOKEN_COUNT_NOT_GROWING');
  }
  return failures;
}

export function validateUnloadLifecycleEvidence(
  evidence: UnloadLifecycleEvidence,
): string[] {
  const failures: string[] = [];
  if (evidence.deviceDestroyCount !== 1) {
    failures.push('WEBGPU_DEVICE_DESTROY_NOT_OBSERVED');
  }
  if (evidence.deviceReferenceClearCount !== 1) {
    failures.push('WEBGPU_DEVICE_REFERENCE_CLEAR_NOT_OBSERVED');
  }
  if (evidence.runtimeUnloadCount !== 1) {
    failures.push('RUNTIME_UNLOAD_COUNT_INVALID');
  }
  return failures;
}
