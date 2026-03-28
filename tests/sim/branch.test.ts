import { describe, it, expect } from "vitest";
import { createBranch, detectDivergence } from "@/lib/sim/branch";
import { createSnapshot, restoreFromSnapshot, replayEvents } from "@/lib/sim/snapshot";
import type { WorldState, SimEvent, TimelineBranch } from "@/lib/sim/types";
import { DEFAULT_RULES, DEFAULT_SEED } from "@/lib/sim/constants";

function createTestWorldState(tick = 0): WorldState {
  return {
    tick,
    agents: [
      {
        id: "a1",
        name: "Alpha",
        type: "leader",
        factionId: "f1",
        goals: [{ id: "g1", label: "Lead", priority: 0.8, progress: 0.2, status: "active" }],
        traits: { aggression: 0.5, diplomacy: 0.5, resourcefulness: 0.5, loyalty: 0.5, adaptability: 0.5 },
        state: { health: 1, morale: 0.8, influence: 50, wealth: 100 },
        resources: { food: 100 },
        memory: [],
        position: { x: 0, y: 0 },
        status: "alive",
      },
    ],
    relationships: [],
    events: [],
    rules: { ...DEFAULT_RULES },
    seed: DEFAULT_SEED,
  };
}

function createTestBranch(state: WorldState): TimelineBranch {
  return {
    id: "branch-1",
    projectId: "proj-1",
    scenarioId: "scen-1",
    parentBranchId: null,
    name: "Main",
    summary: "Main timeline",
    branchPointTick: 0,
    currentTick: state.tick,
    stateHash: "test-hash",
    status: "active",
    latestState: state,
  };
}

describe("Branch Management", () => {
  it("creates a branch from an existing branch", async () => {
    const state = createTestWorldState(5);
    const sourceBranch = createTestBranch(state);

    const { branch } = await createBranch(sourceBranch, "Test Branch");

    expect(branch.parentBranchId).toBe("branch-1");
    expect(branch.branchPointTick).toBe(5);
    expect(branch.currentTick).toBe(5);
    expect(branch.name).toBe("Test Branch");
    expect(branch.status).toBe("active");
    expect(branch.latestState.tick).toBe(5);
  });

  it("deep clones state so branches are independent", async () => {
    const state = createTestWorldState(5);
    const sourceBranch = createTestBranch(state);

    const { branch } = await createBranch(sourceBranch, "Branch B");

    // Mutate the new branch's state
    branch.latestState.agents[0].state.health = 0.1;

    // Source should be unaffected
    expect(sourceBranch.latestState.agents[0].state.health).toBe(1);
  });

  it("detects divergence between branches", () => {
    const stateA = createTestWorldState(10);
    stateA.agents[0].state.health = 0.5;
    const branchA: TimelineBranch = {
      ...createTestBranch(stateA),
      id: "branch-a",
      currentTick: 10,
    };

    const stateB = createTestWorldState(10);
    stateB.agents[0].state.health = 0.9;
    const branchB: TimelineBranch = {
      ...createTestBranch(stateB),
      id: "branch-b",
      currentTick: 10,
      branchPointTick: 5,
    };

    const eventsA: SimEvent[] = [
      { id: "e1", tick: 6, type: "conflict", sourceAgentId: "a1", targetAgentId: null, description: "Battle", impact: [], causeChain: [], metadata: {} },
    ];
    const eventsB: SimEvent[] = [
      { id: "e2", tick: 6, type: "negotiation", sourceAgentId: "a1", targetAgentId: null, description: "Peace talks", impact: [], causeChain: [], metadata: {} },
    ];

    const divergence = detectDivergence(branchA, branchB, eventsA, eventsB);

    expect(divergence.commonAncestorTick).toBe(0);
    expect(divergence.branchAEvents.length).toBe(1);
    expect(divergence.branchBEvents.length).toBe(1);
    expect(divergence.agentDiffs.length).toBe(1);
    expect(divergence.agentDiffs[0].agentId).toBe("a1");
  });
});

describe("Snapshots", () => {
  it("creates a snapshot with correct metadata", async () => {
    const state = createTestWorldState(5);
    const snapshot = await createSnapshot("branch-1", state, "checkpoint");

    expect(snapshot.tick).toBe(5);
    expect(snapshot.branchId).toBe("branch-1");
    expect(snapshot.kind).toBe("checkpoint");
    expect(snapshot.stateHash).toBeTruthy();
    expect(snapshot.state.tick).toBe(5);
  });

  it("restores state from snapshot (deep clone)", async () => {
    const state = createTestWorldState(5);
    const snapshot = await createSnapshot("branch-1", state, "checkpoint");

    const restored = restoreFromSnapshot(snapshot);

    expect(restored.tick).toBe(5);
    expect(restored.agents[0].state.health).toBe(1);

    // Mutate restored — original snapshot should be unaffected
    restored.agents[0].state.health = 0;
    expect(snapshot.state.agents[0].state.health).toBe(1);
  });

  it("replays events correctly", () => {
    const state = createTestWorldState(0);
    const events: SimEvent[] = [
      {
        id: "e1",
        tick: 1,
        type: "conflict",
        sourceAgentId: null,
        targetAgentId: "a1",
        description: "Attack",
        impact: [{ targetId: "a1", field: "health", delta: -0.2 }],
        causeChain: [],
        metadata: {},
      },
      {
        id: "e2",
        tick: 2,
        type: "trade",
        sourceAgentId: null,
        targetAgentId: "a1",
        description: "Trade",
        impact: [{ targetId: "a1", field: "wealth", delta: 50 }],
        causeChain: [],
        metadata: {},
      },
    ];

    const replayed = replayEvents(state, events);

    expect(replayed.agents[0].state.health).toBe(0.8); // 1 - 0.2
    expect(replayed.agents[0].state.wealth).toBe(150); // 100 + 50
    expect(replayed.tick).toBe(2);
  });
});
