"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import * as pixi from "pixi.js";
import {
  Crosshair, MousePointer2, Hand, Minus, Plus, RotateCcw, ScanSearch,
  Grid3x3, Magnet, Hexagon, MapPin, CircleDot, Link2, Tag, Trash2, LocateFixed,
  Workflow, UserRound, Shield, FlagTriangleRight, Zap, MapPinned,
  Eye, EyeOff,
} from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useSimulationStore } from "@/lib/stores/simulation-store";
import type { Agent, BoardLink, BoardLinkType, BoardSelection, CampaignNode, FrontClock, MapLayer, Position, RelationshipEdge, WorldState } from "@/lib/sim/types";

// --- Utilities ---
const distance = (p1: Position, p2: Position) =>
  Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

const findNearestRegion = (map: any, pos: Position) => {
  let best = null;
  let bestD = Infinity;
  for (const r of map.regions) {
    const d = distance(r.center, pos);
    if (d < bestD) {
      best = r;
      bestD = d;
    }
  }
  return best;
};

const findNearestSite = (map: any, pos: Position) => {
  let best = null;
  let bestD = Infinity;
  for (const s of map.sites) {
    const d = distance(s.position, pos);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
};

function dragToken(scene: SceneSnapshot, id: string, pos: Position) {
  const token = scene.map.tokens.find((item) => item.id === id);
  if (!token) return;
  token.position = { ...pos };
  token.regionId = findNearestRegion(scene.map, pos)?.id ?? token.regionId ?? null;
  const site = findNearestSite(scene.map, pos);
  token.siteId = site && distance(site.position, pos) < 140 ? site.id : null;
}

function dragSite(scene: SceneSnapshot, id: string, pos: Position) {
  const site = scene.map.sites.find((item) => item.id === id);
  if (!site) return;
  site.position = { ...pos };
  site.regionId = findNearestRegion(scene.map, pos)?.id ?? site.regionId;
}

function dragCampaignNode(scene: SceneSnapshot, id: string, pos: Position) {
  const node = scene.campaignNodes.find((item) => item.id === id);
  if (!node) return;
  node.position = { ...pos };
  node.regionId = findNearestRegion(scene.map, pos)?.id ?? node.regionId ?? null;
  node.siteId = findNearestSite(scene.map, pos)?.id ?? null;
}

function applyDrag(scene: SceneSnapshot, target: DragTarget, worldPos: Position) {
  const handlers: Record<DragTarget["kind"], (scene: SceneSnapshot, id: string, pos: Position) => void> = {
    token: dragToken,
    site: dragSite,
    region: (s, id, pos) => {
      const region = s.map.regions.find((r) => r.id === id);
      if (region) region.center = { ...pos };
    },
    "region-radius": (s, id, pos) => {
      const region = s.map.regions.find((r) => r.id === id);
      if (region) region.radius = Math.max(48, distance(region.center, pos));
    },
    agent: (s, id, pos) => {
      const agent = s.agents.find((a) => a.id === id);
      if (agent) agent.position = { ...pos };
    },
    "campaign-node": dragCampaignNode,
  };

  const handler = handlers[target.kind];
  if (handler) handler(scene, target.id, worldPos);
}

async function persistDrag(
  scene: SceneSnapshot,
  target: DragTarget,
  handlers: {
    onMoveToken: (tokenId: string, patch: { x: number; y: number; regionId?: string | null; siteId?: string | null }) => Promise<void>;
    onMoveSite: (siteId: string, patch: { x: number; y: number; regionId?: string | null }) => Promise<void>;
    onMoveRegion: (regionId: string, patch: { x: number; y: number }) => Promise<void>;
    onResizeRegion: (regionId: string, radius: number) => Promise<void>;
    onMoveAgent: (agentId: string, patch: { x: number; y: number }) => Promise<void>;
    onMoveCampaignNode: (nodeId: string, patch: { x: number; y: number }) => Promise<void>;
  }
) {
  switch (target.kind) {
    case "token": {
      const token = scene.map.tokens.find((entry) => entry.id === target.id);
      if (!token) return;
      await handlers.onMoveToken(token.name, { x: token.position.x, y: token.position.y, regionId: token.regionId ?? null, siteId: token.siteId ?? null });
      break;
    }
    case "site": {
      const site = scene.map.sites.find((entry) => entry.id === target.id);
      if (!site) return;
      await handlers.onMoveSite(site.id, { x: site.position.x, y: site.position.y, regionId: site.regionId });
      break;
    }
    case "region": {
      const region = scene.map.regions.find((entry) => entry.id === target.id);
      if (!region) return;
      await handlers.onMoveRegion(region.id, { x: region.center.x, y: region.center.y });
      break;
    }
    case "region-radius": {
      const region = scene.map.regions.find((entry) => entry.id === target.id);
      if (!region) return;
      await handlers.onResizeRegion(region.id, region.radius);
      break;
    }
    case "agent": {
      const agent = scene.agents.find((entry) => entry.id === target.id);
      if (!agent) return;
      await handlers.onMoveAgent(agent.id, { x: agent.position.x, y: agent.position.y });
      break;
    }
    case "campaign-node": {
      const node = scene.campaignNodes.find((entry) => entry.id === target.id);
      if (!node) return;
      await handlers.onMoveCampaignNode(node.id, { x: node.position.x, y: node.position.y });
      break;
    }
  }
}

interface SceneSnapshot {
  agents: Agent[];
  boardLinks: BoardLink[];
  campaignNodes: CampaignNode[];
  relationships: RelationshipEdge[];
  map: MapLayer;
  fronts: FrontClock[];
  tick?: number;
  seed?: number;
}

interface NodeCardOptions {
  container: any;
  width: number;
  height: number;
  color: number;
  title: string;
  subtitle?: string;
  isSelected?: boolean;
  statusColor?: number;
}

interface RenderLayerOptions {
  refs: any;
  scene: SceneSnapshot;
  selectedEntity: BoardSelection | null;
  onSelectEntity: (selection: BoardSelection | null) => void;
  onSelectConnectionTarget: (selection: ConnectableSelection) => Promise<void>;
  setDragTarget: (target: DragTarget, startWorld: Position) => void;
  editMode: boolean;
  deleteMode: boolean;
  addMode: AddMode;
  labelDensity: "minimal" | "balanced" | "dense";
  showRegionLabels: boolean;
  showRouteText: boolean;
  showTokenLabels: boolean;
  frontAlpha: number;
  showGrid: boolean;
  showRelationships: boolean;
  showFronts: boolean;
  showRegions: boolean;
  showProjections: boolean;
  projectionAgents: Array<{ id: string; position: Position }>;
  connectionSourceKey: string | null;
  updateOnlyDragTarget?: DragTarget;
  majorLabelStyle: any;
  minorLabelStyle: any;
  tinyLabelStyle: any;
  zoomScale: number;
  drawNodeCard: (options: NodeCardOptions) => void;
}

interface WorldCanvasProps {
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
  readonly onCreateBoardLink: (payload: { linkType: BoardLinkType; source: { type: "agent" | "campaignNode" | "region" | "site" | "front"; id: string }; target: { type: "agent" | "campaignNode" | "region" | "site" | "front"; id: string }; label?: string | null }) => Promise<void>;
  readonly onCreateCampaignNode: (payload: { name: string; kind: "agent" | "faction" | "front" | "event" | "place"; x: number; y: number; regionId?: string | null; siteId?: string | null }) => Promise<void>;
  readonly onRequestDeleteSelection: (selection: BoardSelection | null) => void;
  readonly initialTool?: BoardTool;
  readonly onToolStateChange?: (state: WorldCanvasUiState) => void;
}

type DragTarget =
  | { kind: "token"; id: string }
  | { kind: "site"; id: string }
  | { kind: "region"; id: string }
  | { kind: "region-radius"; id: string }
  | { kind: "agent"; id: string }
  | { kind: "campaign-node"; id: string };

// Moved SceneSnapshot to top-level scope to resolve duplicate identifiers.

type AddMode = "none" | "region" | "site" | "token" | "agent" | "place" | "faction" | "front" | "event";
type ConnectableSelection = { type: "agent" | "campaignNode" | "region" | "site" | "front"; id: string };
export type BoardTool = "inspect" | "move" | "connect" | "delete" | Exclude<AddMode, "none">;

export interface WorldCanvasUiState {
  activeTool: BoardTool;
  linkType: BoardLinkType;
  zoomPercent: number;
  showGrid: boolean;
  showRelationships: boolean;
  showFronts: boolean;
  showRegions: boolean;
  snapToGrid: boolean;
  labelDensity: "minimal" | "balanced" | "dense";
  canDeleteSelection: boolean;
  canStartLinkFromSelection: boolean;
}

export interface WorldCanvasHandle {
  focusSelection: () => void;
  beginLinkFromSelection: () => void;
  clearSelection: () => void;
  fitToContent: () => void;
  resetCamera: () => void;
  setBoardTool: (tool: BoardTool) => void;
}

const TOOL_ICON_MAP: Record<BoardTool, typeof MousePointer2> = {
  inspect: MousePointer2,
  move: Hand,
  connect: Workflow,
  delete: Trash2,
  agent: UserRound,
  faction: Shield,
  front: FlagTriangleRight,
  event: Zap,
  place: MapPin,
  region: Hexagon,
  site: MapPinned,
  token: CircleDot,
};

const INTERACTION_TOOL_CONFIG: Array<{ tool: BoardTool; label: string; shortcut: string; destructive?: boolean }> = [
  { tool: "inspect", label: "Inspect", shortcut: "V" },
  { tool: "move", label: "Move and pan", shortcut: "M" },
  { tool: "connect", label: "Link nodes", shortcut: "C" },
  { tool: "delete", label: "Delete", shortcut: "D", destructive: true },
];

const CREATION_TOOL_CONFIG: Array<{ tool: BoardTool; label: string; shortcut: string }> = [
  { tool: "agent", label: "Add actor", shortcut: "A" },
  { tool: "faction", label: "Add faction", shortcut: "" },
  { tool: "front", label: "Add front", shortcut: "" },
  { tool: "event", label: "Add event", shortcut: "" },
  { tool: "place", label: "Add place", shortcut: "" },
  { tool: "region", label: "Add region", shortcut: "R" },
  { tool: "site", label: "Add site", shortcut: "S" },
  { tool: "token", label: "Add token", shortcut: "T" },
];

const WORLD_EXTENT = 20000;
const CAMERA_PADDING = 72;
const GRID_SIZE = 80;
const CAMERA_MIN_ZOOM = 0.14;
const CAMERA_MAX_ZOOM = 3.8;
const CAMERA_PAN_FRICTION = 0.9;
const CAMERA_PAN_EPSILON = 0.08;
const CAMERA_ZOOM_EPSILON = 0.001;
const CAMERA_TARGET_EPSILON = 0.24;
const CAMERA_DRAG_SENSITIVITY = 1;
const CAMERA_TARGET_EASE = 0.18;
const CAMERA_ZOOM_EASE = 0.2;
const CAMERA_WHEEL_INTENSITY = 0.0014;

interface CameraMotionState {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  targetZoom: number;
  vx: number;
  vy: number;
  isPanning: boolean;
  hasTarget: boolean;
  lastTimestamp: number | null;
}

const FACTION_COLORS: Record<string, number> = {
  "faction-sol": 0x2dd4bf,
  "faction-iron": 0xf59e0b,
  "faction-meridian": 0x38bdf8,
  "faction-guild": 0xf472b6,
  "faction-dawn": 0x34d399,
};

const TOKEN_COLORS: Record<string, number> = {
  party: 0x67e8f9,
  faction: 0x2dd4bf,
  threat: 0xfb7185,
};

function getFactionColor(factionId: string | null | undefined) {
  return FACTION_COLORS[factionId ?? ""] ?? 0xe2e8f0;
}

function routeStroke(status: string) {
  switch (status) {
    case "collapsed":
      return 0xfb7185;
    case "disrupted":
      return 0xf59e0b;
    case "strained":
      return 0x38bdf8;
    default:
      return 0x2dd4bf;
  }
}

function clearDisplayLayer(layer: any) {
  layer.removeChildren().forEach((child: any) => child.destroy());
}

function relationshipStroke(relationship: RelationshipEdge) {
  return relationship.trust > 0 ? 0x2dd4bf : 0xf97316;
}

function frontStroke(front: FrontClock) {
  const heat = Math.max(front.progress, front.pressure);
  if (heat > 0.7) return 0xf59e0b;
  if (heat < 0.35) return 0x22c55e;
  return 0xfb923c;
}

function campaignNodeColor(kind: CampaignNode["kind"]) {
  switch (kind) {
    case "agent":
      return 0x38bdf8;
    case "faction":
      return 0x2dd4bf;
    case "front":
      return 0xf59e0b;
    case "event":
      return 0xfb7185;
    case "place":
      return 0x34d399;
    default:
      return 0x94a3b8;
  }
}

function cloneScene(
  agents: Agent[],
  boardLinks: BoardLink[],
  campaignNodes: CampaignNode[],
  relationships: RelationshipEdge[],
  map: MapLayer,
  fronts: FrontClock[]
): SceneSnapshot {
  return {
    agents: structuredClone(agents),
    boardLinks: structuredClone(boardLinks),
    campaignNodes: structuredClone(campaignNodes),
    relationships: structuredClone(relationships),
    map: structuredClone(map),
    fronts: structuredClone(fronts),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function encodeSelectionKey(selection: { type: "agent" | "campaignNode" | "region" | "site" | "front"; id: string }) {
  return `${selection.type}:${selection.id}`;
}

function decodeSelectionKey(value: string): { type: "agent" | "campaignNode" | "region" | "site" | "front"; id: string } | null {
  const [type, ...rest] = value.split(":");
  const id = rest.join(":");
  if (!id) return null;
  if (type === "agent" || type === "campaignNode" || type === "region" || type === "site" || type === "front") {
    return { type, id };
  }
  return null;
}


function computeSceneBounds(scene: SceneSnapshot) {
  const points: Array<{ x: number; y: number }> = [];
  for (const region of scene.map.regions) {
    points.push(
      { x: region.center.x - region.radius, y: region.center.y - region.radius },
      { x: region.center.x + region.radius, y: region.center.y + region.radius }
    );
  }
  for (const site of scene.map.sites) points.push(site.position);
  for (const token of scene.map.tokens) points.push(token.position);
  for (const agent of scene.agents) points.push(agent.position);
  for (const node of scene.campaignNodes) points.push(node.position);
  if (points.length === 0) return { minX: -600, minY: -420, maxX: 600, maxY: 420 };
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function snapPoint(position: Position, enabled: boolean): Position {
  if (!enabled) return position;
  return {
    x: Math.round(position.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(position.y / GRID_SIZE) * GRID_SIZE,
  };
}

function resolveConnectablePosition(scene: SceneSnapshot, selection: ConnectableSelection): Position | null {
  switch (selection.type) {
    case "agent":
      return scene.agents.find((entry) => entry.id === selection.id)?.position ?? null;
    case "campaignNode":
      return scene.campaignNodes.find((entry) => entry.id === selection.id)?.position ?? null;
    case "region":
      return scene.map.regions.find((entry) => entry.id === selection.id)?.center ?? null;
    case "site":
      return scene.map.sites.find((entry) => entry.id === selection.id)?.position ?? null;
    case "front": {
      const front = scene.fronts.find((entry) => entry.id === selection.id);
      if (!front) return null;
      const region = scene.map.regions.find((entry) => entry.id === front.regionId);
      return region?.center ?? null;
    }
  }
}

function resolveBoardSelectionPosition(scene: SceneSnapshot, selection: BoardSelection): Position | null {
  if (selection.type === "boardLink") {
    const link = scene.boardLinks.find((entry) => entry.id === selection.id);
    if (!link) return null;
    const source = resolveConnectablePosition(scene, link.source);
    const target = resolveConnectablePosition(scene, link.target);
    if (!source || !target) return null;
    return { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
  }
  if (selection.type === "route") {
    const route = scene.map.routes.find((entry) => entry.id === selection.id);
    if (!route) return null;
    const from = scene.map.sites.find((site) => site.id === route.fromSiteId);
    const to = scene.map.sites.find((site) => site.id === route.toSiteId);
    if (!from || !to) return null;
    return { x: (from.position.x + to.position.x) / 2, y: (from.position.y + to.position.y) / 2 };
  }
  if (
    selection.type === "agent" ||
    selection.type === "campaignNode" ||
    selection.type === "region" ||
    selection.type === "site" ||
    selection.type === "front"
  ) {
    return resolveConnectablePosition(scene, selection as ConnectableSelection);
  }
  return null;
}

function resolveConnectableLabel(scene: SceneSnapshot, selection: ConnectableSelection): string {
  switch (selection.type) {
    case "agent":
      return scene.agents.find((entry) => entry.id === selection.id)?.name ?? selection.id;
    case "campaignNode":
      return scene.campaignNodes.find((entry) => entry.id === selection.id)?.name ?? selection.id;
    case "region":
      return scene.map.regions.find((entry) => entry.id === selection.id)?.name ?? selection.id;
    case "site":
      return scene.map.sites.find((entry) => entry.id === selection.id)?.name ?? selection.id;
    case "front":
      return scene.fronts.find((entry) => entry.id === selection.id)?.name ?? selection.id;
  }
}

export const WorldCanvas = forwardRef<WorldCanvasHandle, WorldCanvasProps>(function WorldCanvas({
  agents,
  boardLinks,
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
  onCreateCampaignNode,
  onRequestDeleteSelection,
  initialTool = "inspect",
  onToolStateChange,
}: WorldCanvasProps, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pixiRef = useRef<any>(null);
  const renderFlagsRef = useRef({ full: false, dragTarget: null as DragTarget | null });
  const renderRafRef = useRef<number | null>(null);
  const animationRafRef = useRef<number | null>(null);
  const dragRef = useRef<{ target: DragTarget; startWorld: Position; moved: boolean } | null>(null);
  const sceneRef = useRef<SceneSnapshot>(cloneScene(agents, boardLinks, campaignNodes, relationships, map, fronts));
  const initializedCameraRef = useRef(false);
  const cameraMotionRef = useRef<CameraMotionState>({
    x: 0,
    y: 0,
    zoom: 1,
    targetX: 0,
    targetY: 0,
    targetZoom: 1,
    vx: 0,
    vy: 0,
    isPanning: false,
    hasTarget: false,
    lastTimestamp: null,
  });

  const { projections, showProjections, workspaceSettings, setWorkspaceSettings } =
    useSimulationStore();

  const [zoomPercent, setZoomPercent] = useState(100);
  const [primaryTool, setPrimaryTool] = useState<"inspect" | "move">(
    initialTool === "move" ? "move" : "inspect"
  );
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [addMode, setAddMode] = useState<AddMode>("none");
  const [connectionSourceKey, setConnectionSourceKey] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<BoardLinkType>("causal");
  const [deleteMode, setDeleteMode] = useState(initialTool === "delete");
  const [showViewControls, setShowViewControls] = useState(false);
  const [showRelationships, setShowRelationships] = useState(true);
  const [showFronts, setShowFronts] = useState(true);
  const [showRegions, setShowRegions] = useState(true);
  const [showRecentNodes, setShowRecentNodes] = useState(false);

  const hasCampaignGeometry =
    map.regions.length > 0 ||
    map.sites.length > 0 ||
    map.routes.length > 0 ||
    map.tokens.length > 0 ||
    campaignNodes.some((node) => (node.tags ?? []).includes("manual"));
  const isEmptyState = !hasCampaignGeometry && agents.length === 0 && fronts.length === 0;
  const labelDensity = workspaceSettings.map.labelDensity;
  const showRouteLabels = workspaceSettings.map.showRouteLabels;
  const showFrontLabels = labelDensity !== "minimal";
  const showRegionMetrics = labelDensity === "dense";
  const showMinorLabels = labelDensity === "dense";

  const majorLabelStyle = useMemo(() => new (pixi as any).TextStyle({
    fill: 0xf5f5f5,
    fontFamily: "Manrope, system-ui, sans-serif",
    fontSize: labelDensity === "dense" ? 17 : 15,
    fontWeight: "700",
    stroke: { color: 0x000000, width: 5, join: "round" },
  }), [labelDensity]);

  const minorLabelStyle = useMemo(() => new (pixi as any).TextStyle({
    fill: 0xb4b7bd,
    fontFamily: "Manrope, system-ui, sans-serif",
    fontSize: 11,
    fontWeight: "600",
    stroke: { color: 0x000000, width: 4, join: "round" },
    letterSpacing: 0.4,
  }), []);

  const tinyLabelStyle = useMemo(() => new (pixi as any).TextStyle({
    fill: 0x8a8f98,
    fontFamily: "JetBrains Mono, monospace",
    fontSize: 9,
    letterSpacing: 0.8,
  }), []);

  const frontAlpha =
    workspaceSettings.map.frontOverlayIntensity === "low"
      ? 0.25
      : workspaceSettings.map.frontOverlayIntensity === "high"
        ? 0.68
        : 0.45;

  const projectionAgents = useMemo(
    () => (projections.at(-1)?.agents ?? []) as Array<{ id: string; position: Position }>,
    [projections]
  );
  const selectedManualNode = useMemo(
    () =>
      selectedEntity?.type === "campaignNode"
        ? campaignNodes.find((node) => node.id === selectedEntity.id && (node.tags ?? []).includes("manual")) ?? null
        : null,
    [campaignNodes, selectedEntity]
  );
  const selectedBoardLink = useMemo(
    () => (selectedEntity?.type === "boardLink" ? boardLinks.find((link) => link.id === selectedEntity.id) ?? null : null),
    [boardLinks, selectedEntity]
  );
  const selectedBoardLabel = useMemo(() => {
    if (!selectedEntity) return null;
    if (selectedEntity.type === "campaignNode") return selectedManualNode?.name ?? "Board node";
    if (selectedEntity.type === "boardLink") return selectedBoardLink?.label ?? `${selectedBoardLink?.type ?? "board"} link`;
    if (selectedEntity.type === "agent") return agents.find((entry) => entry.id === selectedEntity.id)?.name ?? "Agent";
    if (selectedEntity.type === "region") return map.regions.find((entry) => entry.id === selectedEntity.id)?.name ?? "Region";
    if (selectedEntity.type === "site") return map.sites.find((entry) => entry.id === selectedEntity.id)?.name ?? "Site";
    if (selectedEntity.type === "front") return fronts.find((entry) => entry.id === selectedEntity.id)?.name ?? "Front";
    if (selectedEntity.type === "route") return map.routes.find((entry) => entry.id === selectedEntity.id)?.name ?? "Route";
    return null;
  }, [agents, fronts, map.regions, map.routes, map.sites, selectedBoardLink, selectedEntity, selectedManualNode]);
  const recentManualNodes = useMemo(
    () =>
      campaignNodes
        .filter((node) => (node.tags ?? []).includes("manual"))
        .slice(-5)
        .reverse(),
    [campaignNodes]
  );
  const canStartLinkFromSelection = Boolean(
    selectedEntity &&
      (selectedEntity.type === "agent" ||
        selectedEntity.type === "campaignNode" ||
        selectedEntity.type === "region" ||
        selectedEntity.type === "site" ||
        selectedEntity.type === "front")
  );
  const canDeleteSelection = Boolean(
    selectedEntity &&
      (
        selectedEntity.type === "agent" ||
        selectedEntity.type === "campaignNode" ||
        selectedEntity.type === "region" ||
        selectedEntity.type === "site" ||
        selectedEntity.type === "route" ||
        selectedEntity.type === "front" ||
        selectedEntity.type === "boardLink"
      )
  );
  const activeTool: BoardTool =
    addMode !== "none"
      ? addMode
      : connectionSourceKey
        ? "connect"
        : deleteMode
          ? "delete"
          : primaryTool;
  const modeDescriptor = useMemo(() => {
    if (addMode !== "none") {
      const tooltips: Record<Exclude<AddMode, "none">, string> = {
        region: "Click the board to drop a new region shell.",
        site: "Click the board to place a site inside the nearest region.",
        token: "Click the board to place a token and bind it to nearby geography.",
        agent: "Click the board to place a new actor node.",
        place: "Click the board to place a place node for world context.",
        faction: "Click the board to place a faction node.",
        front: "Click the board to place a front node.",
        event: "Click the board to place an event node.",
      };
      return tooltips[addMode];
    }
    if (connectionSourceKey) {
      return connectionSourceKey === "__armed__"
        ? "Choose the first node to begin a board link."
        : "Choose the destination node to complete the link.";
    }
    if (deleteMode) {
      return "Click any canvas object to queue it for removal.";
    }
    if (primaryTool === "move") {
      return "Drag regions, sites, tokens, or agents directly on the board.";
    }
    return "Pan, inspect, and focus without moving map objects.";
  }, [addMode, connectionSourceKey, deleteMode, primaryTool]);

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
    showGrid,
    showFronts,
    showRegions,
    showRelationships,
    snapToGrid,
    zoomPercent,
  ]);

  const updateZoomHud = useCallback(() => {
    const nextZoom = Math.round(cameraMotionRef.current.zoom * 100);
    setZoomPercent((current) => (current === nextZoom ? current : nextZoom));
  }, []);

  const syncViewportToCamera = useCallback(() => {
    const viewport = pixiRef.current?.viewport;
    if (!viewport) return;
    const camera = cameraMotionRef.current;
    viewport.position.set(camera.x, camera.y);
    viewport.scale.set(camera.zoom);
  }, []);

  const runCameraFrame = useCallback((now: number) => {
    const viewport = pixiRef.current?.viewport;
    if (!viewport) {
      animationRafRef.current = null;
      return;
    }

    const camera = cameraMotionRef.current;
    const previousTimestamp = camera.lastTimestamp ?? now;
    const dt = Math.min(now - previousTimestamp, 32);
    const dtFactor = Math.max(dt / 16.6667, 0.5);
    camera.lastTimestamp = now;

    if (camera.isPanning) {
      camera.x = camera.targetX;
      camera.y = camera.targetY;
    } else if (camera.hasTarget) {
      camera.x += (camera.targetX - camera.x) * CAMERA_TARGET_EASE * dtFactor;
      camera.y += (camera.targetY - camera.y) * CAMERA_TARGET_EASE * dtFactor;
      camera.vx = 0;
      camera.vy = 0;
    } else {
      camera.x += camera.vx * dtFactor;
      camera.y += camera.vy * dtFactor;
      camera.vx *= Math.pow(CAMERA_PAN_FRICTION, dtFactor);
      camera.vy *= Math.pow(CAMERA_PAN_FRICTION, dtFactor);
      if (Math.abs(camera.vx) < CAMERA_PAN_EPSILON) camera.vx = 0;
      if (Math.abs(camera.vy) < CAMERA_PAN_EPSILON) camera.vy = 0;
    }

    camera.zoom += (camera.targetZoom - camera.zoom) * CAMERA_ZOOM_EASE * dtFactor;
    if (Math.abs(camera.targetZoom - camera.zoom) < CAMERA_ZOOM_EPSILON) {
      camera.zoom = camera.targetZoom;
    }

    if (
      camera.hasTarget &&
      Math.abs(camera.targetX - camera.x) < CAMERA_TARGET_EPSILON &&
      Math.abs(camera.targetY - camera.y) < CAMERA_TARGET_EPSILON &&
      Math.abs(camera.targetZoom - camera.zoom) < CAMERA_ZOOM_EPSILON
    ) {
      camera.x = camera.targetX;
      camera.y = camera.targetY;
      camera.zoom = camera.targetZoom;
      camera.hasTarget = false;
    }

    syncViewportToCamera();
    updateZoomHud();

    const shouldContinue =
      camera.isPanning ||
      camera.hasTarget ||
      Math.abs(camera.vx) >= CAMERA_PAN_EPSILON ||
      Math.abs(camera.vy) >= CAMERA_PAN_EPSILON ||
      Math.abs(camera.targetZoom - camera.zoom) >= CAMERA_ZOOM_EPSILON;

    if (shouldContinue) {
      animationRafRef.current = requestAnimationFrame(runCameraFrame);
    } else {
      camera.lastTimestamp = null;
      animationRafRef.current = null;
    }
  }, [syncViewportToCamera, updateZoomHud]);

  const ensureCameraLoop = useCallback(() => {
    if (animationRafRef.current !== null) return;
    animationRafRef.current = requestAnimationFrame(runCameraFrame);
  }, [runCameraFrame]);

  const setCameraTarget = useCallback((target: { x: number; y: number; zoom: number }, options?: { immediate?: boolean }) => {
    const camera = cameraMotionRef.current;
    camera.targetX = target.x;
    camera.targetY = target.y;
    camera.targetZoom = clamp(target.zoom, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM);
    camera.hasTarget = !options?.immediate;
    if (options?.immediate) {
      if (animationRafRef.current !== null) {
        cancelAnimationFrame(animationRafRef.current);
        animationRafRef.current = null;
      }
      camera.x = camera.targetX;
      camera.y = camera.targetY;
      camera.zoom = camera.targetZoom;
      camera.vx = 0;
      camera.vy = 0;
      camera.lastTimestamp = null;
      syncViewportToCamera();
      updateZoomHud();
      return;
    }
    ensureCameraLoop();
  }, [ensureCameraLoop, syncViewportToCamera, updateZoomHud]);

  const setCameraCenterTarget = useCallback((target: { centerX: number; centerY: number; scale: number }, options?: { immediate?: boolean }) => {
    const viewport = pixiRef.current?.viewport;
    if (!viewport) return;
    const nextZoom = clamp(target.scale, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM);
    setCameraTarget(
      {
        x: viewport.screenWidth / 2 - target.centerX * nextZoom,
        y: viewport.screenHeight / 2 - target.centerY * nextZoom,
        zoom: nextZoom,
      },
      options
    );
  }, [setCameraTarget]);

  const animateCamera = useCallback(
    (target: { centerX: number; centerY: number; scale: number }) => {
      const camera = cameraMotionRef.current;
      camera.isPanning = false;
      camera.vx = 0;
      camera.vy = 0;
      setCameraCenterTarget(target, { immediate: workspaceSettings.appearance.reducedMotion });
    },
    [setCameraCenterTarget, workspaceSettings.appearance.reducedMotion]
  );

  const fitToContent = useCallback(() => {
    const viewport = pixiRef.current?.viewport;
    const host = hostRef.current;
    if (!viewport || !host) return;

    const bounds = computeSceneBounds(sceneRef.current);
    const width = Math.max(bounds.maxX - bounds.minX, 260);
    const height = Math.max(bounds.maxY - bounds.minY, 220);
    const scale = Math.min(
      (host.clientWidth - CAMERA_PADDING) / width,
      (host.clientHeight - CAMERA_PADDING) / height
    );

    animateCamera({
      centerX: bounds.minX + width / 2,
      centerY: bounds.minY + height / 2,
      scale: Math.min(Math.max(scale * 1.08, 0.42), 3.25),
    });
  }, [animateCamera]);

  const focusSelection = useCallback(() => {
    if (!selectedEntity) return;
    const position = resolveBoardSelectionPosition(sceneRef.current, selectedEntity);
    if (!position) return;
    animateCamera({
      centerX: position.x,
      centerY: position.y,
      scale: Math.max(cameraMotionRef.current.zoom, selectedEntity.type === "boardLink" || selectedEntity.type === "route" ? 0.95 : 1.15),
    });
  }, [animateCamera, selectedEntity]);

  const beginLinkFromSelection = useCallback(() => {
    if (
      !selectedEntity ||
      !canStartLinkFromSelection ||
      (selectedEntity.type !== "agent" &&
        selectedEntity.type !== "campaignNode" &&
        selectedEntity.type !== "region" &&
        selectedEntity.type !== "site" &&
        selectedEntity.type !== "front")
    ) {
      return;
    }
    setAddMode("none");
    setDeleteMode(false);
    setConnectionSourceKey(encodeSelectionKey(selectedEntity as ConnectableSelection));
  }, [canStartLinkFromSelection, selectedEntity]);

  const resetCamera = useCallback(() => {
    animateCamera({ centerX: 0, centerY: 0, scale: 1 });
  }, [animateCamera]);

  const setBoardTool = useCallback((tool: BoardTool) => {
    setAddMode(tool === "connect" || tool === "delete" || tool === "inspect" || tool === "move" ? "none" : tool);
    setConnectionSourceKey(tool === "connect" ? "__armed__" : null);
    setDeleteMode(tool === "delete");
    if (tool === "inspect" || tool === "move") {
      setPrimaryTool(tool);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    focusSelection,
    beginLinkFromSelection,
    clearSelection: () => onSelectEntity(null),
    fitToContent,
    resetCamera,
    setBoardTool,
  }), [beginLinkFromSelection, fitToContent, focusSelection, onSelectEntity, resetCamera, setBoardTool]);

  function renderScene({
    refs,
    scene,
    selectedEntity,
    onSelectEntity,
    onSelectConnectionTarget,
    setDragTarget,
    editMode,
    deleteMode,
    addMode,
    labelDensity,
    showRouteLabels,
    showFrontLabels,
    showRegionMetrics,
    showMinorLabels,
    frontAlpha,
    showGrid,
    showRelationships,
    showFronts,
    showRegions,
    showProjections,
    projectionAgents,
    connectionSourceKey,
    linkType,
    updateOnlyDragTarget,
  }: {
    refs: any;
    scene: SceneSnapshot;
    selectedEntity: BoardSelection | null;
    onSelectEntity: (selection: BoardSelection | null) => void;
    onSelectConnectionTarget: (selection: ConnectableSelection) => Promise<void>;
    setDragTarget: (target: DragTarget, startWorld: Position) => void;
    editMode: boolean;
    deleteMode: boolean;
    addMode: AddMode;
    labelDensity: "minimal" | "balanced" | "dense";
    showRouteLabels: boolean;
    showFrontLabels: boolean;
    showRegionMetrics: boolean;
    showMinorLabels: boolean;
    frontAlpha: number;
    showGrid: boolean;
    showRelationships: boolean;
    showFronts: boolean;
    showRegions: boolean;
    showProjections: boolean;
    projectionAgents: Array<{ id: string; position: Position }>;
    connectionSourceKey: string | null;
    linkType: BoardLinkType;
    updateOnlyDragTarget?: DragTarget;
  }) {
    const { Container, Graphics, Text, TextStyle } = pixi;
    const zoomScale = refs.viewport.scale.x || 1;
    const showRegionLabels = labelDensity !== "minimal" || zoomScale > 0.42;
    const showTokenLabels = showMinorLabels && zoomScale > 0.78;
    const showRouteText = showRouteLabels && zoomScale > 0.95;

    clearDisplayLayer(refs.layers.grid);
    clearDisplayLayer(refs.layers.relationships);
    clearDisplayLayer(refs.layers.routes);
    clearDisplayLayer(refs.layers.fronts);
    clearDisplayLayer(refs.layers.regions);
    clearDisplayLayer(refs.layers.sites);
    clearDisplayLayer(refs.layers.tokens);
    clearDisplayLayer(refs.layers.nodes);
    clearDisplayLayer(refs.layers.ghosts);
    clearDisplayLayer(refs.layers.agents);
    clearDisplayLayer(refs.layers.manualNodes);

    interface NodeCardOptions {
      container: any;
      width: number;
      height: number;
      color: number;
      title: string;
      subtitle?: string;
      isSelected?: boolean;
      statusColor?: number;
      isTargeting?: boolean;
    }

    const drawNodeCard = (options: NodeCardOptions) => {
      const { container, width, height, title, subtitle, isSelected, statusColor, isTargeting, color } = options;
      const glass = new Graphics();
      const radius = 8;
      
      const shadow = new Graphics();
      shadow.roundRect(-width / 2, -height / 2, width, height, radius);
      shadow.fill({ color: 0x000000, alpha: 0.35 });
      container.addChild(shadow);

      if (isTargeting || isSelected) {
        const glow = new Graphics();
        glow.roundRect(-width / 2 - 4, -height / 2 - 4, width + 8, height + 8, radius + 2);
        glow.stroke({ 
          color: isTargeting ? 0x67e8f9 : color, 
          alpha: isTargeting ? 0.34 : 0.26, 
          width: 2.4 
        });
        container.addChild(glow);
      }

      glass.roundRect(-width / 2, -height / 2, width, height, radius);
      const bgColor = isTargeting ? 0x10202b : 0x07131a;
      glass.fill({ color: bgColor, alpha: 0.88 });
      glass.stroke({ 
        color: color, 
        alpha: isSelected ? 0.65 : isTargeting ? 0.42 : 0.2, 
        width: 1 
      });
      container.addChild(glass);

      const tintStrip = new Graphics();
      tintStrip.roundRect(-width / 2, -height / 2, width, 5, radius);
      tintStrip.fill({ color, alpha: 0.85 });
      container.addChild(tintStrip);

      if (statusColor !== undefined) {
        const bar = new Graphics();
        bar.roundRect(-width / 2, -height / 2, 3, height, radius);
        bar.fill({ color: statusColor, alpha: 0.8 });
        container.addChild(bar);
      }

      const titleText = new Text({
        text: title,
        style: new TextStyle({
          fill: 0xffffff,
          fontFamily: "Manrope, sans-serif",
          fontSize: 12,
          fontWeight: "600",
        }),
      });
      titleText.anchor.set(0, 0.5);
      titleText.position.set(-width / 2 + 10, subtitle ? -6 : 0);
      container.addChild(titleText);

      if (subtitle) {
        const subText = new Text({
          text: subtitle.toUpperCase(),
          style: new TextStyle({
            fill: color,
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 8,
            letterSpacing: 0.5,
          }),
        });
        subText.alpha = 0.72;
        subText.anchor.set(0, 0.5);
        subText.position.set(-width / 2 + 10, 8);
        container.addChild(subText);
      }
    };

    const renderLayerOptions: RenderLayerOptions = {
      refs,
      scene,
      selectedEntity,
      onSelectEntity,
      onSelectConnectionTarget,
      setDragTarget,
      editMode: primaryTool === "move" && !deleteMode,
      deleteMode,
      addMode,
      labelDensity,
      showRegionLabels,
      showRouteText,
      showTokenLabels,
      frontAlpha,
      showGrid,
      showRelationships,
      showFronts,
      showRegions,
      showProjections,
      projectionAgents,
      connectionSourceKey,
      updateOnlyDragTarget,
      majorLabelStyle,
      minorLabelStyle,
      tinyLabelStyle,
      zoomScale,
      drawNodeCard
    };

    renderGridLayer(renderLayerOptions);
    renderInfrastructureLayer(renderLayerOptions);
    if (showRelationships) {
      renderRelationshipsLayer(renderLayerOptions);
    }
    renderGeographyLayer(renderLayerOptions);
    renderEntitiesLayer(renderLayerOptions);
  }

  function renderGridLayer(opts: RenderLayerOptions) {
    const { Graphics } = pixi;
    const { showGrid, updateOnlyDragTarget, refs } = opts;
    if (!showGrid) return;
    if (updateOnlyDragTarget && updateOnlyDragTarget.kind !== "region-radius") return;
    const minorGrid = new Graphics();
    const majorGrid = new Graphics();
    const majorStep = GRID_SIZE * 5;
    for (let x = -WORLD_EXTENT; x <= WORLD_EXTENT; x += GRID_SIZE) {
      for (let y = -WORLD_EXTENT; y <= WORLD_EXTENT; y += GRID_SIZE) {
        if (x % majorStep === 0 && y % majorStep === 0) continue;
        minorGrid.circle(x, y, 0.8);
      }
    }
    minorGrid.fill({ color: 0x06b6d4, alpha: 0.12 });
    for (let x = -WORLD_EXTENT; x <= WORLD_EXTENT; x += majorStep) {
      for (let y = -WORLD_EXTENT; y <= WORLD_EXTENT; y += majorStep) {
        majorGrid.circle(x, y, 1.4);
        const glow = new Graphics();
        glow.circle(x, y, 4);
        glow.fill({ color: 0x06b6d4, alpha: 0.04 });
        majorGrid.addChild(glow);
      }
    }
    majorGrid.fill({ color: 0x22d3ee, alpha: 0.32 });
    refs.layers.grid.addChild(minorGrid);
    refs.layers.grid.addChild(majorGrid);
  }

  function renderInfrastructureLayer(opts: RenderLayerOptions) {
    const { Graphics, Text, Container } = pixi;
    const { scene, refs, selectedEntity, onSelectEntity, onSelectConnectionTarget, connectionSourceKey, showRouteText, tinyLabelStyle, frontAlpha, drawNodeCard, showFronts } = opts;

    for (const route of scene.map.routes) {
      const from = scene.map.sites.find((site) => site.id === route.fromSiteId);
      const to = scene.map.sites.find((site) => site.id === route.toSiteId);
      if (!from || !to) continue;
      const color = routeStroke(route.status);
      const isSelected = selectedEntity?.type === "route" && selectedEntity.id === route.id;
      const glow = new Graphics();
      glow.moveTo(from.position.x, from.position.y).lineTo(to.position.x, to.position.y);
      glow.stroke({ width: 8, color: color, alpha: isSelected ? 0.15 : 0.05, join: "round" });
      refs.layers.routes.addChild(glow);
      const line = new Graphics();
      line.moveTo(from.position.x, from.position.y).lineTo(to.position.x, to.position.y);
      line.stroke({ width: isSelected ? 3.5 : 2.2, color: color, alpha: 0.65, join: "round" });
      line.eventMode = "static";
      line.cursor = "pointer";
      line.on("pointertap", (event: any) => {
        event.stopPropagation();
        if (deleteMode) {
          onRequestDeleteSelection({ type: "route", id: route.id });
          setDeleteMode(false);
          return;
        }
        onSelectEntity({ type: "route", id: route.id });
      });
      refs.layers.routes.addChild(line);
      if (showRouteText) {
        const label = new Text({ text: route.name, style: tinyLabelStyle });
        label.anchor.set(0.5);
        label.alpha = 0.82;
        label.position.set((from.position.x + to.position.x) / 2, (from.position.y + to.position.y) / 2 - 14);
        refs.layers.routes.addChild(label);
      }
    }

    if (!showFronts) return;
    for (const front of scene.fronts) {
      const frontIndex = scene.fronts.findIndex((entry) => entry.id === front.id);
      const region = scene.map.regions.find((candidate) => candidate.id === front.regionId);
      if (!region) continue;
      const heat = Math.max(front.progress, front.pressure);
      const isSelected = selectedEntity?.type === "front" && selectedEntity.id === front.id;
      const ring = new Graphics();
      ring.circle(region.center.x, region.center.y, region.radius + 20 + heat * 24);
      ring.stroke({ color: frontStroke(front), alpha: frontAlpha * (isSelected ? 1 : 0.6), width: isSelected ? 3.5 : 2.1 });
      ring.eventMode = "static";
      ring.cursor = "pointer";
      ring.on("pointertap", (event: any) => {
        event.stopPropagation();
        if (deleteMode) {
          onRequestDeleteSelection({ type: "front", id: front.id });
          setDeleteMode(false);
          return;
        }
        if (connectionSourceKey) { void onSelectConnectionTarget({ type: "front", id: front.id }); return; }
        onSelectEntity({ type: "front", id: front.id });
      });
      refs.layers.fronts.addChild(ring);
      const container = new Container();
      const offsetX = region.radius * 0.8;
      const offsetY = -region.radius * 0.5 - (frontIndex * 50);
      container.position.set(region.center.x + offsetX, region.center.y + offsetY);
      container.eventMode = "static";
      container.cursor = "pointer";
      drawNodeCard({ container, width: 150, height: 44, color: frontStroke(front), title: front.name, subtitle: front.pressure > 0.6 ? "Volatile Front" : "Stable Front", isSelected, statusColor: frontStroke(front) });
      container.on("pointertap", (event: any) => {
        event.stopPropagation();
        if (deleteMode) {
          onRequestDeleteSelection({ type: "front", id: front.id });
          setDeleteMode(false);
          return;
        }
        onSelectEntity({ type: "front", id: front.id });
      });
      refs.layers.fronts.addChild(container);
    }
  }

  function renderRelationshipsLayer(opts: RenderLayerOptions) {
    const { Graphics, Text } = pixi;
    const { scene, refs, selectedEntity, onSelectEntity, zoomScale, tinyLabelStyle, deleteMode } = opts;

    for (const relationship of scene.relationships) {
      const source = scene.agents.find((agent) => agent.id === relationship.sourceAgentId);
      const target = scene.agents.find((agent) => agent.id === relationship.targetAgentId);
      if (!source || !target) continue;
      const line = new Graphics();
      line.moveTo(source.position.x, source.position.y).lineTo(target.position.x, target.position.y);
      line.stroke({ width: 1 + relationship.tension * 1.35, color: relationshipStroke(relationship), alpha: 0.16, join: "round" });
      refs.layers.relationships.addChild(line);
    }
    for (const link of scene.boardLinks) {
      const source = resolveConnectablePosition(scene, link.source);
      const target = resolveConnectablePosition(scene, link.target);
      if (!source || !target) continue;
      const isSelected = selectedEntity?.type === "boardLink" && selectedEntity.id === link.id;
      const linkTypeColors: Record<string, number> = {
        conflict: 0xff3e3e,
        alliance: 0x2dd4bf,
        dependency: 0xa1a1aa,
        route: 0x38bdf8,
      };
      const strokeColor = linkTypeColors[link.type] ?? 0x22d3ee;
      const glow = new Graphics();
      glow.moveTo(source.x, source.y).lineTo(target.x, target.y);
      glow.stroke({ width: 6, color: strokeColor, alpha: isSelected ? 0.2 : 0.08, join: "round" });
      refs.layers.relationships.addChild(glow);
      const line = new Graphics();
      line.moveTo(source.x, source.y).lineTo(target.x, target.y);
      line.stroke({ width: isSelected ? 3.8 : 2.5, color: strokeColor, alpha: isSelected ? 1 : 0.55, join: "round" });
      line.eventMode = "static";
      line.cursor = "pointer";
      line.on("pointertap", (event: any) => {
        event.stopPropagation();
        if (deleteMode) {
          onRequestDeleteSelection({ type: "boardLink", id: link.id });
          setDeleteMode(false);
          return;
        }
        onSelectEntity({ type: "boardLink", id: link.id });
      });
      refs.layers.relationships.addChild(line);
      if (zoomScale > 0.78) {
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;
        const label = new Text({ text: link.label ?? link.type, style: tinyLabelStyle });
        label.anchor.set(0.5);
        label.alpha = 0.9;
        label.position.set(midX, midY - 12);
        refs.layers.relationships.addChild(label);
      }
    }
  }

  function renderGeographyLayer(opts: RenderLayerOptions) {
    const { Container, Graphics, Text } = pixi;
    const { scene, refs, editMode, deleteMode, addMode, connectionSourceKey, setDragTarget, onSelectConnectionTarget, onSelectEntity, showRegionLabels, majorLabelStyle, updateOnlyDragTarget, showRegions } = opts;

    if (updateOnlyDragTarget && updateOnlyDragTarget.kind !== "region-radius") return;
    if (!showRegions) return;
    for (const region of scene.map.regions) {
      const container = new Container();
      container.label = `region_${region.id}`;
      container.position.set(region.center.x, region.center.y);
      container.eventMode = "static";
      container.cursor = editMode ? "grab" : "default";
      const fillColor = getFactionColor(region.controllingFactionId);
      const shape = new Graphics();
      shape.circle(0, 0, region.radius);
      shape.fill({ color: fillColor, alpha: 0.12 });
      shape.stroke({ color: fillColor, alpha: 0.32, width: 1.8 });
      container.addChild(shape);
      if (showRegionLabels) {
        const title = new Text({ text: region.name, style: majorLabelStyle });
        title.anchor.set(0.5);
        title.position.set(0, -region.radius - 26);
        container.addChild(title);
      }
      container.on("pointerdown", (event: any) => {
        if (!editMode || addMode !== "none" || connectionSourceKey) return;
        event.stopPropagation();
        setDragTarget({ kind: "region", id: region.id }, refs.viewport.toWorld(event.global));
        refs.viewport.plugins.pause("drag");
      });
      container.on("pointertap", (event: any) => {
        event.stopPropagation();
        if (deleteMode) {
          onRequestDeleteSelection({ type: "region", id: region.id });
          setDeleteMode(false);
          return;
        }
        if (connectionSourceKey) { void onSelectConnectionTarget({ type: "region", id: region.id }); return; }
        onSelectEntity({ type: "region", id: region.id });
      });
      container.on("pointerup", () => refs.viewport.plugins.resume("drag"));
      container.on("pointerupoutside", () => refs.viewport.plugins.resume("drag"));
      refs.layers.regions.addChild(container);
      if (editMode) {
        const handle = new Graphics();
        handle.circle(region.radius, 0, 8);
        handle.fill({ color: 0xf4f4f6, alpha: 0.94 });
        handle.stroke({ color: 0x0a0a0c, width: 2 });
        handle.eventMode = "static";
        handle.cursor = "ew-resize";
        handle.on("pointerdown", (event: any) => {
          if (addMode !== "none" || connectionSourceKey) return;
          event.stopPropagation();
          setDragTarget({ kind: "region-radius", id: region.id }, refs.viewport.toWorld(event.global));
          refs.viewport.plugins.pause("drag");
        });
        handle.on("pointerup", () => refs.viewport.plugins.resume("drag"));
        handle.on("pointerupoutside", () => refs.viewport.plugins.resume("drag"));
        container.addChild(handle);
      }
    }
    for (const site of scene.map.sites) {
      const container = new Container();
      container.label = `site_${site.id}`;
      container.position.set(site.position.x, site.position.y);
      container.eventMode = "static";
      container.cursor = editMode ? "grab" : "default";
      const isSelected = opts.selectedEntity?.type === "site" && opts.selectedEntity.id === site.id;
      const factionColor = getFactionColor(site.controllingFactionId);
      opts.drawNodeCard({ container, width: 120, height: 38, color: factionColor, title: site.name, subtitle: "Operational Site", isSelected, statusColor: factionColor });
      container.on("pointerdown", (event: any) => {
        if (deleteMode) {
          event.stopPropagation();
          onRequestDeleteSelection({ type: "site", id: site.id });
          setDeleteMode(false);
          return;
        }
        if (connectionSourceKey) { event.stopPropagation(); void onSelectConnectionTarget({ type: "site", id: site.id }); return; }
        onSelectEntity({ type: "site", id: site.id });
        if (!editMode || addMode !== "none") return;
        event.stopPropagation();
        setDragTarget({ kind: "site", id: site.id }, refs.viewport.toWorld(event.global));
        refs.viewport.plugins.pause("drag");
      });
      container.on("pointerup", () => refs.viewport.plugins.resume("drag"));
      container.on("pointerupoutside", () => refs.viewport.plugins.resume("drag"));
      refs.layers.sites.addChild(container);
    }
  }

  function renderEntitiesLayer(opts: RenderLayerOptions) {
    const { Container, Graphics, Text } = pixi;
    const { scene, refs, editMode, deleteMode, addMode, connectionSourceKey, setDragTarget, onSelectConnectionTarget, onSelectEntity, selectedEntity, showTokenLabels, minorLabelStyle, showProjections, projectionAgents, drawNodeCard } = opts;

    for (const node of scene.campaignNodes) {
      const container = new Container();
      container.label = `campaign-node_${node.id}`;
      container.position.set(node.position.x, node.position.y);
      container.eventMode = "static";
      container.cursor = editMode ? "grab" : "pointer";
      const isSelected = selectedEntity?.type === "campaignNode" && selectedEntity.id === node.id;
      const kindLabel = node.kind.charAt(0).toUpperCase() + node.kind.slice(1);
      const nodeColor = campaignNodeColor(node.kind);
      drawNodeCard({ container, width: 140, height: 44, color: nodeColor, title: node.name, subtitle: `${kindLabel} Entity`, isSelected, statusColor: nodeColor });
      container.on("pointertap", (event: any) => {
        event.stopPropagation();
        if (deleteMode) {
          onRequestDeleteSelection({ type: "campaignNode", id: node.id });
          setDeleteMode(false);
          return;
        }
        if (connectionSourceKey) { void onSelectConnectionTarget({ type: "campaignNode", id: node.id }); return; }
        onSelectEntity({ type: "campaignNode", id: node.id });
      });
      container.on("pointerdown", (event: any) => {
        event.stopPropagation();
        onSelectEntity({ type: "campaignNode", id: node.id });
        if (!editMode || addMode !== "none" || connectionSourceKey) return;
        setDragTarget({ kind: "campaign-node", id: node.id }, refs.viewport.toWorld(event.global));
        refs.viewport.plugins.pause("drag");
      });
      container.on("pointerup", () => refs.viewport.plugins.resume("drag"));
      container.on("pointerupoutside", () => refs.viewport.plugins.resume("drag"));
      const targetLayer = (node.tags ?? []).includes("manual") ? refs.layers.manualNodes : refs.layers.nodes;
      targetLayer.addChild(container);
    }
    for (const token of scene.map.tokens) {
      const container = new Container();
      container.label = `token_${token.id}`;
      container.position.set(token.position.x, token.position.y);
      container.eventMode = "static";
      container.cursor = editMode ? "grab" : "default";
      const tokenColor = TOKEN_COLORS[token.kind];
      const dot = new Graphics();
      if (token.kind === "faction") {
        dot.moveTo(0, -11).lineTo(11, 0).lineTo(0, 11).lineTo(-11, 0).closePath();
      } else if (token.kind === "threat") {
        dot.moveTo(0, -11).lineTo(10, 9).lineTo(-10, 9).closePath();
      } else {
        dot.circle(0, 0, 11);
      }
      dot.fill({ color: tokenColor, alpha: 0.96 });
      dot.stroke({ color: 0xffffff, width: 1.5, alpha: 0.4 });
      container.addChild(dot);
      if (showTokenLabels) {
        const label = new Text({ text: token.name, style: minorLabelStyle });
        label.anchor.set(0.5);
        label.alpha = 0.88;
        label.position.set(0, token.kind === "party" ? 22 : 20);
        container.addChild(label);
      }
      container.on("pointerdown", (event: any) => {
        if (!editMode || addMode !== "none" || connectionSourceKey) return;
        event.stopPropagation();
        setDragTarget({ kind: "token", id: token.id }, refs.viewport.toWorld(event.global));
        refs.viewport.plugins.pause("drag");
      });
      container.on("pointerup", () => refs.viewport.plugins.resume("drag"));
      container.on("pointerupoutside", () => refs.viewport.plugins.resume("drag"));
      refs.layers.tokens.addChild(container);
    }
    if (showProjections) {
      for (const projectionAgent of projectionAgents) {
        const agent = scene.agents.find((candidate) => candidate.id === projectionAgent.id);
        if (!agent) continue;
        const ghost = new Graphics();
        ghost.circle(projectionAgent.position.x, projectionAgent.position.y, 18);
        ghost.stroke({ color: getFactionColor(agent.factionId), alpha: 0.32, width: 1.5 });
        refs.layers.ghosts.addChild(ghost);
      }
    }
    for (const agent of scene.agents) {
      const container = new Container();
      container.label = `agent_${agent.id}`;
      container.position.set(agent.position.x, agent.position.y);
      container.eventMode = "static";
      container.cursor = editMode ? "grab" : "default";
      const isSelected = selectedEntity?.type === "agent" && selectedEntity.id === agent.id;
      const factionColor = getFactionColor(agent.factionId);
      const statusColor = agent.status === "alive" ? 0x2dd4bf : 0xfb7185;
      drawNodeCard({ container, width: 130, height: 42, color: factionColor, title: agent.name, subtitle: agent.status === "alive" ? "Active Operative" : "Terminated", isSelected, statusColor });
      container.on("pointertap", (event: any) => {
        event.stopPropagation();
        if (deleteMode) {
          onRequestDeleteSelection({ type: "agent", id: agent.id });
          setDeleteMode(false);
          return;
        }
        if (connectionSourceKey) { void onSelectConnectionTarget({ type: "agent", id: agent.id }); return; }
        onSelectEntity({ type: "agent", id: agent.id });
      });
      container.on("pointerdown", (event: any) => {
        event.stopPropagation();
        onSelectEntity({ type: "agent", id: agent.id });
        if (!editMode || addMode !== "none" || connectionSourceKey) return;
        setDragTarget({ kind: "agent", id: agent.id }, refs.viewport.toWorld(event.global));
        refs.viewport.plugins.pause("drag");
      });
      container.on("pointerup", () => refs.viewport.plugins.resume("drag"));
      container.on("pointerupoutside", () => refs.viewport.plugins.resume("drag"));
      refs.layers.agents.addChild(container);
    }
  }

  const requestRender = useCallback((dragTarget?: DragTarget) => {

    if (dragTarget) {
      if (!renderFlagsRef.current.full) renderFlagsRef.current.dragTarget = dragTarget;
    } else {
      renderFlagsRef.current.full = true;
      renderFlagsRef.current.dragTarget = null;
    }

    if (renderRafRef.current !== null) return;
    renderRafRef.current = requestAnimationFrame(() => {
      renderRafRef.current = null;
      const flags = renderFlagsRef.current;
      const target = flags.dragTarget;
      flags.full = false;
      flags.dragTarget = null;

      const refs = pixiRef.current;
      if (!refs) return;
      renderScene({
        refs,
        scene: sceneRef.current,
        selectedEntity,
        onSelectEntity,
        onSelectConnectionTarget: async (selection: ConnectableSelection) => {
          if (!connectionSourceKey || connectionSourceKey === "__armed__") {
            setConnectionSourceKey(encodeSelectionKey(selection));
            return;
          }
          const source = decodeSelectionKey(connectionSourceKey);
          if (!source) {
            setConnectionSourceKey(null);
            return;
          }
          if (source.type === selection.type && source.id === selection.id) {
            setConnectionSourceKey(null);
            return;
          }
          if (source.type === "site" && selection.type === "site" && linkType === "route") {
            const fromSite = sceneRef.current.map.sites.find((site) => site.id === source.id);
            const toSite = sceneRef.current.map.sites.find((site) => site.id === selection.id);
            if (fromSite && toSite) {
              await onCreateRoute({
                name: `${fromSite.name} to ${toSite.name}`,
                fromSiteId: fromSite.id,
                toSiteId: toSite.id,
              });
            }
          } else {
            await onCreateBoardLink({
              linkType,
              source,
              target: selection,
              label:
                linkType === "route"
                  ? `${resolveConnectableLabel(sceneRef.current, source)} to ${resolveConnectableLabel(sceneRef.current, selection)}`
                  : null,
            });
          }
          setConnectionSourceKey(null);
        },
        setDragTarget: (target: DragTarget, startWorld: Position) => {
          const camera = cameraMotionRef.current;
          camera.isPanning = false;
          camera.hasTarget = false;
          camera.vx = 0;
          camera.vy = 0;
          dragRef.current = { target, startWorld, moved: false };
        },
        editMode: primaryTool === "move" && !deleteMode,
        deleteMode,
        addMode,
        labelDensity,
        showRouteLabels,
        showFrontLabels,
        showRegionMetrics,
        showMinorLabels,
        frontAlpha,
        showGrid,
        showRelationships,
        showFronts,
        showRegions,
        showProjections,
        projectionAgents,
        connectionSourceKey,
        linkType,
        updateOnlyDragTarget: target || undefined,
      });
    });
  }, [
    addMode,
    connectionSourceKey,
    deleteMode,
    frontAlpha,
    labelDensity,
    linkType,
    onCreateBoardLink,
    onCreateRoute,
    onSelectEntity,
    projectionAgents,
    selectedEntity,
    primaryTool,
    showFronts,
    showFrontLabels,
    showGrid,
    showRelationships,
    showRegions,
    showMinorLabels,
    showProjections,
    showRegionMetrics,
    showRouteLabels,
  ]);

  const liveContext = useRef({
    addMode,
    primaryTool,
    deleteMode,
    snapToGrid,
    onMoveAgent,
    onMoveCampaignNode,
    onCreateCampaignNode,
    onCreateRegion,
    onCreateSite,
    onCreateToken,
    onMoveRegion,
    onMoveSite,
    onMoveToken,
    onResizeRegion,
    onSelectEntity,
    requestRender,
    updateZoomHud,
  });
  liveContext.current = {
    addMode,
    primaryTool,
    deleteMode,
    snapToGrid,
    onMoveAgent,
    onMoveCampaignNode,
    onCreateCampaignNode,
    onCreateRegion,
    onCreateSite,
    onCreateToken,
    onMoveRegion,
    onMoveSite,
    onMoveToken,
    onResizeRegion,
    onSelectEntity,
    requestRender,
    updateZoomHud,
  };

  useEffect(() => {
    let disposed = false;

    const mount = async () => {
      if (!hostRef.current) return;

      const pixi = await import("pixi.js");
      if (disposed || !hostRef.current) return;

      const app = new pixi.Application();
      await app.init({
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
        resizeTo: hostRef.current,
        preference: "webgl",
      });

      // CRITICAL FIX: If React unmounted this component *while* WebGL was initializing,
      // we must destroy this newly created zombie instance immediately to prevent massive canvas limits/leaks.
      if (disposed) {
        app.destroy({ removeView: true }, { children: true });
        return;
      }

      hostRef.current.appendChild(app.canvas);
      app.stage.eventMode = "static";
      app.stage.hitArea = new pixi.Rectangle(0, 0, 100000, 100000); // broad hit area for stage dragging

      // Native Viewport Replacement (to fix pixi-viewport v8 incompatibilities)
      const viewport = new pixi.Container() as any;
      viewport.screenWidth = hostRef.current.clientWidth;
      viewport.screenHeight = hostRef.current.clientHeight;
      viewport.scale.set(1);
      viewport.position.set(0, 0);

      viewport.resize = (w: number, h: number) => {
        viewport.screenWidth = w;
        viewport.screenHeight = h;
      };
      viewport.setZoom = (zoom: number, centerXY?: boolean) => {
        const clampZoom = clamp(zoom, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM);
        const camera = cameraMotionRef.current;
        if (centerXY) {
           const cx = viewport.screenWidth / 2;
           const cy = viewport.screenHeight / 2;
           const worldX = (cx - camera.x) / camera.zoom;
           const worldY = (cy - camera.y) / camera.zoom;
           setCameraTarget({
             x: cx - worldX * clampZoom,
             y: cy - worldY * clampZoom,
             zoom: clampZoom,
           });
        } else {
           setCameraTarget({
             x: camera.targetX,
             y: camera.targetY,
             zoom: clampZoom,
           });
        }
      };
      viewport.moveCenter = (wx: number, wy: number) => {
        setCameraCenterTarget({
          centerX: wx,
          centerY: wy,
          scale: cameraMotionRef.current.targetZoom,
        });
      };
      viewport.toWorld = (pt: Position) => {
        return {
          x: (pt.x - viewport.position.x) / viewport.scale.x,
          y: (pt.y - viewport.position.y) / viewport.scale.y
        };
      };
      viewport.plugins = { pause: () => {}, resume: () => {} };

      app.stage.addChild(viewport);

      const layerNames = ["grid", "routes", "relationships", "regions", "fronts", "sites", "tokens", "nodes", "ghosts", "agents", "manualNodes"];
      const layers = Object.fromEntries(
        layerNames.map((name) => {
          const container = new pixi.Container();
          viewport.addChild(container);
          return [name, container];
        })
      ) as Record<string, any>;

      const resizeObserver = new ResizeObserver(() => {
        if (!hostRef.current) return;
        viewport.resize(hostRef.current.clientWidth, hostRef.current.clientHeight);
        syncViewportToCamera();
        liveContext.current.updateZoomHud();
      });
      resizeObserver.observe(hostRef.current);

      let isPanning = false;
      let lastPanPos = { x: 0, y: 0 };
      
      const finalizeDrag = async () => {
        const drag = dragRef.current;
        if (!drag) return;
        dragRef.current = null;
        await persistDrag(sceneRef.current, drag.target, liveContext.current);
      };

      const handlePointerDown = (event: any) => {
        const clickedStage = event.target === app.stage;
        const shouldPanFromMoveTool =
          clickedStage &&
          liveContext.current.primaryTool === "move" &&
          !liveContext.current.deleteMode &&
          liveContext.current.addMode === "none";

        // Only pan on middle-click, or if the user clicks empty space in 'view' mode (handled by click events)
        if (
          event.button === 1 ||
          event.button === 2 ||
          shouldPanFromMoveTool
        ) {
           const camera = cameraMotionRef.current;
           camera.isPanning = true;
           camera.hasTarget = false;
           camera.vx = 0;
           camera.vy = 0;
           camera.lastTimestamp = performance.now();
           isPanning = true;
           lastPanPos = { x: event.global.x, y: event.global.y };
         }
      };

      const handlePointerMove = (event: any) => {
        if (isPanning) {
           const now = performance.now();
           const dx = (event.global.x - lastPanPos.x) * CAMERA_DRAG_SENSITIVITY;
           const dy = (event.global.y - lastPanPos.y) * CAMERA_DRAG_SENSITIVITY;
           const camera = cameraMotionRef.current;
           const elapsed = Math.max(now - (camera.lastTimestamp ?? now), 1);
           const velocityFactor = 16.6667 / elapsed;
           camera.targetX += dx;
           camera.targetY += dy;
           camera.x = camera.targetX;
           camera.y = camera.targetY;
           camera.vx = dx * velocityFactor;
           camera.vy = dy * velocityFactor;
           camera.lastTimestamp = now;
           syncViewportToCamera();
           lastPanPos = { x: event.global.x, y: event.global.y };
        } else if (dragRef.current) {
          const world = snapPoint(viewport.toWorld(event.global), liveContext.current.snapToGrid);
          const drag = dragRef.current;
          drag.moved =
            drag.moved ||
            Math.abs(world.x - drag.startWorld.x) > 2 ||
            Math.abs(world.y - drag.startWorld.y) > 2;
          applyDrag(sceneRef.current, drag.target, world);
          liveContext.current.requestRender(drag.target);
        }
      };

      const handlePointerUp = () => {
        isPanning = false;
        cameraMotionRef.current.isPanning = false;
        ensureCameraLoop();
        void finalizeDrag();
      };
      
      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const pointer = { x: e.clientX, y: e.clientY };
        const worldPos = viewport.toWorld(pointer);
        const camera = cameraMotionRef.current;
        const nextZoom = clamp(camera.targetZoom * Math.exp(-e.deltaY * CAMERA_WHEEL_INTENSITY), CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM);
        camera.isPanning = false;
        camera.hasTarget = true;
        camera.targetZoom = nextZoom;
        camera.targetX = pointer.x - worldPos.x * nextZoom;
        camera.targetY = pointer.y - worldPos.y * nextZoom;
        ensureCameraLoop();
      };
      hostRef.current.addEventListener("wheel", handleWheel, { passive: false });

      const handleGlobalClick = async (event: any) => {
        if (dragRef.current?.moved || isPanning) return;
        const world = snapPoint(viewport.toWorld(event.global), liveContext.current.snapToGrid);
        if (liveContext.current.addMode === "region") {
          await liveContext.current.onCreateRegion({
            name: `Region ${sceneRef.current.map.regions.length + 1}`,
            kind: "frontier",
            x: world.x,
            y: world.y,
            radius: 140,
          });
          setAddMode("none");
          setPrimaryTool("inspect");
          return;
        }
        if (liveContext.current.addMode === "site") {
          await liveContext.current.onCreateSite({
            name: `Site ${sceneRef.current.map.sites.length + 1}`,
            kind: "waypoint",
            x: world.x,
            y: world.y,
            regionId: findNearestRegion(sceneRef.current.map, world)?.id ?? null,
          });
          setAddMode("none");
          setPrimaryTool("inspect");
          return;
        }
        if (liveContext.current.addMode === "token") {
          const nearestSite = findNearestSite(sceneRef.current.map, world);
          await liveContext.current.onCreateToken({
            name: `Token ${sceneRef.current.map.tokens.length + 1}`,
            kind: "party",
            x: world.x,
            y: world.y,
            regionId: findNearestRegion(sceneRef.current.map, world)?.id ?? null,
            siteId: nearestSite?.id ?? null,
          });
          setAddMode("none");
          setPrimaryTool("inspect");
          return;
        }
        if (
          liveContext.current.addMode === "agent" ||
          liveContext.current.addMode === "place" ||
          liveContext.current.addMode === "faction" ||
          liveContext.current.addMode === "front" ||
          liveContext.current.addMode === "event"
        ) {
          const nextIndex =
            sceneRef.current.campaignNodes.filter((node) => node.kind === liveContext.current.addMode).length + 1;
          await liveContext.current.onCreateCampaignNode({
            name: `${liveContext.current.addMode.charAt(0).toUpperCase()}${liveContext.current.addMode.slice(1)} ${nextIndex}`,
            kind: liveContext.current.addMode,
            x: world.x,
            y: world.y,
            regionId: findNearestRegion(sceneRef.current.map, world)?.id ?? null,
            siteId: findNearestSite(sceneRef.current.map, world)?.id ?? null,
          });
          setAddMode("none");
          setPrimaryTool("inspect");
          return;
        }
        liveContext.current.onSelectEntity(null);
      };

      app.stage.on("pointerdown", handlePointerDown);
      app.stage.on("globalpointermove", handlePointerMove);
      app.stage.on("pointerup", handlePointerUp);
      app.stage.on("pointerupoutside", handlePointerUp);
      app.stage.on("click", handleGlobalClick);

      pixiRef.current = { app, viewport, layers, modules: pixi, resizeObserver, handleWheel };
      sceneRef.current = cloneScene(agents, boardLinks, campaignNodes, relationships, map, fronts);

      cameraMotionRef.current = {
        x: 0,
        y: 0,
        zoom: 1,
        targetX: 0,
        targetY: 0,
        targetZoom: 1,
        vx: 0,
        vy: 0,
        isPanning: false,
        hasTarget: false,
        lastTimestamp: null,
      };
      syncViewportToCamera();
      liveContext.current.requestRender();
      liveContext.current.updateZoomHud();
    };

    void mount();

    return () => {
      disposed = true;
      if (animationRafRef.current !== null) cancelAnimationFrame(animationRafRef.current);
      if (renderRafRef.current !== null) cancelAnimationFrame(renderRafRef.current);
      const refs = pixiRef.current;
      if (!refs) return;
      
      refs.resizeObserver?.disconnect();
      if (hostRef.current && refs.app.canvas && hostRef.current.contains(refs.app.canvas)) {
        hostRef.current.removeChild(refs.app.canvas);
      }
      
      setTimeout(() => {
        try {
          refs.app.destroy({ removeView: true }, { children: true });
        } catch (e) {
          console.warn("PixiJS cleanup error:", e);
        }
      }, 0);
      
      pixiRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sceneRef.current = cloneScene(agents, boardLinks, campaignNodes, relationships, map, fronts);
    requestRender();
  }, [agents, boardLinks, campaignNodes, fronts, map, relationships, requestRender]);

  const previousManualNodeIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const manualNodes = campaignNodes.filter((node) => (node.tags ?? []).includes("manual"));
    const previousIds = previousManualNodeIdsRef.current;
    const createdNode = manualNodes.find((node) => !previousIds.includes(node.id));
    previousManualNodeIdsRef.current = manualNodes.map((node) => node.id);

    if (!createdNode) return;

    onSelectEntity({ type: "campaignNode", id: createdNode.id });
    requestAnimationFrame(() => {
      animateCamera({
        centerX: createdNode.position.x,
        centerY: createdNode.position.y,
        scale: Math.max(pixiRef.current?.viewport?.scale?.x ?? 1, 1.2),
      });
    });
  }, [animateCamera, campaignNodes, onSelectEntity]);

  useEffect(() => {
    requestRender();
  }, [
    selectedEntity,
    labelDensity,
    showRouteLabels,
    showFrontLabels,
    showRegionMetrics,
    showMinorLabels,
    frontAlpha,
    showProjections,
    projectionAgents,
    requestRender,
  ]);

  useEffect(() => {
    if (isEmptyState) return;
    if (!initializedCameraRef.current) {
      fitToContent();
      initializedCameraRef.current = true;
    }
  }, [fitToContent, isEmptyState]);

  useEffect(() => {
    if (!pixiRef.current) return;
    if (isEmptyState) {
      if (!initializedCameraRef.current) {
        setCameraCenterTarget({ centerX: 0, centerY: 0, scale: 1 }, { immediate: true });
        initializedCameraRef.current = true;
      }
      return;
    }
    initializedCameraRef.current = false;
  }, [isEmptyState, setCameraCenterTarget]);

  const activeMode = addMode !== "none" ? addMode : connectionSourceKey ? "connect" : deleteMode ? "delete" : null;
  const canvasCursor = activeMode ? "crosshair" : "default";
  const viewControls = [
    { id: "grid", icon: Grid3x3, label: "Toggle grid", active: showGrid, onClick: () => setShowGrid((value) => !value) },
    { id: "snap", icon: Magnet, label: "Toggle snap", active: snapToGrid, onClick: () => setSnapToGrid((value) => !value) },
    {
      id: "labels",
      icon: Tag,
      label: `Cycle labels (${labelDensity})`,
      active: labelDensity !== "minimal",
      onClick: () => {
        const next =
          workspaceSettings.map.labelDensity === "minimal"
            ? "balanced"
            : workspaceSettings.map.labelDensity === "balanced"
              ? "dense"
              : "minimal";
        setWorkspaceSettings({ map: { ...workspaceSettings.map, labelDensity: next } });
      },
    },
    { id: "regions", icon: showRegions ? Hexagon : EyeOff, label: "Toggle regions", active: showRegions, onClick: () => setShowRegions((value) => !value) },
    { id: "fronts", icon: showFronts ? FlagTriangleRight : EyeOff, label: "Toggle fronts", active: showFronts, onClick: () => setShowFronts((value) => !value) },
    { id: "links", icon: showRelationships ? Link2 : EyeOff, label: "Toggle links", active: showRelationships, onClick: () => setShowRelationships((value) => !value) },
  ] as const;
  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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
        case "g": setShowGrid(v => !v); break;
        case "n": setSnapToGrid(v => !v); break;
        case "f": fitToContent(); break;
        case "0": resetCamera(); break;
        case "escape": setBoardTool("inspect"); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fitToContent, resetCamera, setBoardTool]);

  return (
    <div 
      className="relative h-full overflow-hidden rounded-[inherit]" 
      style={{ 
        cursor: canvasCursor,
        background: "radial-gradient(circle at top, rgba(34,211,238,0.12), transparent 36%), linear-gradient(180deg, #02070b 0%, #061118 48%, #04070a 100%)" 
      }}
    >
      {/* ── Grid Layer Host (PixiJS) ── */}
      <div ref={hostRef} className="absolute inset-0 touch-none select-none z-10" />

      <Tooltip.Provider delayDuration={120}>
      <div className="absolute inset-0 z-20 pointer-events-none">
        <div className="pointer-events-auto">
        <div className="absolute left-4 top-4 z-10">
          <div className="w-16 rounded-[18px] border border-white/8 bg-[rgba(7,11,14,0.94)] p-2 shadow-[0_8px_20px_rgba(0,0,0,0.22)] backdrop-blur-sm">
            <CanvasToolGroup>
              {INTERACTION_TOOL_CONFIG.map(({ tool, label, shortcut, destructive }) => (
                <CanvasIconButton
                  key={tool}
                  icon={TOOL_ICON_MAP[tool]}
                  label={tool === "connect" ? `${label} (${linkType})` : label}
                  shortcut={shortcut || undefined}
                  active={activeTool === tool}
                  destructive={destructive}
                  onClick={() => setBoardTool(tool)}
                />
              ))}
            </CanvasToolGroup>

            <CanvasToolGroup className="mt-3 border-t border-white/6 pt-3">
              {CREATION_TOOL_CONFIG.map(({ tool, label, shortcut }) => (
                <CanvasIconButton
                  key={tool}
                  icon={TOOL_ICON_MAP[tool]}
                  label={label}
                  shortcut={shortcut || undefined}
                  active={activeTool === tool}
                  onClick={() => setBoardTool(tool)}
                />
              ))}
            </CanvasToolGroup>

            <CanvasToolGroup className="mt-3 border-t border-white/6 pt-3">
              <CanvasIconButton
                icon={Eye}
                label={showViewControls ? "Hide view controls" : "Show view controls"}
                active={showViewControls}
                onClick={() => setShowViewControls((value) => !value)}
              />
              {showViewControls ? (
                <div className="mt-2 flex flex-col gap-2">
                  {viewControls.map((control) => (
                    <CanvasIconButton
                      key={control.id}
                      icon={control.icon}
                      label={control.label}
                      active={control.active}
                      subtle
                      onClick={control.onClick}
                    />
                  ))}
                </div>
              ) : null}
            </CanvasToolGroup>
          </div>
        </div>

      {/* ── Floating Toolbar ── */}
      <CanvasStatusStrip
        icon={activeTool === "delete" ? Trash2 : activeTool === "connect" ? Workflow : activeTool === "move" ? Hand : TOOL_ICON_MAP[activeTool]}
        label={modeDescriptor}
      />

      <div className="absolute right-4 top-4 z-10 w-40 rounded-[16px] border border-white/8 bg-[rgba(7,11,14,0.94)] p-3 shadow-[0_8px_20px_rgba(0,0,0,0.22)] backdrop-blur-sm">
        <div className="flex items-center justify-between rounded-[12px] border border-white/7 bg-white/[0.03] px-3 py-2">
          <button type="button" onClick={() => pixiRef.current?.viewport?.setZoom((pixiRef.current?.viewport?.scale?.x ?? 1) * 0.9, true)} className="text-white/70 transition hover:text-white" aria-label="Zoom out">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs font-medium tabular-nums text-white/76">{zoomPercent}%</span>
          <button type="button" onClick={() => pixiRef.current?.viewport?.setZoom((pixiRef.current?.viewport?.scale?.x ?? 1) * 1.1, true)} className="text-white/70 transition hover:text-white" aria-label="Zoom in">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-2 flex gap-2">
          <CanvasIconButton icon={ScanSearch} label="Fit to content" shortcut="F" subtle onClick={fitToContent} />
          <CanvasIconButton icon={RotateCcw} label="Reset camera" shortcut="0" subtle onClick={resetCamera} />
        </div>
      </div>
        </div>
      </div>
      </Tooltip.Provider>

      {activeMode && activeTool !== "delete" ? (
        <div className="absolute left-1/2 top-18 z-10 -translate-x-1/2 flex items-center gap-2 rounded-full border border-white/8 bg-[rgba(15,23,31,0.84)] px-4 py-1.5 text-xs font-medium text-white/86 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
          <Crosshair className="h-3.5 w-3.5" />
          {activeMode === "connect"
            ? connectionSourceKey && connectionSourceKey !== "__armed__"
              ? `Choose destination for ${linkType} link`
              : "Choose the first node to start linking"
            : `Click canvas to place ${activeMode}`}
          <kbd className="ml-2 rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-mono text-white/42">ESC</kbd>
        </div>
      ) : null}

      {recentManualNodes.length > 0 ? (
        <div className="absolute bottom-4 right-4 z-10">
          <button
            type="button"
            onClick={() => setShowRecentNodes((value) => !value)}
            className="mb-2 ml-auto flex h-9 w-9 items-center justify-center rounded-[12px] border border-white/8 bg-[rgba(7,11,14,0.92)] text-white/72 shadow-[0_8px_20px_rgba(0,0,0,0.22)] backdrop-blur-sm transition hover:border-white/12 hover:text-white"
            aria-label="Toggle recent nodes"
            title="Recent nodes"
          >
            <LocateFixed className="h-4 w-4" />
          </button>
          {showRecentNodes ? (
        <div className="w-72 rounded-2xl border border-white/7 bg-[rgba(7,12,16,0.88)] px-4 py-3 shadow-[0_10px_22px_rgba(0,0,0,0.22)] backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/44">Recent Nodes</div>
              <div className="mt-1 text-sm font-medium text-white/86">Jump to new entities</div>
            </div>
            <button
              type="button"
              onClick={fitToContent}
              className="rounded-lg border border-white/8 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-white/78 transition hover:bg-white/[0.08] hover:text-white"
            >
              Fit All
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {recentManualNodes.map((node) => {
              const nodeColor = campaignNodeColor(node.kind);
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => {
                    onSelectEntity({ type: "campaignNode", id: node.id });
                    animateCamera({
                      centerX: node.position.x,
                      centerY: node.position.y,
                      scale: Math.max(pixiRef.current?.viewport?.scale?.x ?? 1, 1.15),
                    });
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-left transition hover:border-[rgba(103,232,249,0.22)] hover:bg-[rgba(255,255,255,0.06)]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: `#${nodeColor.toString(16).padStart(6, "0")}` }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-white">{node.name}</span>
                      <span className="block text-[10px] uppercase tracking-[0.18em] text-[rgba(148,163,184,0.74)]">
                        {node.kind}
                      </span>
                    </span>
                  </span>
                  <LocateFixed className="h-3.5 w-3.5 text-[rgba(103,232,249,0.84)]" />
                </button>
              );
            })}
          </div>
        </div>
          ) : null}
        </div>
      ) : null}


      {/* ── Empty State ── */}
      {isEmptyState ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto max-w-md rounded-2xl border border-[rgba(45,212,191,0.12)] bg-[rgba(5,16,24,0.88)] p-8 text-center backdrop-blur-xl shadow-[0_24px_64px_rgba(0,0,0,0.4)]">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/6 text-white">
              <Crosshair className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-white">
              Empty Campaign Board
            </h3>
            <p className="mt-2 text-sm leading-6 text-(--text-muted)">
              Open the Add menu to place actors, places, factions, fronts, and map geometry on the board.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <button type="button" onClick={() => setBoardTool("region")} className="flex items-center gap-1.5 rounded-lg bg-white/6 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10">
                <Hexagon className="h-3.5 w-3.5 text-white/82" /> Region
              </button>
              <button type="button" onClick={() => setBoardTool("site")} className="flex items-center gap-1.5 rounded-lg bg-white/6 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10">
                <MapPin className="h-3.5 w-3.5 text-white/82" /> Site
              </button>
              <button type="button" onClick={() => setBoardTool("token")} className="flex items-center gap-1.5 rounded-lg bg-white/6 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10">
                <CircleDot className="h-3.5 w-3.5 text-white/82" /> Token
              </button>
            </div>
            <p className="mt-4 text-[10px] text-(--text-dim)">
              Or press <kbd className="rounded bg-white/10 px-1 py-0.5 font-mono">R</kbd> <kbd className="rounded bg-white/10 px-1 py-0.5 font-mono">S</kbd> <kbd className="rounded bg-white/10 px-1 py-0.5 font-mono">T</kbd> to quick-add
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
});

function CanvasToolGroup({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`flex flex-col gap-2 ${className}`.trim()}>{children}</div>;
}

function CanvasStatusStrip({
  icon: Icon,
  label,
}: {
  icon: typeof MousePointer2;
  label: string;
}) {
  return (
    <div className="absolute left-1/2 top-4 z-10 flex w-[min(30rem,calc(100%-24rem))] -translate-x-1/2 items-center gap-3 rounded-[14px] border border-white/8 bg-[rgba(7,11,14,0.94)] px-3 py-2 shadow-[0_8px_20px_rgba(0,0,0,0.22)] backdrop-blur-sm">
      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/8 bg-white/[0.04] text-white/86">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 truncate text-sm font-medium text-white/88">{label}</div>
      <kbd className="rounded-[8px] border border-white/8 bg-white/[0.03] px-2 py-1 text-[10px] font-medium text-white/38">Esc</kbd>
    </div>
  );
}

function CanvasIconButton({
  icon: Icon,
  label,
  shortcut,
  active = false,
  destructive = false,
  subtle = false,
  onClick,
}: {
  icon: typeof MousePointer2;
  label: string;
  shortcut?: string;
  active?: boolean;
  destructive?: boolean;
  subtle?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className={`flex h-11 w-11 items-center justify-center rounded-[12px] border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(148,163,184,0.32)] ${
            destructive
              ? active
                ? "border-[rgba(248,113,113,0.28)] bg-[rgba(127,29,29,0.34)] text-white"
                : "border-white/8 bg-white/[0.02] text-white/68 hover:border-[rgba(248,113,113,0.22)] hover:bg-[rgba(127,29,29,0.18)] hover:text-white"
              : active
                ? "border-[rgba(148,163,184,0.26)] bg-[rgba(148,163,184,0.16)] text-white"
                : subtle
                  ? "border-white/7 bg-white/[0.03] text-white/64 hover:border-white/12 hover:bg-white/[0.06] hover:text-white"
                  : "border-white/8 bg-white/[0.02] text-white/72 hover:border-white/12 hover:bg-white/[0.05] hover:text-white"
          }`}
        >
          <Icon className="h-4 w-4" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={10}
          className="rounded-[10px] border border-white/10 bg-[rgba(7,11,14,0.96)] px-2.5 py-1.5 text-[11px] font-medium text-white shadow-[0_10px_24px_rgba(0,0,0,0.3)]"
        >
          {label}{shortcut ? ` (${shortcut})` : ""}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
