import type { EgregoreError } from '../errors';
import type { ValidCitation } from '../prompt/citations';
import type { EgregoreLifecycleState } from '../runtime/lifecycle';
import type { CapabilityReport, RuntimeLoadPhase } from '../runtime/types';

export interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: ValidCitation[];
  stopped?: boolean;
}

export interface EgregoreState {
  lifecycle: EgregoreLifecycleState;
  capability: CapabilityReport | null;
  turns: ConversationTurn[];
  error: EgregoreError | null;
}

export interface EgregoreLoadingState {
  phase: 'corpus' | RuntimeLoadPhase;
  startedAt: number;
}
