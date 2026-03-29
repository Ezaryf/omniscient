import type {
  BoardLink,
  CampaignNode,
  FrontClock,
  GmNote,
  MapLayer,
  ProjectionArtifact,
  SimEvent,
  WorldState,
} from "./types";

export interface StateDelta {
  tick: number;
  seed: number;
  changedAgents: WorldState["agents"];
  deadAgents: string[];
  changedRelationships: WorldState["relationships"];
  newEvents: SimEvent[];
  fronts: FrontClock[];
  map: MapLayer;
  projections: ProjectionArtifact[];
  gmNotes: GmNote[];
  campaignNodes: CampaignNode[];
  boardLinks: BoardLink[];
}

export function calculateStateDelta(oldState: WorldState, newState: WorldState): StateDelta {
  const changedAgents = newState.agents.filter((newAgent) => {
    const oldAgent = oldState.agents.find((agent) => agent.id === newAgent.id);
    if (!oldAgent) return true;

    return (
      oldAgent.status !== newAgent.status ||
      oldAgent.state.health !== newAgent.state.health ||
      oldAgent.state.morale !== newAgent.state.morale ||
      oldAgent.state.influence !== newAgent.state.influence ||
      oldAgent.state.wealth !== newAgent.state.wealth ||
      oldAgent.memory.length !== newAgent.memory.length ||
      oldAgent.activeIntent?.id !== newAgent.activeIntent?.id ||
      oldAgent.activeIntent?.status !== newAgent.activeIntent?.status ||
      oldAgent.activeIntent?.kind !== newAgent.activeIntent?.kind ||
      oldAgent.activeIntent?.targetIds.join("|") !== newAgent.activeIntent?.targetIds.join("|") ||
      oldAgent.intentHistory.length !== newAgent.intentHistory.length
    );
  });

  const deadAgents = newState.agents
    .filter((newAgent) => {
      const oldAgent = oldState.agents.find((agent) => agent.id === newAgent.id);
      return newAgent.status === "dead" && oldAgent?.status !== "dead";
    })
    .map((agent) => agent.id);

  const changedRelationships = newState.relationships.filter((newRelationship) => {
    const oldRelationship = oldState.relationships.find((relationship) => relationship.id === newRelationship.id);
    if (!oldRelationship) return true;

    return (
      oldRelationship.trust !== newRelationship.trust ||
      oldRelationship.tension !== newRelationship.tension ||
      oldRelationship.influence !== newRelationship.influence
    );
  });

  const oldEventIds = new Set(oldState.events.map((event) => event.id));
  const newEvents = newState.events.filter((event) => !oldEventIds.has(event.id));

  return {
    tick: newState.tick,
    seed: newState.seed,
    changedAgents,
    deadAgents,
    changedRelationships,
    newEvents,
    fronts: newState.fronts,
    map: newState.map,
    projections: newState.projections,
    gmNotes: newState.gmNotes,
    campaignNodes: newState.campaignNodes,
    boardLinks: newState.boardLinks,
  };
}
