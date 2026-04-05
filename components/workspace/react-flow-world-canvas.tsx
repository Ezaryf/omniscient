"use client";

import "@xyflow/react/dist/style.css";

import React, { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeChange,
  type OnNodeDrag,
  type NodeMouseHandler,
  type ReactFlowInstance,
  useNodesState,
} from "@xyflow/react";
import {
  Castle,
  CircleDot,
  Crosshair,
  FlagTriangleRight,
  Hand,
  Link2,
  MapPinned,
  Maximize,
  MousePointer2,
  Plus,
  RotateCcw,
  Shield,
  Sparkles,
  Trash2,
  UserRound,
  Waypoints,
  Zap,
} from "lucide-react";
import type {
  Agent,
  BoardGroup,
  BoardLink,
  BoardLinkType,
  BoardSelection,
  CampaignNode,
  FrontClock,
  MapLayer,
  Position,
  RelationshipEdge,
} from "@/lib/sim/types";
import { computeTieredLayout, needsAutoLayout } from "@/lib/sim/graph-layout";
import type { BoardTool, WorldCanvasHandle, WorldCanvasUiState } from "@/components/workspace/world-canvas";
import { useSimulationStore } from "@/lib/stores/simulation-store";
import { nodeTypes, type WorldNodeData } from "./canvas-nodes";
import { useCanvasNodes, type ClusterDisplay } from "./useCanvasNodes";
import { useCanvasEdges } from "./useCanvasEdges";

type AddMode = "none" | "agent" | "place" | "faction" | "front" | "event";
type ConnectableSelection = { type: "agent" | "campaignNode" | "region" | "site" | "front"; id: string };
const CONNECT_ARMED = "__armed__";

type ViewportState = { x: number; y: number; zoom: number };
type BoardGroupSemanticHint = BoardGroup["semanticHint"];

interface ReactFlowWorldCanvasProps {
  readonly agents: Agent[];
  readonly boardLinks: BoardLink[];
  readonly boardGroups: BoardGroup[];
  readonly campaignNodes: CampaignNode[];
  readonly relationships: RelationshipEdge[];
  readonly map: MapLayer;
  readonly fronts: FrontClock[];
  readonly selectedEntity: BoardSelection | null;
  readonly onSelectEntity: (selection: BoardSelection | null) => void;
  readonly onMoveToken: (tokenId: string, patch: { x: number; y: number; regionId?: string | null; siteId?: string | null }) => Promise<void>;
  readonly onMoveSite: (siteId: string, patch: { x: number; y: number; regionId?: string | null }) => Promise<void>;
  readonly onMoveRegion: (regionId: string, patch: { x: number; y: number }) => Promise<void>;
  readonly onResizeRegion: (regionId: string, radius: number) => Promise<void>;
  readonly onMoveAgent: (agentId: string, patch: { x: number; y: number }) => Promise<void>;
  readonly onMoveCampaignNode: (nodeId: string, patch: { x?: number; y?: number; radius?: number }) => Promise<void>;
  readonly onCreateRegion: (payload: { name: string; kind: "frontier" | "homeland" | "wilds" | "city-state" | "sea"; x: number; y: number; radius?: number }) => Promise<void>;
  readonly onCreateSite: (payload: { name: string; kind: "waypoint" | "capital" | "stronghold" | "market" | "ruin" | "sanctum"; x: number; y: number; regionId?: string | null }) => Promise<void>;
  readonly onCreateToken: (payload: { name: string; kind: "party" | "faction" | "threat"; x: number; y: number; regionId?: string | null; siteId?: string | null }) => Promise<void>;
  readonly onCreateRoute: (payload: { name: string; fromSiteId: string; toSiteId: string }) => Promise<void>;
  readonly onCreateBoardLink: (payload: {
    linkType: BoardLinkType;
    source: { type: "agent" | "campaignNode" | "region" | "site" | "front"; id: string };
    target: { type: "agent" | "campaignNode" | "region" | "site" | "front"; id: string };
    label?: string | null;
  }) => Promise<void>;
  readonly onCreateBoardGroup: (payload: {
    name: string;
    polygon: Position[];
    memberNodeIds: string[];
    semanticHint?: BoardGroupSemanticHint;
    accent?: string | null;
    tone?: string | null;
    label?: string | null;
  }) => Promise<void>;
  readonly onUpdateBoardGroupPolygon: (payload: {
    groupId: string;
    polygon: Position[];
    name?: string;
    memberNodeIds?: string[];
    semanticHint?: BoardGroupSemanticHint;
    accent?: string | null;
    tone?: string | null;
    label?: string | null;
  }) => Promise<void>;
  readonly onCreateCampaignNode: (payload: {
    name: string;
    kind: "agent" | "faction" | "front" | "event" | "place";
    x: number;
    y: number;
    regionId?: string | null;
    siteId?: string | null;
  }) => Promise<void>;
  readonly onUpdateCampaignNode: (nodeId: string, patch: { name?: string; description?: string; status?: string; tags?: string[]; metrics?: Record<string, number> }) => Promise<void>;
  readonly onUpdateAgent: (agentId: string, patch: { name?: string; description?: string }) => Promise<void>;
  readonly onUpdateBoardLink: (linkId: string, patch: { linkType?: BoardLinkType; label?: string | null }) => Promise<void>;
  readonly onRequestDeleteSelection: (selection: BoardSelection | null) => void;
  readonly initialTool?: BoardTool;
  readonly onToolStateChange?: (state: WorldCanvasUiState) => void;
  readonly layoutPositions?: Map<string, { x: number; y: number }>;
  readonly onDraggingChange?: (dragging: boolean) => void;
}

const GRID_SIZE = 80;

function flowNodeId(type: string, id: string) {
  return `${type}:${id}`;
}

function findNearestRegion(map: MapLayer, pos: Position) {
  let best: { id: string } | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const region of map.regions) {
    const d = Math.hypot(region.center.x - pos.x, region.center.y - pos.y);
    if (d < bestD) {
      best = region;
      bestD = d;
    }
  }
  return best;
}

function findNearestSite(map: MapLayer, pos: Position) {
  let best: { id: string; position: Position } | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const site of map.sites) {
    const d = Math.hypot(site.position.x - pos.x, site.position.y - pos.y);
    if (d < bestD) {
      best = site;
      bestD = d;
    }
  }
  return best;
}

function flowPosition(position: Position, layoutPositions?: Map<string, { x: number; y: number }> | null, nodeId?: string) {
  if (nodeId && layoutPositions?.has(nodeId)) {
    const layoutPos = layoutPositions.get(nodeId)!;
    return { x: layoutPos.x, y: layoutPos.y };
  }
  return { x: position.x, y: position.y };
}

function selectionToFlowId(selection: BoardSelection | null) {
  if (!selection) return null;
  if (["agent", "campaignNode", "region", "site", "front", "token"].includes(selection.type)) {
    return flowNodeId(selection.type, (selection as any).id);
  }
  if (selection.type === "boardLink") return `boardLink:${selection.id}`;
  if (selection.type === "route") return `route:${selection.id}`;
  return null;
}

const ADD_TOOL_CONFIG: Array<{ tool: Exclude<BoardTool, "inspect" | "move" | "connect" | "delete">; label: string; icon: any }> = [
  { tool: "agent", label: "Actor", icon: UserRound },
  { tool: "faction", label: "Faction", icon: Shield },
  { tool: "front", label: "Front", icon: FlagTriangleRight },
  { tool: "event", label: "Event", icon: Sparkles },
  { tool: "place", label: "Place", icon: Castle },
];

const EDGE_TONE: Record<string, { stroke: string; glow: string }> = {
  route: { stroke: "#38bdf8", glow: "#38bdf822" },
  causal: { stroke: "#f59e0b", glow: "#f59e0b22" },
  alliance: { stroke: "#22c55e", glow: "#22c55e22" },
  conflict: { stroke: "#ef4444", glow: "#ef444422" },
  dependency: { stroke: "#cbd5e1", glow: "#cbd5e122" },
};

const BOARD_LINK_LEGEND: Array<{ type: BoardLinkType; label: string }> = [
  { type: "alliance", label: "Ally" },
  { type: "conflict", label: "Foe" },
  { type: "causal", label: "Influence" },
  { type: "dependency", label: "Dependency" },
];

function boardLinkTypeLabel(type: BoardLinkType) {
  return BOARD_LINK_LEGEND.find((entry) => entry.type === type)?.label ?? type;
}

function nodeTypeForKind(kind: string | undefined): string {
  switch (kind) {
    case "faction": return "faction";
    case "front":
    case "event": return "conflict";
    case "agent": return "actor";
    case "region":
    case "site":
    case "route":
    case "place":
    case "party": return "infra";
    default: return "entity";
  }
}

