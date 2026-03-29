import { clamp } from "./relationships";
import { buildCausalityGraph } from "./causality";
import type {
  Agent,
  BoardLink,
  CampaignNode,
  CausalEvent,
  CausalLinkType,
  EventImpact,
  FrontClock,
  GmNote,
  MapLayer,
  MapToken,
  Position,
  ProjectionArtifact,
  Region,
  Route,
  Site,
  WorldState,
} from "./types";

const DEFAULT_MAP_ID = "map-main";

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function factionLabel(factionId: string) {
  return factionId.replace(/^faction-/, "").replace(/-/g, " ");
}

function averagePosition(points: Position[]): Position {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }

  const totals = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  );

  return {
    x: totals.x / points.length,
    y: totals.y / points.length,
  };
}

function distance(a: Position, b: Position) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function routeStatusFromIntegrity(route: Route): Route["status"] {
  if (route.integrity <= 0.2) return "collapsed";
  if (route.integrity <= 0.45 || route.risk >= 0.75) return "disrupted";
  if (route.integrity <= 0.7 || route.risk >= 0.45) return "strained";
  return "open";
}

function frontStatus(front: FrontClock): FrontClock["status"] {
  const hottestValue = Math.max(front.progress, front.pressure);
  if (hottestValue >= 0.78) return "critical";
  if (hottestValue >= 0.42) return "rising";
  if (hottestValue <= 0.1 && front.progress <= 0.1) return "resolved";
  return "quiet";
}

export function createEmptyMapLayer(name = "Campaign Map"): MapLayer {
  return {
    id: DEFAULT_MAP_ID,
    name,
    regions: [],
    sites: [],
    routes: [],
    tokens: [],
  };
}

function createFallbackSites(regions: Region[]): Site[] {
  return regions.map((region, index) => ({
    id: `site-${region.id}`,
    name: `${region.name} Hold`,
    kind: index % 2 === 0 ? "capital" : "stronghold",
    regionId: region.id,
    position: { x: region.center.x, y: region.center.y },
    controllingFactionId: region.controllingFactionId,
    status: "stable",
    tags: ["fallback-site"],
  }));
}

function createFallbackRoutes(sites: Site[]): Route[] {
  const sortedSites = [...sites].sort((a, b) => a.position.x - b.position.x);
  const routes: Route[] = [];

  for (let i = 0; i < sortedSites.length - 1; i++) {
    const from = sortedSites[i];
    const to = sortedSites[i + 1];
    routes.push({
      id: `route-${from.id}-${to.id}`,
      name: `${from.name} to ${to.name}`,
      fromSiteId: from.id,
      toSiteId: to.id,
      controllingFactionId: from.controllingFactionId ?? to.controllingFactionId,
      status: "open",
      risk: 0.2,
      integrity: 0.85,
      traffic: 0.55,
      tags: ["fallback-route"],
    });
  }

  return routes;
}

function createFallbackTokens(regions: Region[], sites: Site[]): MapToken[] {
  const factionTokens = regions.map((region) => ({
    id: `token-${region.id}`,
    name: `${region.name} Patrol`,
    kind: "faction" as const,
    factionId: region.controllingFactionId,
    regionId: region.id,
    siteId: `site-${region.id}`,
    position: region.center,
    visible: true,
    status: "ready" as const,
  }));

  const partyAnchor = sites[0];
  const partyToken: MapToken = {
    id: "token-party-main",
    name: "Party Vanguard",
    kind: "party",
    factionId: null,
    regionId: partyAnchor?.regionId ?? regions[0]?.id ?? null,
    siteId: partyAnchor?.id ?? null,
    position: partyAnchor?.position ?? regions[0]?.center ?? { x: 120, y: 120 },
    visible: true,
    status: "ready",
  };

  return [...factionTokens, partyToken];
}

export function createFallbackMapFromAgents(agents: Agent[]): MapLayer {
  if (agents.length === 0) {
    return createEmptyMapLayer();
  }

  const grouped = new Map<string, Agent[]>();
  for (const agent of agents) {
    const existing = grouped.get(agent.factionId) ?? [];
    existing.push(agent);
    grouped.set(agent.factionId, existing);
  }

  const regions: Region[] = Array.from(grouped.entries())
    .map(([factionId, factionAgents], index) => {
      const center = averagePosition(factionAgents.map((agent) => agent.position));
      const kind: Region["kind"] =
        index % 3 === 0 ? "homeland" : index % 3 === 1 ? "frontier" : "city-state";
      return {
        id: `region-${factionId}`,
        name: `${factionLabel(factionId)} Reach`,
        kind,
        center,
        radius: 110 + factionAgents.length * 12,
        controllingFactionId: factionId,
        supply: clamp(0.45 + factionAgents.length * 0.08, 0, 1),
        stability: clamp(
          factionAgents.reduce((sum, agent) => sum + agent.state.morale, 0) / factionAgents.length,
          0,
          1
        ),
        threat: clamp(
          factionAgents.reduce((sum, agent) => sum + agent.traits.aggression * 0.15, 0),
          0,
          1
        ),
        visibility: "visible" as const,
        tags: ["auto-generated"],
      };
    })
    .sort((a, b) => a.center.x - b.center.x);

  const sites = createFallbackSites(regions);
  const routes = createFallbackRoutes(sites);
  const tokens = createFallbackTokens(regions, sites);

  return {
    id: DEFAULT_MAP_ID,
    name: "Campaign Map",
    regions,
    sites,
    routes,
    tokens,
  };
}

