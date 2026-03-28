"use client";

import { useSimulationStore } from "@/lib/stores/simulation-store";
import { Globe, Users, TrendingUp, TrendingDown, Hourglass } from "lucide-react";
import { Modifier } from "@/lib/sim/types";

export function ScenarioPanel() {
  const { worldState, showProjections } = useSimulationStore();
  const modifiers = worldState?.activeModifiers ?? [];

  if (modifiers.length === 0 && !showProjections) return null;

  return (
    <div className="scenario-panel" style={{ gridArea: "scenarios" }}>
      <div className="panel-header">
        <Globe size={14} className="header-icon" />
        <h3>World Intelligence</h3>
        <span className="count-badge">{modifiers.length}</span>
      </div>

      <div className="modifier-list">
        {modifiers.map((mod) => (
          <div key={mod.id} className="modifier-card animate-slide-in">
            <div className="modifier-header">
              <span className="modifier-type" data-type={mod.type}>
                {mod.type === "global" ? "World Shock" : "Faction Buff"}
              </span>
              <div className="modifier-timer">
                <Hourglass size={12} />
                <span>{mod.remainingTicks}t</span>
              </div>
            </div>

            <h4 className="modifier-title">{mod.description}</h4>
            
            <div className="modifier-details">
              <div className="impact-badge">
                {mod.multiplier !== 1 ? (
                  <>
                    {mod.multiplier > 1 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    <span>{mod.multiplier.toFixed(1)}x {mod.field}</span>
                  </>
                ) : (
                  <>
                    {mod.offset > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    <span>{mod.offset > 0 ? "+" : ""}{mod.offset} {mod.field}</span>
                  </>
                )}
              </div>
            </div>

            <div className="progress-container">
              <div 
                className="progress-bar" 
                style={{ width: `${Math.min(100, (mod.remainingTicks / 15) * 100)}%` }} 
              />
            </div>
          </div>
        ))}

        {showProjections && (
          <div className="omni-vision-indicator animate-pulse-entry">
            <div className="pulse-dot" />
            <span>Omni-Vision Projected</span>
          </div>
        )}
      </div>

      <style jsx>{`
        .scenario-panel {
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(16px);
          border-left: 1px solid var(--border-subtle);
          padding: var(--space-md);
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
          overflow-y: auto;
          min-width: 260px;
          height: 100%;
        }

        .panel-header {
          display: flex;
          align-items: center;
          gap: var(--space-xs);
          padding-bottom: var(--space-sm);
          border-bottom: 1px solid var(--border-subtle);
        }

        .header-icon {
          color: var(--accent-primary);
        }

        h3 {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          margin: 0;
        }

        .count-badge {
          margin-left: auto;
          background: var(--accent-primary);
          color: white;
          font-size: 0.6rem;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 20px;
          box-shadow: 0 0 10px rgba(var(--accent-primary-rgb), 0.3);
        }

        .modifier-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
        }

        .modifier-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: var(--radius-lg);
          padding: var(--space-sm);
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
          transition: border-color 0.2s, transform 0.2s;
        }

        .modifier-card:hover {
          border-color: rgba(255, 255, 255, 0.1);
          transform: translateY(-1px);
        }

        .modifier-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modifier-type {
          font-size: 0.6rem;
          font-weight: 700;
          text-transform: uppercase;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .modifier-type[data-type="global"] {
          color: #fb7185;
          background: rgba(251, 113, 133, 0.1);
        }

        .modifier-type[data-type="faction"] {
          color: #38bdf8;
          background: rgba(56, 189, 248, 0.1);
        }

        .modifier-timer {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.6rem;
          font-weight: 600;
          color: var(--text-muted);
        }

        .modifier-title {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .impact-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.7rem;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-secondary);
          padding: 4px 8px;
          border-radius: 6px;
        }

        .progress-container {
          height: 2px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 2px;
          overflow: hidden;
          margin-top: 4px;
        }

        .progress-bar {
          height: 100%;
          background: var(--accent-primary);
          box-shadow: 0 0 8px var(--accent-primary);
        }

        .omni-vision-indicator {
          margin-top: var(--space-sm);
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: var(--radius-md);
          padding: var(--space-xs) var(--space-sm);
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.65rem;
          font-weight: 600;
          color: #a5b4fc;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .pulse-dot {
          width: 6px;
          height: 6px;
          background: #818cf8;
          border-radius: 50%;
          animation: pulse 2s infinite;
          box-shadow: 0 0 8px #818cf8;
        }

        @keyframes slide-in {
          0% { transform: translateX(20px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }

        .animate-slide-in {
          animation: slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes pulse-entry {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        .animate-pulse-entry {
          animation: pulse-entry 0.3s ease-out;
        }

        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(129, 140, 248, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(129, 140, 248, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(129, 140, 248, 0); }
        }
      `}</style>
    </div>
  );
}
