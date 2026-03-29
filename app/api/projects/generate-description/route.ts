import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AiSettingsSchema } from "@/lib/sim/types";
import { generateSimulationDescription } from "@/lib/server/ai/orchestrator";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const parsedSettings = AiSettingsSchema.safeParse(body.aiSettings);

    if (!name) {
      return NextResponse.json({ error: "Simulation name is required." }, { status: 400 });
    }

    if (!parsedSettings.success || !parsedSettings.data?.apiKey) {
      return NextResponse.json({ error: "Configure an AI provider and API key first." }, { status: 400 });
    }

    const description = await generateSimulationDescription(name, parsedSettings.data);
    if (!description) {
      return NextResponse.json({ error: "The AI provider could not generate a description." }, { status: 502 });
    }

    return NextResponse.json({ description });
  } catch (error) {
    console.error("Generate description API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
