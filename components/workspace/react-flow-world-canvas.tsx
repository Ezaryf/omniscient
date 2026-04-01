"use client";

import "@xyflow/react/dist/style.css";

import React, { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import {
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
  type OnNodeDrag,
  type NodeMouseHandler,
  type ReactFlowInstance,
  useNodesState,
} from "@xyflow/react";
import {
  Castle,
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
import { nodeTypes, type WorldNodeData } from "./canvas-nodes";
import { useCanvasNodes } from "./useCanvasNodes";
import { useCanvasEdges } from "./useCanvasEdges";

type AddMode = "none" | "region" | "site" | "token" | "agent" | "place" | "faction" | "front" | "event";
type ConnectableSelection = { type: "agent" | "campaignNode" | "region" | "site" | "front"; id: string };
const CONNECT_ARMED = "__armed__";

interface ReactFlowWorldCanvasProps {
  readonly agents: Agent[];
  readonly boardLinks: BoardLink[];
  readonly campaignNodes: CampaignNode[];
  readonly relationships: RelationshipEdge[];
  readonly map: MapLayer;
  readonly fronts: FrontClock[];
  readonly selectedEntity: BoardSelection | null;
  readonly onSelectEntity: (selection: BoardSelection | null) => void;
  readonly onMoveSite: (siteId: string, patch: { x: number; y: number; regionId?: string | null }) => Promise<void>;
  readonly onMoveRegion: (regionId: string, patch: { x: number; y: number }) => Promise<void>;
  readonly onMoveAgent: (agentId: string, patch: { x: number; y: number }) => Promise<void>;
  readonly onMoveCampaignNode: (nodeId: string, patch: { x?: number; y?: number; radius?: number }) => Promise<void>;
  readonly onCreateRegion: (payload: { name: string; kind: "frontier" | "homeland" | "wilds" | "city-state" | "sea"; x: number; y: number; radius?: number }) => Promise<void>;
  readonly onCreateSite: (payload: { name: string; kind: "waypoint" | "capital" | "stronghold" | "market" | "ruin" | "sanctum"; x: number; y: number; regionId?: string | null }) => Promise<void>;
  readonly onCreateRoute: (payload: { name: string; fromSiteId: string; toSiteId: string }) => Promise<void>;
  readonly onCreateBoardLink: (payload: {
    linkType: BoardLinkType;
    source: { type: "agent" | "campaignNode" | "region" | "site" | "front"; id: string };
    target: { type: "agent" | "campaignNode" | "region" | "site" | "front"; id: string };
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
  readonly onRequestDeleteSelection: (selection: BoardSelection | null) => void;
  readonly initialTool?: BoardTool;
  readonly onToolStateChange?: (state: WorldCanvasUiState) => void;
  readonly layoutPositions?: Map<string, { x: number; y: number }>;
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

function flowPosition(position: Position, layoutPositions?: Map<string, { x: number; y: number }>, nodeId?: string) {
  if (nodeId && layoutPositions?.has(nodeId)) {
    const layoutPos = layoutPositions.get(nodeId)!;
    return { x: layoutPos.x, y: layoutPos.y };
  }
  return { x: position.x, y: position.y };
}

function selectionToFlowId(selection: BoardSelection | null) {
  if (!selection) return null;
  if (["agent", "campaignNode", "region", "site", "front"].includes(selection.type)) {
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
  { tool: "region", label: "Region", icon: Waypoints },
  { tool: "site", label: "Site", icon: MapPinned },
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

// --- Sub-components for UI Panels ---

interface ToolbarProps {
  tool: BoardTool;
  onSetTool: (tool: BoardTool) => void;
  onAdd: (type: AddMode) => void;
  onFit: () => void;
  onReset: () => void;
}

const CanvasToolbar = memo(({ tool, onSetTool, onAdd, onFit, onReset }: ToolbarProps) => (
  <Panel position="top-left" className="flex flex-col gap-3">
    <div className="flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-black/60 p-1.5 backdrop-blur-xl shadow-2xl">
      <ToolButton active={tool === "inspect"} icon={MousePointer2} onClick={() => onSetTool("inspect")} label="Inspect" />
      <ToolButton active={tool === "move"} icon={Hand} onClick={() => onSetTool("move")} label="Move" />
      <ToolButton active={tool === "connect"} icon={Zap} onClick={() => onSetTool("connect")} label="Connect nodes" />
      <div className="my-1 h-px bg-white/5" />
      <ToolButton active={tool === "delete"} icon={Trash2} onClick={() => onSetTool("delete")} label="Delete" className="text-red-400 hover:bg-red-400/10" />
    </div>

    <div className="rounded-2xl border border-white/10 bg-black/40 p-3 backdrop-blur-md">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">Add to board</div>
      <div className="grid grid-cols-4 gap-2">
        {ADD_TOOL_CONFIG.map(({ tool: t, label, icon: Icon }) => (
          <button
            key={t}
            onClick={() => onAdd(t)}
            className="group flex flex-col items-center gap-1.5 rounded-xl border border-white/5 bg-white/5 p-2 transition-all hover:bg-white/10 active:scale-95"
            title={label}
          >
            <div className="h-4 w-4 text-white/40 group-hover:text-white/90 transition-colors">
              <Icon size={16} />
            </div>
          </button>
        ))}
      </div>
    </div>

    <div className="flex gap-2">
      <button onClick={onFit} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-black/40 text-white/50 hover:bg-white/5 hover:text-white transition-all">
        <Maximize size={18} />
      </button>
      <button onClick={onReset} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-black/40 text-white/50 hover:bg-white/5 hover:text-white transition-all">
        <RotateCcw size={18} />
      </button>
    </div>
  </Panel>
));

const ToolButton = memo(({ active, icon: Icon, onClick, label, className = "" }: any) => (
  <button
    onClick={onClick}
    className={`group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ${
      active ? "bg-white/15 text-white shadow-lg shadow-white/5" : "text-white/40 hover:bg-white/5 hover:text-white/70"
    } ${className}`}
  >
    <Icon size={18} />
    <span className="absolute left-full ml-3 hidden rounded-lg border border-white/10 bg-black/90 px-2.5 py-1.5 text-[11px] font-medium text-white whitespace-nowrap group-hover:block z-50">
      {label}
    </span>
  </button>
));

const CanvasStatusPanel = memo(({ nodeCount, linkCount }: { nodeCount: number, linkCount: number }) => (
  <Panel position="top-right" className="flex flex-col items-end gap-3">
    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/40 px-4 py-2.5 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
        <span className="text-[11px] font-medium text-white/70 tracking-tight">
          <span className="text-white font-bold">{nodeCount}</span> ENTITIES
        </span>
      </div>
      <div className="h-3 w-px bg-white/10" />
      <div className="flex items-center gap-2">
        <Zap size={10} className="text-amber-400" />
        <span className="text-[11px] font-medium text-white/70 tracking-tight">
          <span className="text-white font-bold">{linkCount}</span> LINKS
        </span>
      </div>
    </div>
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-md max-w-[200px]">
      <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/30 px-1">Relationships</div>
      <div className="space-y-3">
        {BOARD_LINK_LEGEND.map(r => (
          <div key={r.label} className="flex gap-3">
            <div className="mt-1.5 h-1 w-4 shrink-0 rounded-full" style={{ backgroundColor: EDGE_TONE[r.type]?.stroke ?? "#fff" }} />
            <div className="text-[11px] font-bold text-white/80 leading-none">{r.label}</div>
          </div>
        ))}
      </div>
    </div>
  </Panel>
));

const CanvasConnectionHint = memo(({ active }: { active: boolean }) => (
  active ? (
    <Panel position="bottom-center" className="mb-2">
      <div className="flex items-center gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-5 py-3 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Zap size={16} className="text-indigo-400 animate-pulse" />
        <div className="flex flex-col">
          <span className="text-xs font-bold text-white tracking-wide">CONNECTION BOARD ACTIVE</span>
          <span className="text-[10px] font-medium text-indigo-300/80">Select target node to establish relationship</span>
        </div>
      </div>
    </Panel>
  ) : null
));

// --- Main Component ---

export const ReactFlowWorldCanvas = forwardRef<WorldCanvasHandle, ReactFlowWorldCanvasProps>(function ReactFlowWorldCanvas(
  {
    agents,
    boardLinks,
    campaignNodes,
    relationships,
    map,
    fronts,
    selectedEntity,
    onSelectEntity,
    onMoveSite,
    onMoveRegion,
    onMoveAgent,
    onMoveCampaignNode,
    onCreateRegion,
    onCreateSite,
    onCreateRoute,
    onCreateBoardLink,
    onCreateCampaignNode,
    onRequestDeleteSelection,
    initialTool = "inspect",
    onToolStateChange,
    layoutPositions,
  },
  ref
) {
  const reactFlowRef = useRef<ReactFlowInstance<Node<WorldNodeData>, Edge> | null>(null);
  const pendingNodePositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const [optimisticLink, setOptimisticLink] = useState<any>(null);
  const [primaryTool, setPrimaryTool] = useState<"inspect" | "move">(initialTool === "move" ? "move" : "inspect");
  const [addMode, setAddMode] = useState<AddMode>("none");
  const [deleteMode, setDeleteMode] = useState(initialTool === "delete");
  const [connectionSourceKey, setConnectionSourceKey] = useState<string | null>(null);
  const [frontLayoutPositions, setFrontLayoutPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [linkType, setLinkType] = useState<BoardLinkType>("causal");
  const [zoomPercent, setZoomPercent] = useState(100);
  const [showFronts] = useState(true);
  const [showRegions] = useState(true);

  // Derived tool state
  const activeTool: BoardTool = useMemo(() => {
    if (addMode !== "none") return addMode;
    if (connectionSourceKey) return "connect";
    if (deleteMode) return "delete";
    return primaryTool;
  }, [addMode, connectionSourceKey, deleteMode, primaryTool]);

  const canStartLinkFromSelection = useMemo(() => 
    selectedEntity && ["agent", "campaignNode", "region", "site", "front"].includes(selectedEntity.type),
    [selectedEntity]
  );

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

  const tieredPositions = useMemo(() => 
    needsAutoLayout(campaignNodes) ? computeTieredLayout(campaignNodes, layoutPositions).positions : null,
    [campaignNodes, layoutPositions]
  );

  const connectedNodeIds = useMemo(() => {
    if (!selectedEntity) return new Set<string>();
    const selectedFlowId = selectionToFlowId(selectedEntity);
    if (!selectedFlowId) return new Set<string>();
    
    const connected = new Set<string>([selectedFlowId]);
    boardLinks.forEach(link => {
      const s = flowNodeId(link.source.type, link.source.id);
      const t = flowNodeId(link.target.type, link.target.id);
      if (s === selectedFlowId || t === selectedFlowId) { connected.add(s); connected.add(t); }
    });
    return connected;
  }, [selectedEntity, boardLinks]);

  const hasActiveSpotlight = selectedEntity !== null && connectedNodeIds.size > 1;

  const baseNodes = useCanvasNodes({
    agents, campaignNodes, map, fronts, selectedEntity, activeTool,
    connectionSourceKey, frontNodes, layoutPositions, tieredPositions,
    hasActiveSpotlight, connectedNodeIds, flowNodeId, nodeTypeForKind,
    flowPosition, accentFor, showFronts, showRegions
  });

  const edges = useCanvasEdges({
    boardLinks, map, relationships, selectedEntity, optimisticLink,
    showRelationships: true, hasActiveSpotlight, connectedNodeIds,
    flowNodeId, selectionToFlowId, EDGE_TONE
  });

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<Node<WorldNodeData>>(baseNodes);

  useEffect(() => {
    setFlowNodes(current => {
      let changed = false;
      const currentById = new Map(current.map(n => [n.id, n]));
      const next = baseNodes.map(node => {
        const curr = currentById.get(node.id);
        const pending = pendingNodePositionsRef.current[node.id];
        const targetPos = pending ?? (curr?.dragging ? curr.position : node.position);
        if (!curr || JSON.stringify(curr.data) !== JSON.stringify(node.data) || curr.selected !== node.selected || Math.abs(curr.position.x - targetPos.x) > 0.1) {
          changed = true;
          return { ...node, position: targetPos };
        }
        return curr;
      });
      return changed || next.length !== current.length ? next : current;
    });
    pendingNodePositionsRef.current = {};
  }, [baseNodes, setFlowNodes]);

  const updateViewportState = useCallback(() => {
    const instance = reactFlowRef.current;
    if (instance) setZoomPercent(Math.round(instance.getViewport().zoom * 100));
  }, []);

  const setBoardTool = useCallback((tool: BoardTool) => {
    if (tool === "inspect" || tool === "move") { setPrimaryTool(tool); setAddMode("none"); setDeleteMode(false); setConnectionSourceKey(null); }
    else if (tool === "delete") { setDeleteMode(true); setAddMode("none"); setConnectionSourceKey(null); }
    else if (tool === "connect") { setConnectionSourceKey(CONNECT_ARMED); setAddMode("none"); setDeleteMode(false); }
    else { setAddMode(tool as AddMode); setDeleteMode(false); setConnectionSourceKey(null); }
    onToolStateChange?.({ tool, labelDensity: "balanced" });
  }, [onToolStateChange]);

  const fitToContent = useCallback(() => reactFlowRef.current?.fitView({ padding: 0.22, duration: 800 }), []);
  const resetCamera = useCallback(() => reactFlowRef.current?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 800 }), []);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    if (activeTool === "delete") { onRequestDeleteSelection({ type: node.data.tone, id: node.id.split(":")[1] }); return; }
    if (activeTool === "connect") {
      const parts = node.id.split(":");
      const sel: ConnectableSelection = { type: parts[0] as any, id: parts[1] };
      if (!connectionSourceKey || connectionSourceKey === CONNECT_ARMED) { setConnectionSourceKey(node.id); onSelectEntity({ type: sel.type, id: sel.id }); }
      else {
        const [st, si] = connectionSourceKey.split(":");
        if (node.id !== connectionSourceKey) onCreateBoardLink({ linkType, source: { type: st as any, id: si }, target: sel });
        setConnectionSourceKey(null);
      }
      return;
    }
    onSelectEntity({ type: node.data.tone, id: node.id.split(":")[1] });
  }, [activeTool, connectionSourceKey, linkType, onSelectEntity, onCreateBoardLink, onRequestDeleteSelection]);

  const onPaneClick = useCallback((e: React.MouseEvent) => {
    if (addMode !== "none") {
      const pos = reactFlowRef.current?.screenToFlowPosition({ x: e.clientX, y: e.clientY }) ?? { x: 0, y: 0 };
      if (addMode === "region") onCreateRegion({ name: "New Region", kind: "frontier", ...pos });
      else if (addMode === "site") onCreateSite({ name: "New Site", kind: "waypoint", ...pos });
      else if (addMode === "agent") onCreateCampaignNode({ name: "New Actor", kind: "agent", ...pos });
      else if (addMode === "faction") onCreateCampaignNode({ name: "New Faction", kind: "faction", ...pos });
      else if (addMode === "front") onCreateCampaignNode({ name: "New Front", kind: "front", ...pos });
      else if (addMode === "event") onCreateCampaignNode({ name: "New Event", kind: "event", ...pos });
      else if (addMode === "place") onCreateCampaignNode({ name: "New Place", kind: "place", ...pos });
      setAddMode("none");
    } else { onSelectEntity(null); setConnectionSourceKey(null); }
  }, [addMode, onCreateRegion, onCreateSite, onCreateCampaignNode, onSelectEntity]);

  const onNodeDragStop: OnNodeDrag = useCallback((_, node) => {
    const [type, id] = node.id.split(":");
    const pos = node.position;
    if (type === "agent") onMoveAgent(id, pos);
    else if (type === "campaignNode") onMoveCampaignNode(id, pos);
    else if (type === "region") onMoveRegion(id, pos);
    else if (type === "site") onMoveSite(id, pos);
  }, [onMoveAgent, onMoveCampaignNode, onMoveRegion, onMoveSite]);

  const onEdgeClick: EdgeMouseHandler = useCallback((_, edge) => {
    const parts = edge.id.split(":");
    onSelectEntity({ type: parts[0] as any, id: parts[1] });
  }, [onSelectEntity]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => reactFlowRef.current?.zoomIn(),
    zoomOut: () => reactFlowRef.current?.zoomOut(),
    fitView: fitToContent,
  }), [fitToContent]);

  const showConnectionHint = connectionSourceKey && connectionSourceKey !== CONNECT_ARMED;

  return (
    <div className="relative h-full overflow-hidden rounded-[inherit] bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_34%),linear-gradient(180deg,#02070b_0%,#061118_48%,#04070a_100%)]">
      <ReactFlow
        nodes={flowNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onInit={(instance) => { reactFlowRef.current = instance; instance.fitView({ padding: 0.22, duration: 400 }); updateViewportState(); }}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
        onMoveEnd={updateViewportState}
        panOnDrag={primaryTool === "move"}
        nodesDraggable={["inspect", "move", "connect"].includes(activeTool)}
        minZoom={0.14}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        className="reactflow-world"
      >
        <Background variant={BackgroundVariant.Dots} gap={GRID_SIZE} size={1.2} color="rgba(56,189,248,0.16)" />
        <CanvasToolbar tool={activeTool} onSetTool={setBoardTool} onAdd={setAddMode} onFit={fitToContent} onReset={resetCamera} />
        <CanvasStatusPanel nodeCount={flowNodes.length} linkCount={edges.length} />
        <CanvasConnectionHint active={!!showConnectionHint} />
        <Panel position="bottom-right" className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/40 px-3 py-1.5 backdrop-blur-md">
          <Maximize size={12} className="text-white/30" />
          <span className="text-[10px] font-bold text-white/40 tracking-widest tabular-nums">{zoomPercent}%</span>
        </Panel>
        <Controls showInteractive={false} position="top-right" />
      </ReactFlow>
      <style jsx global>{`
        .reactflow-world .react-flow__attribution { display: none !important; }
        .reactflow-world .react-flow__panel { margin: 18px; }
      `}</style>
    </div>
  );
});
