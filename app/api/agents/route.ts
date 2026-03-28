import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";
import { generateExplanation } from "@/lib/server/ai/orchestrator";
import { auth } from "@/lib/auth";

/**
 * GET /api/agents?branchId=xxx&agentId=yyy — get agent detail with relationships and explanation
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const branchId = request.nextUrl.searchParams.get("branchId");
  const agentId = request.nextUrl.searchParams.get("agentId");

  if (!branchId || !agentId) {
    return NextResponse.json(
      { error: "branchId and agentId are required" },
      { status: 400 }
    );
  }

  const store = getStore();
  const branch = await store.getBranch(branchId);
  if (!branch) {
    return NextResponse.json(
      { error: "Branch not found" },
      { status: 404 }
    );
  }

  const agent = branch.latestState.agents.find((a) => a.id === agentId);
  if (!agent) {
    return NextResponse.json(
      { error: "Agent not found" },
      { status: 404 }
    );
  }

  // Get relationships involving this agent
  const relationships = branch.latestState.relationships.filter(
    (r) =>
      r.sourceAgentId === agentId || r.targetAgentId === agentId
  );

  // Get recent events involving this agent
  const branchEvents = await store.getEvents(branchId) || [];
  const recentEvents = branchEvents
    .filter(
      (e) =>
        e.sourceAgentId === agentId || e.targetAgentId === agentId
    )
    .slice(-10);

  // Get last action explanation
  const lastAction = recentEvents.at(-1) ?? null;
  let explanation = null;

  if (lastAction) {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
    const config = apiKey ? { apiKey, model, provider: "openai" as const } : null;

    explanation = await generateExplanation(
      lastAction.description,
      branch.latestState,
      config
    );
  }

  return NextResponse.json({
    agent,
    relationships,
    recentEvents,
    explanation,
  });
}