function accentFor(kind: string) {
  switch (kind) {
    case "agent": return "#38bdf8";
    case "faction": return "#2dd4bf";
    case "front": return "#f59e0b";
    case "event": return "#fb7185";
    case "place": return "#34d399";
    case "region": return "#14b8a6";
    case "site": return "#c084fc";
    default: return "#94a3b8";
  }
}

function centroid(points: Position[]) {
  if (points.length === 0) return { x: 0, y: 0 };
  const total = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: total.x / points.length, y: total.y / points.length };
}

function pointInPolygon(point: Position, polygon: Position[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / Math.max(yj - yi, 0.0001) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function toScreen(point: Position, viewport: ViewportState) {
  return {
    x: point.x * viewport.zoom + viewport.x,
    y: point.y * viewport.zoom + viewport.y,
  };
}

function toFlow(point: Position, viewport: ViewportState) {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  };
}

function hull(points: Position[]) {
  if (points.length <= 2) return points;
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (o: Position, a: Position, b: Position) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Position[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper: Position[] = [];
  for (const point of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }
  upper.pop();
  lower.pop();
  return [...lower, ...upper];
}

function expandPolygon(points: Position[], padding = 54) {
  const center = centroid(points);
  return points.map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const length = Math.hypot(dx, dy) || 1;
    return {
      x: point.x + (dx / length) * padding,
      y: point.y + (dy / length) * padding,
    };
  });
}

function inferBoardGroups(
  campaignNodes: CampaignNode[],
  boardLinks: BoardLink[],
  displayPositions?: Map<string, { x: number; y: number }> | null,
) {
  const nodeMap = new Map(campaignNodes.map((node) => [node.id, node]));
  const graph = new Map<string, Set<string>>();
  for (const link of boardLinks) {
    if (link.source.type !== "campaignNode" || link.target.type !== "campaignNode") continue;
    const nextA = graph.get(link.source.id) ?? new Set<string>();
    nextA.add(link.target.id);
    graph.set(link.source.id, nextA);
    const nextB = graph.get(link.target.id) ?? new Set<string>();
    nextB.add(link.source.id);
    graph.set(link.target.id, nextB);
  }

  const visited = new Set<string>();
  const inferred: BoardGroup[] = [];
  for (const nodeId of graph.keys()) {
    if (visited.has(nodeId)) continue;
    const queue = [nodeId];
    const cluster: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      cluster.push(current);
      for (const neighbor of graph.get(current) ?? []) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }
    if (cluster.length < 3) continue;
    const points = cluster
      .map((id) => nodeMap.get(id))
      .filter((node): node is CampaignNode => Boolean(node))
      .map((node) => displayPositions?.get(flowNodeId("campaignNode", node.id)) ?? node.position);
    if (points.length < 3) continue;
    const polygon = expandPolygon(hull(points));
    inferred.push({
      id: `inferred:${cluster.slice().sort().join("|")}`,
      name: nodeMap.get(cluster[0])?.name ? `${nodeMap.get(cluster[0])!.name} cluster` : "Inferred cluster",
      polygon,
      memberNodeIds: cluster.sort().map((id) => flowNodeId("campaignNode", id)),
      semanticHint: "same-origin",
      accent: "#22d3ee",
      tone: "inferred",
      label: null,
      derivedFrom: "inferred",
      tags: ["inferred"],
    });
  }
  return inferred;
}

// --- Sub-components for UI Panels ---

interface ToolbarProps {
  tool: BoardTool;
  onSetTool: (tool: BoardTool) => void;
  onAdd: (type: AddMode) => void;
  onFit: () => void;
  onReset: () => void;
}

const TOOL_LABELS: Record<string, string> = {
  inspect: "Inspect",
  move: "Move",
  connect: "Connect",
  delete: "Delete",
  agent: "Add Actor",
  faction: "Add Faction",
  front: "Add Front",
  event: "Add Event",
  place: "Add Place",
  site: "Add Site",
  token: "Add Token",
  region: "Add Region",
};

const CanvasToolbar = memo(({ tool, onSetTool, onAdd, onFit, onReset }: ToolbarProps) => {
  const [addOpen, setAddOpen] = React.useState(false);
  const addRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!addOpen) return;
    const handler = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as globalThis.Node)) setAddOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [addOpen]);

  const isAddMode = !["inspect", "move", "connect", "delete"].includes(tool);
  const isSpecialMode = tool === "connect" || tool === "delete" || isAddMode;
  const activeLabel = TOOL_LABELS[tool] ?? tool;

  return (
    <Panel position="top-left" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {/* Core actions */}
        <div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-black/85 p-1 backdrop-blur-xl shadow-2xl">
          {/* Unified pointer — always active unless special mode */}
          <div
            className={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold transition-all ${
              !isSpecialMode ? "bg-white/12 text-white" : "text-white/35"
            }`}
            title="Click to select · Drag to move · Middle-drag to pan"
          >
            <MousePointer2 size={13} />
            <span>Pointer</span>
          </div>
          <div className="mx-1 h-5 w-px bg-white/10" />
          <ToolButton active={tool === "connect"} icon={Zap} onClick={() => onSetTool("connect")} label="Connect" shortcut="C" />
          <ToolButton active={tool === "delete"} icon={Trash2} onClick={() => onSetTool("delete")} label="Delete" shortcut="D" danger />
        </div>

        {/* Add dropdown */}
        <div ref={addRef} className="relative">
          <button
            onClick={() => setAddOpen((v) => !v)}
            className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 backdrop-blur-xl shadow-2xl transition-all duration-150 ${
              isAddMode || addOpen
                ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-300"
                : "border-white/10 bg-black/85 text-white/60 hover:bg-white/5 hover:text-white/90"
            }`}
          >
            <Plus size={14} />
            <span className="text-xs font-semibold">Add</span>
          </button>

          {addOpen && (
            <div className="absolute left-0 top-full z-50 mt-1.5 w-[220px] rounded-xl border border-white/10 bg-[rgba(8,10,14,0.97)] p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="mb-1 px-2 pt-1 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-white/30">Add to canvas</div>
              <div className="grid grid-cols-2 gap-1">
                {ADD_TOOL_CONFIG.map(({ tool: t, label, icon: Icon }) => (
                  <button key={t} onClick={() => { onAdd(t as AddMode); setAddOpen(false); }}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-all hover:bg-white/8 active:scale-95 ${tool === t ? "bg-white/10 text-white" : "text-white/70"}`}>
                    <Icon size={13} className="shrink-0 opacity-70" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* View controls */}
        <div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-black/85 p-1 backdrop-blur-xl shadow-2xl">
          <button onClick={onFit} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition-all hover:bg-white/8 hover:text-white" title="Fit view">
            <Maximize size={13} />
          </button>
          <button onClick={onReset} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition-all hover:bg-white/8 hover:text-white" title="Reset view">
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* Active mode badge — only for special modes */}
      {isSpecialMode && (
        <div className={`flex items-center gap-1.5 self-start rounded-lg px-2.5 py-1 text-[11px] font-semibold animate-in fade-in duration-150 ${
          tool === "delete" ? "bg-red-500/15 text-red-400 border border-red-500/20"
          : tool === "connect" ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/20"
          : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
        }`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
          {activeLabel}
          <span className="ml-1 text-[10px] opacity-60">· ESC to cancel</span>
        </div>
      )}
    </Panel>
  );
});

const ToolButton = memo(({ active, icon: Icon, onClick, label, shortcut, danger = false }: {
  active: boolean; icon: any; onClick: () => void; label: string; shortcut?: string; danger?: boolean;
}) => (
  <button
    onClick={onClick}
    title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
    className={`relative flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-150 ${
      active
        ? danger
          ? "bg-red-500/20 text-red-400 shadow-sm"
          : "bg-white/15 text-white shadow-sm"
        : danger
          ? "text-white/40 hover:bg-red-500/10 hover:text-red-400"
          : "text-white/40 hover:bg-white/8 hover:text-white/90"
    }`}
  >
    <Icon size={14} />
    {active && <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-current opacity-70" />}
  </button>
));

const CanvasStatusPanel = memo(({ nodeCount, linkCount, tool }: { nodeCount: number; linkCount: number; tool: BoardTool }) => {
  const [showHelp, setShowHelp] = React.useState(false);
  const helpRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!showHelp) return;
    const handler = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as globalThis.Node)) setShowHelp(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showHelp]);

  return (
    <Panel position="top-right">
      <div className="flex items-center gap-2" ref={helpRef}>
        {/* Stats pill */}
        <div className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-black/80 px-3 py-1.5 backdrop-blur-xl shadow-xl">
          <span className="text-[11px] text-white/40">nodes</span>
          <span className="text-xs font-bold text-white/80">{nodeCount}</span>
          <div className="h-3 w-px bg-white/10" />
          <span className="text-[11px] text-white/40">links</span>
          <span className="text-xs font-bold text-white/80">{linkCount}</span>
        </div>

        {/* Help toggle */}
        <button
          onClick={() => setShowHelp((v) => !v)}
          className={`flex h-8 w-8 items-center justify-center rounded-xl border backdrop-blur-xl shadow-xl transition-all ${
            showHelp ? "border-white/20 bg-white/10 text-white" : "border-white/8 bg-black/80 text-white/40 hover:text-white/80 hover:bg-white/5"
          }`}
          title="Keyboard shortcuts"
        >
          <span className="text-[11px] font-bold">?</span>
        </button>

        {/* Help panel */}
        {showHelp && (
          <div className="absolute right-0 top-full mt-2 w-[260px] rounded-xl border border-white/10 bg-[rgba(8,10,14,0.97)] p-4 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="mb-3 text-xs font-bold uppercase tracking-widest text-white/40">How it works</div>
            <div className="space-y-1.5 mb-4">
              {[
                { key: "Click", label: "Select a node" },
                { key: "Drag", label: "Move a node" },
                { key: "Mid-drag", label: "Pan the canvas" },
                { key: "Scroll", label: "Zoom in / out" },
                { key: "C", label: "Connect two nodes" },
                { key: "D", label: "Delete mode" },
                { key: "Del", label: "Delete selected" },
                { key: "Esc", label: "Cancel / deselect" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-[12px] text-white/60">{label}</span>
                  <kbd className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white/70">{key}</kbd>
                </div>
              ))}
            </div>
            <div className="mb-2 text-xs font-bold uppercase tracking-widest text-white/40">Link Types</div>
            <div className="space-y-1.5">
              {BOARD_LINK_LEGEND.map((r) => (
                <div key={r.label} className="flex items-center gap-2.5">
                  <div className="h-px w-8 rounded-full" style={{ backgroundColor: EDGE_TONE[r.type]?.stroke ?? "#fff" }} />
                  <span className="text-[12px] text-white/60">{r.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
});

const CanvasConnectionHint = memo(({ active, linkType, onChangeLinkType }: { active: boolean; linkType?: BoardLinkType; onChangeLinkType: (type: BoardLinkType) => void }) => (
  active ? (
    <Panel position="bottom-center" className="mb-4">
      <div className="flex items-center gap-3 rounded-xl border border-indigo-500/25 bg-[rgba(8,10,18,0.95)] px-4 py-2.5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-xs font-semibold text-white/90">Click a target node to connect</span>
        </div>

        <div className="h-4 w-px bg-white/10" />

        {/* Link type pills */}
        <div className="flex items-center gap-1">
          {BOARD_LINK_LEGEND.map((link) => {
            const color = EDGE_TONE[link.type]?.stroke ?? "#fff";
            const isActive = linkType === link.type;
            return (
              <button
                key={link.type}
                onClick={() => onChangeLinkType(link.type)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  isActive ? "text-white" : "text-white/35 hover:text-white/70"
                }`}
                style={isActive ? { backgroundColor: `${color}22`, boxShadow: `0 0 0 1px ${color}55` } : {}}
              >
                {link.label}
              </button>
            );
          })}
        </div>

        <div className="h-4 w-px bg-white/10" />
        <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/40">Esc</kbd>
      </div>
    </Panel>
  ) : null
));

