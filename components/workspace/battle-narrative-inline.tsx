"use client";

import { useSimulationStore } from "@/lib/stores/simulation-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronUp, Sparkles, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function BattleNarrativeInline() {
  const simulationMode = useSimulationStore((state) => state.simulationMode);
  const battleEvents = useSimulationStore((state) => state.battleEvents);
  const battleCurrentFrame = useSimulationStore((state) => state.battleCurrentFrame);
  const battleNarrative = useSimulationStore((state) => state.battleNarrative);
  const battleNarrativeExpanded = useSimulationStore((state) => state.battleNarrativeExpanded);
  const narrativeStyle = useSimulationStore((state) => state.narrativeStyle);
  const llmEnhanceEnabled = useSimulationStore((state) => state.llmEnhanceEnabled);
  const aiSettings = useSimulationStore((state) => state.aiSettings);
  const setBattleNarrativeExpanded = useSimulationStore((state) => state.setBattleNarrativeExpanded);
  const setNarrativeStyle = useSimulationStore((state) => state.setNarrativeStyle);
  const setLlmEnhanceEnabled = useSimulationStore((state) => state.setLlmEnhanceEnabled);

  const [liveNarrative, setLiveNarrative] = useState<string>("");

  useEffect(() => {
    if (simulationMode !== "battle" || battleEvents.length === 0) {
      setLiveNarrative("");
      return;
    }

    const currentTickEvents = battleEvents.filter(
      (e) => e.tick === battleCurrentFrame
    );

    if (currentTickEvents.length === 0) {
      setLiveNarrative("");
      return;
    }

    const significantEvent = currentTickEvents.find((e) =>
      ["attack", "defend", "death", "alliance_break", "conflict_emerge"].includes(
        e.type
      )
    );

    if (significantEvent) {
      setLiveNarrative(significantEvent.text);
    } else {
      setLiveNarrative("");
    }
  }, [simulationMode, battleEvents, battleCurrentFrame]);

  if (simulationMode !== "battle") return null;

  const styleLabel = narrativeStyle === "cinematic" ? "🎬 Cinematic" : "🎖️ Military";
  const styleColor =
    narrativeStyle === "cinematic"
      ? "text-(--accent-primary-strong)"
      : "text-(--status-info)";

  return (
    <div className="absolute bottom-4 left-1/2 z-40 w-full max-w-2xl -translate-x-1/2 flex-col gap-2 rounded-xl border border-(--border-strong) bg-[rgba(10,10,10,0.85)] p-3 shadow-2xl backdrop-blur-md transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-(--text-muted)" />
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-(--text-secondary)">
            Battle Narrative
          </span>
          <span className={`text-xs font-medium ${styleColor}`}>{styleLabel}</span>
          {llmEnhanceEnabled && aiSettings?.apiKey && (
            <span className="flex items-center gap-1 rounded-md bg-(--accent-primary)/20 px-2 py-0.5 text-[10px] font-semibold text-(--accent-primary-strong)">
              <Zap className="h-3 w-3" />
              AI
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={narrativeStyle}
            onChange={(e) =>
              setNarrativeStyle(e.target.value as "cinematic" | "military")
            }
            className="h-7 rounded-md border border-(--border-subtle) bg-(--bg-panel) px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-(--text-primary) outline-none"
          >
            <option value="cinematic">🎬 Cinematic</option>
            <option value="military">🎖️ Military</option>
          </select>

          {aiSettings?.apiKey && (
            <Button
              variant={llmEnhanceEnabled ? "primary" : "ghost"}
              size="sm"
              onClick={() => setLlmEnhanceEnabled(!llmEnhanceEnabled)}
              className="h-7 px-2 text-[10px]"
            >
              <Zap className="mr-1 h-3 w-3" />
              AI
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setBattleNarrativeExpanded(!battleNarrativeExpanded)}
            className="h-7 px-2"
          >
            {battleNarrativeExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="flex min-h-[32px] items-center">
        {liveNarrative ? (
          <span className="animate-pulse text-sm font-medium text-(--text-primary)">
            {liveNarrative}
          </span>
        ) : (
          <span className="text-xs text-(--text-muted)">
            {battleCurrentFrame === 0 
              ? "Run the simulation to see the battle unfold..." 
              : `Turn ${battleCurrentFrame}...`}
          </span>
        )}
      </div>

      {battleNarrativeExpanded && battleNarrative && (
        <ScrollArea className="mt-2 h-40 rounded-lg border border-(--border-subtle) bg-(--bg-panel) p-3">
          <div className="text-sm leading-relaxed text-(--text-secondary) whitespace-pre-wrap">
            {battleNarrative}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}