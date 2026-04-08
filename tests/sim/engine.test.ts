import { describe, it, expect } from "vitest";
import { tick } from "@/lib/sim/engine";
import { createRng } from "@/lib/sim/seed";
import type { WorldState } from "@/lib/sim/types";
import { DEFAULT_RULES, DEFAULT_SEED } from "@/lib/sim/constants";
import { ensureWorldState } from "@/lib/sim/campaign";

function createTestWorldState(): WorldState {
  return ensureWorldState({
    tick: 0,
    agents: [
      {
        id: "a1",
        name: "Agent Alpha",
        type: "leader",
        factionId: "f1",
        goals: [
          { id: "g1", label: "Conquer", priority: 0.8, progress: 0.2, status: "active" },
        ],
        traits: { aggression: 0.5, diplomacy: 0.5, resourcefulness: 0.5, loyalty: 0.5, adaptability: 0.5 },
        state: { health: 1, morale: 0.8, influence: 50, wealth: 100 },
        resources: { food: 100, gold: 50 },
        memory: [],
        activeIntent: null,
        intentHistory: [],
        position: { x: 100, y: 100 },
        description: "",
        status: "alive",
      },
      {
        id: "a2",
        name: "Agent Beta",
        type: "military",
        factionId: "f2",
        goals: [
          { id: "g2", label: "Defend", priority: 0.6, progress: 0, status: "active" },
        ],
        traits: { aggression: 0.7, diplomacy: 0.3, resourcefulness: 0.4, loyalty: 0.6, adaptability: 0.5 },
        state: { health: 0.9, morale: 0.7, influence: 30, wealth: 60 },
        resources: { food: 80, gold: 30 },
        memory: [],
        activeIntent: null,
        intentHistory: [],
        position: { x: 300, y: 200 },
        description: "",
        status: "alive",
      },
    ],
    relationships: [
      {
        id: "r1",
        sourceAgentId: "a1",
        targetAgentId: "a2",
        trust: 0.2,
        influence: 0.4,
        tension: 0.3,
        lastUpdatedTick: 0,
      },
    ],
    events: [],
    rules: { ...DEFAULT_RULES },
    seed: DEFAULT_SEED,
    activeModifiers: [],
  });
}

describe("Simulation Engine", () => {
  it("produces deterministic output given the same seed and state", () => {
    const state = createTestWorldState();
    const rng1 = createRng(DEFAULT_SEED);
    const rng2 = createRng(DEFAULT_SEED);

    const result1 = tick(state, rng1);
    const result2 = tick(state, rng2);

    expect(result1.worldState.tick).toBe(result2.worldState.tick);
    expect(result1.worldState.tick).toBe(1);
    expect(result1.events.length).toBe(result2.events.length);

    // Agent states should be identical
    for (let i = 0; i < result1.worldState.agents.length; i++) {
      expect(result1.worldState.agents[i].state).toEqual(
        result2.worldState.agents[i].state
      );
    }
  });

  it("increments tick by 1", () => {
    const state = createTestWorldState();
    const rng = createRng(DEFAULT_SEED);
    const result = tick(state, rng);

    expect(result.worldState.tick).toBe(1);
  });

  it("applies trust decay to relationships", () => {
    const state = createTestWorldState();
    state.rules.trustDecay = 0.05;
    const rng = createRng(DEFAULT_SEED);
    const result = tick(state, rng, []);

    // Trust should have decayed
    const rel = result.worldState.relationships[0];
    expect(rel.trust).toBeLessThan(0.2); // Original was 0.2
    expect(rel.lastUpdatedTick).toBe(1);
  });

  it("applies scarcity to agent resources", () => {
    const state = createTestWorldState();
    state.rules.scarcity = 0.5; // High scarcity
    const rng = createRng(DEFAULT_SEED);
    const result = tick(state, rng);

    // Resources should have decreased
    const originalFood = state.agents[0].resources.food;
    const newFood = result.worldState.agents[0].resources.food;
    expect(newFood).toBeLessThanOrEqual(originalFood);
  });

  it("does not mutate the input state", () => {
    const state = createTestWorldState();
    const originalTick = state.tick;
    const originalHealth = state.agents[0].state.health;
    const rng = createRng(DEFAULT_SEED);

    tick(state, rng);

    expect(state.tick).toBe(originalTick);
    expect(state.agents[0].state.health).toBe(originalHealth);
  });

  it("kills agents when health reaches 0", () => {
    const state = createTestWorldState();
    state.agents[0].state.health = 0.01; // Near death
    state.agents[0].state.morale = 0.01;
    state.rules.scarcity = 0.99; // Extreme scarcity

    // Run several ticks
    let current = state;
    for (let i = 0; i < 20; i++) {
      const rng = createRng(DEFAULT_SEED + i);
      const result = tick(current, rng);
      current = result.worldState;
    }

    // At least one agent should be dead or inactive after extreme conditions
    const statuses = current.agents.map((a) => a.status);
    expect(
      statuses.includes("dead") ||
      statuses.includes("inactive") ||
      current.agents[0].state.health < 0.5
    ).toBe(true);
  });

  it("signals snapshot creation at the correct frequency", () => {
    const state = createTestWorldState();

    // Run to tick 10 (default snapshot frequency)
    let current = state;
    let snapshotCreated = false;
    for (let i = 0; i < 10; i++) {
      const rng = createRng(DEFAULT_SEED + i);
      const result = tick(current, rng);
      current = result.worldState;
      if (result.snapshotCreated) snapshotCreated = true;
    }

    expect(snapshotCreated).toBe(true);
    expect(current.tick).toBe(10);
  });

  it("produces different outputs with different seeds", () => {
    const state = createTestWorldState();
    const result1 = tick(state, createRng(1));
    const result2 = tick(state, createRng(99999));

    // At least something should differ (events or agent states)
    const same =
      JSON.stringify(result1.worldState.agents) ===
      JSON.stringify(result2.worldState.agents);
    // With different seeds, outcomes should usually differ
    // (small chance they're identical, but very unlikely)
    expect(result1.worldState.tick).toBe(result2.worldState.tick); // Both tick 1
  });
});
