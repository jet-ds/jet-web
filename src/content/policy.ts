export type PublicationStatus = 'draft' | 'published';

export interface PublicationData {
  status: PublicationStatus;
  assistant?: boolean;
}

export function isPublished(data: PublicationData): boolean {
  return data.status === 'published';
}

export function isAssistantEligible(data: PublicationData): boolean {
  return isPublished(data) && data.assistant === true;
}
