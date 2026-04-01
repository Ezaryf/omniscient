/**
 * In-memory store — used when USE_IN_MEMORY_STORE=true.
 * Pre-seeds a demo project with 6 agents and relationships.
 * Provides a persistence interface identical to what the Prisma layer exposes.
 */

import type {
  Agent,
  WorldState,
  SimEvent,
  RelationshipEdge,
  TimelineBranch,
  Snapshot,
  RuleSet,
  ExplanationArtifact,
} from "@/lib/sim/types";
import { DEFAULT_RULES, DEFAULT_SEED } from "@/lib/sim/constants";
import { ensureWorldState } from "@/lib/sim/campaign";
import { SimulationStore } from "./store-types";
import { PrismaStore } from "./db-store";
import { getSnapshotsToPrune } from "@/lib/sim/snapshot";

// ─── Demo Data ───────────────────────────────────────────────────

const DEMO_AGENTS: Agent[] = [
  {
    id: "agent-1",
    name: "Empress Katara",
    type: "leader",
    factionId: "faction-sol",
    goals: [
      { id: "g1", label: "Expand territory", priority: 0.8, progress: 0.2, status: "active" },
      { id: "g2", label: "Secure alliance with Meridian", priority: 0.6, progress: 0, status: "active" },
    ],
    traits: { aggression: 0.3, diplomacy: 0.8, resourcefulness: 0.7, loyalty: 0.9, adaptability: 0.5 },
    state: { health: 1, morale: 0.9, influence: 85, wealth: 120 },
    resources: { food: 200, gold: 150, military: 80 },
    memory: [],
    activeIntent: null,
    intentHistory: [],
    position: { x: 150, y: 200 },
    status: "alive",
  },
  {
    id: "agent-2",
    name: "Warlord Drask",
    type: "military",
    factionId: "faction-iron",
    goals: [
      { id: "g3", label: "Conquer the Northern Pass", priority: 0.9, progress: 0.4, status: "active" },
      { id: "g4", label: "Eliminate Katara's forces", priority: 0.7, progress: 0.1, status: "active" },
    ],
    traits: { aggression: 0.9, diplomacy: 0.2, resourcefulness: 0.5, loyalty: 0.6, adaptability: 0.4 },
    state: { health: 0.95, morale: 0.85, influence: 70, wealth: 60 },
    resources: { food: 100, gold: 40, military: 150 },
    memory: [],
    activeIntent: null,
    intentHistory: [],
    position: { x: 500, y: 150 },
    status: "alive",
  },
  {
    id: "agent-3",
    name: "Ambassador Liyen",
    type: "diplomat",
    factionId: "faction-meridian",
    goals: [
      { id: "g5", label: "Negotiate peace treaty", priority: 0.95, progress: 0.3, status: "active" },
      { id: "g6", label: "Establish trade routes", priority: 0.5, progress: 0.5, status: "active" },
    ],
    traits: { aggression: 0.1, diplomacy: 0.95, resourcefulness: 0.8, loyalty: 0.7, adaptability: 0.9 },
    state: { health: 1, morale: 0.75, influence: 60, wealth: 90 },
    resources: { food: 150, gold: 200, military: 20 },
    memory: [],
    activeIntent: null,
    intentHistory: [],
    position: { x: 350, y: 400 },
    status: "alive",
  },
  {
    id: "agent-4",
    name: "Spymaster Vex",
    type: "intelligence",
    factionId: "faction-sol",
    goals: [
      { id: "g7", label: "Infiltrate Iron faction", priority: 0.85, progress: 0.6, status: "active" },
      { id: "g8", label: "Uncover betrayal plot", priority: 0.9, progress: 0.2, status: "active" },
    ],
    traits: { aggression: 0.4, diplomacy: 0.5, resourcefulness: 0.95, loyalty: 0.8, adaptability: 0.85 },
    state: { health: 0.9, morale: 0.8, influence: 45, wealth: 70 },
    resources: { food: 50, gold: 100, military: 10 },
    memory: [],
    activeIntent: null,
    intentHistory: [],
    position: { x: 250, y: 100 },
    status: "alive",
  },
  {
    id: "agent-5",
    name: "Merchant Queen Oda",
    type: "economic",
    factionId: "faction-guild",
    goals: [
      { id: "g9", label: "Monopolize trade", priority: 0.8, progress: 0.5, status: "active" },
      { id: "g10", label: "Fund Meridian alliance", priority: 0.4, progress: 0.1, status: "active" },
    ],
    traits: { aggression: 0.2, diplomacy: 0.6, resourcefulness: 0.9, loyalty: 0.4, adaptability: 0.7 },
    state: { health: 1, morale: 0.95, influence: 55, wealth: 300 },
    resources: { food: 300, gold: 500, military: 5 },
    memory: [],
    activeIntent: null,
    intentHistory: [],
    position: { x: 600, y: 350 },
    status: "alive",
  },
  {
    id: "agent-6",
    name: "Prophet Ashka",
    type: "spiritual",
    factionId: "faction-dawn",
    goals: [
      { id: "g11", label: "Spread the Dawn doctrine", priority: 0.7, progress: 0.3, status: "active" },
      { id: "g12", label: "Prophecy: predict the great war", priority: 0.95, progress: 0, status: "active" },
    ],
    traits: { aggression: 0.15, diplomacy: 0.7, resourcefulness: 0.3, loyalty: 0.95, adaptability: 0.6 },
    state: { health: 0.8, morale: 1, influence: 90, wealth: 20 },
    resources: { food: 80, gold: 10, military: 30 },
    memory: [],
    activeIntent: null,
    intentHistory: [],
    position: { x: 400, y: 250 },
    status: "alive",
  },
];

