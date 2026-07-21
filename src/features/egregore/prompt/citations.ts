import type { SelectedSource } from '../selection/types';

export interface ValidCitation {
  id: `S${number}`;
  source: SelectedSource;
}

export function getCitedDocumentSources(
  citations: readonly ValidCitation[],
): ValidCitation[] {
  const seenCanonicalUrls = new Set<string>();

  return citations.filter(({ source }) => {
    if (seenCanonicalUrls.has(source.canonicalUrl)) return false;
    seenCanonicalUrls.add(source.canonicalUrl);
    return true;
  });
}

export function extractValidCitations(
  response: string,
  sources: SelectedSource[],
): ValidCitation[] {
  const selectedById = new Map(sources.map((source) => [source.citationId, source]));
  const seen = new Set<`S${number}`>();
  const citations: ValidCitation[] = [];

  for (const match of response.matchAll(/\[(S\d+)\]/g)) {
    const id = match[1] as `S${number}`;
    const source = selectedById.get(id);
    if (source === undefined || seen.has(id)) {
      continue;
    }
    seen.add(id);
    citations.push({ id, source });
  }

  return citations;
}
