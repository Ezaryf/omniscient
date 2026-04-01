"use client";

import { Suspense, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type CSSProperties } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PanelLeft, PanelRight, PanelBottom } from "lucide-react";
import type { BoardSelection, CampaignSetupDraft, CanvasBinding, TimelineBranch } from "@/lib/sim/types";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanvasInspector } from "@/components/workspace/canvas-inspector";
import { CampaignSetupSidecar } from "@/components/workspace/campaign-setup-sidecar";
import { ControlBar } from "@/components/workspace/control-bar";
import { ContextInspector } from "@/components/workspace/context-inspector";
import { FreeformCanvas } from "@/components/workspace/freeform-canvas";
import { ScenarioPanel } from "@/components/workspace/scenario-panel";
import { TimelineRail } from "@/components/workspace/timeline-rail";
import { useWorkspaceLayout } from "@/components/workspace/use-workspace-layout";
import { ReactFlowWorldCanvas } from "@/components/workspace/react-flow-world-canvas";
import { type BoardTool, type WorldCanvasHandle, type WorldCanvasUiState } from "@/components/workspace/world-canvas";
import { InjectEventModal } from "@/components/workspace/inject-event-modal";
import { CreateBranchModal } from "@/components/workspace/create-branch-modal";
import { BattleNarrativeInline } from "@/components/workspace/battle-narrative-inline";
import { DEFAULT_WORKSPACE_SETTINGS, useSimulationStore } from "@/lib/stores/simulation-store";
import { DEMO_PROJECT_ID } from "@/lib/server/store";

type PendingDelete = {
  type: BoardSelection["type"];
  id: string;
  label: string;
};

function resolvePendingDelete(
  selection: BoardSelection | null,
  worldState: NonNullable<ReturnType<typeof useSimulationStore.getState>["worldState"]>
): PendingDelete | null {
  if (!selection) return null;
  if (selection.type === "agent") {
    const agent = worldState.agents.find((entry) => entry.id === selection.id);
    if (!agent) return null;
    return { type: "agent", id: agent.id, label: agent.name };
  }
  if (selection.type === "campaignNode") {
    const node = worldState.campaignNodes.find((entry) => entry.id === selection.id);
    if (!node) return null;
    return { type: "campaignNode", id: node.id, label: node.name };
  }
  if (selection.type === "region") {
    const region = worldState.map.regions.find((entry) => entry.id === selection.id);
    if (!region) return null;
    return { type: "region", id: region.id, label: region.name };
  }
  if (selection.type === "site") {
    const site = worldState.map.sites.find((entry) => entry.id === selection.id);
    if (!site) return null;
    return { type: "site", id: site.id, label: site.name };
  }
  if (selection.type === "route") {
    const route = worldState.map.routes.find((entry) => entry.id === selection.id);
    if (!route) return null;
    return { type: "route", id: route.id, label: route.name };
  }
  if (selection.type === "front") {
    const front = worldState.fronts.find((entry) => entry.id === selection.id);
    if (!front) return null;
    return { type: "front", id: front.id, label: front.name };
  }
  if (selection.type === "boardLink") {
    const link = worldState.boardLinks.find((entry) => entry.id === selection.id);
    if (!link) return null;
    return {
      type: "boardLink",
      id: link.id,
      label: link.label ?? `${link.type} link`,
    };
  }
  return null;
}