const DEMO_RELATIONSHIPS: RelationshipEdge[] = [
  { id: "rel-1-2", sourceAgentId: "agent-1", targetAgentId: "agent-2", trust: -0.4, influence: 0.3, tension: 0.7, lastUpdatedTick: 0 },
  { id: "rel-1-3", sourceAgentId: "agent-1", targetAgentId: "agent-3", trust: 0.6, influence: 0.5, tension: 0.2, lastUpdatedTick: 0 },
  { id: "rel-1-4", sourceAgentId: "agent-1", targetAgentId: "agent-4", trust: 0.9, influence: 0.7, tension: 0.05, lastUpdatedTick: 0 },
  { id: "rel-2-3", sourceAgentId: "agent-2", targetAgentId: "agent-3", trust: -0.2, influence: 0.2, tension: 0.5, lastUpdatedTick: 0 },
  { id: "rel-2-5", sourceAgentId: "agent-2", targetAgentId: "agent-5", trust: 0.1, influence: 0.4, tension: 0.3, lastUpdatedTick: 0 },
  { id: "rel-3-5", sourceAgentId: "agent-3", targetAgentId: "agent-5", trust: 0.7, influence: 0.6, tension: 0.1, lastUpdatedTick: 0 },
  { id: "rel-3-6", sourceAgentId: "agent-3", targetAgentId: "agent-6", trust: 0.5, influence: 0.3, tension: 0.15, lastUpdatedTick: 0 },
  { id: "rel-4-2", sourceAgentId: "agent-4", targetAgentId: "agent-2", trust: -0.6, influence: 0.5, tension: 0.8, lastUpdatedTick: 0 },
  { id: "rel-5-6", sourceAgentId: "agent-5", targetAgentId: "agent-6", trust: 0.3, influence: 0.2, tension: 0.25, lastUpdatedTick: 0 },
  { id: "rel-6-1", sourceAgentId: "agent-6", targetAgentId: "agent-1", trust: 0.4, influence: 0.6, tension: 0.1, lastUpdatedTick: 0 },
];

// ─── Store Interface ─────────────────────────────────────────────

export interface ProjectRecord {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  scenarioId: string | null;
  createdAt: string;
}

export interface ScenarioRecord {
  id: string;
  projectId: string;
  name: string;
  summary: string;
  seed: number;
  rules: RuleSet;
}

export class InMemoryStore implements SimulationStore {
  projects = new Map<string, ProjectRecord>();
  scenarios = new Map<string, ScenarioRecord>();
  branches = new Map<string, TimelineBranch>();
  snapshots = new Map<string, Snapshot>();
  events = new Map<string, SimEvent[]>();
  explanations = new Map<string, ExplanationArtifact[]>();
  ledger = new Map<string, any>(); // Key: branchId:tick

