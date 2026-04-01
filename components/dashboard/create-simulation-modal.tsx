"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CreateSimulationModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (name: string, description: string) => Promise<void>;
}

export function CreateSimulationModal({
  isOpen,
  onClose,
  onSubmit,
}: CreateSimulationModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(name.trim(), description.trim());
      setName("");
      setDescription("");
      onClose();
    } catch (error) {
      console.error("Failed to create simulation:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Create new simulation"
    >
      <div className="relative w-full max-w-lg animate-in zoom-in-95 fade-in duration-200">
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0c0c] shadow-2xl shadow-black/50">
          {/* Header */}
          <div className="border-b border-white/[0.06] px-6 py-5">
            <div className="mb-1 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/15 text-blue-400">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                New Simulation
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-[-0.03em] text-white">
              Forge a fresh timeline
            </h2>
            <p className="mt-1 text-sm text-white/35">
              Name your simulation and optionally describe the starting scenario.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
            {/* Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="sim-name"
                className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40"
              >
                Title
              </label>
              <input
                id="sim-name"
                type="text"
                placeholder="e.g. Fracture at the Glass Strait"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
                className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-white/[0.16] focus:bg-white/[0.05]"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label
                htmlFor="sim-desc"
                className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40"
              >
                Scenario premise{" "}
                <span className="tracking-normal text-white/20">(optional)</span>
              </label>
              <textarea
                id="sim-desc"
                placeholder="Describe the trigger, the parties under tension, and why the system is likely to escalate."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm leading-relaxed text-white placeholder-white/20 outline-none transition-colors focus:border-white/[0.16] focus:bg-white/[0.05]"
              />
            </div>

            {/* Hint cards */}
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                <div className="mb-1 text-xs font-semibold text-white/60">
                  Blank canvas
                </div>
                <p className="text-[11px] leading-relaxed text-white/25">
                  Shape the board yourself in guided setup.
                </p>
              </div>
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                <div className="mb-1 text-xs font-semibold text-white/60">
                  AI generates later
                </div>
                <p className="text-[11px] leading-relaxed text-white/25">
                  Configure AI in workspace settings after creation.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-white/[0.04] pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-9 rounded-lg px-4 text-sm font-medium text-white/40 transition-colors hover:bg-white/[0.04] hover:text-white/60"
              >
                Cancel
              </button>
              <Button
                variant="primary"
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="gap-2"
              >
                <Plus className="h-3.5 w-3.5" />
                {isSubmitting ? "Creating..." : "Create & Setup"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
