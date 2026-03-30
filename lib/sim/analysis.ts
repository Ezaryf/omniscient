import type {
  CausalEvent,
  ProjectionArtifact,
  RelationshipEdge,
  TimelineBranch,
  WorldState,
} from "./types";

export interface AnalysisCard {
  id: string;
  title: string;
  summary: string;
  evidence: string[];
  confidence: number;
  generatedBy: "ai" | "heuristic";
  tick?: number;
  tone?: "default" | "warning" | "accent" | "success";
}

export interface DivergenceWorkbench {
  overview: AnalysisCard[];
  uniqueEventsA: CausalEvent[];
  uniqueEventsB: CausalEvent[];
}

function sortByConfidence<T extends { confidence: number }>(items: T[]) {
  return [...items].sort((left, right) => right.confidence - left.confidence);
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function describePressure(worldState: WorldState) {
  const frontPressure = average(worldState.fronts.map((front) => front.pressure));
  const routeRisk = average(worldState.map.routes.map((route) => route.risk));
  const regionalThreat = average(worldState.map.regions.map((region) => region.threat));
  return {
    frontPressure,
    routeRisk,
    regionalThreat,
    total: average([frontPressure, routeRisk, regionalThreat].filter((value) => value > 0)),
  };
}

function describeInstability(relationships: RelationshipEdge[]) {
  return relationships
    .map((relationship) => ({
      relationship,
      instability:
        Math.max(0, relationship.tension) +
        Math.max(0, 0.55 - relationship.trust) +
        relationship.influence * 0.4,
    }))
    .sort((left, right) => right.instability - left.instability);
}

export function buildInsightCards(worldState: WorldState): AnalysisCard[] {
  const cards: AnalysisCard[] = [];
  const pressure = describePressure(worldState);
  const unresolvedFronts = [...worldState.fronts]
    .filter((front) => front.status !== "resolved")
    .sort((left, right) => right.pressure - left.pressure);
  const riskyRoutes = [...worldState.map.routes]
    .filter((route) => route.status !== "open" || route.risk >= 0.5)
    .sort((left, right) => right.risk - left.risk);
  const unstableRelationships = describeInstability(worldState.relationships).slice(0, 3);
  const cascadeCandidates = [...worldState.events]
    .filter((event) => (worldState.causalityGraph.childIdsByEventId[event.id] ?? []).length > 0)
    .sort(
      (left, right) =>
        (worldState.causalityGraph.childIdsByEventId[right.id] ?? []).length -
        (worldState.causalityGraph.childIdsByEventId[left.id] ?? []).length
    )
    .slice(0, 3);
  const projections = sortByConfidence(worldState.projections).slice(0, 3);

  cards.push({
    id: "hidden-pressure",
    title: "Hidden pressure profile",
    summary:
      pressure.total >= 0.6
        ? "The branch is running hot across fronts, routes, and regions. Any new intervention is likely to create visible second-order fallout."
        : pressure.total >= 0.35
          ? "Pressure is distributed rather than explosive. The branch is stable enough to steer, but several systems are primed to tip together."
          : "The branch is comparatively steady. Most leverage now comes from chosen interventions rather than runaway systemic collapse.",
    evidence: [
      `Average front pressure: ${formatPercent(pressure.frontPressure)}`,
      `Average route risk: ${formatPercent(pressure.routeRisk)}`,
      `Average regional threat: ${formatPercent(pressure.regionalThreat)}`,
    ],
    confidence: 0.72,
    generatedBy: "heuristic",
    tick: worldState.tick,
    tone: pressure.total >= 0.6 ? "warning" : "accent",
  });

  if (unresolvedFronts.length > 0) {
    const front = unresolvedFronts[0];
    cards.push({
      id: `front-${front.id}`,
      title: `${front.name} is the most volatile front`,
      summary: `${front.stakes} remains unresolved. This front currently concentrates the clearest mix of pressure, progress, and future divergence risk.`,
      evidence: [
        `Status: ${front.status}`,
        `Pressure ${formatPercent(front.pressure)}`,
        `Progress ${formatPercent(front.progress)}`,
      ],
      confidence: Math.max(front.pressure, front.progress),
      generatedBy: "heuristic",
      tick: worldState.tick,
      tone: "warning",
    });
  }

  if (riskyRoutes.length > 0) {
    const route = riskyRoutes[0];
    cards.push({
      id: `route-${route.id}`,
      title: `${route.name} is the most exposed route`,
      summary: `This corridor is carrying branch-level risk. If it fails, trade, movement, and faction posture will become easier to explain through logistics pressure instead of isolated events.`,
      evidence: [
        `Status: ${route.status}`,
        `Risk ${formatPercent(route.risk)}`,
        `Integrity ${formatPercent(route.integrity)}`,
        `Traffic ${formatPercent(route.traffic)}`,
      ],
      confidence: Math.max(route.risk, 1 - route.integrity),
      generatedBy: "heuristic",
      tick: worldState.tick,
      tone: route.status === "collapsed" ? "warning" : "default",
    });
  }

  if (unstableRelationships.length > 0) {
    const entry = unstableRelationships[0];
    cards.push({
      id: `relationship-${entry.relationship.id}`,
      title: "Relationship instability is rising",
      summary:
        "A high-tension relationship with real influence is one of the strongest predictors of branch drift because it changes both action scoring and the narrative framing of future events.",
      evidence: [
        `Between ${entry.relationship.sourceAgentId} and ${entry.relationship.targetAgentId}`,
        `Trust ${entry.relationship.trust.toFixed(2)}`,
        `Tension ${entry.relationship.tension.toFixed(2)}`,
        `Influence ${entry.relationship.influence.toFixed(2)}`,
      ],
      confidence: Math.min(0.88, entry.instability / 2),
      generatedBy: "heuristic",
      tick: worldState.tick,
      tone: "accent",
    });
  }

  if (cascadeCandidates.length > 0) {
    const event = cascadeCandidates[0];
    const descendants = worldState.causalityGraph.childIdsByEventId[event.id] ?? [];
    cards.push({
      id: `cascade-${event.id}`,
      title: "A cascade chain is already visible",
      summary:
        "This event has produced downstream consequences in the current causality graph, which makes it a good anchor for branch explanations and replay review.",
      evidence: [
        event.description,
        `Tick ${event.tick}`,
        `${descendants.length} downstream consequence${descendants.length === 1 ? "" : "s"}`,
      ],
      confidence: Math.min(0.9, 0.45 + descendants.length * 0.12),
      generatedBy: "heuristic",
      tick: event.tick,
      tone: "warning",
    });
  }

  for (const projection of projections) {
    cards.push(mapProjectionToCard(projection));
  }

  return sortByConfidence(cards).slice(0, 6);
}

function mapProjectionToCard(projection: ProjectionArtifact): AnalysisCard {
  return {
    id: projection.id,
    title: projection.title,
    summary: projection.summary,
    evidence: projection.evidence,
    confidence: projection.confidence,
    generatedBy: "heuristic",
    tick: projection.tick,
    tone: projection.type === "warning" || projection.type === "prediction" ? "warning" : "default",
  };
}

function pickUniqueEvents(events: CausalEvent[]) {
  return [...events]
    .sort((left, right) => {
      const rightWeight =
        (right.causedBy?.length ?? 0) +
        (right.affects?.length ?? 0) +
        Math.abs(right.impact.reduce((sum, item) => sum + item.delta, 0));
      const leftWeight =
        (left.causedBy?.length ?? 0) +
        (left.affects?.length ?? 0) +
        Math.abs(left.impact.reduce((sum, item) => sum + item.delta, 0));
      return rightWeight - leftWeight || right.tick - left.tick;
    })
    .slice(0, 5);
}

export function buildDivergenceWorkbench(params: {
  branchA: TimelineBranch;
  branchB: TimelineBranch;
  commonAncestorTick: number;
  branchAEvents: CausalEvent[];
  branchBEvents: CausalEvent[];
  frontDiffCount: number;
  routeDiffCount: number;
  agentDiffCount: number;
}): DivergenceWorkbench {
  const {
    branchA,
    branchB,
    commonAncestorTick,
    branchAEvents,
    branchBEvents,
    frontDiffCount,
    routeDiffCount,
    agentDiffCount,
  } = params;
  const uniqueEventsA = pickUniqueEvents(branchAEvents);
  const uniqueEventsB = pickUniqueEvents(branchBEvents);
  const overview: AnalysisCard[] = [
    {
      id: "divergence-point",
      title: "Divergence point",
      summary:
        commonAncestorTick === 0
          ? "These branches split from the opening state, so the comparison is measuring entirely different consequence chains."
          : `These branches share history through tick ${commonAncestorTick}. Everything after that point is fair game for causal comparison.`,
      evidence: [
        `${branchA.name} is at T${branchA.currentTick}`,
        `${branchB.name} is at T${branchB.currentTick}`,
      ],
      confidence: 0.9,
      generatedBy: "heuristic",
      tone: "default",
    },
    {
      id: "systems-shifted",
      title: "What shifted most",
      summary:
        frontDiffCount + routeDiffCount + agentDiffCount > 0
          ? "The branch split is visible across actor state, strategic fronts, and logistical routes rather than in a single isolated metric."
          : "The branches have only lightly diverged so far, which means the next intervention may be more informative than the current replay.",
      evidence: [
        `${agentDiffCount} actor state change${agentDiffCount === 1 ? "" : "s"}`,
        `${frontDiffCount} front delta${frontDiffCount === 1 ? "" : "s"}`,
        `${routeDiffCount} route consequence${routeDiffCount === 1 ? "" : "s"}`,
      ],
      confidence: 0.76,
      generatedBy: "heuristic",
      tone: "accent",
    },
    {
      id: "branch-a-story",
      title: `${branchA.name} branch signature`,
      summary:
        uniqueEventsA[0]?.description ??
        "This branch has not yet produced a standout downstream event after the split.",
      evidence: uniqueEventsA.slice(0, 3).map((event) => `T${event.tick} ${event.description}`),
      confidence: 0.68,
      generatedBy: "heuristic",
      tone: "default",
    },
    {
      id: "branch-b-story",
      title: `${branchB.name} branch signature`,
      summary:
        uniqueEventsB[0]?.description ??
        "This branch has not yet produced a standout downstream event after the split.",
      evidence: uniqueEventsB.slice(0, 3).map((event) => `T${event.tick} ${event.description}`),
      confidence: 0.68,
      generatedBy: "heuristic",
      tone: "default",
    },
  ];

  return {
    overview,
    uniqueEventsA,
    uniqueEventsB,
  };
}
