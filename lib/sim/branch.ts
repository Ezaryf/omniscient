/**
 * Branch creation and management.
 * Handles forking, divergence detection, and comparison.
 */

import type { WorldState, TimelineBranch, SimEvent } from "./types";
import { hashState } from "./hash";
import { createSnapshot } from "./snapshot";

/**
 * Create a new branch from the current state of an existing branch.
 */
export async function createBranch(
  sourceBranch: TimelineBranch,
  name: string,
  summary?: string
): Promise<{ branch: TimelineBranch; snapshot: ReturnType<typeof createSnapshot> }> {
  const branchId = `branch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const stateHash = await hashState(sourceBranch.latestState);

  const snapshot = createSnapshot(
    branchId,
    sourceBranch.latestState,
    "branch_point"
  );

  const branch: TimelineBranch = {
    id: branchId,
    projectId: sourceBranch.projectId,
    scenarioId: sourceBranch.scenarioId,
    parentBranchId: sourceBranch.id,
    name,
    summary: summary ?? `Branched from "${sourceBranch.name}" at tick ${sourceBranch.currentTick}`,
    branchPointTick: sourceBranch.currentTick,
    currentTick: sourceBranch.currentTick,
    stateHash,
    status: "active",
    latestState: structuredClone(sourceBranch.latestState),
  };

  return { branch, snapshot };
}

/**
 * Detect divergence between two branches.
 * Returns the tick at which they diverged and summary of differences.
 */
export function detectDivergence(
  branchA: TimelineBranch,
  branchB: TimelineBranch,
  eventsA: SimEvent[],
  eventsB: SimEvent[]
): BranchDivergence {
  const commonAncestorTick = Math.min(
    branchA.branchPointTick,
    branchB.branchPointTick
  );

  const divergedEventsA = eventsA.filter((e) => e.tick > commonAncestorTick);
  const divergedEventsB = eventsB.filter((e) => e.tick > commonAncestorTick);

  const agentDiffs = compareAgentStates(
    branchA.latestState,
    branchB.latestState
  );

  return {
    commonAncestorTick,
    divergencePointTick: commonAncestorTick,
    branchAEvents: divergedEventsA,
    branchBEvents: divergedEventsB,
    agentDiffs,
    branchACurrentTick: branchA.currentTick,
    branchBCurrentTick: branchB.currentTick,
  };
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

export interface BranchDivergence {
  commonAncestorTick: number;
  divergencePointTick: number;
  branchAEvents: SimEvent[];
  branchBEvents: SimEvent[];
  agentDiffs: AgentStateDiff[];
  branchACurrentTick: number;
  branchBCurrentTick: number;
}

/**
 * Compare agent states between two world states.
 */
function compareAgentStates(
  stateA: WorldState,
  stateB: WorldState
): AgentStateDiff[] {
  const diffs: AgentStateDiff[] = [];

  for (const agentA of stateA.agents) {
    const agentB = stateB.agents.find((a) => a.id === agentA.id);
    if (!agentB) continue;

    const fieldDiffs: AgentStateDiff["diffs"] = [];
    const stateFields = ["health", "morale", "influence", "wealth"] as const;

    for (const field of stateFields) {
      const valA = agentA.state[field];
      const valB = agentB.state[field];
      if (Math.abs(valA - valB) > 0.001) {
        fieldDiffs.push({
          field,
          valueA: valA,
          valueB: valB,
          delta: valB - valA,
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
