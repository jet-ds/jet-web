import {
  isAssistantEligible,
  isPublished,
  type PublicationData,
  type PublicationStatus,
} from './policy';

export interface ContentValidationRecord {
  path: string;
  tracked: boolean;
  canonicalId: string;
  canonicalUrl: string;
  status: unknown;
  assistant: unknown;
  links: Array<{ label: string; url: unknown }>;
}

export interface ContentPolicyError {
  code:
    | 'missing-status'
    | 'unsupported-status'
    | 'invalid-assistant-flag'
    | 'assistant-not-published'
    | 'published-untracked'
    | 'invalid-canonical-url'
    | 'invalid-link-url'
    | 'duplicate-canonical-id'
    | 'duplicate-canonical-url'
    | 'generated-source-ineligible'
    | 'schema-invalid';
  path: string;
  message: string;
}

function normalizeCanonicalId(canonicalId: string): string {
  return canonicalId.normalize('NFC');
}

function normalizeHttpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function validStatus(value: unknown): value is PublicationStatus {
  return value === 'draft' || value === 'published';
}

function validatedPublication(record: ContentValidationRecord): PublicationData | undefined {
  if (
    !validStatus(record.status)
    || (record.assistant !== undefined && typeof record.assistant !== 'boolean')
  ) {
    return undefined;
  }
  return { status: record.status, assistant: record.assistant };
}

export function validateContentRecords(
  records: ContentValidationRecord[],
): ContentPolicyError[] {
  const errors: ContentPolicyError[] = [];
  const canonicalIds = new Map<string, string>();
  const canonicalUrls = new Map<string, string>();

  for (const record of records) {
    const statusIsValid = validStatus(record.status);
    const assistantIsValid = record.assistant === undefined
      || typeof record.assistant === 'boolean';

    if (record.status === undefined) {
      errors.push({
        code: 'missing-status',
        path: record.path,
        message: 'Content status is required.',
      });
    } else if (!statusIsValid) {
      errors.push({
        code: 'unsupported-status',
        path: record.path,
        message: `Unsupported content status: ${String(record.status)}.`,
      });
    }

    if (!assistantIsValid) {
      errors.push({
        code: 'invalid-assistant-flag',
        path: record.path,
        message: 'The assistant field must be a boolean when provided.',
      });
    }

    const normalizedId = normalizeCanonicalId(record.canonicalId);
    const previousIdPath = canonicalIds.get(normalizedId);
    if (previousIdPath !== undefined) {
      errors.push({
        code: 'duplicate-canonical-id',
        path: record.path,
        message: `Canonical ID duplicates ${previousIdPath}: ${record.canonicalId}.`,
      });
    } else {
      canonicalIds.set(normalizedId, record.path);
    }

    const normalizedUrl = normalizeHttpsUrl(record.canonicalUrl);
    if (normalizedUrl === undefined) {
      errors.push({
        code: 'invalid-canonical-url',
        path: record.path,
        message: `Canonical URL must be an absolute HTTPS URL: ${record.canonicalUrl}.`,
      });
    } else {
      const previousUrlPath = canonicalUrls.get(normalizedUrl);
      if (previousUrlPath !== undefined) {
        errors.push({
          code: 'duplicate-canonical-url',
          path: record.path,
          message: `Canonical URL duplicates ${previousUrlPath}: ${normalizedUrl}.`,
        });
      } else {
        canonicalUrls.set(normalizedUrl, record.path);
      }
    }

    if (!statusIsValid || !assistantIsValid) continue;

    const publication = validatedPublication(record);
    if (publication === undefined) continue;

    if (record.assistant === true && !isPublished(publication)) {
      errors.push({
        code: 'assistant-not-published',
        path: record.path,
        message: 'Assistant-enabled content must be published.',
      });
    }

    if (!isPublished(publication)) continue;

    if (!record.tracked) {
      errors.push({
        code: 'published-untracked',
        path: record.path,
        message: 'Published content must be tracked by Git.',
      });
    }

    for (const link of record.links) {
      if (normalizeHttpsUrl(link.url) === undefined) {
        errors.push({
          code: 'invalid-link-url',
          path: record.path,
          message: `${link.label} must use an absolute HTTPS URL: ${String(link.url)}.`,
        });
      }
    }
  }

  return errors;
}

export function assertGeneratedAssistantSources(
  records: ContentValidationRecord[],
  generatedCanonicalIds: readonly string[],
): ContentPolicyError[] {
  const recordsByCanonicalId = new Map(
    records.map((record) => [normalizeCanonicalId(record.canonicalId), record]),
  );

  return generatedCanonicalIds.flatMap((canonicalId) => {
    const record = recordsByCanonicalId.get(normalizeCanonicalId(canonicalId));
    if (record === undefined) {
      return [{
        code: 'generated-source-ineligible' as const,
        path: `generated:${canonicalId}`,
        message: `Generated assistant source does not match a content record: ${canonicalId}.`,
      }];
    }

    const publication = validatedPublication(record);
    if (
      !record.tracked
      || publication === undefined
      || !isAssistantEligible(publication)
    ) {
      return [{
        code: 'generated-source-ineligible' as const,
        path: record.path,
        message: `Generated assistant source is not eligible and tracked: ${canonicalId}.`,
      }];
    }

    return [];
  });
}
