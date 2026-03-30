"use client";

import { Suspense, useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { NarrativeCard } from "@/components/insights/narrative-card";
import { AppShell } from "@/components/ui/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildInsightCards } from "@/lib/sim/analysis";
import type { WorldState } from "@/lib/sim/types";

interface InsightBranch {
  id: string;
  name: string;
  currentTick: number;
}

function InsightsContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "proj-demo";
  const branchId = searchParams.get("branchId");
  const [branches, setBranches] = useState<InsightBranch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState(branchId ?? "");
  const [insights, setInsights] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/branches?projectId=${projectId}`)
      .then((response) => response.json())
      .then((data) => {
        const loadedBranches = data.branches ?? [];
        setBranches(loadedBranches);
        if (!activeBranchId && loadedBranches[0]?.id) {
          setActiveBranchId(loadedBranches[0].id);
        }
      })
      .catch(console.error);
  }, [activeBranchId, projectId]);

  useEffect(() => {
    if (!activeBranchId) return;

    fetch(`/api/branches/detail?id=${activeBranchId}`)
      .then((response) => response.json())
      .then((data) => {
        const worldState = data.branch?.latestState as WorldState | undefined;
        if (!worldState) return;

        setInsights(buildInsightCards(worldState));
      })
      .catch(console.error);
  }, [activeBranchId]);

  return (
    <AppShell>
      <div className="page-frame flex flex-col gap-8">
        <header className="page-header">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/">Back</Link>
              </Button>
              <Badge variant="accent">GM insights</Badge>
            </div>
            <div className="space-y-2">
              <h1 className="page-title">Surface the pressure that deserves prep.</h1>
              <p className="page-subtitle">
                Prep-facing warnings, causal chains, unstable relationships, and hidden pressure
                that explain where this branch is starting to bend.
              </p>
            </div>
          </div>
        </header>

        <Card className="bg-[var(--bg-dock)]">
          <CardContent className="flex flex-col gap-2 p-4 md:flex-row md:items-center">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-[var(--accent-primary)]" />
              <label htmlFor="branch-select" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Branch
              </label>
            </div>
            <select
              id="branch-select"
              value={activeBranchId}
              onChange={(event) => setActiveBranchId(event.target.value)}
              className="h-11 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-3 text-sm text-[var(--text-primary)] outline-none md:max-w-sm"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} (T{branch.currentTick})
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {insights.map((narrative, index) => (
            <NarrativeCard key={`${narrative.title}-${index}`} {...narrative} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function InsightsFallback() {
  return <div className="page-frame text-sm text-[var(--text-secondary)]">Loading insights...</div>;
}

export default function InsightsPage() {
  return (
    <Suspense fallback={<InsightsFallback />}>
      <InsightsContent />
    </Suspense>
  );
}
