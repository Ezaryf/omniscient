"use client";

import { Activity, Building2, ChevronRight, Map as MapIcon, Pin, Trash2, Users, Zap, Siren } from "lucide-react";
import type { CampaignNode, GmNote, ProjectionArtifact, FrontClock } from "@/lib/sim/types";
import { useSimulationStore } from "@/lib/stores/simulation-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/ui/empty-state";

interface ScenarioPanelProps {
  readonly branchName?: string | null;
  readonly tick?: number;
  readonly campaignNodes: readonly CampaignNode[];
  readonly selectedNodeId?: string | null;
  readonly onAdvanceFront: (frontId: string, delta: number, rationale: string) => void;
  readonly onAcknowledgeProjection: (projectionId: string, note: string) => void;
  readonly onSelectNode: (nodeId: string) => void;
  readonly onDeleteNode: (nodeId: string) => void;
  readonly onGenerateNarrative?: () => void;
}

/**
 * World Intelligence Panel (ScenarioPanel)
 * A premium, ultra-minimalist command center for tracking the simulation's state.
 * Emphasizes glassmorphism, monochrome with subtle tactical accents, and high-quality whitespace.
 */
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
  const worldState = useSimulationStore((state) => state.worldState);
  const fronts = worldState?.fronts ?? [];
  const projections = worldState?.projections ?? [];
  const notes = worldState?.gmNotes ?? [];

  return (
    <div className="flex h-full flex-col bg-slate-950/20 backdrop-blur-3xl">
      {/* Integrated Premium Header */}
      <div className="flex flex-col gap-1 p-6 pb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-(--text-primary) opacity-90">
            World Intelligence
          </h2>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
            <span className="font-mono text-[10px] font-bold tracking-widest text-(--text-muted)">LIVE</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-medium text-(--text-muted)">
          <span className="text-white/40">{branchName ?? "MAIN_SEQUENCE"}</span>
          <span className="h-1 w-1 rounded-full bg-white/10" />
          <span className="font-mono text-cyan-500/80">T{tick?.toString().padStart(3, "0") ?? "000"}</span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-10 p-6 pt-2">
          {/* HUD Tactical Summary */}
          <div className="flex items-stretch gap-px overflow-hidden rounded-xl border border-white/5 bg-white/2 shadow-2xl">
            <TacticalMetric label="ACTORS" value={worldState?.agents.length ?? 0} />
            <div className="w-px bg-white/5" />
            <TacticalMetric label="NODES" value={campaignNodes.length} />
            <div className="w-px bg-white/5" />
            <TacticalMetric label="THREATS" value={fronts.length} tone="text-orange-400" />
          </div>

          {/* Borderless Node Registry */}
          <section className="space-y-4">
            <header className="flex items-center justify-between px-1">
              <h3 className="text-[9px] font-black uppercase tracking-[0.25em] text-(--text-primary) opacity-30">Registry</h3>
              <span className="font-mono text-[10px] font-bold text-white/20">{campaignNodes.length.toString().padStart(2, "0")}</span>
            </header>

            {campaignNodes.length === 0 ? (
              <EmptyState
                title="Board is Clear"
                copy="Deploy entities from the canvas to monitor their lifecycle."
              />
            ) : (
              <div className="space-y-0.5">
                {campaignNodes.map((node) => (
                  <div
                    key={node.id}
                    className={`group relative flex items-center justify-between rounded-lg py-1.5 pl-3 pr-1 transition-all duration-300 ${
                      selectedNodeId === node.id 
                        ? "bg-white/5 shadow-sm" 
                        : "hover:bg-white/2"
                    }`}
                  >
                    {/* Selection Rail */}
                    {selectedNodeId === node.id && (
                      <div className="absolute left-0 top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                    )}

                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`flex h-6 w-6 items-center justify-center rounded border border-white/5 bg-white/2 transition-transform group-hover:scale-105 ${getNodeColorClass(node.kind)}`}>
                        <NodeIcon kind={node.kind} />
                      </div>
                      <button
                        onClick={() => onSelectNode(node.id)}
                        className={`truncate text-[13px] font-semibold tracking-tight transition-colors ${
                          selectedNodeId === node.id ? "text-white" : "text-(--text-secondary) group-hover:text-white"
                        }`}
                      >
                        {node.name}
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-md text-(--text-muted) opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                        onClick={() => onDeleteNode(node.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Fronts / Escalation Rail */}
          <section className="space-y-4">
            <header className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Siren className="h-3 w-3 text-orange-500 opacity-60" />
                <h3 className="text-[9px] font-black uppercase tracking-[0.25em] text-(--text-primary) opacity-30">Active Fronts</h3>
              </div>
            </header>

            {fronts.length === 0 ? (
              <EmptyState title="Sectors Quiet" copy="No active threats currently projected." />
            ) : (
              <div className="space-y-4">
                {fronts.map((front) => (
                  <div key={front.id} className="group rounded-xl border border-white/5 bg-white/2 p-4 transition-all hover:bg-white/4">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="text-[13px] font-bold tracking-tight text-white">{front.name}</div>
                        <div className="mt-1 line-clamp-1 text-[11px] text-(--text-muted)/80">{front.stakes}</div>
                      </div>
                      <Badge className="h-4.5 rounded px-1.5 text-[8px] font-black tracking-widest transition-colors group-hover:bg-orange-500 group-hover:text-white">
                        {front.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <DynamicProgress label="PROGRESS" value={front.progress} tone="bg-orange-500" />
                      <DynamicProgress label="PRESSURE" value={front.pressure} tone="bg-cyan-500" />
                    </div>

                    <div className="mt-5 flex gap-2">
                      <Button
                        variant="ghost" 
                        size="sm"
                        onClick={() => onAdvanceFront(front.id, -0.12, "GM neutralized front pressure.")}
                        className="h-7.5 flex-1 bg-white/2 text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-all"
                      >
                        Ease
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onAdvanceFront(front.id, 0.12, "GM escalated front tension.")}
                        className="h-7.5 flex-1 bg-white/5 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                      >
                        Escalate
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Intelligence Log / GM Workspace */}
          <section className="space-y-4">
            <header className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                 <Pin className="h-3 w-3 text-emerald-500 opacity-60" />
                 <h3 className="text-[9px] font-black uppercase tracking-[0.25em] text-(--text-primary) opacity-30">Intelligence Log</h3>
              </div>
              {onGenerateNarrative && (
                <Button variant="ghost" size="sm" onClick={onGenerateNarrative} className="h-5 px-1.5 text-[8px] font-black uppercase tracking-widest text-emerald-500 hover:bg-emerald-500/10">
                  REFRESH
                </Button>
              )}
            </header>

            <div className="space-y-3">
              {notes.length === 0 ? (
                <EmptyState title="Log Empty" copy="Synchronize with consequence engine." />
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="rounded-xl border border-white/5 bg-white/2 p-4 transition-all hover:border-white/10 hover:bg-white/4">
                    <div className="mb-1 text-[12px] font-bold text-white">{note.title}</div>
                    <p className="text-[11px] leading-relaxed text-(--text-secondary)">{note.content}</p>
                    <div className="mt-3 flex items-center justify-between border-t border-white/3 pt-2.5">
                       <span className="font-mono text-[9px] text-white/20">SEQ_{note.tick.toString().padStart(3, "0")}</span>
                       <span className={`text-[9px] font-bold uppercase tracking-widest ${note.status === "resolved" ? "text-emerald-500" : "text-white/30"}`}>
                        {note.status}
                       </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

function TacticalMetric({ label, value, tone = "text-(--text-primary)" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 px-2 py-3 transition-colors hover:bg-white/5">
      <span className="text-[18px] font-black transition-transform duration-500 group-hover:scale-110 font-mono tracking-tighter">
        {value.toString().padStart(2, "0")}
      </span>
      <span className={`text-[8px] font-black uppercase tracking-[0.2em] opacity-40 ${tone}`}>
        {label}
      </span>
    </div>
  );
}

function DynamicProgress({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between font-mono text-[9px] font-bold uppercase tracking-widest opacity-40">
        <span>{label}</span>
        <span>{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-1 rounded-full bg-white/5">
        <div 
          className={`h-full rounded-full transition-all duration-700 ease-out ${tone} shadow-[0_0_8px_rgba(255,255,255,0.1)]`} 
          style={{ width: `${value * 100}%` }} 
        />
      </div>
    </div>
  );
}

function getNodeColorClass(kind: string): string {
  switch (kind) {
    case "agent": return "text-cyan-400 group-hover:border-cyan-500/30";
    case "region": return "text-amber-400 group-hover:border-amber-500/30";
    case "site": return "text-emerald-400 group-hover:border-emerald-500/30";
    default: return "text-(--text-muted) group-hover:border-white/20";
  }
}

function NodeIcon({ kind }: { readonly kind: string }) {
  switch (kind) {
    case "agent": return <Users className="h-3 w-3" />;
    case "region": return <MapIcon className="h-3 w-3" />;
    case "site": return <Building2 className="h-3 w-3" />;
    default: return <ChevronRight className="h-3 w-3" />;
  }
}
