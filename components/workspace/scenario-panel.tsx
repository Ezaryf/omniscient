"use client";

import { Pin, Siren, Waves } from "lucide-react";
import type { GmNote, ProjectionArtifact } from "@/lib/sim/types";
import { useSimulationStore } from "@/lib/stores/simulation-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DockPanel, PanelHeader } from "@/components/ui/dock-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ScenarioPanelProps {
  onAdvanceFront: (frontId: string, delta: number, rationale: string) => void;
  onAcknowledgeProjection: (projectionId: string, note: string) => void;
}

export function ScenarioPanel({
  onAdvanceFront,
  onAcknowledgeProjection,
}: ScenarioPanelProps) {
  const { worldState, showProjections } = useSimulationStore();
  const fronts = worldState?.fronts ?? [];
  const projections = (worldState?.projections ?? []) as ProjectionArtifact[];
  const notes = (worldState?.gmNotes ?? []) as GmNote[];

  return (
    <DockPanel className="flex flex-col bg-[var(--bg-dock)]">
      <PanelHeader
        title="World intelligence"
        description="Left signal rail: campaign pressure, prep signals, and GM notes. Selected-object detail lives in the Context Inspector on the right."
        action={<Badge variant="default">{fronts.length + projections.length + notes.length} signals</Badge>}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-4">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Siren className="h-4 w-4 text-[var(--text-secondary)]" />
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-primary)]">Fronts</h3>
              </div>
              <Badge variant="warning">{fronts.length}</Badge>
            </div>

            {fronts.length === 0 ? (
              <EmptyState
                title="No active fronts yet"
                copy="Approve the guided setup to place the first pressure lines on the map."
              />
            ) : (
              <div className="space-y-3">
                {fronts.map((front) => (
                  <div key={front.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold tracking-[-0.03em]">{front.name}</div>
                        <div className="mt-1 text-sm text-[var(--text-secondary)]">{front.stakes}</div>
                      </div>
                      <Badge variant={front.status === "rising" ? "warning" : "default"}>{front.status}</Badge>
                    </div>

                    <div className="space-y-3">
                      <MetricRow label="Progress" value={front.progress} tone="bg-[#d95252]" />
                      <MetricRow label="Pressure" value={front.pressure} tone="bg-[#8d959d]" />
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAdvanceFront(front.id, -0.12, "GM cooled this front for the next session.")}
                        type="button"
                      >
                        Ease
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onAdvanceFront(front.id, 0.12, "GM escalated this front for stronger pressure.")}
                        type="button"
                      >
                        Escalate
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Waves className="h-4 w-4 text-[var(--text-secondary)]" />
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-primary)]">Prep signals</h3>
              </div>
              <Badge variant={showProjections ? "accent" : "default"}>{projections.length}</Badge>
            </div>

            {projections.length === 0 ? (
              <EmptyState
                title="Prep signals will appear here"
                copy="Once the first consequence lands, this rail will start surfacing risks, hot routes, and next-session fallout."
              />
            ) : (
              <div className="space-y-3">
                {projections.map((projection) => (
                  <div key={projection.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{projection.title}</div>
                      <Badge variant={projection.type === "prediction" ? "warning" : "default"}>{projection.type}</Badge>
                    </div>
                    <p className="text-sm leading-6 text-[var(--text-secondary)]">{projection.summary}</p>
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      <span>{Math.round(projection.confidence * 100)}% confidence</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAcknowledgeProjection(projection.id, projection.summary)}
                        type="button"
                      >
                        Pin to prep
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pin className="h-4 w-4 text-[var(--text-secondary)]" />
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-primary)]">GM notes</h3>
              </div>
              <Badge>{notes.length}</Badge>
            </div>

            {notes.length === 0 ? (
              <EmptyState
                title="Pin campaign intent first"
                copy="The onboarding sidecar will generate the premise, factions, and opening rupture before session prep starts piling up here."
              />
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4">
                    <div className="mb-2 text-sm font-semibold text-[var(--text-primary)]">{note.title}</div>
                    <p className="text-sm leading-6 text-[var(--text-secondary)]">{note.content}</p>
                    <div className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      Tick {note.tick} · {note.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </ScrollArea>
    </DockPanel>
  );
}

function MetricRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        <span>{label}</span>
        <span>{Math.round(value * 100)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/6">
        <div className={`h-1.5 rounded-full ${tone}`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}
