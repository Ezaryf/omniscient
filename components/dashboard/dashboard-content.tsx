"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  Clock,
  GitBranch,
  Layers3,
  Plus,
  Radar,
  Search,
  Trash2,
  Zap,
} from "lucide-react";
import { CreateSimulationModal } from "@/components/dashboard/create-simulation-modal";
import { Button } from "@/components/ui/button";

interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function DashboardContent({
  initialProjects,
}: {
  readonly initialProjects: Project[];
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteToast, setDeleteToast] = useState<string | null>(null);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      total: projects.length,
      thisWeek: projects.filter(
        (p) => new Date(p.createdAt).getTime() >= weekAgo
      ).length,
      latest: projects[0] ?? null,
    };
  }, [projects]);

  const handleCreateSimulation = async (name: string, description: string) => {
    setIsCreating(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const data = await response.json();
      if (data.project?.id) {
        router.push(
          data.branchId
            ? `/workspace?projectId=${data.project.id}&branchId=${data.branchId}&setup=1`
            : `/workspace?projectId=${data.project.id}&setup=1`
        );
      }
    } catch (error) {
      console.error("Failed to create campaign:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSimulation = async (project: Project) => {
    const confirmed = globalThis.confirm(
      `Delete "${project.name}"?\n\nThis will permanently remove all branches, snapshots, events, and notes.`
    );
    if (!confirmed) return;

    setDeletingProjectId(project.id);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error || `Delete failed with status ${response.status}`
        );
      }

      setProjects((cur) => cur.filter((p) => p.id !== project.id));
      setDeleteToast(`"${project.name}" deleted`);
      setTimeout(() => setDeleteToast(null), 3000);
    } catch (error) {
      console.error("Delete failed:", error);
      globalThis.alert(
        `Could not delete "${project.name}".\n\n${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setDeletingProjectId(null);
    }
  };

  return (
    <>
      <CreateSimulationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateSimulation}
      />

      {/* Delete toast */}
      {deleteToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/80 px-4 py-3 text-sm text-emerald-300 shadow-lg backdrop-blur-sm">
            ✓ {deleteToast}
          </div>
        </div>
      )}

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-0 px-6 py-8">
        {/* ═══════════════ HEADER ═══════════════ */}
        <header className="mb-10">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Link
                  href="/"
                  className="text-xs font-medium uppercase tracking-[0.2em] text-white/30 transition-colors hover:text-white/60"
                >
                  Omniscient
                </Link>
                <span className="text-white/15">/</span>
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/50">
                  Dashboard
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-white">
                Simulations
              </h1>
              <p className="mt-1 text-sm text-white/40">
                {stats.total === 0
                  ? "Create your first simulation to begin."
                  : `${stats.total} simulation${stats.total !== 1 ? "s" : ""} — ${stats.thisWeek} this week`}
              </p>
            </div>

            <Button
              variant="primary"
              size="lg"
              onClick={() => setShowCreateModal(true)}
              disabled={isCreating}
              className="shrink-0 gap-2"
            >
              <Plus className="h-4 w-4" />
              {isCreating ? "Creating..." : "New Simulation"}
            </Button>
          </div>
        </header>

        {/* ═══════════════ HERO CARD (latest project) ═══════════════ */}
        {stats.latest && (
          <section className="mb-8">
            <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent p-6 transition-all duration-300 hover:border-white/[0.1] hover:from-white/[0.06]">
              {/* Accent glow */}
              <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-blue-500/[0.06] blur-3xl" />
              <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-cyan-500/[0.04] blur-3xl" />

              <div className="relative flex items-start justify-between gap-6">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/20 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-blue-300">
                      <Zap className="h-3 w-3" />
                      Latest
                    </span>
                    <span className="text-xs text-white/30">
                      {timeAgo(stats.latest.createdAt)}
                    </span>
                  </div>
                  <h2 className="mb-2 text-2xl font-bold tracking-[-0.03em] text-white">
                    {stats.latest.name}
                  </h2>
                  {stats.latest.description && (
                    <p className="mb-4 max-w-xl text-sm leading-relaxed text-white/40">
                      {stats.latest.description.length > 160
                        ? `${stats.latest.description.slice(0, 160)}…`
                        : stats.latest.description}
                    </p>
                  )}
                  <Button variant="primary" size="sm" asChild className="gap-2">
                    <Link
                      href={`/workspace?projectId=${stats.latest.id}`}
                    >
                      Open Workspace
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>

                {/* Stats cluster */}
                <div className="hidden shrink-0 sm:flex sm:items-center sm:gap-6">
                  <StatPill
                    icon={<Layers3 className="h-4 w-4" />}
                    value={stats.total}
                    label="Total"
                  />
                  <div className="h-8 w-px bg-white/[0.06]" />
                  <StatPill
                    icon={<GitBranch className="h-4 w-4" />}
                    value={stats.thisWeek}
                    label="This week"
                  />
                  <div className="h-8 w-px bg-white/[0.06]" />
                  <StatPill
                    icon={<Radar className="h-4 w-4" />}
                    value={stats.total}
                    label="Active"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════ SEARCH BAR ═══════════════ */}
        {projects.length > 1 && (
          <div className="mb-6">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
              <input
                type="text"
                placeholder="Search simulations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] pl-10 pr-4 text-sm text-white placeholder-white/25 outline-none transition-colors focus:border-white/[0.12] focus:bg-white/[0.04]"
              />
            </div>
          </div>
        )}

        {/* ═══════════════ PROJECT GRID ═══════════════ */}
        {filteredProjects.length === 0 && projects.length === 0 ? (
          <EmptyDashboard onCreateClick={() => setShowCreateModal(true)} />
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.04] bg-white/[0.01] py-16">
            <Search className="mb-3 h-8 w-8 text-white/15" />
            <p className="text-sm text-white/30">
              No simulations match &ldquo;{searchQuery}&rdquo;
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={() => handleDeleteSimulation(project)}
                isDeleting={deletingProjectId === project.id}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════ */

function StatPill({
  icon,
  value,
  label,
}: {
  readonly icon: React.ReactNode;
  readonly value: number;
  readonly label: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-blue-400">
        {icon}
      </div>
      <div>
        <div className="text-lg font-bold tracking-tight text-white">
          {value}
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">
          {label}
        </div>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  onDelete,
  isDeleting,
}: {
  readonly project: Project;
  readonly onDelete: () => void;
  readonly isDeleting: boolean;
}) {
  return (
    <div className="group relative flex flex-col justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 transition-all duration-200 hover:border-white/[0.1] hover:bg-white/[0.04]">
      {/* Header */}
      <div className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-white/25">
            <Calendar className="h-3 w-3" />
            <span className="text-[11px] font-medium">
              {formatDate(project.createdAt)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-white/20">
            <Clock className="h-3 w-3" />
            <span className="text-[10px]">{timeAgo(project.createdAt)}</span>
          </div>
        </div>
        <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-white">
          {project.name}
        </h3>
        {project.description && (
          <p className="mt-1.5 text-xs leading-relaxed text-white/30">
            {project.description.length > 100
              ? `${project.description.slice(0, 100)}…`
              : project.description}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="mt-auto flex items-center gap-2 border-t border-white/[0.04] pt-3">
        <Link
          href={`/workspace?projectId=${project.id}`}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-medium text-white/70 transition-colors hover:border-white/[0.15] hover:bg-white/[0.08] hover:text-white"
        >
          Open
          <ArrowRight className="h-3 w-3" />
        </Link>
        <Link
          href={`/compare?projectId=${project.id}`}
          className="inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium text-white/30 transition-colors hover:bg-white/[0.04] hover:text-white/60"
        >
          Compare
        </Link>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          disabled={isDeleting}
          className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-white/20 transition-all hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
          title="Delete simulation"
        >
          {isDeleting ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-red-400/30 border-t-red-400" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

function EmptyDashboard({
  onCreateClick,
}: {
  readonly onCreateClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.06] bg-white/[0.01] py-20">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">
        <Layers3 className="h-6 w-6 text-white/20" />
      </div>
      <h3 className="mb-1 text-lg font-semibold tracking-tight text-white/80">
        No simulations yet
      </h3>
      <p className="mb-6 max-w-sm text-center text-sm text-white/30">
        Create your first simulation to start branching timelines, injecting
        consequences, and exploring alternate outcomes.
      </p>
      <Button
        variant="primary"
        onClick={onCreateClick}
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        Create First Simulation
      </Button>
    </div>
  );
}
