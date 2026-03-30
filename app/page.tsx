"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, GitBranch, Orbit, Sparkles } from "lucide-react";
import { CreateSimulationModal } from "@/components/dashboard/create-simulation-modal";
import { AppShell } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/button";

interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
    <AppShell>
      <CreateSimulationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateSimulation}
      />

      <div className="page-frame flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center py-20">
        <div className="flex flex-col items-center text-center max-w-3xl px-4 space-y-8">
          
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-(--border-strong) bg-(--bg-panel)/50 shadow-[0_0_40px_-10px_var(--accent-primary)]/20">
            <Orbit className="h-10 w-10 text-(--accent-primary) animate-pulse" />
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl font-semibold leading-[0.96] tracking-[-0.06em] md:text-7xl">
              Omniscient
            </h1>
            <p className="text-base uppercase tracking-[0.2em] text-(--text-muted)">
              Multi-Agent What-If Sandbox
            </p>
          </div>

          <p className="max-w-xl text-base leading-7 text-(--text-secondary) md:text-lg mx-auto">
            Create a tense world, define the opening rupture, and watch branches, relationships,
            fronts, and fallout evolve from the same simulation truth.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8 w-full max-w-md">
            <Button 
              variant="primary" 
              size="lg" 
              className="w-full sm:w-auto h-14 px-8 text-base shadow-[0_0_20px_-5px_var(--accent-primary)]/30 hover:shadow-[0_0_30px_-5px_var(--accent-primary)]/50 transition-shadow"
              onClick={() => setShowCreateModal(true)} 
              disabled={loading || isCreating}
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

          {!loading && projects.length > 0 && (
            <div className="pt-8 flex items-center gap-2 text-sm text-(--text-muted) animate-in fade-in slide-in-from-bottom-2">
              <Sparkles className="h-3 w-3 text-yellow-500/70" />
              <span>You have {projects.length} active simulation{projects.length > 1 ? 's' : ''} running.</span>
            </div>
          )}

        </div>
      </div>
    </AppShell>
  );
}
