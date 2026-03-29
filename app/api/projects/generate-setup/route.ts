import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateCampaignSetup } from "@/lib/server/ai/orchestrator";
import type { AiSettings } from "@/lib/sim/types";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    aiSettings?: AiSettings;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const draft = await generateCampaignSetup(body.name, body.description, body.aiSettings ?? null);
  return NextResponse.json({ draft });
}
