import type { CausalityGraph, CausalEvent, WorldState } from "./types";

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function buildCausalityGraph(events: CausalEvent[]): CausalityGraph {
  const parentIdsByEventId: Record<string, string[]> = {};
  const childIdsByEventId: Record<string, string[]> = {};
  const depthByEventId: Record<string, number> = {};

  const byId = new Map(events.map((event) => [event.id, event]));
  const getDepth = (eventId: string, seen = new Set<string>()): number => {
    if (depthByEventId[eventId] !== undefined) return depthByEventId[eventId];
    if (seen.has(eventId)) return 0;
    seen.add(eventId);
    const parents = parentIdsByEventId[eventId] ?? [];
    const depth =
      parents.length === 0
        ? 0
        : Math.max(
            ...parents.map((parentId) => {
              if (!byId.has(parentId)) return 0;
              return getDepth(parentId, new Set(seen)) + 1;
            })
          );
    depthByEventId[eventId] = depth;
    return depth;
  };

  for (const event of events) {
    const parentIds = unique([
      ...(event.parentEventIds ?? []),
      ...(event.causedBy ?? []),
      ...inferParentIdsFromLegacy(events, event),
    ]).filter((id) => id !== event.id);
    parentIdsByEventId[event.id] = parentIds;
    for (const parentId of parentIds) {
      childIdsByEventId[parentId] = unique([
        ...(childIdsByEventId[parentId] ?? []),
        event.id,
      ]);
    }
  }

  for (const event of events) {
    childIdsByEventId[event.id] = childIdsByEventId[event.id] ?? [];
    getDepth(event.id);
  }

  return {
    parentIdsByEventId,
    childIdsByEventId,
    depthByEventId,
  };
}

export function inferParentIdsFromLegacy(events: CausalEvent[], event: CausalEvent): string[] {
  if (!event.causeChain?.length) return [];
  const descriptions = new Set(event.causeChain);
  return events
    .filter((candidate) => candidate.id !== event.id && descriptions.has(candidate.description))
    .map((candidate) => candidate.id);
}

export function getAncestorEventIds(graph: CausalityGraph, eventId: string, limit = 12): string[] {
  const ordered: string[] = [];
  const queue = [...(graph.parentIdsByEventId[eventId] ?? [])];
  const seen = new Set<string>();
  while (queue.length > 0 && ordered.length < limit) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    ordered.push(current);
    queue.push(...(graph.parentIdsByEventId[current] ?? []));
  }
  return ordered;
}

export function getDescendantEventIds(graph: CausalityGraph, eventId: string, limit = 12): string[] {
  const ordered: string[] = [];
  const queue = [...(graph.childIdsByEventId[eventId] ?? [])];
  const seen = new Set<string>();
  while (queue.length > 0 && ordered.length < limit) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    ordered.push(current);
    queue.push(...(graph.childIdsByEventId[current] ?? []));
  }
  return ordered;
}

export function getNearestBranchingAncestor(graph: CausalityGraph, eventId: string): string | null {
  const queue = [...(graph.parentIdsByEventId[eventId] ?? [])];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    const children = graph.childIdsByEventId[current] ?? [];
    if (children.length > 1) return current;
    queue.push(...(graph.parentIdsByEventId[current] ?? []));
  }
  return null;
}

export function getLocalCausalNeighborhood(
  worldState: WorldState,
  eventIds: string[],
  limit = 6
): CausalEvent[] {
  const seedIds = unique(eventIds);
  const expanded = new Set<string>(seedIds);
  for (const eventId of seedIds.slice(0, 3)) {
    getAncestorEventIds(worldState.causalityGraph, eventId, 3).forEach((id) => expanded.add(id));
    getDescendantEventIds(worldState.causalityGraph, eventId, 2).forEach((id) => expanded.add(id));
  }
  return worldState.events
    .filter((event) => expanded.has(event.id))
    .sort((left, right) => right.tick - left.tick)
    .slice(0, limit);
}
