"use client";

import { useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSimulationStore } from "@/lib/stores/simulation-store";
import { ControlBar } from "@/components/workspace/control-bar";
import { WorldCanvas } from "@/components/workspace/world-canvas";
import { AgentInspector } from "@/components/workspace/agent-inspector";
import { TimelineRail } from "@/components/workspace/timeline-rail";
import { ScenarioPanel } from "@/components/workspace/scenario-panel";
import { DEMO_PROJECT_ID } from "@/lib/server/store";

function WorkspaceContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? DEMO_PROJECT_ID;
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    worldState,
    branches,
    selectedAgentId,
    selectedAgent,
    recentEvents,
    tickSpeed,
    setProject,
    setBranch,
    setWorldState,
    applyDelta,
    setBranches,
    setSelectedAgent,
    setStatus,
    addEvents,
    setLastProposals,
    sync,
  } = useSimulationStore();

  // ─── Load initial state ──────────────────────────────────────

  const initialBranchId = searchParams.get("branchId");

  useEffect(() => {
    setProject(projectId);

    // Fetch branches
    fetch(`/api/branches?projectId=${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.branches && data.branches.length > 0) {
          setBranches(data.branches);
          
          const targetBranchId = initialBranchId || data.branches[0].id;
          setBranch(targetBranchId);

          const activeBranch = data.branches.find(
            (b: { id: string }) => b.id === targetBranchId
          );
          if (activeBranch?.latestState) {
            setWorldState(activeBranch.latestState);
          }
        }
      })
      .catch(console.error);
  }, [projectId, initialBranchId, setProject, setBranch, setBranches, setWorldState]);

  // ─── Simulation controls ────────────────────────────────────

  const executeTick = useCallback(async () => {
    const state = useSimulationStore.getState();
    const branchId = state.branchId;
    const currentTick = state.worldState?.tick ?? 0;
    if (!branchId) return;

    setStatus("stepping");
    try {
      const res = await fetch("/api/sim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          type: "step", 
          branchId, 
          currentTick,
          aiSettings: state.aiSettings
        }),
      });
      const data = await res.json();

      if (res.status === 409) {
        console.warn("Race condition detected:", data.error);
        alert(data.error);
        setStatus("error");
        return;
      }

      if (data.delta) {
        applyDelta(data.delta);
        addEvents(data.events ?? []);
        setLastProposals(data.proposals ?? []);
      } else if (data.worldState) {
        setWorldState(data.worldState);
        addEvents(data.events ?? []);
        setLastProposals(data.proposals ?? []);
      }
      setStatus("idle");
    } catch (err) {
      console.error("Tick failed:", err);
      setStatus("error");
    }
  }, [setStatus, applyDelta, setWorldState, addEvents, setLastProposals]);

  const handleStep = useCallback(() => {
    executeTick();
  }, [executeTick]);

  const handlePlay = useCallback(() => {
    setStatus("playing");
    playIntervalRef.current = setInterval(() => {
      executeTick();
    }, tickSpeed);
  }, [setStatus, executeTick, tickSpeed]);

  const handlePause = useCallback(() => {
    setStatus("paused");
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
  }, [setStatus]);

  const handleFastForward = useCallback(async () => {
    const state = useSimulationStore.getState();
    const branchId = state.branchId;
    const currentTick = state.worldState?.tick ?? 0;
    if (!branchId) return;

    setStatus("stepping");
    try {
      const res = await fetch("/api/sim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          type: "fastForward", 
          branchId, 
          ticks: 10, 
          currentTick,
          aiSettings: state.aiSettings
        }),
      });
      const data = await res.json();

      if (res.status === 409) {
        console.warn("Race condition detected:", data.error);
        alert(data.error);
        setStatus("error");
        return;
      }

      if (data.delta) {
        applyDelta(data.delta);
        addEvents(data.events ?? []);
      } else if (data.worldState) {
        setWorldState(data.worldState);
        addEvents(data.events ?? []);
      }
      setStatus("idle");
    } catch (err) {
      console.error("Fast forward failed:", err);
      setStatus("error");
    }
  }, [setStatus, applyDelta, setWorldState, addEvents]);

  const handleCreateBranch = useCallback(async () => {
    const state = useSimulationStore.getState();
    const branchId = state.branchId;
    const currentTick = state.worldState?.tick ?? 0;
    if (!branchId) return;

    try {
      const res = await fetch("/api/sim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "createBranch",
          branchId,
          name: `Branch @ T${worldState?.tick ?? 0}`,
          currentTick,
        }),
      });
      const data = await res.json();

      if (data.branch) {
        setBranches([...branches, data.branch]);
      }
    } catch (err) {
      console.error("Branch creation failed:", err);
    }
  }, [worldState?.tick, branches, setBranches]);

  const handleSelectBranch = useCallback(
    (branchId: string) => {
      setBranch(branchId);
      const branch = branches.find((b) => b.id === branchId);
      if (branch?.latestState) {
        setWorldState(branch.latestState);
      }
    },
    [branches, setBranch, setWorldState]
  );

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, []);

  // ─── Sync Heartbeat ─────────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(async () => {
      const state = useSimulationStore.getState();
      if (state.status === "idle" || state.status === "paused") {
        await sync();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [sync]);

  const activeBranchId = useSimulationStore.getState().branchId;

  return (
    <div className="workspace-grid">
      <ControlBar
        onStep={handleStep}
        onPlay={handlePlay}
        onPause={handlePause}
        onFastForward={handleFastForward}
        onCreateBranch={handleCreateBranch}
      />

      <WorldCanvas
        agents={worldState?.agents ?? []}
        relationships={worldState?.relationships ?? []}
        selectedAgentId={selectedAgentId}
        onSelectAgent={setSelectedAgent}
      />

      <AgentInspector
        agent={selectedAgent}
        relationships={worldState?.relationships ?? []}
        recentEvents={recentEvents}
        allAgents={worldState?.agents ?? []}
      />

      <TimelineRail
        currentTick={worldState?.tick ?? 0}
        events={recentEvents}
        branches={branches}
        activeBranchId={activeBranchId}
        onSelectBranch={handleSelectBranch}
      />

      <ScenarioPanel />
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Initializing Workspace...</div>}>
      <WorkspaceContent />
    </Suspense>
  );
}
