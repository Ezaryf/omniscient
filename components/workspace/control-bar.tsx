"use client";

import { Eye, FastForward, GitBranchPlus, Play, Settings2, Sparkles, StepForward } from "lucide-react";
import { useState } from "react";
import { useSimulationStore } from "@/lib/stores/simulation-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricBadge } from "@/components/ui/metric-badge";
import { SettingsModal } from "./settings-modal";

interface ControlBarProps {
  projectId: string | null;
  onStep: () => void;
  onPlay: () => void;
  onPause: () => void;
  onFastForward: () => void;
  onCreateBranch: () => void;
  onInjectEvent: () => void;
  onOpenSetup: () => void;
}

export function ControlBar({
  projectId,
  onStep,
  onPlay,
  onPause,
  onFastForward,
  onCreateBranch,
  onInjectEvent,
  onOpenSetup,
}: ControlBarProps) {
  const {
    status,
    worldState,
    branchId,
    aiSettings,
    setShowProjections,
    showProjections,
    setProjections,
    isNewSimulation,
    setupStatus,
  } = useSimulationStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const tick = worldState?.tick ?? 0;
  const aliveCount = worldState?.agents?.filter((agent) => agent.status === "alive").length ?? 0;
  const activeFronts = worldState?.fronts?.filter((front) => front.status !== "resolved").length ?? 0;
  const routesAtRisk = worldState?.map?.routes?.filter((route) => route.status !== "open").length ?? 0;
  const setupLocked = isNewSimulation && setupStatus !== "applied";

  const handleToggleProjections = async () => {
    const nextShow = !showProjections;
    setShowProjections(nextShow);

    if (nextShow && branchId) {
      try {
        const activeAiSettings = aiSettings.apiKey ? aiSettings : undefined;

        const response = await fetch("/api/sim/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branchId, ticks: 5, aiSettings: activeAiSettings }),
        });

        if (!response.ok) {
          throw new Error(`Error: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.projections) {
          setProjections(data.projections);
        }
      } catch (error) {
        console.error("Failed to fetch projections:", error);
      }
    }
  };

  const statusLabel = setupLocked
    ? "Setup required"
    : status === "playing"
      ? "Simulating"
      : status === "paused"
        ? "Paused"
        : status === "stepping"
          ? "Resolving"
          : "Ready";

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-1 flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-strong)] bg-[var(--bg-panel)]">
          <Sparkles className="h-4 w-4 text-[var(--text-primary)]" />
        </div>
        <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-primary)]">
          Command rail
        </div>
        <Badge variant={setupLocked ? "warning" : status === "playing" ? "accent" : "default"}>{statusLabel}</Badge>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <MetricBadge label="Tick" value={tick} />
          <MetricBadge label="Agents" value={aliveCount} />
          <MetricBadge label="Hot fronts" value={activeFronts} />
          <MetricBadge label="Routes" value={routesAtRisk} className="border-white/10" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onStep}
          disabled={status === "playing" || status === "stepping" || setupLocked}
          type="button"
        >
          <StepForward className="h-3.5 w-3.5" />
          Step
        </Button>
        {status === "playing" ? (
          <Button variant="primary" size="sm" onClick={onPause} type="button">
            Pause
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={onPlay} type="button" disabled={setupLocked}>
            <Play className="h-3.5 w-3.5" />
            Simulate
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onFastForward} disabled={status === "playing" || setupLocked} type="button">
          <FastForward className="h-3.5 w-3.5" />
          +10 Ticks
        </Button>
        <Button variant="primary" size="sm" onClick={onInjectEvent} type="button" disabled={setupLocked}>
          Inject Consequence
        </Button>
        <Button variant="secondary" size="sm" onClick={onCreateBranch} type="button" disabled={setupLocked}>
          <GitBranchPlus className="h-3.5 w-3.5" />
          Branch
        </Button>
        <Button variant={setupLocked ? "primary" : "ghost"} size="sm" onClick={onOpenSetup} type="button">
          Campaign Setup
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <a href={`/compare?projectId=${projectId || "proj-demo"}`}>Compare</a>
        </Button>
        <Button variant={showProjections ? "primary" : "ghost"} size="sm" onClick={handleToggleProjections} type="button" disabled={setupLocked}>
          <Eye className="h-3.5 w-3.5" />
          Omni-Vision
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setIsSettingsOpen(true)} type="button">
          <Settings2 className="h-4 w-4" />
          Settings
        </Button>
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </div>
    </div>
  );
}
