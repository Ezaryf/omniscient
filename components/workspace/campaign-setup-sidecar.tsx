"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CampaignSetupDraft } from "@/lib/sim/types";
import { useSimulationStore } from "@/lib/stores/simulation-store";

interface CampaignSetupSidecarProps {
  isOpen: boolean;
  projectName: string;
  projectDescription: string;
  onClose: () => void;
  onApply: (draft: CampaignSetupDraft) => Promise<void>;
}

function cloneDraft(draft: CampaignSetupDraft) {
  return JSON.parse(JSON.stringify(draft)) as CampaignSetupDraft;
}

const fieldLabelClassName =
  "text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]";

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

  useEffect(() => {
    if (setupDraft) {
      setDraft(cloneDraft(setupDraft));
    }
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
        const response = await fetch("/api/projects/generate-setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: projectName,
            description: projectDescription,
            aiSettings: activeAiSettings,
          }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !data.draft) {
          throw new Error(data.error || "Unable to generate setup.");
        }

        setSetupDraft(data.draft);
        setDraft(cloneDraft(data.draft));
        setSetupStatus("ready");
      } catch (generationError) {
        if ((generationError as Error).name === "AbortError") return;
        const message =
          generationError instanceof Error ? generationError.message : "Unable to generate setup.";
        setError(message);
      } finally {
        setIsGenerating(false);
      }
    })();

    return () => controller.abort();
  }, [activeAiSettings, draft, isOpen, projectDescription, projectName, setSetupDraft, setSetupStatus]);

  if (!isOpen) return null;

  const patchDraft = (next: CampaignSetupDraft) => {
    setDraft(next);
    setSetupDraft(next);
    setSetupStatus("ready");
  };

  const handleRegenerate = async () => {
    setDraft(null);
    setSetupDraft(null);
    setSetupStatus("drafting");
  };

  const handleApply = async () => {
    if (!draft) return;
    setIsApplying(true);
    setError(null);
    try {
      await onApply(draft);
      setSetupStatus("applied");
    } catch (applyError) {
      const message =
        applyError instanceof Error ? applyError.message : "Failed to launch timeline.";
      setError(message);
    } finally {
      setIsApplying(false);
    }
  };

  const statusLabel =
    setupStatus === "drafting"
      ? "Drafting setup"
      : setupStatus === "ready"
        ? "Setup ready"
        : setupStatus === "applied"
          ? "Timeline launched"
          : "Setup hidden";

  return (
    <aside className="absolute inset-y-3 right-3 z-30 flex w-[min(460px,calc(100%-24px))] flex-col overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--bg-panel)] shadow-dock">
      <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-dock)]/92 p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="space-y-3">
            <Badge variant="accent" className="w-fit">
              Campaign Setup
            </Badge>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                {projectName || "New timeline"}
              </h2>
              <p className="max-w-[34ch] text-sm leading-6 text-[var(--text-secondary)]">
                Build the first consequence, approve the factions and fronts, and launch a usable
                campaign state instead of landing in an empty shell.
              </p>
            </div>
          </div>
          <Button className="shrink-0" variant="ghost" size="sm" type="button" onClick={onClose}>
            Dismiss
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Badge variant={setupStatus === "applied" ? "success" : "default"}>{statusLabel}</Badge>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={handleRegenerate}
            disabled={isGenerating || isApplying}
          >
            Regenerate
          </Button>
        </div>
      </div>

      {isGenerating ? (
        <div className="m-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/75 p-4">
          <div className="mb-1 text-sm font-semibold text-[var(--text-primary)]">
            Forging your opening board...
          </div>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            Turning the title into factions, routes, contested fronts, and a first rupture.
          </p>
        </div>
      ) : null}

      {draft ? (
        <ScrollArea className="flex-1">
          <div className="grid gap-5 p-5">
            <section className="grid gap-2">
              <label className={fieldLabelClassName}>Premise</label>
              <Textarea
                value={draft.premise}
                rows={4}
                onChange={(event) => patchDraft({ ...draft, premise: event.target.value })}
              />
            </section>

            <section className="grid gap-3">
              <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">Factions</strong>
                <Badge>{draft.factions.length}</Badge>
              </div>
              <div className="grid gap-3">
                {draft.factions.map((faction, index) => (
                  <div
                    key={faction.id}
                    className="grid gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/72 p-3"
                  >
                    <Input
                      value={faction.name}
                      onChange={(event) =>
                        patchDraft({
                          ...draft,
                          factions: draft.factions.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, name: event.target.value } : item
                          ),
                        })
                      }
                    />
                    <Textarea
                      value={faction.identity}
                      rows={2}
                      onChange={(event) =>
                        patchDraft({
                          ...draft,
                          factions: draft.factions.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, identity: event.target.value } : item
                          ),
                        })
                      }
                    />
                    <Textarea
                      value={faction.goal}
                      rows={2}
                      onChange={(event) =>
                        patchDraft({
                          ...draft,
                          factions: draft.factions.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, goal: event.target.value } : item
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-3">
              <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">Actors</strong>
                <Badge>{draft.actors.length}</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {draft.actors.map((actor, index) => (
                  <div
                    key={actor.id}
                    className="grid gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/72 p-3"
                  >
                    <Input
                      value={actor.name}
                      onChange={(event) =>
                        patchDraft({
                          ...draft,
                          actors: draft.actors.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, name: event.target.value } : item
                          ),
                        })
                      }
                    />
                    <Input
                      value={actor.role}
                      onChange={(event) =>
                        patchDraft({
                          ...draft,
                          actors: draft.actors.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, role: event.target.value } : item
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-3">
              <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">Regions and fronts</strong>
                <Badge>
                  {draft.regions.length} regions / {draft.fronts.length} fronts
                </Badge>
              </div>
              <div className="grid gap-3">
                {draft.regions.map((region, index) => (
                  <div
                    key={region.id}
                    className="grid gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/72 p-3"
                  >
                    <Input
                      value={region.name}
                      onChange={(event) =>
                        patchDraft({
                          ...draft,
                          regions: draft.regions.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, name: event.target.value } : item
                          ),
                        })
                      }
                    />
                    <Textarea
                      value={region.summary}
                      rows={2}
                      onChange={(event) =>
                        patchDraft({
                          ...draft,
                          regions: draft.regions.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, summary: event.target.value } : item
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {draft.fronts.map((front, index) => (
                  <div
                    key={front.id}
                    className="grid gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/72 p-3"
                  >
                    <Input
                      value={front.name}
                      onChange={(event) =>
                        patchDraft({
                          ...draft,
                          fronts: draft.fronts.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, name: event.target.value } : item
                          ),
                        })
                      }
                    />
                    <Textarea
                      value={front.stakes}
                      rows={2}
                      onChange={(event) =>
                        patchDraft({
                          ...draft,
                          fronts: draft.fronts.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, stakes: event.target.value } : item
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-3">
              <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">Inciting consequence</strong>
                <Badge variant={draft.generatedBy === "ai" ? "accent" : "default"}>
                  {draft.generatedBy === "ai" ? "AI suggested" : "Fallback suggested"}
                </Badge>
              </div>
              <Textarea
                value={draft.incitingEvent.description}
                rows={3}
                onChange={(event) =>
                  patchDraft({
                    ...draft,
                    incitingEvent: { ...draft.incitingEvent, description: event.target.value },
                  })
                }
              />
              <Textarea
                value={draft.incitingEvent.stakes}
                rows={2}
                onChange={(event) =>
                  patchDraft({
                    ...draft,
                    incitingEvent: { ...draft.incitingEvent, stakes: event.target.value },
                  })
                }
              />
            </section>
          </div>
        </ScrollArea>
      ) : null}

      {error ? <p className="px-5 pb-3 text-sm text-[#efb0b0]">{error}</p> : null}

      <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-dock)]/9 p-5">
        <div className="mb-4 text-sm leading-6 text-[var(--text-secondary)]">
          Launching applies the approved draft to the current branch, creates the first event, and
          turns the blank map into a usable campaign state.
        </div>
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" type="button" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={handleApply}
            disabled={!draft || isGenerating || isApplying}
          >
            {isApplying ? "Launching..." : "Launch timeline"}
          </Button>
        </div>
      </div>
    </aside>
  );
}
