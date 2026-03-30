import { AppShell } from "@/components/ui/app-shell";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { auth } from "@/lib/auth";
import { getStore } from "@/lib/server/store";

export default async function DashboardPage() {
  const session = await auth();
  
  let projects: {
    id: string;
    name: string;
    description: string;
    createdAt: string;
  }[] = [];

  if (session?.user?.id) {
    try {
      const store = getStore();
      projects = await store.listProjects();
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  }

  return (
    <AppShell>
      <DashboardContent initialProjects={projects} />
    </AppShell>
  );
}
