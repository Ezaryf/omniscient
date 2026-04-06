"use client";

import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import { useSimulationStore } from "@/lib/stores/simulation-store";

export function NarrationModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [narration, setNarration] = useState<{ title: string; content: string } | null>(null);
  const worldState = useSimulationStore((state) => state.worldState);
  const lastNarrationTick = useSimulationStore((state) => state.lastNarrationTick);
  const setLastNarrationTick = useSimulationStore((state) => state.setLastNarrationTick);

  useEffect(() => {
    if (!worldState?.gmNotes) return;

    // Find the most recent narrative note
    const narrativeNotes = worldState.gmNotes
      .filter((note) => note.tags?.includes("narrative") && note.tags?.includes("ai"))
      .sort((a, b) => b.tick - a.tick);

    const latestNarrative = narrativeNotes[0];
    
    // Show modal if there's a new narrative
    if (latestNarrative && latestNarrative.tick !== lastNarrationTick) {
      setNarration({
        title: latestNarrative.title,
        content: latestNarrative.content,
      });
      setIsOpen(true);
      setLastNarrationTick(latestNarrative.tick);
    }
  }, [worldState?.gmNotes, lastNarrationTick, setLastNarrationTick]);

  if (!isOpen || !narration) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="relative w-full max-w-2xl mx-4 rounded-2xl border border-white/10 bg-gradient-to-b from-[#0a0c10] to-[#050608] shadow-2xl animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
              <Sparkles className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                Campaign Narrative
              </div>
              <h2 className="text-lg font-bold text-white">{narration.title}</h2>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-2 text-white/40 transition-all hover:bg-white/10 hover:text-white/80"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-6">
          <div className="prose prose-invert max-w-none">
            <p className="text-base leading-relaxed text-white/80 whitespace-pre-wrap">
              {narration.content}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-white/8 px-6 py-4">
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-black transition-all hover:bg-white/90 active:scale-95"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
