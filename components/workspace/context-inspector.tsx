"use client";

import { Compass, Link2, MapPin, Radar, Siren } from "lucide-react";
import type { BoardTool, WorldCanvasUiState } from "@/components/workspace/world-canvas";
import type { BoardSelection, CampaignNode, FrontClock, MapLayer, RelationshipEdge, SimEvent, WorldState } from "@/lib/sim/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DockPanel, PanelHeader } from "@/components/ui/dock-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getLocalCausalNeighborhood, getNearestBranchingAncestor } from "@/lib/sim/causality";

interface ContextInspectorProps {
  readonly selection: BoardSelection | null;
  readonly worldState: WorldState | null;
  readonly recentEvents: SimEvent[];
  readonly onDeleteCampaignNode?: (nodeId: string) => void | Promise<void>;
  readonly onDeleteBoardLink?: (linkId: string) => void | Promise<void>;
  readonly boardUiState?: WorldCanvasUiState;
  readonly onFocusSelection?: () => void;
  readonly onBeginLinkFromSelection?: () => void;
  readonly onClearSelection?: () => void;
  readonly onSetBoardTool?: (tool: BoardTool) => void;
}

interface InspectorData {
  badge: string;
  title: string;
  description: string;
  meta: string[];
  position: Array<{ label: string; value: string; mono?: boolean }>;
  metrics: Array<{ label: string; value: string; mono?: boolean }>;
  links: Array<{ label: string; value: string }>;
  explanation: { summary: string; evidence: string[] } | null;
  intent: WorldState["agents"][number]["activeIntent"] | null;
  previousIntent: WorldState["agents"][number]["activeIntent"] | null;
  recent: SimEvent[];
}

