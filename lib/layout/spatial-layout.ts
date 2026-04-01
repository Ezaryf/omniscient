import type { LayoutNode, LayoutEdge, LayoutConfig, LayoutResult, Zone } from "./types";
import { DEFAULT_LAYOUT_CONFIG, getZoneForNodeType, getPriorityForNodeType } from "./types";

export function createLayoutNodes(
  nodes: Array<{ id: string; type: string; x?: number; y?: number }>
): LayoutNode[] {
  return nodes.map((node) => {
    const zone = getZoneForNodeType(node.type);
    const priority = getPriorityForNodeType(node.type);
    
    return {
      id: node.id,
      type: node.type as LayoutNode["type"],
      zone,
      priority,
      position: node.x !== undefined && node.y !== undefined 
        ? { x: node.x, y: node.y } 
        : undefined,
      manualPosition: node.x !== undefined && node.y !== undefined 
        ? { x: node.x, y: node.y } 
        : undefined,
    };
  });
}

export function createLayoutEdges(
  edges: Array<{ id: string; source: string; target: string; type?: string }>
): LayoutEdge[] {
  const edgeStrengthMap: Record<string, number> = {
    foe: 1.0,
    conflict: 1.0,
    enemy: 1.0,
    alliance: 0.8,
    ally: 0.8,
    route: 0.5,
    causal: 0.4,
    dependency: 0.3,
  };

  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: (edge.type ?? "causal") as LayoutEdge["type"],
    strength: edgeStrengthMap[edge.type ?? "causal"] ?? 0.4,
  }));
}

export function groupByZone(nodes: LayoutNode[]): Record<Zone, LayoutNode[]> {
  const groups: Record<Zone, LayoutNode[]> = {
    faction_top: [],
    conflict_mid: [],
    support_bottom: [],
  };

  for (const node of nodes) {
    groups[node.zone].push(node);
  }

  return groups;
}

export function groupByCluster(nodes: LayoutNode[]): LayoutNode[][] {
  const clusters: Map<string, LayoutNode[]> = new Map();

  for (const node of nodes) {
    const clusterId = node.clusterId ?? node.type;
    if (!clusters.has(clusterId)) {
      clusters.set(clusterId, []);
    }
    clusters.get(clusterId)!.push(node);
  }

  return Array.from(clusters.values());
}

export function applySpatialLayout(
  nodes: LayoutNode[],
  _edges: LayoutEdge[],
  config: Partial<LayoutConfig> = {}
): LayoutResult {
  const cfg = { ...DEFAULT_LAYOUT_CONFIG, ...config };
  const zoneGroups = groupByZone(nodes);
  const updatedPositions = new Map<string, { x: number; y: number }>();

  const zoneOrder: Zone[] = ["faction_top", "conflict_mid", "support_bottom"];

  for (const zone of zoneOrder) {
    const zoneNodes = zoneGroups[zone];
    if (zoneNodes.length === 0) continue;

    const clusters = groupByCluster(zoneNodes);
    const yBase = cfg.zoneHeights[zone];
    
    let currentX = cfg.zonePadding;

    for (const cluster of clusters) {
      cluster.sort((a, b) => b.priority - a.priority);

      for (let i = 0; i < cluster.length; i++) {
        const node = cluster[i];
        const newX = currentX + i * cfg.nodeSpacing;
        const newY = yBase;

        if (!node.manualPosition) {
          node.position = { x: newX, y: newY };
          updatedPositions.set(node.id, { x: newX, y: newY });
        } else {
          node.position = { ...node.manualPosition };
          updatedPositions.set(node.id, { ...node.manualPosition });
        }
      }

      currentX += cluster.length * cfg.nodeSpacing + cfg.clusterSpacing;
    }
  }

  return { nodes, updatedPositions };
}

export function applyConflictGravity(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  config: Partial<LayoutConfig> = {}
): LayoutResult {
  const cfg = { ...DEFAULT_LAYOUT_CONFIG, ...config };
  
  if (!cfg.conflictGravity) {
    return { nodes, updatedPositions: new Map() };
  }

  const conflictEdgeTypes = ["foe", "conflict", "enemy"];
  const conflictNodeIds = new Set<string>();

  for (const edge of edges) {
    if (conflictEdgeTypes.includes(edge.type)) {
      conflictNodeIds.add(edge.source);
      conflictNodeIds.add(edge.target);
    }
  }

  const centerY = cfg.zoneHeights.conflict_mid;
  const updatedPositions = new Map<string, { x: number; y: number }>();

  for (const node of nodes) {
    if (!conflictNodeIds.has(node.id) || !node.position) continue;

    const currentY = node.position.y;
    const newY = currentY + (centerY - currentY) * cfg.gravityStrength;

    node.position.y = newY;
    updatedPositions.set(node.id, { x: node.position.x, y: newY });
  }

  return { nodes, updatedPositions };
}

export function calculateLayout(
  nodes: Array<{ id: string; type: string; x?: number; y?: number }>,
  edges: Array<{ id: string; source: string; target: string; type?: string }>,
  config: Partial<LayoutConfig> = {}
): LayoutResult {
  const layoutNodes = createLayoutNodes(nodes);
  const layoutEdges = createLayoutEdges(edges);

  const result1 = applySpatialLayout(layoutNodes, layoutEdges, config);
  
  const finalResult = applyConflictGravity(result1.nodes, layoutEdges, config);

  return finalResult;
}

export function getEdgeVisualPriority(edge: LayoutEdge): {
  width: number;
  opacity: number;
  animated: boolean;
} {
  switch (edge.type) {
    case "foe":
    case "conflict":
    case "enemy":
      return { width: 3, opacity: 1.0, animated: true };
    case "alliance":
    case "ally":
      return { width: 2, opacity: 0.8, animated: false };
    case "route":
      return { width: 1.5, opacity: 0.6, animated: false };
    case "causal":
    case "dependency":
    default:
      return { width: 1, opacity: 0.4, animated: false };
  }
}

export function sortNodesByPriority(nodes: LayoutNode[]): LayoutNode[] {
  return [...nodes].sort((a, b) => b.priority - a.priority);
}

export function getZoneCenter(zone: Zone, config: Partial<LayoutConfig> = {}): number {
  const cfg = { ...DEFAULT_LAYOUT_CONFIG, ...config };
  return cfg.zoneHeights[zone];
}