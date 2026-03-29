import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getStore, DEMO_PROJECT_ID } from "@/lib/server/store";
import { createCanvasDocument, listProjectCanvasDocuments } from "@/lib/server/canvas-store";

async function resolveOwnedProject(projectId: string, userId: string) {
  const store = getStore();
  const project = await store.getProject(projectId);
  if (!project) return { status: 404 as const, project: null };

  const canReadDemoProject =
    project.id === DEMO_PROJECT_ID && (userId === "dev-user-id" || userId === "user-demo");

  if (project.ownerId !== userId && !canReadDemoProject) {
    return { status: 403 as const, project: null };
  }

  return { status: 200 as const, project };
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const access = await resolveOwnedProject(projectId, session.user.id);
  if (access.status !== 200) {
    return NextResponse.json(
      { error: access.status === 403 ? "Forbidden" : "Project not found" },
      { status: access.status }
    );
  }

  const documents = await listProjectCanvasDocuments(projectId);
  return NextResponse.json({ documents });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { projectId?: string; name?: string };
  if (!body.projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const access = await resolveOwnedProject(body.projectId, session.user.id);
  if (access.status !== 200) {
    return NextResponse.json(
      { error: access.status === 403 ? "Forbidden" : "Project not found" },
      { status: access.status }
    );
  }

  const document = await createCanvasDocument(body.projectId, body.name || "Freeform Canvas");
  return NextResponse.json({ document }, { status: 201 });
}