export function findRegionForPosition(map: MapLayer, position: Position): Region | null {
  if (map.regions.length === 0) return null;

  const ranked = [...map.regions].sort(
    (left, right) => distance(left.center, position) - distance(right.center, position)
  );

  return ranked[0] ?? null;
}

export function findSiteForPosition(map: MapLayer, position: Position): Site | null {
  if (map.sites.length === 0) return null;

  const ranked = [...map.sites].sort(
    (left, right) => distance(left.position, position) - distance(right.position, position)
  );

  return ranked[0] ?? null;
}

export function findRegionForAgent(map: MapLayer, agent: Agent): Region | null {
  return findRegionForPosition(map, agent.position);
}

export function createFallbackFronts(
  agents: Agent[],
  relationships: WorldState["relationships"],
  map: MapLayer
): FrontClock[] {
  const byPair = new Map<string, { relations: WorldState["relationships"]; factions: [string, string] }>();

  for (const relationship of relationships) {
    const source = agents.find((agent) => agent.id === relationship.sourceAgentId);
    const target = agents.find((agent) => agent.id === relationship.targetAgentId);
    if (!source || !target || source.factionId === target.factionId) continue;

    const key = [source.factionId, target.factionId].sort().join("::");
    const existing = byPair.get(key) ?? {
      relations: [],
      factions: [source.factionId, target.factionId] as [string, string],
    };
    existing.relations.push(relationship);
    byPair.set(key, existing);
  }

  const fronts = Array.from(byPair.entries()).map(([key, value], index) => {
    const avgTrust =
      value.relations.reduce((sum, relationship) => sum + relationship.trust, 0) /
      value.relations.length;
    const avgTension =
      value.relations.reduce((sum, relationship) => sum + relationship.tension, 0) /
      value.relations.length;
    const region =
      map.regions.find((candidate) => candidate.controllingFactionId === value.factions[0]) ??
      map.regions[index % Math.max(map.regions.length, 1)] ??
      null;

    const front: FrontClock = {
      id: `front-${key.replace(/::/g, "-")}`,
      name: `${factionLabel(value.factions[0])} vs ${factionLabel(value.factions[1])}`,
      regionId: region?.id ?? null,
      factionId: value.factions[0],
      opposingFactionId: value.factions[1],
      pressure: clamp((1 - avgTrust) / 2, 0, 1),
      progress: clamp(avgTension, 0, 1),
      status: "quiet",
      stakes: `Control of ${region?.name ?? "the frontier"}`,
      lastAdvancedTick: 0,
    };

    return {
      ...front,
      status: frontStatus(front),
    };
  });

  if (fronts.length > 0) {
    return fronts;
  }

  return map.regions.slice(0, 2).map((region, index) => ({
    id: `front-fallback-${index}`,
    name: `${region.name} Pressure`,
    regionId: region.id,
    factionId: region.controllingFactionId,
    opposingFactionId: null,
    pressure: clamp(region.threat, 0, 1),
    progress: clamp(1 - region.stability, 0, 1),
    status: "quiet",
    stakes: `Stability of ${region.name}`,
    lastAdvancedTick: 0,
  }));
}

