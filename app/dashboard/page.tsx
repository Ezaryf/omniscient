"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleCreateSimulation = async () => {
    setIsCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Simulation ${new Date().toLocaleTimeString()}`,
          description: "A new simulation created from the dashboard."
        })
      });

      const data = await res.json();
      if (data.project?.id) {
        if (data.branchId) {
          router.push(`/workspace?projectId=${data.project.id}&branchId=${data.branchId}`);
        } else {
          router.push(`/workspace?projectId=${data.project.id}`);
        }
      }
    } catch (err) {
      console.error("Failed to create simulation:", err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <a href="/" className="btn btn-ghost btn-sm">← Home</a>
        <h1>Dashboard</h1>
      </header>

      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <h2>Projects</h2>
          <button 
            className="btn btn-primary" 
            type="button" 
            id="btn-new-project"
            onClick={handleCreateSimulation}
            disabled={isCreating}
          >
            {isCreating ? "Creating..." : "+ New Simulation"}
          </button>
        </div>

        {loading ? (
          <div className="dashboard-loading">Loading...</div>
        ) : (
          <div className="dashboard-grid">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/workspace?projectId=${project.id}`}
                className="dashboard-card surface-elevated"
              >
                <h3>{project.name}</h3>
                <p>{project.description}</p>
                <div className="dashboard-card-actions">
                  <span className="tag">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </span>
                  <span className="btn btn-sm btn-ghost">Open →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-section">
        <h2>Quick Actions</h2>
        <div className="dashboard-actions">
          <Link href="/workspace" className="btn">🌐 Workspace</Link>
          <Link href="/compare" className="btn">🔀 Compare Branches</Link>
          <Link href="/insights" className="btn">💡 Insights</Link>
        </div>
      </section>

      <style jsx>{`
        .dashboard-page {
          max-width: 960px;
          margin: 0 auto;
          padding: var(--space-xl);
          display: flex;
          flex-direction: column;
          gap: var(--space-xl);
        }

        .dashboard-header {
          display: flex;
          align-items: center;
          gap: var(--space-md);
        }

        .dashboard-header h1 {
          font-size: 1.5rem;
        }

        .dashboard-section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-md);
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: var(--space-md);
        }

        .dashboard-card {
          display: block;
          padding: var(--space-lg);
          text-decoration: none;
          color: inherit;
          transition: all var(--transition-base);
        }

        .dashboard-card:hover {
          border-color: var(--accent-primary);
          transform: translateY(-2px);
        }

        .dashboard-card h3 {
          font-size: 1rem;
          margin-bottom: var(--space-xs);
        }

        .dashboard-card p {
          font-size: 0.8125rem;
          color: var(--text-muted);
          margin-bottom: var(--space-md);
        }

        .dashboard-card-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .dashboard-actions {
          display: flex;
          gap: var(--space-md);
        }

        .dashboard-loading {
          padding: var(--space-2xl);
          text-align: center;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
