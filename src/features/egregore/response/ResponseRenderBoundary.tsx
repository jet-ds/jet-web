import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ResponseRenderBoundaryProps {
  fallback: string;
  children: ReactNode;
}

interface ResponseRenderBoundaryState {
  failed: boolean;
}

export class ResponseRenderBoundary extends Component<
  ResponseRenderBoundaryProps,
  ResponseRenderBoundaryState
> {
  state: ResponseRenderBoundaryState = { failed: false };

  static getDerivedStateFromError(): ResponseRenderBoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // React reports render failures; this boundary keeps the conversation usable.
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <p
          data-testid="assistant-response-fallback"
          className="whitespace-pre-wrap leading-relaxed"
        >
          {this.props.fallback}
        </p>
      );
    }

    return this.props.children;
  }
}
