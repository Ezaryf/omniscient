/**
 * Prompt construction for AI calls.
 * Builds structured prompts for action proposals, explanations, and narratives.
 */

import type { Agent, WorldState } from "@/lib/sim/types";

/**
 * Build a prompt for an agent's action proposal.
 */
export function buildActionPrompt(
  agent: Agent,
  worldState: WorldState
): string {
  const agentRels = worldState.relationships.filter(
    (r) => r.sourceAgentId === agent.id || r.targetAgentId === agent.id
  );
  const recentEvents = worldState.events
    .filter(
      (e) => e.sourceAgentId === agent.id || e.targetAgentId === agent.id
    )
    .slice(-5);

  return `You are simulating the decision-making of an agent in a multi-agent geopolitical simulation.

## Agent Profile
- Name: ${agent.name}
- Type: ${agent.type}
- Faction: ${agent.factionId}
- Status: ${agent.status}
- Health: ${agent.state.health.toFixed(2)}
- Morale: ${agent.state.morale.toFixed(2)}
- Influence: ${agent.state.influence.toFixed(0)}
- Wealth: ${agent.state.wealth.toFixed(0)}

## Traits
- Aggression: ${agent.traits.aggression}
- Diplomacy: ${agent.traits.diplomacy}
- Resourcefulness: ${agent.traits.resourcefulness}
- Loyalty: ${agent.traits.loyalty}
- Adaptability: ${agent.traits.adaptability}

## Active Goals
${agent.goals
  .filter((g) => g.status === "active")
  .map((g) => `- ${g.label} (priority: ${g.priority}, progress: ${g.progress})`)
  .join("\n")}

## Relationships
${agentRels
  .map((r) => {
    const otherId =
      r.sourceAgentId === agent.id ? r.targetAgentId : r.sourceAgentId;
    const other = worldState.agents.find((a) => a.id === otherId);
    return `- ${other?.name ?? otherId}: trust=${r.trust.toFixed(2)}, influence=${r.influence.toFixed(2)}, tension=${r.tension.toFixed(2)}`;
  })
  .join("\n")}

## Recent Events
${recentEvents.map((e) => `- [Tick ${e.tick}] ${e.description}`).join("\n") || "None"}

## World Rules
- Scarcity: ${worldState.rules.scarcity}
- Current Tick: ${worldState.tick}

## Active World Scenarios
${worldState.activeModifiers
  .filter(m => m.type === "global" || (m.type === "faction" && m.targetId === agent.factionId))
  .map(m => `- ${m.description}: ${m.field} is modified (multiplier: ${m.multiplier}, offset: ${m.offset}, ticks remaining: ${m.remainingTicks})`)
  .join("\n") || "None"}

## Instructions
Choose ONE action for this agent. Respond with ONLY valid JSON matching this schema:
{
  "agentId": "${agent.id}",
  "actionType": "negotiate" | "attack" | "defend" | "trade" | "ally" | "betray" | "retreat" | "gather" | "explore" | "rest",
  "targetAgentId": "<agent-id or null>",
  "rationale": "<brief explanation, max 500 chars>",
  "confidence": <0.0 to 1.0>
}

Consider the agent's personality, goals, relationships, and current situation.`;
}

/**
 * Build a prompt for explaining why an event happened.
 */
export function buildExplanationPrompt(
  eventDescription: string,
  worldState: WorldState
): string {
  const recentContext = worldState.events.slice(-10);
  const relevantAgentIds = new Set<string>();
  
  recentContext.forEach(e => {
    if (e.sourceAgentId) relevantAgentIds.add(e.sourceAgentId);
    if (e.targetAgentId) relevantAgentIds.add(e.targetAgentId);
  });

  const relevantAgents = worldState.agents.filter(a => relevantAgentIds.has(a.id));

  return `You are an analyst explaining events in a multi-agent simulation.

## Event to Explain
${eventDescription}

## Recent Context (last 10 events)
${recentContext.map((e) => `- [Tick ${e.tick}] ${e.description}`).join("\n")}

## Relevant Agent States
${relevantAgents.map((a) => `- ${a.name} (${a.type}, ${a.factionId}): health=${a.state.health.toFixed(2)}, morale=${a.state.morale.toFixed(2)}`).join("\n")}

## Instructions
Explain why this event occurred, citing specific previous events and agent states as evidence. Be concise (max 3 sentences). Respond with ONLY valid JSON:
{
  "title": "<short title>",
  "summary": "<explanation citing evidence>",
  "evidence": ["<event/state reference 1>", "<event/state reference 2>"],
  "confidence": <0.0 to 1.0>
}`;
}

