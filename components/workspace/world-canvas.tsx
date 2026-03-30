"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as pixi from "pixi.js";
import {
  ChevronDown, Crosshair, Mouse, Eye, Minus, Plus, RotateCcw, ScanSearch,
  Grid3x3, Magnet, Hexagon, MapPin, CircleDot, Link2, Tag, Trash2, LocateFixed,
} from "lucide-react";
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
  addMode: AddMode;
  labelDensity: "minimal" | "balanced" | "dense";
  showRegionLabels: boolean;
  showRouteText: boolean;
  showTokenLabels: boolean;
  frontAlpha: number;
  showGrid: boolean;
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

const WORLD_EXTENT = 20000;
const CAMERA_PADDING = 72;
const GRID_SIZE = 80;

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

export function WorldCanvas({
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
}: WorldCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const addMenuButtonRef = useRef<HTMLButtonElement>(null);
  const pixiRef = useRef<any>(null);
  const renderFlagsRef = useRef({ full: false, dragTarget: null as DragTarget | null });
  const renderRafRef = useRef<number | null>(null);
  const animationRafRef = useRef<number | null>(null);
  const dragRef = useRef<{ target: DragTarget; startWorld: Position; moved: boolean } | null>(null);
  const sceneRef = useRef<SceneSnapshot>(cloneScene(agents, boardLinks, campaignNodes, relationships, map, fronts));
  const initializedCameraRef = useRef(false);

  const { projections, showProjections, workspaceSettings, setWorkspaceSettings } =
    useSimulationStore();

  const [zoomPercent, setZoomPercent] = useState(100);
  const [editMode, setEditMode] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [addMode, setAddMode] = useState<AddMode>("none");
  const [connectionSourceKey, setConnectionSourceKey] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<BoardLinkType>("causal");
  const [showAddMenu, setShowAddMenu] = useState(false);

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
  const canDeleteSelection = Boolean(selectedManualNode || selectedBoardLink);
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
    if (editMode) {
      return "Drag regions, sites, tokens, or agents directly on the board.";
    }
    return "Pan, inspect, and focus without moving map objects.";
  }, [addMode, connectionSourceKey, editMode]);

  const updateZoomHud = useCallback(() => {
    const viewport = pixiRef.current?.viewport;
    if (!viewport) return;
    const nextZoom = Math.round((viewport.scale?.x ?? 1) * 100);
    setZoomPercent((current) => (current === nextZoom ? current : nextZoom));
  }, []);

  const animateCamera = useCallback(
    (target: { centerX: number; centerY: number; scale: number }) => {
      const viewport = pixiRef.current?.viewport;
      if (!viewport) return;

      if (animationRafRef.current !== null) cancelAnimationFrame(animationRafRef.current);

      const startCenter = viewport.toWorld({
        x: viewport.screenWidth / 2,
        y: viewport.screenHeight / 2,
      });
      const startScale = viewport.scale.x;
      const startedAt = performance.now();
      const duration = workspaceSettings.appearance.reducedMotion ? 0 : 240;

      const step = (now: number) => {
        const progress = duration === 0 ? 1 : Math.min((now - startedAt) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        viewport.moveCenter(
          startCenter.x + (target.centerX - startCenter.x) * eased,
          startCenter.y + (target.centerY - startCenter.y) * eased
        );
        viewport.setZoom(startScale + (target.scale - startScale) * eased, true);
        updateZoomHud();
        if (progress < 1) animationRafRef.current = requestAnimationFrame(step);
        else animationRafRef.current = null;
      };

      animationRafRef.current = requestAnimationFrame(step);
    },
    [updateZoomHud, workspaceSettings.appearance.reducedMotion]
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
    const viewport = pixiRef.current?.viewport;
    if (!position || !viewport) return;
    animateCamera({
      centerX: position.x,
      centerY: position.y,
      scale: Math.max(viewport.scale.x, selectedEntity.type === "boardLink" || selectedEntity.type === "route" ? 0.95 : 1.15),
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
    setShowAddMenu(false);
    setConnectionSourceKey(encodeSelectionKey(selectedEntity as ConnectableSelection));
  }, [canStartLinkFromSelection, selectedEntity]);

  const resetCamera = useCallback(() => {
    animateCamera({ centerX: 0, centerY: 0, scale: 1 });
  }, [animateCamera]);

  function renderScene({
    refs,
    scene,
    selectedEntity,
    onSelectEntity,
    onSelectConnectionTarget,
    setDragTarget,
    editMode,
    addMode,
    labelDensity,
    showRouteLabels,
    showFrontLabels,
    showRegionMetrics,
    showMinorLabels,
    frontAlpha,
    showGrid,
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
    addMode: AddMode;
    labelDensity: "minimal" | "balanced" | "dense";
    showRouteLabels: boolean;
    showFrontLabels: boolean;
    showRegionMetrics: boolean;
    showMinorLabels: boolean;
    frontAlpha: number;
    showGrid: boolean;
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

    const majorLabelStyle = new TextStyle({
      fill: 0xf5f5f5,
      fontFamily: "Manrope, system-ui, sans-serif",
      fontSize: labelDensity === "dense" ? 17 : 15,
      fontWeight: "700",
      stroke: { color: 0x000000, width: 5, join: "round" },
    });

    const minorLabelStyle = new TextStyle({
      fill: 0xb4b7bd,
      fontFamily: "Manrope, system-ui, sans-serif",
      fontSize: 11,
      fontWeight: "600",
      stroke: { color: 0x000000, width: 4, join: "round" },
      letterSpacing: 0.4,
    });

    const tinyLabelStyle = new TextStyle({
      fill: 0x8a8f98,
      fontFamily: "JetBrains Mono, monospace",
      fontSize: 9,
      letterSpacing: 0.8,
    });

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
      editMode,
      addMode,
      labelDensity,
      showRegionLabels,
      showRouteText,
      showTokenLabels,
      frontAlpha,
      showGrid,
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
    renderRelationshipsLayer(renderLayerOptions);
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
    const { scene, refs, selectedEntity, onSelectEntity, onSelectConnectionTarget, connectionSourceKey, showRouteText, tinyLabelStyle, frontAlpha, drawNodeCard } = opts;

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
      line.on("pointertap", (event: any) => { event.stopPropagation(); onSelectEntity({ type: "route", id: route.id }); });
      refs.layers.routes.addChild(line);
      if (showRouteText) {
        const label = new Text({ text: route.name, style: tinyLabelStyle });
        label.anchor.set(0.5);
        label.alpha = 0.82;
        label.position.set((from.position.x + to.position.x) / 2, (from.position.y + to.position.y) / 2 - 14);
        refs.layers.routes.addChild(label);
      }
    }

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
      container.on("pointertap", (event: any) => { event.stopPropagation(); onSelectEntity({ type: "front", id: front.id }); });
      refs.layers.fronts.addChild(container);
    }
  }

  function renderRelationshipsLayer(opts: RenderLayerOptions) {
    const { Graphics, Text } = pixi;
    const { scene, refs, selectedEntity, onSelectEntity, zoomScale, tinyLabelStyle } = opts;

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
      line.on("pointertap", (event: any) => { event.stopPropagation(); onSelectEntity({ type: "boardLink", id: link.id }); });
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
    const { scene, refs, editMode, addMode, connectionSourceKey, setDragTarget, onSelectConnectionTarget, onSelectEntity, showRegionLabels, majorLabelStyle, updateOnlyDragTarget } = opts;

    if (updateOnlyDragTarget && updateOnlyDragTarget.kind !== "region-radius") return;
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
    const { scene, refs, editMode, addMode, connectionSourceKey, setDragTarget, onSelectConnectionTarget, onSelectEntity, selectedEntity, showTokenLabels, minorLabelStyle, showProjections, projectionAgents, drawNodeCard } = opts;

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
          dragRef.current = { target, startWorld, moved: false };
        },
        editMode,
        addMode,
        labelDensity,
        showRouteLabels,
        showFrontLabels,
        showRegionMetrics,
        showMinorLabels,
        frontAlpha,
        showGrid,
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
    editMode,
    frontAlpha,
    labelDensity,
    linkType,
    onCreateBoardLink,
    onCreateRoute,
    onSelectEntity,
    projectionAgents,
    selectedEntity,
    showFrontLabels,
    showGrid,
    showMinorLabels,
    showProjections,
    showRegionMetrics,
    showRouteLabels,
  ]);

  const liveContext = useRef({
    addMode,
    editMode,
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
    editMode,
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
        const clampZoom = Math.max(0.14, Math.min(zoom, 3.8));
        if (centerXY) {
           const cx = viewport.screenWidth / 2;
           const cy = viewport.screenHeight / 2;
           const worldX = (cx - viewport.position.x) / viewport.scale.x;
           const worldY = (cy - viewport.position.y) / viewport.scale.y;
           viewport.scale.set(clampZoom);
           viewport.position.x = cx - worldX * clampZoom;
           viewport.position.y = cy - worldY * clampZoom;
        } else {
           viewport.scale.set(clampZoom);
        }
      };
      viewport.moveCenter = (wx: number, wy: number) => {
        viewport.position.x = viewport.screenWidth / 2 - wx * viewport.scale.x;
        viewport.position.y = viewport.screenHeight / 2 - wy * viewport.scale.y;
      };
      viewport.toWorld = (pt: Position) => {
        return {
          x: (pt.x - viewport.position.x) / viewport.scale.x,
          y: (pt.y - viewport.position.y) / viewport.scale.y
        };
      };
      viewport.plugins = { resume: () => {} };

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
        // Only pan on middle-click, or if the user clicks empty space in 'view' mode (handled by click events)
        if (event.button === 1 || event.button === 2 || (liveContext.current.editMode && liveContext.current.addMode === "none")) {
           isPanning = true;
           lastPanPos = { x: event.global.x, y: event.global.y };
        }
      };

      const handlePointerMove = (event: any) => {
        if (isPanning) {
           const dx = event.global.x - lastPanPos.x;
           const dy = event.global.y - lastPanPos.y;
           viewport.position.x += dx;
           viewport.position.y += dy;
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
        void finalizeDrag();
      };
      
      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const pointer = { x: e.clientX, y: e.clientY };
        const worldPos = viewport.toWorld(pointer);
        const factor = Math.sign(e.deltaY) * -0.1;
        const newZoom = Math.max(0.14, Math.min(viewport.scale.x * (1 + factor), 3.8));
        
        viewport.scale.set(newZoom);
        viewport.position.x = pointer.x - worldPos.x * newZoom;
        viewport.position.y = pointer.y - worldPos.y * newZoom;
        liveContext.current.updateZoomHud();
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
      
      liveContext.current.requestRender();
      resetCamera();
      initializedCameraRef.current = true;
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
    if (!showAddMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        (addMenuRef.current && addMenuRef.current.contains(target)) ||
        (addMenuButtonRef.current && addMenuButtonRef.current.contains(target))
      ) {
        return;
      }
      setShowAddMenu(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showAddMenu]);

  const activeMode = addMode !== "none" ? addMode : connectionSourceKey ? "connect" : null;
  const canvasCursor = activeMode ? "crosshair" : "default";

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      switch (e.key.toLowerCase()) {
        case "r": setAddMode(m => m === "region" ? "none" : "region"); setConnectionSourceKey(null); break;
        case "s": setAddMode(m => m === "site" ? "none" : "site"); setConnectionSourceKey(null); break;
        case "t": setAddMode(m => m === "token" ? "none" : "token"); setConnectionSourceKey(null); break;
        case "c": setConnectionSourceKey(c => c ? null : "__armed__"); setAddMode("none"); break;
        case "g": setShowGrid(v => !v); break;
        case "n": setSnapToGrid(v => !v); break;
        case "f": fitToContent(); break;
        case "0": resetCamera(); break;
        case "escape": setAddMode("none"); setConnectionSourceKey(null); setShowAddMenu(false); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fitToContent, resetCamera]);

  const tbtn = (active: boolean) =>
    `flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-medium tracking-wide transition-all duration-150 ${
      active
        ? "bg-[rgba(45,212,191,0.14)] text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
        : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-[rgba(45,212,191,0.08)]"
    }`;
  const tsep = "mx-0.5 w-px self-stretch bg-[rgba(45,212,191,0.08)]";

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

      <div className="absolute left-4 top-4 z-10 max-w-88 rounded-xl border border-[rgba(45,212,191,0.15)] bg-[rgba(6,16,23,0.9)] px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.48)] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[rgba(103,232,249,0.85)]" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgba(103,232,249,0.72)]">
            Campaign Board
          </p>
        </div>
        <p className="mt-2 text-sm font-semibold tracking-[-0.02em] text-white">
          {activeMode
            ? activeMode === "connect"
              ? "Route Linking"
              : `Add ${activeMode.charAt(0).toUpperCase()}${activeMode.slice(1)}`
            : editMode
              ? "Direct Editing"
              : "Inspection Mode"}
        </p>
        <p className="mt-1 text-xs leading-5 text-white/48">{modeDescriptor}</p>
      </div>

      {/* ── Floating Toolbar ── */}
      <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 flex items-center gap-1 rounded-xl border border-[rgba(45,212,191,0.12)] bg-[rgba(5,14,21,0.9)] px-2 py-1.5 backdrop-blur-xl shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
        {/* Mode Toggle */}
        <button type="button" onClick={() => setEditMode(v => !v)} className={tbtn(editMode)} title={editMode ? "Edit mode (drag nodes)" : "View mode"}>
          {editMode ? <Mouse className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{editMode ? "Edit Board" : "Inspect"}</span>
        </button>

        <div className={tsep} />

        {/* Display Controls */}
        <button type="button" onClick={() => {
          const next = workspaceSettings.map.labelDensity === "minimal" ? "balanced" : workspaceSettings.map.labelDensity === "balanced" ? "dense" : "minimal";
          setWorkspaceSettings({ map: { ...workspaceSettings.map, labelDensity: next } });
        }} className={tbtn(labelDensity !== "minimal")} title="Label density">
          <Tag className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => setShowGrid(v => !v)} className={tbtn(showGrid)} title="Toggle grid (G)">
          <Grid3x3 className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => setSnapToGrid(v => !v)} className={tbtn(snapToGrid)} title="Snap to grid (N)">
          <Magnet className="h-3.5 w-3.5" />
        </button>

        <div className={tsep} />

        <div className="relative">
          <button
            type="button"
            ref={addMenuButtonRef}
            onClick={() => setShowAddMenu((value) => !value)}
            className={tbtn(addMode !== "none")}
            title="Add nodes to the campaign board"
          >
            <CircleDot className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add</span>
            <ChevronDown className="h-3 w-3 opacity-70" />
          </button>
          {showAddMenu ? (
            <div ref={addMenuRef} className="absolute left-0 top-[calc(100%+10px)] z-20 w-[18rem] rounded-xl border border-white/8 bg-black/94 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
              <div className="grid gap-3">
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Actors & Forces</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["agent", "Actor"],
                      ["faction", "Faction"],
                      ["front", "Front"],
                    ].map(([kind, label]) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => {
                          setAddMode(kind as AddMode);
                          setConnectionSourceKey(null);
                          setShowAddMenu(false);
                        }}
                        className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition ${
                          addMode === kind
                            ? "border-white/16 bg-white/8 text-white"
                            : "border-white/6 bg-white/3 text-white/76 hover:bg-white/6"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Geography</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ["place", "Place"],
                      ["region", "Region"],
                      ["site", "Site"],
                    ].map(([kind, label]) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => {
                          setAddMode(kind as AddMode);
                          setConnectionSourceKey(null);
                          setShowAddMenu(false);
                        }}
                        className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition ${
                          addMode === kind
                            ? "border-white/16 bg-white/8 text-white"
                            : "border-white/6 bg-white/3 text-white/76 hover:bg-white/6"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Play State</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["token", "Token"],
                      ["event", "Event"],
                    ].map(([kind, label]) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => {
                          setAddMode(kind as AddMode);
                          setConnectionSourceKey(null);
                          setShowAddMenu(false);
                        }}
                        className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition ${
                          addMode === kind
                            ? "border-white/16 bg-white/8 text-white"
                            : "border-white/6 bg-white/3 text-white/76 hover:bg-white/6"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <button type="button" onClick={() => { setConnectionSourceKey(c => c ? null : "__armed__"); setAddMode("none"); setShowAddMenu(false); }} className={tbtn(!!connectionSourceKey)} title="Link nodes on the board (C)">
          <Link2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Link Nodes</span>
        </button>
        <button
          type="button"
          onClick={() =>
            setLinkType((current) =>
              current === "causal"
                ? "alliance"
                : current === "alliance"
                  ? "conflict"
                  : current === "conflict"
                    ? "dependency"
                    : current === "dependency"
                      ? "route"
                      : "causal"
            )
          }
          className={tbtn(connectionSourceKey !== null)}
          title="Cycle link type"
        >
          <span className="hidden sm:inline">Type</span>
          <span className="font-mono text-[10px] uppercase text-white/70">{linkType}</span>
        </button>

        <div className={tsep} />

        {/* Camera Controls */}
        <button type="button" onClick={fitToContent} className={tbtn(false)} title="Fit to content (F)">
          <ScanSearch className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={resetCamera} className={tbtn(false)} title="Reset camera (0)">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {activeMode ? (
        <div className="absolute left-1/2 top-16 z-10 -translate-x-1/2 flex items-center gap-2 rounded-full border border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.1)] px-4 py-1.5 text-xs font-medium text-[rgba(255,236,179,0.92)] backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <Crosshair className="h-3.5 w-3.5" />
          {activeMode === "connect"
            ? connectionSourceKey && connectionSourceKey !== "__armed__"
              ? `Choose destination for ${linkType} link`
              : "Choose the first node to start linking"
            : `Click canvas to place ${activeMode}`}
          <kbd className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-white/50">ESC</kbd>
        </div>
      ) : null}

      {selectedEntity ? (
        <div className="absolute bottom-4 left-4 z-10 max-w-sm rounded-2xl border border-[rgba(45,212,191,0.18)] bg-[rgba(5,16,24,0.9)] px-4 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[rgba(103,232,249,0.7)]">
                Selected
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                {selectedBoardLabel ?? `${selectedEntity.type} ${selectedEntity.id}`}
              </div>
            </div>
            <span className="rounded-full border border-[rgba(45,212,191,0.18)] bg-[rgba(45,212,191,0.08)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(153,246,228,0.86)]">
              {selectedEntity.type}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={focusSelection}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/78 transition hover:bg-white/10 hover:text-white"
            >
              <LocateFixed className="h-3.5 w-3.5 text-[rgba(103,232,249,0.9)]" />
              Focus
            </button>
            {canStartLinkFromSelection ? (
              <button
                type="button"
                onClick={beginLinkFromSelection}
                className="flex items-center gap-1.5 rounded-lg border border-[rgba(45,212,191,0.18)] bg-[rgba(45,212,191,0.1)] px-3 py-2 text-xs font-medium text-[rgba(153,246,228,0.92)] transition hover:bg-[rgba(45,212,191,0.16)]"
              >
                <Link2 className="h-3.5 w-3.5" />
                Link From Here
              </button>
            ) : null}
            {canDeleteSelection ? (
              <button
                type="button"
                onClick={() => onRequestDeleteSelection(selectedEntity)}
                className="flex items-center gap-1.5 rounded-lg border border-[rgba(251,113,133,0.22)] bg-[rgba(251,113,133,0.1)] px-3 py-2 text-xs font-medium text-[rgba(255,190,198,0.95)] transition hover:bg-[rgba(251,113,133,0.16)]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {recentManualNodes.length > 0 ? (
        <div className="absolute bottom-4 right-4 z-10 w-72 rounded-2xl border border-[rgba(45,212,191,0.14)] bg-[rgba(4,14,21,0.9)] px-4 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[rgba(103,232,249,0.68)]">
                Recent Nodes
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                Jump straight to newly placed entities
              </div>
            </div>
            <button
              type="button"
              onClick={fitToContent}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
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

      <div className="absolute right-4 top-4 z-10 rounded-xl border border-[rgba(45,212,191,0.12)] bg-[rgba(5,14,21,0.88)] px-3 py-2 shadow-[0_18px_60px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgba(103,232,249,0.58)]">
          Camera
        </p>
        <div className="mt-2 flex items-center gap-1 rounded-lg border border-white/6 bg-white/3 px-1.5 py-1">
          <button type="button" onClick={() => {
            const vp = pixiRef.current?.viewport;
            if (vp) { vp.setZoom(Math.max(vp.scale.x * 0.8, 0.14), true); updateZoomHud(); }
          }} className="flex h-6 w-6 items-center justify-center rounded text-(--text-muted) transition hover:text-white hover:bg-white/10" title="Zoom out">
            <Minus className="h-3 w-3" />
          </button>
          <div className="min-w-12 text-center text-[11px] font-mono text-(--text-secondary) tabular-nums">
            {zoomPercent}%
          </div>
          <button type="button" onClick={() => {
            const vp = pixiRef.current?.viewport;
            if (vp) { vp.setZoom(Math.min(vp.scale.x * 1.25, 3.8), true); updateZoomHud(); }
          }} className="flex h-6 w-6 items-center justify-center rounded text-(--text-muted) transition hover:text-white hover:bg-white/10" title="Zoom in">
            <Plus className="h-3 w-3" />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-1">
          <button type="button" onClick={fitToContent} className="rounded-md border border-[rgba(45,212,191,0.12)] bg-[rgba(45,212,191,0.08)] px-2 py-1 text-[10px] font-medium text-[rgba(153,246,228,0.9)] transition hover:bg-[rgba(45,212,191,0.14)]">
            Fit
          </button>
          <button type="button" onClick={resetCamera} className="rounded-md border border-[rgba(45,212,191,0.12)] bg-[rgba(45,212,191,0.08)] px-2 py-1 text-[10px] font-medium text-[rgba(153,246,228,0.9)] transition hover:bg-[rgba(45,212,191,0.14)]">
            Reset
          </button>
        </div>
      </div>

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
              <button type="button" onClick={() => setAddMode("region")} className="flex items-center gap-1.5 rounded-lg bg-white/6 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10">
                <Hexagon className="h-3.5 w-3.5 text-white/82" /> Region
              </button>
              <button type="button" onClick={() => setAddMode("site")} className="flex items-center gap-1.5 rounded-lg bg-white/6 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10">
                <MapPin className="h-3.5 w-3.5 text-white/82" /> Site
              </button>
              <button type="button" onClick={() => setAddMode("token")} className="flex items-center gap-1.5 rounded-lg bg-white/6 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10">
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
}
