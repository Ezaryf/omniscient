"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, GitBranch, Orbit, Radar, Sparkles } from "lucide-react";
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

      <div className="page-frame flex flex-col gap-10">
        <header className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--bg-panel)]">
              <Orbit className="h-5 w-5 text-[var(--accent-primary)]" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-[-0.03em]">Omniscient</div>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">GM consequence engine</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button variant="primary" onClick={() => setShowCreateModal(true)} disabled={isCreating}>
              {isCreating ? "Creating..." : "New Simulation"}
            </Button>
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_380px]">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="accent">OLED command center</Badge>
              <Badge>Branching causality</Badge>
              <Badge>GM-first prep</Badge>
            </div>
            <div className="max-w-4xl space-y-5">
              <h1 className="text-5xl font-semibold leading-[0.96] tracking-[-0.06em] md:text-7xl">
                Build a living campaign
                <span className="block text-[var(--text-secondary)]">from consequences, not cards.</span>
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[var(--text-secondary)] md:text-lg">
                Start with a title, launch guided setup, and let Omniscient turn an inciting rupture
                into fronts, routes, branches, and next-session fallout across the map.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" size="lg" onClick={() => setShowCreateModal(true)} disabled={isCreating}>
                Open Campaign Setup
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/dashboard">Browse Timelines</Link>
              </Button>
            </div>
          </div>

          <Card className="border-[var(--border-strong)] bg-[var(--bg-dock)]">
            <CardHeader>
              <Badge variant="warning" className="w-fit">Why it feels different</Badge>
              <CardTitle className="text-2xl">A premium GM cockpit, not a wiki.</CardTitle>
              <CardDescription>
                Every view is tuned around branch pressure, map consequence, and session prep clarity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  icon: Radar,
                  title: "Campaign map intelligence",
                  copy: "Regions, routes, fronts, and actors stay visible without collapsing into clutter.",
                },
                {
                  icon: GitBranch,
                  title: "True divergence tracking",
                  copy: "Fork from a single consequence and compare exactly what survives in each branch.",
                },
                {
                  icon: Sparkles,
                  title: "Prep-forward insight",
                  copy: "Surface weak routes, volatile fronts, and intervention points before the table gets there.",
                },
              ].map((feature) => (
                <div key={feature.title} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                      <feature.icon className="h-4 w-4 text-[var(--accent-primary)]" />
                    </div>
                    <div className="text-sm font-semibold">{feature.title}</div>
                  </div>
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">{feature.copy}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="page-kicker">Your simulations</div>
              <h2 className="page-title text-2xl md:text-3xl">Resume a timeline</h2>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">Open full dashboard</Link>
            </Button>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="panel-shell h-40 animate-pulse bg-[var(--bg-panel)]" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <EmptyState
              title="No simulations yet"
              copy="Create your first campaign and the workspace will open in guided setup mode."
              action={
                <Button variant="primary" onClick={() => setShowCreateModal(true)} disabled={isCreating}>
                  Create a timeline
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <Link key={project.id} href={`/workspace?projectId=${project.id}`} className="group">
                  <Card className="h-full border-[var(--border-subtle)] transition-all duration-150 group-hover:border-[var(--border-strong)] group-hover:bg-[var(--bg-elevated)]">
                    <CardHeader className="gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-lg">{project.name}</CardTitle>
                        <Badge variant="success">Live</Badge>
                      </div>
                      <CardDescription className="line-clamp-3">{project.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between pt-0 text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                      <span className="text-[var(--accent-primary)]">Open timeline</span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