/**
 * Build a prompt for generating a narrative summary of a branch.
 */
export function buildNarrativePrompt(worldState: WorldState): string {
  return `You are a historian narrating events in a multi-agent geopolitical simulation.

## Current State (Tick ${worldState.tick})

### Active Agents
${worldState.agents
  .filter((a) => a.status === "alive")
  .map(
    (a) =>
      `- ${a.name} (${a.type}, ${a.factionId}): influence=${a.state.influence.toFixed(0)}, wealth=${a.state.wealth.toFixed(0)}, morale=${a.state.morale.toFixed(2)}`
  )
  .join("\n")}

### Key Events (last 20)
${worldState.events
  .slice(-20)
  .map((e) => `- [Tick ${e.tick}] ${e.description}`)
  .join("\n")}

### Relationship Summary
${worldState.relationships
  .filter((r) => Math.abs(r.trust) > 0.3 || r.tension > 0.5)
  .map((r) => {
    const src = worldState.agents.find((a) => a.id === r.sourceAgentId);
    const tgt = worldState.agents.find((a) => a.id === r.targetAgentId);
    return `- ${src?.name} → ${tgt?.name}: trust=${r.trust.toFixed(2)}, tension=${r.tension.toFixed(2)}`;
  })
  .join("\n")}

## Instructions
Write a 2-3 paragraph narrative summary of the current state of this world. Focus on power dynamics, emerging alliances/conflicts, and what might happen next. Respond with ONLY valid JSON:
{
  "title": "<narrative title>",
  "summary": "<narrative paragraphs>",
  "evidence": ["<cited event 1>", "<cited event 2>"],
  "confidence": <0.0 to 1.0>
}`;
}

/**
 * Build a prompt for a group of agents (e.g., a faction) to decide their actions together.
 */
export function buildGroupActionPrompt(
  factionId: string,
  agents: Agent[],
  worldState: WorldState
): string {
  const agentDetails = agents.map(agent => {
    const rels = worldState.relationships.filter(r => r.sourceAgentId === agent.id || r.targetAgentId === agent.id);
    return `
### Agent: ${agent.name} (ID: ${agent.id})
- Type: ${agent.type}
- Stats: health=${agent.state.health.toFixed(2)}, morale=${agent.state.morale.toFixed(2)}, wealth=${agent.state.wealth.toFixed(0)}
- Traits: aggression=${agent.traits.aggression}, diplomacy=${agent.traits.diplomacy}
- Goals: ${agent.goals.filter(g => g.status === "active").map(g => g.label).join(", ")}
- Top Relationships: ${rels.slice(0, 3).map(r => {
      const otherId = r.sourceAgentId === agent.id ? r.targetAgentId : r.sourceAgentId;
      const other = worldState.agents.find(a => a.id === otherId);
      return `${other?.name ?? otherId} (trust: ${r.trust.toFixed(2)})`;
    }).join(", ")}
    `;
  }).join("\n");

  const recentEvents = worldState.events.slice(-10).map(e => `- [Tick ${e.tick}] ${e.description}`).join("\n");

  return `You are simulating the coordinated decision-making of the faction "${factionId}" in a multi-agent simulation.

## Faction Context
This faction contains ${agents.length} agents who should aim for narrative coherence and strategic cooperation.

## Recent Global Events
${recentEvents || "No recent events."}

## Active World Scenarios
${worldState.activeModifiers
  .filter(m => m.type === "global" || (m.type === "faction" && m.targetId === factionId))
  .map(m => `- ${m.description}: ${m.field} is modified (multiplier: ${m.multiplier}, offset: ${m.offset}, ticks remaining: ${m.remainingTicks})`)
  .join("\n") || "None"}

## Agents in Faction
${agentDetails}

## Instructions
Decide ONE action for EACH agent listed above. Agents in the same faction should generally coordinate (e.g., supporting each other, attacking a common enemy, or dividing labor).

Respond with ONLY valid JSON matching this schema:
{
  "factionId": "${factionId}",
  "proposals": [
    {
      "agentId": "<agent-id>",
      "actionType": "negotiate" | "attack" | "defend" | "trade" | "ally" | "betray" | "retreat" | "gather" | "explore" | "rest",
      "targetAgentId": "<target-agent-id or null>",
      "rationale": "<brief shared or individual rationale>",
      "confidence": <0.0 to 1.0>
    },
    ...
  ]
}

Ensure every agent in the list has a proposal.`;
}
