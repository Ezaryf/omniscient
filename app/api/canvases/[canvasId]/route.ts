import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DEMO_PROJECT_ID, getStore } from "@/lib/server/store";
import { getCanvasDocument, saveCanvasDocument } from "@/lib/server/canvas-store";

async function ensureCanvasAccess(canvasId: string, userId: string) {
  const document = await getCanvasDocument(canvasId);
  if (!document) return { status: 404 as const, document: null };

  const store = getStore();
  const project = await store.getProject(document.projectId);
  if (!project) return { status: 404 as const, document: null };

  const canReadDemoProject =
    project.id === DEMO_PROJECT_ID && (userId === "dev-user-id" || userId === "user-demo");

  if (project.ownerId !== userId && !canReadDemoProject) {
    return { status: 403 as const, document: null };
  }

  return { status: 200 as const, document };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ canvasId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { canvasId } = await context.params;
  const access = await ensureCanvasAccess(canvasId, session.user.id);
  if (access.status !== 200) {
    return NextResponse.json(
      { error: access.status === 403 ? "Forbidden" : "Canvas not found" },
      { status: access.status }
    );
  }

  return NextResponse.json({ document: access.document });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ canvasId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { canvasId } = await context.params;
  const access = await ensureCanvasAccess(canvasId, session.user.id);
  if (access.status !== 200) {
    return NextResponse.json(
      { error: access.status === 403 ? "Forbidden" : "Canvas not found" },
      { status: access.status }
    );
  }

  const body = (await request.json()) as {
    name?: string;
    snapshot?: unknown;
    bindings?: unknown[];
  };

  const document = await saveCanvasDocument(canvasId, {
    name: body.name,
    snapshot: body.snapshot ?? null,
    bindings: Array.isArray(body.bindings) ? body.bindings as any : [],
  });

  if (!document) {
    return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
  }

  return NextResponse.json({ document });
}
