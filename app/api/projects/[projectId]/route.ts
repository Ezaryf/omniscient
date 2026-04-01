import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DEMO_PROJECT_ID, getStore } from "@/lib/server/store";
import { deleteProjectCanvasDocuments } from "@/lib/server/canvas-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;
  const store = getStore();
  const project = await store.getProject(projectId);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const canReadDemoProject =
    project.id === DEMO_PROJECT_ID &&
    (session.user.id === "dev-user-id" || session.user.id === "user-demo");

  if (project.ownerId !== session.user.id && !canReadDemoProject) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ project });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;
  const store = getStore();
  const project = await store.getProject(projectId);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const canDeleteProject =
    project.ownerId === session.user.id ||
    (project.ownerId === "user-demo" && (session.user.id === "dev-user-id" || session.user.id === "user-demo"));

  if (!canDeleteProject) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await store.deleteProject(projectId);
  await deleteProjectCanvasDocuments(projectId);
  return NextResponse.json({ ok: true });
}
