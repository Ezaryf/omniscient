import { NextRequest, NextResponse } from "next/server";
import { parseNLEvent } from "@/lib/server/ai/event-parser";
import { auth } from "@/lib/auth";
import { getStore } from "@/lib/server/store";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const jsonBody = await request.json();
    const { description, branchId, aiSettings } = jsonBody;

    if (!description || !branchId) {
      return NextResponse.json(
        { error: "description and branchId are required" },
        { status: 400 }
      );
    }

    const store = getStore();
    const branch = await store.getBranch(branchId);
    if (!branch?.latestState) {
      return NextResponse.json({ error: "Branch state not found" }, { status: 404 });
    }

    if (!aiSettings?.apiKey) {
        return NextResponse.json({ error: "AI not configured for NL parsing" }, { status: 400 });
    }

    const result = await parseNLEvent(
      description,
      branch.latestState.agents,
      branch.latestState.campaignNodes,
      aiSettings
    );

    if (!result) {
      return NextResponse.json({ error: "Failed to parse description" }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[API/events/parse] Error:", err.message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
