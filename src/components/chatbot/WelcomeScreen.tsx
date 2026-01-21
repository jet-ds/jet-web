/**
 * WelcomeScreen Component - Chatbot Entry Point
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.7
 * Spec: Activation Boundary - No resources loaded until user clicks
 *
 * Displays welcome message and "Start Chat" button.
 * Only when user clicks does initialization begin.
 */

interface WelcomeScreenProps {
  onStartChat: () => void;
}

/**
 * WelcomeScreen - Pre-activation state
 *
 * Features:
 * - Welcome message explaining chatbot capabilities
 * - "Start Chat" button to trigger initialization
 * - No resource loading until user interaction
 */
export function WelcomeScreen({ onStartChat }: WelcomeScreenProps) {
  return (
    <div className="flex items-center justify-center min-h-[600px]">
      <div className="max-w-md text-center space-y-l">
        <div className="text-6xl mb-m">👻</div>
        <h1 className="text-3xl font-bold leading-tight text-text-primary">
          Jet's Ghost
        </h1>
        <p className="text-lg text-text-tertiary">
          Chat with my blog content using AI-powered semantic search
        </p>
        <ul className="text-left text-text-secondary space-y-s">
          <li className="flex items-start">
            <span className="mr-2">🔍</span>
            <span>Ask questions about blog posts, research papers, and projects</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">🤖</span>
            <span>Get answers grounded in actual content with source citations</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">⚡</span>
            <span>Powered by hybrid search (semantic + keyword matching)</span>
          </li>
        </ul>
        <button
          onClick={onStartChat}
          className="mt-l px-l py-m bg-brand-base text-brand-contrast rounded-lg hover:bg-brand-hover transition-colors font-semibold text-lg shadow-lg hover:shadow-xl"
        >
          Start Chat
        </button>
        <p className="text-sm text-text-tertiary mt-m">
          First load may take 10-30 seconds while the AI model downloads
        </p>
      </div>
    </div>
  );
}
