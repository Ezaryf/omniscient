"use client";

import "@xyflow/react/dist/style.css";

import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position as HandlePosition,
  ReactFlow,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type OnNodeDrag,
  type NodeMouseHandler,
  type NodeProps,
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
  MousePointer2,
  PlusCircle,
  Shield,
  Sparkles,
  Trash2,
  UserRound,
  Waypoints,
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
import type { BoardTool, WorldCanvasHandle, WorldCanvasUiState } from "@/components/workspace/world-canvas";

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
}

type WorldNodeData = {
  label: string;
  subtitle: string;
  accent: string;
  tone: "agent" | "campaignNode" | "region" | "site" | "front";
};

const GRID_SIZE = 80;

function flowNodeId(type: ConnectableSelection["type"], id: string) {
  return `${type}:${id}`;
}

function findNearestRegion(map: MapLayer, pos: Position) {
  let best: { id: string } | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const region of map.regions) {
    const dx = region.center.x - pos.x;
    const dy = region.center.y - pos.y;
    const d = Math.sqrt(dx * dx + dy * dy);
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
    const dx = site.position.x - pos.x;
    const dy = site.position.y - pos.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestD) {
      best = site;
      bestD = d;
    }
  }
  return best;
}

function flowPosition(position: Position) {
  return { x: position.x, y: position.y };
}

function selectionToFlowId(selection: BoardSelection | null) {
  if (!selection) return null;
  if (
    selection.type === "agent" ||
    selection.type === "campaignNode" ||
    selection.type === "region" ||
    selection.type === "site" ||
    selection.type === "front"
  ) {
    return flowNodeId(selection.type, selection.id);
  }
  if (selection.type === "boardLink") return `boardLink:${selection.id}`;
  if (selection.type === "route") return `route:${selection.id}`;
  return null;
}

