"use client";

interface NarrativeCardProps {
  title: string;
  summary: string;
  evidence: string[];
  confidence: number;
  generatedBy: "ai" | "heuristic";
  tick?: number;
}

export function NarrativeCard({
  title,
  summary,
  evidence,
  confidence,
  generatedBy,
  tick,
}: NarrativeCardProps) {
  return (
    <div className="narrative-card surface-elevated">
      <div className="narrative-header">
        <h3 className="narrative-title">{title}</h3>
        <div className="narrative-meta">
          {tick !== undefined && <span className="tag mono">T{tick}</span>}
          <span className={`tag ${generatedBy === "ai" ? "tag-ai" : ""}`}>
            {generatedBy === "ai" ? "🤖 AI" : "📊 Heuristic"}
          </span>
        </div>
      </div>

      <p className="narrative-summary">{summary}</p>

      {evidence.length > 0 && (
        <div className="narrative-evidence">
          <h4 className="narrative-evidence-title">Evidence</h4>
          <ul className="narrative-evidence-list">
            {evidence.map((item, i) => (
              <li key={`evidence-${title}-${i}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="narrative-confidence">
        <span>Confidence</span>
        <div className="progress-bar" style={{ flex: 1 }}>
          <div
            className="progress-bar-fill"
            style={{
              width: `${confidence * 100}%`,
              background:
                confidence > 0.7
                  ? "var(--status-running)"
                  : confidence > 0.4
                    ? "var(--status-paused)"
                    : "var(--status-error)",
            }}
          />
        </div>
        <span className="mono">{(confidence * 100).toFixed(0)}%</span>
      </div>

      <style jsx>{`
        .narrative-card {
          padding: var(--space-lg);
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
        }

        .narrative-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-md);
        }

        .narrative-title {
          font-size: 1rem;
          font-weight: 600;
        }

        .narrative-meta {
          display: flex;
          gap: 4px;
          flex-shrink: 0;
        }

        .narrative-summary {
          font-size: 0.875rem;
          line-height: 1.6;
          color: var(--text-secondary);
        }

        .narrative-evidence-title {
          font-size: 0.6875rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          margin-bottom: var(--space-xs);
        }

        .narrative-evidence-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .narrative-evidence-list li {
          font-size: 0.8125rem;
          color: var(--text-secondary);
          padding-left: var(--space-md);
          position: relative;
        }

        .narrative-evidence-list li::before {
          content: "→";
          position: absolute;
          left: 0;
          color: var(--accent-primary);
        }

        .narrative-confidence {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .tag-ai {
          background: rgba(99, 102, 241, 0.2);
          color: var(--accent-primary);
        }
      `}</style>
    </div>
  );
}
