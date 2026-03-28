import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";
import { EVENT_PAGE_SIZE } from "@/lib/sim/constants";
import { auth } from "@/lib/auth";

/**
 * GET /api/events?branchId=xxx&page=1 — paginated event log for a branch
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const branchId = request.nextUrl.searchParams.get("branchId");
  const page = Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10);

  if (!branchId) {
    return NextResponse.json(
      { error: "branchId is required" },
      { status: 400 }
    );
  }

  const store = getStore();
  const allEvents = await store.getEvents(branchId) || [];

  const start = (page - 1) * EVENT_PAGE_SIZE;
  const end = start + EVENT_PAGE_SIZE;
  const events = allEvents.slice(start, end);

  return NextResponse.json({
    events,
    page,
    totalEvents: allEvents.length,
    totalPages: Math.ceil(allEvents.length / EVENT_PAGE_SIZE),
  });
}
