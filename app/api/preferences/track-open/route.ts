import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { trackProjectOpen } from "@/lib/memory/preferences";

/**
 * POST /api/preferences/track-open
 * Records that a user opened a project, updating recentProjects and lastSession.
 *
 * Body: { projectId: string, branchId?: string, name: string }
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId, branchId, name } = body as {
      projectId: string;
      branchId?: string;
      name: string;
    };

    if (!projectId || !name) {
      return NextResponse.json(
        { error: "projectId and name are required" },
        { status: 400 }
      );
    }

    await trackProjectOpen(session.user.id, projectId, branchId ?? null, name);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[API] Failed to track project open:", error);
    return NextResponse.json(
      { error: "Failed to track project open" },
      { status: 500 }
    );
  }
}
