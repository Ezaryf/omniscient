import type {
  ActionProposal,
  Agent,
  BoardLink,
  AgentMemoryEntry,
  CausalEvent,
  Modifier,
  TickResult,
  WorldState,
} from "./types";
import { SNAPSHOT_FREQUENCY } from "./constants";
import { chance, pickRandom, randomInRange } from "./seed";
import {
  applyCausalConsequences,
  createCausalEvent,
  ensureWorldState,
  findRegionForAgent,
} from "./campaign";
import {
  applyTrustDecay,
  clamp,
  propagateContagion,
  updateRelationship,
} from "./relationships";
import {
  applyEventImpacts,
  applyScarcity,
  checkAgentStatus,
  generateShockEvents,
} from "./rules";
import { buildProposalFromIntent, refreshAgentIntents } from "./intents";

export function tick(
  worldState: WorldState,
  rng: () => number,
  aiProposals?: ActionProposal[]
): TickResult {
  const normalized = ensureWorldState(worldState);
  const newTick = normalized.tick + 1;
  const events: CausalEvent[] = [];
  const usedProposals: ActionProposal[] = [];

  let relationships = applyTrustDecay(
    normalized.relationships,
    normalized.rules,
    newTick
  );
  relationships = propagateContagion(relationships, normalized.rules, newTick);

  const agents = applyScarcity(normalized.agents, normalized.rules, rng);
  const nextModifiers = normalized.activeModifiers
    .map((modifier) => ({
      ...modifier,
      remainingTicks: modifier.remainingTicks - 1,
    }))
    .filter((modifier) => modifier.remainingTicks > 0);

  let eventContext = ensureWorldState({
    ...normalized,
    tick: newTick,
    agents,
    relationships,
    activeModifiers: nextModifiers,
  });
  eventContext = refreshAgentIntents(eventContext, rng);

  const proposals =
    aiProposals ?? generateHeuristicActions(eventContext, rng);

  for (const [sequence, proposal] of proposals.entries()) {
    const result = resolveProposal(proposal, eventContext, newTick, sequence, rng);
    relationships = result.relationships;
    eventContext = ensureWorldState({
      ...eventContext,
      relationships,
      events: [...eventContext.events, ...result.events].slice(-160),
    });
    events.push(...result.events);
    usedProposals.push(proposal);
  }

  const shocks = generateShockEvents(eventContext, rng);
  if (shocks.length > 0) {
    events.push(...shocks);
    eventContext = ensureWorldState({
      ...eventContext,
      events: [...eventContext.events, ...shocks].slice(-160),
    });
  }

  if (chance(normalized.rules.shockLikelihood, rng)) {
    const shock = createRandomShock(eventContext, newTick, rng);
    if (shock) {
      nextModifiers.push(shock.modifier);
      events.push(shock.event);
      eventContext = ensureWorldState({
        ...eventContext,
        activeModifiers: nextModifiers,
        events: [...eventContext.events, shock.event].slice(-160),
      });
    }
  }

  let finalState = ensureWorldState({
    ...eventContext,
    activeModifiers: nextModifiers,
    events: [...normalized.events].slice(-160),
  });

  finalState = {
    ...finalState,
    agents: applyEventImpacts(finalState.agents, events.flatMap((event) => event.impact), normalized.activeModifiers),
  };
  finalState = {
    ...finalState,
    agents: checkAgentStatus(finalState.agents),
  };
  finalState = {
    ...finalState,
    agents: recordMemories(finalState.agents, events, newTick),
  };
  finalState = refreshAgentIntents(finalState, rng);

  for (const event of events) {
    finalState = ensureWorldState({
      ...finalState,
      events: [...finalState.events, event].slice(-160),
    });
    finalState = applyCausalConsequences(finalState, event);
  }

  finalState = ensureWorldState({
    ...finalState,
    tick: newTick,
    relationships,
    activeModifiers: nextModifiers,
  });

  return {
    worldState: finalState,
    events,
    proposals: usedProposals,
    snapshotCreated: newTick % SNAPSHOT_FREQUENCY === 0,
  };
}

