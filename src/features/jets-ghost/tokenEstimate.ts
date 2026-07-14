export function estimateTokensFromCharacters(characters: number): number {
  return Math.ceil(characters / 4);
}

export function estimateTokens(text: string): number {
  return estimateTokensFromCharacters(text.length);
}