export function deriveCampaignNodes(
  state: Pick<WorldState, "agents" | "map" | "fronts">,
  existingNodes: CampaignNode[] = []
): CampaignNode[] {
  const manualNodes = existingNodes.filter((node) => node.tags.includes("manual"));
  const factionNodes = new Map<string, CampaignNode>();

  for (const agent of state.agents) {
    const existing = factionNodes.get(agent.factionId);
    if (existing) {
      existing.metrics.influence = (existing.metrics.influence ?? 0) + agent.state.influence;
      existing.metrics.wealth = (existing.metrics.wealth ?? 0) + agent.state.wealth;
      continue;
    }

    factionNodes.set(agent.factionId, {
      id: `node-${agent.factionId}`,
      kind: "faction",
      name: factionLabel(agent.factionId),
      factionId: agent.factionId,
      regionId: findRegionForAgent(state.map, agent)?.id ?? null,
      siteId: null,
      position: agent.position,
      status: "active",
      tags: ["derived"],
      metrics: {
        influence: agent.state.influence,
        wealth: agent.state.wealth,
      },
    });
  }

  const regionNodes: CampaignNode[] = state.map.regions.map((region) => ({
    id: `node-${region.id}`,
    kind: "region",
    name: region.name,
    factionId: region.controllingFactionId,
    regionId: region.id,
    siteId: null,
    position: region.center,
    status: region.visibility,
    tags: region.tags,
    metrics: {
      supply: region.supply,
      stability: region.stability,
      threat: region.threat,
    },
  }));

  const siteNodes: CampaignNode[] = state.map.sites.map((site) => ({
    id: `node-${site.id}`,
    kind: "site",
    name: site.name,
    factionId: site.controllingFactionId,
    regionId: site.regionId,
    siteId: site.id,
    position: site.position,
    status: site.status,
    tags: site.tags,
    metrics: {},
  }));

  const routeNodes: CampaignNode[] = state.map.routes.map((route) => {
    const from = state.map.sites.find((site) => site.id === route.fromSiteId);
    const to = state.map.sites.find((site) => site.id === route.toSiteId);
    return {
      id: `node-${route.id}`,
      kind: "route",
      name: route.name,
      factionId: route.controllingFactionId,
      regionId: from?.regionId ?? to?.regionId ?? null,
      siteId: null,
      position: averagePosition([
        from?.position ?? { x: 0, y: 0 },
        to?.position ?? { x: 0, y: 0 },
      ]),
      status: route.status,
      tags: route.tags,
      metrics: {
        risk: route.risk,
        integrity: route.integrity,
        traffic: route.traffic,
      },
    };
  });

  const partyNodes: CampaignNode[] = state.map.tokens
    .filter((token) => token.kind === "party")
    .map((token) => ({
      id: `node-${token.id}`,
      kind: "party",
      name: token.name,
      factionId: token.factionId,
      regionId: token.regionId,
      siteId: token.siteId,
      position: token.position,
      status: token.status,
      tags: ["token"],
      metrics: {},
    }));

  const agentNodes: CampaignNode[] = state.agents.map((agent) => ({
    id: `node-${agent.id}`,
    kind: "agent",
    name: agent.name,
    factionId: agent.factionId,
    regionId: findRegionForAgent(state.map, agent)?.id ?? null,
    siteId: findSiteForPosition(state.map, agent.position)?.id ?? null,
    position: agent.position,
    status: agent.status,
    tags: [agent.type],
    metrics: {
      influence: agent.state.influence,
      morale: agent.state.morale,
      wealth: agent.state.wealth,
    },
  }));

  return [
    ...manualNodes,
    ...Array.from(factionNodes.values()),
    ...regionNodes,
    ...siteNodes,
    ...routeNodes,
    ...partyNodes,
    ...agentNodes,
  ];
}

export function deriveProjectionArtifacts(
  state: Pick<WorldState, "tick" | "fronts" | "map" | "events" | "gmNotes">
): ProjectionArtifact[] {
  const artifacts: ProjectionArtifact[] = [];

  for (const front of state.fronts) {
    if (front.status === "resolved") continue;
    const severity = clamp(Math.max(front.progress, front.pressure), 0, 1);
    if (severity < 0.38) continue;

    artifacts.push({
      id: `projection-front-${front.id}`,
      tick: state.tick,
      type: front.status === "critical" ? "warning" : "prediction",
      subjectType: "front",
      subjectId: front.id,
      title:
        front.status === "critical"
          ? `${front.name} is about to break`
          : `${front.name} is escalating`,
      summary:
        front.status === "critical"
          ? `Pressure on ${front.stakes.toLowerCase()} is near breaking point. A single new conflict could turn this into open war.`
          : `Pressure is building around ${front.stakes.toLowerCase()}, and unattended faction moves will keep raising the stakes.`,
      evidence: [
        `Progress ${Math.round(front.progress * 100)}%`,
        `Pressure ${Math.round(front.pressure * 100)}%`,
      ],
      severity,
      confidence: clamp(0.58 + severity * 0.3, 0, 1),
      acknowledged: false,
    });
  }

  for (const route of state.map.routes) {
    if (route.status === "open") continue;
    const severity = clamp(Math.max(1 - route.integrity, route.risk), 0, 1);
    artifacts.push({
      id: `projection-route-${route.id}`,
      tick: state.tick,
      type: route.status === "collapsed" ? "warning" : "prep",
      subjectType: "route",
      subjectId: route.id,
      title:
        route.status === "collapsed"
          ? `${route.name} has collapsed`
          : `${route.name} is no longer reliable`,
      summary:
        route.status === "collapsed"
          ? `Travel, supply, and rumors will reroute immediately. Any nearby fronts lose logistical support until the route is repaired.`
          : `This route can still function, but travel scenes and faction logistics should assume delays, ambush risk, or scarcity.`,
      evidence: [
        `Integrity ${Math.round(route.integrity * 100)}%`,
        `Risk ${Math.round(route.risk * 100)}%`,
      ],
      severity,
      confidence: clamp(0.55 + severity * 0.25, 0, 1),
      acknowledged: false,
    });
  }

  for (const region of state.map.regions) {
    const severity = clamp(Math.max(region.threat, 1 - region.supply), 0, 1);
    if (severity < 0.45) continue;

    artifacts.push({
      id: `projection-region-${region.id}`,
      tick: state.tick,
      type: region.threat > 0.65 ? "warning" : "prep",
      subjectType: "region",
      subjectId: region.id,
      title:
        region.threat > 0.65
          ? `${region.name} is becoming a hotspot`
          : `${region.name} needs prep coverage`,
      summary:
        region.threat > 0.65
          ? `The region is unstable enough that travel scenes, settlements, and rumors should all reflect brewing conflict.`
          : `Low supply or weakening stability means the next session here should feature scarcity, suspicion, or contested movement.`,
      evidence: [
        `Threat ${Math.round(region.threat * 100)}%`,
        `Supply ${Math.round(region.supply * 100)}%`,
        `Stability ${Math.round(region.stability * 100)}%`,
      ],
      severity,
      confidence: clamp(0.52 + severity * 0.28, 0, 1),
      acknowledged: false,
    });
  }

  for (const note of state.gmNotes.filter((entry) => entry.status === "open")) {
    artifacts.push({
      id: `projection-note-${note.id}`,
      tick: note.tick,
      type: "prep",
      subjectType: note.linkedFrontId
        ? "front"
        : note.linkedRegionId
          ? "region"
          : note.linkedEventId
            ? "event"
            : "party",
      subjectId: note.linkedFrontId ?? note.linkedRegionId ?? note.linkedEventId ?? note.id,
      title: note.title,
      summary: note.content,
      evidence: ["Pinned by GM"],
      severity: 0.4,
      confidence: 0.95,
      acknowledged: false,
    });
  }

  return artifacts.slice(0, 12);
}

