/**
 * Relationship graph operations.
 * Updates trust/influence/tension, applies decay, propagates contagion.
 */

import type { RelationshipEdge, RuleSet } from "./types";

export function applyTrustDecay(
  relationships: RelationshipEdge[],
  rules: RuleSet,
  tick: number
): RelationshipEdge[] {
  return relationships.map((rel) => ({
    ...rel,
    trust: clamp(rel.trust * (1 - rules.trustDecay * 1.5), -1, 1),
    tension: clamp(rel.tension * (1 - rules.trustDecay * 0.1), 0, 1),
    lastUpdatedTick: tick,
  }));
}

/**
 * Update a specific relationship after an event.
 */
export function updateRelationship(
  rel: RelationshipEdge,
  deltas: { trust?: number; influence?: number; tension?: number },
  tick: number
): RelationshipEdge {
  return {
    ...rel,
    trust: clamp(rel.trust + (deltas.trust ?? 0), -1, 1),
    influence: clamp(rel.influence + (deltas.influence ?? 0), 0, 1),
    tension: clamp(rel.tension + (deltas.tension ?? 0), 0, 1),
    lastUpdatedTick: tick,
  };
}

/**
 * Propagate contagion: when a relationship's tension exceeds a threshold,
 * neighboring relationships also gain tension proportional to `contagion`.
 */
export function propagateContagion(
  relationships: RelationshipEdge[],
  rules: RuleSet,
  tick: number
): RelationshipEdge[] {
  const tensionThreshold = 0.6;
  const highTension = relationships.filter(
    (r) => r.tension > tensionThreshold
  );
  if (highTension.length === 0) return relationships;

  // Build a map of max tension per agent
  const agentTension = new Map<string, number>();
  for (const r of highTension) {
    agentTension.set(r.sourceAgentId, Math.max(r.tension, agentTension.get(r.sourceAgentId) ?? 0));
    agentTension.set(r.targetAgentId, Math.max(r.tension, agentTension.get(r.targetAgentId) ?? 0));
  }

  return relationships.map((rel) => {
    // Avoid re-infecting relationships that are already the source of high tension
    if (rel.tension > tensionThreshold) return rel;

    let maxSourceTension = 0;
    if (agentTension.has(rel.sourceAgentId)) maxSourceTension = Math.max(maxSourceTension, agentTension.get(rel.sourceAgentId)!);
    if (agentTension.has(rel.targetAgentId)) maxSourceTension = Math.max(maxSourceTension, agentTension.get(rel.targetAgentId)!);

    if (maxSourceTension > 0) {
      // Radial falloff: contagion is stronger when the source tension is very high
      const intensity = (maxSourceTension - tensionThreshold) * rules.contagion;
      return {
        ...rel,
        tension: clamp(rel.tension + intensity * 0.2, 0, 1),
        trust: clamp(rel.trust - intensity * 0.1, -1, 1),
        lastUpdatedTick: tick,
      };
    }
    return rel;
  });
}

/**
 * Find all relationships involving a specific agent.
 */
export function getAgentRelationships(
  relationships: RelationshipEdge[],
  agentId: string
): RelationshipEdge[] {
  return relationships.filter(
    (r) => r.sourceAgentId === agentId || r.targetAgentId === agentId
  );
}

/**
 * Get the relationship between two specific agents (directional).
 */
export function getRelationshipBetween(
  relationships: RelationshipEdge[],
  sourceId: string,
  targetId: string
): RelationshipEdge | undefined {
  return relationships.find(
    (r) => r.sourceAgentId === sourceId && r.targetAgentId === targetId
  );
}

/**
 * Clamp a number to [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export { clamp };
