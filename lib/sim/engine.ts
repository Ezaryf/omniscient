/**
 * Core simulation engine — the tick function.
 * Pure, deterministic state transitions.
 * tick(worldState, rng) → TickResult
 */

import type {
  WorldState,
  TickResult,
  SimEvent,
  Agent,
  ActionProposal,
  AgentMemoryEntry,
  Modifier,
} from "./types";
import { SNAPSHOT_FREQUENCY } from "./constants";
import { chance, pickRandom, randomInRange } from "./seed";
import {
  applyTrustDecay,
  propagateContagion,
  updateRelationship,
  getAgentRelationships,
} from "./relationships";
import {
  applyScarcity,
  generateShockEvents,
  applyEventImpacts,
  checkAgentStatus,
} from "./rules";

/**
 * Execute one simulation tick.
 * This is the core game loop step — fully deterministic given the same inputs.
 *
 * @param worldState  Current world state (immutable — new state is returned)
 * @param rng         Seeded random number generator
 * @param aiProposals Optional AI-generated action proposals for this tick
 * @returns TickResult with new world state, generated events, and proposals used
 */
export function tick(
  worldState: WorldState,
  rng: () => number,
  aiProposals?: ActionProposal[]
): TickResult {
  const newTick = worldState.tick + 1;
  const events: SimEvent[] = [];
  const usedProposals: ActionProposal[] = [];

  // 1. Apply trust decay and contagion
  let relationships = applyTrustDecay(
    worldState.relationships,
    worldState.rules,
    newTick
  );
  relationships = propagateContagion(relationships, worldState.rules, newTick);

  // 2. Apply scarcity pressure
  let agents = applyScarcity(worldState.agents, worldState.rules, rng);

  // 3. Process AI proposals or generate heuristic actions
  const proposals = aiProposals ?? generateHeuristicActions(agents, relationships, rng);
  for (const proposal of proposals) {
    const result = resolveProposal(proposal, agents, relationships, newTick, rng);
    agents = result.agents;
    relationships = result.relationships;
    events.push(...result.events);
    usedProposals.push(proposal);
  }

  // 4. Generate shock events
  const shockState: WorldState = {
    ...worldState,
    tick: newTick,
    agents,
    relationships,
  };
  const shocks = generateShockEvents(shockState, rng);
  events.push(...shocks);

  // 5. Apply all event impacts
  const allImpacts = events.flatMap((e) => e.impact);
  agents = applyEventImpacts(agents, allImpacts, worldState.activeModifiers);

  // 6. Check agent status (death, inactivity)
  agents = checkAgentStatus(agents);

  // 7. Record events in agent memory
  agents = recordMemories(agents, events, newTick);

  // 8. Update & Prune Modifiers
  const nextModifiers = worldState.activeModifiers
    .map(m => ({ ...m, remainingTicks: m.remainingTicks - 1 }))
    .filter(m => m.remainingTicks > 0);

  // 9. Random World Shocks
  if (chance(worldState.rules.shockLikelihood, rng)) {
    const shock = createRandomShock(agents, worldState.rules, newTick, rng);
    if (shock) {
      nextModifiers.push(shock.modifier);
      events.push(shock.event);
    }
  }

  // 10. Build new world state
  const newState: WorldState = {
    tick: newTick,
    agents,
    relationships,
    events: [...worldState.events, ...events].slice(-50),
    activeModifiers: nextModifiers,
    rules: worldState.rules,
    seed: worldState.seed,
  };

  return {
    worldState: newState,
    events,
    proposals: usedProposals,
    snapshotCreated: newTick % SNAPSHOT_FREQUENCY === 0,
  };
}

/**
 * Generate heuristic actions for all living agents when AI is unavailable.
 * Uses goal priorities, traits, and relationship state to pick actions.
 */
function generateHeuristicActions(
  agents: Agent[],
  relationships: WorldState["relationships"],
  rng: () => number
): ActionProposal[] {
  const proposals: ActionProposal[] = [];
  const aliveAgents = agents.filter((a) => a.status === "alive");

  for (const agent of aliveAgents) {
    // Not every agent acts every tick
    if (!chance(0.6, rng)) continue;

    const agentRels = getAgentRelationships(relationships, agent.id);
    const topGoal = [...agent.goals]
      .filter((g) => g.status === "active")
      .sort((a, b) => b.priority - a.priority)[0];

    if (!topGoal) continue;

    const proposal = generateAgentAction(
      agent,
      agentRels,
      aliveAgents,
      topGoal,
      rng
    );
    if (proposal) proposals.push(proposal);
  }

  return proposals;
}