function generateHeuristicActions(
  worldState: WorldState,
  rng: () => number
): ActionProposal[] {
  const proposals: ActionProposal[] = [];
  const aliveAgents = worldState.agents.filter((agent) => agent.status === "alive");

  for (const agent of aliveAgents) {
    if (!chance(0.62, rng)) continue;
    const proposal = applyBoardLinkBias(buildProposalFromIntent(agent, worldState, rng), worldState, rng);
    if (proposal) proposals.push(proposal);
  }

  return proposals;
}

function findAgentBoardLink(
  boardLinks: BoardLink[],
  sourceAgentId: string,
  targetAgentId: string
) {
  return boardLinks.find(
    (link) =>
      link.source.type === "agent" &&
      link.target.type === "agent" &&
      ((link.source.id === sourceAgentId && link.target.id === targetAgentId) ||
        (link.source.id === targetAgentId && link.target.id === sourceAgentId))
  );
}

function applyBoardLinkBias(
  proposal: ActionProposal | null,
  worldState: WorldState,
  rng: () => number
): ActionProposal | null {
  if (!proposal || !proposal.targetAgentId) return proposal;

  const link = findAgentBoardLink(worldState.boardLinks ?? [], proposal.agentId, proposal.targetAgentId);
  if (!link) return proposal;

  switch (link.type) {
    case "alliance":
      return {
        ...proposal,
        actionType: chance(0.72, rng) ? "ally" : "negotiate",
        confidence: clamp(proposal.confidence + 0.18, 0.3, 0.98),
        rationale: `${proposal.rationale} Board connection marks this relationship as allied.`,
      };
    case "conflict":
      return {
        ...proposal,
        actionType: chance(0.72, rng) ? "attack" : "defend",
        confidence: clamp(proposal.confidence + 0.2, 0.3, 0.98),
        rationale: `${proposal.rationale} Board connection marks this relationship as hostile.`,
      };
    case "dependency":
      return {
        ...proposal,
        actionType: chance(0.6, rng) ? "trade" : "defend",
        confidence: clamp(proposal.confidence + 0.12, 0.3, 0.98),
        rationale: `${proposal.rationale} Board connection marks this relationship as dependent.`,
      };
    case "causal":
      return {
        ...proposal,
        confidence: clamp(proposal.confidence + 0.08, 0.3, 0.98),
        rationale: `${proposal.rationale} Board connection marks this relationship as influential.`,
      };
    default:
      return proposal;
  }
}

