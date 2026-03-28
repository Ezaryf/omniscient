"use client";

import type { Agent, RelationshipEdge, SimEvent } from "@/lib/sim/types";

interface AgentInspectorProps {
  agent: Agent | null;
  relationships: RelationshipEdge[];
  recentEvents: SimEvent[];
  allAgents: Agent[];
  explanation?: {
    title: string;
    summary: string;
    confidence: number;
    generatedBy: string;
  } | null;
}

export function AgentInspector({
  agent,
  relationships,
  recentEvents,
  allAgents,
  explanation,
}: AgentInspectorProps) {
  if (!agent) {
    return (
      <div className="inspector" style={{ gridArea: "inspector" }}>
        <div className="inspector-empty">
          <div className="inspector-empty-icon">🔍</div>
          <p>Select an agent to inspect</p>
          <p className="inspector-hint">Click any node on the graph</p>
        </div>
        <style jsx>{inspectorStyles}</style>
      </div>
    );
  }

  const agentRels = relationships
    .filter(
      (r) => r.sourceAgentId === agent.id || r.targetAgentId === agent.id
    )
    .map((rel) => {
      const otherId =
        rel.sourceAgentId === agent.id
          ? rel.targetAgentId
          : rel.sourceAgentId;
      const other = allAgents.find((a) => a.id === otherId);
      return { ...rel, otherName: other?.name ?? otherId };
    });

  const agentEvents = recentEvents
    .filter(
      (e) => e.sourceAgentId === agent.id || e.targetAgentId === agent.id
    )
    .slice(-8);

  return (
    <div className="inspector animate-slide-in-right" style={{ gridArea: "inspector" }}>
      {/* Profile Header */}
      <div className="inspector-header">
        <div className="inspector-avatar">
          {agent.name.charAt(0)}
        </div>
        <div>
          <h3 className="inspector-name">{agent.name}</h3>
          <div className="inspector-meta">
            <span className="tag">{agent.type}</span>
            <span className="tag">{agent.factionId.replace("faction-", "")}</span>
            <span className={`tag tag-status-${agent.status}`}>{agent.status}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="inspector-section">
        <h4 className="inspector-section-title">Vitals</h4>
        <div className="inspector-stats">
          <StatBar label="Health" value={agent.state.health} color="var(--status-running)" />
          <StatBar label="Morale" value={agent.state.morale} color="var(--status-paused)" />
          <div className="inspector-stat-row">
            <span className="inspector-stat-label">Influence</span>
            <span className="mono">{agent.state.influence.toFixed(0)}</span>
          </div>
          <div className="inspector-stat-row">
            <span className="inspector-stat-label">Wealth</span>
            <span className="mono">{agent.state.wealth.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Goals */}
      <div className="inspector-section">
        <h4 className="inspector-section-title">Goals</h4>
        <div className="inspector-goals">
          {agent.goals.map((goal) => (
            <div key={goal.id} className="inspector-goal">
              <div className="inspector-goal-header">
                <span className="inspector-goal-label">{goal.label}</span>
                <span className={`tag tag-status-${goal.status}`}>{goal.status}</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${goal.progress * 100}%`,
                    background: `var(--accent-primary)`,
                  }}
                />
              </div>
              <span className="inspector-goal-priority">
                Priority: {(goal.priority * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Relationships */}
      <div className="inspector-section">
        <h4 className="inspector-section-title">Relationships</h4>
        <div className="inspector-relationships">
          {agentRels.map((rel) => (
            <div key={rel.id} className="inspector-rel">
              <span className="inspector-rel-name">{rel.otherName}</span>
              <div className="inspector-rel-bars">
                <MiniBar label="Trust" value={(rel.trust + 1) / 2} color={rel.trust > 0 ? "var(--rel-trust-positive)" : "var(--rel-trust-negative)"} />
                <MiniBar label="Tension" value={rel.tension} color="var(--rel-tension-high)" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Actions */}
      <div className="inspector-section">
        <h4 className="inspector-section-title">Recent Actions</h4>
        <div className="inspector-events">
          {agentEvents.length === 0 ? (
            <p className="inspector-empty-text">No events yet</p>
          ) : (
            agentEvents.map((event) => (
              <div key={event.id} className="inspector-event">
                <span className="inspector-event-tick mono">T{event.tick}</span>
                <span className="inspector-event-desc">{event.description}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Explanation */}
      {explanation && (
        <div className="inspector-section">
          <h4 className="inspector-section-title">
            💡 Why this happened
            <span className={`tag ${explanation.generatedBy === "ai" ? "tag-ai" : ""}`}>
              {explanation.generatedBy}
            </span>
          </h4>
          <div className="inspector-explanation glass">
            <p>{explanation.summary}</p>
            <div className="inspector-confidence">
              Confidence: {(explanation.confidence * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      )}

      <style jsx>{inspectorStyles}</style>
    </div>
  );
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="inspector-stat">
      <div className="inspector-stat-row">
        <span className="inspector-stat-label">{label}</span>
        <span className="mono">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{ width: `${value * 100}%`, background: color }}
        />
      </div>
    </div>
  );
}

function MiniBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="inspector-mini-bar">
      <span className="inspector-mini-label">{label}</span>
      <div className="progress-bar" style={{ height: 3 }}>
        <div
          className="progress-bar-fill"
          style={{ width: `${value * 100}%`, background: color }}
        />
      </div>
    </div>
  );
}

const inspectorStyles = `
  .inspector {
    grid-area: inspector;
    overflow-y: auto;
    padding: var(--space-md);
    border-left: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .inspector-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
    text-align: center;
    gap: var(--space-sm);
  }

  .inspector-empty-icon {
    font-size: 2rem;
    opacity: 0.5;
  }

  .inspector-hint {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .inspector-header {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .inspector-avatar {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-full);
    background: var(--accent-primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1.125rem;
    flex-shrink: 0;
  }

  .inspector-name {
    font-size: 1rem;
    margin-bottom: 4px;
  }

  .inspector-meta {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .inspector-section {
    padding-bottom: var(--space-md);
    border-bottom: 1px solid var(--border-subtle);
  }

  .inspector-section:last-child {
    border-bottom: none;
  }

  .inspector-section-title {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: var(--space-sm);
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .inspector-stats {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .inspector-stat-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.8125rem;
  }

  .inspector-stat-label {
    color: var(--text-secondary);
  }

  .inspector-goals {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .inspector-goal {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .inspector-goal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .inspector-goal-label {
    font-size: 0.8125rem;
    color: var(--text-primary);
  }

  .inspector-goal-priority {
    font-size: 0.6875rem;
    color: var(--text-muted);
  }

  .inspector-relationships {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .inspector-rel {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .inspector-rel-name {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .inspector-rel-bars {
    display: flex;
    gap: var(--space-md);
  }

  .inspector-mini-bar {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .inspector-mini-label {
    font-size: 0.625rem;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .inspector-events {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .inspector-event {
    display: flex;
    gap: var(--space-sm);
    font-size: 0.75rem;
    line-height: 1.4;
  }

  .inspector-event-tick {
    color: var(--text-muted);
    flex-shrink: 0;
    font-size: 0.6875rem;
  }

  .inspector-event-desc {
    color: var(--text-secondary);
  }

  .inspector-empty-text {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-style: italic;
  }

  .inspector-explanation {
    padding: var(--space-sm);
    border-radius: var(--radius-md);
    font-size: 0.8125rem;
    line-height: 1.5;
  }

  .inspector-explanation p {
    color: var(--text-secondary);
  }

  .inspector-confidence {
    margin-top: var(--space-xs);
    font-size: 0.6875rem;
    color: var(--text-muted);
  }

  .tag-status-alive { color: var(--status-running); }
  .tag-status-dead { color: var(--status-error); opacity: 0.6; }
  .tag-status-active { color: var(--status-running); }
  .tag-status-completed { color: var(--accent-primary); }
  .tag-status-blocked { color: var(--status-paused); }
  .tag-ai { background: rgba(99, 102, 241, 0.2); color: var(--accent-primary); }
`;
