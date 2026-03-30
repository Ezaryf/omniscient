"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, GitBranch, Layers3, Radar, Trash2 } from "lucide-react";
import { CreateSimulationModal } from "@/components/dashboard/create-simulation-modal";
import { AppShell } from "@/components/ui/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((response) => response.json())
      .then((data) => {
        setProjects(data.projects ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
    const confirmed = window.confirm(
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
      window.alert("Could not delete that campaign. Please try again.");
    } finally {
      setDeletingProjectId(null);
    }
  };

  return (
    <AppShell>
      <CreateSimulationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateSimulation}
      />

      <div className="page-frame flex flex-col gap-8">
        <header className="page-header">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/">
                  <ArrowLeft className="h-4 w-4" />
                  Home
                </Link>
              </Button>
              <Badge variant="accent">Campaign shelf</Badge>
            </div>
            <div className="space-y-2">
              <h1 className="page-title">Command your branching worlds.</h1>
              <p className="page-subtitle">
                Review active simulations, reopen volatile timelines, and move from library to
                setup to live branch control without losing the causal thread.
              </p>
            </div>
          </div>
          <Button variant="primary" size="lg" onClick={() => setShowCreateModal(true)} disabled={isCreating}>
            {isCreating ? "Creating..." : "New Campaign"}
          </Button>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_380px]">
          <Card className="border-[var(--border-strong)] bg-[var(--bg-dock)]">
            <CardHeader>
              <Badge variant="warning" className="w-fit">Latest timeline</Badge>
              <CardTitle className="text-3xl">{newestProject?.name ?? "No campaigns yet"}</CardTitle>
              <CardDescription>
                {newestProject?.description ??
                  "Create your first campaign to start tracking fronts, routes, branches, and map pressure."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="primary" onClick={() => setShowCreateModal(true)} disabled={isCreating}>
                {isCreating ? "Creating..." : "Start a fresh branch"}
              </Button>
              {newestProject ? (
                <Button variant="outline" asChild>
                  <Link href={`/workspace?projectId=${newestProject.id}`}>Open latest</Link>
                </Button>
              ) : (
                <Button variant="outline" asChild>
                  <Link href="/workspace">Open workspace</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {[
              { label: "Total campaigns", value: totalProjects, note: "Saved consequence timelines", icon: Layers3 },
              { label: "Created this week", value: thisWeekProjects, note: "Fresh branches and experiments", icon: GitBranch },
              { label: "GM focus", value: "System-agnostic", note: "Fronts, routes, pressure, fallout", icon: Radar },
            ].map((item) => (
              <Card key={item.label} className="bg-[var(--bg-panel)]">
                <CardContent className="flex items-start justify-between p-4">
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">{item.label}</div>
                    <div className="text-2xl font-semibold tracking-[-0.04em]">{item.value}</div>
                    <div className="text-sm text-[var(--text-secondary)]">{item.note}</div>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                    <item.icon className="h-5 w-5 text-[var(--accent-primary)]" />
                  </div>
                </CardContent>
              </Card>
            ))}
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

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="panel-shell h-56 animate-pulse bg-[var(--bg-panel)]" />
              ))}
            </div>
          ) : projects.length === 0 ? (
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
                <Card key={project.id} className="flex h-full flex-col justify-between">
                  <CardHeader className="gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="success">Live timeline</Badge>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        {formatDateLabel(project.createdAt)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <CardTitle className="text-xl">{project.name}</CardTitle>
                      <CardDescription className="line-clamp-4">{project.description}</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2 pt-0">
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
                      {deletingProjectId === project.id ? "Deleting..." : "Delete"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
