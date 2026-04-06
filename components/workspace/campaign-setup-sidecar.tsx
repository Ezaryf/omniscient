"use client";

import { useEffect, useMemo, useState } from "react";
import type { CampaignSetupDraft } from "@/lib/sim/types";
import { useSimulationStore } from "@/lib/stores/simulation-store";
import { ChevronRight, RefreshCw, Swords, Users, Zap, X } from "lucide-react";

interface CampaignSetupSidecarProps {
  isOpen: boolean;
  projectName: string;
  projectDescription: string;
  onClose: () => void;
  onApply: (draft: CampaignSetupDraft) => Promise<void>;
}

function cloneDraft(d: CampaignSetupDraft) {
  return JSON.parse(JSON.stringify(d)) as CampaignSetupDraft;
}

const FACTION_COLORS = ["#38bdf8", "#fb923c", "#a78bfa", "#4ade80", "#f472b6", "#facc15"];

export function CampaignSetupSidecar({
  isOpen,
  projectName,
  projectDescription,
  onClose,
  onApply,
}: CampaignSetupSidecarProps) {
  const { aiSettings, setupDraft, setSetupDraft, setupStatus, setSetupStatus } = useSimulationStore();
  const [draft, setDraft] = useState<CampaignSetupDraft | null>(setupDraft);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);

  useEffect(() => {
    if (setupDraft) setDraft(cloneDraft(setupDraft));
  }, [setupDraft]);

  const activeAiSettings = useMemo(
    () => (aiSettings.apiKey ? aiSettings : undefined),
    [aiSettings]
  );

  useEffect(() => {
    if (!isOpen || draft || !projectName.trim()) return;
    const controller = new AbortController();
    void (async () => {
      setIsGenerating(true);
      setError(null);
      try {
        const res = await fetch("/api/projects/generate-setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: projectName, description: projectDescription, aiSettings: activeAiSettings }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok || !data.draft) throw new Error(data.error || "Unable to generate setup.");
        setSetupDraft(data.draft);
        setDraft(cloneDraft(data.draft));
        setSetupStatus("ready");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unable to generate setup.");
      } finally {
        setIsGenerating(false);
      }
    })();
    return () => controller.abort();
  }, [activeAiSettings, draft, isOpen, projectDescription, projectName, setSetupDraft, setSetupStatus]);

  if (!isOpen) return null;

  const patch = (next: CampaignSetupDraft) => {
    setDraft(next);
    setSetupDraft(next);
    setSetupStatus("ready");
  };

  const handleApply = async () => {
    if (!draft) return;
    setIsApplying(true);
    setError(null);
    try {
      await onApply(draft);
      setSetupStatus("applied");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to launch timeline.");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-[540px] max-h-[88vh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0c10] shadow-[0_32px_80px_rgba(0,0,0,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-white/25">
              Campaign Setup
            </div>
            <h2 className="text-[22px] font-bold tracking-tight text-white leading-tight">
              {projectName || "New Timeline"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 rounded-lg p-1.5 text-white/25 transition-all hover:bg-white/8 hover:text-white/60"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading */}
          {isGenerating && (
            <div className="flex items-center gap-4 px-6 py-8">
              <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white/15 border-t-white/60" />
              <div>
                <div className="text-sm font-semibold text-white/80">Building your scenario...</div>
                <div className="mt-0.5 text-xs text-white/35">Generating factions, actors, and opening conflict</div>
              </div>
            </div>
          )}

          {draft && !isGenerating && (
            <div className="space-y-5 px-6 py-5">

              {/* Premise */}
              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/25">Premise</div>
                <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3">
                  {editingField === "premise" ? (
                    <textarea
                      autoFocus
                      value={draft.premise}
                      rows={3}
                      onChange={(e) => patch({ ...draft, premise: e.target.value })}
                      onBlur={() => setEditingField(null)}
                      className="w-full resize-none bg-transparent text-sm leading-relaxed text-white/80 outline-none"
                    />
                  ) : (
                    <p
                      className="cursor-text text-sm leading-relaxed text-white/60 hover:text-white/80 transition-colors"
                      onClick={() => setEditingField("premise")}
                    >
                      {draft.premise}
                    </p>
                  )}
                </div>
              </div>

              {/* Factions */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Swords size={12} className="text-white/25" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Factions</span>
                  <span className="ml-auto text-[10px] text-white/25">{draft.factions.length}</span>
                </div>
                <div className="space-y-2">
                  {draft.factions.map((faction, fi) => {
                    const color = FACTION_COLORS[fi % FACTION_COLORS.length];
                    return (
                      <div key={faction.id} className="rounded-xl border border-white/8 bg-white/3 p-4">
                        <div className="flex items-center gap-2.5 mb-2.5">
                          <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                          <input
                            value={faction.name}
                            onChange={(e) => patch({ ...draft, factions: draft.factions.map((f, i) => i === fi ? { ...f, name: e.target.value } : f) })}
                            className="flex-1 bg-transparent text-[15px] font-bold text-white outline-none"
                          />
                        </div>
                        <input
                          value={faction.identity}
                          onChange={(e) => patch({ ...draft, factions: draft.factions.map((f, i) => i === fi ? { ...f, identity: e.target.value } : f) })}
                          className="w-full bg-transparent text-xs text-white/45 outline-none"
                          placeholder="Identity..."
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actors */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Users size={12} className="text-white/25" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Actors</span>
                  <span className="ml-auto text-[10px] text-white/25">{draft.actors.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {draft.actors.map((actor, ai) => {
                    const fi = draft.factions.findIndex((f) => f.id === actor.factionId);
                    const color = FACTION_COLORS[fi % FACTION_COLORS.length] ?? "#94a3b8";
                    const factionName = draft.factions[fi]?.name ?? "";
                    return (
                      <div key={actor.id} className="rounded-xl border border-white/8 bg-white/3 p-3">
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                          <span className="truncate text-[9px] font-bold uppercase tracking-wider" style={{ color: `${color}80` }}>
                            {factionName}
                          </span>
                        </div>
                        <input
                          value={actor.name}
                          onChange={(e) => patch({ ...draft, actors: draft.actors.map((a, i) => i === ai ? { ...a, name: e.target.value } : a) })}
                          className="w-full bg-transparent text-[13px] font-semibold text-white outline-none"
                        />
                        <div className="mt-0.5 truncate text-[10px] text-white/30">{actor.role}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Fronts */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Zap size={12} className="text-white/25" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Active Fronts</span>
                  <span className="ml-auto text-[10px] text-white/25">{draft.fronts.length}</span>
                </div>
                <div className="space-y-2">
                  {draft.fronts.map((front, fi) => (
                    <div key={front.id} className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-3">
                      <input
                        value={front.name}
                        onChange={(e) => patch({ ...draft, fronts: draft.fronts.map((f, i) => i === fi ? { ...f, name: e.target.value } : f) })}
                        className="w-full bg-transparent text-[13px] font-semibold text-white/90 outline-none mb-1"
                      />
                      <div className="text-[11px] leading-relaxed text-white/35">{front.stakes}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Opening event */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Opening Event</span>
                  <span
                    className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold"
                    style={{
                      backgroundColor: draft.generatedBy === "ai" ? "#38bdf815" : "#ffffff08",
                      color: draft.generatedBy === "ai" ? "#38bdf8" : "#ffffff30",
                    }}
                  >
                    {draft.generatedBy === "ai" ? "AI" : "Fallback"}
                  </span>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3">
                  {editingField === "event" ? (
                    <textarea
                      autoFocus
                      value={draft.incitingEvent.description}
                      rows={3}
                      onChange={(e) => patch({ ...draft, incitingEvent: { ...draft.incitingEvent, description: e.target.value } })}
                      onBlur={() => setEditingField(null)}
                      className="w-full resize-none bg-transparent text-sm leading-relaxed text-white/80 outline-none"
                    />
                  ) : (
                    <p
                      className="cursor-text text-sm leading-relaxed text-white/60 hover:text-white/80 transition-colors"
                      onClick={() => setEditingField("event")}
                    >
                      {draft.incitingEvent.description}
                    </p>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-3 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex shrink-0 items-center gap-3 border-t border-white/8 px-6 py-4">
          <button
            onClick={() => { setDraft(null); setSetupDraft(null); setSetupStatus("drafting"); }}
            disabled={isGenerating || isApplying}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium text-white/35 transition-all hover:bg-white/6 hover:text-white/60 disabled:opacity-30"
          >
            <RefreshCw size={11} />
            Regenerate
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-[12px] font-medium text-white/35 transition-all hover:bg-white/6 hover:text-white/60"
          >
            Close
          </button>
          <button
            onClick={handleApply}
            disabled={!draft || isGenerating || isApplying}
            className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-[13px] font-bold text-black transition-all hover:bg-white/90 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isApplying ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                Launching...
              </>
            ) : (
              <>
                Launch Timeline
                <ChevronRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