const NodeQuickActions = memo(({ 
  selectedNode, 
  viewport, 
  onConnect, 
  onDelete 
}: { 
  selectedNode: Node<WorldNodeData> | null;
  viewport: ViewportState;
  onConnect: () => void;
  onDelete: () => void;
}) => {
  if (!selectedNode || selectedNode.id.startsWith("cluster:")) return null;

  const nodeW = selectedNode.measured?.width ?? 180;
  const nodeH = selectedNode.measured?.height ?? 60;

  const screenPos = toScreen(
    { 
      x: selectedNode.position.x + nodeW / 2, 
      y: selectedNode.position.y - 8,
    }, 
    viewport
  );

  // Clamp so it doesn't go off-screen
  const clampedX = Math.max(60, Math.min(screenPos.x, window.innerWidth - 60));
  const clampedY = Math.max(48, screenPos.y);

  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      <div
        className="pointer-events-auto absolute flex items-center gap-0.5 rounded-xl border border-white/12 bg-[rgba(8,10,14,0.95)] p-1 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
        style={{
          left: `${clampedX}px`,
          top: `${clampedY}px`,
          transform: 'translate(-50%, -100%)',
        }}
      >
        <button
          onClick={onConnect}
          className="flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-white/50 transition-all hover:bg-indigo-500/15 hover:text-indigo-400"
          title="Connect (C)"
        >
          <Zap size={12} />
          <span className="text-[11px] font-medium">Connect</span>
        </button>
        <div className="h-4 w-px bg-white/10" />
        <button
          onClick={onDelete}
          className="flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-white/50 transition-all hover:bg-red-500/15 hover:text-red-400"
          title="Delete (Del)"
        >
          <Trash2 size={12} />
          <span className="text-[11px] font-medium">Delete</span>
        </button>
      </div>
    </div>
  );
});

// --- Groups Panel ---

const GROUP_PALETTE = ["#2dd4bf", "#38bdf8", "#a78bfa", "#fb923c", "#f472b6", "#4ade80", "#facc15"];

interface GroupsPanelProps {
  groups: BoardGroup[];
  assignMode: string | null;
  selectedNodeIds: Set<string>;
  onSetAssignMode: (id: string | null) => void;
  onConfirmAssign: () => void;
  onConfirmRemove: () => void;
  onCreateGroup: () => void;
  onDeleteGroup: (id: string) => void;
  onSelectGroup: (id: string) => void;
  selectedGroupId: string | null;
  nodeGroupMembership: Map<string, Array<{ name: string; accent: string }>>;
}

