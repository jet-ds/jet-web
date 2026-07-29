import { describe, expect, it } from 'vitest';
import { deriveTurnContextBudget } from '../../../src/features/egregore/prompt/contextBudget';
import type { ContextBudget } from '../../../src/features/egregore/selection/types';

const BASE_BUDGET: ContextBudget = {
  maxContextTokens: 100,
  systemLimit: 20,
  questionLimit: 8,
  conversationLimit: 100,
  responseReserve: 20,
  knowledgeLimit: 60,
  estimatorHeadroom: 10,
};

const ORDINARY_MEASUREMENT = {
  questionTokens: 5,
  fixedTurnTokens: 7,
};

function expectErrorCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ code });
  }
}

describe('turn context budget', () => {
  it.each([
    ['no accumulated session', 0, 58],
    ['preface-only session', 12, 46],
    ['ordinary later turn', 20, 38],
  ] as const)(
    'subtracts actual tokens for a %s',
    (_label, conversationTokens, knowledgeLimit) => {
      expect(
        deriveTurnContextBudget({
          baseBudget: BASE_BUDGET,
          conversationTokens,
          measurement: ORDINARY_MEASUREMENT,
        }).knowledgeLimit,
      ).toBe(knowledgeLimit);
    },
  );

  it('allows the exact boundary required for an empty source array', () => {
    expect(
      deriveTurnContextBudget({
        baseBudget: BASE_BUDGET,
        conversationTokens: 57,
        measurement: ORDINARY_MEASUREMENT,
      }).knowledgeLimit,
    ).toBe(1);
  });

  it('requires a new session when the next complete turn cannot fit', () => {
    expectErrorCode(
      () =>
        deriveTurnContextBudget({
          baseBudget: BASE_BUDGET,
          conversationTokens: 58,
          measurement: ORDINARY_MEASUREMENT,
        }),
      'conversation-limit-reached',
    );
  });

  it('rejects the question before retrieval when it exceeds its allowance', () => {
    expectErrorCode(
      () =>
        deriveTurnContextBudget({
          baseBudget: BASE_BUDGET,
          conversationTokens: 0,
          measurement: {
            questionTokens: 9,
            fixedTurnTokens: 7,
          },
        }),
      'question-too-long',
    );
  });
});
