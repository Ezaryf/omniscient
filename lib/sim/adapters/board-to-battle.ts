import type { Agent, BoardLink, BoardLinkType } from "../types";
import type { BattleNode, BattleEdge, RelationType } from "../battle/types";

export interface BoardToBattleResult {
  nodes: BattleNode[];
  edges: BattleEdge[];
  hasExplicitConflicts: boolean;
  warnings: string[];
}

const LINK_TYPE_TO_RELATION: Record<BoardLinkType, RelationType> = {
  alliance: "ally",
  conflict: "foe",
  causal: "neutral",
  dependency: "neutral",
  route: "neutral",
};

export function adaptBoardToBattle(
  agents: Agent[],
  boardLinks: BoardLink[]
): BoardToBattleResult {
  const nodes: BattleNode[] = [];
  const edges: BattleEdge[] = [];
  const warnings: string[] = [];
  let hasExplicitConflicts = false;

  for (const agent of agents) {
    nodes.push({
      id: agent.id,
      type: "agent",
      data: {
        name: agent.name,
        health: agent.state.health * 100,
        aggression: agent.traits.aggression,
        courage: 1 - agent.traits.loyalty,
        loyalty: agent.traits.loyalty,
        fear: 0,
      },
    });
  }

  const agentIds = new Set(agents.map((a) => a.id));

  for (const link of boardLinks) {
    const sourceId = link.source.type === "agent" ? link.source.id : null;
    const targetId = link.target.type === "agent" ? link.target.id : null;

    if (!sourceId || !targetId || !agentIds.has(sourceId) || !agentIds.has(targetId)) {
      continue;
    }

    const relation = LINK_TYPE_TO_RELATION[link.type];
    
    edges.push({
      id: link.id,
      source: sourceId,
      target: targetId,
      label: relation,
    });

    if (relation === "foe") {
      hasExplicitConflicts = true;
    }
  }

  if (!hasExplicitConflicts) {
    warnings.push(
      "No explicit conflicts defined. Agents may form hostilities dynamically."
    );
  }

  return {
    nodes,
    edges,
    hasExplicitConflicts,
    warnings,
  };
}

export function inferMissingRelationships(
  nodes: BattleNode[],
  edges: BattleEdge[]
): BattleEdge[] {
  const nodeIds = nodes.map((n) => n.id);
  const existingEdges = new Set(
    edges.map((e) => `${e.source}-${e.target}`)
  );

  const additionalEdges: BattleEdge[] = [];

  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      const a = nodeIds[i];
      const b = nodeIds[j];
      const key1 = `${a}-${b}`;
      const key2 = `${b}-${a}`;

      if (!existingEdges.has(key1) && !existingEdges.has(key2)) {
        additionalEdges.push({
          source: a,
          target: b,
          label: undefined,
        });
      }
    }
  }

  return additionalEdges;
}
