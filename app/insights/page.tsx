"use client";

import { useState } from "react";
import { NarrativeCard } from "@/components/insights/narrative-card";

export default function InsightsPage() {
  const [narratives] = useState([
    {
      title: "The Fractured Realms — Opening Moves",
      summary:
        "The simulation begins with five factions in an uneasy balance. Empress Katara of Sol commands the most loyalty, while Warlord Drask's Iron faction poses the greatest military threat. Ambassador Liyen works tirelessly for peace, but rising tensions between Sol and Iron may render diplomacy moot.",
      evidence: [
        "Katara–Drask trust at -0.4 indicates historical conflict",
        "Liyen's peace negotiation goal at 95% priority",
        "Drask's military resources (150) exceed all others combined",
      ],
      confidence: 0.65,
      generatedBy: "heuristic" as const,
      tick: 0,
    },
    {
      title: "Spymaster Vex — The Shadow War",
      summary:
        "Vex's infiltration of the Iron faction has reached 60% progress, making them the most advanced in their primary objective. Their extremely low trust with Drask (-0.6) combined with high tension (0.8) suggests discovery is imminent, which could trigger a crisis.",
      evidence: [
        "Vex–Drask tension at 0.8 (highest in simulation)",
        "Infiltration goal at 60% progress",
        "Vex's resourcefulness trait at 0.95",
      ],
      confidence: 0.55,
      generatedBy: "heuristic" as const,
      tick: 0,
    },
  ]);

  return (
    <div className="insights-page">
      <header className="insights-header">
        <a href="/" className="btn btn-ghost btn-sm">← Back</a>
        <h1>Narrative Insights</h1>
        <p className="insights-subtitle">
          AI-generated and heuristic summaries of your simulation's evolving story
        </p>
      </header>

      <div className="insights-grid">
        {narratives.map((narrative, i) => (
          <NarrativeCard key={`narrative-${i}`} {...narrative} />
        ))}
      </div>

      <style jsx>{`
        .insights-page {
          max-width: 800px;
          margin: 0 auto;
          padding: var(--space-xl);
          display: flex;
          flex-direction: column;
          gap: var(--space-xl);
        }

        .insights-header h1 {
          font-size: 1.5rem;
          margin-top: var(--space-sm);
        }

        .insights-subtitle {
          font-size: 0.875rem;
          color: var(--text-muted);
        }

        .insights-grid {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
        }
      `}</style>
    </div>
  );
}
