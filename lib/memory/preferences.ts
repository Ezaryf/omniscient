import { prisma } from "@/lib/server/db";
import type { AiSettings, WorkspaceSettings } from "@/lib/stores/simulation-store";
import { DEFAULT_WORKSPACE_SETTINGS } from "@/lib/stores/simulation-store";

// ── Types ──────────────────────────────────────────────────────────────────

/** A reference to a recently-visited project, stored in user preferences. */
export interface RecentProject {
  projectId: string;
  branchId: string | null;
  name: string;
  lastOpenedAt: string; // ISO 8601
}

/** Full shape of `User.preferences` JSONB column. */
export interface UserPreferences {
  /** Workspace layout, appearance, map, timeline, simulation settings. */
  workspace: WorkspaceSettings;
  /** AI provider, model, API key (encrypted externally if needed). */
  ai: Pick<AiSettings, "provider" | "model">;
  /** Last N projects the user opened, ordered by recency. */
  recentProjects: RecentProject[];
  /** The last project + branch the user had open (for auto-resume). */
  lastSession: {
    projectId: string;
    branchId: string | null;
  } | null;
}

const MAX_RECENT_PROJECTS = 10;

// ── Defaults ───────────────────────────────────────────────────────────────

export const DEFAULT_PREFERENCES: UserPreferences = {
  workspace: DEFAULT_WORKSPACE_SETTINGS,
  ai: {
    provider: "gemini",
    model: "gemini-2.0-flash",
  },
  recentProjects: [],
  lastSession: null,
};

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Deep-merge stored preferences with defaults so newly-added fields
 * are always present (avoids breakage when the schema evolves).
 */
function hydrate(raw: Record<string, unknown>): UserPreferences {
  const workspace = (raw.workspace as Record<string, unknown> | undefined) ?? {};
  const appearance = (workspace.appearance as Record<string, unknown> | undefined) ?? {};
  const layout = (workspace.layout as Record<string, unknown> | undefined) ?? {};
  const map = (workspace.map as Record<string, unknown> | undefined) ?? {};
  const timeline = (workspace.timeline as Record<string, unknown> | undefined) ?? {};
  const simulation = (workspace.simulation as Record<string, unknown> | undefined) ?? {};
  const ai = (raw.ai as Record<string, unknown> | undefined) ?? {};

  return {
    workspace: {
      appearance: {
        ...DEFAULT_PREFERENCES.workspace.appearance,
        ...appearance,
      },
      layout: {
        ...DEFAULT_PREFERENCES.workspace.layout,
        ...layout,
      },
      map: {
        ...DEFAULT_PREFERENCES.workspace.map,
        ...map,
      },
      timeline: {
        ...DEFAULT_PREFERENCES.workspace.timeline,
        ...timeline,
      },
      simulation: {
        ...DEFAULT_PREFERENCES.workspace.simulation,
        ...simulation,
      },
    } as WorkspaceSettings,
    ai: {
      ...DEFAULT_PREFERENCES.ai,
      ...ai,
    } as UserPreferences["ai"],
    recentProjects: Array.isArray(raw.recentProjects)
      ? (raw.recentProjects as RecentProject[])
      : [],
    lastSession: (raw.lastSession as UserPreferences["lastSession"]) ?? null,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Load user preferences from the database.
 * Returns `DEFAULT_PREFERENCES` if the user doesn't exist (dev mode).
 */
export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    if (!user || !user.preferences || typeof user.preferences !== "object") {
      return DEFAULT_PREFERENCES;
    }

    return hydrate(user.preferences as Record<string, unknown>);
  } catch (error) {
    console.error("[Memory] Failed to load preferences:", error);
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Save a partial preferences update. Deep-merges with existing prefs
 * so callers can update a single section without clobbering others.
 */
export async function saveUserPreferences(
  userId: string,
  update: Partial<UserPreferences>
): Promise<UserPreferences> {
  const current = await getUserPreferences(userId);

  const merged: UserPreferences = {
    workspace: update.workspace
      ? {
          appearance: { ...current.workspace.appearance, ...update.workspace.appearance },
          layout: { ...current.workspace.layout, ...update.workspace.layout },
          map: { ...current.workspace.map, ...update.workspace.map },
          timeline: { ...current.workspace.timeline, ...update.workspace.timeline },
          simulation: { ...current.workspace.simulation, ...update.workspace.simulation },
        }
      : current.workspace,
    ai: update.ai ? { ...current.ai, ...update.ai } : current.ai,
    recentProjects: update.recentProjects ?? current.recentProjects,
    lastSession: update.lastSession !== undefined ? update.lastSession : current.lastSession,
  };

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { preferences: merged as any },
    });
  } catch (error) {
    console.error("[Memory] Failed to persist preferences:", error);
  }

  return merged;
}

/**
 * Record that the user opened a specific project.
 * Moves the project to the top of `recentProjects` and updates `lastSession`.
 */
export async function trackProjectOpen(
  userId: string,
  projectId: string,
  branchId: string | null,
  projectName: string
): Promise<void> {
  const prefs = await getUserPreferences(userId);

  // Remove duplicates, add to front, cap at MAX
  const filtered = prefs.recentProjects.filter((p) => p.projectId !== projectId);
  const entry: RecentProject = {
    projectId,
    branchId,
    name: projectName,
    lastOpenedAt: new Date().toISOString(),
  };
  const recentProjects = [entry, ...filtered].slice(0, MAX_RECENT_PROJECTS);

  await saveUserPreferences(userId, {
    recentProjects,
    lastSession: { projectId, branchId },
  });
}
