"use client";

import { useSimulationStore } from "@/lib/stores/simulation-store";
import { useState } from "react";
import { SettingsModal } from "./settings-modal";

interface ControlBarProps {
  onStep: () => void;
  onPlay: () => void;
  onPause: () => void;
  onFastForward: () => void;
  onCreateBranch: () => void;
}

export function ControlBar({
  onStep,
  onPlay,
  onPause,
  onFastForward,
  onCreateBranch,
}: ControlBarProps) {
  const { status, worldState, projectId, branchId, setShowProjections, showProjections, setProjections } = useSimulationStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const tick = worldState?.tick ?? 0;
  const aliveCount = worldState?.agents.filter((a) => a.status === "alive").length ?? 0;

  const handleToggleProjections = async () => {
    const nextShow = !showProjections;
    setShowProjections(nextShow);
    
    if (nextShow && branchId) {
      try {
        const apiKey = localStorage.getItem("sim-api-key");
        const provider = localStorage.getItem("sim-provider") || "groq";
        const model = localStorage.getItem("sim-model") || "llama3-70b-8192";
        
        const aiSettings = apiKey ? { provider, apiKey, model } : undefined;

        const res = await fetch(`/api/sim/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branchId, ticks: 5, aiSettings }),
        });
        
        if (!res.ok) {
          throw new Error(`Error: ${res.statusText}`);
        }
        
        const data = await res.json();
        if (data.projections) {
          setProjections(data.projections);
        }
      } catch (err) {
        console.error("Failed to fetch projections:", err);
      }
    }
  };

  return (
    <div className="control-bar" style={{ gridArea: "control" }}>
      <div className="control-bar-left">
        <a href="/" className="control-logo">
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <circle cx="16" cy="16" r="14" stroke="var(--accent-primary)" strokeWidth="2" />
            <circle cx="16" cy="16" r="4" fill="var(--accent-primary)" />
          </svg>
          <span>Omniscient</span>
        </a>

        <div className="control-divider" />

        <div className="control-status">
          <span className="status-dot" data-status={status === "playing" ? "running" : status} />
          <span className="control-status-text">
            {status === "playing" ? "Running" : status === "paused" ? "Paused" : status === "stepping" ? "Stepping..." : "Ready"}
          </span>
        </div>
      </div>

      <div className="control-bar-center">
        <button
          className="btn btn-icon btn-sm"
          onClick={onStep}
          disabled={status === "playing" || status === "stepping"}
          title="Step (1 tick)"
          type="button"
          id="btn-step"
        >
          ⏭
        </button>
        {status === "playing" ? (
          <button className="btn btn-primary btn-sm" onClick={onPause} title="Pause" type="button" id="btn-pause">
            ⏸ Pause
          </button>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={onPlay} title="Play" type="button" id="btn-play">
            ▶ Play
          </button>
        )}
        <button
          className="btn btn-icon btn-sm"
          onClick={onFastForward}
          disabled={status === "playing"}
          title="Fast Forward (10 ticks)"
          type="button"
          id="btn-ff"
        >
          ⏩
        </button>

        <div className="control-divider" />

        <button className="btn btn-sm" onClick={onCreateBranch} title="Create Branch" type="button" id="btn-branch">
          🔀 Branch
        </button>

        <a href={`/compare?projectId=${projectId || "proj-demo"}`} className="btn btn-ghost btn-sm" title="Compare Branches" id="btn-compare-nav">
          ⚖️ Compare
        </a>

        <div className="control-divider" />

        <button 
          className={`btn btn-sm ${showProjections ? "btn-primary" : "btn-outline"}`}
          onClick={handleToggleProjections}
          title="Toggle Omni-Vision (Predict Future)"
          type="button"
          id="btn-omni-vision"
        >
          👁️ Omni-Vision
        </button>

        <div className="control-divider" />

        <button 
          className="btn btn-icon btn-sm" 
          onClick={() => setIsSettingsOpen(true)}
          title="Simulation Settings"
          type="button"
          id="btn-settings"
        >
          ⚙️
        </button>

        <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
        />
      </div>

      <div className="control-bar-right">
        <div className="control-metric">
          <span className="control-metric-label">Tick</span>
          <span className="control-metric-value mono">{tick}</span>
        </div>
        <div className="control-metric">
          <span className="control-metric-label">Agents</span>
          <span className="control-metric-value mono">{aliveCount}</span>
        </div>
      </div>

      <style jsx>{`
        .control-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-sm) var(--space-md);
          border-bottom: 1px solid var(--border-subtle);
          background: var(--bg-base);
          height: 48px;
          gap: var(--space-md);
        }

        .control-bar-left,
        .control-bar-center,
        .control-bar-right {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .control-logo {
          display: flex;
          align-items: center;
          gap: 6px;
          text-decoration: none;
          color: var(--text-primary);
          font-weight: 600;
          font-size: 0.875rem;
        }

        .control-divider {
          width: 1px;
          height: 20px;
          background: var(--border-default);
          margin: 0 var(--space-xs);
        }

        .control-status {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .control-status-text {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 500;
        }

        .control-metric {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 48px;
        }

        .control-metric-label {
          font-size: 0.625rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .control-metric-value {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}
