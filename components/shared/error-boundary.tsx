"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-fallback">
          <div className="error-card glass-elevated">
            <h2>Simulation Engine Failure</h2>
            <p>
              The causal engine has encountered an irrecoverable state divergence. 
              The timeline may be corrupted.
            </p>
            <pre>{this.state.error?.message}</pre>
            <button 
              className="btn btn-primary"
              onClick={() => globalThis.location.reload()}
            >
              Reinitialize Context
            </button>
          </div>
          <style jsx>{`
            .error-boundary-fallback {
              height: 100vh;
              width: 100vw;
              display: flex;
              align-items: center;
              justify-content: center;
              background: var(--bg-page);
              color: var(--text-primary);
              padding: var(--space-xl);
            }
            .error-card {
              max-width: 480px;
              padding: var(--space-2xl);
              text-align: center;
              display: flex;
              flex-direction: column;
              gap: var(--space-lg);
              border: 1px solid var(--border-danger);
            }
            h2 { color: var(--status-critical); font-size: 1.5rem; }
            p { color: var(--text-secondary); line-height: 1.6; }
            pre {
              background: rgba(0,0,0,0.3);
              padding: var(--space-md);
              border-radius: var(--radius-md);
              font-size: 0.75rem;
              color: var(--text-muted);
              overflow-x: auto;
              text-align: left;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}
