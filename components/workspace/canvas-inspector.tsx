"use client";

import type { CanvasBinding, WorldState } from "@/lib/sim/types";
import { DockPanel, PanelHeader } from "@/components/ui/dock-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

interface CanvasInspectorProps {
  readonly binding: CanvasBinding | null;
  readonly worldState: WorldState | null;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-sm leading-6 text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

export function CanvasInspector({ binding, worldState }: CanvasInspectorProps) {
  if (!binding || !worldState) {
    return (
      <DockPanel className="bg-[var(--bg-dock)]">
        <PanelHeader
          title="Canvas Inspector"
          description="Select a bound card on the freeform canvas to inspect linked campaign data."
        />
        <div className="p-4">
          <EmptyState
            title="Select a bound canvas node"
            copy="Agents, factions, regions, fronts, and events dropped from the world will resolve here."
          />
        </div>
      </DockPanel>
    );
  }

  let title = binding.entityId;
  let description = "";
  let details: Array<{ label: string; value: string }> = [];

  if (binding.entityType === "agent") {
    const agent = worldState.agents.find((candidate) => candidate.id === binding.entityId);
    if (agent) {
      title = agent.name;
      description = `${agent.type} · ${agent.factionId.replace(/^faction-/, "")}`;
      details = [
        { label: "Influence", value: `${Math.round(agent.state.influence)}` },
        { label: "Morale", value: `${Math.round(agent.state.morale * 100)}%` },
        { label: "Wealth", value: `${Math.round(agent.state.wealth)}` },
      ];
    }
  } else if (binding.entityType === "region") {
    const region = worldState.map.regions.find((candidate) => candidate.id === binding.entityId);
    if (region) {
      title = region.name;
      description = `${region.kind} region`;
      details = [
        { label: "Supply", value: `${Math.round(region.supply * 100)}%` },
        { label: "Stability", value: `${Math.round(region.stability * 100)}%` },
        { label: "Threat", value: `${Math.round(region.threat * 100)}%` },
      ];
    }
  } else if (binding.entityType === "site") {
    const site = worldState.map.sites.find((candidate) => candidate.id === binding.entityId);
    if (site) {
      title = site.name;
      description = `${site.kind} · ${site.status}`;
      details = [{ label: "Region", value: site.regionId }];
    }
  } else if (binding.entityType === "front") {
    const front = worldState.fronts.find((candidate) => candidate.id === binding.entityId);
    if (front) {
      title = front.name;
      description = `${front.status} front`;
      details = [
        { label: "Progress", value: `${Math.round(front.progress * 100)}%` },
        { label: "Pressure", value: `${Math.round(front.pressure * 100)}%` },
        { label: "Stakes", value: front.stakes },
      ];
    }
  } else if (binding.entityType === "event") {
    const event = worldState.events.find((candidate) => candidate.id === binding.entityId);
    if (event) {
      title = `Tick ${event.tick}`;
      description = event.type;
      details = [
        { label: "Description", value: event.description },
        { label: "Confidence", value: `${Math.round(event.confidence * 100)}%` },
      ];
    }
  } else if (binding.entityType === "faction") {
    const factionAgents = worldState.agents.filter((agent) => agent.factionId === binding.entityId);
    title = binding.entityId.replace(/^faction-/, "").replace(/-/g, " ");
    description = "Faction";
    details = [
      { label: "Actors", value: `${factionAgents.length}` },
      {
        label: "Members",
        value: factionAgents.length > 0 ? factionAgents.map((agent) => agent.name).join(", ") : "No tracked actors",
      },
    ];
  }

  return (
    <DockPanel className="bg-[var(--bg-dock)]">
      <PanelHeader
        title="Canvas Inspector"
        description="Linked campaign detail for the selected freeform node."
        action={<Badge variant="default">{binding.entityType}</Badge>}
      />
      <div className="space-y-4 p-4">
        <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4">
          <div className="text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{title}</div>
          <div className="mt-2 text-sm text-[var(--text-secondary)]">{description}</div>
        </section>
        {details.map((detail) => (
          <DetailRow key={detail.label} label={detail.label} value={detail.value} />
        ))}
      </div>
    </DockPanel>
  );
}
