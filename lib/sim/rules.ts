import type {
  Agent,
  EventImpact,
  Modifier,
  RuleSet,
  WorldState,
} from "./types";
import { chance, pickRandom, randomInRange } from "./seed";
import { clamp } from "./relationships";
import { createCausalEvent } from "./campaign";

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

    return {
      ...agent,
      resources,
      state: {
        ...agent.state,
        morale: clamp(agent.state.morale - rules.scarcity * 0.02, 0, 1),
      },
    };
  });
}

export function generateShockEvents(
  worldState: WorldState,
  rng: () => number
) {
  if (!chance(worldState.rules.shockLikelihood, rng)) {
    return [];
  }

  const aliveAgents = worldState.agents.filter((agent) => agent.status === "alive");
  if (aliveAgents.length === 0) return [];

  const target = pickRandom(aliveAgents, rng);
  const severity = randomInRange(0.1, 0.5, rng);
  const shockType = pickRandom(["natural_event", "conflict", "trade"] as const, rng);

  const impacts: EventImpact[] = [
    { targetId: target.id, targetKind: "agent", field: "morale", delta: -severity * 0.3 },
    { targetId: target.id, targetKind: "agent", field: "wealth", delta: -severity * 20 },
  ];

  const descriptions: Record<typeof shockType, string[]> = {
    natural_event: [
      `A flood swallows the roads near ${target.name}'s territory`,
      `A drought withers the stores feeding ${target.name}'s people`,
      `An earthquake destabilizes ${target.name}'s power base`,
    ],
    conflict: [
      `A border raid erupts near ${target.name}'s sphere of control`,
      `Rebels challenge ${target.name}'s authority in the frontier`,
      `Mercenaries strike ${target.name}'s supply chain`,
    ],
    trade: [
      `${target.name}'s trade web snaps under sudden pressure`,
      `A market collapse undercuts ${target.name}'s treasury`,
      `A caravan shortage isolates ${target.name}'s allies`,
    ],
  };

  return [
    createCausalEvent(worldState, {
      tick: worldState.tick,
      type: shockType,
      description: pickRandom(descriptions[shockType], rng),
      targetAgentId: target.id,
      targetIds: [target.id],
      impact: impacts,
      confidence: 0.88,
      tags: [shockType, "shock", target.factionId],
      metadata: { severity, shockType },
      sequence: 80,
    }),
  ];
}

export function applyEventImpacts(
  agents: Agent[],
  impacts: EventImpact[],
  activeModifiers: Modifier[] = []
): Agent[] {
  const impactMap = new Map<string, EventImpact[]>();
  for (const impact of impacts) {
    if (impact.targetKind !== "agent") continue;
    const existing = impactMap.get(impact.targetId) ?? [];
    existing.push(impact);
    impactMap.set(impact.targetId, existing);
  }

  return agents.map((agent) => {
    const agentImpacts = impactMap.get(agent.id);
    if (!agentImpacts && activeModifiers.length === 0) return agent;

    let updated = { ...agent };
    for (const impact of agentImpacts ?? []) {
      updated = applyImpactWithModifiers(updated, impact, activeModifiers);
    }

    return updated;
  });
}

function applyImpactWithModifiers(
  agent: Agent,
  impact: EventImpact,
  modifiers: Modifier[]
): Agent {
  let delta = impact.delta;

  for (const modifier of modifiers) {
    const globalMatch = modifier.type === "global";
    const factionMatch = modifier.type === "faction" && modifier.targetId === agent.factionId;

    if ((globalMatch || factionMatch) && modifier.field === impact.field) {
      delta = delta * modifier.multiplier + modifier.offset;
    }
  }

  return applyImpactToAgent(agent, { ...impact, delta });
}

function applyImpactToAgent(agent: Agent, impact: EventImpact): Agent {
  const stateFields = ["health", "morale", "influence", "wealth"];

  if (stateFields.includes(impact.field)) {
    const key = impact.field as keyof typeof agent.state;
    const min = key === "health" || key === "morale" ? 0 : -Infinity;
    const max = key === "health" || key === "morale" ? 1 : Infinity;

    return {
      ...agent,
      state: {
        ...agent.state,
        [key]: clamp(agent.state[key] + impact.delta, min, max),
      },
    };
  }

  if (impact.field in agent.resources) {
    return {
      ...agent,
      resources: {
        ...agent.resources,
        [impact.field]: Math.max(0, agent.resources[impact.field] + impact.delta),
      },
    };
  }

  return agent;
}

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
  if (
    patch.aiConfidenceFloor !== undefined &&
    (patch.aiConfidenceFloor < 0 || patch.aiConfidenceFloor > 1)
  ) {
    errors.push("aiConfidenceFloor must be between 0 and 1");
  }

  return { valid: errors.length === 0, errors };
}
