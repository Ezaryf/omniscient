import type { WorldState, Snapshot, SimEvent } from "./types";
import { hashState } from "./hash";

/**
 * Limit for snapshots per branch to prevent memory exhaustion.
 */
export const MAX_SNAPSHOTS_PER_BRANCH = 10;

/**
 * Create a snapshot of the current world state.
 */
export async function createSnapshot(
  branchId: string,
  worldState: WorldState,
  kind: Snapshot["kind"]
): Promise<Snapshot> {
  const stateClone = structuredClone(worldState);
  const stateHash = await hashState(stateClone);

  return {
    id: `snap-${branchId}-${worldState.tick}-${Date.now().toString(36)}`,
    branchId,
    tick: worldState.tick,
    kind,
    stateHash,
    state: stateClone,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Restore world state from a snapshot.
 */
export function restoreFromSnapshot(snapshot: Snapshot): WorldState {
  return structuredClone(snapshot.state);
}

/**
 * Replay events from a starting state to reconstruct a later state.
 * This applies each event's impacts sequentially.
 */
export function replayEvents(
  startState: WorldState,
  events: SimEvent[]
): WorldState {
  let state = structuredClone(startState);

  const sortedEvents = [...events].sort((a, b) => a.tick - b.tick);

  for (const event of sortedEvents) {
    state = applyEventToState(state, event);
  }

  return state;
}

/**
 * Apply a single event to world state.
 */
function applyEventToState(state: WorldState, event: SimEvent): WorldState {
  const agents = state.agents.map((agent) => {
    const agentImpacts = event.impact.filter((i) => i.targetId === agent.id);
    if (agentImpacts.length === 0) return agent;

    let updated = { ...agent };
    for (const impact of agentImpacts) {
      updated = applyImpact(updated, impact);
    }
    return updated;
  });

  return {
    ...state,
    agents,
    events: [...state.events, event],
    tick: Math.max(state.tick, event.tick),
  };
}

function applyImpact(
  agent: WorldState["agents"][number],
  impact: { field: string; delta: number }
): WorldState["agents"][number] {
  const stateKeys = ["health", "morale", "influence", "wealth"];

  if (stateKeys.includes(impact.field)) {
    const key = impact.field as keyof typeof agent.state;
    return {
      ...agent,
      state: {
        ...agent.state,
        [key]: agent.state[key] + impact.delta,
      },
    };
  }

  if (impact.field in agent.resources) {
    return {
      ...agent,
      resources: {
        ...agent.resources,
        [impact.field]: Math.max(
          0,
          agent.resources[impact.field] + impact.delta
        ),
      },
    };
  }

  return agent;
}

/**
 * Find the nearest snapshot at or before a given tick.
 */
export function findNearestSnapshot(
  snapshots: Snapshot[],
  tick: number
): Snapshot | null {
  const candidates = snapshots.filter((s) => s.tick <= tick);
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.tick - a.tick);
  return candidates[0];
}

/**
 * Prune snapshots for a branch, keeping only the most recent ones.
 * Returns the IDs of snapshots that should be deleted.
 */
export function getSnapshotsToPrune(
  snapshots: Snapshot[],
  branchId: string
): string[] {
  const branchSnapshots = snapshots
    .filter((s) => s.branchId === branchId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (branchSnapshots.length <= MAX_SNAPSHOTS_PER_BRANCH) {
    return [];
  }

  return branchSnapshots
    .slice(MAX_SNAPSHOTS_PER_BRANCH)
    .map((s) => s.id);
}
