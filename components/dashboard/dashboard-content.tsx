"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, GitBranch, Layers3, Radar, Trash2 } from "lucide-react";
import { CreateSimulationModal } from "@/components/dashboard/create-simulation-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function DashboardContent({ initialProjects }: { readonly initialProjects: Project[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const newestProject = projects[0] ?? null;
  const totalProjects = projects.length;
  const thisWeekProjects = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return projects.filter((project) => new Date(project.createdAt).getTime() >= weekAgo).length;
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
      `Delete "${project.name}"?\n\nThis removes its branches, snapshots, events, and notes.`
    );
    if (!confirmed) return;

    setDeletingProjectId(project.id);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to delete project: ${response.status}`);
      }

      setProjects((current) => current.filter((candidate) => candidate.id !== project.id));
    } catch (error) {
      console.error("Failed to delete campaign:", error);
      globalThis.alert("Could not delete that campaign. Please try again.");
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

      <div className="page-frame flex flex-col gap-8">
        <header className="page-header">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/">
                  <ArrowLeft className="h-4 w-4" />
                  Home
                </Link>
              </Button>
            </div>
            <h1 className="page-title">Command your branching worlds.</h1>
            <p className="page-subtitle">Track active simulations, reopen timelines, and manage branches.</p>
          </div>
          <Button variant="primary" size="lg" onClick={() => setShowCreateModal(true)} disabled={isCreating}>
            {isCreating ? "Creating..." : "New Campaign"}
          </Button>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_380px]">
          <Card className="border-(--border-strong) bg-(--bg-dock)">
            <CardHeader className="pb-4">
              <Badge variant="warning" className="w-fit">Latest</Badge>
              <CardTitle className="text-3xl pt-2">{newestProject?.name ?? "No campaigns yet"}</CardTitle>
            </CardHeader>
            <CardContent>
              {newestProject ? (
                <Button variant="primary" asChild>
                  <Link href={`/workspace?projectId=${newestProject.id}`}>Open</Link>
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setShowCreateModal(true)} disabled={isCreating}>
                  {isCreating ? "Creating..." : "Create campaign"}
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                <Layers3 className="h-4 w-4 text-[var(--accent-primary)]" />
              </div>
              <div>
                <div className="text-xl font-semibold tracking-[-0.04em]">{totalProjects}</div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Total</div>
              </div>
            </div>
            <div className="h-8 w-px bg-[var(--border-subtle)]" />
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                <GitBranch className="h-4 w-4 text-[var(--accent-primary)]" />
              </div>
              <div>
                <div className="text-xl font-semibold tracking-[-0.04em]">{thisWeekProjects}</div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">This week</div>
              </div>
            </div>
            <div className="h-8 w-px bg-[var(--border-subtle)]" />
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                <Radar className="h-4 w-4 text-[var(--accent-primary)]" />
              </div>
              <div>
                <div className="text-xl font-semibold tracking-[-0.04em]">GM</div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Focus</div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="page-kicker">Library</div>
              <h2 className="page-title text-2xl md:text-3xl">Campaign timelines</h2>
            </div>
            <div className="section-chip">{totalProjects} saved</div>
          </div>

          {projects.length === 0 ? (
            <EmptyState
              title="No campaign timelines yet"
              copy="Spin up your first simulation and start branching from an inciting consequence."
              action={
                <Button variant="primary" onClick={() => setShowCreateModal(true)} disabled={isCreating}>
                  Create first campaign
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <Card key={project.id} className="group flex h-full flex-col justify-between transition-colors hover:border-[var(--border-strong)]">
                  <CardHeader className="gap-2 pb-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        {formatDateLabel(project.createdAt)}
                      </span>
                    </div>
                    <CardTitle className="text-lg leading-tight">{project.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="mt-auto opacity-0 transition-opacity group-hover:opacity-100 pt-2">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/workspace?projectId=${project.id}`}>Open</Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/compare?projectId=${project.id}`}>Compare</Link>
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteSimulation(project)}
                        disabled={deletingProjectId === project.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
