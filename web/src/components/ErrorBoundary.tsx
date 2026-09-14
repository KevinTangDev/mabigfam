import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Without this, a throw during render unmounts the whole app and leaves a
 * blank white page with no clue what happened — which is exactly how the
 * Tree view failed when two copies of React got installed. Showing the
 * message costs nothing and turns "it's broken" into something diagnosable.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the stack in the console for whoever opens dev tools.
    console.error("Render error:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mx-auto max-w-lg rounded-xl border border-ctp-red/40 bg-ctp-mantle p-6">
        <h2 className="text-lg font-semibold text-ctp-red">This page hit an error</h2>
        <p className="mt-2 text-sm text-ctp-subtext0">
          The rest of the app still works — use the navigation above to move on.
        </p>

        <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-ctp-crust/60 p-3 text-xs whitespace-pre-wrap text-ctp-peach">
          {error.message}
        </pre>

        <button
          onClick={() => this.setState({ error: null })}
          className="mt-4 cursor-pointer rounded-lg border border-ctp-surface1 bg-ctp-surface0
                     px-3 py-1.5 text-sm font-medium text-ctp-text transition hover:bg-ctp-surface1"
        >
          Try again
        </button>
      </div>
    );
  }
}
