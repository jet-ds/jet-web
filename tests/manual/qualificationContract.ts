export function localQualificationSpansRequired(
  externalBaseUrl: string | undefined,
): boolean {
  return externalBaseUrl === undefined;
}

export function splitQualificationCases<T extends { id: string }>(
  cases: readonly T[],
  frozenId: string,
): { frozen: T; remainingWarm: T[] } {
  const frozen = cases.find((visitorCase) => visitorCase.id === frozenId);
  if (frozen === undefined)
    throw new Error('QUALIFICATION_INTERACTION_MISSING');
  return {
    frozen,
    remainingWarm: cases.filter((visitorCase) => visitorCase.id !== frozenId),
  };
}
