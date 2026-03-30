"use client";

import { Blocks, Pin, Siren, Trash2, Waves } from "lucide-react";
import type { CampaignNode, GmNote, ProjectionArtifact } from "@/lib/sim/types";
import { useSimulationStore } from "@/lib/stores/simulation-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DockPanel, PanelHeader } from "@/components/ui/dock-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ScenarioPanelProps {
  branchName?: string | null;
  tick?: number;
  campaignNodes: CampaignNode[];
  selectedNodeId?: string | null;
  onAdvanceFront: (frontId: string, delta: number, rationale: string) => void;
  onAcknowledgeProjection: (projectionId: string, note: string) => void;
  onSelectNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onGenerateNarrative?: () => void;
}

export function ScenarioPanel({
  branchName,
  tick,
  campaignNodes,
  selectedNodeId,
  onAdvanceFront,
  onAcknowledgeProjection,
  onSelectNode,
  onDeleteNode,
  onGenerateNarrative,
}: ScenarioPanelProps) {
  const { worldState, showProjections } = useSimulationStore();
  const fronts = worldState?.fronts ?? [];
  const projections = (worldState?.projections ?? []) as ProjectionArtifact[];
  const notes = (worldState?.gmNotes ?? []) as GmNote[];

  return (
    <DockPanel className="flex flex-col bg-[var(--bg-dock)]">
      <PanelHeader
        title="World intelligence"
        description="Map-first signal rail for strategic pressure, explainable fallout, and prep-ready context. Selected-object detail lives in the Context Inspector on the right."
        action={
          <div className="flex items-center gap-2">
            {branchName ? <Badge variant="accent">{branchName}</Badge> : null}
            <Badge variant="default">T{tick ?? 0}</Badge>
            <Badge variant="default">{fronts.length + projections.length + notes.length} signals</Badge>
          </div>
        }
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-4">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Blocks className="h-4 w-4 text-[var(--text-secondary)]" />
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-primary)]">Node library</h3>
              </div>
              <Badge variant="default">{campaignNodes.length}</Badge>
            </div>

            {campaignNodes.length === 0 ? (
              <EmptyState
                title="No nodes on the board yet"
                copy="Create actors, factions, places, fronts, and events on the canvas to manage them here."
              />
            ) : (
              <div className="space-y-2">
                {campaignNodes.map((node) => (
                  <div
                    key={node.id}
                    className={`flex items-center gap-2 rounded-lg border p-3 transition ${
                      selectedNodeId === node.id
                        ? "border-[var(--border-strong)] bg-[var(--bg-elevated)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-panel)]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectNode(node.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{node.name}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        {node.kind}
                      </div>
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => onDeleteNode(node.id)}
                      className="h-8 w-8 shrink-0 px-0 text-[var(--text-secondary)] hover:text-[var(--status-danger)]"
                      aria-label={`Delete ${node.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

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
              <div className="flex items-center gap-2">
                <Badge>{notes.length}</Badge>
                {onGenerateNarrative && (
                  <Button variant="outline" size="sm" onClick={onGenerateNarrative} type="button" className="h-6 px-2 text-xs">
                    Generate
                  </Button>
                )}
              </div>
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
