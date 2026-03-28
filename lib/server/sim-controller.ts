import { SimulationStore } from "./store-types";
import { SimCommand } from "@/lib/sim/types";
import { tick } from "@/lib/sim/engine";
import { createRng } from "@/lib/sim/seed";
import { hashState } from "@/lib/sim/hash";
import { createSnapshot } from "@/lib/sim/snapshot";
import { getActionProposals } from "./ai/orchestrator";
import { calculateStateDelta } from "@/lib/sim/diff";

export interface SimControllerResponse {
  status: number;
  data?: any;
  error?: string;
}

export class SimController {
  constructor(private readonly store: SimulationStore) {}

  async execute(command: SimCommand): Promise<SimControllerResponse> {
    const branch = await this.store.getBranch(command.branchId);
    if (!branch) {
      return { status: 404, error: "Branch not found" };
    }

    // Extract aiSettings from commands that support it
    const aiConfig = ("aiSettings" in command && command.aiSettings) ? command.aiSettings : null;

    // OCC Check
    if ("currentTick" in command && command.currentTick !== undefined && command.currentTick !== branch.currentTick) {
      return {
        status: 409,
        error: `Conflict: Simulation at tick ${branch.currentTick}, but request for ${command.currentTick}.`,
        data: { serverTick: branch.currentTick, clientTick: command.currentTick }
      };
    }

    switch (command.type) {
      case "step": {
        const rng = createRng(branch.latestState.seed + branch.currentTick);
        const stateHash = await hashState(branch.latestState);
        const { proposals } = await getActionProposals(branch.id, branch.latestState, stateHash, aiConfig);
        
        const oldState = branch.latestState;
        const result = tick(branch.latestState, rng, proposals);
        
        branch.latestState = result.worldState;
        branch.currentTick = result.worldState.tick;
        branch.stateHash = await hashState(result.worldState);
        await this.store.saveBranch(branch);
        await this.store.saveEvents(branch.id, result.events);
        
        if (result.snapshotCreated) {
          await this.store.saveSnapshot(await createSnapshot(branch.id, result.worldState, "checkpoint"));
        }
        
        return { status: 200, data: { worldState: result.worldState, delta: calculateStateDelta(oldState, result.worldState), events: result.events, proposals: result.proposals } };
      }
      case "fastForward": {
        const oldState = branch.latestState;
        const allEvents = [];
        for (let i = 0; i < command.ticks; i++) {
          const rng = createRng(branch.latestState.seed + branch.currentTick);
          const stateHash = await hashState(branch.latestState);

          // Use AI proposals if aiSettings provided, otherwise heuristic
          let proposals: import("@/lib/sim/types").ActionProposal[] | undefined;
          if (aiConfig) {
            const aiResult = await getActionProposals(branch.id, branch.latestState, stateHash, aiConfig);
            proposals = aiResult.proposals;
          }

          const result = tick(branch.latestState, rng, proposals);
          branch.latestState = result.worldState;
          branch.currentTick = result.worldState.tick;
          allEvents.push(...result.events);
        }
        branch.stateHash = await hashState(branch.latestState);
        await this.store.saveBranch(branch);
        await this.store.saveEvents(branch.id, allEvents);
        return { status: 200, data: { worldState: branch.latestState, delta: calculateStateDelta(oldState, branch.latestState), events: allEvents } };
      }
      case "createBranch": {
        const newBranchId = `branch-${Date.now().toString(36)}`;
        const targetBranch = await this.store.getBranch(command.branchId);
        const newBranch = {
          id: newBranchId,
          projectId: targetBranch?.projectId ?? branch.projectId,
          scenarioId: targetBranch?.scenarioId ?? "scene-default",
          name: command.name,
          summary: command.summary ?? "A new timeline branch",
          parentBranchId: command.branchId,
          branchPointTick: branch.currentTick,
          currentTick: branch.currentTick,
          latestState: structuredClone(branch.latestState),
          stateHash: branch.stateHash,
          status: "active" as const,
        };
        await this.store.saveBranch(newBranch as any); // store uses its internal type, but any is safe here given it matches TimelineBranch mostly
        return { status: 201, data: { branch: newBranch } };
      }
      default: return { status: 400, error: "Command not supported" };
    }
  }

  /**
   * Predict the future state of a branch for N ticks.
   * Ephemeral: Does not save to database.
   * Heuristic: Uses internal simulation logic without calling AI for speed.
   */
  async predict(branchId: string, ticks: number = 5, aiSettings?: any): Promise<SimControllerResponse> {
    const branch = await this.store.getBranch(branchId);
    if (!branch) return { status: 404, error: "Branch not found" };

    let currentState = branch.latestState;
    const projections = [];

    for (let i = 0; i < ticks; i++) {
      const rng = createRng(currentState.seed + currentState.tick);
      const result = tick(currentState, rng); // Uses heuristic actions automatically
      currentState = result.worldState;
      
      projections.push({
        tick: currentState.tick,
        agents: currentState.agents.map(a => ({
          id: a.id,
          position: a.position,
          health: a.state.health,
          morale: a.state.morale
        })),
        events: result.events.slice(0, 3).map(e => e.description)
      });
    }

    return { status: 200, data: { projections } };
  }
}
