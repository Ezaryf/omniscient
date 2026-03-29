import { hashState } from "./hash";
import { createSnapshot } from "./snapshot";
import { ensureWorldState } from "./campaign";
import type { SimEvent, TimelineBranch, WorldState } from "./types";

export async function createBranch(
  sourceBranch: TimelineBranch,
  name: string,
  summary?: string
): Promise<{ branch: TimelineBranch; snapshot: ReturnType<typeof createSnapshot> }> {
  const branchId = `branch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const latestState = ensureWorldState(sourceBranch.latestState);
  const stateHash = await hashState(latestState);

  const snapshot = createSnapshot(branchId, latestState, "branch_point");

  const branch: TimelineBranch = {
    id: branchId,
    projectId: sourceBranch.projectId,
    scenarioId: sourceBranch.scenarioId,
    parentBranchId: sourceBranch.id,
    name,
    summary: summary ?? `Branched from "${sourceBranch.name}" at tick ${sourceBranch.currentTick}`,
    branchPointTick: sourceBranch.currentTick,
    branchOriginEventId: sourceBranch.branchOriginEventId ?? null,
    currentTick: sourceBranch.currentTick,
    stateHash,
    status: "active",
    latestState: structuredClone(latestState),
  };

  return { branch, snapshot };
}

export interface AgentStateDiff {
  agentId: string;
  agentName: string;
  diffs: {
    field: string;
    valueA: number;
    valueB: number;
    delta: number;
  }[];
}

export interface FrontStateDiff {
  frontId: string;
  frontName: string;
  pressureA: number;
  pressureB: number;
  progressA: number;
  progressB: number;
}

export interface RouteStateDiff {
  routeId: string;
  routeName: string;
  statusA: string;
  statusB: string;
  integrityA: number;
  integrityB: number;
  riskA: number;
  riskB: number;
}

export interface ConsequenceContrast {
  title: string;
  summary: string;
  evidence: string[];
}

export interface BranchDivergence {
  commonAncestorTick: number;
  divergencePointTick: number;
  branchAEvents: SimEvent[];
  branchBEvents: SimEvent[];
  agentDiffs: AgentStateDiff[];
  frontDiffs: FrontStateDiff[];
  routeDiffs: RouteStateDiff[];
  contrasts: ConsequenceContrast[];
  branchACurrentTick: number;
  branchBCurrentTick: number;
}

export function detectDivergence(
  branchA: TimelineBranch,
  branchB: TimelineBranch,
  eventsA: SimEvent[],
  eventsB: SimEvent[]
): BranchDivergence {
  const stateA = ensureWorldState(branchA.latestState);
  const stateB = ensureWorldState(branchB.latestState);

  const commonAncestorTick = Math.min(branchA.branchPointTick, branchB.branchPointTick);
  const divergedEventsA = eventsA.filter((event) => event.tick > commonAncestorTick);
  const divergedEventsB = eventsB.filter((event) => event.tick > commonAncestorTick);

  const agentDiffs = compareAgentStates(stateA, stateB);
  const frontDiffs = compareFronts(stateA, stateB);
  const routeDiffs = compareRoutes(stateA, stateB);

  return {
    commonAncestorTick,
    divergencePointTick: commonAncestorTick,
    branchAEvents: divergedEventsA,
    branchBEvents: divergedEventsB,
    agentDiffs,
    frontDiffs,
    routeDiffs,
    contrasts: buildConsequenceContrasts(branchA, branchB, stateA, stateB),
    branchACurrentTick: branchA.currentTick,
    branchBCurrentTick: branchB.currentTick,
  };
}

function compareAgentStates(stateA: WorldState, stateB: WorldState): AgentStateDiff[] {
  const diffs: AgentStateDiff[] = [];

  for (const agentA of stateA.agents) {
    const agentB = stateB.agents.find((agent) => agent.id === agentA.id);
    if (!agentB) continue;

    const fieldDiffs: AgentStateDiff["diffs"] = [];
    const stateFields = ["health", "morale", "influence", "wealth"] as const;

    for (const field of stateFields) {
      const valueA = agentA.state[field];
      const valueB = agentB.state[field];
      if (Math.abs(valueA - valueB) > 0.001) {
        fieldDiffs.push({
          field,
          valueA,
          valueB,
          delta: valueB - valueA,
        });
      }
    }

    if (fieldDiffs.length > 0) {
      diffs.push({
        agentId: agentA.id,
        agentName: agentA.name,
        diffs: fieldDiffs,
      });
    }
  }

  return diffs;
}

function compareFronts(stateA: WorldState, stateB: WorldState): FrontStateDiff[] {
  const diffs: FrontStateDiff[] = [];

  for (const frontA of stateA.fronts) {
    const frontB = stateB.fronts.find((front) => front.id === frontA.id);
    if (!frontB) continue;

    if (
      Math.abs(frontA.pressure - frontB.pressure) > 0.02 ||
      Math.abs(frontA.progress - frontB.progress) > 0.02
    ) {
      diffs.push({
        frontId: frontA.id,
        frontName: frontA.name,
        pressureA: frontA.pressure,
        pressureB: frontB.pressure,
        progressA: frontA.progress,
        progressB: frontB.progress,
      });
    }
  }

  return diffs;
}

function compareRoutes(stateA: WorldState, stateB: WorldState): RouteStateDiff[] {
  const diffs: RouteStateDiff[] = [];

  for (const routeA of stateA.map.routes) {
    const routeB = stateB.map.routes.find((route) => route.id === routeA.id);
    if (!routeB) continue;

    if (
      routeA.status !== routeB.status ||
      Math.abs(routeA.integrity - routeB.integrity) > 0.02 ||
      Math.abs(routeA.risk - routeB.risk) > 0.02
    ) {
      diffs.push({
        routeId: routeA.id,
        routeName: routeA.name,
        statusA: routeA.status,
        statusB: routeB.status,
        integrityA: routeA.integrity,
        integrityB: routeB.integrity,
        riskA: routeA.risk,
        riskB: routeB.risk,
      });
    }
  }

  return diffs;
}

function buildConsequenceContrasts(
  branchA: TimelineBranch,
  branchB: TimelineBranch,
  stateA: WorldState,
  stateB: WorldState
): ConsequenceContrast[] {
  const contrasts: ConsequenceContrast[] = [];

  for (const frontA of stateA.fronts) {
    const frontB = stateB.fronts.find((front) => front.id === frontA.id);
    if (!frontB) continue;

    const pressureDelta = frontB.pressure - frontA.pressure;
    const progressDelta = frontB.progress - frontA.progress;
    if (Math.abs(pressureDelta) < 0.12 && Math.abs(progressDelta) < 0.12) continue;

    if (pressureDelta > 0.12 || progressDelta > 0.12) {
      contrasts.push({
        title: `${branchA.name} kept ${frontA.name} calmer`,
        summary: `${branchB.name} escalated ${frontA.name} more aggressively, while ${branchA.name} preserved breathing room around ${frontA.stakes.toLowerCase()}.`,
        evidence: [
          `${branchA.name}: pressure ${Math.round(frontA.pressure * 100)}%, progress ${Math.round(frontA.progress * 100)}%`,
          `${branchB.name}: pressure ${Math.round(frontB.pressure * 100)}%, progress ${Math.round(frontB.progress * 100)}%`,
        ],
      });
    } else {
      contrasts.push({
        title: `${branchB.name} relieved ${frontA.name}`,
        summary: `${branchB.name} reduced escalation around ${frontA.stakes.toLowerCase()}, while ${branchA.name} let the front simmer.`,
        evidence: [
          `${branchA.name}: pressure ${Math.round(frontA.pressure * 100)}%, progress ${Math.round(frontA.progress * 100)}%`,
          `${branchB.name}: pressure ${Math.round(frontB.pressure * 100)}%, progress ${Math.round(frontB.progress * 100)}%`,
        ],
      });
    }
  }

  for (const routeA of stateA.map.routes) {
    const routeB = stateB.map.routes.find((route) => route.id === routeA.id);
    if (!routeB || routeA.status === routeB.status) continue;

    if (
      (routeA.status === "open" || routeA.status === "strained") &&
      (routeB.status === "disrupted" || routeB.status === "collapsed")
    ) {
      contrasts.push({
        title: `${branchA.name} preserved ${routeA.name}`,
        summary: `${branchA.name} kept the route functional, while ${branchB.name} lost it to instability and risk.`,
        evidence: [
          `${branchA.name}: ${routeA.status}, integrity ${Math.round(routeA.integrity * 100)}%`,
          `${branchB.name}: ${routeB.status}, integrity ${Math.round(routeB.integrity * 100)}%`,
        ],
      });
    }
  }

  if (contrasts.length === 0) {
    contrasts.push({
      title: "Branches diverged in subtle ways",
      summary: "No single front or route dominates the divergence yet, but the event histories and actor states are already drifting apart.",
      evidence: [
        `${branchA.name}: ${stateA.events.length} tracked events`,
        `${branchB.name}: ${stateB.events.length} tracked events`,
      ],
    });
  }

  return contrasts.slice(0, 5);
}
