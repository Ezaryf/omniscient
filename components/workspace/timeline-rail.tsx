"use client";

import type { CausalityGraph, ProjectionArtifact, SimEvent, TimelineBranch } from "@/lib/sim/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSimulationStore } from "@/lib/stores/simulation-store";

interface TimelineRailProps {
  currentTick: number;
  events: SimEvent[];
  causalityGraph?: CausalityGraph | null;
  projections: ProjectionArtifact[];
  branches: TimelineBranch[];
  activeBranchId: string | null;
  onSelectBranch?: (branchId: string) => void;
  onForkFromEvent?: (eventId: string) => void;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  action: "#7f858d",
  conflict: "#d95252",
  negotiation: "#59b078",
  trade: "#a5abb2",
  alliance: "#7d8fa3",
  betrayal: "#b04b4b",
  natural_event: "#6c6179",
  injected: "#d6d6d6",
  reaction: "#a8a8a1",
  rule_change: "#d6d6d6",
  movement: "#8da2a7",
  front_advance: "#b1b5bb",
  travel: "#7d8fa3",
  supply: "#7b9573",
  collapse: "#d95252",
};

export function TimelineRail({
  currentTick,
  events,
  causalityGraph,
  projections,
  branches,
  activeBranchId,
  onSelectBranch,
  onForkFromEvent,
}: TimelineRailProps) {
  const { workspaceSettings } = useSimulationStore();
  const maxTick = Math.max(currentTick, 20);
  const tickMarks = Array.from({ length: maxTick + 1 }, (_, index) => index);
  const eventsByTick = new Map<number, SimEvent[]>();

  for (const event of events) {
    const bucket = eventsByTick.get(event.tick) ?? [];
    bucket.push(event);
    eventsByTick.set(event.tick, bucket);
  }

  const branchPoints = branches
    .filter((branch) => branch.id !== activeBranchId)
    .map((branch) => ({ branchId: branch.id, tick: branch.branchPointTick, name: branch.name }));
  const projectionLimit = workspaceSettings.timeline.projectionCards;
  const eventSize =
    workspaceSettings.timeline.eventScale === "sm"
      ? "h-2 w-2"
      : workspaceSettings.timeline.eventScale === "lg"
        ? "h-3 w-3"
        : "h-2.5 w-2.5";
  const timelinePadding = workspaceSettings.timeline.density === "compact" ? "px-3 py-3" : "px-4 py-4";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-dock)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-4 py-3">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-primary)]">Causal timeline</div>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            Scrub the live branch history, spot divergence points, and fork a what-if branch from the exact consequence that changed the world.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {branches.map((branch) => (
            <Button
              key={branch.id}
              variant={branch.id === activeBranchId ? "primary" : "ghost"}
              size="sm"
              onClick={() => onSelectBranch?.(branch.id)}
              type="button"
            >
              {branch.name}
            </Button>
          ))}
        </div>
      </div>

      <div className={`flex min-h-0 flex-1 flex-col gap-4 ${timelinePadding}`}>
        <ScrollArea className="min-h-[108px] flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)]">
          <div className="relative h-32 min-w-full px-4 py-4">
            {tickMarks.map((tick) => {
              const tickEvents = eventsByTick.get(tick) ?? [];
              const branchPoint = branchPoints.find((point) => point.tick === tick);
              const xPercent = (tick / maxTick) * 100;
              const isCurrent = tick === currentTick;

              return (
                <div key={tick} className="absolute inset-y-0 w-px" style={{ left: `${xPercent}%` }}>
                  <div className={`absolute bottom-4 w-px ${tick % 10 === 0 ? "h-5 bg-white/20" : "h-2 bg-white/10"}`} />
                  {tick % 10 === 0 ? (
                    <span className="absolute bottom-0 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      {tick}
                    </span>
                  ) : null}

                  {tickEvents.map((event, index) => (
                    <button
                      key={`${event.id}-${tick}-${index}`}
                      className={`absolute -translate-x-1/2 rounded-full border border-black/40 shadow-[0_0_0_4px_rgba(0,0,0,0.16)] transition-transform hover:scale-110 ${eventSize}`}
                      style={{
                        background: EVENT_TYPE_COLORS[event.type] ?? "rgba(255,255,255,0.4)",
                        bottom: `${26 + index * 12}px`,
                      }}
                      title={`${event.description}\nParents: ${(causalityGraph?.parentIdsByEventId[event.id] ?? []).length}\nChildren: ${(causalityGraph?.childIdsByEventId[event.id] ?? []).length}\nFork from this consequence`}
                      onClick={() => onForkFromEvent?.(event.id)}
                      type="button"
                    >
                      {(causalityGraph?.childIdsByEventId[event.id]?.length ?? 0) > 1 ? (
                        <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-white/80" />
                      ) : null}
                    </button>
                  ))}

                  {branchPoint ? (
                    <div className="absolute bottom-10 -translate-x-1/2 text-center">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">◆</div>
                      <div className="mt-1 max-w-24 text-[10px] leading-4 text-[var(--text-muted)]">{branchPoint.name}</div>
                    </div>
                  ) : null}

                  {isCurrent ? <div className="absolute inset-y-0 -translate-x-1/2 border-l border-white/30" /> : null}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {projections.slice(0, projectionLimit).map((projection) => (
            <div key={projection.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="text-sm font-semibold text-[var(--text-primary)]">{projection.title}</div>
                <Badge variant={projection.type === "prediction" ? "warning" : "default"}>{projection.type}</Badge>
              </div>
              <div className="text-sm leading-6 text-[var(--text-secondary)]">{projection.summary}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
