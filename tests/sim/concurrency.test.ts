import { describe, it, expect, beforeEach } from "vitest";
import { SimController } from "@/lib/server/sim-controller";
import { InMemoryStore, DEMO_BRANCH_ID } from "@/lib/server/store";
import { SimCommand, WorldState } from "@/lib/sim/types";
import { DEFAULT_RULES, DEFAULT_SEED } from "@/lib/sim/constants";
import { ensureWorldState } from "@/lib/sim/campaign";

function createDemoWorldState(): WorldState {
  return ensureWorldState({
    tick: 0,
    agents: [],
    relationships: [],
    events: [],
    rules: { ...DEFAULT_RULES },
    seed: DEFAULT_SEED,
    activeModifiers: [],
  });
}

describe("Simulation Concurrency (OCC)", () => {
  let store: InMemoryStore;
  let controller: SimController;

  beforeEach(async () => {
    store = new InMemoryStore();
    const branch = {
      id: DEMO_BRANCH_ID,
      projectId: "proj-1",
      scenarioId: "scen-1",
      parentBranchId: null,
      name: "Main",
      summary: "Main timeline",
      branchPointTick: 0,
      branchOriginEventId: null,
      currentTick: 0,
      stateHash: "hash-0",
      status: "active" as const,
      latestState: createDemoWorldState(),
    };
    await store.saveBranch(branch);
    controller = new SimController(store);
  });

  it("rejects a step command with a stale currentTick (409 Conflict)", async () => {
    // Initial state: currentTick is 0
    const branch = (await store.getBranch(DEMO_BRANCH_ID))!;
    expect(branch.currentTick).toBe(0);

    // 1. First request succeeds (currentTick 0 matches)
    const cmd1: SimCommand = { type: "step", branchId: DEMO_BRANCH_ID, currentTick: 0 };
    const res1 = await controller.execute(cmd1);
    expect(res1.status).toBe(200);
    
    // Branch has moved to tick 1
    const updatedBranch = (await store.getBranch(DEMO_BRANCH_ID))!;
    expect(updatedBranch.currentTick).toBe(1);

    // 2. Second request fails (currentTick 0 is now stale)
    const cmd2: SimCommand = { type: "step", branchId: DEMO_BRANCH_ID, currentTick: 0 };
    const res2 = await controller.execute(cmd2);
    
    expect(res2.status).toBe(409);
    expect(res2.error).toContain("Conflict");
    expect(res2.data.serverTick).toBe(1);
    expect(res2.data.clientTick).toBe(0);
  });

  it("allows a step command when currentTick is omitted (backward compatibility)", async () => {
    // Step without currentTick
    const cmd: SimCommand = { type: "step", branchId: DEMO_BRANCH_ID };
    const res = await controller.execute(cmd);
    expect(res.status).toBe(200);
  });
});
