"use client";

import { useRef, useState, useCallback } from "react";
import { useSimulationStore } from "@/lib/stores/simulation-store";
import type { Agent, RelationshipEdge } from "@/lib/sim/types";

interface WorldCanvasProps {
  readonly agents: Agent[];
  readonly relationships: RelationshipEdge[];
  readonly selectedAgentId: string | null;
  readonly onSelectAgent: (agentId: string | null) => void;
}

const AGENT_RADIUS = 24;
const CANVAS_PADDING = 60;

const FACTION_COLORS: Record<string, string> = {
  "faction-sol": "#f59e0b",
  "faction-iron": "#ef4444",
  "faction-meridian": "#22c55e",
  "faction-guild": "#3b82f6",
  "faction-dawn": "#a855f7",
};

const STATUS_OPACITY: Record<string, number> = {
  alive: 1,
  dead: 0.2,
  inactive: 0.4,
  exiled: 0.3,
};

export function WorldCanvas({
  agents,
  relationships,
  selectedAgentId,
  onSelectAgent,
}: WorldCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 800, h: 600 });
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const { projections, showProjections } = useSimulationStore();

  // Pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
        e.preventDefault();
      }
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      const dx = (e.clientX - panStart.x) * (viewBox.w / 800);
      const dy = (e.clientY - panStart.y) * (viewBox.h / 600);
      setViewBox((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
    },
    [isPanning, panStart, viewBox.w, viewBox.h]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? 1.1 : 0.9;
    setViewBox((v) => {
      const newW = v.w * scaleFactor;
      const newH = v.h * scaleFactor;
      const dx = (v.w - newW) / 2;
      const dy = (v.h - newH) / 2;
      return { x: v.x + dx, y: v.y + dy, w: newW, h: newH };
    });
  }, []);

  // Click background to deselect
  const handleBgClick = useCallback(() => {
    onSelectAgent(null);
  }, [onSelectAgent]);

  const getTrustColor = (trust: number): string => {
    if (trust > 0.3) return "var(--rel-trust-positive)";
    if (trust < -0.3) return "var(--rel-trust-negative)";
    return "var(--text-muted)";
  };

  const getEdgeWidth = (tension: number): number => {
    return 1 + tension * 3;
  };

  return (
    <div
      ref={containerRef}
      className="world-canvas"
      style={{ gridArea: "canvas" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        onClick={handleBgClick}
      >
        {/* Grid pattern */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border-subtle)" strokeWidth="0.5" />
          </pattern>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect
          x={viewBox.x}
          y={viewBox.y}
          width={viewBox.w}
          height={viewBox.h}
          fill="url(#grid)"
        />

        {/* Relationship edges */}
        {relationships.map((rel) => {
          const source = agents.find((a) => a.id === rel.sourceAgentId);
          const target = agents.find((a) => a.id === rel.targetAgentId);
          if (!source || !target) return null;

          const isHighlighted =
            selectedAgentId === rel.sourceAgentId ||
            selectedAgentId === rel.targetAgentId;

          return (
            <g key={rel.id}>
              <line
                x1={source.position.x}
                y1={source.position.y}
                x2={target.position.x}
                y2={target.position.y}
                stroke={getTrustColor(rel.trust)}
                strokeWidth={getEdgeWidth(rel.tension)}
                opacity={isHighlighted ? 0.8 : 0.2}
                strokeDasharray={rel.trust < 0 ? "4 4" : "none"}
              />
              {/* Particle flow animation */}
              {isHighlighted && rel.trust !== 0 && (
                <circle r="2" fill={getTrustColor(rel.trust)}>
                  <animateMotion
                    dur={`${3 / (Math.abs(rel.trust) + 0.1)}s`}
                    repeatCount="indefinite"
                    path={`M ${source.position.x} ${source.position.y} L ${target.position.x} ${target.position.y}`}
                  />
                </circle>
              )}
            </g>
          );
        })}

        {/* Ghost Projections Layer */}
        {showProjections && projections.length > 0 && projections.at(-1)?.agents.map((ghost: any) => {
          const agent = agents.find(a => a.id === ghost.id);
          if (!agent) return null;
          const color = FACTION_COLORS[agent.factionId] ?? "var(--accent-primary)";
          
          return (
            <g key={`ghost-${ghost.id}`} transform={`translate(${ghost.position.x}, ${ghost.position.y})`} opacity="0.3">
               <circle
                  r={AGENT_RADIUS}
                  fill="none"
                  stroke={color}
                  strokeWidth="1"
                  strokeDasharray="4 2"
                />
                <circle r="2" fill={color} />
            </g>
          );
        })}

        {/* Agent nodes */}
        {agents.map((agent) => {
          const color = FACTION_COLORS[agent.factionId] ?? "var(--accent-primary)";
          const opacity = STATUS_OPACITY[agent.status] ?? 1;
          const isSelected = selectedAgentId === agent.id;
          const isHovered = hoveredAgent === agent.id;

          return (
            <g
              key={agent.id}
              transform={`translate(${agent.position.x}, ${agent.position.y})`}
              opacity={opacity}
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectAgent(agent.id);
              }}
              onMouseEnter={() => setHoveredAgent(agent.id)}
              onMouseLeave={() => setHoveredAgent(null)}
            >
              {/* Invisible Hit Area Padding */}
              <circle r={AGENT_RADIUS + 24} fill="transparent" />

              {/* Selection ring */}
              {isSelected && (
                <circle
                  r={AGENT_RADIUS + 6}
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  opacity="0.6"
                  filter="url(#glow)"
                />
              )}

              {/* Outer ring (influence indicator) */}
              <circle
                r={AGENT_RADIUS + 2}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                opacity={isHovered ? 0.8 : 0.3}
              />

              {/* Main circle */}
              <circle
                r={AGENT_RADIUS}
                fill={`${color}20`}
                stroke={color}
                strokeWidth={isSelected ? 2 : 1}
              />

              {/* Health indicator (inner arc) */}
              <circle
                r={AGENT_RADIUS - 4}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeDasharray={`${agent.state.health * 126} 126`}
                transform="rotate(-90)"
                opacity="0.6"
              />

              {/* Center dot */}
              <circle r="3" fill={color} />

              {/* Agent name label */}
              <text
                y={AGENT_RADIUS + 16}
                textAnchor="middle"
                fill="var(--text-primary)"
                fontSize="10"
                fontFamily="var(--font-sans)"
                fontWeight="500"
              >
                {agent.name.split(" ").pop()}
              </text>

              {/* Type label */}
              <text
                y={AGENT_RADIUS + 28}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize="8"
                fontFamily="var(--font-mono)"
                style={{ textTransform: "uppercase" }}
              >
                {agent.type}
              </text>

              {/* Hover tooltip */}
              {isHovered && (
                <foreignObject
                  x={AGENT_RADIUS + 10}
                  y={-40}
                  width="180"
                  height="80"
                >
                  <div className="agent-tooltip glass-elevated">
                    <strong>{agent.name}</strong>
                    <div className="agent-tooltip-stats">
                      <span>❤ {(agent.state.health * 100).toFixed(0)}%</span>
                      <span>⚡ {(agent.state.morale * 100).toFixed(0)}%</span>
                      <span>💰 {agent.state.wealth.toFixed(0)}</span>
                    </div>
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>

      <style jsx>{`
        .world-canvas {
          position: relative;
          overflow: hidden;
          background: var(--bg-deep);
          cursor: ${isPanning ? "grabbing" : "default"};
        }

        .world-canvas :global(.agent-tooltip) {
          padding: 8px 12px;
          border-radius: var(--radius-md);
          font-size: 11px;
          pointer-events: none;
        }

        .world-canvas :global(.agent-tooltip strong) {
          display: block;
          font-size: 12px;
          margin-bottom: 4px;
        }

        .world-canvas :global(.agent-tooltip-stats) {
          display: flex;
          gap: 8px;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}