const ADD_TOOL_CONFIG: Array<{ tool: Exclude<BoardTool, "inspect" | "move" | "connect" | "delete">; label: string; icon: typeof PlusCircle }> = [
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

const BOARD_LINK_TYPE_OPTIONS: Array<{ type: Exclude<BoardLinkType, "route">; label: string }> = [
  { type: "alliance", label: "Ally" },
  { type: "conflict", label: "Foe" },
  { type: "causal", label: "Influence" },
  { type: "dependency", label: "Dependency" },
];

function boardLinkTypeLabel(type: BoardLinkType) {
  return BOARD_LINK_LEGEND.find((entry) => entry.type === type)?.label ?? type;
}

function isConnectableSelection(selection: BoardSelection | null): selection is ConnectableSelection {
  return Boolean(
    selection &&
      (selection.type === "agent" ||
        selection.type === "campaignNode" ||
        selection.type === "region" ||
        selection.type === "site" ||
        selection.type === "front")
  );
}

const EntityNode = memo(function EntityNode({ data, selected }: NodeProps<Node<WorldNodeData>>) {
  return (
    <>
      <Handle type="target" position={HandlePosition.Top} className="!h-2 !w-2 !border-0 !bg-transparent !opacity-0" />
      <Handle type="target" position={HandlePosition.Left} className="!h-2 !w-2 !border-0 !bg-transparent !opacity-0" />
      <div
        className={`min-w-[150px] rounded-[16px] border px-3 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition ${
          selected
            ? "border-white/28 bg-[rgba(20,26,33,0.98)]"
            : "border-white/10 bg-[rgba(12,16,21,0.96)]"
        }`}
        style={{
          boxShadow: selected
            ? `0 0 0 1px ${data.accent} inset, 0 16px 32px rgba(0,0,0,0.32)`
            : `0 1px 0 rgba(255,255,255,0.03) inset, 0 10px 24px rgba(0,0,0,0.24)`,
        }}
      >
        <div className="mb-2 h-1.5 rounded-full opacity-90" style={{ backgroundColor: data.accent }} />
        <div className="truncate text-sm font-semibold text-white">{data.label}</div>
        <div className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
          {data.subtitle}
        </div>
      </div>
      <Handle type="source" position={HandlePosition.Right} className="!h-2 !w-2 !border-0 !bg-transparent !opacity-0" />
      <Handle type="source" position={HandlePosition.Bottom} className="!h-2 !w-2 !border-0 !bg-transparent !opacity-0" />
    </>
  );
});

const nodeTypes = {
  entity: EntityNode,
};

function accentFor(kind: string) {
  switch (kind) {
    case "agent":
      return "#38bdf8";
    case "faction":
      return "#2dd4bf";
    case "front":
      return "#f59e0b";
    case "event":
      return "#fb7185";
    case "place":
      return "#34d399";
    case "region":
      return "#14b8a6";
    case "site":
      return "#c084fc";
    default:
      return "#94a3b8";
  }
}

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
    onCreateToken,
    onCreateRoute,
    onCreateBoardLink,
    onCreateCampaignNode,
    onRequestDeleteSelection,
    initialTool = "inspect",
    onToolStateChange,
  },
  ref
) {
  const reactFlowRef = useRef<ReactFlowInstance<Node<WorldNodeData>, Edge> | null>(null);
  const pendingNodePositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const [optimisticLink, setOptimisticLink] = useState<{
    id: string;
    type: BoardLinkType;
    source: ConnectableSelection;
    target: ConnectableSelection;
    label: string | null;
  } | null>(null);
  const [primaryTool, setPrimaryTool] = useState<"inspect" | "move">(initialTool === "move" ? "move" : "inspect");
  const [addMode, setAddMode] = useState<AddMode>("none");
  const [deleteMode, setDeleteMode] = useState(initialTool === "delete");
  const [connectionSourceKey, setConnectionSourceKey] = useState<string | null>(null);
  const [frontLayoutPositions, setFrontLayoutPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [linkType, setLinkType] = useState<BoardLinkType>("causal");
  const [zoomPercent, setZoomPercent] = useState(100);
  const [showGrid] = useState(true);
  const [showRelationships] = useState(true);
  const [showFronts] = useState(true);
  const [showRegions] = useState(true);
  const [snapToGrid] = useState(true);
  const labelDensity: WorldCanvasUiState["labelDensity"] = "balanced";

  const activeTool: BoardTool =
    addMode !== "none" ? addMode : connectionSourceKey ? "connect" : deleteMode ? "delete" : primaryTool;

  const canDeleteSelection = Boolean(
    selectedEntity &&
      ["agent", "campaignNode", "region", "site", "route", "front", "boardLink"].includes(selectedEntity.type)
  );

  const canStartLinkFromSelection = Boolean(
    selectedEntity &&
      ["agent", "campaignNode", "region", "site", "front"].includes(selectedEntity.type)
  );

  const frontNodes = useMemo(() => {
    return fronts.map((front, index) => {
      const region = map.regions.find((candidate) => candidate.id === front.regionId);
      const base = region?.center ?? { x: index * 180, y: -180 };
      const fallbackPosition = {
        x: base.x + 120,
        y: base.y - 120 - index * 42,
      };
      return {
        front,
        position: frontLayoutPositions[front.id] ?? fallbackPosition,
      };
    });
  }, [frontLayoutPositions, fronts, map.regions]);

  useEffect(() => {
    setFrontLayoutPositions((current) => {
      const next: Record<string, { x: number; y: number }> = {};
      let changed = false;

      for (const [index, front] of fronts.entries()) {
        const existing = current[front.id];
        if (existing) {
          next[front.id] = existing;
          continue;
        }

        const region = map.regions.find((candidate) => candidate.id === front.regionId);
        const base = region?.center ?? { x: index * 180, y: -180 };
        next[front.id] = {
          x: base.x + 120,
          y: base.y - 120 - index * 42,
        };
        changed = true;
      }

      if (Object.keys(current).length !== Object.keys(next).length) {
        changed = true;
      }

      return changed ? next : current;
    });
  }, [fronts, map.regions]);

  const baseNodes = useMemo<Node<WorldNodeData>[]>(() => {
    const flowNodes: Node<WorldNodeData>[] = [];

    if (showRegions) {
      for (const region of map.regions) {
        flowNodes.push({
          id: flowNodeId("region", region.id),
          type: "entity",
          position: flowPosition(region.center),
          draggable: activeTool === "inspect" || activeTool === "move",
          selected:
            (selectedEntity?.type === "region" && selectedEntity.id === region.id) ||
            connectionSourceKey === flowNodeId("region", region.id),
          data: {
            label: region.name,
            subtitle: `Region · ${region.kind}`,
            accent: accentFor("region"),
            tone: "region",
          },
        });
      }
    }

    for (const site of map.sites) {
      flowNodes.push({
        id: flowNodeId("site", site.id),
        type: "entity",
        position: flowPosition(site.position),
        draggable: activeTool === "inspect" || activeTool === "move",
        selected:
          (selectedEntity?.type === "site" && selectedEntity.id === site.id) ||
          connectionSourceKey === flowNodeId("site", site.id),
        data: {
          label: site.name,
          subtitle: `Site · ${site.kind}`,
          accent: accentFor("site"),
          tone: "site",
        },
      });
    }

    for (const agent of agents) {
      flowNodes.push({
        id: flowNodeId("agent", agent.id),
        type: "entity",
        position: flowPosition(agent.position),
        draggable: activeTool === "inspect" || activeTool === "move",
        selected:
          (selectedEntity?.type === "agent" && selectedEntity.id === agent.id) ||
          connectionSourceKey === flowNodeId("agent", agent.id),
        data: {
          label: agent.name,
          subtitle: "Agent",
          accent: accentFor("agent"),
          tone: "agent",
        },
      });
    }

    for (const node of campaignNodes) {
      flowNodes.push({
        id: flowNodeId("campaignNode", node.id),
        type: "entity",
        position: flowPosition(node.position),
        draggable: activeTool === "inspect" || activeTool === "move",
        selected:
          (selectedEntity?.type === "campaignNode" && selectedEntity.id === node.id) ||
          connectionSourceKey === flowNodeId("campaignNode", node.id),
        data: {
          label: node.name,
          subtitle: node.kind,
          accent: accentFor(node.kind),
          tone: "campaignNode",
        },
      });
    }

    if (showFronts) {
      for (const item of frontNodes) {
        flowNodes.push({
          id: flowNodeId("front", item.front.id),
          type: "entity",
          position: item.position,
          draggable: activeTool === "inspect" || activeTool === "move",
          selected:
            (selectedEntity?.type === "front" && selectedEntity.id === item.front.id) ||
            connectionSourceKey === flowNodeId("front", item.front.id),
          data: {
            label: item.front.name,
            subtitle: "Front",
            accent: accentFor("front"),
            tone: "front",
          },
        });
      }
    }

    return flowNodes;
  }, [activeTool, agents, campaignNodes, connectionSourceKey, frontNodes, fronts, map.regions, map.sites, selectedEntity, showFronts, showRegions]);

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<Node<WorldNodeData>>(baseNodes);

  useEffect(() => {
    const nextPending: Record<string, { x: number; y: number }> = {};
    for (const [nodeId, pendingPosition] of Object.entries(pendingNodePositionsRef.current)) {
      const persistedNode = baseNodes.find((node) => node.id === nodeId);
      if (
        persistedNode &&
        (Math.abs(persistedNode.position.x - pendingPosition.x) > 0.5 ||
          Math.abs(persistedNode.position.y - pendingPosition.y) > 0.5)
      ) {
        nextPending[nodeId] = pendingPosition;
      }
    }
    pendingNodePositionsRef.current = nextPending;

    setFlowNodes((current) => {
      const currentById = new Map(current.map((node) => [node.id, node]));
      return baseNodes.map((node) => {
        const currentNode = currentById.get(node.id);
        const pendingPosition = pendingNodePositionsRef.current[node.id];
        return {
          ...node,
          position: pendingPosition ?? (currentNode?.dragging ? currentNode.position : node.position),
        };
      });
    });
  }, [baseNodes, setFlowNodes]);

  const edges = useMemo<Edge[]>(() => {
    const flowEdges: Edge[] = [];

    if (showRelationships) {
      for (const relationship of relationships) {
        flowEdges.push({
          id: `relationship:${relationship.id}`,
          source: flowNodeId("agent", relationship.sourceAgentId),
          target: flowNodeId("agent", relationship.targetAgentId),
          style: { stroke: relationship.trust > 0 ? "#2dd4bf55" : "#f9731655", strokeDasharray: "4 4" },
          selectable: false,
          interactionWidth: 12,
          zIndex: 1,
        });
      }
    }

    for (const route of map.routes) {
      const tone = EDGE_TONE.route;
      flowEdges.push({
        id: `route:${route.id}`,
        source: flowNodeId("site", route.fromSiteId),
        target: flowNodeId("site", route.toSiteId),
        label: route.name,
        markerEnd: { type: MarkerType.ArrowClosed, color: tone.stroke },
        style: {
          stroke: tone.stroke,
          strokeOpacity: selectedEntity?.type === "route" && selectedEntity.id === route.id ? 0.98 : 0.82,
          strokeWidth: selectedEntity?.type === "route" && selectedEntity.id === route.id ? 4.25 : 2.8,
        },
        selected: selectedEntity?.type === "route" && selectedEntity.id === route.id,
        interactionWidth: 24,
        zIndex: 2,
      });
    }

    for (const link of boardLinks) {
      const tone = EDGE_TONE[link.type] ?? EDGE_TONE.causal;
      flowEdges.push({
        id: `boardLink:${link.id}`,
        source: flowNodeId(link.source.type, link.source.id),
        target: flowNodeId(link.target.type, link.target.id),
        label: link.label ?? link.type,
        style: {
          stroke: tone.stroke,
          strokeOpacity: selectedEntity?.type === "boardLink" && selectedEntity.id === link.id ? 1 : 0.94,
          strokeWidth: selectedEntity?.type === "boardLink" && selectedEntity.id === link.id ? 4.2 : 3.1,
          strokeDasharray: link.type === "dependency" ? "7 5" : link.type === "causal" ? "10 6" : undefined,
        },
        selected: selectedEntity?.type === "boardLink" && selectedEntity.id === link.id,
        interactionWidth: 30,
        zIndex: 4,
      });
    }

    if (optimisticLink) {
      const link = optimisticLink;
      const tone = EDGE_TONE[link.type] ?? EDGE_TONE.causal;
      flowEdges.push({
        id: link.id,
        source: flowNodeId(link.source.type, link.source.id),
        target: flowNodeId(link.target.type, link.target.id),
        label: link.label ?? link.type,
        style: {
          stroke: tone.stroke,
          strokeOpacity: 0.92,
          strokeWidth: 3.6,
          strokeDasharray: "8 5",
        },
        animated: true,
        interactionWidth: 24,
        zIndex: 5,
      });
    }

    return flowEdges;
  }, [boardLinks, map.routes, optimisticLink, relationships, selectedEntity, showRelationships]);

  const updateViewportState = useCallback(() => {
    const instance = reactFlowRef.current;
    if (!instance) return;
    setZoomPercent(Math.round(instance.getViewport().zoom * 100));
  }, []);

  const handleConnectableSelection = useCallback(async (selection: ConnectableSelection) => {
    if (!connectionSourceKey || connectionSourceKey === CONNECT_ARMED) {
      setConnectionSourceKey(`${selection.type}:${selection.id}`);
      onSelectEntity({ type: selection.type, id: selection.id });
      return;
    }

    const [sourceType, sourceId] = connectionSourceKey.split(":") as [ConnectableSelection["type"], string];
    if (!sourceType || !sourceId) {
      setConnectionSourceKey(null);
      return;
    }
    if (sourceType === selection.type && sourceId === selection.id) {
      setConnectionSourceKey(null);
      return;
    }

    if (sourceType === "site" && selection.type === "site" && linkType === "route") {
      const from = map.sites.find((site) => site.id === sourceId);
      const to = map.sites.find((site) => site.id === selection.id);
      if (from && to) {
        await onCreateRoute({ name: `${from.name} to ${to.name}`, fromSiteId: from.id, toSiteId: to.id });
      }
    } else {
      setOptimisticLink({
        id: `optimistic:${sourceType}:${sourceId}:${selection.type}:${selection.id}`,
        type: linkType,
        source: { type: sourceType, id: sourceId },
        target: selection,
        label: null,
      });
      await onCreateBoardLink({
        linkType,
        source: { type: sourceType, id: sourceId },
        target: selection,
        label: null,
      });
    }
    onSelectEntity({ type: selection.type, id: selection.id });
    setConnectionSourceKey(CONNECT_ARMED);
  }, [connectionSourceKey, linkType, map.sites, onCreateBoardLink, onCreateRoute, onSelectEntity]);

  useEffect(() => {
    if (!optimisticLink) return;
    const optimistic = optimisticLink;
    const resolved = boardLinks.some((link) =>
      link.type === optimistic.type &&
      ((link.source.type === optimistic.source.type &&
        link.source.id === optimistic.source.id &&
        link.target.type === optimistic.target.type &&
        link.target.id === optimistic.target.id) ||
        (link.source.type === optimistic.target.type &&
          link.source.id === optimistic.target.id &&
          link.target.type === optimistic.source.type &&
          link.target.id === optimistic.source.id))
    );
    if (resolved) {
      setOptimisticLink(null);
    }
  }, [boardLinks, optimisticLink]);

  const onNodeClick = useCallback<NodeMouseHandler<Node<WorldNodeData>>>(
    async (_, node) => {
      const [type, id] = node.id.split(":") as [ConnectableSelection["type"], string];
      if (!id) return;
      if (deleteMode) {
        onRequestDeleteSelection({ type: type as BoardSelection["type"], id });
        return;
      }
      if (connectionSourceKey || activeTool === "connect") {
        await handleConnectableSelection({ type, id });
        return;
      }
      onSelectEntity({ type: type as BoardSelection["type"], id });
    },
    [activeTool, connectionSourceKey, deleteMode, handleConnectableSelection, onRequestDeleteSelection, onSelectEntity]
  );

  const onEdgeClick = useCallback<EdgeMouseHandler<Edge>>(
    (_, edge) => {
      const [type, id] = edge.id.split(":");
      if (!id) return;
      if (type !== "route" && type !== "boardLink") return;
      if (deleteMode) {
        onRequestDeleteSelection({ type: type as BoardSelection["type"], id });
        return;
      }
      onSelectEntity({ type: type as BoardSelection["type"], id });
    },
    [deleteMode, onRequestDeleteSelection, onSelectEntity]
  );

  const onNodeDragStop = useCallback<OnNodeDrag<Node<WorldNodeData>>>(
    async (_, node) => {
      pendingNodePositionsRef.current[node.id] = { x: node.position.x, y: node.position.y };
      const [type, id] = node.id.split(":") as [BoardSelection["type"], string];
      if (type === "front") {
        setFrontLayoutPositions((current) => ({
          ...current,
          [id]: { x: node.position.x, y: node.position.y },
        }));
        return;
      }
      const patch = { x: node.position.x, y: node.position.y };
      if (type === "agent") await onMoveAgent(id, patch);
      if (type === "campaignNode") await onMoveCampaignNode(id, patch);
      if (type === "site") {
        await onMoveSite(id, {
          ...patch,
          regionId: findNearestRegion(map, patch)?.id ?? null,
        });
      }
      if (type === "region") await onMoveRegion(id, patch);
    },
    [map, onMoveAgent, onMoveCampaignNode, onMoveRegion, onMoveSite]
  );

  const onPaneClick = useCallback(
    async (event: React.MouseEvent) => {
      const instance = reactFlowRef.current;
      if (!instance) return;
      const position = instance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const snapped = snapToGrid
        ? { x: Math.round(position.x / GRID_SIZE) * GRID_SIZE, y: Math.round(position.y / GRID_SIZE) * GRID_SIZE }
        : position;

      if (addMode === "region") {
        await onCreateRegion({ name: `Region ${map.regions.length + 1}`, kind: "frontier", x: snapped.x, y: snapped.y, radius: 140 });
        setAddMode("none");
        setPrimaryTool("inspect");
        return;
      }
      if (addMode === "site") {
        await onCreateSite({
          name: `Site ${map.sites.length + 1}`,
          kind: "waypoint",
          x: snapped.x,
          y: snapped.y,
          regionId: findNearestRegion(map, snapped)?.id ?? null,
        });
        setAddMode("none");
        setPrimaryTool("inspect");
        return;
      }
      if (addMode === "token") {
        await onCreateToken({
          name: `Token ${map.tokens.length + 1}`,
          kind: "party",
          x: snapped.x,
          y: snapped.y,
          regionId: findNearestRegion(map, snapped)?.id ?? null,
          siteId: findNearestSite(map, snapped)?.id ?? null,
        });
        setAddMode("none");
        setPrimaryTool("inspect");
        return;
      }
      if (["agent", "place", "faction", "front", "event"].includes(addMode)) {
        const nextIndex = campaignNodes.filter((node) => node.kind === addMode).length + 1;
        await onCreateCampaignNode({
          name: `${addMode.charAt(0).toUpperCase()}${addMode.slice(1)} ${nextIndex}`,
          kind: addMode as "agent" | "faction" | "front" | "event" | "place",
          x: snapped.x,
          y: snapped.y,
          regionId: findNearestRegion(map, snapped)?.id ?? null,
          siteId: findNearestSite(map, snapped)?.id ?? null,
        });
        setAddMode("none");
        setPrimaryTool("inspect");
        return;
      }

      if (activeTool === "connect") {
        setConnectionSourceKey(CONNECT_ARMED);
      }
      onSelectEntity(null);
    },
    [activeTool, addMode, campaignNodes, map, onCreateCampaignNode, onCreateRegion, onCreateSite, onCreateToken, onSelectEntity, snapToGrid]
  );

  const fitToContent = useCallback(() => {
    reactFlowRef.current?.fitView({ padding: 0.16, duration: 240 });
    requestAnimationFrame(updateViewportState);
  }, [updateViewportState]);

  const resetCamera = useCallback(() => {
    reactFlowRef.current?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 240 });
    requestAnimationFrame(updateViewportState);
  }, [updateViewportState]);

  const focusSelection = useCallback(() => {
    const instance = reactFlowRef.current;
    if (!instance || !selectedEntity) return;
    const flowId = selectionToFlowId(selectedEntity);
    if (!flowId) return;

    const node = flowNodes.find((entry) => entry.id === flowId);
    if (node) {
      instance.setCenter(node.position.x + 70, node.position.y + 24, { zoom: Math.max(instance.getZoom(), 1), duration: 240 });
      requestAnimationFrame(updateViewportState);
      return;
    }

    const edge = edges.find((entry) => entry.id === flowId);
    if (!edge) return;
    const source = flowNodes.find((entry) => entry.id === edge.source);
    const target = flowNodes.find((entry) => entry.id === edge.target);
    if (!source || !target) return;
    instance.setCenter((source.position.x + target.position.x) / 2, (source.position.y + target.position.y) / 2, {
      zoom: Math.max(instance.getZoom(), 0.95),
      duration: 240,
    });
    requestAnimationFrame(updateViewportState);
  }, [edges, flowNodes, selectedEntity, updateViewportState]);

  const beginLinkFromSelection = useCallback(() => {
    if (!selectedEntity || !canStartLinkFromSelection) return;
    setAddMode("none");
    setDeleteMode(false);
    setConnectionSourceKey(`${selectedEntity.type}:${selectedEntity.id}`);
  }, [canStartLinkFromSelection, selectedEntity]);

  const setBoardTool = useCallback((tool: BoardTool) => {
    setAddMode(tool === "connect" || tool === "delete" || tool === "inspect" || tool === "move" ? "none" : tool);
    setDeleteMode(tool === "delete");

    if (tool === "connect") {
      setConnectionSourceKey(
        isConnectableSelection(selectedEntity) ? `${selectedEntity.type}:${selectedEntity.id}` : CONNECT_ARMED
      );
      return;
    }

    setConnectionSourceKey(null);

    if (tool === "inspect" || tool === "move") {
      setPrimaryTool(tool);
    }
  }, [selectedEntity]);

  useImperativeHandle(
    ref,
    () => ({
      focusSelection,
      beginLinkFromSelection,
      clearSelection: () => onSelectEntity(null),
      fitToContent,
      resetCamera,
      setBoardTool,
    }),
    [beginLinkFromSelection, fitToContent, focusSelection, onSelectEntity, resetCamera, setBoardTool]
  );

  useEffect(() => {
    onToolStateChange?.({
      activeTool,
      linkType,
      zoomPercent,
      showGrid,
      showRelationships,
      showFronts,
      showRegions,
      snapToGrid,
      labelDensity,
      canDeleteSelection,
      canStartLinkFromSelection,
    });
  }, [
    activeTool,
    canDeleteSelection,
    canStartLinkFromSelection,
    labelDensity,
    linkType,
    onToolStateChange,
    showFronts,
    showGrid,
    showRegions,
    showRelationships,
    snapToGrid,
    zoomPercent,
  ]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      switch (e.key.toLowerCase()) {
        case "v": setBoardTool("inspect"); break;
        case "m": setBoardTool("move"); break;
        case "r": setBoardTool("region"); break;
        case "s": setBoardTool("site"); break;
        case "t": setBoardTool("token"); break;
        case "a": setBoardTool("agent"); break;
        case "c": setBoardTool("connect"); break;
        case "d": setBoardTool("delete"); break;
        case "f": fitToContent(); break;
        case "0": resetCamera(); break;
        case "escape": setBoardTool("inspect"); break;
        case "delete":
        case "backspace":
          if (canDeleteSelection) {
            e.preventDefault();
            onRequestDeleteSelection(selectedEntity);
          }
          break;
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [canDeleteSelection, fitToContent, onRequestDeleteSelection, resetCamera, selectedEntity, setBoardTool]);

  return (
    <div className="relative h-full overflow-hidden rounded-[inherit] bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_34%),linear-gradient(180deg,#02070b_0%,#061118_48%,#04070a_100%)]">
      <ReactFlow
        nodes={flowNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onInit={(instance) => {
          reactFlowRef.current = instance;
          queueMicrotask(() => {
            instance.fitView({ padding: 0.16, duration: 0 });
            updateViewportState();
          });
        }}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
        onMoveEnd={updateViewportState}
        fitView
        panOnDrag={primaryTool === "move"}
        selectionOnDrag={false}
        nodesDraggable={activeTool === "inspect" || primaryTool === "move"}
        zoomOnScroll
        panOnScroll={false}
        minZoom={0.14}
        maxZoom={3.8}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ animated: false }}
        className="reactflow-world"
      >
        <Background variant={BackgroundVariant.Dots} gap={GRID_SIZE} size={1.2} color="rgba(56,189,248,0.16)" />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          className="!h-28 !w-44 !rounded-xl !border !border-white/8 !bg-[rgba(7,11,14,0.92)]"
          maskColor="rgba(3,7,10,0.72)"
          nodeColor={(node) => (node.data as WorldNodeData | undefined)?.accent ?? "#64748b"}
        />
        <Controls showInteractive={false} position="top-right" />
        <Panel position="top-left">
          <div className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-[rgba(7,11,14,0.94)] p-3 shadow-[0_10px_24px_rgba(0,0,0,0.24)] backdrop-blur-sm">
            <div className="flex gap-2">
              <ToolButton icon={MousePointer2} active={activeTool === "inspect"} onClick={() => setBoardTool("inspect")} label="Inspect" />
              <ToolButton icon={Hand} active={activeTool === "move"} onClick={() => setBoardTool("move")} label="Move" />
              <ToolButton icon={Link2} active={activeTool === "connect"} onClick={() => setBoardTool("connect")} label="Connect nodes" />
              <ToolButton icon={Trash2} active={activeTool === "delete"} onClick={() => setBoardTool("delete")} label="Delete" />
            </div>
            <div className="border-t border-white/8 pt-3">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/36">Add to board</div>
              <div className="grid grid-cols-4 gap-2">
                {ADD_TOOL_CONFIG.map(({ tool, label, icon }) => (
                  <ToolButton
                    key={tool}
                    icon={icon}
                    active={activeTool === tool}
                    onClick={() => setBoardTool(tool)}
                    label={label}
                    compact
                  />
                ))}
              </div>
            </div>
          </div>
        </Panel>
        <Panel position="top-center">
          <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-[rgba(7,11,14,0.94)] px-3 py-2 text-sm text-white/84 shadow-[0_8px_20px_rgba(0,0,0,0.22)] backdrop-blur-sm">
            {activeTool === "delete" ? <Trash2 className="h-4 w-4" /> : activeTool === "connect" ? <Link2 className="h-4 w-4" /> : activeTool === "move" ? <Hand className="h-4 w-4" /> : <Crosshair className="h-4 w-4" />}
            <span>
              {activeTool === "delete"
                ? "Click any canvas object to remove it"
                : activeTool === "connect"
                  ? connectionSourceKey && connectionSourceKey !== CONNECT_ARMED
                    ? `Choose the node to connect with as ${boardLinkTypeLabel(linkType).toLowerCase()}`
                    : `Choose the first node for a ${boardLinkTypeLabel(linkType).toLowerCase()} connection`
                  : addMode !== "none"
                    ? `Click canvas to place ${addMode}`
                    : "Connection board active"}
            </span>
            {(activeTool === "connect" || canStartLinkFromSelection) ? (
              <div className="ml-2 flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.03] p-1">
                {BOARD_LINK_TYPE_OPTIONS.map(({ type, label }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setLinkType(type)}
                    aria-pressed={linkType === type}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                      linkType === type
                        ? "text-white"
                        : "text-white/52 hover:bg-white/[0.06] hover:text-white/82"
                    }`}
                    style={
                      linkType === type
                        ? {
                            backgroundColor: EDGE_TONE[type].glow,
                            boxShadow: `0 0 0 1px ${EDGE_TONE[type].stroke} inset`,
                          }
                        : undefined
                    }
                    title={`Connect as ${label.toLowerCase()}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
            {canStartLinkFromSelection && activeTool !== "connect" ? (
              <button
                type="button"
                onClick={beginLinkFromSelection}
                className="ml-2 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-white/78 transition hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
              >
                Connect selected as {boardLinkTypeLabel(linkType).toLowerCase()}
              </button>
            ) : null}
            {canDeleteSelection && activeTool !== "delete" ? (
              <button
                type="button"
                onClick={() => onRequestDeleteSelection(selectedEntity)}
                className="ml-1 rounded-md border border-red-400/16 bg-red-400/[0.08] px-2 py-1 text-[11px] font-medium text-red-100 transition hover:border-red-400/28 hover:bg-red-400/[0.12]"
              >
                Delete selected
              </button>
            ) : null}
          </div>
        </Panel>
        <Panel position="top-right">
          <div className="mr-12 flex flex-col gap-2 rounded-xl border border-white/8 bg-[rgba(7,11,14,0.94)] px-3 py-2 text-xs text-white/68 shadow-[0_8px_20px_rgba(0,0,0,0.22)] backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white/86">{flowNodes.length}</span>
              <span>nodes</span>
              <span className="text-white/24">/</span>
              <span className="font-semibold text-white/86">{edges.length}</span>
              <span>links</span>
              <span className="text-white/24">/</span>
              <span className="font-semibold text-white/86">{zoomPercent}%</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {BOARD_LINK_LEGEND.map(({ type, label }) => (
                <div key={type} className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 text-[10px] font-medium text-white/68">
                  <span
                    className="h-1.5 w-4 rounded-full"
                    style={{
                      backgroundColor: EDGE_TONE[type].stroke,
                      opacity: type === "dependency" ? 0.85 : 1,
                    }}
                  />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </ReactFlow>
      <style jsx global>{`
        .reactflow-world .react-flow__attribution {
          display: none;
        }
        .reactflow-world .react-flow__panel {
          margin: 18px;
        }
        .reactflow-world .react-flow__controls {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(7, 11, 14, 0.94);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
          backdrop-filter: blur(10px);
        }
        .reactflow-world .react-flow__controls-button {
          background: transparent;
          border-bottom-color: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.74);
        }
        .reactflow-world .react-flow__controls-button:hover {
          background: rgba(255, 255, 255, 0.06);
          color: white;
        }
        .reactflow-world .react-flow__edge-textbg {
          fill: rgba(5, 9, 12, 0.94);
          stroke: rgba(255, 255, 255, 0.08);
          stroke-width: 1;
        }
        .reactflow-world .react-flow__edge-text {
          fill: rgba(255, 255, 255, 0.86);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
        }
        .reactflow-world .react-flow__edge-path {
          filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.38));
        }
      `}</style>
    </div>
  );
});

function ToolButton({
  icon: Icon,
  active,
  label,
  onClick,
  compact = false,
}: {
  icon: typeof MousePointer2;
  active: boolean;
  label: string;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex items-center justify-center rounded-[10px] border transition ${
        compact ? "h-9 w-9" : "h-10 w-10"
      } ${
        active
          ? "border-white/20 bg-white/10 text-white"
          : "border-white/8 bg-white/[0.03] text-white/68 hover:border-white/12 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </button>
  );
}
