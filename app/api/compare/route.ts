import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";
import { detectDivergence } from "@/lib/sim/branch";
import { buildDivergenceWorkbench } from "@/lib/sim/analysis";
import { auth } from "@/lib/auth";

/**
 * GET /api/compare?branchA=xxx&branchB=yyy — compare two branches
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const branchAId = request.nextUrl.searchParams.get("branchA");
  const branchBId = request.nextUrl.searchParams.get("branchB");

  if (!branchAId || !branchBId) {
    return NextResponse.json(
      { error: "branchA and branchB are required" },
      { status: 400 }
    );
  }

  const store = getStore();
  const ownsA = await store.checkBranchOwnership(branchAId, session.user.id);
  const ownsB = await store.checkBranchOwnership(branchBId, session.user.id);
  if (!ownsA || !ownsB) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const branchA = await store.getBranch(branchAId);
  const branchB = await store.getBranch(branchBId);

  if (!branchA || !branchB) {
    return NextResponse.json(
      { error: "One or both branches not found" },
      { status: 404 }
    );
  }

  const eventsA = await store.getEvents(branchAId) || [];
  const eventsB = await store.getEvents(branchBId) || [];

  const divergence = detectDivergence(branchA, branchB, eventsA, eventsB);
  const workbench = buildDivergenceWorkbench({
    branchA,
    branchB,
    commonAncestorTick: divergence.commonAncestorTick,
    branchAEvents: divergence.branchAEvents,
    branchBEvents: divergence.branchBEvents,
    frontDiffCount: divergence.frontDiffs.length,
    routeDiffCount: divergence.routeDiffs.length,
    agentDiffCount: divergence.agentDiffs.length,
  });

  return NextResponse.json({
    branchA: { id: branchA.id, name: branchA.name, tick: branchA.currentTick },
    branchB: { id: branchB.id, name: branchB.name, tick: branchB.currentTick },
    divergence,
    workbench,
  });
}
