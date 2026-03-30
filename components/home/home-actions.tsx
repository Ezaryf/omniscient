"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, GitBranch, Sparkles } from "lucide-react";
import { CreateSimulationModal } from "@/components/dashboard/create-simulation-modal";
import { Button } from "@/components/ui/button";

export function HomeActions({ projectCount }: { readonly projectCount: number }) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleCreateSimulation = async (name: string, description: string) => {
    setIsCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });

      const data = await res.json();
      if (data.project?.id) {
        router.push(
          data.branchId
            ? `/workspace?projectId=${data.project.id}&branchId=${data.branchId}&setup=1`
            : `/workspace?projectId=${data.project.id}&setup=1`
        );
      }
    } catch (err) {
      console.error("Failed to create simulation:", err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <CreateSimulationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateSimulation}
      />

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8 w-full max-w-md mx-auto">
        <Button 
          variant="primary" 
          size="lg" 
          className="w-full sm:w-auto h-14 px-8 text-base shadow-[0_0_20px_-5px_var(--accent-primary)]/30 hover:shadow-[0_0_30px_-5px_var(--accent-primary)]/50 transition-shadow"
          onClick={() => setShowCreateModal(true)} 
          disabled={isCreating}
        >
          {isCreating ? "Initializing..." : "New Simulation"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>

        <Button 
          variant="outline" 
          size="lg" 
          className="w-full sm:w-auto h-14 px-8 text-base border-(--border-strong) hover:bg-(--bg-elevated)"
          asChild
        >
          <Link href="/dashboard">
            <GitBranch className="mr-2 h-4 w-4 text-(--text-secondary)" />
            Open Dashboard
          </Link>
        </Button>
      </div>

      {projectCount > 0 && (
        <div className="pt-8 flex items-center justify-center gap-2 text-sm text-(--text-muted) animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="h-3 w-3 text-yellow-500/70" />
          <span>You have {projectCount} active simulation{projectCount === 1 ? '' : 's'} running.</span>
        </div>
      )}
    </>
  );
}
