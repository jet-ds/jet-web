export type EgregoreErrorCode =
  | 'insecure-context'
  | 'webgpu-unavailable'
  | 'adapter-unavailable'
  | 'storage-warning'
  | 'corpus-load-failed'
  | 'corpus-version-mismatch'
  | 'corpus-index-mismatch'
  | 'model-load-failed'
  | 'generation-failed'
  | 'generation-cancelled'
  | 'question-too-long'
  | 'conversation-limit-reached'
  | 'context-budget-exceeded'
  | 'engine-cleanup-failed';

export interface EgregoreError {
  code: EgregoreErrorCode;
  message: string;
  recoverable: boolean;
  diagnosticCause?: string;
}
