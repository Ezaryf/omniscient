"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BranchDiff } from "@/components/compare/branch-diff";

function CompareContent() {
  const searchParams = useSearchParams();
  const branchA = searchParams.get("branchA");
  const branchB = searchParams.get("branchB");
  const projectId = searchParams.get("projectId") ?? "proj-demo";

  const [branches, setBranches] = useState<{ id: string; name: string; currentTick: number }[]>([]);
  const [selectedA, setSelectedA] = useState(branchA ?? "");
  const [selectedB, setSelectedB] = useState(branchB ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [diffData, setDiffData] = useState<{
    branchA: { id: string; name: string; tick: number };
    branchB: { id: string; name: string; tick: number };
    divergence: {
      commonAncestorTick: number;
      agentDiffs: [];
      branchAEvents: [];
      branchBEvents: [];
    };
  } | null>(null);

  useEffect(() => {
    fetch(`/api/branches?projectId=${projectId}`)
      .then((r) => r.json())
      .then((data) => setBranches(data.branches ?? []))
      .catch(console.error);
  }, [projectId]);

  const handleCompare = async () => {
    if (!selectedA || !selectedB || selectedA === selectedB) return;
    setIsLoading(true);

    try {
      const res = await fetch(`/api/compare?branchA=${selectedA}&branchB=${selectedB}`);
      const data = await res.json();
      setDiffData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="compare-page">
      <header className="compare-header">
        <a href="/" className="btn btn-ghost btn-sm">← Back</a>
        <h1>Branch Comparison</h1>
      </header>

      <div className="compare-controls surface-elevated">
        <div className="compare-select-group">
          <label htmlFor="branch-a">Branch A</label>
          <select
            id="branch-a"
            className="compare-select"
            value={selectedA}
            onChange={(e) => setSelectedA(e.target.value)}
          >
            <option value="">Select branch...</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name} (T{b.currentTick})</option>
            ))}
          </select>
        </div>

        <span className="compare-vs">vs</span>

        <div className="compare-select-group">
          <label htmlFor="branch-b">Branch B</label>
          <select
            id="branch-b"
            className="compare-select"
            value={selectedB}
            onChange={(e) => setSelectedB(e.target.value)}
          >
            <option value="">Select branch...</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name} (T{b.currentTick})</option>
            ))}
          </select>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleCompare}
          disabled={!selectedA || !selectedB || selectedA === selectedB}
          type="button"
          id="btn-compare"
        >
          Compare
        </button>
      </div>

      {isLoading && (
        <div className="compare-loading-overlay surface-elevated">
          <div className="compare-spinner" />
          <p>Replaying Timelines...</p>
        </div>
      )}

      {diffData && !isLoading && (
        <BranchDiff
          branchA={diffData.branchA}
          branchB={diffData.branchB}
          divergence={diffData.divergence}
        />
      )}

      {!diffData && !isLoading && (
        branches.length < 2 ? (
          <div className="compare-empty surface-elevated">
            <p>Create at least 2 branches in the workspace to compare them.</p>
            <a href="/workspace" className="btn btn-primary">Go to Workspace</a>
          </div>
        ) : (
          <div className="compare-empty surface-elevated">
            <p>Select two branches and click Compare to view divergence.</p>
          </div>
        )
      )}

      <style jsx>{`
        .compare-page {
          max-width: 960px;
          margin: 0 auto;
          padding: var(--space-xl);
          display: flex;
          flex-direction: column;
          gap: var(--space-xl);
        }

        .compare-header {
          display: flex;
          align-items: center;
          gap: var(--space-md);
        }

        .compare-header h1 {
          font-size: 1.5rem;
        }

        .compare-controls {
          display: flex;
          align-items: flex-end;
          gap: var(--space-md);
          padding: var(--space-lg);
        }

        .compare-select-group {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
        }

        .compare-select-group label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
        }

        .compare-select {
          padding: var(--space-sm) var(--space-md);
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-family: var(--font-sans);
          font-size: 0.875rem;
        }

        .compare-vs {
          color: var(--text-muted);
          padding-bottom: var(--space-sm);
        }

        .compare-empty {
          padding: var(--space-2xl);
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-md);
        }

        .compare-loading-overlay {
          padding: var(--space-2xl);
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-md);
          color: var(--text-primary);
        }

        .compare-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--border-subtle);
          border-top-color: var(--accent-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, color: "var(--text-muted)" }}>Loading...</div>}>
      <CompareContent />
    </Suspense>
  );
}