function generateAgentAction(
  agent: Agent,
  relationships: WorldState["relationships"],
  allAgents: Agent[],
  topGoal: Agent["goals"][number],
  rng: () => number
): ActionProposal | null {
  const otherAgents = allAgents.filter((a) => a.id !== agent.id);
  if (otherAgents.length === 0) return null;

  const target = pickRandom(otherAgents, rng);
  const rel = relationships.find(
    (r) =>
      (r.sourceAgentId === agent.id && r.targetAgentId === target.id) ||
      (r.targetAgentId === agent.id && r.sourceAgentId === target.id)
  );

  const trust = rel?.trust ?? 0;
  const tension = rel?.tension ?? 0.5;

  // Decide action type based on traits and relationship
  let actionType: ActionProposal["actionType"];

  if (agent.traits.aggression > 0.7 && tension > 0.5) {
    actionType = chance(0.6, rng) ? "attack" : "defend";
  } else if (agent.traits.diplomacy > 0.6 && trust > 0) {
    actionType = chance(0.5, rng) ? "negotiate" : "ally";
  } else if (agent.traits.resourcefulness > 0.6) {
    actionType = chance(0.5, rng) ? "trade" : "gather";
  } else if (tension > 0.7 && trust < -0.3) {
    actionType = "betray";
  } else {
    const fallbackActions: ActionProposal["actionType"][] = [
      "explore",
      "rest",
      "gather",
      "negotiate",
    ];
    actionType = pickRandom(fallbackActions, rng);
  }

  return {
    agentId: agent.id,
    actionType,
    targetAgentId: target.id,
    rationale: `Pursuing "${topGoal.label}" — ${actionType} toward ${target.name}`,
    confidence: randomInRange(0.4, 0.9, rng),
  };
}

/**
 * Resolve an action proposal into state changes and events.
 */
function resolveProposal(
  proposal: ActionProposal,
  agents: Agent[],
  relationships: WorldState["relationships"],
  tick: number,
  rng: () => number
): {
  agents: Agent[];
  relationships: WorldState["relationships"];
  events: SimEvent[];
} {
  const events: SimEvent[] = [];
  let updatedRelationships = [...relationships];

  // Find the interacting agents
  const sourceIndex = agents.findIndex((a) => a.id === proposal.agentId);
  if (sourceIndex === -1) return { agents, relationships: updatedRelationships, events };
  
  const source = agents[sourceIndex];

  let targetIndex = -1;
  let target: Agent | null = null;
  if (proposal.targetAgentId) {
    targetIndex = agents.findIndex((a) => a.id === proposal.targetAgentId);
    if (targetIndex !== -1) {
      target = agents[targetIndex];
      // Ghost Interaction check: If target is dead or health <= 0, abort targeting
      if (target.status === "dead" || target.state.health <= 0) {
        target = null;
      }
    }
  }

  // If the action originally required a target but the target died in-tick, fallback to rest
  const originalAction = proposal.actionType;
  const isTargetRequired = ["attack", "trade", "negotiate", "ally", "betray"].includes(originalAction);
  const actualAction = isTargetRequired && !target ? "rest" : originalAction;

  const actionEffects = getActionEffects(actualAction, rng);

  // Build the event
  const actionVerbs: Record<string, string> = {
    attack: "attacks",
    defend: "defends against",
    trade: "trades with",
    explore: "explores near",
    gather: "gathers resources near",
    negotiate: "negotiates with",
    ally: "allies with",
    betray: "betrays",
    rest: "rests near",
  };
  const verb = actionVerbs[actualAction] || `${actualAction}s`;

  const event: SimEvent = {
    id: `evt-${tick}-${proposal.agentId.slice(-4)}-${rng().toString(36).substring(2, 6)}`,
    tick,
    type: mapActionToEventType(actualAction),
    sourceAgentId: proposal.agentId,
    targetAgentId: target ? target.id : null,
    description: `${source.name} ${verb}${target ? " " + target.name : ""}`,
    impact: actionEffects.impacts.map((i) => ({
      ...i,
      targetId: i.targetId === "source" ? source.id : (target?.id ?? source.id),
    })),
    causeChain: [proposal.rationale],
    metadata: {
      proposalConfidence: proposal.confidence,
      generatedBy: "heuristic",
      ...(actualAction !== originalAction && { note: `Fallback from ${originalAction} due to dead target` })
    },
  };
  events.push(event);

  // Update relationships
  if (target) {
    const relIdx = updatedRelationships.findIndex(
      (r) =>
        (r.sourceAgentId === source.id && r.targetAgentId === target.id) ||
        (r.sourceAgentId === target.id && r.targetAgentId === source.id)
    );
    if (relIdx >= 0) {
      updatedRelationships[relIdx] = updateRelationship(
        updatedRelationships[relIdx],
        actionEffects.relationshipDelta,
        tick
      );
    }
  }

  return { agents, relationships: updatedRelationships, events };
}

