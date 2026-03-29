"use client";

import { Compass, Crosshair, ShieldAlert } from "lucide-react";
import type { Agent, FrontClock, MapLayer, RelationshipEdge, SimEvent } from "@/lib/sim/types";
import { Badge } from "@/components/ui/badge";
import { DockPanel, PanelHeader } from "@/components/ui/dock-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AgentInspectorProps {
  agent: Agent | null;
  relationships: RelationshipEdge[];
  recentEvents: SimEvent[];
  allAgents: Agent[];
  map: MapLayer;
  fronts: FrontClock[];
  explanation?: {
    title: string;
    summary: string;
    confidence: number;
    generatedBy: string;
  } | null;
}

export function AgentInspector({
  agent,
  relationships,
  recentEvents,
  allAgents,
  map,
  fronts,
  explanation,
}: AgentInspectorProps) {
  if (!agent) {
    return (
      <DockPanel className="bg-[var(--bg-dock)]">
        <PanelHeader
          title="Inspector"
          description="Select an actor on the map to inspect their goals, region, fronts, and recent causal chain."
        />
        <div className="p-4">
          <EmptyState
            title="Select an actor on the map"
            copy="The inspector will expand into campaign position, relationships, active fronts, and linked events."
          />
        </div>
      </DockPanel>
    );
  }

  const region =
    map.regions
      .slice()
      .sort((left, right) => {
        const leftDistance = Math.hypot(left.center.x - agent.position.x, left.center.y - agent.position.y);
        const rightDistance = Math.hypot(right.center.x - agent.position.x, right.center.y - agent.position.y);
        return leftDistance - rightDistance;
      })[0] ?? null;

  const site =
    map.sites
      .slice()
      .sort((left, right) => {
        const leftDistance = Math.hypot(left.position.x - agent.position.x, left.position.y - agent.position.y);
        const rightDistance = Math.hypot(right.position.x - agent.position.x, right.position.y - agent.position.y);
        return leftDistance - rightDistance;
      })[0] ?? null;

  const agentRelationships = relationships
    .filter((relationship) => relationship.sourceAgentId === agent.id || relationship.targetAgentId === agent.id)
    .map((relationship) => {
      const otherId =
        relationship.sourceAgentId === agent.id ? relationship.targetAgentId : relationship.sourceAgentId;
      const other = allAgents.find((candidate) => candidate.id === otherId);
      return { ...relationship, otherName: other?.name ?? otherId };
    });

  const agentEvents = recentEvents
    .filter((event) => event.sourceAgentId === agent.id || event.targetAgentId === agent.id)
    .slice(-8)
    .reverse();

  const relevantFronts = fronts.filter(
    (front) => front.factionId === agent.factionId || front.opposingFactionId === agent.factionId
  );

  return (
    <DockPanel className="flex flex-col bg-[var(--bg-dock)]">
      <PanelHeader
        title="Inspector"
        description="Actor detail, front exposure, relationship pressure, and local causal context."
        action={<Badge variant="accent">{agent.status}</Badge>}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-4">
          <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-lg font-semibold text-[var(--text-primary)]">
                {agent.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <h3 className="text-xl font-semibold tracking-[-0.04em]">{agent.name}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge>{agent.type}</Badge>
                  <Badge>{agent.factionId.replace("faction-", "")}</Badge>
                  <Badge variant={agent.status === "alive" ? "success" : "warning"}>{agent.status}</Badge>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle icon={Compass} label="Campaign position" />
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoTile label="Region" value={region?.name ?? "Unknown"} />
              <InfoTile label="Site" value={site?.name ?? "In the field"} />
              <InfoTile label="Influence" value={agent.state.influence.toFixed(0)} mono />
              <InfoTile label="Wealth" value={agent.state.wealth.toFixed(0)} mono />
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle icon={ShieldAlert} label="Vitals and goals" />
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4">
              <div className="space-y-3">
                <MetricRow label="Health" value={agent.state.health} tone="bg-[#59b078]" />
                <MetricRow label="Morale" value={agent.state.morale} tone="bg-[#8d959d]" />
              </div>
              <div className="mt-4 space-y-3">
                {agent.goals.map((goal) => (
                  <div key={goal.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{goal.label}</div>
                      <Badge variant={goal.status === "completed" ? "success" : "default"}>{goal.status}</Badge>
                    </div>
                    <MetricRow label="Progress" value={goal.progress} tone="bg-[#8d959d]" compact />
                    <div className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      Priority {Math.round(goal.priority * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle icon={Crosshair} label="Active fronts" />
            {relevantFronts.length === 0 ? (
              <EmptyState title="No fronts currently target this faction" copy="The current campaign pressure is elsewhere." />
            ) : (
              <div className="space-y-3">
                {relevantFronts.map((front) => (
                  <div key={front.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">{front.name}</div>
                      <Badge variant={front.status === "rising" ? "warning" : "default"}>{front.status}</Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      <MetricRow label="Progress" value={front.progress} tone="bg-[#d95252]" compact />
                      <MetricRow label="Pressure" value={front.pressure} tone="bg-[#8d959d]" compact />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <SectionTitle icon={Compass} label="Relationships" />
            {agentRelationships.length === 0 ? (
              <EmptyState title="No tracked relationships yet" copy="Once this actor collides with another force, trust and tension will appear here." />
            ) : (
              <div className="space-y-3">
                {agentRelationships.map((relationship) => (
                  <div key={relationship.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4">
                    <div className="mb-3 text-sm font-semibold">{relationship.otherName}</div>
                    <div className="space-y-2">
                      <MetricRow
                        label="Trust"
                        value={(relationship.trust + 1) / 2}
                        tone={relationship.trust > 0 ? "bg-[#59b078]" : "bg-[#d95252]"}
                        compact
                      />
                      <MetricRow label="Tension" value={relationship.tension} tone="bg-[#8d959d]" compact />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <SectionTitle icon={Compass} label="Recent causal chain" />
            {agentEvents.length === 0 ? (
              <EmptyState title="No linked events yet" copy="Once this actor drives or absorbs consequences, the local chain will appear here." />
            ) : (
              <div className="space-y-3">
                {agentEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4">
                    <div className="mb-2 text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Tick {event.tick}</div>
                    <div className="text-sm leading-6 text-[var(--text-primary)]">{event.description}</div>
                    {event.causedBy.length > 0 ? (
                      <div className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        Caused by {event.causedBy.length} prior event(s)
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          {explanation ? (
            <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4">
              <div className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Why this matters</div>
              <p className="text-sm leading-6 text-[var(--text-secondary)]">{explanation.summary}</p>
              <div className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Confidence {Math.round(explanation.confidence * 100)}%
              </div>
            </section>
          ) : null}
        </div>
      </ScrollArea>
    </DockPanel>
  );
}

function SectionTitle({
  icon: Icon,
  label,
}: {
  icon: typeof Compass;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-[var(--text-secondary)]" />
      <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-primary)]">{label}</div>
    </div>
  );
}

function InfoTile({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</div>
      <div className={`mt-2 text-base font-semibold text-[var(--text-primary)] ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  tone,
  compact = false,
}: {
  label: string;
  value: number;
  tone: string;
  compact?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        <span>{label}</span>
        <span>{Math.round(value * 100)}%</span>
      </div>
      <div className={`rounded-full bg-white/6 ${compact ? "h-1.5" : "h-2"}`}>
        <div className={`${compact ? "h-1.5" : "h-2"} rounded-full ${tone}`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}
