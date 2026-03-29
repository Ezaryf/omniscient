import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getStore } from "@/lib/server/store";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const branchId = request.nextUrl.searchParams.get("id");
  if (!branchId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const store = getStore();
  const branch = await store.getBranch(branchId);
  if (!branch) {
    return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  }

  const isOwner = await store.checkBranchOwnership(branchId, session.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ branch });
}
