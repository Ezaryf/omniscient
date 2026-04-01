"use client";

import { Eye, FastForward, GitBranchPlus, LayoutGrid, Play, Rewind, Settings2, Sparkles, StepForward } from "lucide-react";
import { useState } from "react";
import { useSimulationStore, type SimulationMode } from "@/lib/stores/simulation-store";
import type { LayoutMode } from "@/lib/layout/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function ModeSelector() {
  const simulationMode = useSimulationStore((state) => state.simulationMode);
  const setSimulationMode = useSimulationStore((state) => state.setSimulationMode);
  const worldState = useSimulationStore((state) => state.worldState);
  const hasAgents = (worldState?.agents?.length ?? 0) > 0;

  return (
    <select
      value={simulationMode}
      onChange={(e) => setSimulationMode(e.target.value as SimulationMode)}
      className="h-8 rounded-md border border-(--border-subtle) bg-(--bg-panel) px-2 text-xs font-semibold uppercase tracking-[0.14em] text-(--text-primary) outline-none"
    >
      <option value="generic">🧠 Generic</option>
      <option value="battle" disabled={!hasAgents}>⚔️ Battle</option>
    </select>
  );
}

function LayoutSelector() {
  const layoutMode = useSimulationStore((state) => state.layoutMode);
  const setLayoutMode = useSimulationStore((state) => state.setLayoutMode);
  const applyAutoLayout = useSimulationStore((state) => state.applyAutoLayout);

  return (
    <div className="flex items-center gap-1">
      <select
        value={layoutMode}
        onChange={(e) => setLayoutMode(e.target.value as LayoutMode)}
        className="h-8 rounded-md border border-(--border-subtle) bg-(--bg-panel) px-2 text-xs font-semibold uppercase tracking-[0.14em] text-(--text-primary) outline-none"
      >
        <option value="manual">✋ Manual</option>
        <option value="assisted">🧠 Auto</option>
      </select>
      
      {layoutMode === "assisted" && (
        <Button
          variant="secondary"
          size="sm"
          onClick={applyAutoLayout}
          className="h-8 px-2"
          title="Organize nodes"
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function BattleControls() {
  const simulationMode = useSimulationStore((state) => state.simulationMode);
  const battleFrames = useSimulationStore((state) => state.battleFrames);
  const battleCurrentFrame = useSimulationStore((state) => state.battleCurrentFrame);
  const battleWarnings = useSimulationStore((state) => state.battleWarnings);
  const nextBattleFrame = useSimulationStore((state) => state.nextBattleFrame);
  const prevBattleFrame = useSimulationStore((state) => state.prevBattleFrame);
  const resetBattleSimulation = useSimulationStore((state) => state.resetBattleSimulation);
  const runBattleSimulation = useSimulationStore((state) => state.runBattleSimulation);
  const worldState = useSimulationStore((state) => state.worldState);

  if (simulationMode !== "battle") return null;

  const hasFrames = battleFrames.length > 0;
  const currentFrame = battleFrames[battleCurrentFrame];
  const isAtEnd = battleCurrentFrame >= battleFrames.length - 1;
  const isAtStart = battleCurrentFrame === 0;

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-(--border-subtle) pt-2">
      {battleWarnings.length > 0 && (
        <Badge variant="warning" className="text-[10px]">
          ⚠️ {battleWarnings[0]}
        </Badge>
      )}
      
      {!hasFrames ? (
        <Button
          variant="primary"
          size="sm"
          onClick={() => runBattleSimulation({ maxTicks: 30 })}
          disabled={!worldState || worldState.agents.length === 0}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Run Battle
        </Button>
      ) : (
        <>
          <Button variant="ghost" size="sm" onClick={resetBattleSimulation} disabled={isAtStart}>
            <Rewind className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button variant="secondary" size="sm" onClick={prevBattleFrame} disabled={isAtStart}>
            <StepForward className="h-3.5 w-3.5 rotate-180" />
          </Button>
          <span className="text-xs font-mono text-(--text-muted)">
            {battleCurrentFrame + 1} / {battleFrames.length}
          </span>
          <Button variant="secondary" size="sm" onClick={nextBattleFrame} disabled={isAtEnd}>
            <StepForward className="h-3.5 w-3.5" />
          </Button>
          {currentFrame?.finished && (
            <Badge variant={currentFrame.winner ? "success" : "default"}>
              {currentFrame.winner ? `🏆 ${currentFrame.winner}` : "Draw"}
            </Badge>
          )}
        </>
      )}
    </div>
  );
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

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 border-r border-(--border-subtle) pr-2">
        <ModeSelector />
        <LayoutSelector />
        <Button
          variant="secondary"
          size="sm"
          onClick={onStep}
          disabled={status === "playing" || status === "stepping" || setupLocked}
          type="button"
          className="h-8"
        >
          <StepForward className="h-3.5 w-3.5" />
          Step
        </Button>
        {status === "playing" ? (
          <Button variant="primary" size="sm" onClick={onPause} type="button" className="h-8">
            <div className="h-2 w-2 rounded-[2px] bg-red-500 mr-1" />
            Pause
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={onPlay} type="button" disabled={setupLocked} className="h-8">
            <Play className="h-3.5 w-3.5" />
            Simulate
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onFastForward} disabled={status === "playing" || setupLocked} type="button" className="h-8">
          <FastForward className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 ml-2">
        <Button variant="primary" size="sm" onClick={onInjectEvent} type="button" disabled={setupLocked} className="h-8">
          Inject
        </Button>
        <Button variant={setupLocked ? "primary" : "ghost"} size="sm" onClick={onOpenSetup} type="button" className="h-8">
          Setup
        </Button>
        <Button variant={showProjections ? "primary" : "ghost"} size="sm" onClick={handleToggleProjections} type="button" disabled={setupLocked} className="h-8" title="Omni-Vision">
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" asChild className="h-8 px-2" title="Compare">
          <a href={`/compare?projectId=${projectId || "proj-demo"}`}>
            <GitBranchPlus className="h-3.5 w-3.5" />
          </a>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setIsSettingsOpen(true)} type="button" className="h-8 px-2" title="Settings">
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        <BattleControls />
      </div>
    </>
  );
}
