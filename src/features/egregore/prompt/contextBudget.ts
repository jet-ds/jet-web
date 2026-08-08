import type { EgregoreError, EgregoreErrorCode } from '../errors';
import type { ContextBudget } from '../selection/types';
import { estimateTokens } from '../tokenEstimate';

export interface TurnPromptMeasurement {
  questionTokens: number;
  fixedTurnTokens: number;
}

export interface TurnContextBudgetInput {
  baseBudget: ContextBudget;
  conversationTokens: number;
  measurement: TurnPromptMeasurement;
}

type ContextBudgetError = Error & EgregoreError;

const MINIMUM_KNOWLEDGE_TOKENS = estimateTokens('[]');

function contextBudgetError(
  code: EgregoreErrorCode,
  message: string,
): ContextBudgetError {
  const error = new Error(message) as ContextBudgetError;
  error.name = 'EgregoreContextBudgetError';
  error.code = code;
  error.recoverable = true;
  error.diagnosticCause = code;
  return error;
}

export function deriveTurnContextBudget({
  baseBudget,
  conversationTokens,
  measurement,
}: TurnContextBudgetInput): ContextBudget {
  if (
    !Number.isFinite(conversationTokens) ||
    conversationTokens < 0 ||
    !Number.isFinite(measurement.questionTokens) ||
    measurement.questionTokens < 0 ||
    !Number.isFinite(measurement.fixedTurnTokens) ||
    measurement.fixedTurnTokens < 0
  ) {
    throw contextBudgetError(
      'context-budget-exceeded',
      'The local context measurement is invalid.',
    );
  }
  if (measurement.questionTokens > baseBudget.questionLimit) {
    throw contextBudgetError(
      'question-too-long',
      'The current question exceeds the local context allowance.',
    );
  }

  const remaining =
    baseBudget.maxContextTokens -
    conversationTokens -
    measurement.questionTokens -
    measurement.fixedTurnTokens -
    baseBudget.responseReserve -
    baseBudget.estimatorHeadroom;

  if (remaining < MINIMUM_KNOWLEDGE_TOKENS) {
    throw contextBudgetError(
      conversationTokens > 0
        ? 'conversation-limit-reached'
        : 'context-budget-exceeded',
      conversationTokens > 0
        ? 'The current session is full. Start a new session to continue.'
        : 'The next local turn exceeds the configured context allowance.',
    );
  }

  return {
    ...baseBudget,
    knowledgeLimit: Math.min(baseBudget.knowledgeLimit, remaining),
  };
}