  async getProject(id: string) { return this.projects.get(id) || null; }
  async listProjects(userId: string) { 
    return Array.from(this.projects.values()).filter(p => p.ownerId === userId || p.ownerId === "user-demo"); 
  }
  async saveProject(p: ProjectRecord) { this.projects.set(p.id, p); }
  async deleteProject(id: string) {
    this.projects.delete(id);

    const scenarioIds = Array.from(this.scenarios.values())
      .filter((scenario) => scenario.projectId === id)
      .map((scenario) => scenario.id);
    for (const scenarioId of scenarioIds) {
      this.scenarios.delete(scenarioId);
    }

    const branchIds = Array.from(this.branches.values())
      .filter((branch) => branch.projectId === id)
      .map((branch) => branch.id);
    for (const branchId of branchIds) {
      this.branches.delete(branchId);
      this.events.delete(branchId);
      this.explanations.delete(branchId);

      for (const ledgerKey of Array.from(this.ledger.keys())) {
        if (ledgerKey.startsWith(`${branchId}:`)) {
          this.ledger.delete(ledgerKey);
        }
      }
    }

    for (const snapshotId of Array.from(this.snapshots.keys())) {
      const snapshot = this.snapshots.get(snapshotId);
      if (snapshot && branchIds.includes(snapshot.branchId)) {
        this.snapshots.delete(snapshotId);
      }
    }
  }

  async getScenario(id: string) { return this.scenarios.get(id) || null; }
  async saveScenario(s: ScenarioRecord) { this.scenarios.set(s.id, s); }

  async getBranch(id: string) {
    const branch = this.branches.get(id) || null;
    if (!branch) return null;
    return { ...branch, latestState: ensureWorldState(branch.latestState) };
  }
  async listBranches(projectId: string) { 
    return Array.from(this.branches.values())
      .filter(b => b.projectId === projectId)
      .map((branch) => ({ ...branch, latestState: ensureWorldState(branch.latestState) })); 
  }
  async saveBranch(b: TimelineBranch) {
    this.branches.set(b.id, { ...b, latestState: ensureWorldState(b.latestState) });
  }

  async getSnapshot(id: string) {
    const snapshot = this.snapshots.get(id) || null;
    if (!snapshot) return null;
    return { ...snapshot, state: ensureWorldState(snapshot.state) };
  }
  async listSnapshots(branchId: string) {
    return Array.from(this.snapshots.values())
      .filter(s => s.branchId === branchId)
      .sort((a, b) => b.tick - a.tick)
      .map((snapshot) => ({ ...snapshot, state: ensureWorldState(snapshot.state) }));
  }
  async saveSnapshot(s: Snapshot) {
    this.snapshots.set(s.id, { ...s, state: ensureWorldState(s.state) });
    const toPrune = getSnapshotsToPrune(Array.from(this.snapshots.values()), s.branchId);
    if (toPrune.length > 0) {
      await this.deleteSnapshots(toPrune);
    }
  }
  async deleteSnapshots(ids: string[]) {
    ids.forEach(id => this.snapshots.delete(id));
  }

  async getEvents(branchId: string) { return this.events.get(branchId) || []; }
  async saveEvents(branchId: string, evs: SimEvent[]) {
    const existing = this.events.get(branchId) || [];
    // Only add unique events
    const existingIds = new Set(existing.map(e => e.id));
    const uniqueNew = evs.filter(e => !existingIds.has(e.id));
    this.events.set(branchId, [...existing, ...uniqueNew]);
  }

  async getExplanations(branchId: string) { return this.explanations.get(branchId) || []; }
  async saveExplanation(e: ExplanationArtifact) {
    const existing = this.explanations.get(e.branchId) || [];
    this.explanations.set(e.branchId, [e, ...existing]);
  }

  async getProposals(branchId: string, tick: number) {
    return this.ledger.get(`${branchId}:${tick}`) || null;
  }
  async saveProposals(branchId: string, tick: number, proposals: any) {
    this.ledger.set(`${branchId}:${tick}`, proposals);
  }

  async checkBranchOwnership(branchId: string, userId: string): Promise<boolean> {
    const branch = this.branches.get(branchId);
    if (!branch) return false;
    const project = this.projects.get(branch.projectId);
    return project?.ownerId === userId || userId === "user-demo" || userId === "dev-user-id";
  }
}

// ─── Global Store Singleton ──────────────────────────────────────

const DEMO_PROJECT_ID = "proj-demo";
const DEMO_SCENARIO_ID = "scen-demo";
const DEMO_BRANCH_ID = "branch-main";

