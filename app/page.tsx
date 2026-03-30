import { Orbit } from "lucide-react";
import { AppShell } from "@/components/ui/app-shell";
import { HomeActions } from "@/components/home/home-actions";
import { auth } from "@/lib/auth";
import { getStore } from "@/lib/server/store";

export default async function HomePage() {
  const session = await auth();
  
  let projectCount = 0;
  if (session?.user?.id) {
    try {
      const store = getStore();
      const projects = await store.listProjects();
      projectCount = projects.length;
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  }

  return (
    <AppShell>
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

          <HomeActions projectCount={projectCount} />
        </div>
      </div>
    </AppShell>
  );
}
