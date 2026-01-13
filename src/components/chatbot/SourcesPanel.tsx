/**
 * SourcesPanel Component - Source Attribution Display
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.7
 * Spec: Phase 4 - LLM Integration (UI Components)
 *
 * Displays retrieved chunks with relevance scores and links to source content.
 * Provides transparency and allows users to verify information.
 */

interface Source {
  title: string;
  url: string;
  score?: number; // RRF score (optional)
  section?: string; // Section within the page (optional)
}

interface SourcesPanelProps {
  sources: Source[];
}

/**
 * SourcesPanel - Displays attributed sources for assistant responses
 *
 * Features:
 * - Links to source content
 * - Relevance scores (if available)
 * - Section information (if available)
 * - Opens links in new tab with security attributes
 */
export function SourcesPanel({ sources }: SourcesPanelProps) {
  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <aside className="mt-4 rounded-lg border border-border-default bg-bg-subtle p-4">
      <h3 className="text-sm font-semibold text-text-secondary mb-3">
        Sources
      </h3>
      <ul className="space-y-2">
        {sources.map((source, idx) => (
          <li key={idx} className="text-sm">
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-base hover:underline font-medium"
            >
              {source.title}
              {source.section && (
                <span className="text-text-tertiary font-normal">
                  {' '}
                  → {source.section}
                </span>
              )}
            </a>
            {source.score !== undefined && (
              <span className="ml-2 text-xs text-text-tertiary">
                ({(source.score * 100).toFixed(0)}% relevance)
              </span>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
