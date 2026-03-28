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

export default function HomePage() {
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
          description: "A new simulation created from the landing page."
        })
      });

      const data = await res.json();
      if (data.project?.id) {
        router.push(`/workspace?projectId=${data.project.id}`);
      }
    } catch (err) {
      console.error("Failed to create simulation:", err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="landing-container">
      {/* Background glow */}
      <div className="landing-bg-glow" aria-hidden="true" />

      {/* Header */}
      <header className="landing-header">
        <div className="landing-logo">
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="16" cy="16" r="14" stroke="var(--accent-primary)" strokeWidth="2" />
            <circle cx="16" cy="16" r="6" fill="var(--accent-primary)" opacity="0.6" />
            <circle cx="16" cy="16" r="2" fill="var(--accent-primary)" />
            <path
              d="M16 2 L16 30 M2 16 L30 16"
              stroke="var(--accent-primary)"
              strokeWidth="0.5"
              opacity="0.3"
            />
          </svg>
          <span className="landing-logo-text">Omniscient</span>
        </div>
      </header>

      {/* Hero */}
      <main className="landing-main">
        <div className="landing-hero animate-fade-in">
          <h1 className="landing-title">
            Multi-Agent Simulation
            <span className="landing-title-accent"> Sandbox</span>
          </h1>
          <p className="landing-subtitle">
            Explore branching timelines, AI-driven agent behavior, and causal
            explanations in a graph-first workspace.
          </p>
        </div>

        {/* Projects grid */}
        <section className="landing-projects">
          <div className="landing-section-header">
            <h2>Your Simulations</h2>
            <button 
              className="btn btn-primary" 
              type="button" 
              onClick={handleCreateSimulation}
              disabled={isCreating}
            >
              {isCreating ? "Creating..." : "+ New Simulation"}
            </button>
          </div>

          {loading ? (
            <div className="landing-loading">
              <div className="landing-skeleton" />
              <div className="landing-skeleton" />
            </div>
          ) : projects.length === 0 ? (
            <div className="landing-empty surface-elevated">
              <p>No simulations yet. Create your first one to begin.</p>
            </div>
          ) : (
            <div className="landing-grid">
              {projects.map((project, i) => (
                <Link
                  key={project.id}
                  href={`/workspace?projectId=${project.id}`}
                  className="project-card surface-elevated animate-fade-in"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="project-card-header">
                    <h3>{project.name}</h3>
                    <span className="status-dot" data-status="active" />
                  </div>
                  <p className="project-card-desc">{project.description}</p>
                  <div className="project-card-meta">
                    <span className="tag">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Feature highlights */}
        <section className="landing-features">
          <div className="feature-card glass-elevated animate-fade-in">
            <div className="feature-icon">🌐</div>
            <h3>Graph-First World View</h3>
            <p>
              Agents as nodes, relationships as edges. Pan, zoom, and inspect
              your simulation world.
            </p>
          </div>
          <div
            className="feature-card glass-elevated animate-fade-in"
            style={{ animationDelay: "100ms" }}
          >
            <div className="feature-icon">🔀</div>
            <h3>Branching Timelines</h3>
            <p>
              Fork realities at any tick. Compare how different decisions unfold
              across parallel branches.
            </p>
          </div>
          <div
            className="feature-card glass-elevated animate-fade-in"
            style={{ animationDelay: "200ms" }}
          >
            <div className="feature-icon">🤖</div>
            <h3>AI-Driven Agents</h3>
            <p>
              Agents reason with AI, but the engine stays deterministic. Every
              action is explainable.
            </p>
          </div>
        </section>
      </main>

      <style jsx>{`
        .landing-container {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
        }

        .landing-bg-glow {
          position: fixed;
          top: -200px;
          left: 50%;
          transform: translateX(-50%);
          width: 800px;
          height: 600px;
          background: radial-gradient(
            ellipse at center,
            rgba(99, 102, 241, 0.08) 0%,
            rgba(168, 85, 247, 0.04) 40%,
            transparent 70%
          );
          pointer-events: none;
          z-index: 0;
        }

        .landing-header {
          position: sticky;
          top: 0;
          z-index: 10;
          padding: var(--space-md) var(--space-xl);
          background: rgba(5, 5, 8, 0.8);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border-subtle);
        }

        .landing-logo {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .landing-logo-text {
          font-size: 1.125rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, var(--text-primary), var(--accent-primary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .landing-main {
          position: relative;
          z-index: 1;
          max-width: 960px;
          margin: 0 auto;
          padding: var(--space-3xl) var(--space-xl);
        }

        .landing-hero {
          text-align: center;
          margin-bottom: var(--space-3xl);
        }

        .landing-title {
          font-size: 3rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.1;
          margin-bottom: var(--space-md);
        }

        .landing-title-accent {
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .landing-subtitle {
          font-size: 1.125rem;
          color: var(--text-secondary);
          max-width: 560px;
          margin: 0 auto;
          line-height: 1.6;
        }

        .landing-section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-lg);
        }

        .landing-projects {
          margin-bottom: var(--space-3xl);
        }

        .landing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: var(--space-md);
        }

        .project-card {
          display: block;
          padding: var(--space-lg);
          text-decoration: none;
          color: inherit;
          transition: all var(--transition-base);
        }

        .project-card:hover {
          border-color: var(--accent-primary);
          box-shadow: var(--shadow-glow);
          transform: translateY(-2px);
        }

        .project-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-sm);
        }

        .project-card-header h3 {
          font-size: 1rem;
        }

        .project-card-desc {
          font-size: 0.875rem;
          color: var(--text-muted);
          margin-bottom: var(--space-md);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .project-card-meta {
          display: flex;
          gap: var(--space-sm);
        }

        .landing-empty {
          padding: var(--space-2xl);
          text-align: center;
        }

        .landing-loading {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
        }

        .landing-skeleton {
          height: 120px;
          border-radius: var(--radius-lg);
          background: linear-gradient(
            90deg,
            var(--bg-surface) 25%,
            var(--bg-elevated) 50%,
            var(--bg-surface) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
        }

        .landing-features {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-md);
        }

        .feature-card {
          padding: var(--space-lg);
          border-radius: var(--radius-lg);
          text-align: center;
        }

        .feature-icon {
          font-size: 2rem;
          margin-bottom: var(--space-sm);
        }

        .feature-card h3 {
          font-size: 0.975rem;
          margin-bottom: var(--space-xs);
        }

        .feature-card p {
          font-size: 0.8125rem;
          color: var(--text-muted);
          line-height: 1.5;
        }

        @media (max-width: 768px) {
          .landing-title {
            font-size: 2rem;
          }
          .landing-features {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
