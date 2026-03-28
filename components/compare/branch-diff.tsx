"use client";

import { useState, useEffect } from "react";
import type { AgentStateDiff } from "@/lib/sim/branch";
import type { SimEvent } from "@/lib/sim/types";

interface BranchDiffProps {
  branchA: { id: string; name: string; tick: number };
  branchB: { id: string; name: string; tick: number };
  divergence: {
    commonAncestorTick: number;
    agentDiffs: AgentStateDiff[];
    branchAEvents: SimEvent[];
    branchBEvents: SimEvent[];
  };
}

export function BranchDiff({ branchA, branchB, divergence }: BranchDiffProps) {
  return (
    <div className="branch-diff">
      {/* Header */}
      <div className="diff-header">
        <div className="diff-branch-label">
          <span className="status-dot" data-status="active" />
          <strong>{branchA.name}</strong>
          <span className="mono" style={{ color: "var(--text-muted)" }}>T{branchA.tick}</span>
        </div>
        <div className="diff-vs">vs</div>
        <div className="diff-branch-label">
          <span className="status-dot" data-status="branch-created" />
          <strong>{branchB.name}</strong>
          <span className="mono" style={{ color: "var(--text-muted)" }}>T{branchB.tick}</span>
        </div>
      </div>

      <div className="diff-ancestor">
        Common ancestor: Tick {divergence.commonAncestorTick}
      </div>

      {/* Agent state diffs */}
      {divergence.agentDiffs.length > 0 && (
        <div className="diff-section">
          <h4 className="diff-section-title">Agent Differences</h4>
          <div className="diff-agents">
            {divergence.agentDiffs.map((diff) => (
              <div key={diff.agentId} className="diff-agent surface">
                <h5>{diff.agentName}</h5>
                <div className="diff-fields">
                  {diff.diffs.map((d) => (
                    <div key={d.field} className="diff-field">
                      <span className="diff-field-name">{d.field}</span>
                      <span className="mono" style={{ color: "var(--text-secondary)" }}>
                        {d.valueA.toFixed(1)}
                      </span>
                      <span className="diff-arrow">→</span>
                      <span
                        className="mono"
                        style={{
                          color: d.delta > 0 ? "var(--rel-trust-positive)" : "var(--rel-trust-negative)",
                        }}
                      >
                        {d.valueB.toFixed(1)}
                        <small> ({d.delta > 0 ? "+" : ""}{d.delta.toFixed(1)})</small>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event timelines */}
      <div className="diff-events-grid">
        <div className="diff-section">
          <h4 className="diff-section-title">
            {branchA.name} Events ({divergence.branchAEvents.length})
          </h4>
          <div className="diff-event-list">
            {divergence.branchAEvents.slice(-15).map((evt) => (
              <div key={evt.id} className="diff-event">
                <span className="diff-event-tick mono">T{evt.tick}</span>
                <span className="diff-event-desc">{evt.description}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="diff-section">
          <h4 className="diff-section-title">
            {branchB.name} Events ({divergence.branchBEvents.length})
          </h4>
          <div className="diff-event-list">
            {divergence.branchBEvents.slice(-15).map((evt) => (
              <div key={evt.id} className="diff-event">
                <span className="diff-event-tick mono">T{evt.tick}</span>
                <span className="diff-event-desc">{evt.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .branch-diff {
          display: flex;
          flex-direction: column;
          gap: var(--space-lg);
        }

        .diff-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-xl);
        }

        .diff-branch-label {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .diff-vs {
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        .diff-ancestor {
          text-align: center;
          font-size: 0.8125rem;
          color: var(--text-muted);
          padding: var(--space-sm);
          background: var(--bg-surface);
          border-radius: var(--radius-md);
        }

        .diff-section-title {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          margin-bottom: var(--space-sm);
        }

        .diff-agents {
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
        }

        .diff-agent {
          padding: var(--space-md);
        }

        .diff-agent h5 {
          font-size: 0.875rem;
          margin-bottom: var(--space-sm);
        }

        .diff-fields {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .diff-field {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          font-size: 0.8125rem;
        }

        .diff-field-name {
          width: 80px;
          color: var(--text-secondary);
        }

        .diff-arrow {
          color: var(--text-muted);
        }

        .diff-events-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-md);
        }

        .diff-event-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .diff-event {
          display: flex;
          gap: var(--space-sm);
          font-size: 0.75rem;
          line-height: 1.4;
        }

        .diff-event-tick {
          color: var(--text-muted);
          flex-shrink: 0;
          font-size: 0.6875rem;
        }

        .diff-event-desc {
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}
