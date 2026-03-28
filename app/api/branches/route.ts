import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";
import { auth } from "@/lib/auth";

/**
 * GET /api/branches?projectId=xxx — list branches for a project
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectId = request.nextUrl.searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  const store = getStore();
  const branches = await store.listBranches(projectId);

  return NextResponse.json({ branches });
}
