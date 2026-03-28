/**
 * Rule evaluation engine.
 * Applies scarcity, trust decay, contagion, and shock events.
 */

import type {
  Agent,
  WorldState,
  SimEvent,
  RuleSet,
  EventImpact,
  Modifier,
} from "./types";
import { chance, pickRandom, randomInRange } from "./seed";
import { clamp } from "./relationships";

/**
 * Apply scarcity pressure: reduce resources proportional to scarcity level.
 */
export function applyScarcity(
  agents: Agent[],
  rules: RuleSet,
  rng: () => number
): Agent[] {
  return agents.map((agent) => {
    if (agent.status !== "alive") return agent;

    const drain = rules.scarcity * randomInRange(0.01, 0.05, rng);
    const resources = { ...agent.resources };

    for (const key of Object.keys(resources)) {
      resources[key] = Math.max(0, resources[key] - resources[key] * drain);
    }

    const moraleDrain = rules.scarcity * 0.02;
    return {
      ...agent,
      resources,
      state: {
        ...agent.state,
        morale: clamp(agent.state.morale - moraleDrain, 0, 1),
      },
    };
  });
}

/**
 * Generate random shock events based on shockLikelihood.
 */
export function generateShockEvents(
  worldState: WorldState,
  rng: () => number
): SimEvent[] {
  const events: SimEvent[] = [];

  if (!chance(worldState.rules.shockLikelihood, rng)) {
    return events;
  }

  const shockTypes = [
    "natural_event",
    "conflict",
    "trade",
  ] as const;

  const shockType = pickRandom(shockTypes, rng);
  const aliveAgents = worldState.agents.filter((a) => a.status === "alive");

  if (aliveAgents.length === 0) return events;

  const target = pickRandom(aliveAgents, rng);
  const severity = randomInRange(0.1, 0.5, rng);

  const impacts: EventImpact[] = [
    { targetId: target.id, field: "morale", delta: -severity * 0.3 },
    { targetId: target.id, field: "wealth", delta: -severity * 20 },
  ];

  const descriptions: Record<string, string[]> = {
    natural_event: [
      `A devastating flood struck ${target.name}'s territory`,
      `Drought ravages ${target.name}'s farmlands`,
      `An earthquake disrupts ${target.name}'s operations`,
    ],
    conflict: [
      `Border skirmish erupts near ${target.name}'s stronghold`,
      `Rebels challenge ${target.name}'s authority`,
      `Mercenary raid targets ${target.name}'s supply lines`,
    ],
    trade: [
      `${target.name}'s primary trade route collapses`,
      `A market crash hits ${target.name}'s economy`,
      `Essential supply shortage affects ${target.name}`,
    ],
  };

  events.push({
    id: `shock-${worldState.tick}-${rng().toString(36).slice(2, 8)}`,
    tick: worldState.tick,
    type: shockType,
    sourceAgentId: null,
    targetAgentId: target.id,
    description: pickRandom(descriptions[shockType], rng),
    impact: impacts,
    causeChain: ["random_shock"],
    metadata: { severity, shockType },
  });

  return events;
}

/**
 * Apply event impacts to agents.
 */
export function applyEventImpacts(
  agents: Agent[],
  impacts: EventImpact[],
  activeModifiers: Modifier[] = []
): Agent[] {
  const impactMap = new Map<string, EventImpact[]>();
  for (const impact of impacts) {
    const existing = impactMap.get(impact.targetId) ?? [];
    existing.push(impact);
    impactMap.set(impact.targetId, existing);
  }

  return agents.map((agent) => {
    const agentImpacts = impactMap.get(agent.id);
    if (!agentImpacts && activeModifiers.length === 0) return agent;

    let updatedAgent = { ...agent };
    
    // 1. Process explicit impacts
    if (agentImpacts) {
      for (const impact of agentImpacts) {
        updatedAgent = applyImpactWithModifiers(updatedAgent, impact, activeModifiers);
      }
    }

    return updatedAgent;
  });
}

function applyImpactWithModifiers(
  agent: Agent,
  impact: EventImpact,
  modifiers: Modifier[]
): Agent {
  let delta = impact.delta;

  // Apply relevant modifiers
  for (const mod of modifiers) {
    const isGlobal = mod.type === "global";
    const isTargetFaction = mod.type === "faction" && mod.targetId === agent.factionId;

    if ((isGlobal || isTargetFaction) && mod.field === impact.field) {
      delta = delta * mod.multiplier + mod.offset;
    }
  }

  return applyImpactToAgent(agent, { ...impact, delta });
}

function applyImpactToAgent(agent: Agent, impact: EventImpact): Agent {
  const stateFields = ["health", "morale", "influence", "wealth"];
  const field = impact.field;

  if (stateFields.includes(field)) {
    const key = field as keyof typeof agent.state;
    const current = agent.state[key];
    const min = key === "health" || key === "morale" ? 0 : -Infinity;
    const max = key === "health" || key === "morale" ? 1 : Infinity;
    return {
      ...agent,
      state: {
        ...agent.state,
        [key]: clamp(current + impact.delta, min, max),
      },
    };
  }

  if (field in agent.resources) {
    return {
      ...agent,
      resources: {
        ...agent.resources,
        [field]: Math.max(0, agent.resources[field] + impact.delta),
      },
    };
  }

  return agent;
}

/**
 * Check if an agent should die (health <= 0) or become inactive.
 */
export function checkAgentStatus(agents: Agent[]): Agent[] {
  return agents.map((agent) => {
    if (agent.status !== "alive") return agent;
    if (agent.state.health <= 0) {
      return { ...agent, status: "dead" as const };
    }
    if (agent.state.morale <= 0.05 && agent.state.wealth <= 0) {
      return { ...agent, status: "inactive" as const };
    }
    return agent;
  });
}

/**
 * Validate that a rule change doesn't produce invalid state.
 */
export function validateRuleChange(
  patch: Partial<RuleSet>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (patch.scarcity !== undefined && (patch.scarcity < 0 || patch.scarcity > 1)) {
    errors.push("scarcity must be between 0 and 1");
  }
  if (patch.trustDecay !== undefined && (patch.trustDecay < 0 || patch.trustDecay > 0.1)) {
    errors.push("trustDecay must be between 0 and 0.1");
  }
  if (patch.contagion !== undefined && (patch.contagion < 0 || patch.contagion > 1)) {
    errors.push("contagion must be between 0 and 1");
  }
  if (patch.shockLikelihood !== undefined && (patch.shockLikelihood < 0 || patch.shockLikelihood > 1)) {
    errors.push("shockLikelihood must be between 0 and 1");
  }
  if (patch.maxTicks !== undefined && patch.maxTicks < 1) {
    errors.push("maxTicks must be positive");
  }
  if (patch.aiConfidenceFloor !== undefined && (patch.aiConfidenceFloor < 0 || patch.aiConfidenceFloor > 1)) {
    errors.push("aiConfidenceFloor must be between 0 and 1");
  }

  return { valid: errors.length === 0, errors };
}
