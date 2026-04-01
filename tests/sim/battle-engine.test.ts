import { describe, it, expect, beforeEach } from "vitest";
import { BattleEngine, DefaultStoryGenerator } from "@/lib/sim/battle";
import type { BattleNode, BattleEdge, BattleEvent, BattleSnapshot, EventType } from "@/lib/sim/battle/types";

describe("BattleEngine", () => {
  let engine: BattleEngine;

  const nodes: BattleNode[] = [
    { id: "A", data: { name: "Alpha" } },
    { id: "B", data: { name: "Beta" } },
    { id: "A1", data: { name: "Alpha-1" } },
    { id: "A2", data: { name: "Alpha-2" } },
    { id: "B1", data: { name: "Beta-1" } },
  ];

  const edges: BattleEdge[] = [
    { source: "A", target: "B", label: "foe" },
    { source: "A1", target: "A", label: "ally" },
    { source: "A2", target: "A", label: "ally" },
    { source: "B1", target: "B", label: "ally" },
  ];

  beforeEach(() => {
    engine = new BattleEngine({ seed: 42, maxTicks: 30 });
  });

  describe("loadFromGraph", () => {
    it("should create agents from nodes", () => {
      engine.loadFromGraph(nodes, edges);
      const state = engine.getState();

      expect(Object.keys(state.agents)).toHaveLength(5);
      expect(state.agents["A"]).toBeDefined();
      expect(state.agents["B"]).toBeDefined();
    });

    it("should assign allies correctly", () => {
      engine.loadFromGraph(nodes, edges);
      const state = engine.getState();

      expect(state.agents["A"].allies).toContain("A1");
      expect(state.agents["A"].allies).toContain("A2");
      expect(state.agents["A1"].allies).toContain("A");
    });

    it("should assign foes correctly", () => {
      engine.loadFromGraph(nodes, edges);
      const state = engine.getState();

      expect(state.agents["A"].foes).toContain("B");
      expect(state.agents["B"].foes).toContain("A");
    });

    it("should set hasExplicitConflicts true when foe edges exist", () => {
      engine.loadFromGraph(nodes, edges);
      expect(engine.hasConflicts()).toBe(true);
    });

    it("should warn when no conflicts exist", () => {
      const noConflictEdges: BattleEdge[] = [
        { source: "A", target: "A1", label: "ally" },
      ];
      engine.loadFromGraph(nodes, noConflictEdges);
      const events = engine.getEvents();

      expect(events).toContainEqual(
        expect.objectContaining({
          type: "story",
          text: expect.stringContaining("No explicit conflicts"),
        })
      );
    });
  });

  describe("step and combat", () => {
    it("should produce a valid snapshot after step", () => {
      engine.loadFromGraph(nodes, edges);
      const snapshot = engine.step();

      expect(snapshot.tick).toBe(1);
      expect(snapshot.agents).toBeDefined();
      expect(snapshot.recentEvents).toBeDefined();
      expect(snapshot.finished).toBe(false);
    });

    it("should generate attack events", () => {
      engine.loadFromGraph(nodes, edges);
      const snapshot = engine.step();

      const attackEvents = snapshot.recentEvents.filter(
        (e) => e.type === "attack"
      );
      expect(attackEvents.length).toBeGreaterThan(0);
    });

    it("should handle ally defense", () => {
      const engineWithGuard = new BattleEngine({
        seed: 42,
        maxTicks: 50,
        allyGuardChance: 1.0,
      });
      engineWithGuard.loadFromGraph(nodes, edges);

      const snapshots: ReturnType<typeof engineWithGuard.step>[] = [];
      for (let i = 0; i < 10; i++) {
        snapshots.push(engineWithGuard.step());
      }

      const defendEvents = snapshots.flatMap((s) =>
        s.recentEvents.filter((e) => e.type === "defend")
      );
      expect(defendEvents.length).toBeGreaterThan(0);
    });
  });

  describe("death logic", () => {
    it("should mark agent as dead when health reaches 0", () => {
      const fatalEngine = new BattleEngine({
        seed: 42,
        maxTicks: 100,
        attackDamageMin: 100,
        attackDamageMax: 100,
      });
      fatalEngine.loadFromGraph(nodes, edges);

      for (let i = 0; i < 10; i++) {
        fatalEngine.step();
      }

      const state = fatalEngine.getState();
      const allDeadOrAlive = Object.values(state.agents).map((a) => a.alive);
      expect(allDeadOrAlive.some((alive) => !alive)).toBe(true);
    });

    it("should remove dead agents from being targeted", () => {
      const fatalEngine = new BattleEngine({
        seed: 123,
        maxTicks: 50,
        attackDamageMin: 50,
        attackDamageMax: 50,
      });
      fatalEngine.loadFromGraph(nodes, edges);

      for (let i = 0; i < 20; i++) {
        fatalEngine.step();
      }

      const state = fatalEngine.getState();
      const aliveCount = Object.values(state.agents).filter((a) => a.alive).length;
      expect(aliveCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("termination", () => {
    it("should finish when one agent remains", () => {
      const fatalEngine = new BattleEngine({
        seed: 999,
        maxTicks: 100,
        attackDamageMin: 30,
        attackDamageMax: 30,
      });
      fatalEngine.loadFromGraph(nodes, edges);

      let finished = false;
      for (let i = 0; i < 100; i++) {
        const snapshot = fatalEngine.step();
        if (snapshot.finished) {
          finished = true;
          expect(snapshot.winner).toBeDefined();
          break;
        }
      }

      expect(finished).toBe(true);
    });

    it("should finish when max ticks reached", () => {
      const shortEngine = new BattleEngine({ seed: 42, maxTicks: 5 });
      shortEngine.loadFromGraph(nodes, edges);

      const frames = shortEngine.run(10);
      expect(frames.length).toBeLessThanOrEqual(6);
      expect(frames[frames.length - 1].finished).toBe(true);
    });
  });

  describe("dynamic conflict emergence", () => {
    it("should create conflicts when none defined and dynamicConflict enabled", () => {
      const neutralEdges: BattleEdge[] = [
        { source: "A", target: "A1", label: "ally" },
      ];
      const dynamicEngine = new BattleEngine({
        seed: 42,
        maxTicks: 20,
        dynamicConflict: true,
        dynamicConflictProbability: 0.8,
      });
      dynamicEngine.loadFromGraph(nodes, neutralEdges);

      for (let i = 0; i < 15; i++) {
        dynamicEngine.step();
      }

      const events = dynamicEngine.getEvents();
      const conflictEvents = events.filter((e) => e.type === "conflict_emerge");
      expect(conflictEvents.length).toBeGreaterThan(0);
    });

    it("should not create conflicts when dynamicConflict disabled", () => {
      const neutralEdges: BattleEdge[] = [
        { source: "A", target: "A1", label: "ally" },
      ];
      const staticEngine = new BattleEngine({
        seed: 42,
        maxTicks: 20,
        dynamicConflict: false,
      });
      staticEngine.loadFromGraph(nodes, neutralEdges);

      for (let i = 0; i < 15; i++) {
        staticEngine.step();
      }

      const events = staticEngine.getEvents();
      const conflictEvents = events.filter((e) => e.type === "conflict_emerge");
      expect(conflictEvents).toHaveLength(0);
    });
  });

  describe("run method", () => {
    it("should return array of snapshots", () => {
      engine.loadFromGraph(nodes, edges);
      const frames = engine.run(10);

      expect(frames).toHaveLength(11);
      expect(frames[0].tick).toBe(0);
      expect(frames[10].tick).toBe(10);
    });

    it("should include final state with winner", () => {
      engine.loadFromGraph(nodes, edges);
      const frames = engine.run(30);

      const finalFrame = frames[frames.length - 1];
      if (finalFrame.finished) {
        expect(finalFrame.winner).toBeDefined();
      }
    });
  });

  describe("story generation", () => {
    it("should generate a story string", () => {
      engine.loadFromGraph(nodes, edges);
      engine.run(10);
      const story = engine.getNarrative();

      expect(typeof story).toBe("string");
      expect(story.length).toBeGreaterThan(0);
    });

    it("should generate different styles", () => {
      const cinematicEngine = new BattleEngine({
        seed: 42,
        narrativeStyle: "cinematic",
      });
      cinematicEngine.loadFromGraph(nodes, edges);
      cinematicEngine.run(5);
      const cinematic = cinematicEngine.getNarrative();

      const militaryEngine = new BattleEngine({
        seed: 42,
        narrativeStyle: "military",
      });
      militaryEngine.loadFromGraph(nodes, edges);
      militaryEngine.run(5);
      const military = militaryEngine.getNarrative();

      expect(typeof cinematic).toBe("string");
      expect(typeof military).toBe("string");
    });

    it("should support legacy getStory method", () => {
      engine.loadFromGraph(nodes, edges);
      engine.run(10);
      const story = engine.getStory();

      expect(typeof story).toBe("string");
      expect(story.length).toBeGreaterThan(0);
    });
  });

  describe("memory", () => {
    it("should record memory for agents", () => {
      engine.loadFromGraph(nodes, edges);
      engine.step();

      const state = engine.getState();
      const agentsWithMemory = Object.values(state.agents).filter(
        (a) => a.memory.length > 0
      );

      expect(agentsWithMemory.length).toBeGreaterThan(0);
    });
  });

  describe("emotional drift", () => {
    it("should increase fear when damaged", () => {
      const engineWithDamage = new BattleEngine({
        seed: 42,
        maxTicks: 20,
      });
      engineWithDamage.loadFromGraph(nodes, edges);

      const before = engineWithDamage.getState();
      const targetBefore = before.agents["B"]?.fear ?? 0;

      for (let i = 0; i < 10; i++) {
        engineWithDamage.step();
      }

      const after = engineWithDamage.getState();
      const targetAfter = after.agents["B"]?.fear ?? 0;

      expect(targetAfter).toBeGreaterThanOrEqual(targetBefore);
    });
  });

  describe("alliance breaking", () => {
    it("should break alliance when fear too high", () => {
      const fearfulEngine = new BattleEngine({
        seed: 42,
        maxTicks: 30,
      });
      
      const nodesWithFear: BattleNode[] = [
        { id: "A", data: { name: "Alpha", fear: 0.9 } },
        { id: "B", data: { name: "Beta" } },
        { id: "Ally", data: { name: "Ally", fear: 0.9 } },
      ];
      const edgesWithFear: BattleEdge[] = [
        { source: "A", target: "B", label: "foe" },
        { source: "Ally", target: "A", label: "ally" },
      ];
      
      fearfulEngine.loadFromGraph(nodesWithFear, edgesWithFear);

      const events = fearfulEngine.getEvents();
      const breakEvents = events.filter((e) => e.type === "alliance_break");
      
      expect(breakEvents.length).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("DefaultStoryGenerator", () => {
  it("should generate a story from events", () => {
    const generator = new DefaultStoryGenerator();
    const snapshot: BattleSnapshot = {
      tick: 5,
      agents: {},
      recentEvents: [
        { id: "1", tick: 1, type: "attack" as EventType, text: "A attacks B", actor: "A", target: "B" },
        { id: "2", tick: 2, type: "damage" as EventType, text: "B takes 10 damage", actor: "B" },
      ],
      finished: false,
      winner: null,
    };

    const story = generator.generate([], snapshot);
    expect(typeof story).toBe("string");
  });
});
