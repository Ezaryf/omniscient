import { PrismaClient } from "@prisma/client";
import { DEFAULT_RULES, DEFAULT_SEED } from "../lib/sim/constants";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const DEMO_PROJECT_ID = "proj-demo";
  const DEMO_SCENARIO_ID = "scen-demo";
  const DEMO_BRANCH_ID = "branch-main";
  const DEMO_USER_ID = "user-demo";

  // 1. Create User
  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: {
      id: DEMO_USER_ID,
      name: "Demo User",
      email: "demo@omniscient.ai",
    },
  });

  // 2. Create Project
  await prisma.project.upsert({
    where: { id: DEMO_PROJECT_ID },
    update: {},
    create: {
      id: DEMO_PROJECT_ID,
      ownerId: DEMO_USER_ID,
      name: "The Fractured Realms",
      description: "A geopolitical simulation of five factions vying for control of a resource-scarce continent.",
    },
  });

  // 3. Create Scenario
  await prisma.scenario.upsert({
    where: { id: DEMO_SCENARIO_ID },
    update: {},
    create: {
      id: DEMO_SCENARIO_ID,
      projectId: DEMO_PROJECT_ID,
      name: "The Fractured Realms — Act I",
      summary: "Five factions compete for dominance. Alliances are fragile. A prophet foresees war.",
      seed: DEFAULT_SEED,
      rules: {
        create: {
          scarcity: DEFAULT_RULES.scarcity,
          trustDecay: DEFAULT_RULES.trustDecay,
          contagion: DEFAULT_RULES.contagion,
          shockLikelihood: DEFAULT_RULES.shockLikelihood,
          maxTicks: DEFAULT_RULES.maxTicks,
          aiConfidenceFloor: DEFAULT_RULES.aiConfidenceFloor,
        },
      },
    },
  });

  // 4. Create Branch
  const initialWorldState = {
    tick: 0,
    agents: [
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
        position: { x: 500, y: 150 },
        status: "alive",
      }
    ],
    relationships: [
      { id: "rel-1-2", sourceAgentId: "agent-1", targetAgentId: "agent-2", trust: -0.4, influence: 0.3, tension: 0.7, lastUpdatedTick: 0 },
    ],
    events: [],
    rules: { ...DEFAULT_RULES },
    seed: DEFAULT_SEED,
    activeModifiers: [],
    gmNotes: [],
  };

  await prisma.branch.upsert({
    where: { id: DEMO_BRANCH_ID },
    update: {
      latestState: initialWorldState as any,
    },
    create: {
      id: DEMO_BRANCH_ID,
      projectId: DEMO_PROJECT_ID,
      scenarioId: DEMO_SCENARIO_ID,
      name: "Main Timeline",
      summary: "The original timeline — all branches diverge from here.",
      branchPointTick: 0,
      currentTick: 0,
      stateHash: "initial",
      status: "active",
      latestState: initialWorldState as any,
    },
  });

  // 5. Create Root Snapshot
  await prisma.snapshot.upsert({
    where: { id: "snap-demo-root" },
    update: {},
    create: {
      id: "snap-demo-root",
      branchId: DEMO_BRANCH_ID,
      scenarioId: DEMO_SCENARIO_ID,
      tick: 0,
      kind: "branch_point",
      stateHash: "initial",
      state: initialWorldState as any,
      createdAt: new Date(),
    },
  });

  console.log("✅ Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