export function ContextInspector({
  selection,
  worldState,
  recentEvents,
  onDeleteCampaignNode,
  onDeleteBoardLink,
  boardUiState,
  onFocusSelection,
  onBeginLinkFromSelection,
  onClearSelection,
  onSetBoardTool,
}: ContextInspectorProps) {
  if (!selection || !worldState) {
    return (
      <DockPanel className="bg-[var(--bg-dock)]">
        <PanelHeader
          title="Context Inspector"
          description="Select an actor, place, region, route, front, or board node to inspect linked campaign context."
        />
        <div className="p-4">
          <EmptyState
            title="Select something on the board"
            copy="Actors, places, regions, routes, fronts, and custom board nodes resolve here with their linked context."
          />
        </div>
      </DockPanel>
    );
  }

  const data = resolveSelection(selection, worldState, recentEvents);

  return (
    <DockPanel className="flex flex-col bg-[var(--bg-dock)]">
      <PanelHeader
        title="Context Inspector"
        description="Selected board context, linked pressure, and recent causal relevance."
        action={
          <div className="flex items-center gap-2">
            <Badge variant="default">{data.badge}</Badge>
            <Button type="button" variant="ghost" size="sm" onClick={onFocusSelection}>
              Focus
            </Button>
            {selection.type === "campaignNode" ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => void onDeleteCampaignNode?.(selection.id)}
              >
                Delete Node
              </Button>
            ) : null}
            {selection.type === "boardLink" ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => void onDeleteBoardLink?.(selection.id)}
              >
                Delete Link
              </Button>
            ) : null}
          </div>
        }
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-4">
          <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{boardUiState?.activeTool ?? "inspect"}</Badge>
              <Badge>{boardUiState?.zoomPercent ?? 100}% zoom</Badge>
              {boardUiState?.showGrid ? <Badge>grid</Badge> : null}
              {boardUiState?.snapToGrid ? <Badge>snap</Badge> : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={onFocusSelection}>
                Focus Selection
              </Button>
              {boardUiState?.canStartLinkFromSelection ? (
                <Button type="button" variant="secondary" size="sm" onClick={onBeginLinkFromSelection}>
                  Link From Selection
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={onClearSelection}>
                Clear
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => onSetBoardTool?.("inspect")}>
                Inspect Tool
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => onSetBoardTool?.("move")}>
                Move Tool
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => onSetBoardTool?.("connect")}>
                Link Tool
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => onSetBoardTool?.("delete")}>
                Delete Tool
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4">
            <div className="text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{data.title}</div>
            <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{data.description}</div>
            {data.meta.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.meta.map((item) => (
                  <Badge key={item}>{item}</Badge>
                ))}
              </div>
            ) : null}
          </section>

          {data.position.length > 0 ? (
            <section className="space-y-3">
              <SectionTitle icon={MapPin} label="Campaign position" />
              <div className="grid gap-3 sm:grid-cols-2">
                {data.position.map((item) => (
                  <InfoTile key={item.label} label={item.label} value={item.value} />
                ))}
              </div>
            </section>
          ) : null}

          {data.metrics.length > 0 ? (
            <section className="space-y-3">
              <SectionTitle icon={Radar} label="Pressure & metrics" />
              <div className="grid gap-3 sm:grid-cols-2">
                {data.metrics.map((item) => (
                  <InfoTile key={item.label} label={item.label} value={item.value} mono={"mono" in item ? Boolean(item.mono) : false} />
                ))}
              </div>
            </section>
          ) : null}

          {data.links.length > 0 ? (
            <section className="space-y-3">
              <SectionTitle icon={Link2} label="Linked context" />
              <div className="space-y-3">
                {data.links.map((item) => (
                  <div key={`${item.label}:${item.value}`} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{item.label}</div>
                    <div className="mt-2 text-sm text-[var(--text-primary)]">{item.value}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {data.intent ? (
            <section className="space-y-3">
              <SectionTitle icon={Compass} label="Intent continuity" />
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4">
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  {data.intent.kind} {data.intent.status !== "active" ? `(${data.intent.status})` : ""}
                </div>
                <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{data.intent.rationale}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge>priority {data.intent.priority.toFixed(2)}</Badge>
                  <Badge>commitment {data.intent.commitment.toFixed(2)}</Badge>
                  <Badge>targets {data.intent.targetIds.length}</Badge>
                </div>
                {data.previousIntent ? (
                  <div className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Prior intent: {data.previousIntent.kind} ({data.previousIntent.status})
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {data.explanation ? (
            <section className="space-y-3">
              <SectionTitle icon={Radar} label="Why It Matters" />
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4">
                <div className="text-sm leading-6 text-[var(--text-secondary)]">{data.explanation.summary}</div>
                {data.explanation.evidence.length > 0 ? (
                  <div className="mt-3 grid gap-2">
                    {data.explanation.evidence.map((item) => (
                      <div
                        key={item}
                        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/68 px-3 py-2 text-sm text-[var(--text-secondary)]"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <SectionTitle icon={Siren} label="Recent causal relevance" />
            {data.recent.length === 0 ? (
              <EmptyState title="No recent linked events" copy="Once this context is touched by the timeline, its local chain will appear here." />
            ) : (
              <div className="space-y-3">
                {data.recent.map((event) => (
                  <div key={event.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4">
                    <div className="mb-2 text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Tick {event.tick}</div>
                    <div className="text-sm leading-6 text-[var(--text-primary)]">{event.description}</div>
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

function resolveSelection(
  selection: BoardSelection,
  worldState: WorldState,
  recentEvents: SimEvent[]
): InspectorData {
  if (selection.type === "agent") {
    const agent = worldState.agents.find((entry) => entry.id === selection.id);
    if (!agent) return fallbackSelection(selection, recentEvents);
    const causalEvents = recentEvents.filter(
      (event) => event.actorIds.includes(agent.id) || event.targetIds.includes(agent.id)
    );
    const region = nearestRegion(worldState.map, agent.position)?.name ?? "Unknown";
    const site = nearestSite(worldState.map, agent.position)?.name ?? "In the field";
    return {
      badge: "Actor",
      title: agent.name,
      description: `${agent.type} aligned to ${agent.factionId.replace(/^faction-/, "")}.`,
      meta: [agent.status, agent.factionId.replace(/^faction-/, "")],
      position: [
        { label: "Region", value: region },
        { label: "Site", value: site },
      ],
      metrics: [
        { label: "Influence", value: `${Math.round(agent.state.influence)}`, mono: true },
        { label: "Wealth", value: `${Math.round(agent.state.wealth)}`, mono: true },
        { label: "Morale", value: `${Math.round(agent.state.morale * 100)}%` },
        { label: "Health", value: `${Math.round(agent.state.health * 100)}%` },
      ],
      links: worldState.relationships
        .filter((entry) => entry.sourceAgentId === agent.id || entry.targetAgentId === agent.id)
        .slice(0, 4)
        .map((relationship) => ({
          label: "Relationship",
          value:
            worldState.agents.find((candidate) =>
              candidate.id === (relationship.sourceAgentId === agent.id ? relationship.targetAgentId : relationship.sourceAgentId)
            )?.name ?? "Unknown actor",
        })),
      intent: agent.activeIntent,
      previousIntent: agent.intentHistory.at(-1) ?? null,
      explanation: {
        summary:
          causalEvents.length > 0
            ? "This actor is already embedded in the live causal chain, so future branch explanations should anchor here before they generalize to faction or regional fallout."
            : "This actor has not yet accumulated much direct fallout, so its importance is currently structural rather than event-driven.",
        evidence: [
          `${agent.memory.length} retained memory entries`,
          `${causalEvents.length} linked recent event${causalEvents.length === 1 ? "" : "s"}`,
        ],
      },
      recent: getLocalCausalNeighborhood(
        worldState,
        causalEvents.map((event) => event.id),
        5
      ),
    };
  }

  if (selection.type === "region") {
    const region = worldState.map.regions.find((entry) => entry.id === selection.id);
    if (!region) return fallbackSelection(selection, recentEvents);
    return {
      badge: "Region",
      title: region.name,
      description: `${region.kind} region under ${region.controllingFactionId ? region.controllingFactionId.replace(/^faction-/, "") : "contested"} control.`,
      meta: [region.visibility],
      position: [
        { label: "Center", value: `${Math.round(region.center.x)}, ${Math.round(region.center.y)}`, mono: true },
        { label: "Radius", value: `${Math.round(region.radius)}`, mono: true },
      ],
      metrics: [
        { label: "Supply", value: `${Math.round(region.supply * 100)}%` },
        { label: "Stability", value: `${Math.round(region.stability * 100)}%` },
        { label: "Threat", value: `${Math.round(region.threat * 100)}%` },
      ],
      links: worldState.map.sites.filter((site) => site.regionId === region.id).slice(0, 5).map((site) => ({ label: "Site", value: site.name })),
      explanation: {
        summary:
          "Regions explain macro consequences best: they aggregate threat, supply, stability, and nearby site changes into a single place-based story.",
        evidence: [
          `Supply ${Math.round(region.supply * 100)}%`,
          `Threat ${Math.round(region.threat * 100)}%`,
        ],
      },
      intent: null,
      previousIntent: null,
      recent: getLocalCausalNeighborhood(
        worldState,
        recentEvents.filter((event) => event.affects.includes(region.id)).map((event) => event.id),
        5
      ),
    };
  }

  if (selection.type === "site") {
    const site = worldState.map.sites.find((entry) => entry.id === selection.id);
    if (!site) return fallbackSelection(selection, recentEvents);
    return {
      badge: "Place",
      title: site.name,
      description: `${site.kind} currently marked ${site.status}.`,
      meta: [site.status],
      position: [
        { label: "Region", value: worldState.map.regions.find((entry) => entry.id === site.regionId)?.name ?? site.regionId },
        { label: "Coordinates", value: `${Math.round(site.position.x)}, ${Math.round(site.position.y)}`, mono: true },
      ],
      metrics: [],
      links: worldState.map.routes
        .filter((route) => route.fromSiteId === site.id || route.toSiteId === site.id)
        .map((route) => ({ label: "Route", value: route.name })),
      explanation: {
        summary:
          "Sites are useful branch anchors because they connect local event fallout to route disruption, territorial pressure, and front escalation.",
        evidence: [`${worldState.map.routes.filter((route) => route.fromSiteId === site.id || route.toSiteId === site.id).length} linked routes`],
      },
      intent: null,
      previousIntent: null,
      recent: getLocalCausalNeighborhood(
        worldState,
        recentEvents.filter((event) => event.affects.includes(site.id)).map((event) => event.id),
        5
      ),
    };
  }

  if (selection.type === "route") {
    const route = worldState.map.routes.find((entry) => entry.id === selection.id);
    if (!route) return fallbackSelection(selection, recentEvents);
    return {
      badge: "Route",
      title: route.name,
      description: `Travel link between ${siteName(worldState.map, route.fromSiteId)} and ${siteName(worldState.map, route.toSiteId)}.`,
      meta: [route.status],
      position: [],
      metrics: [
        { label: "Risk", value: `${Math.round(route.risk * 100)}%` },
        { label: "Integrity", value: `${Math.round(route.integrity * 100)}%` },
        { label: "Traffic", value: `${Math.round(route.traffic * 100)}%` },
      ],
      links: [
        { label: "From", value: siteName(worldState.map, route.fromSiteId) },
        { label: "To", value: siteName(worldState.map, route.toSiteId) },
      ],
      explanation: {
        summary:
          "Routes carry slower-burn consequences. When they degrade, later events become easier to explain through scarcity, delay, and pressure transfer instead of isolated shocks.",
        evidence: [
          `Risk ${Math.round(route.risk * 100)}%`,
          `Integrity ${Math.round(route.integrity * 100)}%`,
        ],
      },
      intent: null,
      previousIntent: null,
      recent: getLocalCausalNeighborhood(
        worldState,
        recentEvents.filter((event) => event.affects.includes(route.id)).map((event) => event.id),
        5
      ),
    };
  }

  if (selection.type === "front") {
    const front = worldState.fronts.find((entry) => entry.id === selection.id);
    if (!front) return fallbackSelection(selection, recentEvents);
    return {
      badge: "Front",
      title: front.name,
      description: front.stakes,
      meta: [front.status],
      position: front.regionId
        ? [{ label: "Region", value: worldState.map.regions.find((entry) => entry.id === front.regionId)?.name ?? front.regionId }]
        : [],
      metrics: [
        { label: "Pressure", value: `${Math.round(front.pressure * 100)}%` },
        { label: "Progress", value: `${Math.round(front.progress * 100)}%` },
      ],
      links: [
        ...(front.factionId ? [{ label: "Faction", value: front.factionId.replace(/^faction-/, "") }] : []),
        ...(front.opposingFactionId ? [{ label: "Opposition", value: front.opposingFactionId.replace(/^faction-/, "") }] : []),
        ...(worldState.events.length > 0
          ? (() => {
              const linked = recentEvents.filter((event) => event.affects.includes(front.id));
              const nearestBranch = linked[0]
                ? getNearestBranchingAncestor(worldState.causalityGraph, linked[0].id)
                : null;
              return nearestBranch
                ? [{ label: "Branch ancestor", value: worldState.events.find((event) => event.id === nearestBranch)?.description ?? nearestBranch }]
                : [];
            })()
          : []),
      ],
      explanation: {
        summary:
          "Fronts are the clearest strategic explanation layer because they turn multiple small events into a single visible line of escalation, relief, or collapse.",
        evidence: [
          `Pressure ${Math.round(front.pressure * 100)}%`,
          `Progress ${Math.round(front.progress * 100)}%`,
        ],
      },
      intent: null,
      previousIntent: null,
      recent: getLocalCausalNeighborhood(
        worldState,
        recentEvents.filter((event) => event.affects.includes(front.id)).map((event) => event.id),
        5
      ),
    };
  }

  if (selection.type === "boardLink") {
    const boardLink = worldState.boardLinks.find((entry) => entry.id === selection.id);
    if (!boardLink) return fallbackSelection(selection, recentEvents);
    return {
      badge: "Link",
      title: boardLink.label ?? `${boardLink.type} link`,
      description: `Manual ${boardLink.type} connection on the campaign board.`,
      meta: boardLink.tags,
      position: [],
      metrics: [
        { label: "Type", value: boardLink.type },
        { label: "Created", value: `Tick ${boardLink.createdAtTick}`, mono: true },
      ],
      links: [
        { label: "Source", value: describeLinkEndpoint(boardLink.source, worldState) },
        { label: "Target", value: describeLinkEndpoint(boardLink.target, worldState) },
      ],
      explanation: {
        summary:
          "Manual board links do not drive simulation state directly, but they provide a useful planning overlay for explaining inferred dependencies and intended what-if probes.",
        evidence: [`Created at tick ${boardLink.createdAtTick}`],
      },
      intent: null,
      previousIntent: null,
      recent: getLocalCausalNeighborhood(
        worldState,
        recentEvents.filter((event) => event.affects.includes(boardLink.id)).map((event) => event.id),
        5
      ),
    };
  }

  const node = worldState.campaignNodes.find((entry) => entry.id === selection.id);
  if (!node) return fallbackSelection(selection, recentEvents);
  return {
    badge: node.kind === "place" ? "Place" : node.kind.charAt(0).toUpperCase() + node.kind.slice(1),
    title: node.name,
    description: `Manual ${node.kind} node placed on the campaign board.`,
    meta: node.tags,
    position: [
      { label: "Coordinates", value: `${Math.round(node.position.x)}, ${Math.round(node.position.y)}`, mono: true },
      ...(node.regionId ? [{ label: "Region", value: worldState.map.regions.find((entry) => entry.id === node.regionId)?.name ?? node.regionId }] : []),
      ...(node.siteId ? [{ label: "Site", value: worldState.map.sites.find((entry) => entry.id === node.siteId)?.name ?? node.siteId }] : []),
    ],
    metrics: Object.entries(node.metrics).map(([label, value]) => ({ label, value: `${Math.round(value)}`, mono: true })),
    links: worldState.boardLinks
      .filter(
        (link) =>
          (link.source.type === "campaignNode" && link.source.id === node.id) ||
          (link.target.type === "campaignNode" && link.target.id === node.id)
      )
      .map((link) => ({
        label: link.type,
        value:
          link.source.type === "campaignNode" && link.source.id === node.id
            ? describeLinkEndpoint(link.target, worldState)
            : describeLinkEndpoint(link.source, worldState),
      })),
    explanation: {
      summary:
        "Manual campaign nodes are best used as planning scaffolds for future causality, helping the GM annotate places, forces, and ideas before the engine turns them into direct events.",
      evidence: [`${node.tags.length} tag${node.tags.length === 1 ? "" : "s"}`],
    },
    intent: null,
    previousIntent: null,
    recent: getLocalCausalNeighborhood(
      worldState,
      recentEvents.filter((event) => event.affects.includes(node.id)).map((event) => event.id),
      5
    ),
  };
}

function fallbackSelection(selection: BoardSelection, recentEvents: SimEvent[]) {
  return {
    badge: selection.type,
    title: selection.id,
    description: "This selection no longer resolves to an active world object.",
    meta: [],
    position: [],
    metrics: [],
    links: [],
    explanation: null,
    intent: null,
    previousIntent: null,
    recent: recentEvents.filter((event) => event.affects.includes(selection.id)).slice(-5).reverse(),
  };
}

function siteName(map: MapLayer, id: string) {
  return map.sites.find((site) => site.id === id)?.name ?? id;
}

function nearestRegion(map: MapLayer, position: { x: number; y: number }) {
  return map.regions
    .slice()
    .sort((left, right) => {
      const leftDistance = Math.hypot(left.center.x - position.x, left.center.y - position.y);
      const rightDistance = Math.hypot(right.center.x - position.x, right.center.y - position.y);
      return leftDistance - rightDistance;
    })[0] ?? null;
}

function nearestSite(map: MapLayer, position: { x: number; y: number }) {
  return map.sites
    .slice()
    .sort((left, right) => {
      const leftDistance = Math.hypot(left.position.x - position.x, left.position.y - position.y);
      const rightDistance = Math.hypot(right.position.x - position.x, right.position.y - position.y);
      return leftDistance - rightDistance;
    })[0] ?? null;
}

function describeLinkEndpoint(
  endpoint: { type: "agent" | "campaignNode" | "region" | "site" | "front"; id: string },
  worldState: WorldState
) {
  if (endpoint.type === "agent") {
    return worldState.agents.find((entry) => entry.id === endpoint.id)?.name ?? endpoint.id;
  }
  if (endpoint.type === "campaignNode") {
    return worldState.campaignNodes.find((entry) => entry.id === endpoint.id)?.name ?? endpoint.id;
  }
  if (endpoint.type === "region") {
    return worldState.map.regions.find((entry) => entry.id === endpoint.id)?.name ?? endpoint.id;
  }
  if (endpoint.type === "site") {
    return worldState.map.sites.find((entry) => entry.id === endpoint.id)?.name ?? endpoint.id;
  }
  return worldState.fronts.find((entry) => entry.id === endpoint.id)?.name ?? endpoint.id;
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

function InfoTile({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</div>
      <div className={`mt-2 text-base font-semibold text-[var(--text-primary)] ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
