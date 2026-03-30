"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UserPreferences } from "@/lib/memory/preferences";
import { DEFAULT_WORKSPACE_SETTINGS, useSimulationStore } from "@/lib/stores/simulation-store";
import type { AiSettings, WorkspaceSettings } from "@/lib/stores/simulation-store";

// ── Constants ──────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 2000; // Batch settings saves to avoid request spam.
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // Re-fetch after 5 minutes.

// ── Hook ───────────────────────────────────────────────────────────────────

/**
 * Client-side hook that:
 * 1. On mount, fetches `/api/preferences` and hydrates the Zustand store.
 * 2. Subscribes to store changes and pushes them to the server (debounced).
 * 3. Exposes `recentProjects` and `lastSession` for the landing page.
 */
export function useUserPreferences() {
  const [loaded, setLoaded] = useState(false);
  const [recentProjects, setRecentProjects] = useState<
    UserPreferences["recentProjects"]
  >([]);
  const [lastSession, setLastSession] = useState<
    UserPreferences["lastSession"]
  >(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedAt = useRef(0);

  // ── Hydration ──────────────────────────────────────────────────────────

  const hydrate = useCallback(async () => {
    // Skip if recently fetched (avoids double-mounting in StrictMode).
    if (Date.now() - lastFetchedAt.current < STALE_THRESHOLD_MS && loaded) return;

    try {
      const res = await fetch("/api/preferences");
      if (!res.ok) {
        // Server unavailable or user not authed — fall back to localStorage.
        setLoaded(true);
        return;
      }

      const { preferences } = (await res.json()) as {
        preferences: UserPreferences;
      };

      // Push workspace and AI settings into the Zustand store.
      const store = useSimulationStore.getState();
      store.setWorkspaceSettings(preferences.workspace);
      store.setAiSettings({
        ...store.aiSettings, // keep apiKey from localStorage (never stored server-side)
        provider: preferences.ai.provider,
        model: preferences.ai.model,
      });

      setRecentProjects(preferences.recentProjects);
      setLastSession(preferences.lastSession);
      lastFetchedAt.current = Date.now();
    } catch {
      // Silent fallback — localStorage is still active.
    } finally {
      setLoaded(true);
    }
  }, [loaded]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // ── Persistence (debounced) ────────────────────────────────────────────

  const persist = useCallback(
    (workspace: WorkspaceSettings, ai: Pick<AiSettings, "provider" | "model">) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(async () => {
        try {
          await fetch("/api/preferences", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workspace, ai }),
          });
        } catch {
          // Silent — localStorage is the fallback.
        }
      }, DEBOUNCE_MS);
    },
    []
  );

  /**
   * Subscribe to Zustand store changes and push to server.
   * Uses plain `.subscribe()` with manual tracking since the store
   * doesn't use the subscribeWithSelector middleware.
   */
  useEffect(() => {
    if (!loaded) return;

    let prevWorkspace = useSimulationStore.getState().workspaceSettings;
    let prevProvider = useSimulationStore.getState().aiSettings.provider;
    let prevModel = useSimulationStore.getState().aiSettings.model;

    const unsub = useSimulationStore.subscribe((state) => {
      const wsChanged = state.workspaceSettings !== prevWorkspace;
      const providerChanged = state.aiSettings.provider !== prevProvider;
      const modelChanged = state.aiSettings.model !== prevModel;

      if (wsChanged || providerChanged || modelChanged) {
        prevWorkspace = state.workspaceSettings;
        prevProvider = state.aiSettings.provider;
        prevModel = state.aiSettings.model;

        persist(state.workspaceSettings, {
          provider: state.aiSettings.provider,
          model: state.aiSettings.model,
        });
      }
    });

    return unsub;
  }, [loaded, persist]);

  // ── Track Open ─────────────────────────────────────────────────────────

  const trackOpen = useCallback(
    (projectId: string, branchId: string | null, name: string) => {
      // Fire-and-forget — don't block the workspace.
      fetch("/api/preferences/track-open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, branchId, name }),
      }).catch(() => {});
    },
    []
  );

  return {
    loaded,
    recentProjects,
    lastSession,
    trackOpen,
  };
}