const GroupsPanel = memo(function GroupsPanel({
  groups, assignMode, selectedNodeIds, onSetAssignMode, onConfirmAssign, onConfirmRemove,
  onCreateGroup, onDeleteGroup, onSelectGroup, selectedGroupId, nodeGroupMembership,
}: GroupsPanelProps) {
  const activeGroup = assignMode ? groups.find((g) => g.id === assignMode) : null;
  const activeAccent = activeGroup?.accent ?? "#2dd4bf";

  // Count how many selected nodes are already in the active group
  const alreadyMembers = activeGroup
    ? [...selectedNodeIds].filter((id) => activeGroup.memberNodeIds.includes(id)).length
    : 0;
  const newToAdd = selectedNodeIds.size - alreadyMembers;

  return (
    <Panel position="top-right" className="mt-12">
      <div className="w-[210px] rounded-xl border border-white/10 bg-[rgba(8,10,14,0.96)] shadow-2xl backdrop-blur-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/8">
          <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">Groups</span>
          <button
            onClick={onCreateGroup}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-white/50 transition-all hover:bg-white/8 hover:text-white/90"
          >
            <Plus size={11} />
            New
          </button>
        </div>

        {/* Group list */}
        {groups.length === 0 ? (
          <div className="px-3 py-4 text-center text-[11px] text-white/25">
            No groups yet.<br />Create one to assign nodes.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {groups.map((group) => {
              const accent = group.accent ?? "#2dd4bf";
              const isAssigning = assignMode === group.id;
              const isSelected = selectedGroupId === group.id;
              return (
                <div
                  key={group.id}
                  className={`group/row flex items-center gap-2 px-3 py-2 transition-all cursor-pointer ${
                    isAssigning ? "bg-white/6" : isSelected ? "bg-white/4" : "hover:bg-white/3"
                  }`}
                  onClick={() => !isAssigning && onSelectGroup(group.id)}
                >
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-semibold text-white/80">{group.label ?? group.name}</div>
                    <div className="text-[10px] text-white/30">{group.memberNodeIds.length} node{group.memberNodeIds.length !== 1 ? "s" : ""}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onSetAssignMode(isAssigning ? null : group.id); }}
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold transition-all text-white/25 hover:text-white/70"
                    style={isAssigning ? { backgroundColor: `${accent}25`, color: accent } : {}}
                  >
                    {isAssigning ? "Cancel" : "Edit"}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteGroup(group.id); }}
                    className="shrink-0 rounded p-0.5 text-white/20 opacity-0 transition-all hover:text-red-400 group-hover/row:opacity-100"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Assign mode footer */}
        {assignMode && (
          <div className="border-t border-white/8 p-3 space-y-2">
            {/* Instruction */}
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: activeAccent }} />
              <span className="text-[11px] text-white/50">
                {selectedNodeIds.size === 0
                  ? "Click nodes to select them"
                  : `${selectedNodeIds.size} node${selectedNodeIds.size !== 1 ? "s" : ""} selected`}
              </span>
            </div>

            {/* Action buttons */}
            {selectedNodeIds.size > 0 && (
              <div className="flex gap-1.5">
                <button
                  onClick={onConfirmAssign}
                  className="flex-1 rounded-lg py-1.5 text-[11px] font-bold transition-all text-white"
                  style={{ backgroundColor: `${activeAccent}30`, border: `1px solid ${activeAccent}50` }}
                >
                  {newToAdd > 0 ? `Add ${newToAdd}` : "Update"}
                </button>
                {alreadyMembers > 0 && (
                  <button
                    onClick={onConfirmRemove}
                    className="flex-1 rounded-lg py-1.5 text-[11px] font-bold text-red-400 transition-all hover:bg-red-500/10 border border-red-500/20"
                  >
                    Remove {alreadyMembers}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
});

// --- Node Editor Panel ---

const LINK_TYPE_OPTIONS: Array<{ type: BoardLinkType; label: string; color: string }> = [
  { type: "alliance", label: "Ally", color: "#22c55e" },
  { type: "conflict", label: "Foe", color: "#ef4444" },
  { type: "causal", label: "Influence", color: "#f59e0b" },
  { type: "dependency", label: "Depends", color: "#cbd5e1" },
];

interface NodeEditorPanelProps {
  node: Node<WorldNodeData> | null;
  boardLinks: BoardLink[];
  selectedEntity: BoardSelection | null;
  onUpdateNode: (nodeId: string, patch: { name?: string; description?: string }) => void;
  onUpdateLink: (linkId: string, patch: { linkType?: BoardLinkType }) => void;
  aiSettings?: { provider?: string; apiKey?: string; model?: string };
}

const NodeEditorPanel = memo(function NodeEditorPanel({
  node, boardLinks, selectedEntity, onUpdateNode, onUpdateLink, aiSettings,
}: NodeEditorPanelProps) {
  const [editingName, setEditingName] = React.useState(false);
  const [nameValue, setNameValue] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [editingDesc, setEditingDesc] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const nameRef = React.useRef<HTMLInputElement>(null);
  const descRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    setEditingName(false);
    setEditingDesc(false);
    setNameValue(node?.data.label ?? "");
    setDescription(node?.data.description ?? "");
  }, [node?.id]);

  React.useEffect(() => { if (editingName) nameRef.current?.focus(); }, [editingName]);
  React.useEffect(() => { if (editingDesc) descRef.current?.focus(); }, [editingDesc]);

  const handleAutoGenerate = React.useCallback(async () => {
    if (!node) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/node-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: node.data.label, kind: node.data.nodeKind ?? node.data.tone, aiSettings }),
      });
      const data = await res.json();
      if (data.description) {
        setDescription(data.description);
        onUpdateNode(node.id, { description: data.description });
      }
    } catch (e) {
      console.error("Auto-generate failed", e);
    } finally {
      setGenerating(false);
    }
  }, [node, aiSettings, onUpdateNode]);

  // Link type picker when a boardLink is selected
  if (selectedEntity?.type === "boardLink") {
    const link = boardLinks.find((l) => l.id === selectedEntity.id);
    if (!link) return null;
    return (
      <div className="pointer-events-none absolute inset-0 z-50 flex items-end justify-center pb-24">
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-white/10 bg-[rgba(8,10,14,0.96)] p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          <span className="px-2 text-[11px] text-white/40">Link type:</span>
          {LINK_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              onClick={() => onUpdateLink(link.id, { linkType: opt.type })}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
                link.type === opt.type ? "text-white" : "text-white/40 hover:text-white/80"
              }`}
              style={link.type === opt.type ? { backgroundColor: `${opt.color}25`, boxShadow: `0 0 0 1px ${opt.color}50` } : {}}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!node || node.id.startsWith("cluster:")) return null;
  if (!["campaignNode", "agent"].includes(node.data.tone)) return null;

  const accent = node.data.accent ?? "#38bdf8";
  const hasDescription = description.trim().length > 0;

  return (
    <Panel position="bottom-left" className="mb-4 ml-0">
      <div className="w-[300px] rounded-xl border border-white/10 bg-[rgba(8,10,14,0.97)] shadow-2xl backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
          <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: accent }} />
          {editingName ? (
            <input
              ref={nameRef}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={() => {
                if (nameValue.trim() && nameValue !== node.data.label) {
                  onUpdateNode(node.id, { name: nameValue.trim() });
                }
                setEditingName(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") { setEditingName(false); setNameValue(node.data.label); }
              }}
              className="flex-1 bg-transparent text-[13px] font-bold text-white outline-none border-b border-white/20 pb-0.5"
            />
          ) : (
            <button
              onClick={() => { setNameValue(node.data.label); setEditingName(true); }}
              className="flex-1 text-left text-[13px] font-bold text-white/90 hover:text-white transition-colors truncate"
            >
              {node.data.label}
            </button>
          )}
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest" style={{ color: `${accent}80` }}>
            {node.data.subtitle}
          </span>
        </div>

        {/* Description */}
        <div className="p-3">
          {editingDesc ? (
            <textarea
              ref={descRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                onUpdateNode(node.id, { description: description.trim() });
                setEditingDesc(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditingDesc(false);
              }}
              rows={5}
              placeholder="Describe this actor's background, motivations, and behavior..."
              className="w-full resize-none rounded-lg bg-white/5 px-2.5 py-2 text-[12px] text-white/80 outline-none ring-1 ring-white/10 focus:ring-indigo-500/40 placeholder:text-white/20"
            />
          ) : hasDescription ? (
            <button
              onClick={() => setEditingDesc(true)}
              className="w-full text-left text-[12px] leading-relaxed text-white/60 hover:text-white/80 transition-colors"
            >
              {description}
            </button>
          ) : (
            <button
              onClick={() => setEditingDesc(true)}
              className="w-full rounded-lg border border-dashed border-white/10 px-3 py-2.5 text-center text-[11px] text-white/25 transition-all hover:border-white/20 hover:text-white/50"
            >
              No description — click to add or auto-generate
            </button>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 border-t border-white/8 px-3 py-2">
          <button
            onClick={handleAutoGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all disabled:opacity-50"
            style={{ backgroundColor: `${accent}18`, color: `${accent}cc` }}
          >
            {generating ? (
              <>
                <span className="h-2.5 w-2.5 rounded-full border border-current border-t-transparent animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={11} />
                {hasDescription ? "Regenerate" : "Auto-generate"}
              </>
            )}
          </button>
          <span className="flex-1" />
          <span className="text-[10px] text-white/20">The simulation engine reads this</span>
        </div>
      </div>
    </Panel>
  );
});

// --- Main Component ---

export const ReactFlowWorldCanvas = forwardRef<WorldCanvasHandle, ReactFlowWorldCanvasProps>(function ReactFlowWorldCanvas(
  {
    agents,
    boardLinks,
    boardGroups,
    campaignNodes,
    relationships,
    map,
    fronts,
    selectedEntity,
    onSelectEntity,
    onMoveToken,
    onMoveSite,
    onMoveRegion,
    onResizeRegion,
    onMoveAgent,
    onMoveCampaignNode,
    onCreateRegion,
    onCreateSite,
    onCreateToken,
    onCreateRoute,
    onCreateBoardLink,
    onCreateBoardGroup,
    onUpdateBoardGroupPolygon,
    onCreateCampaignNode,
    onUpdateCampaignNode,
    onUpdateAgent,
    onUpdateBoardLink,
      onRequestDeleteSelection,
      initialTool = "inspect",
      onToolStateChange,
      layoutPositions,
      onDraggingChange,
    },
    ref
  ) {
    const reactFlowRef = useRef<ReactFlowInstance<Node<WorldNodeData>, Edge> | null>(null);
    const pendingNodePositionsRef = useRef<Record<string, { x: number; y: number }>>({});
    const stableNodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
    const isDraggingNodeRef = useRef(false);
    const recentDragTimestampRef = useRef(0);
    const [isDraggingNode, setIsDraggingNode] = useState(false);
    const [suppressedCampaignLayoutIds, setSuppressedCampaignLayoutIds] = useState<Set<string>>(() => new Set());
    const [suppressedStructuredLayoutIds, setSuppressedStructuredLayoutIds] = useState<Set<string>>(() => new Set());
    const [expandedClusterIds, setExpandedClusterIds] = useState<Set<string>>(() => new Set());
    const [viewport, setViewport] = useState<ViewportState>({ x: 0, y: 0, zoom: 1 });
    const [optimisticBoardGroups, setOptimisticBoardGroups] = useState<BoardGroup[]>([]);
    // groupAssignMode: when set to a groupId, clicking a node toggles its membership
    const [groupAssignMode, setGroupAssignMode] = useState<string | null>(null);
    // groupSelectedNodeIds: nodes selected for batch assignment
    const [groupSelectedNodeIds, setGroupSelectedNodeIds] = useState<Set<string>>(() => new Set());
    const layoutMode = useSimulationStore((state) => state.layoutMode);
    const aiSettings = useSimulationStore((state) => state.aiSettings);

    useEffect(() => {
      return () => {
        reactFlowRef.current = null;
        pendingNodePositionsRef.current = {};
      };
    }, []);

  const [optimisticLink, setOptimisticLink] = useState<any>(null);
  const [optimisticNodes, setOptimisticNodes] = useState<Node<WorldNodeData>[]>([]);
  const optimisticNodeCounterRef = useRef(0);
  const optimisticNodeBaseCountRef = useRef<Map<string, number>>(new Map());
  const baseNodeCountRef = useRef(0);
  const [addMode, setAddMode] = useState<AddMode>("none");
  const [deleteMode, setDeleteMode] = useState(false);
  const [connectionSourceKey, setConnectionSourceKey] = useState<string | null>(null);
  const [frontLayoutPositions, setFrontLayoutPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [linkType, setLinkType] = useState<BoardLinkType>("causal");
  const [zoomPercent, setZoomPercent] = useState(100);
  const [showFronts] = useState(true);
  const [showRegions] = useState(false);

  // Unified pointer mode — no separate inspect/move toggle
  // activeTool is only non-pointer when a special mode is active
  const activeTool: BoardTool = useMemo(() => {
    if (addMode !== "none") return addMode;
    if (connectionSourceKey) return "connect";
    if (deleteMode) return "delete";
    return "inspect"; // "inspect" is now the unified pointer mode
  }, [addMode, connectionSourceKey, deleteMode]);

  const canStartLinkFromSelection = useMemo(() => 
    selectedEntity && ["agent", "campaignNode", "region", "site", "front"].includes(selectedEntity.type),
    [selectedEntity]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (event.key === "Escape") {
        setConnectionSourceKey(null);
        setAddMode("none");
        setDeleteMode(false);
        onSelectEntity(null);
        return;
      }

      if (event.key === "c" && !event.ctrlKey && !event.metaKey) {
        if (selectedEntity && canStartLinkFromSelection) {
          setConnectionSourceKey(flowNodeId(selectedEntity.type, (selectedEntity as any).id));
        }
        return;
      }
      if (event.key === "d" && !event.ctrlKey && !event.metaKey) {
        setDeleteMode(true);
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedEntity) {
          onRequestDeleteSelection(selectedEntity);
        }
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [canStartLinkFromSelection, onSelectEntity, onRequestDeleteSelection, selectedEntity]);

  const frontNodes = useMemo(() => {
    return fronts.map((front, index) => {
      const region = map.regions.find((candidate) => candidate.id === front.regionId);
      const base = region?.center ?? { x: index * 180, y: -180 };
      const fallbackPosition = { x: base.x + 120, y: base.y - 120 - index * 42 };
      return { front, position: frontLayoutPositions[front.id] ?? fallbackPosition };
    });
  }, [frontLayoutPositions, fronts, map.regions]);

  useEffect(() => {
    setFrontLayoutPositions((current) => {
      let changed = false;
      const next: Record<string, { x: number; y: number }> = {};
      fronts.forEach((front, index) => {
        if (current[front.id]) {
          next[front.id] = current[front.id];
        } else {
          const region = map.regions.find(r => r.id === front.regionId);
          const base = region?.center ?? { x: index * 180, y: -180 };
          next[front.id] = { x: base.x + 120, y: base.y - 120 - index * 42 };
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [fronts, map.regions]);

    const tieredPositions = useMemo(
      () => (needsAutoLayout(campaignNodes) ? computeTieredLayout(campaignNodes).positions : null),
      [campaignNodes]
    );

    const normalizedAssistedCampaignLayout = useMemo(() => {
      if (layoutMode !== "assisted" || !layoutPositions?.size) return null;

      const next = new Map<string, { x: number; y: number }>();
      for (const node of campaignNodes) {
        if (!layoutPositions.has(node.id)) continue;
        next.set(flowNodeId("campaignNode", node.id), layoutPositions.get(node.id)!);
      }
      return next;
    }, [campaignNodes, layoutMode, layoutPositions]);

    const normalizedTieredCampaignLayout = useMemo(() => {
      if (!tieredPositions?.size) return null;

      const next = new Map<string, { x: number; y: number }>();
      for (const node of campaignNodes) {
        if (!tieredPositions.has(node.id)) continue;
        next.set(flowNodeId("campaignNode", node.id), tieredPositions.get(node.id)!);
      }
      return next;
    }, [campaignNodes, tieredPositions]);

    const campaignLayoutPositions = useMemo(() => {
      const source = normalizedAssistedCampaignLayout ?? normalizedTieredCampaignLayout;
      if (!source?.size) return null;

      if (suppressedCampaignLayoutIds.size === 0) {
        return source;
      }

      const next = new Map(source);
      for (const flowId of suppressedCampaignLayoutIds) {
        next.delete(flowId);
      }
      return next;
    }, [normalizedAssistedCampaignLayout, normalizedTieredCampaignLayout, suppressedCampaignLayoutIds]);

    const selectedFlowId = useMemo(() => selectionToFlowId(selectedEntity), [selectedEntity]);

    const connectedNodeIds = useMemo(() => {
      if (!selectedEntity) return new Set<string>();
      if (selectedEntity.type === "boardGroup") {
        const group = [...boardGroups, ...optimisticBoardGroups].find((entry) => entry.id === selectedEntity.id);
        return new Set(group?.memberNodeIds ?? []);
      }
      if (!selectedFlowId) return new Set<string>();

      const connected = new Set<string>([selectedFlowId]);
      boardLinks.forEach((link) => {
        const source = flowNodeId(link.source.type, link.source.id);
        const target = flowNodeId(link.target.type, link.target.id);
        if (source === selectedFlowId || target === selectedFlowId) {
          connected.add(source);
          connected.add(target);
        }
      });
      map.routes.forEach((route) => {
        const source = flowNodeId("site", route.fromSiteId);
        const target = flowNodeId("site", route.toSiteId);
        if (source === selectedFlowId || target === selectedFlowId) {
          connected.add(source);
          connected.add(target);
        }
      });
      return connected;
    }, [boardGroups, boardLinks, map.routes, optimisticBoardGroups, selectedEntity, selectedFlowId]);

    const hasActiveSpotlight =
      (selectedEntity !== null && connectedNodeIds.size > 0) ||
      (selectedEntity?.type === "boardGroup" && connectedNodeIds.size > 0);

    const displayModel = useMemo(() => {
      const structuredLayoutPositions = new Map<string, { x: number; y: number }>();
      const hiddenNodeIds = new Set<string>();
      const forcedVisibleNodeIds = new Set<string>(connectedNodeIds);
      const primaryNodeIds = new Set<string>();
      const aliasNodeIds = new Map<string, string>();

      if (selectedFlowId) forcedVisibleNodeIds.add(selectedFlowId);
      if (selectedEntity?.type === "boardGroup") {
        const group = [...boardGroups, ...optimisticBoardGroups].find((entry) => entry.id === selectedEntity.id);
        group?.memberNodeIds.forEach((id) => forcedVisibleNodeIds.add(id));
      }

      const frontFlowIds = fronts
        .map((front) => flowNodeId("front", front.id))
        .sort((a, b) => a.localeCompare(b));
      const factionFlowIds = campaignNodes
        .filter((node) => node.kind === "faction")
        .map((node) => flowNodeId("campaignNode", node.id))
        .sort((a, b) => a.localeCompare(b));
      const conflictFlowIds = campaignNodes
        .filter((node) => node.kind === "front" || node.kind === "event")
        .map((node) => flowNodeId("campaignNode", node.id))
        .sort((a, b) => a.localeCompare(b));

      for (const id of [...frontFlowIds, ...factionFlowIds, ...conflictFlowIds]) {
        primaryNodeIds.add(id);
      }
      for (const link of boardLinks) {
        if (link.type !== "conflict" && link.type !== "alliance") continue;
        primaryNodeIds.add(flowNodeId(link.source.type, link.source.id));
        primaryNodeIds.add(flowNodeId(link.target.type, link.target.id));
      }
      connectedNodeIds.forEach((id) => primaryNodeIds.add(id));

      const placeRow = (ids: string[], y: number, spacing: number, startX = 0) => {
        if (ids.length === 0) return;
        const origin = startX - ((ids.length - 1) * spacing) / 2;
        ids.forEach((id, index) => {
          // Don't override positions for nodes that have been manually dragged
          if (!suppressedStructuredLayoutIds.has(id)) {
            structuredLayoutPositions.set(id, {
              x: origin + index * spacing,
              y,
            });
          }
        });
      };

      placeRow(factionFlowIds, -320, 270);
      placeRow(frontFlowIds, -10, 240);
      placeRow(conflictFlowIds, 170, 220);

      // Place all agents — no collapsing, no clusters
      const allAgentIds = [
        ...agents.map((agent) => flowNodeId("agent", agent.id)),
        ...campaignNodes
          .filter((node) => node.kind === "agent")
          .map((node) => flowNodeId("campaignNode", node.id)),
      ].sort((a, b) => a.localeCompare(b));

      const allPlaceIds = campaignNodes
        .filter((node) => node.kind === "place")
        .map((node) => flowNodeId("campaignNode", node.id))
        .sort((a, b) => a.localeCompare(b));

      placeRow(allAgentIds, 360, 220, -120);
      placeRow(allPlaceIds, 520, 220, 180);

      return {
        structuredLayoutPositions,
        hiddenNodeIds,
        forcedVisibleNodeIds,
        primaryNodeIds,
        aliasNodeIds,
        agentClusters: [] as ClusterDisplay[],
        infraClusters: [] as ClusterDisplay[],
      };
    }, [
      agents,
      boardGroups,
      boardLinks,
      campaignNodes,
      connectedNodeIds,
      fronts,
      hasActiveSpotlight,
      optimisticBoardGroups,
      selectedEntity,
      selectedFlowId,
      suppressedStructuredLayoutIds,
    ]);

    // Build a map from flowNodeId → group tags for rendering on nodes
    const nodeGroupMembership = useMemo(() => {
      const map = new Map<string, Array<{ name: string; accent: string }>>();
      for (const group of [...boardGroups, ...optimisticBoardGroups]) {
        const tag = { name: group.label ?? group.name, accent: group.accent ?? "#2dd4bf" };
        for (const nodeId of group.memberNodeIds) {
          const existing = map.get(nodeId);
          if (existing) existing.push(tag);
          else map.set(nodeId, [tag]);
        }
      }
      return map;
    }, [boardGroups, optimisticBoardGroups]);

    const baseNodes = useCanvasNodes({
      agents,
      campaignNodes,
      map,
      fronts,
      selectedEntity,
      activeTool,
      connectionSourceKey,
      frontNodes,
      campaignLayoutPositions,
      hasActiveSpotlight,
      connectedNodeIds,
      flowNodeId,
      nodeTypeForKind,
      flowPosition,
      accentFor,
      showFronts,
      showRegions,
      forcedVisibleNodeIds: displayModel.forcedVisibleNodeIds,
      hiddenNodeIds: displayModel.hiddenNodeIds,
      structuredLayoutPositions: displayModel.structuredLayoutPositions,
      primaryNodeIds: displayModel.primaryNodeIds,
      agentClusters: displayModel.agentClusters,
      infraClusters: displayModel.infraClusters,
      suppressedStructuredLayoutIds,
      nodeGroupMembership,
      groupSelectedNodeIds,
    });

    const edges = useCanvasEdges({
      boardLinks,
      map,
      relationships,
      selectedEntity,
      optimisticLink,
      showRelationships: true,
      hasActiveSpotlight,
      connectedNodeIds,
      flowNodeId,
      selectionToFlowId,
      EDGE_TONE,
      aliasNodeIds: displayModel.aliasNodeIds,
      primaryNodeIds: displayModel.primaryNodeIds,
    });

    const [flowNodes, setFlowNodes] = useNodesState<Node<WorldNodeData>>(baseNodes);

    // Position sync with stable cache - preserves positions across layout changes
    useEffect(() => {
      // Never sync during drag
      if (isDraggingNodeRef.current) return;

      // Auto-remove optimistic nodes when the real node count has grown (server responded)
      const currentRealCount = baseNodes.filter((n) => !n.id.startsWith("cluster:")).length;
      baseNodeCountRef.current = currentRealCount;
      if (optimisticNodeBaseCountRef.current.size > 0) {
        const toRemove: string[] = [];
        for (const [optId, countAtAdd] of optimisticNodeBaseCountRef.current) {
          if (currentRealCount > countAtAdd) toRemove.push(optId);
        }
        if (toRemove.length > 0) {
          toRemove.forEach((id) => optimisticNodeBaseCountRef.current.delete(id));
          setOptimisticNodes((prev) => prev.filter((n) => !toRemove.includes(n.id)));
        }
      }

      setFlowNodes((currentNodes) => {
        const currentById = new Map(currentNodes.map((n) => [n.id, n]));
        const baseById = new Map(baseNodes.map((n) => [n.id, n]));
        
        // Update stable cache with current positions before any changes
        currentNodes.forEach(node => {
          if (!stableNodePositionsRef.current.has(node.id)) {
            stableNodePositionsRef.current.set(node.id, { ...node.position });
          }
        });
        
        // Check for structural changes
        const currentIds = new Set(currentNodes.map(n => n.id));
        const baseIds = new Set(baseNodes.map(n => n.id));
        const hasStructuralChange = 
          currentIds.size !== baseIds.size ||
          [...currentIds].some(id => !baseIds.has(id)) ||
          [...baseIds].some(id => !currentIds.has(id));

        // Build new node list
        const newNodes = baseNodes.map(baseNode => {
          const pending = pendingNodePositionsRef.current[baseNode.id];
          const stable = stableNodePositionsRef.current.get(baseNode.id);
          const current = currentById.get(baseNode.id);
          
          // Position priority:
          // 1. Pending drag position (highest)
          // 2. Stable cached position (if exists)
          // 3. Base computed position (fallback)
          let position: { x: number; y: number };
          
          if (pending) {
            position = pending;
          } else if (stable) {
            position = stable;
          } else {
            position = baseNode.position;
            // Cache this new position
            stableNodePositionsRef.current.set(baseNode.id, { ...position });
          }

          // For new nodes (structural change), use base position initially
          if (hasStructuralChange && !current) {
            position = baseNode.position;
            stableNodePositionsRef.current.set(baseNode.id, { ...position });
          }

          return {
            ...baseNode,
            position,
            draggable: baseNode.draggable,
          };
        });

        // Clean up stable cache for removed nodes
        const newIds = new Set(baseNodes.map(n => n.id));
        for (const [id] of stableNodePositionsRef.current) {
          if (!newIds.has(id)) {
            stableNodePositionsRef.current.delete(id);
          }
        }

        return newNodes;
      });
    }, [baseNodes, setFlowNodes]);

    const updateViewportState = useCallback(() => {
      const instance = reactFlowRef.current;
      if (instance) {
        const nextViewport = instance.getViewport();
        setViewport(nextViewport);
        setZoomPercent(Math.round(nextViewport.zoom * 100));
      }
    }, []);

    const inferredBoardGroups = useMemo(
      () => inferBoardGroups(campaignNodes, boardLinks, displayModel.structuredLayoutPositions),
      [boardLinks, campaignNodes, displayModel.structuredLayoutPositions],
    );

    useEffect(() => {
      setOptimisticBoardGroups((current) =>
        current.filter((optimisticGroup) => {
          return !boardGroups.some((group) => {
            if (group.name !== optimisticGroup.name) return false;
            if (group.polygon.length !== optimisticGroup.polygon.length) return false;
            return group.polygon.every((point, index) => {
              const optimisticPoint = optimisticGroup.polygon[index];
              return (
                Math.abs(point.x - optimisticPoint.x) < 0.5 &&
                Math.abs(point.y - optimisticPoint.y) < 0.5
              );
            });
          });
        })
      );
    }, [boardGroups]);
    
    // Auto-focus on new nodes
    const previousNodeCountRef = useRef(flowNodes.length);
    useEffect(() => {
      if (flowNodes.length > previousNodeCountRef.current) {
        const newNodes = flowNodes.filter(n => !n.id.startsWith('cluster:'));
        const lastNode = newNodes[newNodes.length - 1];
        if (lastNode && reactFlowRef.current) {
          // Check if this was a user-initiated "add" within the last minute
          // (to avoid focusing on initial load or background syncs)
          reactFlowRef.current.setCenter(lastNode.position.x + 90, lastNode.position.y + 45, { zoom: 1.2, duration: 600 });
        }
      }
      previousNodeCountRef.current = flowNodes.length;
    }, [flowNodes]);
    

    const renderedBoardGroups = useMemo(
      // Only show user-created and optimistic groups — no auto-inferred polygon noise
      () => [...boardGroups, ...optimisticBoardGroups],
      [boardGroups, optimisticBoardGroups]
    );

    // Live-recompute group polygons from current node positions so they follow dragged nodes
    const liveRenderedBoardGroups = useMemo(() => {
      const nodePositionMap = new Map(
        flowNodes.map((n) => [n.id, {
          x: n.position.x + (n.measured?.width ?? 180) / 2,
          y: n.position.y + (n.measured?.height ?? 80) / 2,
        }])
      );

      return renderedBoardGroups.map((group) => {
        // Only recompute for groups that have member nodes currently on canvas
        const memberPositions = group.memberNodeIds
          .map((id) => nodePositionMap.get(id))
          .filter((p): p is { x: number; y: number } => Boolean(p));

        if (memberPositions.length < 2) return group;

        // Recompute polygon from live positions with padding
        const livePolygon = memberPositions.length >= 3
          ? expandPolygon(hull(memberPositions), 60)
          : expandPolygon(memberPositions, 60); // 2 nodes: just pad around them

        return { ...group, polygon: livePolygon };
      });
    }, [renderedBoardGroups, flowNodes]);

    const nodeCenters = useMemo(
      () =>
        flowNodes
          .filter((node) => ["agent", "campaignNode", "site", "front", "token"].includes(node.data.tone))
          .map((node) => ({
            id: node.id,
            position: {
              x: node.position.x + ((node.measured?.width ?? 180) / 2),
              y: node.position.y + ((node.measured?.height ?? 92) / 2),
            },
          })),
      [flowNodes]
    );

    const inferMembersFromPolygon = useCallback(
      (polygon: Position[]) => nodeCenters.filter((node) => pointInPolygon(node.position, polygon)).map((node) => node.id),
      [nodeCenters]
    );

    const handleCreateGroup = useCallback(async () => {
      const name = `Group ${boardGroups.length + optimisticBoardGroups.length + 1}`;
      const PALETTE = ["#2dd4bf", "#38bdf8", "#a78bfa", "#fb923c", "#f472b6", "#4ade80", "#facc15"];
      const accent = PALETTE[(boardGroups.length + optimisticBoardGroups.length) % PALETTE.length];
      const optimisticGroup: BoardGroup = {
        id: `optimistic:${Date.now()}`,
        name,
        polygon: [],
        memberNodeIds: [],
        semanticHint: "cluster",
        accent,
        tone: "manual",
        label: null,
        derivedFrom: "manual",
        tags: ["manual", "optimistic"],
      };
      setOptimisticBoardGroups((prev) => [...prev, optimisticGroup]);
      setGroupAssignMode(optimisticGroup.id);
      try {
        await onCreateBoardGroup({ name, polygon: [], memberNodeIds: [], semanticHint: "cluster", accent, tone: "manual", label: null });
      } catch {
        setOptimisticBoardGroups((prev) => prev.filter((g) => g.id !== optimisticGroup.id));
        setGroupAssignMode(null);
      }
    }, [boardGroups.length, optimisticBoardGroups.length, onCreateBoardGroup]);

    const handleGroupAssignConfirm = useCallback(() => {
      if (!groupAssignMode || groupSelectedNodeIds.size === 0) {
        setGroupAssignMode(null);
        setGroupSelectedNodeIds(new Set());
        return;
      }
      const group = [...boardGroups, ...optimisticBoardGroups].find((g) => g.id === groupAssignMode);
      if (group) {
        // Merge selected nodes with existing members (deduplicated)
        const nextMemberIds = [...new Set([...group.memberNodeIds, ...groupSelectedNodeIds])];
        void onUpdateBoardGroupPolygon({
          groupId: group.id,
          polygon: group.polygon,
          memberNodeIds: nextMemberIds,
          semanticHint: group.semanticHint,
          accent: group.accent,
          tone: group.tone,
          label: group.label,
          name: group.name,
        });
      }
      setGroupAssignMode(null);
      setGroupSelectedNodeIds(new Set());
    }, [groupAssignMode, groupSelectedNodeIds, boardGroups, optimisticBoardGroups, onUpdateBoardGroupPolygon]);

    const handleGroupRemoveConfirm = useCallback(() => {
      if (!groupAssignMode || groupSelectedNodeIds.size === 0) return;
      const group = [...boardGroups, ...optimisticBoardGroups].find((g) => g.id === groupAssignMode);
      if (group) {
        const nextMemberIds = group.memberNodeIds.filter((id) => !groupSelectedNodeIds.has(id));
        void onUpdateBoardGroupPolygon({
          groupId: group.id,
          polygon: group.polygon,
          memberNodeIds: nextMemberIds,
          semanticHint: group.semanticHint,
          accent: group.accent,
          tone: group.tone,
          label: group.label,
          name: group.name,
        });
      }
      setGroupSelectedNodeIds(new Set());
    }, [groupAssignMode, groupSelectedNodeIds, boardGroups, optimisticBoardGroups, onUpdateBoardGroupPolygon]);

    const notifyDraggingChange = useCallback((dragging: boolean) => {
      isDraggingNodeRef.current = dragging;
      setIsDraggingNode(dragging);
      onDraggingChange?.(dragging);
    }, [onDraggingChange]);

    const setBoardTool = useCallback((tool: BoardTool) => {
    if (tool === "inspect" || tool === "move") { setAddMode("none"); setDeleteMode(false); setConnectionSourceKey(null); }
    else if (tool === "delete") { setDeleteMode(true); setAddMode("none"); setConnectionSourceKey(null); }
    else if (tool === "connect") { setConnectionSourceKey(CONNECT_ARMED); setAddMode("none"); setDeleteMode(false); }
    else { setAddMode(tool as AddMode); setDeleteMode(false); setConnectionSourceKey(null); }
    onToolStateChange?.({
      activeTool: tool === "move" ? "inspect" : tool,
      linkType,
      zoomPercent,
      showGrid: true,
      showRelationships: true,
      showFronts: true,
      showRegions: true,
      snapToGrid: true,
      labelDensity: "balanced",
      canDeleteSelection: !!selectedEntity,
      canStartLinkFromSelection: !!selectedEntity,
      });
    }, [onToolStateChange, linkType, zoomPercent, selectedEntity]);

    const handleNodesChange = useCallback((changes: NodeChange<Node<WorldNodeData>>[]) => {
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          pendingNodePositionsRef.current[change.id] = change.position;
        } else if (change.type === "remove") {
          delete pendingNodePositionsRef.current[change.id];
        }
      }

      setFlowNodes((current) => applyNodeChanges(changes, current));
    }, [setFlowNodes]);

    const fitToContent = useCallback(() => reactFlowRef.current?.fitView({ padding: 0.22, duration: 800 }), []);
    const resetCamera = useCallback(() => reactFlowRef.current?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 800 }), []);

  const onNodeClick: NodeMouseHandler = useCallback((event, node) => {
    // Prevent click if we just finished dragging
    if (Date.now() - recentDragTimestampRef.current < 200) return;

    // Group assign mode — works in any mode, toggle node into selection set
    if (groupAssignMode && !node.id.startsWith("cluster:")) {
      setGroupSelectedNodeIds((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
      return;
    }

    if (node.id.startsWith("cluster:")) {
      setExpandedClusterIds((current) => {
        const next = new Set(current);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
      return;
    }

    const nodeTone = node.data.tone as BoardSelection["type"];
    const parts = node.id.split(":");
    const sel: ConnectableSelection = { type: parts[0] as any, id: parts[1] };

    if (activeTool === "delete") {
      onRequestDeleteSelection({ type: nodeTone, id: parts[1] });
      return;
    }

    if (activeTool === "connect") {
      if (!connectionSourceKey || connectionSourceKey === CONNECT_ARMED) {
        setConnectionSourceKey(node.id);
        onSelectEntity({ type: sel.type, id: sel.id });
      } else {
        const [st, si] = connectionSourceKey.split(":");
        if (node.id !== connectionSourceKey) {
          void onCreateBoardLink({
            linkType,
            source: { type: st as any, id: si },
            target: sel,
          }).then(() => {
            requestAnimationFrame(() => {
              setConnectionSourceKey(null);
              onSelectEntity({ type: sel.type, id: sel.id });
            });
          }).catch(() => setConnectionSourceKey(null));
        } else {
          setConnectionSourceKey(null);
        }
      }
      return;
    }

    onSelectEntity({ type: nodeTone, id: parts[1] });
  }, [activeTool, connectionSourceKey, groupAssignMode, linkType, onSelectEntity, onCreateBoardLink, onRequestDeleteSelection]);

    const onPaneClick = useCallback((e: React.MouseEvent) => {
      if (isDraggingNodeRef.current || Date.now() - recentDragTimestampRef.current < 160) {
        return;
      }

      const pos = reactFlowRef.current?.screenToFlowPosition({ x: e.clientX, y: e.clientY }) ?? { x: 0, y: 0 };

      if (addMode !== "none") {
        const optimisticId = `optimistic:${++optimisticNodeCounterRef.current}`;
        const toneMap: Record<string, WorldNodeData["tone"]> = {
          agent: "agent", faction: "campaignNode", front: "campaignNode",
          event: "campaignNode", place: "campaignNode",
        };
        const optimisticNode: Node<WorldNodeData> = {
          id: optimisticId,
          type: nodeTypeForKind(addMode),
          position: pos,
          draggable: false,
          data: {
            label: `New ${addMode}`,
            subtitle: addMode,
            accent: accentFor(addMode),
            tone: toneMap[addMode] ?? "campaignNode",
            nodeKind: addMode,
            dimmed: false,
            labelVisibility: "full",
            emphasis: "primary",
          },
        };
        setOptimisticNodes((prev) => [...prev, optimisticNode]);
        optimisticNodeBaseCountRef.current.set(optimisticId, baseNodeCountRef.current);

        const removeOptimistic = () => {
          setOptimisticNodes((prev) => prev.filter((n) => n.id !== optimisticId));
          optimisticNodeBaseCountRef.current.delete(optimisticId);
        };

        void onCreateCampaignNode({ name: `New ${addMode}`, kind: addMode as any, ...pos }).finally(removeOptimistic);
        setAddMode("none");
      } else {
        onSelectEntity(null);
        setConnectionSourceKey(null);
      }
    }, [addMode, onCreateCampaignNode, onSelectEntity]);

    const onNodeDragStart: OnNodeDrag = useCallback((_, node) => {
      isDraggingNodeRef.current = true;
      pendingNodePositionsRef.current[node.id] = node.position;
      notifyDraggingChange(true);
    }, [notifyDraggingChange]);

    const onNodeDrag: OnNodeDrag = useCallback((_, node) => {
      pendingNodePositionsRef.current[node.id] = node.position;
    }, []);

    const onNodeDragStop: OnNodeDrag = useCallback(async (_, node) => {
      const [type, id] = node.id.split(":");
      const pos = node.position;
      
      // Update stable cache with new position
      stableNodePositionsRef.current.set(node.id, { ...pos });
      pendingNodePositionsRef.current[node.id] = pos;

      // Suppress auto-layouts for this node
      if (type === "campaignNode") {
        setSuppressedCampaignLayoutIds((current) => new Set([...current, node.id]));
      }
      setSuppressedStructuredLayoutIds((current) => new Set([...current, node.id]));

      recentDragTimestampRef.current = Date.now();
      isDraggingNodeRef.current = false;
      notifyDraggingChange(false);

      // Persist to server
      try {
        if (type === "agent") {
          await onMoveAgent(id, pos);
        } else if (type === "campaignNode") {
          await onMoveCampaignNode(id, pos);
        } else if (type === "region") {
          await onMoveRegion(id, pos);
        } else if (type === "site") {
          const nr = findNearestRegion(map, pos);
          await onMoveSite(id, { ...pos, regionId: nr?.id ?? null });
        } else if (type === "token") {
          const nr = findNearestRegion(map, pos);
          const ns = findNearestSite(map, pos);
          await onMoveToken(id, { ...pos, regionId: nr?.id ?? null, siteId: ns?.id ?? null });
        }
        
        // Clear pending after successful save
        delete pendingNodePositionsRef.current[node.id];
      } catch (error) {
        console.error("Failed to persist node position:", error);
        // On error, remove from stable cache so it can revert
        stableNodePositionsRef.current.delete(node.id);
        delete pendingNodePositionsRef.current[node.id];
      }
    }, [map, notifyDraggingChange, onMoveAgent, onMoveCampaignNode, onMoveRegion, onMoveSite, onMoveToken]);

    const onEdgeClick: EdgeMouseHandler = useCallback((_, edge) => {
    const parts = edge.id.split(":");
    onSelectEntity({ type: parts[0] as BoardSelection["type"], id: parts[1] });
  }, [onSelectEntity]);

  useImperativeHandle(ref, () => ({
    focusSelection: () => {
      if (!selectedEntity) return;
      const id = selectionToFlowId(selectedEntity);
      const node = reactFlowRef.current?.getNodes().find(n => n.id === id);
      if (node) reactFlowRef.current?.setCenter(node.position.x, node.position.y, { zoom: 1.2, duration: 800 });
    },
    beginLinkFromSelection: () => {
      if (selectedEntity && ["agent", "campaignNode", "region", "site", "front"].includes(selectedEntity.type)) {
        setConnectionSourceKey(flowNodeId(selectedEntity.type, (selectedEntity as any).id));
      }
    },
    clearSelection: () => {
      onSelectEntity(null);
      setConnectionSourceKey(null);
    },
    fitToContent,
    resetCamera,
    setBoardTool,
  }), [selectedEntity, onSelectEntity, fitToContent, resetCamera, setBoardTool]);

  const showConnectionHint = connectionSourceKey && connectionSourceKey !== CONNECT_ARMED;

  const selectedNode = useMemo(() => {
    if (!selectedEntity || activeTool === "connect" || activeTool === "delete") return null;
    const flowId = selectionToFlowId(selectedEntity);
    return flowId ? flowNodes.find(n => n.id === flowId) ?? null : null;
  }, [selectedEntity, flowNodes, activeTool]);

  const handleQuickConnect = useCallback(() => {
    if (selectedEntity && canStartLinkFromSelection) {
      setBoardTool("connect");
      setConnectionSourceKey(flowNodeId(selectedEntity.type, (selectedEntity as any).id));
    }
  }, [selectedEntity, canStartLinkFromSelection, setBoardTool]);

  const handleQuickDelete = useCallback(() => {
    if (selectedEntity) {
      onRequestDeleteSelection(selectedEntity);
    }
  }, [selectedEntity, onRequestDeleteSelection]);

  const handleUpdateNode = useCallback((flowNodeId: string, patch: { name?: string; description?: string; status?: string }) => {
    const [type, id] = flowNodeId.split(":");
    if (type === "campaignNode") void onUpdateCampaignNode(id, patch);
    if (type === "agent") void onUpdateAgent(id, patch);
  }, [onUpdateCampaignNode, onUpdateAgent]);

  const handleUpdateLink = useCallback((linkId: string, patch: { linkType?: BoardLinkType }) => {
    void onUpdateBoardLink(linkId, patch);
  }, [onUpdateBoardLink]);

  return (
    <div className="relative h-full overflow-hidden rounded-[inherit] bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_34%),linear-gradient(180deg,#02070b_0%,#061118_48%,#04070a_100%)]">
      <NodeQuickActions
        selectedNode={selectedNode}
        viewport={viewport}
        onConnect={handleQuickConnect}
        onDelete={handleQuickDelete}
      />
      <NodeEditorPanel
        node={selectedNode}
        boardLinks={boardLinks}
        selectedEntity={selectedEntity}
        onUpdateNode={handleUpdateNode}
        onUpdateLink={handleUpdateLink}
        aiSettings={aiSettings}
      />
      <ReactFlow
        nodes={optimisticNodes.length > 0 ? [...flowNodes, ...optimisticNodes] : flowNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onInit={(instance) => { reactFlowRef.current = instance; instance.fitView({ padding: 0.22, duration: 400 }); updateViewportState(); }}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onMoveEnd={updateViewportState}
        panOnDrag={[1, 2]}
        nodesDraggable={activeTool !== "delete" && activeTool !== "connect" && !groupAssignMode}
        selectionOnDrag={false}
        nodeClickDistance={8}
        zoomOnScroll={true}
        zoomOnPinch={true}
        panOnScroll={false}
        minZoom={0.14}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        className="reactflow-world"
      >
        <Background variant={BackgroundVariant.Dots} gap={GRID_SIZE} size={1.2} color="rgba(56,189,238,0.12)" />
        <CanvasToolbar tool={activeTool} onSetTool={setBoardTool} onAdd={setAddMode} onFit={fitToContent} onReset={resetCamera} />
        <CanvasStatusPanel nodeCount={flowNodes.length} linkCount={edges.length} tool={activeTool} />
        <CanvasConnectionHint active={!!showConnectionHint} linkType={linkType} onChangeLinkType={setLinkType} />
        <GroupsPanel
          groups={[...boardGroups, ...optimisticBoardGroups]}
          assignMode={groupAssignMode}
          selectedNodeIds={groupSelectedNodeIds}
          onSetAssignMode={(id) => { setGroupAssignMode(id); setGroupSelectedNodeIds(new Set()); }}
          onConfirmAssign={handleGroupAssignConfirm}
          onConfirmRemove={handleGroupRemoveConfirm}
          onCreateGroup={handleCreateGroup}
          onDeleteGroup={(id) => onRequestDeleteSelection({ type: "boardGroup", id })}
          onSelectGroup={(id) => onSelectEntity({ type: "boardGroup", id })}
          selectedGroupId={selectedEntity?.type === "boardGroup" ? selectedEntity.id : null}
          nodeGroupMembership={nodeGroupMembership}
        />
        <Panel position="bottom-right" className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/80 px-2.5 py-1.5 backdrop-blur-xl shadow-2xl">
          <Maximize size={11} className="text-white/40" />
          <span className="text-[10px] font-semibold text-white/70 tabular-nums">{zoomPercent}%</span>
        </Panel>
        <Controls showInteractive={false} position="bottom-right" className="!bottom-14 !right-4" />
      </ReactFlow>
      <style jsx global>{`
        .reactflow-world .react-flow__attribution { display: none !important; }
        .reactflow-world .react-flow__panel { margin: 18px; }
      `}</style>
    </div>
  );
});
