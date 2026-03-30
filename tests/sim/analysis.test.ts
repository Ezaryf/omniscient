import { describe, expect, it } from "vitest";
import { buildDivergenceWorkbench, buildInsightCards } from "@/lib/sim/analysis";
import type { TimelineBranch, WorldState } from "@/lib/sim/types";
import { DEFAULT_RULES, DEFAULT_SEED } from "@/lib/sim/constants";
import { ensureWorldState } from "@/lib/sim/campaign";

function createWorldState(): WorldState {
  return ensureWorldState({
    tick: 12,
    agents: [
      {
        id: "agent-a",
        name: "Aster",
        type: "leader",
        factionId: "faction-north",
        goals: [{ id: "g1", label: "Hold", priority: 0.8, progress: 0.4, status: "active" }],
        traits: { aggression: 0.5, diplomacy: 0.4, resourcefulness: 0.6, loyalty: 0.7, adaptability: 0.5 },
        state: { health: 0.8, morale: 0.62, influence: 58, wealth: 90 },
        resources: { supply: 8 },
        memory: [],
        activeIntent: null,
        intentHistory: [],
        position: { x: 10, y: 10 },
        status: "alive",
      },
      {
        id: "agent-b",
        name: "Bastion",
        type: "captain",
        factionId: "faction-south",
        goals: [{ id: "g2", label: "Advance", priority: 0.7, progress: 0.5, status: "active" }],
        traits: { aggression: 0.7, diplomacy: 0.2, resourcefulness: 0.4, loyalty: 0.5, adaptability: 0.4 },
        state: { health: 0.9, morale: 0.51, influence: 44, wealth: 63 },
        resources: { supply: 6 },
        memory: [],
        activeIntent: null,
        intentHistory: [],
        position: { x: 200, y: 180 },
        status: "alive",
      },
    ],
    relationships: [
      {
        id: "rel-1",
        sourceAgentId: "agent-a",
        targetAgentId: "agent-b",
        trust: -0.2,
        influence: 0.8,
        tension: 0.78,
        lastUpdatedTick: 12,
      },
    ],
    map: {
      id: "map-main",
      name: "Map",
      regions: [
        {
          id: "region-1",
          name: "Glass Strait",
          kind: "sea",
          center: { x: 100, y: 100 },
          radius: 150,
          controllingFactionId: "faction-north",
          supply: 0.42,
          stability: 0.48,
          threat: 0.73,
          visibility: "visible",
          tags: [],
        },
      ],
      sites: [
        {
          id: "site-1",
          name: "Harbor Crown",
          kind: "market",
          regionId: "region-1",
          position: { x: 120, y: 100 },
          controllingFactionId: "faction-north",
          status: "threatened",
          tags: [],
        },
      ],
      routes: [
        {
          id: "route-1",
          name: "North Passage",
          fromSiteId: "site-1",
          toSiteId: "site-1",
          controllingFactionId: "faction-north",
          status: "disrupted",
          risk: 0.72,
          integrity: 0.45,
          traffic: 0.6,
          tags: [],
        },
      ],
      tokens: [],
    },
    fronts: [
      {
        id: "front-1",
        name: "Strait Siege",
        regionId: "region-1",
        factionId: "faction-north",
        opposingFactionId: "faction-south",
        pressure: 0.81,
        progress: 0.64,
        status: "critical",
        stakes: "Control of the sea gate",
        lastAdvancedTick: 12,
      },
    ],
    projections: [
      {
        id: "proj-1",
        tick: 12,
        type: "warning",
        subjectType: "route",
        subjectId: "route-1",
        title: "Supply line could fracture",
        summary: "If the route loses more integrity, the current front will escalate faster.",
        evidence: ["North Passage at 45% integrity"],
        severity: 0.8,
        confidence: 0.76,
        acknowledged: false,
      },
    ],
    gmNotes: [],
    events: [
      {
        id: "event-1",
        tick: 10,
        type: "conflict",
        sourceAgentId: "agent-b",
        targetAgentId: "agent-a",
        actorIds: ["agent-b"],
        targetIds: ["agent-a"],
        description: "Bastion strikes the harbor shield.",
        impact: [],
        parentEventIds: [],
        causeChain: [],
        causedBy: [],
        causalDepth: 0,
        causalType: null,
        affects: ["front-1", "route-1"],
        invalidates: [],
        branchOriginEventId: null,
        confidence: 0.8,
        tags: ["conflict"],
        metadata: {},
      },
      {
        id: "event-2",
        tick: 11,
        type: "collapse",
        sourceAgentId: null,
        targetAgentId: null,
        actorIds: [],
        targetIds: [],
        description: "The harbor convoy buckles under pressure.",
        impact: [],
        parentEventIds: ["event-1"],
        causeChain: [],
        causedBy: ["event-1"],
        causalDepth: 1,
        causalType: "amplify",
        affects: ["route-1", "region-1"],
        invalidates: [],
        branchOriginEventId: null,
        confidence: 0.74,
        tags: ["logistics"],
        metadata: {},
      },
    ],
    rules: { ...DEFAULT_RULES },
    seed: DEFAULT_SEED,
    activeModifiers: [],
  });
}

function createBranch(id: string, name: string, state: WorldState): TimelineBranch {
  return {
    id,
    projectId: "proj-1",
    scenarioId: "scen-1",
    parentBranchId: null,
    name,
    summary: `${name} summary`,
    branchPointTick: 4,
    branchOriginEventId: null,
    currentTick: state.tick,
    stateHash: `${id}-hash`,
    status: "active",
    latestState: state,
  };
}

describe("simulation analysis helpers", () => {
  it("builds insight cards from branch state pressure", () => {
    const cards = buildInsightCards(createWorldState());

    expect(cards.length).toBeGreaterThan(0);
    expect(cards.some((card) => card.title.includes("Hidden pressure"))).toBe(true);
    expect(cards.some((card) => card.title.includes("most volatile front"))).toBe(true);
    expect(cards.some((card) => card.title.includes("most exposed route"))).toBe(true);
  });

  it("builds a divergence workbench with overview cards and unique events", () => {
    const branchA = createBranch("branch-a", "Main Timeline", createWorldState());
    const branchBState = createWorldState();
    branchBState.tick = 15;
    branchBState.events = [
      ...branchBState.events,
      {
        ...branchBState.events[1],
        id: "event-3",
        tick: 13,
        description: "Aster opens a temporary relief corridor.",
      },
    ];
    const branchB = createBranch("branch-b", "Relief Fork", branchBState);

    const workbench = buildDivergenceWorkbench({
      branchA,
      branchB,
      commonAncestorTick: 4,
      branchAEvents: branchA.latestState.events,
      branchBEvents: branchB.latestState.events,
      frontDiffCount: 1,
      routeDiffCount: 1,
      agentDiffCount: 2,
    });

    expect(workbench.overview).toHaveLength(4);
    expect(workbench.overview[0].title).toContain("Divergence point");
    expect(workbench.uniqueEventsA.length).toBeGreaterThan(0);
    expect(workbench.uniqueEventsB.length).toBeGreaterThan(0);
  });
});
