export type Zone = "faction_top" | "conflict_mid" | "support_bottom";

export type LayoutMode = "manual" | "assisted";

export interface LayoutNode {
  id: string;
  type: "faction" | "agent" | "site" | "route" | "event" | "front" | "campaignNode" | "token";
  zone: Zone;
  priority: number;
  clusterId?: string;
  position?: { x: number; y: number };
  manualPosition?: { x: number; y: number };
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  type: "ally" | "foe" | "conflict" | "alliance" | "causal" | "dependency" | "route" | "enemy" | "neutral";
  strength: number;
}

export interface LayoutConfig {
  zoneHeights: Record<Zone, number>;
  zonePadding: number;
  clusterSpacing: number;
  nodeSpacing: number;
  conflictGravity: boolean;
  gravityStrength: number;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  updatedPositions: Map<string, { x: number; y: number }>;
}

export const DEFAULT_LAYOUT_CONFIG: Required<LayoutConfig> = {
  zoneHeights: {
    faction_top: 80,
    conflict_mid: 350,
    support_bottom: 620,
  },
  zonePadding: 60,
  clusterSpacing: 200,
  nodeSpacing: 140,
  conflictGravity: true,
  gravityStrength: 0.15,
};

export const NODE_TYPE_ZONE_MAP: Record<string, Zone> = {
  faction: "faction_top",
  front: "conflict_mid",
  event: "conflict_mid",
  campaignNode: "conflict_mid",
  agent: "support_bottom",
  site: "support_bottom",
  route: "support_bottom",
  token: "support_bottom",
};

export const NODE_TYPE_PRIORITY_MAP: Record<string, number> = {
  faction: 10,
  front: 9,
  campaignNode: 8,
  event: 7,
  agent: 5,
  site: 4,
  route: 3,
  token: 2,
};

export function getZoneForNodeType(nodeType: string): Zone {
  return NODE_TYPE_ZONE_MAP[nodeType] ?? "support_bottom";
}

export function getPriorityForNodeType(nodeType: string): number {
  return NODE_TYPE_PRIORITY_MAP[nodeType] ?? 5;
}