function getActionEffects(
  actionType: ActionProposal["actionType"],
  rng: () => number
): {
  impacts: { targetId: string; field: string; delta: number }[];
  relationshipDelta: { trust?: number; influence?: number; tension?: number };
} {
  const mag = randomInRange(0.05, 0.15, rng);

  const effectsMap: Record<
    ActionProposal["actionType"],
    ReturnType<typeof getActionEffects>
  > = {
    negotiate: {
      impacts: [{ targetId: "source", field: "influence", delta: mag * 5 }],
      relationshipDelta: { trust: mag, tension: -mag * 0.5 },
    },
    attack: {
      impacts: [
        { targetId: "target", field: "health", delta: -mag },
        { targetId: "source", field: "morale", delta: mag * 0.5 },
      ],
      relationshipDelta: { trust: -mag * 2, tension: mag },
    },
    defend: {
      impacts: [{ targetId: "source", field: "morale", delta: mag * 0.3 }],
      relationshipDelta: { tension: -mag * 0.3 },
    },
    trade: {
      impacts: [
        { targetId: "source", field: "wealth", delta: mag * 10 },
        { targetId: "target", field: "wealth", delta: mag * 8 },
      ],
      relationshipDelta: { trust: mag * 0.5, tension: -mag * 0.2 },
    },
    ally: {
      impacts: [{ targetId: "source", field: "influence", delta: mag * 3 }],
      relationshipDelta: { trust: mag * 1.5, influence: mag, tension: -mag },
    },
    betray: {
      impacts: [
        { targetId: "target", field: "morale", delta: -mag * 2 },
        { targetId: "source", field: "wealth", delta: mag * 15 },
      ],
      relationshipDelta: { trust: -mag * 3, tension: mag * 2 },
    },
    retreat: {
      impacts: [{ targetId: "source", field: "morale", delta: -mag * 0.5 }],
      relationshipDelta: { tension: -mag * 0.5 },
    },
    gather: {
      impacts: [{ targetId: "source", field: "wealth", delta: mag * 12 }],
      relationshipDelta: {},
    },
    explore: {
      impacts: [{ targetId: "source", field: "influence", delta: mag * 2 }],
      relationshipDelta: {},
    },
    rest: {
      impacts: [
        { targetId: "source", field: "health", delta: mag * 0.5 },
        { targetId: "source", field: "morale", delta: mag * 0.3 },
      ],
      relationshipDelta: {},
    },
  };

  return effectsMap[actionType];
}

function mapActionToEventType(
  actionType: ActionProposal["actionType"]
): SimEvent["type"] {
  const mapping: Record<ActionProposal["actionType"], SimEvent["type"]> = {
    negotiate: "negotiation",
    attack: "conflict",
    defend: "conflict",
    trade: "trade",
    ally: "alliance",
    betray: "betrayal",
    retreat: "action",
    gather: "action",
    explore: "action",
    rest: "action",
  };
  return mapping[actionType];
}

/**
 * Record significant events in agent memory.
 */
function recordMemories(
  agents: Agent[],
  events: SimEvent[],
  tick: number
): Agent[] {
  return agents.map((agent) => {
    const relevantEvents = events.filter(
      (e) =>
        e.sourceAgentId === agent.id || e.targetAgentId === agent.id
    );

    if (relevantEvents.length === 0) return agent;

    const newMemories: AgentMemoryEntry[] = relevantEvents.map((e) => ({
      tick,
      type: e.type,
      description: e.description,
      significance: Math.min(
        1,
        e.impact.reduce((sum, i) => sum + Math.abs(i.delta), 0)
      ),
    }));

    // Keep memory bounded (last 50 entries)
    const memory = [...agent.memory, ...newMemories].slice(-50);

    return { ...agent, memory };
  });
}
function createRandomShock(
  agents: Agent[],
  rules: WorldState["rules"],
  tick: number,
  rng: () => number
): { modifier: Modifier; event: SimEvent } | null {
  const shocks = [
    { id: "famine", name: "Famine", field: "wealth", mul: 0.4, desc: "A severe drought has withered the crops." },
    { id: "boom", name: "Economic Boom", field: "wealth", mul: 2.2, desc: "New trade routes have opened up prosperously." },
    { id: "plague", name: "Plague", field: "health", offset: -0.05, desc: "An unknown sickness is spreading through the lands." },
    { id: "unrest", name: "Civil Unrest", field: "morale", offset: -0.2, desc: "The common folk are protesting the high councils." }
  ];

  const template = pickRandom(shocks, rng);
  const modifier: Modifier = {
    id: `mod-${tick}-${template.id}`,
    type: "global",
    targetId: null,
    field: template.field,
    multiplier: template.mul ?? 1,
    offset: template.offset ?? 0,
    description: template.name,
    remainingTicks: Math.trunc(randomInRange(5, 15, rng)),
  };

  const event: SimEvent = {
    id: `evt-shock-${tick}`,
    tick,
    type: "natural_event",
    sourceAgentId: null,
    targetAgentId: null,
    description: `⚠️ WORLD CRISIS: ${template.name}! ${template.desc}`,
    impact: [],
    causeChain: ["Environmental Shift"],
    metadata: { shockType: template.id }
  };

  return { modifier, event };
}
