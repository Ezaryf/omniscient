import { describe, it, expect } from "vitest";
import {
  validateProposal,
  validateProposalBatch,
  checkConstraints,
  meetsConfidenceThreshold,
} from "@/lib/sim/ai/proposal";
import type { Agent } from "@/lib/sim/types";

const testAgents: Agent[] = [
  {
    id: "a1",
    name: "Alpha",
    type: "leader",
    factionId: "f1",
    goals: [],
    traits: { aggression: 0.5, diplomacy: 0.5, resourcefulness: 0.5, loyalty: 0.5, adaptability: 0.5 },
    state: { health: 1, morale: 0.8, influence: 50, wealth: 100 },
    resources: {},
    memory: [],
    position: { x: 0, y: 0 },
    status: "alive",
  },
  {
    id: "a2",
    name: "Beta",
    type: "military",
    factionId: "f1", // Same faction as a1
    goals: [],
    traits: { aggression: 0.7, diplomacy: 0.3, resourcefulness: 0.4, loyalty: 0.6, adaptability: 0.5 },
    state: { health: 0.9, morale: 0.7, influence: 30, wealth: 60 },
    resources: {},
    memory: [],
    position: { x: 100, y: 100 },
    status: "alive",
  },
  {
    id: "a3",
    name: "Gamma",
    type: "diplomat",
    factionId: "f2",
    goals: [],
    traits: { aggression: 0.1, diplomacy: 0.9, resourcefulness: 0.8, loyalty: 0.7, adaptability: 0.9 },
    state: { health: 1, morale: 0.9, influence: 60, wealth: 90 },
    resources: {},
    memory: [],
    position: { x: 200, y: 200 },
    status: "dead",
  },
];

describe("ActionProposal Validation", () => {
  it("validates a correct proposal", () => {
    const result = validateProposal({
      agentId: "a1",
      actionType: "negotiate",
      targetAgentId: "a2",
      rationale: "Seeking alliance",
      confidence: 0.8,
    });

    expect(result.ok).toBe(true);
  });

  it("rejects proposal with invalid action type", () => {
    const result = validateProposal({
      agentId: "a1",
      actionType: "fly_away",
      targetAgentId: "a2",
      rationale: "Invalid",
      confidence: 0.5,
    });

    expect(result.ok).toBe(false);
  });

  it("rejects proposal with missing fields", () => {
    const result = validateProposal({
      agentId: "a1",
      actionType: "attack",
    });

    expect(result.ok).toBe(false);
  });

  it("rejects proposal with out-of-range confidence", () => {
    const result = validateProposal({
      agentId: "a1",
      actionType: "trade",
      targetAgentId: null,
      rationale: "Trading",
      confidence: 1.5,
    });

    expect(result.ok).toBe(false);
  });

  it("validates a batch of proposals", () => {
    const { valid, invalid } = validateProposalBatch([
      { agentId: "a1", actionType: "trade", targetAgentId: null, rationale: "OK", confidence: 0.8 },
      { agentId: "a2", actionType: "INVALID", targetAgentId: null, rationale: "Bad", confidence: 0.5 },
      { agentId: "a3", actionType: "rest", targetAgentId: null, rationale: "OK", confidence: 0.6 },
    ]);

    expect(valid.length).toBe(2);
    expect(invalid.length).toBe(1);
    expect(invalid[0].index).toBe(1);
  });
});

describe("Constraint Checking", () => {
  it("allows valid proposals", () => {
    const proposal = {
      agentId: "a1",
      actionType: "negotiate" as const,
      targetAgentId: "a2",
      rationale: "Alliance",
      confidence: 0.8,
    };

    const result = checkConstraints(proposal, testAgents);
    expect(result.allowed).toBe(true);
  });

  it("rejects attack on same faction", () => {
    const proposal = {
      agentId: "a1",
      actionType: "attack" as const,
      targetAgentId: "a2", // Same faction f1
      rationale: "Coup",
      confidence: 0.8,
    };

    const result = checkConstraints(proposal, testAgents);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("own faction");
  });

  it("rejects action by dead agent", () => {
    const proposal = {
      agentId: "a3", // Dead agent
      actionType: "trade" as const,
      targetAgentId: "a1",
      rationale: "Ghost trade",
      confidence: 0.8,
    };

    const result = checkConstraints(proposal, testAgents);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("dead");
  });

  it("rejects targeting a dead agent", () => {
    const proposal = {
      agentId: "a1",
      actionType: "negotiate" as const,
      targetAgentId: "a3", // Dead
      rationale: "Séance",
      confidence: 0.8,
    };

    const result = checkConstraints(proposal, testAgents);
    expect(result.allowed).toBe(false);
  });
});

describe("Confidence Threshold", () => {
  it("passes proposals above the floor", () => {
    const proposal = {
      agentId: "a1",
      actionType: "trade" as const,
      targetAgentId: null,
      rationale: "OK",
      confidence: 0.8,
    };

    expect(meetsConfidenceThreshold(proposal, 0.6)).toBe(true);
  });

  it("rejects proposals below the floor", () => {
    const proposal = {
      agentId: "a1",
      actionType: "trade" as const,
      targetAgentId: null,
      rationale: "Uncertain",
      confidence: 0.4,
    };

    expect(meetsConfidenceThreshold(proposal, 0.6)).toBe(false);
  });
});