function resolveProposal(
  proposal: ActionProposal,
  state: WorldState,
  tick: number,
  sequence: number,
  rng: () => number
): {
  relationships: WorldState["relationships"];
  events: CausalEvent[];
} {
  const source = state.agents.find((agent) => agent.id === proposal.agentId);
  if (!source) {
    return { relationships: state.relationships, events: [] };
  }

  let target = proposal.targetAgentId
    ? state.agents.find((agent) => agent.id === proposal.targetAgentId) ?? null
    : null;

  if (target && (target.status === "dead" || target.state.health <= 0)) {
    target = null;
  }

  const originalAction = proposal.actionType;
  const targetRequired = ["attack", "trade", "negotiate", "ally", "betray"].includes(originalAction);
  const actionType = targetRequired && !target ? "rest" : originalAction;
  const effects = getActionEffects(actionType, rng);
  const sourceRegion = findRegionForAgent(state.map, source);
  const targetRegion = target ? findRegionForAgent(state.map, target) : null;

  const verbMap: Record<ActionProposal["actionType"], string> = {
    attack: "strikes",
    defend: "fortifies against",
    trade: "opens trade with",
    explore: "scouts",
    gather: "secures resources around",
    negotiate: "negotiates with",
    ally: "forms an accord with",
    betray: "betrays",
    retreat: "withdraws from",
    rest: "regroups in",
  };

  const subject = target?.name ?? sourceRegion?.name ?? "the region";
  const description = `${source.name} ${verbMap[actionType]} ${subject}`.trim();

  let relationships = [...state.relationships];
  if (target) {
    const index = relationships.findIndex(
      (entry) =>
        (entry.sourceAgentId === source.id && entry.targetAgentId === target.id) ||
        (entry.sourceAgentId === target.id && entry.targetAgentId === source.id)
    );

    if (index >= 0) {
      relationships[index] = updateRelationship(
        relationships[index],
        effects.relationshipDelta,
        tick
      );
    }
  }

  const event = createCausalEvent(state, {
    tick,
    type: mapActionToEventType(actionType),
    description,
    sourceAgentId: source.id,
    targetAgentId: target?.id ?? null,
    impact: effects.impacts.map((impact) => ({
      ...impact,
      targetId:
        impact.targetId === "source"
          ? source.id
          : impact.targetId === "target" && target
            ? target.id
            : source.id,
    })),
    confidence: proposal.confidence,
    tags: uniqueTags([
      actionType,
      source.factionId,
      target?.factionId,
      sourceRegion?.id,
      targetRegion?.id,
    ]),
    metadata: {
      generatedBy: "heuristic",
      proposalConfidence: proposal.confidence,
      rationale: proposal.rationale,
      sequence,
      originalAction,
      fallbackApplied: actionType !== originalAction,
    },
    sequence,
  });

  return {
    relationships,
    events: [event],
  };
}

