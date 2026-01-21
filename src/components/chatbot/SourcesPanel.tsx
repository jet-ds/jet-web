/**
 * SourcesPanel Component - Source Attribution Display
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.7
 * Spec: Phase 4 - LLM Integration (UI Components)
 *
 * Displays retrieved chunks with superscript citations and links to source content.
 * Provides transparency and allows users to verify information.
 */

interface Source {
  title: string;
  url: string;
  section?: string; // Section within the page (optional)
}

interface SourcesPanelProps {
  sources: Source[];
}

/**
 * Convert number to superscript representation
 * @param num - Number to convert (0-9)
 * @returns Superscript string (⁰-⁹)
 */
function getSuperscript(num: number): string {
  const superscripts = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
  return num.toString().split('').map(d => superscripts[parseInt(d)]).join('');
}

/**
 * SourcesPanel - Displays attributed sources for assistant responses
 *
 * Features:
 * - Superscript citations (¹, ², ³)
 * - Links to source content
 * - Section information (if available)
 * - Opens links in new tab with security attributes
 */
export function SourcesPanel({ sources }: SourcesPanelProps) {
  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <aside className="space-y-3xs">
      <h3 className="text-xs font-semibold text-text-secondary">
        Sources
      </h3>
      <div className="space-y-3xs">
        {sources.map((source, idx) => (
          <div key={idx} className="text-xs">
            <span className="text-brand-base font-semibold mr-2xs">
              {getSuperscript(idx + 1)}
            </span>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-base hover:underline"
            >
              {source.title}
              {source.section && (
                <span className="text-text-tertiary">
                  {' '}
                  → {source.section}
                </span>
              )}
            </a>
          </div>
        ))}
      </div>
    </aside>
  );
}
