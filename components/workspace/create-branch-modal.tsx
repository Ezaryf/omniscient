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

interface CreateBranchModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (name: string, summary: string) => Promise<void>;
}

const fieldLabelClassName =
  "text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]";

export function CreateBranchModal({
  isOpen,
  onClose,
  onSubmit,
}: CreateBranchModalProps) {
  const branchPrefix = useSimulationStore((state) => state.workspaceSettings.simulation.branchPrefix);
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(branchPrefix ? `${branchPrefix} ` : "");
    setSummary("");
    setIsSubmitting(false);
  }, [branchPrefix, isOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(name, summary);
      onClose();
    } catch (error) {
      console.error("Failed to create branch:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[560px] overflow-hidden p-0">
        <DialogHeader className="border-b border-[var(--border-subtle)] bg-[var(--bg-dock)]/92">
          <Badge variant="accent" className="w-fit">
            Timeline Branch
          </Badge>
          <DialogTitle>Branch timeline</DialogTitle>
          <DialogDescription>
            Freeze the current state into a separate path so you can test a new decision without
            mutating the original timeline.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5 p-6">
          <section className="grid gap-2">
            <label htmlFor="branch-name" className={fieldLabelClassName}>
              Branch Name
            </label>
            <Input
              id="branch-name"
              type="text"
              placeholder="Radical diplomacy path"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              required
            />
          </section>

          <section className="grid gap-2">
            <label htmlFor="branch-summary" className={fieldLabelClassName}>
              Strategic Context
            </label>
            <Textarea
              id="branch-summary"
              placeholder="Why does this split matter, and what are you testing in this branch?"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={4}
            />
          </section>

          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/70 p-4">
            <p className="text-sm leading-6 text-[var(--text-secondary)]">
              The new branch inherits the current tick, map state, actors, fronts, and event
              history up to this moment. Everything after the split evolves independently.
            </p>
          </section>

          <DialogFooter className="border-t-0 p-0 pt-2">
            <Button variant="ghost" onClick={onClose} type="button" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? "Branching..." : "Confirm branch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
