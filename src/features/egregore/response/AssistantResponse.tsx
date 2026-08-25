import ReactMarkdown, {
  type Components,
  type UrlTransform,
} from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ReactElement } from 'react';
import type { PluggableList } from 'unified';

import type { ValidCitation } from '../prompt/citations';
import type { ConversationTurn } from '../state/types';
import { ResponseRenderBoundary } from './ResponseRenderBoundary';
import { remarkCitations } from './remarkCitations';

export interface AssistantResponseProps {
  turn: ConversationTurn;
}

const ALLOWED_ELEMENTS = [
  'p',
  'br',
  'em',
  'strong',
  'ol',
  'ul',
  'li',
  'blockquote',
  'code',
  'pre',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'a',
  'img',
  'span',
] as const;

type SafeDestination =
  { href: string; external: true } | { href: string; external: false };

function containsControlCharacter(value: string): boolean {
  const containsCodePoint = (
    candidate: string,
    includeSpace: boolean,
  ): boolean =>
    Array.from(candidate).some((character) => {
      const codePoint = character.codePointAt(0) ?? Infinity;
      return (
        codePoint <= (includeSpace ? 0x20 : 0x1f) ||
        (codePoint >= 0x7f && codePoint <= 0x9f)
      );
    });

  if (containsCodePoint(value, true)) return true;
  try {
    return containsCodePoint(decodeURIComponent(value), false);
  } catch {
    return true;
  }
}

function safeDestination(value: string | undefined): SafeDestination | null {
  if (value === undefined || containsControlCharacter(value)) {
    return null;
  }
  if (/^#[^\s#]+$/u.test(value)) return { href: value, external: false };

  if (/^mailto:/iu.test(value)) {
    try {
      const url = new URL(value);
      return url.pathname ? { href: value, external: false } : null;
    } catch {
      return null;
    }
  }

  if (/^https?:\/\//iu.test(value)) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      return { href: value, external: true };
    } catch {
      return null;
    }
  }

  return null;
}

const safeUrlTransform: UrlTransform = (value) => safeDestination(value)?.href;

function CitationLink({ citation }: { citation: ValidCitation }): ReactElement {
  const marker = `[${citation.id}]`;
  const destination = safeDestination(citation.source.canonicalUrl);
  if (destination === null) return <>{marker}</>;

  return (
    <a
      href={destination.href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-accent-text underline decoration-accent-base/50 underline-offset-2 hover:decoration-accent-base"
      aria-label={`${marker} ${citation.source.title}`}
    >
      {marker}
    </a>
  );
}

function responseComponents(
  citations: ReadonlyMap<string, ValidCitation>,
): Components {
  return {
    p: ({ children }) => (
      <p className="whitespace-pre-wrap leading-relaxed">{children}</p>
    ),
    br: () => <br />,
    em: ({ children }) => <em className="italic">{children}</em>,
    strong: ({ children }) => (
      <strong className="font-semibold">{children}</strong>
    ),
    ol: ({ children, start }) => (
      <ol start={start} className="ml-s list-decimal space-y-2xs pl-s">
        {children}
      </ol>
    ),
    ul: ({ children }) => (
      <ul className="ml-s list-disc space-y-2xs pl-s">{children}</ul>
    ),
    li: ({ children }) => <li className="pl-2xs">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-accent-base pl-s text-text-secondary">
        {children}
      </blockquote>
    ),
    code: ({ children, className }) => (
      <code
        className={`${className ?? ''} rounded-sm bg-bg-subtle px-1 py-0.5 font-mono text-[0.9em] text-code-block-text`}
      >
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre className="max-w-full overflow-x-auto rounded-lg bg-bg-subtle p-s leading-relaxed text-code-block-text">
        {children}
      </pre>
    ),
    h1: ({ children }) => (
      <h2 className="text-2xl font-bold leading-tight">{children}</h2>
    ),
    h2: ({ children }) => (
      <h3 className="text-xl font-bold leading-tight">{children}</h3>
    ),
    h3: ({ children }) => (
      <h4 className="text-lg font-semibold leading-tight">{children}</h4>
    ),
    h4: ({ children }) => (
      <h5 className="text-base font-semibold leading-tight">{children}</h5>
    ),
    h5: ({ children }) => (
      <h6 className="text-sm font-semibold leading-tight">{children}</h6>
    ),
    h6: ({ children }) => (
      <h6 className="text-sm font-semibold leading-tight">{children}</h6>
    ),
    a: ({ children, href }) => {
      const destination = safeDestination(href);
      if (destination === null) return <>{children}</>;
      return destination.external ? (
        <a
          href={destination.href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-text underline decoration-brand-base/50 underline-offset-2 hover:decoration-brand-base"
        >
          {children}
        </a>
      ) : (
        <a
          href={destination.href}
          className="font-medium text-brand-text underline decoration-brand-base/50 underline-offset-2 hover:decoration-brand-base"
        >
          {children}
        </a>
      );
    },
    img: ({ alt }) => <span>{alt ?? ''}</span>,
    span: ({ children, node }) => {
      const id = node?.properties['data-egregore-citation'];
      const citation = typeof id === 'string' ? citations.get(id) : undefined;
      return citation === undefined ? (
        <span>{children}</span>
      ) : (
        <CitationLink citation={citation} />
      );
    },
  };
}

function MarkdownResponse({ turn }: AssistantResponseProps): ReactElement {
  const citations = new Map(
    turn.citations.map((citation) => [citation.id, citation]),
  );
  const plugins: PluggableList = [
    remarkGfm,
    [remarkCitations, { citationIds: turn.citations.map(({ id }) => id) }],
  ];

  return (
    <div className="space-y-s leading-relaxed">
      <ReactMarkdown
        allowedElements={ALLOWED_ELEMENTS}
        components={responseComponents(citations)}
        remarkPlugins={plugins}
        unwrapDisallowed
        urlTransform={safeUrlTransform}
      >
        {turn.content}
      </ReactMarkdown>
    </div>
  );
}

export function AssistantResponse({
  turn,
}: AssistantResponseProps): ReactElement {
  return (
    <ResponseRenderBoundary fallback={turn.content}>
      <MarkdownResponse turn={turn} />
    </ResponseRenderBoundary>
  );
}
