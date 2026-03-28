import { NextRequest, NextResponse } from "next/server";
import { getStore, createDemoWorldState } from "@/lib/server/store";
import { auth } from "@/lib/auth";
import { hashState } from "@/lib/sim/hash";

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
  const project = {
    id: projectId,
    ownerId: session.user.id,
    name,
    description: description ?? "",
    scenarioId: null,
    createdAt: new Date().toISOString(),
  };

  await store.saveProject(project);

  // Seed with demo state so the workspace is not empty
  const worldState = createDemoWorldState();
  const branchId = `branch-${Date.now().toString(36)}`;
  
  await store.saveBranch({
    id: branchId,
    projectId,
    scenarioId: "scen-demo",
    parentBranchId: null,
    name: "Main Timeline",
    summary: "The initial branch.",
    branchPointTick: 0,
    currentTick: 0,
    latestState: worldState,
    stateHash: await hashState(worldState),
    status: "active",
  });

  return NextResponse.json({ project, branchId }, { status: 201 });
}