function normalizeMap(map: MapLayer | undefined, agents: Agent[]): MapLayer {
  if (!map) {
    return createFallbackMapFromAgents(agents);
  }

  const normalized = {
    ...map,
    regions: map.regions ?? [],
    sites: map.sites ?? [],
    routes: map.routes ?? [],
    tokens: map.tokens ?? [],
  };

  if (normalized.regions.length === 0 && agents.length > 0) {
    return createFallbackMapFromAgents(agents);
  }

  if (normalized.sites.length === 0 && normalized.regions.length > 0) {
    normalized.sites = createFallbackSites(normalized.regions);
  }

  if (normalized.routes.length === 0 && normalized.sites.length > 1) {
    normalized.routes = createFallbackRoutes(normalized.sites);
  }

  if (normalized.tokens.length === 0 && normalized.regions.length > 0) {
    normalized.tokens = createFallbackTokens(normalized.regions, normalized.sites);
  }

  return normalized;
}

export function ensureWorldState(state: Partial<WorldState>): WorldState {
  const agents = state.agents ?? [];
  const relationships = state.relationships ?? [];
  const map = normalizeMap(state.map, agents);
  const campaignNodes = (state.campaignNodes ?? []).map((node) => ({
    ...node,
    factionId: node.factionId ?? null,
    regionId: node.regionId ?? null,
    siteId: node.siteId ?? null,
    position: node.position ?? { x: 0, y: 0 },
    status: node.status ?? "active",
    tags: node.tags ?? [],
    metrics: node.metrics ?? {},
  }));
  const fronts = state.fronts?.length
    ? state.fronts.map((front) => ({ ...front, status: frontStatus(front) }))
    : createFallbackFronts(agents, relationships, map);
  const events = (state.events ?? []).map((event) => ({
    ...event,
    actorIds: event.actorIds ?? unique([event.sourceAgentId ?? null]),
    targetIds: event.targetIds ?? unique([event.targetAgentId ?? null]),
    parentEventIds: unique([
      ...((event as Partial<CausalEvent>).parentEventIds ?? []),
      ...(event.causedBy ?? []),
    ]),
    causeChain: event.causeChain ?? [],
    causedBy: unique([
      ...((event as Partial<CausalEvent>).parentEventIds ?? []),
      ...(event.causedBy ?? []),
    ]),
    causalDepth: (event as Partial<CausalEvent>).causalDepth ?? 0,
    causalType: (event as Partial<CausalEvent>).causalType ?? null,
    affects: event.affects ?? [],
    invalidates: event.invalidates ?? [],
    tags: event.tags ?? [],
    metadata: event.metadata ?? {},
    confidence: event.confidence ?? 0.7,
    branchOriginEventId: event.branchOriginEventId ?? null,
  }));
  const boardLinks = (state.boardLinks ?? []).map((link) => ({
    ...link,
    label: link.label ?? null,
    tags: link.tags ?? [],
  }));
  const causalityGraph =
    state.causalityGraph && Object.keys(state.causalityGraph.parentIdsByEventId ?? {}).length > 0
      ? state.causalityGraph
      : buildCausalityGraph(events);

  const base: WorldState = {
    tick: state.tick ?? 0,
    agents,
    relationships,
    campaignNodes,
    boardLinks,
    map,
    fronts,
    projections: state.projections ?? [],
    gmNotes: state.gmNotes ?? [],
    events,
    causalityGraph,
    activeModifiers: state.activeModifiers ?? [],
    rules: state.rules!,
    seed: state.seed ?? 0,
  };

  return {
    ...base,
    campaignNodes:
      deriveCampaignNodes(base, base.campaignNodes),
    boardLinks: base.boardLinks,
    projections:
      base.projections.length > 0
        ? base.projections
        : deriveProjectionArtifacts({
            tick: base.tick,
            fronts: base.fronts,
            map: base.map,
            events: base.events,
            gmNotes: base.gmNotes,
          }),
  };
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function inferCausalParents(
  state: WorldState,
  actorIds: string[],
  targetIds: string[],
  tags: string[]
): string[] {
  const interests = new Set([...actorIds, ...targetIds, ...tags]);

  return state.events
    .slice(-12)
    .filter((event) => {
      const overlapsActors =
        event.actorIds.some((id) => interests.has(id)) ||
        event.targetIds.some((id) => interests.has(id));
      const overlapsTags = event.tags.some((tag) => interests.has(tag));
      return overlapsActors || overlapsTags;
    })
    .slice(-3)
    .map((event) => event.id);
}

function inferInvalidations(
  state: WorldState,
  type: CausalEvent["type"],
  actorIds: string[],
  targetIds: string[]
): string[] {
  const counterparts = new Set([...actorIds, ...targetIds]);
  const opposing =
    type === "conflict" || type === "betrayal" || type === "collapse"
      ? new Set(["trade", "alliance", "negotiation"])
      : new Set(["conflict", "betrayal"]);

  return state.events
    .slice(-10)
    .filter((event) => {
      if (!opposing.has(event.type)) return false;
      const overlaps =
        event.actorIds.some((id) => counterparts.has(id)) ||
        event.targetIds.some((id) => counterparts.has(id));
      return overlaps;
    })
    .slice(-2)
    .map((event) => event.id);
}

function inferAffectedIds(
  state: WorldState,
  actorIds: string[],
  targetIds: string[]
): string[] {
  const affected = new Set<string>([...actorIds, ...targetIds]);

  const relevantAgents = state.agents.filter(
    (agent) => actorIds.includes(agent.id) || targetIds.includes(agent.id)
  );

  for (const agent of relevantAgents) {
    const region = findRegionForAgent(state.map, agent);
    const site = findSiteForPosition(state.map, agent.position);
    if (region) affected.add(region.id);
    if (site) affected.add(site.id);
    if (agent.factionId) affected.add(agent.factionId);
  }

  for (const front of state.fronts) {
    const factionHit =
      (front.factionId && relevantAgents.some((agent) => agent.factionId === front.factionId)) ||
      (front.opposingFactionId &&
        relevantAgents.some((agent) => agent.factionId === front.opposingFactionId));
    if (factionHit) affected.add(front.id);
  }

  for (const route of state.map.routes) {
    const from = state.map.sites.find((site) => site.id === route.fromSiteId);
    const to = state.map.sites.find((site) => site.id === route.toSiteId);
    if (
      from &&
      to &&
      (affected.has(from.regionId) || affected.has(to.regionId) || affected.has(from.id) || affected.has(to.id))
    ) {
      affected.add(route.id);
    }
  }

  return Array.from(affected);
}

interface CreateCausalEventInput {
  tick: number;
  type: CausalEvent["type"];
  description: string;
  sourceAgentId?: string | null;
  targetAgentId?: string | null;
  actorIds?: string[];
  targetIds?: string[];
  impact?: EventImpact[];
  parentEventIds?: string[];
  causeChain?: string[];
  causedBy?: string[];
  causalType?: CausalLinkType | null;
  affects?: string[];
  invalidates?: string[];
  branchOriginEventId?: string | null;
  confidence?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  sequence?: number;
}

export function createCausalEvent(
  state: WorldState,
  input: CreateCausalEventInput
): CausalEvent {
  const actorIds = unique([input.sourceAgentId, ...(input.actorIds ?? [])]);
  const targetIds = unique([input.targetAgentId, ...(input.targetIds ?? [])]);
  const tags = input.tags ?? [];
  const causedBy =
    input.parentEventIds && input.parentEventIds.length > 0
      ? input.parentEventIds
      : input.causedBy && input.causedBy.length > 0
        ? input.causedBy
      : inferCausalParents(state, actorIds, targetIds, tags);
  const affects =
    input.affects && input.affects.length > 0
      ? input.affects
      : inferAffectedIds(state, actorIds, targetIds);
  const invalidates =
    input.invalidates && input.invalidates.length > 0
      ? input.invalidates
      : inferInvalidations(state, input.type, actorIds, targetIds);
  const sequence = input.sequence ?? 0;
  const identitySeed = [
    input.tick,
    input.type,
    input.description,
    input.sourceAgentId ?? "none",
    input.targetAgentId ?? "none",
    actorIds.join(","),
    targetIds.join(","),
    tags.join(","),
    sequence,
  ].join(":");
  const baseId = `evt-${input.tick}-${input.type}-${hashString(identitySeed)}`;
  const duplicateCount = state.events.filter((event) => event.id === baseId || event.id.startsWith(`${baseId}-`)).length;
  const eventId = duplicateCount === 0 ? baseId : `${baseId}-${duplicateCount}`;
  const causalDepth =
    causedBy.length === 0
      ? 0
      : Math.max(
          ...causedBy.map((id) => {
            const parent = state.events.find((event) => event.id === id);
            return parent?.causalDepth ?? 0;
          })
        ) + 1;

  return {
    id: eventId,
    tick: input.tick,
    type: input.type,
    sourceAgentId: input.sourceAgentId ?? null,
    targetAgentId: input.targetAgentId ?? null,
    actorIds,
    targetIds,
    description: input.description,
    impact: input.impact ?? [],
    parentEventIds: causedBy,
    causeChain:
      input.causeChain ??
      causedBy
        .map((id) => state.events.find((event) => event.id === id)?.description ?? id)
        .slice(-3),
    causedBy,
    causalDepth,
    causalType: input.causalType ?? (causedBy.length > 0 ? "trigger" : null),
    affects,
    invalidates,
    branchOriginEventId: input.branchOriginEventId ?? null,
    confidence: input.confidence ?? 0.7,
    tags,
    metadata: input.metadata ?? {},
  };
}

function relevantRouteIds(state: WorldState, event: CausalEvent): string[] {
  const explicit = event.affects.filter((id) => id.startsWith("route-"));
  if (explicit.length > 0) {
    return explicit;
  }

  const regions = new Set(
    event.affects.filter((id) => id.startsWith("region-"))
  );
  const sites = new Set(event.affects.filter((id) => id.startsWith("site-")));

  return state.map.routes
    .filter((route) => {
      const from = state.map.sites.find((site) => site.id === route.fromSiteId);
      const to = state.map.sites.find((site) => site.id === route.toSiteId);
      return Boolean(
        (from && (regions.has(from.regionId) || sites.has(from.id))) ||
          (to && (regions.has(to.regionId) || sites.has(to.id)))
      );
    })
    .map((route) => route.id);
}

function relevantFrontIds(state: WorldState, event: CausalEvent): string[] {
  const explicit = event.affects.filter((id) => id.startsWith("front-"));
  if (explicit.length > 0) {
    return explicit;
  }

  const factions = new Set(
    state.agents
      .filter((agent) => event.actorIds.includes(agent.id) || event.targetIds.includes(agent.id))
      .map((agent) => agent.factionId)
  );

  return state.fronts
    .filter(
      (front) =>
        (front.factionId && factions.has(front.factionId)) ||
        (front.opposingFactionId && factions.has(front.opposingFactionId))
    )
    .map((front) => front.id);
}

function eventMagnitude(event: CausalEvent) {
  if (typeof event.metadata.delta === "number") {
    return clamp(Math.abs(event.metadata.delta), 0.05, 0.4);
  }

  const impactMagnitude =
    event.impact.length > 0
      ? Math.max(...event.impact.map((impact) => Math.abs(impact.delta)))
      : 0.12;
  return clamp(impactMagnitude, 0.05, 0.4);
}

export function applyCausalConsequences(state: WorldState, event: CausalEvent): WorldState {
  const magnitude = eventMagnitude(event);
  const agents = structuredClone(state.agents);
  const map = structuredClone(state.map);
  const fronts = structuredClone(state.fronts);
  const notes = structuredClone(state.gmNotes);
  const campaignNodes = structuredClone(state.campaignNodes);
  const boardLinks = structuredClone(state.boardLinks);

  const routeIds = relevantRouteIds(state, event);
  const frontIds = relevantFrontIds(state, event);
  const regionIds = event.affects.filter((id) => id.startsWith("region-"));
  const siteIds = event.affects.filter((id) => id.startsWith("site-"));

  for (const region of map.regions) {
    if (!regionIds.includes(region.id)) continue;

    if (event.type === "conflict" || event.type === "betrayal" || event.type === "collapse") {
      region.threat = clamp(region.threat + magnitude * 0.9, 0, 1);
      region.stability = clamp(region.stability - magnitude * 0.7, 0, 1);
      region.supply = clamp(region.supply - magnitude * 0.45, 0, 1);
    } else if (event.type === "trade" || event.type === "supply") {
      region.supply = clamp(region.supply + magnitude * 0.45, 0, 1);
      region.stability = clamp(region.stability + magnitude * 0.2, 0, 1);
      region.threat = clamp(region.threat - magnitude * 0.15, 0, 1);
    } else if (event.type === "negotiation" || event.type === "alliance") {
      region.stability = clamp(region.stability + magnitude * 0.35, 0, 1);
      region.threat = clamp(region.threat - magnitude * 0.35, 0, 1);
    } else if (event.type === "natural_event" || event.type === "injected") {
      region.threat = clamp(region.threat + magnitude * 0.45, 0, 1);
      region.supply = clamp(region.supply - magnitude * 0.2, 0, 1);
    }
  }

  for (const site of map.sites) {
    if (!siteIds.includes(site.id)) continue;
    if (event.type === "conflict" || event.type === "collapse") {
      site.status = site.status === "ruined" ? "ruined" : site.status === "sieged" ? "ruined" : "sieged";
    } else if (event.type === "negotiation" || event.type === "alliance") {
      site.status = "stable";
    }
  }

  for (const route of map.routes) {
    if (!routeIds.includes(route.id)) continue;

    if (event.type === "conflict" || event.type === "betrayal" || event.type === "collapse") {
      route.risk = clamp(route.risk + magnitude * 0.75, 0, 1);
      route.integrity = clamp(route.integrity - magnitude * 0.7, 0, 1);
      route.traffic = clamp(route.traffic - magnitude * 0.35, 0, 1);
    } else if (event.type === "trade" || event.type === "supply") {
      route.risk = clamp(route.risk - magnitude * 0.35, 0, 1);
      route.integrity = clamp(route.integrity + magnitude * 0.4, 0, 1);
      route.traffic = clamp(route.traffic + magnitude * 0.25, 0, 1);
    } else if (event.type === "negotiation" || event.type === "alliance") {
      route.risk = clamp(route.risk - magnitude * 0.25, 0, 1);
      route.integrity = clamp(route.integrity + magnitude * 0.25, 0, 1);
    }

    route.status = routeStatusFromIntegrity(route);
  }

  for (const front of fronts) {
    if (!frontIds.includes(front.id)) continue;

    if (event.type === "front_advance") {
      const delta = typeof event.metadata.delta === "number" ? event.metadata.delta : magnitude;
      front.progress = clamp(front.progress + delta, 0, 1);
      front.pressure = clamp(front.pressure + delta * 0.7, 0, 1);
    } else if (event.type === "conflict" || event.type === "betrayal") {
      front.progress = clamp(front.progress + magnitude * 0.8, 0, 1);
      front.pressure = clamp(front.pressure + magnitude * 0.65, 0, 1);
    } else if (event.type === "collapse" || event.type === "natural_event") {
      front.progress = clamp(front.progress + magnitude * 0.35, 0, 1);
      front.pressure = clamp(front.pressure + magnitude * 0.45, 0, 1);
    } else if (event.type === "negotiation" || event.type === "alliance") {
      front.progress = clamp(front.progress - magnitude * 0.75, 0, 1);
      front.pressure = clamp(front.pressure - magnitude * 0.55, 0, 1);
    } else if (event.type === "trade" || event.type === "supply") {
      front.pressure = clamp(front.pressure - magnitude * 0.2, 0, 1);
    }

    front.lastAdvancedTick = event.tick;
    front.status = frontStatus(front);
  }

  if (event.type === "movement" || event.type === "travel") {
    const entityType =
      typeof event.metadata.entityType === "string" ? event.metadata.entityType : "token";
    const tokenId =
      typeof event.metadata.tokenId === "string" ? event.metadata.tokenId : null;
    const agentId =
      typeof event.metadata.agentId === "string" ? event.metadata.agentId : null;
    const siteId =
      typeof event.metadata.siteId === "string" ? event.metadata.siteId : null;
    const regionId =
      typeof event.metadata.regionId === "string" ? event.metadata.regionId : null;

    if (entityType === "token" && tokenId) {
      const token = map.tokens.find((entry) => entry.id === tokenId);
      if (token) {
        if (typeof event.metadata.x === "number") token.position.x = event.metadata.x;
        if (typeof event.metadata.y === "number") token.position.y = event.metadata.y;
        if (typeof event.metadata.regionId === "string") token.regionId = event.metadata.regionId;
        if (typeof event.metadata.siteId === "string") token.siteId = event.metadata.siteId;
        token.status = "moving";
      }
    }

    if (entityType === "agent" && agentId) {
      const agent = agents.find((entry) => entry.id === agentId);
      if (agent) {
        if (typeof event.metadata.x === "number") agent.position.x = event.metadata.x;
        if (typeof event.metadata.y === "number") agent.position.y = event.metadata.y;
      }
    }

    if (entityType === "site" && siteId) {
      const site = map.sites.find((entry) => entry.id === siteId);
      if (site) {
        if (typeof event.metadata.x === "number") site.position.x = event.metadata.x;
        if (typeof event.metadata.y === "number") site.position.y = event.metadata.y;
        if (regionId) site.regionId = regionId;
      }
    }

    if (entityType === "region" && regionId) {
      const region = map.regions.find((entry) => entry.id === regionId);
      if (region) {
        if (typeof event.metadata.x === "number") region.center.x = event.metadata.x;
        if (typeof event.metadata.y === "number") region.center.y = event.metadata.y;
        if (typeof event.metadata.radius === "number") {
          region.radius = clamp(event.metadata.radius, 40, 900);
        }
      }
    }
  }

  if (event.metadata.createRegion && typeof event.metadata.createRegion === "object") {
    const payload = event.metadata.createRegion as {
      id: string;
      name: string;
      kind: Region["kind"];
      center: Position;
      radius: number;
      controllingFactionId: string | null;
    };
    map.regions.push({
      id: payload.id,
      name: payload.name,
      kind: payload.kind,
      center: payload.center,
      radius: clamp(payload.radius, 40, 900),
      controllingFactionId: payload.controllingFactionId,
      supply: 0.5,
      stability: 0.55,
      threat: 0.2,
      visibility: "visible",
      tags: ["manual"],
    });
  }

  if (event.metadata.createSite && typeof event.metadata.createSite === "object") {
    const payload = event.metadata.createSite as {
      id: string;
      name: string;
      kind: Site["kind"];
      regionId: string | null;
      position: Position;
      controllingFactionId: string | null;
    };
    map.sites.push({
      id: payload.id,
      name: payload.name,
      kind: payload.kind,
      regionId: payload.regionId ?? findRegionForPosition(map, payload.position)?.id ?? "region-unassigned",
      position: payload.position,
      controllingFactionId: payload.controllingFactionId,
      status: "stable",
      tags: ["manual"],
    });
  }

  if (event.metadata.createToken && typeof event.metadata.createToken === "object") {
    const payload = event.metadata.createToken as {
      id: string;
      name: string;
      kind: MapToken["kind"];
      factionId: string | null;
      regionId: string | null;
      siteId: string | null;
      position: Position;
    };
    map.tokens.push({
      id: payload.id,
      name: payload.name,
      kind: payload.kind,
      factionId: payload.factionId,
      regionId: payload.regionId,
      siteId: payload.siteId,
      position: payload.position,
      visible: true,
      status: "ready",
    });
  }

  if (event.metadata.createRoute && typeof event.metadata.createRoute === "object") {
    const payload = event.metadata.createRoute as {
      id: string;
      name: string;
      fromSiteId: string;
      toSiteId: string;
      controllingFactionId: string | null;
    };
    map.routes.push({
      id: payload.id,
      name: payload.name,
      fromSiteId: payload.fromSiteId,
      toSiteId: payload.toSiteId,
      controllingFactionId: payload.controllingFactionId,
      status: "open",
      risk: 0.18,
      integrity: 0.92,
      traffic: 0.5,
      tags: ["manual"],
    });
  }

  if (event.metadata.createCampaignNode && typeof event.metadata.createCampaignNode === "object") {
    const payload = event.metadata.createCampaignNode as CampaignNode;
    campaignNodes.push({
      ...payload,
      tags: unique([...(payload.tags ?? []), "manual"]),
    });
  }

  if (event.metadata.moveCampaignNode && typeof event.metadata.moveCampaignNode === "object") {
    const payload = event.metadata.moveCampaignNode as {
      id: string;
      x?: number;
      y?: number;
      regionId?: string | null;
      siteId?: string | null;
    };
    const node = campaignNodes.find((entry) => entry.id === payload.id);
    if (node) {
      if (typeof payload.x === "number") node.position.x = payload.x;
      if (typeof payload.y === "number") node.position.y = payload.y;
      if ("regionId" in payload) node.regionId = payload.regionId ?? null;
      if ("siteId" in payload) node.siteId = payload.siteId ?? null;
    }
  }

  if (event.metadata.createBoardLink && typeof event.metadata.createBoardLink === "object") {
    const payload = event.metadata.createBoardLink as BoardLink;
    boardLinks.push({
      ...payload,
      label: payload.label ?? null,
      tags: payload.tags ?? ["manual"],
    });
  }

  if (typeof event.metadata.deleteBoardLinkId === "string") {
    const nextLinks = boardLinks.filter((link) => link.id !== event.metadata.deleteBoardLinkId);
    boardLinks.length = 0;
    boardLinks.push(...nextLinks);
  }

  if (typeof event.metadata.deleteCampaignNodeId === "string") {
    const nextNodes = campaignNodes.filter((node) => node.id !== event.metadata.deleteCampaignNodeId);
    campaignNodes.length = 0;
    campaignNodes.push(...nextNodes);
    const nextLinks = boardLinks.filter(
      (link) =>
        !(link.source.type === "campaignNode" && link.source.id === event.metadata.deleteCampaignNodeId) &&
        !(link.target.type === "campaignNode" && link.target.id === event.metadata.deleteCampaignNodeId)
    );
    boardLinks.length = 0;
    boardLinks.push(...nextLinks);
  }

  if (typeof event.metadata.note === "string" && event.metadata.note.trim().length > 0) {
    notes.unshift({
      id: `note-${hashString(`${event.id}:${event.metadata.note}`)}`,
      tick: event.tick,
      title: typeof event.metadata.noteTitle === "string" ? event.metadata.noteTitle : "Pinned consequence",
      content: event.metadata.note,
      linkedEventId: event.id,
      linkedRegionId: regionIds[0] ?? null,
      linkedSiteId: siteIds[0] ?? null,
      linkedFrontId: frontIds[0] ?? null,
      status: "open",
    });
  }

  const nextState = {
    ...state,
    agents,
    map,
    fronts: fronts.map((front) => ({ ...front, status: frontStatus(front) })),
    gmNotes: notes.slice(0, 24),
  };

  return {
    ...nextState,
    campaignNodes: deriveCampaignNodes(nextState, campaignNodes),
    boardLinks,
    projections: deriveProjectionArtifacts({
      tick: nextState.tick,
      fronts: nextState.fronts,
      map: nextState.map,
      events: nextState.events,
      gmNotes: nextState.gmNotes,
    }),
  };
}
