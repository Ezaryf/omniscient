import type { WorldState, Agent, RelationshipEdge, SimEvent } from "./types";

export interface StateDelta {
  tick: number;
  seed: number;
  changedAgents: Agent[];
  deadAgents: string[];
  changedRelationships: RelationshipEdge[];
  newEvents: SimEvent[];
}

export function calculateStateDelta(oldState: WorldState, newState: WorldState): StateDelta {
  const changedAgents: Agent[] = [];
  const deadAgents: string[] = [];

  for (const newAgent of newState.agents) {
    if (newAgent.status === "dead") {
      const oldAgent = oldState.agents.find((a) => a.id === newAgent.id);
      if (oldAgent?.status !== "dead") {
        deadAgents.push(newAgent.id);
        changedAgents.push(newAgent); // Also send the updated state so UI can render as dead
      }
    } else {
      const oldAgent = oldState.agents.find((a) => a.id === newAgent.id);
      // Because agents are cloned every tick (scarcity, memories), diff the core state
      if (!oldAgent) {
        changedAgents.push(newAgent);
      } else {
        const stateDiffers =
          oldAgent.state.health !== newAgent.state.health ||
          oldAgent.state.morale !== newAgent.state.morale ||
          oldAgent.state.influence !== newAgent.state.influence ||
          oldAgent.state.wealth !== newAgent.state.wealth ||
          oldAgent.memory.length !== newAgent.memory.length;
        if (stateDiffers) {
          changedAgents.push(newAgent);
        }
      }
    }
  }

  const changedRelationships = newState.relationships.filter((newRel) => {
    const oldRel = oldState.relationships.find((r) => r.id === newRel.id);
    if (!oldRel) return true;
    return (
      oldRel.trust !== newRel.trust ||
      oldRel.tension !== newRel.tension ||
      oldRel.influence !== newRel.influence
    );
  });

  const oldEventIds = new Set(oldState.events.map((e) => e.id));
  const newEvents = newState.events.filter((e) => !oldEventIds.has(e.id));

  return {
    tick: newState.tick,
    seed: newState.seed,
    changedAgents,
    deadAgents,
    changedRelationships,
    newEvents,
  };
}
