/**
 * Deterministic fallback heuristics for when AI is unavailable.
 * Uses goal priority + relationship state + traits to select actions.
 */

import type { Agent, ActionProposal, RelationshipEdge, WorldState } from "../types";
import { pickRandom, chance, randomInRange } from "../seed";
import { buildProposalFromIntent, refreshAgentIntent } from "../intents";

/**
 * Generate a fallback action proposal for an agent.
 * Entirely deterministic given the same RNG state.
 */
export function generateFallbackProposal(
  agent: Agent,
  agents: Agent[],
  relationships: RelationshipEdge[],
  rng: () => number
): ActionProposal | null {
  if (agent.status !== "alive") return null;

  const preparedState = {
    tick: 0,
    agents,
    relationships,
    campaignNodes: [],
    boardLinks: [],
    boardGroups: [],
    map: { id: "map", name: "Campaign Map", regions: [], sites: [], routes: [], tokens: [] },
    fronts: [],
    projections: [],
    gmNotes: [],
    events: [],
    causalityGraph: { parentIdsByEventId: {}, childIdsByEventId: {}, depthByEventId: {} },
    activeModifiers: [],
    rules: {
      scarcity: 0.5,
      trustDecay: 0.01,
      contagion: 0.25,
      shockLikelihood: 0.1,
      maxTicks: 100,
      aiConfidenceFloor: 0.3,
      scenarioIntensity: 0.5,
    },
    seed: 0,
  } satisfies WorldState;
  const preparedAgent = refreshAgentIntent(agent, preparedState, rng);
  const intentProposal = buildProposalFromIntent(preparedAgent, { ...preparedState, agents: agents.map((entry) => entry.id === agent.id ? preparedAgent : entry) }, rng);
  if (intentProposal) return intentProposal;

  const activeGoals = agent.goals.filter((g) => g.status === "active");
  if (activeGoals.length === 0) return null;

  const topGoal = activeGoals.sort((a, b) => b.priority - a.priority)[0];
  const otherAgents = agents.filter(
    (a) => a.id !== agent.id && a.status === "alive"
  );

  if (otherAgents.length === 0) {
    return makeSoloProposal(agent, topGoal, rng);
  }

  // Pick target based on relationship state
  const target = selectTarget(agent, otherAgents, relationships, rng);
  const actionType = selectAction(agent, target, relationships, rng);

  return {
    agentId: agent.id,
    actionType,
    targetAgentId: target.id,
    rationale: `[Heuristic] ${agent.name} pursues "${topGoal.label}" via ${actionType} toward ${target.name}`,
    confidence: randomInRange(0.3, 0.7, rng),
  };
}

function makeSoloProposal(
  agent: Agent,
  goal: Agent["goals"][number],
  rng: () => number
): ActionProposal {
  const soloActions: ActionProposal["actionType"][] = [
    "gather",
    "explore",
    "rest",
  ];
  return {
    agentId: agent.id,
    actionType: pickRandom(soloActions, rng),
    targetAgentId: null,
    rationale: `[Heuristic] ${agent.name} works alone on "${goal.label}"`,
    confidence: randomInRange(0.4, 0.6, rng),
  };
}

function selectTarget(
  agent: Agent,
  candidates: Agent[],
  relationships: RelationshipEdge[],
  rng: () => number
): Agent {
  // Weight selection by relationship relevance
  const scored = candidates.map((c) => {
    const rel = relationships.find(
      (r) =>
        (r.sourceAgentId === agent.id && r.targetAgentId === c.id) ||
        (r.sourceAgentId === c.id && r.targetAgentId === agent.id)
    );

    // Higher score = more interaction-worthy
    const relScore = rel
      ? Math.abs(rel.trust) + rel.tension + rel.influence
      : 0.5;
    return { agent: c, score: relScore + rng() * 0.3 };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].agent;
}

function selectAction(
  agent: Agent,
  target: Agent,
  relationships: RelationshipEdge[],
  rng: () => number
): ActionProposal["actionType"] {
  const rel = relationships.find(
    (r) =>
      (r.sourceAgentId === agent.id && r.targetAgentId === target.id) ||
      (r.sourceAgentId === target.id && r.targetAgentId === agent.id)
  );

  const trust = rel?.trust ?? 0;
  const tension = rel?.tension ?? 0.5;
  const t = agent.traits;

  // Aggressive + high tension → attack
  if (t.aggression > 0.6 && tension > 0.5 && trust < 0) {
    return chance(0.7, rng) ? "attack" : "defend";
  }

  // Diplomatic + positive trust → negotiate or ally
  if (t.diplomacy > 0.5 && trust > 0.2) {
    return chance(0.5, rng) ? "negotiate" : "ally";
  }

  // Resourceful → trade or gather
  if (t.resourcefulness > 0.5) {
    return chance(0.6, rng) ? "trade" : "gather";
  }

  // Very low trust → betray (if disloyal enough)
  if (trust < -0.5 && t.loyalty < 0.4 && chance(0.3, rng)) {
    return "betray";
  }

  // Default: explore or rest
  return chance(0.5, rng) ? "explore" : "rest";
}

/**
 * Generate fallback proposals for all living agents.
 */
export function generateAllFallbacks(
  agents: Agent[],
  relationships: RelationshipEdge[],
  rng: () => number,
  activationRate = 0.6
): ActionProposal[] {
  const proposals: ActionProposal[] = [];

  for (const agent of agents) {
    if (agent.status !== "alive") continue;
    if (!chance(activationRate, rng)) continue;

    const proposal = generateFallbackProposal(
      agent,
      agents,
      relationships,
      rng
    );
    if (proposal) proposals.push(proposal);
  }

  return proposals;
}
