import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  children: ReactNode;
  variant: 'dark' | 'light';
  title?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <FailureScreen variant={this.props.variant} title={this.props.title ?? 'Something went wrong'} message={this.state.error.message} />;
  }
}

export function FailureScreen({ variant, title, message }: { variant: 'dark' | 'light'; title: string; message: string }) {
  return (
    <div className={`failure failure--${variant}`} role="alert">
      <div className="failure__card">
        <h1>{title}</h1>
        <p>{message}</p>
        <div className="failure__actions">
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
          <Link to="/">Back to projects</Link>
        </div>
      </div>
    </div>
  );
}
