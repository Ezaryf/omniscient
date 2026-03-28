import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";
import { SimCommandSchema } from "@/lib/sim/types";
import { auth } from "@/lib/auth";
import { SimController } from "@/lib/server/sim-controller";

/**
 * POST /api/sim — execute a simulation command
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = getStore();
  const body = await request.json();

  const parsed = SimCommandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid command", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const command = parsed.data;

  const isOwner = await store.checkBranchOwnership(command.branchId, session.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Forbidden: You do not own this project." }, { status: 403 });
  }

  const controller = new SimController(store);
  const response = await controller.execute(command as any);

  if (response.error) {
    return NextResponse.json(
      { error: response.error, ...response.data },
      { status: response.status }
    );
  }

  return NextResponse.json(response.data, { status: response.status });
}
