"use client";

import type { SimEvent, TimelineBranch } from "@/lib/sim/types";

interface TimelineRailProps {
  currentTick: number;
  events: SimEvent[];
  branches: TimelineBranch[];
  activeBranchId: string | null;
  onScrubToTick?: (tick: number) => void;
  onSelectBranch?: (branchId: string) => void;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  action: "var(--event-action)",
  conflict: "var(--event-conflict)",
  negotiation: "var(--event-negotiation)",
  trade: "var(--event-trade)",
  alliance: "var(--event-alliance)",
  betrayal: "var(--event-betrayal)",
  natural_event: "var(--event-natural)",
  injected: "var(--event-injected)",
  reaction: "var(--event-action)",
  rule_change: "var(--event-injected)",
};

export function TimelineRail({
  currentTick,
  events,
  branches,
  activeBranchId,
  onSelectBranch,
}: TimelineRailProps) {
  const maxTick = Math.max(currentTick, 20);
  const tickMarks = Array.from({ length: maxTick + 1 }, (_, i) => i);

  // Group events by tick for density visualization
  const eventsByTick = new Map<number, SimEvent[]>();
  for (const event of events) {
    const existing = eventsByTick.get(event.tick) ?? [];
    existing.push(event);
    eventsByTick.set(event.tick, existing);
  }

  // Branch points
  const branchPoints = branches
    .filter((b) => b.id !== activeBranchId)
    .map((b) => ({ branchId: b.id, tick: b.branchPointTick, name: b.name }));

  return (
    <div className="timeline-rail" style={{ gridArea: "timeline" }}>
      <div className="timeline-header">
        <h4 className="timeline-title">Timeline</h4>
        <div className="timeline-branches">
          {branches.map((branch) => (
            <button
              key={branch.id}
              className={`btn btn-sm ${branch.id === activeBranchId ? "btn-primary" : "btn-ghost"}`}
              onClick={() => onSelectBranch?.(branch.id)}
              type="button"
            >
              {branch.name}
            </button>
          ))}
        </div>
      </div>

      <div className="timeline-track">
        <div className="timeline-scroll">
          {/* Tick marks */}
          {tickMarks.map((t) => {
            const isCurrent = t === currentTick;
            const tickEvents = eventsByTick.get(t) ?? [];
            const branchPoint = branchPoints.find((bp) => bp.tick === t);
            const xPercent = (t / maxTick) * 100;

            return (
              <div
                key={t}
                className="timeline-tick"
                style={{ left: `${xPercent}%` }}
              >
                {/* Tick line */}
                <div
                  className={`timeline-tick-line ${t % 10 === 0 ? "major" : ""}`}
                />

                {/* Tick label (every 10) */}
                {t % 10 === 0 && (
                  <span className="timeline-tick-label mono">{t}</span>
                )}

                {/* Event dots */}
                {tickEvents.map((evt, i) => (
                  <div
                    key={evt.id}
                    className="timeline-event-dot"
                    style={{
                      background: EVENT_TYPE_COLORS[evt.type] ?? "var(--text-muted)",
                      bottom: `${20 + i * 6}px`,
                    }}
                    title={evt.description}
                  />
                ))}

                {/* Branch point marker */}
                {branchPoint && (
                  <div className="timeline-branch-marker" title={branchPoint.name}>
                    ◆
                  </div>
                )}

                {/* Current tick indicator */}
                {isCurrent && (
                  <div className="timeline-current-indicator" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .timeline-rail {
          border-top: 1px solid var(--border-subtle);
          padding: var(--space-sm) var(--space-md);
          background: var(--bg-base);
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
          height: 100px;
        }

        .timeline-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .timeline-title {
          font-size: 0.6875rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
        }

        .timeline-branches {
          display: flex;
          gap: 4px;
        }

        .timeline-track {
          flex: 1;
          position: relative;
          overflow-x: auto;
          overflow-y: hidden;
        }

        .timeline-scroll {
          position: relative;
          height: 100%;
          min-width: 100%;
        }

        .timeline-tick {
          position: absolute;
          bottom: 0;
          height: 100%;
          width: 1px;
        }

        .timeline-tick-line {
          position: absolute;
          bottom: 0;
          width: 1px;
          height: 8px;
          background: var(--border-default);
        }

        .timeline-tick-line.major {
          height: 14px;
          background: var(--border-strong);
        }

        .timeline-tick-label {
          position: absolute;
          bottom: 0;
          transform: translateX(-50%);
          font-size: 0.5625rem;
          color: var(--text-muted);
        }

        .timeline-event-dot {
          position: absolute;
          width: 5px;
          height: 5px;
          border-radius: var(--radius-full);
          transform: translateX(-50%);
        }

        .timeline-branch-marker {
          position: absolute;
          bottom: 16px;
          transform: translateX(-50%);
          color: var(--status-branch);
          font-size: 10px;
        }

        .timeline-current-indicator {
          position: absolute;
          bottom: 0;
          width: 2px;
          height: 100%;
          background: var(--accent-primary);
          transform: translateX(-50%);
          box-shadow: 0 0 8px var(--accent-glow);
        }
      `}</style>
    </div>
  );
}
