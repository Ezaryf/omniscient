import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";
import { SimController } from "@/lib/server/sim-controller";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { branchId, ticks = 5, aiSettings } = await req.json();
    if (!branchId) {
      return NextResponse.json({ error: "branchId is required" }, { status: 400 });
    }

    const store = getStore();
    const controller = new SimController(store);
    const result = await controller.predict(branchId, ticks, aiSettings);

    return NextResponse.json(result.data, { status: result.status });
  } catch (err) {
    console.error("Prediction API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
