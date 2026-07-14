import { canonicalSerialize } from './corpus/canonical';
import { estimateTokens } from './corpus/segment';
import type { ChunkId, DocumentId, SectionId } from './corpus/types';

export interface SourcePayloadRecord {
  citationId: `S${number}`;
  documentId: DocumentId;
  sectionId: SectionId;
  chunkId: ChunkId;
  title: string;
  canonicalUrl: string;
  heading: string;
  text: string;
}

export interface MeasuredSourcePayloadItem {
  serialized: string;
  characters: number;
}

export interface SerializedSourcePayload {
  serialized: string;
  estimatedTokens: number;
}

function publicPayloadRecord(source: SourcePayloadRecord) {
  return {
    citationId: source.citationId,
    documentId: source.documentId,
    sectionId: source.sectionId,
    chunkId: source.chunkId,
    title: source.title,
    url: source.canonicalUrl,
    heading: source.heading,
    content: source.text,
  };
}

export function measureSourcePayloadItem(
  source: SourcePayloadRecord,
): MeasuredSourcePayloadItem {
  const serialized = canonicalSerialize(publicPayloadRecord(source));
  return { serialized, characters: serialized.length };
}

export function serializeSourcePayload(
  sources: readonly SourcePayloadRecord[],
): SerializedSourcePayload {
  const serialized = `[${sources
    .map((source) => measureSourcePayloadItem(source).serialized)
    .join(',')}]`;
  return { serialized, estimatedTokens: estimateTokens(serialized) };
}
