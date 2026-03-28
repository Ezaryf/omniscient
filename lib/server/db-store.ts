import { prisma } from "./db";
import { ProjectRecord, ScenarioRecord } from "./store";
import {
  TimelineBranch,
  Snapshot,
  SimEvent,
  ExplanationArtifact,
  WorldState,
} from "@/lib/sim/types";
import { SimulationStore } from "./store-types";
import { getSnapshotsToPrune } from "@/lib/sim/snapshot";

export class PrismaStore implements SimulationStore {
  async getProject(id: string): Promise<ProjectRecord | null> {
    const p = await prisma.project.findUnique({ where: { id } });
    if (!p) return null;
    return {
      id: p.id,
      ownerId: p.ownerId,
      name: p.name,
      description: p.description,
      scenarioId: null, // Scenarios are fetched separately
      createdAt: p.createdAt.toISOString(),
    };
  }

  async listProjects(): Promise<ProjectRecord[]> {
    const ps = await prisma.project.findMany({ orderBy: { createdAt: "desc" } });
    return ps.map((p) => ({
      id: p.id,
      ownerId: p.ownerId,
      name: p.name,
      description: p.description,
      scenarioId: null,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  async saveProject(project: ProjectRecord): Promise<void> {
    await prisma.project.upsert({
      where: { id: project.id },
      create: {
        id: project.id,
        ownerId: project.ownerId,
        name: project.name,
        description: project.description,
      },
      update: {
        name: project.name,
        description: project.description,
      },
    });
  }

  async getScenario(id: string): Promise<ScenarioRecord | null> {
    const s = await prisma.scenario.findUnique({ 
      where: { id },
      include: { rules: true }
    });
    if (!s) return null;
    
    // Map RuleSet model to RuleSet type
    const rules = s.rules ? {
      scarcity: s.rules.scarcity,
      trustDecay: s.rules.trustDecay,
      contagion: s.rules.contagion,
      shockLikelihood: s.rules.shockLikelihood,
      maxTicks: s.rules.maxTicks,
      aiConfidenceFloor: s.rules.aiConfidenceFloor,
    } : ({} as any);

    return {
      id: s.id,
      projectId: s.projectId,
      name: s.name,
      summary: s.summary,
      seed: s.seed,
      rules,
    };
  }

  async saveScenario(scenario: ScenarioRecord): Promise<void> {
    await prisma.scenario.upsert({
      where: { id: scenario.id },
      create: {
        id: scenario.id,
        projectId: scenario.projectId,
        name: scenario.name,
        summary: scenario.summary,
        seed: scenario.seed,
        rules: {
          create: {
            scarcity: scenario.rules.scarcity,
            trustDecay: scenario.rules.trustDecay,
            contagion: scenario.rules.contagion,
            shockLikelihood: scenario.rules.shockLikelihood,
            maxTicks: scenario.rules.maxTicks,
            aiConfidenceFloor: scenario.rules.aiConfidenceFloor,
          }
        }
      },
      update: {
        name: scenario.name,
        summary: scenario.summary,
        rules: {
          upsert: {
            create: {
              scarcity: scenario.rules.scarcity,
              trustDecay: scenario.rules.trustDecay,
              contagion: scenario.rules.contagion,
              shockLikelihood: scenario.rules.shockLikelihood,
              maxTicks: scenario.rules.maxTicks,
              aiConfidenceFloor: scenario.rules.aiConfidenceFloor,
            },
            update: {
              scarcity: scenario.rules.scarcity,
              trustDecay: scenario.rules.trustDecay,
              contagion: scenario.rules.contagion,
              shockLikelihood: scenario.rules.shockLikelihood,
              maxTicks: scenario.rules.maxTicks,
              aiConfidenceFloor: scenario.rules.aiConfidenceFloor,
            }
          }
        }
      },
    });
  }

  async getBranch(id: string): Promise<TimelineBranch | null> {
    const b = await prisma.branch.findUnique({ where: { id } });
    if (!b) return null;
    return {
      id: b.id,
      projectId: b.projectId,
      scenarioId: b.scenarioId,
      parentBranchId: b.parentBranchId,
      name: b.name,
      summary: b.summary,
      branchPointTick: b.branchPointTick,
      currentTick: b.currentTick,
      stateHash: b.stateHash,
      status: b.status as any,
      latestState: b.latestState as unknown as WorldState,
    };
  }

  async listBranches(projectId: string): Promise<TimelineBranch[]> {
    const bs = await prisma.branch.findMany({ where: { projectId } });
    return bs.map((b) => ({
      id: b.id,
      projectId: b.projectId,
      scenarioId: b.scenarioId,
      parentBranchId: b.parentBranchId,
      name: b.name,
      summary: b.summary,
      branchPointTick: b.branchPointTick,
      currentTick: b.currentTick,
      stateHash: b.stateHash,
      status: b.status as any,
      latestState: b.latestState as unknown as WorldState,
    }));
  }

  async saveBranch(branch: TimelineBranch): Promise<void> {
    await prisma.branch.upsert({
      where: { id: branch.id },
      create: {
        id: branch.id,
        projectId: branch.projectId,
        scenarioId: branch.scenarioId,
        parentBranchId: branch.parentBranchId,
        name: branch.name,
        summary: branch.summary,
        branchPointTick: branch.branchPointTick,
        currentTick: branch.currentTick,
        stateHash: branch.stateHash,
        status: branch.status,
        latestState: branch.latestState as any,
      },
      update: {
        currentTick: branch.currentTick,
        stateHash: branch.stateHash,
        status: branch.status,
        latestState: branch.latestState as any,
      },
    });
  }

  async getSnapshot(id: string): Promise<Snapshot | null> {
    const s = await prisma.snapshot.findUnique({ where: { id } });
    if (!s) return null;
    return {
      id: s.id,
      branchId: s.branchId,
      tick: s.tick,
      kind: s.kind as any,
      stateHash: s.stateHash,
      state: s.state as unknown as WorldState,
      createdAt: s.createdAt.toISOString(),
    };
  }

  async listSnapshots(branchId: string): Promise<Snapshot[]> {
    const ss = await prisma.snapshot.findMany({
      where: { branchId },
      orderBy: { tick: "desc" },
    });
    return ss.map((s) => ({
      id: s.id,
      branchId: s.branchId,
      tick: s.tick,
      kind: s.kind as any,
      stateHash: s.stateHash,
      state: s.state as unknown as WorldState,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  async saveSnapshot(snapshot: Snapshot): Promise<void> {
    // 1. Save the new snapshot
    await prisma.snapshot.create({
      data: {
        id: snapshot.id,
        scenarioId: (await prisma.branch.findUnique({ where: { id: snapshot.branchId } }))?.scenarioId ?? "",
        branchId: snapshot.branchId,
        tick: snapshot.tick,
        kind: snapshot.kind,
        stateHash: snapshot.stateHash,
        state: snapshot.state as any,
        createdAt: new Date(snapshot.createdAt),
      },
    });

    // 2. Perform Pruning (LRU)
    const branchSnapshots = await this.listSnapshots(snapshot.branchId);
    const toPrune = getSnapshotsToPrune(branchSnapshots, snapshot.branchId);
    if (toPrune.length > 0) {
      await this.deleteSnapshots(toPrune);
    }
  }

  async deleteSnapshots(ids: string[]): Promise<void> {
    await prisma.snapshot.deleteMany({
      where: { id: { in: ids } },
    });
  }

  async getEvents(branchId: string): Promise<SimEvent[]> {
    const evs = await prisma.event.findMany({
      where: { branchId },
      orderBy: { tick: "asc" },
    });
    return evs.map((e) => ({
      id: e.id,
      tick: e.tick,
      type: e.type as any,
      sourceAgentId: e.sourceAgentId,
      targetAgentId: e.targetAgentId,
      description: e.description,
      impact: e.impact as any,
      causeChain: e.causeChain as any,
      metadata: e.metadata as any,
    }));
  }

  async saveEvents(branchId: string, events: SimEvent[]): Promise<void> {
    // We use a transaction to ensure atomicity
    await prisma.$transaction(
      events.map((e) =>
        prisma.event.upsert({
          where: { id: e.id },
          create: {
            id: e.id,
            branchId,
            tick: e.tick,
            type: e.type,
            sourceAgentId: e.sourceAgentId,
            targetAgentId: e.targetAgentId,
            description: e.description,
            impact: e.impact as any,
            causeChain: e.causeChain as any,
            metadata: e.metadata as any,
          },
          update: {}, // Events are immutable
        })
      )
    );
  }

  async getExplanations(branchId: string): Promise<ExplanationArtifact[]> {
    const exps = await prisma.narrativeSummary.findMany({
      where: { branchId },
      orderBy: { tick: "desc" },
    });
    return exps.map((e) => ({
      id: e.id,
      branchId: e.branchId,
      tick: e.tick,
      scope: e.scope as any,
      subjectId: e.subjectId,
      title: e.title,
      summary: e.summary,
      evidence: e.evidence as any,
      confidence: e.confidence,
      generatedBy: e.generatedBy as any,
    }));
  }

  async saveExplanation(exp: ExplanationArtifact): Promise<void> {
    await prisma.narrativeSummary.create({
      data: {
        id: exp.id,
        branchId: exp.branchId,
        tick: exp.tick,
        scope: exp.scope,
        subjectId: exp.subjectId,
        title: exp.title,
        summary: exp.summary,
        evidence: exp.evidence as any,
        confidence: exp.confidence,
        generatedBy: exp.generatedBy,
      },
    });
  }

  async getProposals(branchId: string, tick: number): Promise<any | null> {
    const entry = await prisma.proposalLedger.findUnique({
      where: {
        branchId_tick: { branchId, tick },
      },
    });
    return entry ? entry.proposals : null;
  }

  async saveProposals(branchId: string, tick: number, proposals: any): Promise<void> {
    await prisma.proposalLedger.upsert({
      where: {
        branchId_tick: { branchId, tick },
      },
      create: {
        branchId,
        tick,
        proposals: proposals as any,
      },
      update: {
        proposals: proposals as any,
      },
    });
  }

  async checkBranchOwnership(branchId: string, userId: string): Promise<boolean> {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        project: {
          select: { ownerId: true }
        }
      }
    });

    if (!branch) return false;
    return branch.project?.ownerId === userId;
  }
}
