import type { JetsGhostError } from '../errors';
import type { ValidCitation } from '../prompt/citations';
import type { JetsGhostLifecycleState } from '../runtime/lifecycle';
import type { CapabilityReport, RuntimeLoadPhase } from '../runtime/types';
import type { SelectedSource } from '../selection/types';

export interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: ValidCitation[];
  sources: SelectedSource[];
  stopped?: boolean;
}

export interface JetsGhostState {
  lifecycle: JetsGhostLifecycleState;
  capability: CapabilityReport | null;
  turns: ConversationTurn[];
  error: JetsGhostError | null;
}

export interface JetsGhostLoadingState {
  phase: 'corpus' | RuntimeLoadPhase;
  startedAt: number;
}