function uniqueTags(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function getActionEffects(
  actionType: ActionProposal["actionType"],
  rng: () => number
): {
  impacts: Array<{ targetId: "source" | "target"; targetKind: "agent"; field: string; delta: number }>;
  relationshipDelta: { trust?: number; influence?: number; tension?: number };
} {
  const magnitude = randomInRange(0.05, 0.15, rng);

  const effects: Record<
    ActionProposal["actionType"],
    {
      impacts: Array<{ targetId: "source" | "target"; targetKind: "agent"; field: string; delta: number }>;
      relationshipDelta: { trust?: number; influence?: number; tension?: number };
    }
  > = {
    negotiate: {
      impacts: [{ targetId: "source", targetKind: "agent", field: "influence", delta: magnitude * 5 }],
      relationshipDelta: { trust: magnitude, tension: -magnitude * 0.5 },
    },
    attack: {
      impacts: [
        { targetId: "target", targetKind: "agent", field: "health", delta: -magnitude },
        { targetId: "source", targetKind: "agent", field: "morale", delta: magnitude * 0.45 },
      ],
      relationshipDelta: { trust: -magnitude * 2, tension: magnitude },
    },
    defend: {
      impacts: [{ targetId: "source", targetKind: "agent", field: "morale", delta: magnitude * 0.3 }],
      relationshipDelta: { tension: -magnitude * 0.3 },
    },
    trade: {
      impacts: [
        { targetId: "source", targetKind: "agent", field: "wealth", delta: magnitude * 10 },
        { targetId: "target", targetKind: "agent", field: "wealth", delta: magnitude * 8 },
      ],
      relationshipDelta: { trust: magnitude * 0.5, tension: -magnitude * 0.2 },
    },
    ally: {
      impacts: [{ targetId: "source", targetKind: "agent", field: "influence", delta: magnitude * 3 }],
      relationshipDelta: { trust: magnitude * 1.5, influence: magnitude, tension: -magnitude },
    },
    betray: {
      impacts: [
        { targetId: "target", targetKind: "agent", field: "morale", delta: -magnitude * 2 },
        { targetId: "source", targetKind: "agent", field: "wealth", delta: magnitude * 15 },
      ],
      relationshipDelta: { trust: -magnitude * 3, tension: magnitude * 2 },
    },
    retreat: {
      impacts: [{ targetId: "source", targetKind: "agent", field: "morale", delta: -magnitude * 0.5 }],
      relationshipDelta: { tension: -magnitude * 0.45 },
    },
    gather: {
      impacts: [{ targetId: "source", targetKind: "agent", field: "wealth", delta: magnitude * 12 }],
      relationshipDelta: {},
    },
    explore: {
      impacts: [{ targetId: "source", targetKind: "agent", field: "influence", delta: magnitude * 2 }],
      relationshipDelta: {},
    },
    rest: {
      impacts: [
        { targetId: "source", targetKind: "agent", field: "health", delta: magnitude * 0.45 },
        { targetId: "source", targetKind: "agent", field: "morale", delta: magnitude * 0.3 },
      ],
      relationshipDelta: {},
    },
  };

  return effects[actionType];
}

function mapActionToEventType(actionType: ActionProposal["actionType"]): CausalEvent["type"] {
  const mapping: Record<ActionProposal["actionType"], CausalEvent["type"]> = {
    negotiate: "negotiation",
    attack: "conflict",
    defend: "conflict",
    trade: "trade",
    ally: "alliance",
    betray: "betrayal",
    retreat: "movement",
    gather: "supply",
    explore: "travel",
    rest: "action",
  };

  return mapping[actionType];
}

function recordMemories(
  agents: Agent[],
  events: CausalEvent[],
  tick: number
): Agent[] {
  return agents.map((agent) => {
    const relevant = events.filter(
      (event) => event.sourceAgentId === agent.id || event.targetAgentId === agent.id
    );

    if (relevant.length === 0) return agent;

    const memories: AgentMemoryEntry[] = relevant.map((event) => ({
      tick,
      type: event.type,
      description: event.description,
      significance: clamp(
        event.impact.reduce((sum, impact) => sum + Math.abs(impact.delta), 0),
        0,
        1
      ),
    }));

    return {
      ...agent,
      memory: [...agent.memory, ...memories].slice(-50),
    };
  });
}

function createRandomShock(
  state: WorldState,
  tick: number,
  rng: () => number
): { modifier: Modifier; event: CausalEvent } | null {
  const templates = [
    {
      id: "famine",
      name: "Famine",
      field: "wealth",
      multiplier: 0.45,
      description: "A harvest failure ripples through every frontier granary.",
      tags: ["scarcity", "supply"],
    },
    {
      id: "boom",
      name: "Trade Boom",
      field: "wealth",
      multiplier: 1.9,
      description: "A sudden market opening floods the routes with coin.",
      tags: ["trade", "opportunity"],
    },
    {
      id: "plague",
      name: "Plague",
      field: "health",
      offset: -0.05,
      description: "A mysterious sickness spreads through camps and markets.",
      tags: ["plague", "collapse"],
    },
    {
      id: "unrest",
      name: "Civil Unrest",
      field: "morale",
      offset: -0.18,
      description: "Commoners and levies alike are beginning to resist authority.",
      tags: ["unrest", "front"],
    },
  ] as const;

  const template = pickRandom(templates, rng);
  const modifier: Modifier = {
    id: `mod-${tick}-${template.id}`,
    type: "global",
    targetId: null,
    field: template.field,
    multiplier: "multiplier" in template ? template.multiplier : 1,
    offset: "offset" in template ? template.offset : 0,
    description: template.name,
    remainingTicks: Math.trunc(randomInRange(5, 15, rng)),
  };

  const event = createCausalEvent(state, {
    tick,
    type: "natural_event",
    description: `${template.name}: ${template.description}`,
    impact: [],
    confidence: 0.92,
    tags: [...template.tags],
    metadata: {
      shockType: template.id,
      modifierId: modifier.id,
    },
    sequence: 99,
  });

  return { modifier, event };
}