function WorkspaceContent() {
  const demoProjectMeta = {
    name: "The Fractured Realms",
    description:
      "A geopolitical simulation of five factions vying for control of a resource-scarce continent.",
  };
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const projectId = searchParams.get("projectId") ?? DEMO_PROJECT_ID;
  const initialBranchId = searchParams.get("branchId");
  const initialCanvasId = searchParams.get("canvasId");
  const workspaceSurface = searchParams.get("surface") === "canvas" ? "canvas" : "map";
  const shouldOpenSetupFromUrl = searchParams.get("setup") === "1";
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoplayArmedRef = useRef(true);
  const syncInFlightRef = useRef(false);
  const worldCanvasRef = useRef<WorldCanvasHandle | null>(null);

  const [showInjectModal, setShowInjectModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showSetup, setShowSetup] = useState(shouldOpenSetupFromUrl);
  const [selectedCanvasBinding, setSelectedCanvasBinding] = useState<CanvasBinding | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<BoardSelection | null>(null);
  const [boardUiState, setBoardUiState] = useState<WorldCanvasUiState>({
    activeTool: (searchParams.get("tool") as BoardTool | null) ?? "inspect",
    linkType: "causal",
    zoomPercent: 100,
    showGrid: true,
    showRelationships: true,
    showFronts: true,
    showRegions: true,
    snapToGrid: true,
    labelDensity: "balanced",
    canDeleteSelection: false,
    canStartLinkFromSelection: false,
  });
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(null);
  const [isDeletingSelection, setIsDeletingSelection] = useState(false);
  const { hydrated, layout, gridColumns, timelineHeight, beginResize, toggleDock, resetDock } =
    useWorkspaceLayout();

  const {
    branchId,
    worldState,
    branches,
    recentEvents,
    tickSpeed,
    projectMeta,
    workspaceSettings,
    isNewSimulation,
    setupStatus,
    setupDraft,
    layoutPositions,
    setProject,
    setProjectMeta,
    setBranch,
    setWorldState,
    applyDelta,
    setBranches,
    setStatus,
    addEvents,
    setLastProposals,
    setSetupStatus,
    sync,
  } = useSimulationStore();

  const agents = useMemo(() => worldState?.agents ?? [], [worldState?.agents]);
  const boardLinks = useMemo(() => worldState?.boardLinks ?? [], [worldState?.boardLinks]);
  const campaignNodes = useMemo(() => worldState?.campaignNodes ?? [], [worldState?.campaignNodes]);
  const relationships = useMemo(() => worldState?.relationships ?? [], [worldState?.relationships]);
  const fronts = useMemo(() => worldState?.fronts ?? [], [worldState?.fronts]);
  const worldMap = useMemo(() => worldState?.map ?? { id: "map", name: "Map", regions: [], sites: [], routes: [], tokens: [] }, [worldState?.map]);

  const resolvedProjectMeta =
    projectMeta ?? (projectId === DEMO_PROJECT_ID ? demoProjectMeta : null);
  const activeBranch = branches.find((candidate) => candidate.id === branchId) ?? null;
  const settings = hydrated ? workspaceSettings : DEFAULT_WORKSPACE_SETTINGS;
  const { textScale, iconScale, reducedMotion, density } = settings.appearance;
  const rootClassName = useMemo(() => {
    const maps = {
      density: { compact: "density-compact", comfortable: "density-comfortable" },
      text: { sm: "text-scale-sm", md: "text-scale-md", lg: "text-scale-lg" },
      icon: { sm: "icon-scale-sm", md: "icon-scale-md", lg: "icon-scale-lg" },
    };

    return [
      maps.density[density as keyof typeof maps.density] || maps.density.comfortable,
      maps.text[textScale as keyof typeof maps.text] || maps.text.md,
      maps.icon[iconScale as keyof typeof maps.icon] || maps.icon.md,
      reducedMotion ? "reduced-motion" : "",
    ].filter(Boolean).join(" ");
  }, [density, textScale, iconScale, reducedMotion]);

  const updateWorkspaceQuery = useCallback(
    (patch: Record<string, string | null>) => {
      const currentQuery = searchParams.toString();
      const nextParams = new URLSearchParams(currentQuery);
      for (const [key, value] of Object.entries(patch)) {
        if (!value) nextParams.delete(key);
        else nextParams.set(key, value);
      }
      const nextQuery = nextParams.toString();
      if (nextQuery === currentQuery) return;
      router.replace(`${pathname}?${nextQuery}` as any, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const upsertBranch = useCallback(
    (nextBranch: TimelineBranch) => {
      const branchMap = new Map(
        useSimulationStore.getState().branches.map((candidate) => [candidate.id, candidate])
      );
      branchMap.set(nextBranch.id, nextBranch);
      setBranches(Array.from(branchMap.values()));
    },
    [setBranches]
  );

  // Auto-dismiss setup sidecar when timeline is launched
  useEffect(() => {
    if (setupStatus === "applied") {
      setShowSetup(false);
    }
  }, [setupStatus]);

  const isFocusMode = layout.leftCollapsed && layout.rightCollapsed && layout.timelineCollapsed;
  const toggleFocusMode = () => {
    if (isFocusMode) {
      if (layout.leftCollapsed) toggleDock("left");
      if (layout.rightCollapsed) toggleDock("right");
      if (layout.timelineCollapsed) toggleDock("timeline");
    } else {
      if (!layout.leftCollapsed) toggleDock("left");
      if (!layout.rightCollapsed) toggleDock("right");
      if (!layout.timelineCollapsed) toggleDock("timeline");
    }
  };

  // Ref to track last synced query to prevent dependency loops
  const lastSyncedQueryRef = useRef<string | null>(null);

  // Sync state to URL search parameters
  useEffect(() => {
    if (workspaceSurface !== "map") return;
    
    const queryPayload = {
      tool: boardUiState.activeTool === "inspect" ? null : boardUiState.activeTool,
      selectionType: selectedEntity?.type ?? null,
      selectionId: selectedEntity?.id ?? null,
    };
    
    // Create query string to check for changes before calling update
    const nextParams = new URLSearchParams(searchParams.toString());
    Object.entries(queryPayload).forEach(([key, value]) => {
      if (!value) nextParams.delete(key);
      else nextParams.set(key, value);
    });
    
    const nextQuery = nextParams.toString();
    if (nextQuery === lastSyncedQueryRef.current) return;
    
    lastSyncedQueryRef.current = nextQuery;
    updateWorkspaceQuery(queryPayload);
  }, [boardUiState.activeTool, selectedEntity?.id, selectedEntity?.type, updateWorkspaceQuery, workspaceSurface, searchParams]);

  useEffect(() => {
    setProject(projectId);

    const loadWorkspace = async () => {
      try {
        const [projectResponse, branchResponse, detailResponse] = await Promise.all([
          fetch(`/api/projects/${projectId}`),
          fetch(`/api/branches?projectId=${projectId}`),
          initialBranchId ? fetch(`/api/branches/detail?id=${initialBranchId}`) : Promise.resolve(null),
        ]);

        if (projectResponse.ok) {
          const projectData = await projectResponse.json();
          if (projectData.project) {
            setProjectMeta({
              name: projectData.project.name,
              description: projectData.project.description,
            });
          }
        }

        if (detailResponse && detailResponse.ok) {
          const detailData = await detailResponse.json();
          if (detailData.branch?.latestState) {
            setBranch(initialBranchId!);
            setWorldState(detailData.branch.latestState);
          }
        }

        const branchData = await branchResponse.json();
        if (!branchData.branches || branchData.branches.length === 0) return;

        setBranches(branchData.branches);
        const targetBranchId = initialBranchId || branchData.branches[0].id;
        setBranch(targetBranchId);
        const activeBranch = branchData.branches.find((candidate: TimelineBranch) => candidate.id === targetBranchId);
        if (activeBranch?.latestState) {
          setWorldState(activeBranch.latestState);
        }
      } catch (error) {
        console.error(error);
      }
    };

    void loadWorkspace();
  }, [initialBranchId, projectId, setBranch, setBranches, setProject, setProjectMeta, setWorldState]);

  useEffect(() => {
    if (shouldOpenSetupFromUrl) {
      setShowSetup(true);
      setSetupStatus("drafting");
    }
  }, [setSetupStatus, shouldOpenSetupFromUrl]);

  useEffect(() => {
    if (isNewSimulation && setupStatus !== "applied") {
      setShowSetup(true);
    }
  }, [isNewSimulation, setupStatus]);

  const executeCommand = useCallback(
    async (payload: Record<string, unknown>) => {
      const currentBranchId = useSimulationStore.getState().branchId;
      const currentTick = useSimulationStore.getState().worldState?.tick ?? 0;
      if (!currentBranchId) return null;

      const response = await fetch("/api/sim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: currentBranchId,
          currentTick,
          ...payload,
        }),
      });

      const data = await response.json();
      if (response.status === 409) {
        alert(data.error);
        return null;
      }
      if (!response.ok) {
        throw new Error(data.error || "Simulation command failed.");
      }

      if (data.delta) {
        applyDelta(data.delta);
      }
      if (data.worldState) {
        setWorldState(data.worldState);
      }
      if (data.events) {
        addEvents(data.events);
      }
      if (data.proposals) {
        setLastProposals(data.proposals);
      }
      if (data.branch) {
        upsertBranch(data.branch);
      }

      return data;
    },
    [addEvents, applyDelta, setLastProposals, setWorldState, upsertBranch]
  );

  const executeTick = useCallback(async () => {
    const state = useSimulationStore.getState();
    if (!state.branchId) return;

    setStatus("stepping");
    try {
      const response = await fetch("/api/sim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "step",
          branchId: state.branchId,
          currentTick: state.worldState?.tick ?? 0,
          aiSettings: state.aiSettings,
        }),
      });

      const data = await response.json();
      if (response.status === 409) {
        alert(data.error);
        setStatus("error");
        return;
      }

      if (data.delta) {
        applyDelta(data.delta);
      }
      if (data.worldState) {
        setWorldState(data.worldState);
      }
      addEvents(data.events ?? []);
      setLastProposals(data.proposals ?? []);
      setStatus("idle");
    } catch (error) {
      console.error("Tick failed:", error);
      setStatus("error");
    }
  }, [addEvents, applyDelta, setLastProposals, setStatus, setWorldState]);

  const handlePlay = useCallback(() => {
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
    }
    setStatus("playing");
    playIntervalRef.current = setInterval(() => {
      void executeTick();
    }, tickSpeed);
  }, [executeTick, setStatus, tickSpeed]);

  const handlePause = useCallback(() => {
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    setStatus("paused");
  }, [setStatus]);

  const handleFastForward = useCallback(async () => {
    setStatus("stepping");
    await executeCommand({
      type: "fastForward",
      ticks: 10,
      aiSettings: useSimulationStore.getState().aiSettings,
    });
    setStatus("idle");
  }, [executeCommand, setStatus]);

  const onInjectEvent = useCallback(
    async (event: any) => {
      setStatus("stepping");
      try {
        await executeCommand({
          type: "injectEvent",
          event,
        });
        await sync();
      } catch (error) {
        console.error("Inject event failed:", error);
        setStatus("error");
        throw error;
      } finally {
        setStatus("idle");
      }
    },
    [executeCommand, setStatus, sync]
  );

  const onCreateBranch = useCallback(
    async (name: string, summary: string) => {
      setStatus("stepping");
      try {
        const data = await executeCommand({
          type: "createBranch",
          name,
          summary,
        });
        if (data?.branch?.id) {
          upsertBranch(data.branch);
          setBranch(data.branch.id);
          setWorldState(data.branch.latestState);
        }
        await sync();
      } catch (error) {
        console.error("Create branch failed:", error);
        setStatus("error");
        throw error;
      } finally {
        setStatus("idle");
      }
    },
    [executeCommand, setBranch, setStatus, setWorldState, sync, upsertBranch]
  );

  const onApplySetup = useCallback(
    async (draft: CampaignSetupDraft) => {
      setStatus("stepping");
      try {
        await executeCommand({
          type: "applySetup",
          draft,
        });
        setSetupStatus("applied");
        setShowSetup(false);
        await sync();
      } catch (error) {
        console.error("Apply setup failed:", error);
        setStatus("error");
        throw error;
      } finally {
        setStatus("idle");
      }
    },
    [executeCommand, setSetupStatus, setStatus, sync]
  );

  const onMoveToken = useCallback(
    async (
      tokenId: string,
      patch: { x: number; y: number; regionId?: string | null; siteId?: string | null }
    ) => {
      await executeCommand({
        type: "moveToken",
        tokenId,
        x: patch.x,
        y: patch.y,
        regionId: patch.regionId ?? null,
        siteId: patch.siteId ?? null,
      });
    },
    [executeCommand]
  );

  const onMoveSite = useCallback(
    async (
      siteId: string,
      patch: { x: number; y: number; regionId?: string | null }
    ) => {
      await executeCommand({
        type: "moveSite",
        siteId,
        x: patch.x,
        y: patch.y,
        regionId: patch.regionId ?? null,
      });
    },
    [executeCommand]
  );

  const onMoveRegion = useCallback(
    async (regionId: string, patch: { x: number; y: number }) => {
      await executeCommand({
        type: "moveRegion",
        regionId,
        x: patch.x,
        y: patch.y,
      });
    },
    [executeCommand]
  );

  const onResizeRegion = useCallback(
    async (regionId: string, radius: number) => {
      await executeCommand({
        type: "resizeRegion",
        regionId,
        radius,
      });
    },
    [executeCommand]
  );

  const onMoveAgent = useCallback(
    async (agentId: string, patch: { x: number; y: number }) => {
      await executeCommand({
        type: "moveAgent",
        agentId,
        x: patch.x,
        y: patch.y,
      });
    },
    [executeCommand]
  );

  const onMoveCampaignNode = useCallback(
    async (nodeId: string, patch: { x?: number; y?: number; radius?: number }) => {
      await executeCommand({
        type: "moveCampaignNode",
        nodeId,
        x: patch.x,
        y: patch.y,
        radius: patch.radius,
      });
    },
    [executeCommand]
  );

  const onCreateRegion = useCallback(
    async (payload: { name: string; kind: "frontier" | "homeland" | "wilds" | "city-state" | "sea"; x: number; y: number; radius?: number }) => {
      await executeCommand({ type: "createRegion", ...payload });
    },
    [executeCommand]
  );

  const onCreateSite = useCallback(
    async (payload: { name: string; kind: "waypoint" | "capital" | "stronghold" | "market" | "ruin" | "sanctum"; x: number; y: number; regionId?: string | null }) => {
      await executeCommand({ type: "createSite", ...payload, regionId: payload.regionId ?? null });
    },
    [executeCommand]
  );

  const onCreateToken = useCallback(
    async (payload: { name: string; kind: "party" | "faction" | "threat"; x: number; y: number; regionId?: string | null; siteId?: string | null }) => {
      await executeCommand({
        type: "createToken",
        ...payload,
        regionId: payload.regionId ?? null,
        siteId: payload.siteId ?? null,
      });
    },
    [executeCommand]
  );

  const onCreateRoute = useCallback(
    async (payload: { name: string; fromSiteId: string; toSiteId: string }) => {
      await executeCommand({ type: "createRoute", ...payload });
    },
    [executeCommand]
  );

  const onCreateCampaignNode = useCallback(
    async (payload: { name: string; kind: "agent" | "faction" | "front" | "event" | "place"; x: number; y: number; regionId?: string | null; siteId?: string | null }) => {
      await executeCommand({
        type: "createCampaignNode",
        ...payload,
        tags: ["manual"],
        regionId: payload.regionId ?? null,
        siteId: payload.siteId ?? null,
      });
    },
    [executeCommand]
  );

  const onCreateBoardLink = useCallback(
    async (payload: {
      linkType: "causal" | "alliance" | "conflict" | "dependency" | "route";
      source: { type: "agent" | "campaignNode" | "region" | "site" | "front"; id: string };
      target: { type: "agent" | "campaignNode" | "region" | "site" | "front"; id: string };
      label?: string | null;
    }) => {
      await executeCommand({
        type: "createBoardLink",
        ...payload,
        label: payload.label ?? null,
      });
    },
    [executeCommand]
  );

  const onDeleteCampaignNode = useCallback(
    async (nodeId: string) => {
      const node = useSimulationStore.getState().worldState?.campaignNodes.find((entry) => entry.id === nodeId);
      if (!node) {
        setDeleteFeedback({ tone: "danger", message: "That campaign node no longer exists." });
        return;
      }
      setPendingDelete({ type: "campaignNode", id: nodeId, label: node.name });
    },
    []
  );

  const onDeleteBoardLink = useCallback(
    async (linkId: string) => {
      const link = useSimulationStore.getState().worldState?.boardLinks.find((entry) => entry.id === linkId);
      if (!link) {
        setDeleteFeedback({ tone: "danger", message: "That board link no longer exists." });
        return;
      }
      setPendingDelete({
        type: "boardLink",
        id: linkId,
        label: link.label ?? `${link.type} link`,
      });
    },
    []
  );

  const requestDeleteSelection = useCallback(
    (selection: BoardSelection | null) => {
      const currentWorldState = useSimulationStore.getState().worldState;
      if (!selection || !currentWorldState) return;
      const nextPending = resolvePendingDelete(selection, currentWorldState);
      if (!nextPending) {
        setDeleteFeedback({ tone: "danger", message: "That selection cannot be deleted from the board." });
        return;
      }
      setPendingDelete(nextPending);
    },
    []
  );

  const confirmDeleteSelection = useCallback(async () => {
    if (!pendingDelete) return;
    const previousSelection = selectedEntity;
    setIsDeletingSelection(true);
    setPendingDelete(null);
    setSelectedEntity(null);
    try {
      switch (pendingDelete.type) {
        case "agent":
          await executeCommand({ type: "deleteAgent", agentId: pendingDelete.id });
          break;
        case "campaignNode":
          await executeCommand({ type: "deleteCampaignNode", nodeId: pendingDelete.id });
          break;
        case "region":
          await executeCommand({ type: "deleteRegion", regionId: pendingDelete.id });
          break;
        case "site":
          await executeCommand({ type: "deleteSite", siteId: pendingDelete.id });
          break;
        case "route":
          await executeCommand({ type: "deleteRoute", routeId: pendingDelete.id });
          break;
        case "front":
          await executeCommand({ type: "deleteFront", frontId: pendingDelete.id });
          break;
        case "boardLink":
          await executeCommand({ type: "deleteBoardLink", linkId: pendingDelete.id });
          break;
      }
      setDeleteFeedback({ tone: "success", message: `${pendingDelete.label} removed from the board.` });
    } catch (error) {
      console.error("Delete selection failed:", error);
      setSelectedEntity(previousSelection);
      setDeleteFeedback({ tone: "danger", message: `Could not delete ${pendingDelete.label}.` });
    } finally {
      setIsDeletingSelection(false);
    }
  }, [executeCommand, pendingDelete, selectedEntity]);

  const handleForkFromEvent = useCallback(
    async (eventId: string) => {
      setStatus("stepping");
      try {
        const data = await executeCommand({
          type: "forkFromEvent",
          eventId,
          name: `Fork from ${eventId.slice(-6)}`,
          summary: "What-if branch created from a causal event.",
        });
        if (data?.branch?.id) {
          upsertBranch(data.branch);
          setBranch(data.branch.id);
          setWorldState(data.branch.latestState);
        }
        await sync();
      } catch (error) {
        console.error("Fork from event failed:", error);
        setStatus("error");
      } finally {
        setStatus("idle");
      }
    },
    [executeCommand, setBranch, setStatus, setWorldState, sync, upsertBranch]
  );

  const handleSelectBranch = useCallback(
    (nextBranchId: string) => {
      setBranch(nextBranchId);
      const candidate = branches.find((branch) => branch.id === nextBranchId);
      if (candidate?.latestState) {
        setWorldState(candidate.latestState);
      }
      updateWorkspaceQuery({ branchId: nextBranchId });
    },
    [branches, setBranch, setWorldState, updateWorkspaceQuery]
  );

  const handleSetSurface = useCallback(
    (surface: "map" | "canvas") => {
      setSelectedCanvasBinding(null);
      setSelectedEntity(null);
      updateWorkspaceQuery({
        surface: surface === "canvas" ? "canvas" : null,
        canvasId: surface === "map" ? null : initialCanvasId ?? null,
      });
    },
    [initialCanvasId, updateWorkspaceQuery]
  );

  useEffect(() => {
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      autoplayArmedRef.current &&
      settings.simulation.autoplayOnLaunch &&
      branchId &&
      !isNewSimulation &&
      setupStatus === "applied"
    ) {
      autoplayArmedRef.current = false;
      handlePlay();
    }
  }, [branchId, handlePlay, isNewSimulation, settings.simulation.autoplayOnLaunch, setupStatus]);

  const runSyncHeartbeat = useEffectEvent(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }

    const state = useSimulationStore.getState();
    if (state.status !== "idle" && state.status !== "paused") {
      return;
    }
    if (syncInFlightRef.current) {
      return;
    }
    if (state.simulationMode === "battle") {
      return;
    }

    syncInFlightRef.current = true;
    try {
      await state.sync();
    } finally {
      syncInFlightRef.current = false;
    }
  });

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      timeout = setTimeout(async () => {
        await runSyncHeartbeat();
        if (!cancelled) {
          schedule();
        }
      }, 5000);
    };

    schedule();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void runSyncHeartbeat();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      syncInFlightRef.current = false;
      if (timeout) {
        clearTimeout(timeout);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        !selectedEntity ||
        workspaceSurface !== "map" ||
        (target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable))
      ) {
        return;
      }
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      event.preventDefault();
      requestDeleteSelection(selectedEntity);
    };

    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, [requestDeleteSelection, selectedEntity, workspaceSurface]);

  useEffect(() => {
    if (!deleteFeedback) return;
    const timeout = setTimeout(() => setDeleteFeedback(null), 3200);
    return () => clearTimeout(timeout);
  }, [deleteFeedback]);

  return (
    <div
      className={`workspace-shell ${rootClassName}`}
      style={
        {
          "--workspace-radius": settings.appearance.cornerRadius === "tight" ? "10px" : "14px",
          "--workspace-gap": settings.appearance.density === "compact" ? "10px" : "12px",
          "--workspace-panel-pad": settings.appearance.density === "compact" ? "10px" : "12px",
          "--workspace-grid-columns": gridColumns,
          "--workspace-timeline-height": `${timelineHeight}px`,
        } as CSSProperties
      }
    >
      <header className="workspace-header flex items-center justify-between px-3 py-2 border-b border-(--border-subtle) bg-(--bg-shell)">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-8 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-panel) px-2 text-[11px] font-semibold uppercase tracking-widest text-(--text-secondary) transition hover:text-(--text-primary)"
            title="Back to Simulations"
          >
            &larr;
          </Link>
          <div className="flex flex-col">
            <strong className="text-sm font-semibold tracking-[-0.02em] text-(--text-primary) leading-tight">
              {resolvedProjectMeta?.name ?? "Campaign Workspace"}
            </strong>
            {setupStatus !== "applied" && (
              <span className="text-[10px] font-medium uppercase text-(--status-warning) leading-tight">Setup pending</span>
            )}
          </div>
          
          <div className="ml-3 flex items-center gap-1 rounded-md border border-(--border-subtle) bg-(--bg-panel) p-0.5">
            <button
              type="button"
              onClick={() => handleSetSurface("map")}
              className={`rounded px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                workspaceSurface === "map"
                  ? "bg-(--bg-elevated) text-(--text-primary) shadow-sm"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              Map
            </button>
            <button
              type="button"
              onClick={() => handleSetSurface("canvas")}
              className={`rounded px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                workspaceSurface === "canvas"
                  ? "bg-(--bg-elevated) text-(--text-primary) shadow-sm"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              Canvas
            </button>
          </div>
        </div>

        <ControlBar
          projectId={projectId}
          onStep={executeTick}
          onPlay={handlePlay}
          onPause={handlePause}
          onFastForward={handleFastForward}
          onInjectEvent={() => setShowInjectModal(true)}
          onCreateBranch={() => setShowBranchModal(true)}
          onOpenSetup={() => {
            setShowSetup(true);
            setSetupStatus(setupDraft ? "ready" : "drafting");
          }}
        />

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 border-r border-[var(--border-subtle)] pr-3 mr-1">
            <label
              htmlFor="branch-select"
              className="text-[10px] font-semibold uppercase tracking-[0.16em] text-(--text-muted)"
            >
              Branch
            </label>
            <select
              id="branch-select"
              value={branchId ?? ""}
              onChange={(event) => handleSelectBranch(event.target.value)}
              className="h-8 rounded-md border border-(--border-subtle) bg-(--bg-panel) px-2 text-xs text-(--text-primary) outline-none"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant={layout.leftCollapsed ? "ghost" : "secondary"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => toggleDock("left")}
              title="Toggle World Panel"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
            <Button
              variant={layout.timelineCollapsed ? "ghost" : "secondary"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => toggleDock("timeline")}
              title="Toggle Timeline"
            >
              <PanelBottom className="h-4 w-4" />
            </Button>
            <Button
              variant={layout.rightCollapsed ? "ghost" : "secondary"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => toggleDock("right")}
              title="Toggle Context Panel"
            >
              <PanelRight className="h-4 w-4" />
            </Button>
            <div className="mx-1 h-4 w-px bg-(--border-subtle)" />
            <Button
              variant={isFocusMode ? "primary" : "ghost"}
              size="sm"
              className="h-8 px-2 text-[10px] font-bold uppercase tracking-wider"
              onClick={toggleFocusMode}
              title={isFocusMode ? "Exit Focus Mode" : "Enter Focus Mode"}
            >
              {isFocusMode ? "Exit Focus" : "Focus"}
            </Button>
          </div>
        </div>
      </header>

      <div className="workspace-main relative">
        <BattleNarrativeInline />
        <div className="workspace-panel workspace-panel-left">
          {layout.leftCollapsed ? (
            <CollapsedDock label="World" onExpand={() => toggleDock("left")} />
          ) : (
            <ScenarioPanel
              branchName={activeBranch?.name ?? null}
              tick={worldState?.tick ?? 0}
              campaignNodes={worldState?.campaignNodes ?? []}
              selectedNodeId={selectedEntity?.type === "campaignNode" ? selectedEntity.id : null}
              onAdvanceFront={(frontId, delta, rationale) =>
                executeCommand({ type: "advanceFront", frontId, delta, rationale })
              }
              onAcknowledgeProjection={(projectionId, note) =>
                executeCommand({ type: "acknowledgeConsequence", consequenceId: projectionId, note })
              }
              onSelectNode={(nodeId) => setSelectedEntity({ type: "campaignNode", id: nodeId })}
              onDeleteNode={(nodeId) => void onDeleteCampaignNode(nodeId)}
              onGenerateNarrative={() => executeCommand({ type: "generateNarrative" })}
            />
          )}
        </div>

        <hr
          className="workspace-resize-handle"
          onPointerDown={(event) => beginResize("left", event)}
          onDoubleClick={() => resetDock("left")}
          aria-orientation="vertical"
          aria-label="Resize left panel"
          data-orientation="vertical"
        />

        <div className="workspace-panel workspace-panel-center">
          {workspaceSurface === "canvas" ? (
            <FreeformCanvas
              projectId={projectId}
              worldState={worldState}
              initialCanvasId={initialCanvasId}
              onCanvasChange={(canvasId) => updateWorkspaceQuery({ surface: "canvas", canvasId })}
              onBindingSelect={setSelectedCanvasBinding}
            />
          ) : (
            <ReactFlowWorldCanvas
              ref={worldCanvasRef}
              agents={agents}
              boardLinks={boardLinks}
              campaignNodes={campaignNodes}
              relationships={relationships}
              map={worldMap}
              fronts={fronts}
              selectedEntity={selectedEntity}
              onSelectEntity={setSelectedEntity}
              onMoveToken={onMoveToken}
              onMoveSite={onMoveSite}
              onMoveRegion={onMoveRegion}
              onResizeRegion={onResizeRegion}
              onMoveAgent={onMoveAgent}
              onMoveCampaignNode={onMoveCampaignNode}
              onCreateRegion={onCreateRegion}
              onCreateSite={onCreateSite}
              onCreateToken={onCreateToken}
              onCreateRoute={onCreateRoute}
              onCreateBoardLink={onCreateBoardLink}
              onCreateCampaignNode={onCreateCampaignNode}
              onRequestDeleteSelection={requestDeleteSelection}
              initialTool={(searchParams.get("tool") as BoardTool | null) ?? "inspect"}
              onToolStateChange={setBoardUiState}
              layoutPositions={layoutPositions}
            />
          )}
        </div>

        <hr
          className="workspace-resize-handle"
          onPointerDown={(event) => beginResize("right", event)}
          onDoubleClick={() => resetDock("right")}
          aria-orientation="vertical"
          aria-label="Resize right panel"
          data-orientation="vertical"
        />

        <div className="workspace-panel workspace-panel-right">
          {layout.rightCollapsed ? (
            <CollapsedDock label="Context" onExpand={() => toggleDock("right")} />
          ) : workspaceSurface === "canvas" ? (
            <CanvasInspector binding={selectedCanvasBinding} worldState={worldState} />
          ) : (
            <ContextInspector
              selection={selectedEntity}
              worldState={worldState}
              recentEvents={recentEvents}
              onDeleteCampaignNode={onDeleteCampaignNode}
              onDeleteBoardLink={onDeleteBoardLink}
              boardUiState={boardUiState}
              onFocusSelection={() => worldCanvasRef.current?.focusSelection()}
              onBeginLinkFromSelection={() => worldCanvasRef.current?.beginLinkFromSelection()}
              onClearSelection={() => setSelectedEntity(null)}
              onSetBoardTool={(tool) => worldCanvasRef.current?.setBoardTool(tool)}
            />
          )}
        </div>

        <CampaignSetupSidecar
          isOpen={showSetup && Boolean(resolvedProjectMeta?.name)}
          projectName={resolvedProjectMeta?.name ?? ""}
          projectDescription={resolvedProjectMeta?.description ?? ""}
          onClose={() => {
            setShowSetup(false);
            if (isNewSimulation) {
              setSetupStatus("dismissed");
            }
          }}
          onApply={onApplySetup}
        />
      </div>

      <div className="workspace-timeline">
        <hr
          className="workspace-resize-handle"
          onPointerDown={(event) => beginResize("timeline", event)}
          onDoubleClick={() => resetDock("timeline")}
          aria-orientation="horizontal"
          aria-label="Resize timeline panel"
          data-orientation="horizontal"
        />
        {layout.timelineCollapsed ? (
          <CollapsedDock horizontal label="Timeline" onExpand={() => toggleDock("timeline")} />
        ) : (
          <TimelineRail
            currentTick={worldState?.tick ?? 0}
            events={recentEvents}
            causalityGraph={worldState?.causalityGraph ?? null}
            projections={worldState?.projections ?? []}
            branches={branches}
            activeBranchId={branchId}
            onSelectBranch={handleSelectBranch}
            onForkFromEvent={handleForkFromEvent}
          />
        )}
      </div>

      <InjectEventModal
        isOpen={showInjectModal}
        onClose={() => setShowInjectModal(false)}
        agents={worldState?.agents ?? []}
        nodes={worldState?.campaignNodes ?? []}
        onSubmit={onInjectEvent}
      />

      <CreateBranchModal
        isOpen={showBranchModal}
        onClose={() => setShowBranchModal(false)}
        onSubmit={onCreateBranch}
      />

      {pendingDelete ? (
        <div className="absolute bottom-[calc(var(--workspace-panel-pad)+16px)] left-1/2 z-30 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-panel)]/96 p-4 shadow-[0_22px_56px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Confirm Removal
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                Remove <span className="font-semibold text-[var(--text-primary)]">{pendingDelete.label}</span> from the campaign board?
              </p>
            </div>
            <Badge variant="warning">
              {pendingDelete.type === "boardLink"
                ? "Link"
                : pendingDelete.type === "route"
                  ? "Route"
                  : pendingDelete.type === "site"
                    ? "Site"
                    : pendingDelete.type === "region"
                      ? "Region"
                      : pendingDelete.type === "front"
                        ? "Front"
                        : pendingDelete.type === "agent"
                          ? "Agent"
                          : "Node"}
            </Badge>
          </div>
          <div className="mt-4 flex items-center justify-end gap-3">
            <Button variant="ghost" size="sm" type="button" onClick={() => setPendingDelete(null)} disabled={isDeletingSelection}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" type="button" onClick={() => void confirmDeleteSelection()} disabled={isDeletingSelection}>
              {isDeletingSelection ? "Removing..." : "Delete"}
            </Button>
          </div>
        </div>
      ) : null}

      {deleteFeedback ? (
        <div className="absolute right-6 bottom-6 z-50">
          <div className={`rounded-xl border px-5 py-3 shadow-[0_22px_52px_rgba(0,0,0,0.45)] backdrop-blur-2xl ${
            deleteFeedback.tone === "success"
              ? "border-(--status_success)/30 bg-(--bg-panel)/92 text-(--status-success)"
              : "border-(--status_danger)/25 bg-(--bg-panel)/94 text-(--status-danger)"
          }`}>
            <div className="text-sm font-medium">{deleteFeedback.message}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CollapsedDock({
  label,
  onExpand,
  horizontal = false,
}: {
  label: string;
  onExpand: () => void;
  horizontal?: boolean;
}) {
  return (
    <div
      className="flex h-full items-center justify-center border border-(--border-subtle) bg-(--bg-dock) rounded-(--workspace-radius)"
    >
      <button
        type="button"
        onClick={onExpand}
        className="rounded-md border border-(--border-subtle) bg-(--bg-panel) px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-(--text-secondary) transition hover:text-(--text-primary)"
      >
        Show {label}
      </button>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div style={{ padding: 32, color: "var(--text-muted)", fontFamily: "var(--font-mono)", background: "var(--bg-canvas)", minHeight: "100vh" }}>
            Initializing campaign engine...
          </div>
        }
      >
        <WorkspaceContent />
      </Suspense>
    </ErrorBoundary>
  );
}