export function createDemoWorldState(): WorldState {
  return ensureWorldState({
    tick: 0,
    agents: structuredClone(DEMO_AGENTS),
    relationships: structuredClone(DEMO_RELATIONSHIPS),
    events: [],
    rules: { ...DEFAULT_RULES },
    seed: DEFAULT_SEED,
    activeModifiers: [],
    gmNotes: [
      {
        id: "note-demo-inciting",
        tick: 0,
        title: "Session prep",
        content: "If Drask secures the Northern Pass, every trade route in the basin should feel it by next session.",
        linkedEventId: null,
        linkedRegionId: "region-faction-iron",
        linkedSiteId: null,
        linkedFrontId: null,
        tags: ["demo", "prep"],
        status: "open",
      },
    ],
  });
}

export function createBlankWorldState(): WorldState {
  return ensureWorldState({
    tick: 0,
    agents: [],
    relationships: [],
    campaignNodes: [],
    boardLinks: [],
    map: {
      id: "map-main",
      name: "Campaign Map",
      regions: [],
      sites: [],
      routes: [],
      tokens: [],
    },
    fronts: [],
    projections: [],
    gmNotes: [
      {
        id: "note-blank-start",
        tick: 0,
        title: "Start the timeline",
        content:
          "Inject your first consequence to create pressure, routes, actors, and downstream fallout.",
        linkedEventId: null,
        linkedRegionId: null,
        linkedSiteId: null,
        linkedFrontId: null,
        tags: ["onboarding"],
        status: "open",
      },
    ],
    events: [],
    rules: { ...DEFAULT_RULES },
    seed: DEFAULT_SEED,
    activeModifiers: [],
  });
}

function createDemoStore(): SimulationStore {
  const store = new InMemoryStore();

  store.projects.set(DEMO_PROJECT_ID, {
    id: DEMO_PROJECT_ID,
    ownerId: "user-demo",
    name: "The Fractured Realms",
    description:
      "A geopolitical simulation of five factions vying for control of a resource-scarce continent.",
    scenarioId: DEMO_SCENARIO_ID,
    createdAt: new Date().toISOString(),
  });

  store.scenarios.set(DEMO_SCENARIO_ID, {
    id: DEMO_SCENARIO_ID,
    projectId: DEMO_PROJECT_ID,
    name: "The Fractured Realms — Act I",
    summary:
      "Five factions compete for dominance. Alliances are fragile. A prophet foresees war.",
    seed: DEFAULT_SEED,
    rules: { ...DEFAULT_RULES },
  });

  const worldState = createDemoWorldState();

  store.branches.set(DEMO_BRANCH_ID, {
    id: DEMO_BRANCH_ID,
    projectId: DEMO_PROJECT_ID,
    scenarioId: DEMO_SCENARIO_ID,
    parentBranchId: null,
    name: "Main Timeline",
    summary: "The original timeline — all branches diverge from here.",
    branchPointTick: 0,
    branchOriginEventId: null,
    currentTick: 0,
    stateHash: "initial",
    status: "active",
    latestState: worldState,
  });

  store.events.set(DEMO_BRANCH_ID, []);
  store.snapshots.set("snap-demo-root", {
    id: "snap-demo-root",
    branchId: DEMO_BRANCH_ID,
    tick: 0,
    kind: "branch_point",
    stateHash: "initial",
    state: structuredClone(worldState),
    createdAt: new Date().toISOString(),
  });

  return store;
}

const globalForStore = globalThis as unknown as {
  __omniscientStore: SimulationStore | undefined;
};

export function getStore(): SimulationStore {
  if (!globalForStore.__omniscientStore) {
    const useInMemory = process.env.USE_IN_MEMORY_STORE === "true";

    // Prioritize in-memory store if requested, otherwise check for DATABASE_URL
    if (!useInMemory && process.env.DATABASE_URL) {
      console.log("Using PrismaStore (Database Persistence Enabled)");
      globalForStore.__omniscientStore = new PrismaStore();
    } else {
      console.log(`Using InMemoryStore (Ephemeral Storage${useInMemory ? " - Forced" : ""})`);
      globalForStore.__omniscientStore = createDemoStore();
    }
  }
  return globalForStore.__omniscientStore;
}

export { DEMO_PROJECT_ID, DEMO_SCENARIO_ID, DEMO_BRANCH_ID };
