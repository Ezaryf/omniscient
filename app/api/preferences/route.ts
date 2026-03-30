import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getUserPreferences,
  saveUserPreferences,
  type UserPreferences,
} from "@/lib/memory/preferences";

/**
 * GET /api/preferences
 * Returns the current user's preferences (hydrated with defaults).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preferences = await getUserPreferences(session.user.id);
  return NextResponse.json({ preferences });
}

/**
 * PATCH /api/preferences
 * Accepts a partial `UserPreferences` object and deep-merges it with the
 * user's existing preferences.
 */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Partial<UserPreferences>;
    const merged = await saveUserPreferences(session.user.id, body);
    return NextResponse.json({ preferences: merged });
  } catch (error) {
    console.error("[API] Failed to update preferences:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
