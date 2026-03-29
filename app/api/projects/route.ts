import { NextRequest, NextResponse } from "next/server";
import { getStore, createBlankWorldState } from "@/lib/server/store";
import { auth } from "@/lib/auth";
import { hashState } from "@/lib/sim/hash";
import { createSnapshot } from "@/lib/sim/snapshot";
import { DEFAULT_RULES, DEFAULT_SEED } from "@/lib/sim/constants";

/**
 * GET /api/projects — list all projects (demo mode returns the seeded project)
 * POST /api/projects — create a new project
 */

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = getStore();
  const projects = await store.listProjects();

  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = getStore();
  const body = await request.json();
  const { name, description } = body as {
    name: string;
    description: string;
  };

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const projectId = `proj-${Date.now().toString(36)}`;
  const scenarioId = `scen-${Date.now().toString(36)}`;
  const branchId = `branch-${Date.now().toString(36)}`;
  const project = {
    id: projectId,
    ownerId: session.user.id,
    name,
    description: description ?? "",
    scenarioId: null,
    createdAt: new Date().toISOString(),
  };

  await store.saveProject(project);
  await store.saveScenario({
    id: scenarioId,
    projectId,
    name: `${name} - Main Scenario`,
    summary: description?.trim() || "A fresh campaign timeline waiting for its first consequence.",
    seed: DEFAULT_SEED,
    rules: { ...DEFAULT_RULES },
  });

  const worldState = createBlankWorldState();
  
  await store.saveBranch({
    id: branchId,
    projectId,
    scenarioId,
    parentBranchId: null,
    name: "Main Timeline",
    summary: "The initial branch for this campaign.",
    branchPointTick: 0,
    branchOriginEventId: null,
    currentTick: 0,
    latestState: worldState,
    stateHash: await hashState(worldState),
    status: "active",
  });
  await store.saveSnapshot(await createSnapshot(branchId, worldState, "branch_point"));

  return NextResponse.json({ project, branchId }, { status: 201 });
}
