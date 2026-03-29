import { createBranch } from "@/lib/sim/branch";
import {
  applyCausalConsequences,
  createCausalEvent,
  ensureWorldState,
} from "@/lib/sim/campaign";
import { calculateStateDelta } from "@/lib/sim/diff";
import { tick } from "@/lib/sim/engine";
import { hashState } from "@/lib/sim/hash";
import { createRng } from "@/lib/sim/seed";
import {
  createSnapshot,
  findNearestSnapshot,
  replayEvents,
  restoreFromSnapshot,
} from "@/lib/sim/snapshot";
import type { ActionProposal, SimCommand, WorldState } from "@/lib/sim/types";
import { applyEventImpacts, validateRuleChange } from "@/lib/sim/rules";
import { getActionProposals } from "./ai/orchestrator";
import type { SimulationStore } from "./store-types";
import { materializeCampaignSetupDraft } from "@/lib/sim/setup";

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

    branch.latestState = ensureWorldState(branch.latestState);
    const aiConfig = "aiSettings" in command ? command.aiSettings ?? null : null;

    if (
      "currentTick" in command &&
      command.currentTick !== undefined &&
      command.currentTick !== branch.currentTick
    ) {
      return {
        status: 409,
        error: `Conflict: Simulation at tick ${branch.currentTick}, but request for ${command.currentTick}.`,
        data: { serverTick: branch.currentTick, clientTick: command.currentTick },
      };
    }

    switch (command.type) {
      case "step":
        return this.runTicks(branch, 1, aiConfig);
      case "fastForward":
        return this.runTicks(branch, command.ticks, aiConfig);
      case "simulateUntil":
        return this.runTicks(branch, Math.max(0, command.targetTick - branch.currentTick), aiConfig);
      case "injectEvent":
        return this.injectEvent(branch.id, command.event);
      case "changeRule":
        return this.changeRule(branch.id, command.patch);
      case "createBranch":
        return this.createTimelineBranch(branch.id, command.name, command.summary);
      case "forkFromEvent":
        return this.forkFromEvent(branch.id, command.eventId, command.name, command.summary);
      case "acknowledgeConsequence":
        return this.acknowledgeConsequence(branch.id, command.consequenceId, command.note);
      case "moveToken":
        return this.moveToken(branch.id, command.tokenId, {
          regionId: command.regionId ?? null,
          siteId: command.siteId ?? null,
          x: command.x,
          y: command.y,
        });
      case "moveAgent":
        return this.moveAgent(branch.id, command.agentId, command.x, command.y);
      case "moveSite":
        return this.moveSite(branch.id, command.siteId, {
          regionId: command.regionId ?? null,
          x: command.x,
          y: command.y,
        });
      case "moveRegion":
        return this.moveRegion(branch.id, command.regionId, command.x, command.y);
      case "resizeRegion":
        return this.resizeRegion(branch.id, command.regionId, command.radius);
      case "moveCampaignNode":
        return this.moveCampaignNode(branch.id, command.nodeId, {
          x: command.x,
          y: command.y,
          radius: command.radius,
        });
      case "createRegion":
        return this.createRegion(branch.id, command);
      case "createSite":
        return this.createSite(branch.id, command);
      case "createToken":
        return this.createToken(branch.id, command);
      case "createRoute":
        return this.createRoute(branch.id, command);
      case "createBoardLink":
        return this.createBoardLink(branch.id, command);
      case "createCampaignNode":
        return this.createCampaignNode(branch.id, command);
      case "deleteCampaignNode":
        return this.deleteCampaignNode(branch.id, command.nodeId);
      case "deleteBoardLink":
        return this.deleteBoardLink(branch.id, command.linkId);
      case "advanceFront":
        return this.advanceFront(branch.id, command.frontId, command.delta, command.rationale);
      case "applySetup":
        return this.applySetup(branch.id, command.draft);
      default:
        return { status: 400, error: "Command not supported" };
    }
  }

  async predict(branchId: string, ticks = 5, aiSettings?: any): Promise<SimControllerResponse> {
    const branch = await this.store.getBranch(branchId);
    if (!branch) return { status: 404, error: "Branch not found" };

    let currentState = ensureWorldState(branch.latestState);
    const projections = [];

    for (let index = 0; index < ticks; index++) {
      const rng = createRng(currentState.seed + currentState.tick);
      const result = tick(currentState, rng);
      currentState = ensureWorldState(result.worldState);

      projections.push({
        tick: currentState.tick,
        agents: currentState.agents.map((agent) => ({
          id: agent.id,
          position: agent.position,
          health: agent.state.health,
          morale: agent.state.morale,
          factionId: agent.factionId,
        })),
        fronts: currentState.fronts.map((front) => ({
          id: front.id,
          name: front.name,
          progress: front.progress,
          pressure: front.pressure,
          status: front.status,
        })),
        map: {
          routes: currentState.map.routes.map((route) => ({
            id: route.id,
            status: route.status,
            integrity: route.integrity,
            risk: route.risk,
          })),
          regions: currentState.map.regions.map((region) => ({
            id: region.id,
            threat: region.threat,
            supply: region.supply,
            stability: region.stability,
          })),
        },
        events: result.events.slice(-3).map((event) => event.description),
        projections: currentState.projections.slice(0, 3),
      });
    }

    return { status: 200, data: { projections } };
  }

  private async runTicks(
    branch: NonNullable<Awaited<ReturnType<SimulationStore["getBranch"]>>>,
    ticks: number,
    aiConfig: any
  ): Promise<SimControllerResponse> {
    if (ticks === 0) {
      return { status: 200, data: { worldState: branch.latestState, delta: calculateStateDelta(branch.latestState, branch.latestState), events: [] } };
    }

    const oldState = ensureWorldState(branch.latestState);
    let allEvents: WorldState["events"] = [];
    let lastProposals: ActionProposal[] = [];

    for (let index = 0; index < ticks; index++) {
      const rng = createRng(branch.latestState.seed + branch.currentTick);
      const stateHash = await hashState(branch.latestState);

      let proposals: ActionProposal[] | undefined;
      if (aiConfig) {
        const aiResult = await getActionProposals(branch.id, branch.latestState, stateHash, aiConfig);
        proposals = aiResult.proposals;
      }

      const result = tick(branch.latestState, rng, proposals);
      branch.latestState = ensureWorldState(result.worldState);
      branch.currentTick = branch.latestState.tick;
      branch.stateHash = await hashState(branch.latestState);
      allEvents = [...allEvents, ...result.events];
      lastProposals = result.proposals;

      if (result.snapshotCreated) {
        await this.store.saveSnapshot(await createSnapshot(branch.id, branch.latestState, "checkpoint"));
      }
    }

    await this.store.saveBranch(branch);
    await this.store.saveEvents(branch.id, allEvents);

    return {
      status: 200,
      data: {
        worldState: branch.latestState,
        delta: calculateStateDelta(oldState, branch.latestState),
        events: allEvents,
        proposals: lastProposals,
      },
    };
  }

  private async injectEvent(branchId: string, rawEvent: any): Promise<SimControllerResponse> {
    const branch = await this.store.getBranch(branchId);
    if (!branch) return { status: 404, error: "Branch not found" };

    const oldState = ensureWorldState(branch.latestState);
    const tickValue = oldState.tick + 1;
    const event = createCausalEvent(oldState, {
      tick: tickValue,
      type: rawEvent.type ?? "injected",
      description: rawEvent.description,
      sourceAgentId: rawEvent.sourceAgentId ?? null,
      targetAgentId: rawEvent.targetAgentId ?? null,
      impact: rawEvent.impact ?? [],
      confidence: 0.95,
      tags: rawEvent.tags ?? ["manual"],
      metadata: { ...(rawEvent.metadata ?? {}), generatedBy: "gm" },
      sequence: 0,
    });

    const nextState = this.applyManualEvent(oldState, event);
    branch.latestState = nextState;
    branch.currentTick = nextState.tick;
    branch.stateHash = await hashState(nextState);

    await this.store.saveBranch(branch);
    await this.store.saveEvents(branch.id, [event]);
    await this.store.saveSnapshot(await createSnapshot(branch.id, nextState, "manual"));

    return {
      status: 200,
      data: {
        worldState: nextState,
        delta: calculateStateDelta(oldState, nextState),
        events: [event],
      },
    };
  }

  private async changeRule(branchId: string, patch: Partial<WorldState["rules"]>): Promise<SimControllerResponse> {
    const branch = await this.store.getBranch(branchId);
    if (!branch) return { status: 404, error: "Branch not found" };

    const oldState = ensureWorldState(branch.latestState);
    const validation = validateRuleChange(patch);
    if (!validation.valid) {
      return { status: 400, error: validation.errors.join(", ") };
    }

    const tickValue = oldState.tick + 1;
    const event = createCausalEvent(oldState, {
      tick: tickValue,
      type: "rule_change",
      description: `GM adjusted world rules: ${Object.keys(patch).join(", ")}`,
      impact: [],
      confidence: 1,
      tags: ["rules", "manual"],
      metadata: { patch },
      sequence: 0,
    });

    const nextState = ensureWorldState({
      ...oldState,
      tick: tickValue,
      rules: { ...oldState.rules, ...patch },
      events: [...oldState.events, event].slice(-200),
    });

    branch.latestState = nextState;
    branch.currentTick = nextState.tick;
    branch.stateHash = await hashState(nextState);

    await this.store.saveBranch(branch);
    await this.store.saveEvents(branch.id, [event]);

    return {
      status: 200,
      data: {
        worldState: nextState,
        delta: calculateStateDelta(oldState, nextState),
        events: [event],
      },
    };
  }

  private async createTimelineBranch(branchId: string, name: string, summary?: string): Promise<SimControllerResponse> {
    const sourceBranch = await this.store.getBranch(branchId);
    if (!sourceBranch) return { status: 404, error: "Branch not found" };

    const { branch, snapshot } = await createBranch(sourceBranch, name, summary);
    await this.store.saveBranch(branch);
    await this.store.saveSnapshot(await snapshot);

    return { status: 201, data: { branch } };
  }

  private async forkFromEvent(
    branchId: string,
    eventId: string,
    name: string,
    summary?: string
  ): Promise<SimControllerResponse> {
    const sourceBranch = await this.store.getBranch(branchId);
    if (!sourceBranch) return { status: 404, error: "Branch not found" };

    const allEvents = await this.store.getEvents(branchId);
    const targetEvent = allEvents.find((event) => event.id === eventId);
    if (!targetEvent) {
      return { status: 404, error: "Event not found on branch" };
    }

    const snapshots = await this.store.listSnapshots(branchId);
    const nearestSnapshot = findNearestSnapshot(snapshots, targetEvent.tick);

    let baseState = ensureWorldState(sourceBranch.latestState);
    let replayFromTick = 0;

    if (nearestSnapshot) {
      baseState = restoreFromSnapshot(nearestSnapshot);
      replayFromTick = nearestSnapshot.tick;
    }

    const replayedState = replayEvents(
      baseState,
      allEvents.filter((event) => event.tick > replayFromTick && event.tick <= targetEvent.tick)
    );

    const childBranch = {
      ...sourceBranch,
      id: `branch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      parentBranchId: sourceBranch.id,
      name,
      summary: summary ?? `Forked from "${targetEvent.description}" at tick ${targetEvent.tick}`,
      branchPointTick: targetEvent.tick,
      branchOriginEventId: targetEvent.id,
      currentTick: replayedState.tick,
      latestState: ensureWorldState(replayedState),
      stateHash: await hashState(replayedState),
      status: "active" as const,
    };

    await this.store.saveBranch(childBranch);
    await this.store.saveSnapshot(await createSnapshot(childBranch.id, childBranch.latestState, "branch_point"));

    return { status: 201, data: { branch: childBranch } };
  }

  private async acknowledgeConsequence(
    branchId: string,
    consequenceId: string,
    note?: string
  ): Promise<SimControllerResponse> {
    const branch = await this.store.getBranch(branchId);
    if (!branch) return { status: 404, error: "Branch not found" };

    const oldState = ensureWorldState(branch.latestState);
    const projections = oldState.projections.map((projection) =>
      projection.id === consequenceId ? { ...projection, acknowledged: true } : projection
    );

    const nextState = ensureWorldState({
      ...oldState,
      projections,
      gmNotes: note
        ? [
            {
              id: `note-${Date.now().toString(36)}`,
              tick: oldState.tick,
              title: "Session Prep Note",
              content: note,
              linkedEventId: null,
              linkedRegionId: null,
              linkedSiteId: null,
              linkedFrontId: oldState.fronts.find((front) => `projection-front-${front.id}` === consequenceId)?.id ?? null,
              status: "acknowledged",
            },
            ...oldState.gmNotes,
          ]
        : oldState.gmNotes,
    });

    branch.latestState = nextState;
    branch.stateHash = await hashState(nextState);
    await this.store.saveBranch(branch);

    return {
      status: 200,
      data: {
        worldState: nextState,
        delta: calculateStateDelta(oldState, nextState),
        events: [],
      },
    };
  }

  private async moveToken(
    branchId: string,
    tokenId: string,
    destination: { regionId: string | null; siteId: string | null; x?: number; y?: number }
  ): Promise<SimControllerResponse> {
    const branch = await this.store.getBranch(branchId);
    if (!branch) return { status: 404, error: "Branch not found" };

    const oldState = ensureWorldState(branch.latestState);
    const token = oldState.map.tokens.find((entry) => entry.id === tokenId);
    if (!token) {
      return { status: 404, error: "Token not found" };
    }

    const tickValue = oldState.tick + 1;
    const event = createCausalEvent(oldState, {
      tick: tickValue,
      type: "movement",
      description: `${token.name} repositions on the campaign map`,
      impact: [],
      confidence: 0.98,
      tags: ["movement", token.kind],
      metadata: {
        entityType: "token",
        tokenId,
        regionId: destination.regionId,
        siteId: destination.siteId,
        x: destination.x ?? token.position.x,
        y: destination.y ?? token.position.y,
      },
      sequence: 0,
    });

    const nextState = this.applyManualEvent(oldState, event);
    branch.latestState = nextState;
    branch.currentTick = nextState.tick;
    branch.stateHash = await hashState(nextState);

    await this.store.saveBranch(branch);
    await this.store.saveEvents(branch.id, [event]);

    return {
      status: 200,
      data: {
        worldState: nextState,
        delta: calculateStateDelta(oldState, nextState),
        events: [event],
      },
    };
  }

  private async moveAgent(
    branchId: string,
    agentId: string,
    x: number,
    y: number
  ): Promise<SimControllerResponse> {
    const branch = await this.store.getBranch(branchId);
    if (!branch) return { status: 404, error: "Branch not found" };

    const oldState = ensureWorldState(branch.latestState);
    const agent = oldState.agents.find((entry) => entry.id === agentId);
    if (!agent) {
      return { status: 404, error: "Agent not found" };
    }

    const tickValue = oldState.tick + 1;
    const region = findRegionForPosition(oldState.map, { x, y });
    const event = createCausalEvent(oldState, {
      tick: tickValue,
      type: "movement",
      description: `${agent.name} changes position on the campaign map`,
      impact: [],
      confidence: 0.98,
      tags: ["movement", "agent", agent.type],
      metadata: {
        entityType: "agent",
        agentId,
        x,
        y,
      },
      affects: [agent.id, ...(region ? [region.id] : [])],
      sequence: 0,
    });

    const nextState = this.applyManualEvent(oldState, event);
    branch.latestState = nextState;
    branch.currentTick = nextState.tick;
    branch.stateHash = await hashState(nextState);
    await this.store.saveBranch(branch);
    await this.store.saveEvents(branch.id, [event]);

    return {
      status: 200,
      data: {
        worldState: nextState,
        delta: calculateStateDelta(oldState, nextState),
        events: [event],
      },
    };
  }

  private async moveSite(
    branchId: string,
    siteId: string,
    destination: { regionId: string | null; x: number; y: number }
  ): Promise<SimControllerResponse> {
    const branch = await this.store.getBranch(branchId);
    if (!branch) return { status: 404, error: "Branch not found" };

    const oldState = ensureWorldState(branch.latestState);
    const site = oldState.map.sites.find((entry) => entry.id === siteId);
    if (!site) {
      return { status: 404, error: "Site not found" };
    }

    const tickValue = oldState.tick + 1;
    const regionId =
      destination.regionId ?? findRegionForPosition(oldState.map, { x: destination.x, y: destination.y })?.id ?? site.regionId;
    const event = createCausalEvent(oldState, {
      tick: tickValue,
      type: "movement",
      description: `${site.name} is repositioned on the campaign map`,
      impact: [],
      confidence: 0.97,
      tags: ["movement", "site", site.kind],
      metadata: {
        entityType: "site",
        siteId,
        regionId,
        x: destination.x,
        y: destination.y,
      },
      affects: unique([site.id, regionId]),
      sequence: 0,
    });

    const nextState = this.applyManualEvent(oldState, event);
    branch.latestState = nextState;
    branch.currentTick = nextState.tick;
    branch.stateHash = await hashState(nextState);
    await this.store.saveBranch(branch);
    await this.store.saveEvents(branch.id, [event]);

    return {
      status: 200,
      data: {
        worldState: nextState,
        delta: calculateStateDelta(oldState, nextState),
        events: [event],
      },
    };
  }

  private async moveRegion(
    branchId: string,
    regionId: string,
    x: number,
    y: number
  ): Promise<SimControllerResponse> {
    const branch = await this.store.getBranch(branchId);
    if (!branch) return { status: 404, error: "Branch not found" };

    const oldState = ensureWorldState(branch.latestState);
    const region = oldState.map.regions.find((entry) => entry.id === regionId);
    if (!region) {
      return { status: 404, error: "Region not found" };
    }

    const tickValue = oldState.tick + 1;
    const event = createCausalEvent(oldState, {
      tick: tickValue,
      type: "movement",
      description: `${region.name} is reframed on the campaign map`,
      impact: [],
      confidence: 0.97,
      tags: ["movement", "region", region.kind],
      metadata: {
        entityType: "region",
        regionId,
        x,
        y,
        radius: region.radius,
      },
      affects: [region.id],
      sequence: 0,
    });

    const nextState = this.applyManualEvent(oldState, event);
    branch.latestState = nextState;
    branch.currentTick = nextState.tick;
    branch.stateHash = await hashState(nextState);
    await this.store.saveBranch(branch);
    await this.store.saveEvents(branch.id, [event]);

    return {
      status: 200,
      data: {
        worldState: nextState,
        delta: calculateStateDelta(oldState, nextState),
        events: [event],
      },
    };
  }

  private async resizeRegion(
    branchId: string,
    regionId: string,
    radius: number
  ): Promise<SimControllerResponse> {
    const branch = await this.store.getBranch(branchId);
    if (!branch) return { status: 404, error: "Branch not found" };

    const oldState = ensureWorldState(branch.latestState);
    const region = oldState.map.regions.find((entry) => entry.id === regionId);
    if (!region) {
      return { status: 404, error: "Region not found" };
    }

    const tickValue = oldState.tick + 1;
    const event = createCausalEvent(oldState, {
      tick: tickValue,
      type: "movement",
      description: `${region.name} boundary is resized on the campaign map`,
      impact: [],
      confidence: 0.97,
      tags: ["movement", "region", "resize"],
      metadata: {
        entityType: "region",
        regionId,
        x: region.center.x,
        y: region.center.y,
        radius,
      },
      affects: [region.id],
      sequence: 0,
    });

    const nextState = this.applyManualEvent(oldState, event);
    branch.latestState = nextState;
    branch.currentTick = nextState.tick;
    branch.stateHash = await hashState(nextState);
    await this.store.saveBranch(branch);
    await this.store.saveEvents(branch.id, [event]);

    return {
      status: 200,
      data: {
        worldState: nextState,
        delta: calculateStateDelta(oldState, nextState),
        events: [event],
      },
    };
  }

  private async moveCampaignNode(
    branchId: string,
    nodeId: string,
    update: { x?: number; y?: number; radius?: number }
  ): Promise<SimControllerResponse> {
    const branch = await this.store.getBranch(branchId);
    if (!branch) return { status: 404, error: "Branch not found" };

    const state = ensureWorldState(branch.latestState);
    const node = state.campaignNodes.find((entry) => entry.id === nodeId);
    if (!node) {
      return { status: 404, error: "Campaign node not found" };
    }

    switch (node.kind) {
      case "agent":
        if ((node.tags ?? []).includes("manual")) {
          const event = createCausalEvent(state, {
            tick: state.tick + 1,
            type: "movement",
            description: `${node.name} is repositioned on the campaign board`,
            confidence: 0.97,
            tags: ["movement", "campaign-node", node.kind],
            affects: unique([node.id, node.regionId, node.siteId]),
            metadata: {
              moveCampaignNode: {
                id: node.id,
                x: update.x ?? node.position.x,
                y: update.y ?? node.position.y,
                regionId: node.regionId ?? null,
                siteId: node.siteId ?? null,
              },
            },
            impact: [],
            sequence: 0,
          });
          return this.commitCanvasMutation(branch, state, event);
        }
        return this.moveAgent(branchId, node.id.replace(/^node-/, ""), update.x ?? node.position.x, update.y ?? node.position.y);
      case "region":
        if (typeof update.radius === "number" && update.x === undefined && update.y === undefined) {
          return this.resizeRegion(branchId, node.regionId ?? node.id.replace(/^node-/, ""), update.radius);
        }
        return this.moveRegion(branchId, node.regionId ?? node.id.replace(/^node-/, ""), update.x ?? node.position.x, update.y ?? node.position.y);
      case "site":
        return this.moveSite(branchId, node.siteId ?? node.id.replace(/^node-/, ""), {
          regionId: node.regionId,
          x: update.x ?? node.position.x,
          y: update.y ?? node.position.y,
        });
      case "party":
        return this.moveToken(branchId, node.id.replace(/^node-/, ""), {
          regionId: node.regionId,
          siteId: node.siteId,
          x: update.x ?? node.position.x,
          y: update.y ?? node.position.y,
        });
      case "faction":
      case "front":
      case "event":
      case "place": {
        const event = createCausalEvent(state, {
          tick: state.tick + 1,
          type: "movement",
          description: `${node.name} is repositioned on the campaign board`,
          confidence: 0.97,
          tags: ["movement", "campaign-node", node.kind],
          affects: unique([node.id, node.regionId, node.siteId]),
          metadata: {
            moveCampaignNode: {
              id: node.id,
              x: update.x ?? node.position.x,
              y: update.y ?? node.position.y,
              regionId: node.regionId ?? null,
              siteId: node.siteId ?? null,
            },
          },
          impact: [],
          sequence: 0,
        });
        return this.commitCanvasMutation(branch, state, event);
      }
      default:
        return { status: 400, error: `Direct movement is not supported for ${node.kind} nodes.` };
    }
  }

  private async createRegion(branchId: string, command: Extract<SimCommand, { type: "createRegion" }>): Promise<SimControllerResponse> {
    const branch = await this.store.getBranch(branchId);
    if (!branch) return { status: 404, error: "Branch not found" };
    const oldState = ensureWorldState(branch.latestState);
    const tickValue = oldState.tick + 1;
    const regionId = `region-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const event = createCausalEvent(oldState, {
      tick: tickValue,
      type: "injected",
      description: `${command.name} is added to the campaign map`,
      confidence: 0.99,
      tags: ["manual", "create-region"],
      affects: [regionId],
      metadata: {
        createRegion: {
          id: regionId,
          name: command.name,
          kind: command.kind,
          center: { x: command.x, y: command.y },
          radius: command.radius ?? 120,
          controllingFactionId: command.controllingFactionId ?? null,
        },
      },
      impact: [],
      sequence: 0,
    });
    return this.commitCanvasMutation(branch, oldState, event);
  }

  private async createSite(branchId: string, command: Extract<SimCommand, { type: "createSite" }>): Promise<SimControllerResponse> {
    const branch = await this.store.getBranch(branchId);
    if (!branch) return { status: 404, error: "Branch not found" };
    const oldState = ensureWorldState(branch.latestState);
    const tickValue = oldState.tick + 1;
    const siteId = `site-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const regionId = command.regionId ?? findRegionForPosition(oldState.map, { x: command.x, y: command.y })?.id ?? null;
    const event = createCausalEvent(oldState, {
      tick: tickValue,
      type: "injected",
      description: `${command.name} is placed on the campaign map`,
      confidence: 0.99,
      tags: ["manual", "create-site"],
      affects: unique([siteId, regionId]),
      metadata: {
        createSite: {
          id: siteId,
          name: command.name,
          kind: command.kind,
          regionId,
          position: { x: command.x, y: command.y },
          controllingFactionId: command.controllingFactionId ?? null,
        },
      },
      impact: [],
      sequence: 0,
    });
    return this.commitCanvasMutation(branch, oldState, event);
  }

  private async createToken(branchId: string, command: Extract<SimCommand, { type: "createToken" }>): Promise<SimControllerResponse> {
    const branch = await this.store.getBranch(branchId);
    if (!branch) return { status: 404, error: "Branch not found" };
    const oldState = ensureWorldState(branch.latestState);
    const tickValue = oldState.tick + 1;
    const tokenId = `token-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const regionId = command.regionId ?? findRegionForPosition(oldState.map, { x: command.x, y: command.y })?.id ?? null;
    const siteId = command.siteId ?? findSiteForPosition(oldState.map, { x: command.x, y: command.y })?.id ?? null;
    const event = createCausalEvent(oldState, {
      tick: tickValue,
      type: "injected",
      description: `${command.name} enters the campaign map`,
      confidence: 0.99,
      tags: ["manual", "create-token", command.kind],
      affects: unique([tokenId, regionId, siteId]),
      metadata: {
        createToken: {
          id: tokenId,
          name: command.name,
          kind: command.kind,
          regionId,
          siteId,
          factionId: command.factionId ?? null,
          position: { x: command.x, y: command.y },
        },
      },
      impact: [],
      sequence: 0,
    });
    return this.commitCanvasMutation(branch, oldState, event);
  }

  private async createRoute(branchId: string, command: Extract<SimCommand, { type: "createRoute" }>): Promise<SimControllerResponse> {
    const branch = await this.store.getBranch(branchId);
    if (!branch) return { status: 404, error: "Branch not found" };
    const oldState = ensureWorldState(branch.latestState);
    const fromSite = oldState.map.sites.find((site) => site.id === command.fromSiteId);
    const toSite = oldState.map.sites.find((site) => site.id === command.toSiteId);
    if (!fromSite || !toSite) return { status: 404, error: "Route endpoints not found" };
    const tickValue = oldState.tick + 1;
    const routeId = `route-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const event = createCausalEvent(oldState, {
      tick: tickValue,
      type: "trade",
      description: `${command.name} now links ${fromSite.name} and ${toSite.name}`,
      confidence: 0.99,
      tags: ["manual", "create-route"],
      affects: unique([routeId, fromSite.id, toSite.id, fromSite.regionId, toSite.regionId]),
      metadata: {
        createRoute: {
          id: routeId,
          name: command.name,
          fromSiteId: command.fromSiteId,
          toSiteId: command.toSiteId,
          controllingFactionId: command.controllingFactionId ?? null,
        },
      },
      impact: [],
      sequence: 0,
    });
    return this.commitCanvasMutation(branch, oldState, event);
  }

  private async createCampaignNode(
    branchId: string,
    command: Extract<SimCommand, { type: "createCampaignNode" }>
  ): Promise<SimControllerResponse> {
    const branch = await this.store.getBranch(branchId);
    if (!branch) return { status: 404, error: "Branch not found" };
    const oldState = ensureWorldState(branch.latestState);
    const tickValue = oldState.tick + 1;
    const nodeId = `node-manual-${command.kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const regionId =
      command.regionId ?? findRegionForPosition(oldState.map, { x: command.x, y: command.y })?.id ?? null;
    const siteId =
      command.siteId ?? findSiteForPosition(oldState.map, { x: command.x, y: command.y })?.id ?? null;
    const event = createCausalEvent(oldState, {
      tick: tickValue,
      type: "injected",
      description: `${command.name} is added to the campaign board`,
      confidence: 0.99,
      tags: ["manual", "create-campaign-node", command.kind],
      affects: unique([nodeId, regionId, siteId]),
      metadata: {
        createCampaignNode: {
          id: nodeId,
          kind: command.kind,
          name: command.name,
          factionId: command.factionId ?? null,
          regionId,
          siteId,
          position: { x: command.x, y: command.y },
          status: "active",
          tags: ["manual"],
          metrics: {},
        },
      },
      impact: [],
      sequence: 0,
    });
    return this.commitCanvasMutation(branch, oldState, event);
  }

  private async createBoardLink(
    branchId: string,
    command: Extract<SimCommand, { type: "createBoardLink" }>
  ): Promise<SimControllerResponse> {
    const branch = await this.store.getBranch(branchId);
    if (!branch) return { status: 404, error: "Branch not found" };
    const oldState = ensureWorldState(branch.latestState);
    const tickValue = oldState.tick + 1;
    const linkId = `link-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const event = createCausalEvent(oldState, {
      tick: tickValue,
      type: command.linkType === "route" ? "travel" : "injected",
      description: `${command.source.id} is linked to ${command.target.id}`,
      confidence: 0.99,
      tags: ["manual", "create-board-link", command.linkType],
      affects: unique([linkId, command.source.id, command.target.id]),
      metadata: {
        createBoardLink: {
          id: linkId,
          type: command.linkType,
          source: command.source,
          target: command.target,
          label: command.label ?? null,
          createdAtTick: tickValue,
          tags: ["manual"],
        },
      },
      impact: [],
      sequence: 0,
    });
    return this.commitCanvasMutation(branch, oldState, event);
  }

  private async deleteCampaignNode(branchId: string, nodeId: string): Promise<SimControllerResponse> {
    const branch = await this.store.getBranch(branchId);
    if (!branch) return { status: 404, error: "Branch not found" };
    const oldState = ensureWorldState(branch.latestState);
    const node = oldState.campaignNodes.find((entry) => entry.id === nodeId && (entry.tags ?? []).includes("manual"));
    if (!node) return { status: 404, error: "Manual campaign node not found" };
    const event = createCausalEvent(oldState, {
      tick: oldState.tick + 1,
      type: "injected",
      description: `${node.name} is removed from the campaign board`,
      confidence: 0.99,
      tags: ["manual", "delete-campaign-node", node.kind],
      invalidates: [nodeId],
      metadata: {
        deleteCampaignNodeId: nodeId,
      },
      impact: [],
      sequence: 0,
    });
    return this.commitCanvasMutation(branch, oldState, event);
  }

  private async deleteBoardLink(branchId: string, linkId: string): Promise<SimControllerResponse> {
    const branch = await this.store.getBranch(branchId);
    if (!branch) return { status: 404, error: "Branch not found" };
    const oldState = ensureWorldState(branch.latestState);
    const link = oldState.boardLinks.find((entry) => entry.id === linkId);
    if (!link) return { status: 404, error: "Board link not found" };
    const event = createCausalEvent(oldState, {
      tick: oldState.tick + 1,
      type: "injected",
      description: `${link.source.id} and ${link.target.id} are unlinked`,
      confidence: 0.99,
      tags: ["manual", "delete-board-link", link.type],
      invalidates: [linkId],
      metadata: {
        deleteBoardLinkId: linkId,
      },
      impact: [],
      sequence: 0,
    });
    return this.commitCanvasMutation(branch, oldState, event);
  }

  private async advanceFront(
    branchId: string,
    frontId: string,
    delta: number,
    rationale?: string
  ): Promise<SimControllerResponse> {
    const branch = await this.store.getBranch(branchId);
    if (!branch) return { status: 404, error: "Branch not found" };

    const oldState = ensureWorldState(branch.latestState);
    const front = oldState.fronts.find((entry) => entry.id === frontId);
    if (!front) {
      return { status: 404, error: "Front not found" };
    }

    const tickValue = oldState.tick + 1;
    const event = createCausalEvent(oldState, {
      tick: tickValue,
      type: "front_advance",
      description: `${front.name} advances ${delta > 0 ? "toward crisis" : "toward stability"}`,
      impact: [],
      confidence: 0.97,
      tags: ["front", delta > 0 ? "escalation" : "relief"],
      metadata: {
        delta,
        frontId,
        note: rationale,
        noteTitle: "Front Adjustment",
      },
      affects: [front.id, ...(front.regionId ? [front.regionId] : [])],
      sequence: 0,
    });

    const nextState = this.applyManualEvent(oldState, event);
    branch.latestState = nextState;
    branch.currentTick = nextState.tick;
    branch.stateHash = await hashState(nextState);

    await this.store.saveBranch(branch);
    await this.store.saveEvents(branch.id, [event]);

    return {
      status: 200,
      data: {
        worldState: nextState,
        delta: calculateStateDelta(oldState, nextState),
        events: [event],
      },
    };
  }

  private async applySetup(branchId: string, draft: any): Promise<SimControllerResponse> {
    const branch = await this.store.getBranch(branchId);
    if (!branch) return { status: 404, error: "Branch not found" };

    const oldState = ensureWorldState(branch.latestState);
    const nextState = materializeCampaignSetupDraft(draft, oldState);
    const newEvents = nextState.events.filter(
      (event) => !oldState.events.some((existing) => existing.id === event.id)
    );

    branch.latestState = nextState;
    branch.currentTick = nextState.tick;
    branch.stateHash = await hashState(nextState);

    await this.store.saveBranch(branch);
    if (newEvents.length > 0) {
      await this.store.saveEvents(branch.id, newEvents);
    }
    await this.store.saveSnapshot(await createSnapshot(branch.id, nextState, "manual"));

    return {
      status: 200,
      data: {
        worldState: nextState,
        delta: calculateStateDelta(oldState, nextState),
        events: newEvents,
      },
    };
  }

  private applyManualEvent(state: WorldState, event: WorldState["events"][number]): WorldState {
    let nextState = ensureWorldState({
      ...state,
      tick: event.tick,
      agents: applyEventImpacts(state.agents, event.impact, state.activeModifiers),
      events: [...state.events, event].slice(-200),
    });

    nextState = applyCausalConsequences(nextState, event);
    return ensureWorldState(nextState);
  }

  private async commitCanvasMutation(
    branch: NonNullable<Awaited<ReturnType<SimulationStore["getBranch"]>>>,
    oldState: WorldState,
    event: WorldState["events"][number]
  ): Promise<SimControllerResponse> {
    const nextState = this.applyManualEvent(oldState, event);
    branch.latestState = nextState;
    branch.currentTick = nextState.tick;
    branch.stateHash = await hashState(nextState);
    await this.store.saveBranch(branch);
    await this.store.saveEvents(branch.id, [event]);
    return {
      status: 200,
      data: {
        worldState: nextState,
        delta: calculateStateDelta(oldState, nextState),
        events: [event],
      },
    };
  }
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function findRegionForPosition(
  map: WorldState["map"],
  position: { x: number; y: number }
) {
  if (map.regions.length === 0) return null;

  const ranked = [...map.regions].sort((left, right) => {
    const leftDistance = Math.hypot(left.center.x - position.x, left.center.y - position.y);
    const rightDistance = Math.hypot(right.center.x - position.x, right.center.y - position.y);
    return leftDistance - rightDistance;
  });

  return ranked[0] ?? null;
}

function findSiteForPosition(
  map: WorldState["map"],
  position: { x: number; y: number }
) {
  if (map.sites.length === 0) return null;

  const ranked = [...map.sites].sort((left, right) => {
    const leftDistance = Math.hypot(left.position.x - position.x, left.position.y - position.y);
    const rightDistance = Math.hypot(right.position.x - position.x, right.position.y - position.y);
    return leftDistance - rightDistance;
  });

  return ranked[0] ?? null;
}
