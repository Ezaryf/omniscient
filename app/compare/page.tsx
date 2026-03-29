"use client";

import { Suspense, useEffect, useState } from "react";
import { ArrowLeftRight, GitCompareArrows } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BranchDiff } from "@/components/compare/branch-diff";
import { AppShell } from "@/components/ui/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

interface BranchOption {
  id: string;
  name: string;
  currentTick: number;
}

function CompareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const branchA = searchParams.get("branchA");
  const branchB = searchParams.get("branchB");
  const projectId = searchParams.get("projectId") ?? "proj-demo";
  const hasProjectContext = searchParams.has("projectId");

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedA, setSelectedA] = useState(branchA ?? "");
  const [selectedB, setSelectedB] = useState(branchB ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [diffData, setDiffData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/branches?projectId=${projectId}`)
      .then((response) => response.json())
      .then((data) => {
        const nextBranches = data.branches ?? [];
        setBranches(nextBranches);

        if (nextBranches.length === 0) return;

        setSelectedA((current) => current || branchA || nextBranches[0]?.id || "");
        setSelectedB((current) => {
          if (current) return current;
          if (branchB) return branchB;
          const fallback = nextBranches.find(
            (branch: BranchOption) => branch.id !== (branchA || nextBranches[0]?.id)
          );
          return fallback?.id ?? "";
        });
      })
      .catch(console.error);
  }, [branchA, branchB, projectId]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (selectedA) nextParams.set("branchA", selectedA);
    else nextParams.delete("branchA");

    if (selectedB) nextParams.set("branchB", selectedB);
    else nextParams.delete("branchB");

    router.replace(`/compare?${nextParams.toString()}`, { scroll: false });
  }, [router, searchParams, selectedA, selectedB]);

  const handleCompare = async () => {
    if (!selectedA || !selectedB || selectedA === selectedB) return;
    setIsLoading(true);

    try {
      const response = await fetch(`/api/compare?branchA=${selectedA}&branchB=${selectedB}`);
      const data = await response.json();
      setDiffData(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwap = () => {
    setSelectedA(selectedB);
    setSelectedB(selectedA);
  };

  return (
    <AppShell>
      <div className="page-frame flex flex-col gap-8">
        <header className="page-header">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {hasProjectContext ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/workspace?projectId=${projectId}`}>Back to workspace</Link>
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => router.back()} type="button">
                  Back
                </Button>
              )}
              <Badge variant="accent">Divergence inspector</Badge>
            </div>
            <div className="space-y-2">
              <h1 className="page-title">Compare timeline fallout with precision.</h1>
              <p className="page-subtitle">
                Choose two branches and inspect what each timeline preserved, destabilized, or left untouched.
              </p>
            </div>
          </div>
        </header>

        <Card className="bg-[var(--bg-dock)]">
          <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <label htmlFor="branch-a" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Branch A
              </label>
              <select
                id="branch-a"
                className="h-11 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-3 text-sm text-[var(--text-primary)] outline-none"
                value={selectedA}
                onChange={(event) => setSelectedA(event.target.value)}
              >
                <option value="">Select branch...</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} (T{branch.currentTick})
                  </option>
                ))}
              </select>
            </div>

            <Button variant="ghost" size="icon" onClick={handleSwap} type="button" disabled={!selectedA || !selectedB}>
              <ArrowLeftRight className="h-4 w-4" />
            </Button>

            <div className="space-y-2">
              <label htmlFor="branch-b" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Branch B
              </label>
              <select
                id="branch-b"
                className="h-11 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-3 text-sm text-[var(--text-primary)] outline-none"
                value={selectedB}
                onChange={(event) => setSelectedB(event.target.value)}
              >
                <option value="">Select branch...</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} (T{branch.currentTick})
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="primary"
              onClick={handleCompare}
              disabled={!selectedA || !selectedB || selectedA === selectedB}
              type="button"
              id="btn-compare"
            >
              <GitCompareArrows className="h-4 w-4" />
              Compare
            </Button>
          </CardContent>
        </Card>

        {branches.length >= 2 ? (
          <div className="flex flex-wrap gap-3">
            {branches.map((branch) => {
              const state = branch.id === selectedA ? "accent" : branch.id === selectedB ? "warning" : "default";

              return (
                <button
                  key={branch.id}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-4 py-3 text-left transition hover:border-[var(--border-strong)]"
                  onClick={() => {
                    if (!selectedA || branch.id === selectedB) {
                      setSelectedA(branch.id);
                      return;
                    }

                    if (!selectedB || branch.id === selectedA) {
                      setSelectedB(branch.id);
                      return;
                    }

                    setSelectedB(branch.id);
                  }}
                  type="button"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={state as any}>{state === "accent" ? "A" : state === "warning" ? "B" : "idle"}</Badge>
                    <strong className="text-sm">{branch.name}</strong>
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">T{branch.currentTick}</div>
                </button>
              );
            })}
          </div>
        ) : null}

        {isLoading ? (
          <Card className="bg-[var(--bg-dock)]">
            <CardContent className="flex items-center gap-3 p-6 text-sm text-[var(--text-secondary)]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border-subtle)] border-t-[var(--accent-primary)]" />
              Replaying timelines...
            </CardContent>
          </Card>
        ) : null}

        {diffData && !isLoading ? (
          <BranchDiff branchA={diffData.branchA} branchB={diffData.branchB} divergence={diffData.divergence} />
        ) : null}

        {!diffData && !isLoading ? (
          branches.length < 2 ? (
            <EmptyState
              title="Create at least two branches first"
              copy="Open the workspace, fork from an event or create a branch, then compare the fallout here."
              action={
                <Button variant="primary" asChild>
                  <Link href={`/workspace?projectId=${projectId}`}>Go to workspace</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="Select two branches to compare"
              copy="The divergence inspector will show branch contrast, changed fronts, route outcomes, and actor deltas."
            />
          )
        ) : null}
      </div>
    </AppShell>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="page-frame text-sm text-[var(--text-secondary)]">Loading compare view...</div>}>
      <CompareContent />
    </Suspense>
  );
}
