import type { ActionProposal, Agent, AgentIntent, RelationshipEdge, WorldState } from "./types";
import { chance, pickRandom, randomInRange } from "./seed";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function topGoal(agent: Agent) {
  return [...agent.goals]
    .filter((goal) => goal.status === "active")
    .sort((left, right) => right.priority - left.priority)[0] ?? null;
}

function findRelationship(
  relationships: RelationshipEdge[],
  sourceId: string,
  targetId: string
) {
  return relationships.find(
    (entry) =>
      (entry.sourceAgentId === sourceId && entry.targetAgentId === targetId) ||
      (entry.sourceAgentId === targetId && entry.targetAgentId === sourceId)
  );
}

function inferIntentKind(agent: Agent, worldState: WorldState): AgentIntent["kind"] {
  const goal = topGoal(agent);
  const recentThreat = [...worldState.events]
    .reverse()
    .find((event) => event.targetIds.includes(agent.id) && (event.type === "conflict" || event.type === "betrayal"));
  if (recentThreat) return "retaliate";
  if (agent.state.health < 0.35 || agent.state.morale < 0.35) return "recover";
  const label = goal?.label.toLowerCase() ?? "";
  if (/(ally|pact|accord|peace|treaty|negot)/.test(label)) return "negotiate";
  if (/(trade|market|wealth|coin|resource)/.test(label)) return "trade";
  if (/(defend|hold|protect|secure)/.test(label)) return "defend";
  if (/(explore|discover|travel|reach)/.test(label)) return "explore";
  if (/(stabil|calm|repair|recover)/.test(label)) return "stabilize";
  if (agent.traits.aggression > 0.65) return "attack";
  if (agent.traits.diplomacy > 0.6) return "ally";
  return "gather";
}

function selectIntentTargets(agent: Agent, worldState: WorldState, kind: AgentIntent["kind"], rng: () => number) {
  const others = worldState.agents.filter((candidate) => candidate.id !== agent.id && candidate.status === "alive");
  if (others.length === 0) return [];
  const sorted = others
    .map((candidate) => {
      const relationship = findRelationship(worldState.relationships, agent.id, candidate.id);
      return {
        id: candidate.id,
        score:
          (relationship?.influence ?? 0.2) +
          (kind === "attack" || kind === "retaliate" ? relationship?.tension ?? 0 : 0) +
          (kind === "ally" || kind === "negotiate" ? relationship?.trust ?? 0 : 0) +
          rng() * 0.2,
      };
    })
    .sort((left, right) => right.score - left.score);
  return sorted.slice(0, 1).map((entry) => entry.id);
}

export function refreshAgentIntent(agent: Agent, worldState: WorldState, rng: () => number): Agent {
  const goal = topGoal(agent);
  const nextKind = inferIntentKind(agent, worldState);
  const existing = agent.activeIntent;
  const shouldReplace =
    !existing ||
    existing.status !== "active" ||
    existing.kind !== nextKind ||
    (worldState.tick - existing.lastEvaluatedTick > 4 && chance(0.2, rng));

  if (!shouldReplace) {
    return {
      ...agent,
      activeIntent: {
        ...existing,
        lastEvaluatedTick: worldState.tick,
        commitment: clamp(existing.commitment + 0.03, 0, 1),
      },
    };
  }

  const nextIntent: AgentIntent = {
    id: `intent-${agent.id}-${worldState.tick}`,
    kind: nextKind,
    targetIds: selectIntentTargets(agent, worldState, nextKind, rng),
    status: "active",
    priority: goal?.priority ?? 0.5,
    createdTick: worldState.tick,
    lastEvaluatedTick: worldState.tick,
    commitment: clamp((goal?.priority ?? 0.5) + 0.15, 0.2, 1),
    rationale: goal
      ? `Pursuing "${goal.label}" through ${nextKind}.`
      : `Reacting to current pressure through ${nextKind}.`,
    sourceEventId:
      [...worldState.events]
        .reverse()
        .find((event) => event.actorIds.includes(agent.id) || event.targetIds.includes(agent.id))
        ?.id ?? null,
  };

  return {
    ...agent,
    activeIntent: nextIntent,
    intentHistory: existing
      ? [...agent.intentHistory, { ...existing, status: "abandoned" as const }].slice(-10)
      : agent.intentHistory,
  };
}

export function refreshAgentIntents(worldState: WorldState, rng: () => number): WorldState {
  return {
    ...worldState,
    agents: worldState.agents.map((agent) => refreshAgentIntent(agent, worldState, rng)),
  };
}

export function buildProposalFromIntent(
  agent: Agent,
  worldState: WorldState,
  rng: () => number
): ActionProposal | null {
  const intent = agent.activeIntent;
  if (!intent || intent.status !== "active") return null;
  const targetId = intent.targetIds[0] ?? null;
  const relationship = targetId ? findRelationship(worldState.relationships, agent.id, targetId) : null;

  const actionType: ActionProposal["actionType"] =
    intent.kind === "attack" || intent.kind === "retaliate"
      ? chance(0.7, rng) ? "attack" : "defend"
      : intent.kind === "defend" || intent.kind === "stabilize"
        ? "defend"
        : intent.kind === "trade" || intent.kind === "gather"
          ? chance(0.55, rng) ? "trade" : "gather"
          : intent.kind === "ally" || intent.kind === "negotiate"
            ? (relationship?.trust ?? 0) > 0.35 ? "ally" : "negotiate"
            : intent.kind === "recover"
              ? "rest"
              : "explore";

  return {
    agentId: agent.id,
    actionType,
    targetAgentId: targetId,
    rationale: `${intent.rationale} Commitment ${intent.commitment.toFixed(2)}.`,
    confidence: clamp(randomInRange(0.45, 0.85, rng) * Math.max(intent.commitment, 0.45), 0.3, 0.95),
  };
}
