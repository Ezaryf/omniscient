"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSimulationStore } from "@/lib/stores/simulation-store";
import type { Agent, CampaignNode, CausalEventType, EventImpact } from "@/lib/sim/types";

interface InjectEventModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly agents: Agent[];
  readonly nodes: CampaignNode[];
  readonly onSubmit: (event: {
    type: CausalEventType;
    description: string;
    sourceAgentId: string | null;
    targetAgentId: string | null;
    impact: EventImpact[];
    tags: string[];
    metadata: Record<string, never>;
  }) => Promise<void>;
}

const EVENT_TYPES: CausalEventType[] = [
  "action",
  "conflict",
  "negotiation",
  "trade",
  "alliance",
  "betrayal",
  "natural_event",
  "injected",
  "rule_change",
  "collapse",
];

const IMPACT_TARGET_KINDS = ["agent", "faction", "region", "route", "site", "front"] as const;

const fieldLabelClassName =
  "text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]";
const selectClassName =
  "h-11 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-white/18 focus:ring-2 focus:ring-white/8";

export function InjectEventModal({
  isOpen,
  onClose,
  agents,
  nodes,
  onSubmit,
}: InjectEventModalProps) {
  const defaultEventType = useSimulationStore(
    (state) => state.workspaceSettings.simulation.defaultEventType
  );
  const [type, setType] = useState<CausalEventType>(defaultEventType);
  const [description, setDescription] = useState("");
  const [sourceAgentId, setSourceAgentId] = useState("");
  const [targetAgentId, setTargetAgentId] = useState("");
  const [impacts, setImpacts] = useState<EventImpact[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setType(defaultEventType);
    setDescription("");
    setSourceAgentId("");
    setTargetAgentId("");
    setImpacts([]);
    setIsSubmitting(false);
  }, [defaultEventType, isOpen]);

  const handleAddImpact = () => {
    setImpacts((current) => [
      ...current,
      { targetId: "", targetKind: "agent", field: "morale", delta: 0 },
    ]);
  };

  const handleRemoveImpact = (index: number) => {
    setImpacts((current) => current.filter((_, impactIndex) => impactIndex !== index));
  };

  const handleImpactChange = <K extends keyof EventImpact>(
    index: number,
    field: K,
    value: EventImpact[K]
  ) => {
    setImpacts((current) =>
      current.map((impact, impactIndex) =>
        impactIndex === index ? { ...impact, [field]: value } : impact
      )
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        type,
        description,
        sourceAgentId: sourceAgentId || null,
        targetAgentId: targetAgentId || null,
        impact: impacts,
        tags: ["manual-injection"],
        metadata: {},
      });
      onClose();
    } catch (error) {
      console.error("Failed to inject event:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[860px] overflow-hidden p-0">
        <DialogHeader className="border-b border-[var(--border-subtle)] bg-[var(--bg-dock)]/92">
          <Badge variant="accent" className="w-fit">
            Manual Consequence
          </Badge>
          <DialogTitle>Inject causal event</DialogTitle>
          <DialogDescription>
            Author a direct rupture in the timeline, optionally attach actors, and define hard
            impacts for the simulator to propagate.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-6 p-6">
          <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
            <section className="grid gap-2">
              <label htmlFor="event-type" className={fieldLabelClassName}>
                Event Type
              </label>
              <select
                id="event-type"
                className={selectClassName}
                value={type}
                onChange={(event) => setType(event.target.value as CausalEventType)}
              >
                {EVENT_TYPES.map((eventType) => (
                  <option key={eventType} value={eventType}>
                    {eventType.replace("_", " ")}
                  </option>
                ))}
              </select>
            </section>

            <section className="grid gap-2">
              <label htmlFor="event-description" className={fieldLabelClassName}>
                Description
              </label>
              <Textarea
                id="event-description"
                rows={4}
                placeholder="Describe what happens, why it matters, and what should visibly change."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
              />
            </section>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <section className="grid gap-2">
              <label htmlFor="source-agent" className={fieldLabelClassName}>
                Source Actor
              </label>
              <select
                id="source-agent"
                className={selectClassName}
                value={sourceAgentId}
                onChange={(event) => setSourceAgentId(event.target.value)}
              >
                <option value="">No source actor</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </section>

            <section className="grid gap-2">
              <label htmlFor="target-agent" className={fieldLabelClassName}>
                Target Actor
              </label>
              <select
                id="target-agent"
                className={selectClassName}
                value={targetAgentId}
                onChange={(event) => setTargetAgentId(event.target.value)}
              >
                <option value="">No target actor</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </section>
          </div>

          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)]/85 p-4 shadow-panel">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className={fieldLabelClassName}>Direct Impacts</div>
                <p className="text-sm text-[var(--text-secondary)]">
                  Pin any non-negotiable stat changes. Leave it empty when you want the simulator to
                  infer fallout on its own.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddImpact}>
                Add impact
              </Button>
            </div>

            <div className="grid gap-3">
              {impacts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)]/55 px-4 py-5 text-sm text-[var(--text-secondary)]">
                  No direct impacts defined yet. The engine will still extrapolate secondary
                  consequences from the event description and actor context.
                </div>
              ) : (
                impacts.map((impact, index) => (
                  <div
                    key={`impact-${index}-${impact.targetId || "new"}`}
                    className="grid gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/72 p-3 lg:grid-cols-[120px_minmax(0,1.2fr)_140px_110px_44px]"
                  >
                    <select
                      className={selectClassName}
                      value={impact.targetKind}
                      onChange={(event) =>
                        handleImpactChange(index, "targetKind", event.target.value as EventImpact["targetKind"])
                      }
                    >
                      {IMPACT_TARGET_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind}
                        </option>
                      ))}
                    </select>

                    <select
                      className={selectClassName}
                      value={impact.targetId}
                      onChange={(event) =>
                        handleImpactChange(index, "targetId", event.target.value)
                      }
                    >
                      <option value="">Select target</option>
                      {impact.targetKind === "agent"
                        ? agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name}
                            </option>
                          ))
                        : nodes
                            .filter((node) => node.kind === impact.targetKind)
                            .map((node) => (
                              <option key={node.id} value={node.id}>
                                {node.name}
                              </option>
                            ))}
                    </select>

                    <Input
                      placeholder="Field"
                      value={impact.field}
                      onChange={(event) =>
                        handleImpactChange(index, "field", event.target.value)
                      }
                    />

                    <Input
                      type="number"
                      step="0.1"
                      placeholder="Delta"
                      aria-label="Impact delta value"
                      value={Number.isNaN(impact.delta) ? "" : impact.delta}
                      onChange={(event) =>
                        handleImpactChange(
                          index,
                          "delta",
                          Number.parseFloat(event.target.value || "0")
                        )
                      }
                    />

                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Remove impact"
                      onClick={() => handleRemoveImpact(index)}
                    >
                      ×
                    </Button>
                  </div>
                ))
              )}
            </div>
          </section>

          <DialogFooter className="border-t-0 p-0 pt-2">
            <Button variant="ghost" onClick={onClose} type="button" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={isSubmitting || !description.trim()}
            >
              {isSubmitting ? "Injecting..." : "Inject consequence"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
