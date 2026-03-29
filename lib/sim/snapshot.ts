import { applyCausalConsequences, ensureWorldState } from "./campaign";
import { hashState } from "./hash";
import { applyEventImpacts } from "./rules";
import type { Snapshot, SimEvent, WorldState } from "./types";

export const MAX_SNAPSHOTS_PER_BRANCH = 10;

export async function createSnapshot(
  branchId: string,
  worldState: WorldState,
  kind: Snapshot["kind"]
): Promise<Snapshot> {
  const normalized = ensureWorldState(worldState);
  const stateClone = structuredClone(normalized);
  const stateHash = await hashState(stateClone);

  return {
    id: `snap-${branchId}-${normalized.tick}-${Date.now().toString(36)}`,
    branchId,
    tick: normalized.tick,
    kind,
    stateHash,
    state: stateClone,
    createdAt: new Date().toISOString(),
  };
}

export function restoreFromSnapshot(snapshot: Snapshot): WorldState {
  return ensureWorldState(structuredClone(snapshot.state));
}

export function replayEvents(startState: WorldState, events: SimEvent[]): WorldState {
  let state = ensureWorldState(startState);
  const sortedEvents = [...events].sort((left, right) => left.tick - right.tick);

  for (const event of sortedEvents) {
    state = {
      ...state,
      tick: Math.max(state.tick, event.tick),
      agents: applyEventImpacts(state.agents, event.impact),
      events: [...state.events, event].slice(-200),
    };
    state = applyCausalConsequences(state, event);
    state = ensureWorldState(state);
  }

  return state;
}

export function findNearestSnapshot(
  snapshots: Snapshot[],
  tick: number
): Snapshot | null {
  const candidates = snapshots.filter((snapshot) => snapshot.tick <= tick);
  if (candidates.length === 0) return null;

  candidates.sort((left, right) => right.tick - left.tick);
  return candidates[0];
}

export function getSnapshotsToPrune(
  snapshots: Snapshot[],
  branchId: string
): string[] {
  const branchSnapshots = snapshots
    .filter((snapshot) => snapshot.branchId === branchId)
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );

  if (branchSnapshots.length <= MAX_SNAPSHOTS_PER_BRANCH) {
    return [];
  }

  return branchSnapshots
    .slice(MAX_SNAPSHOTS_PER_BRANCH)
    .map((snapshot) => snapshot.id);
}
