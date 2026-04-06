import { useMemo } from "react";
import { type Node } from "@xyflow/react";
import type { Agent, BoardSelection, CampaignNode, FrontClock, MapLayer, Position } from "@/lib/sim/types";
import { type WorldNodeData } from "./canvas-nodes";

export type ClusterDisplay = {
  id: string;
  label: string;
  subtitle: string;
  position: Position;
  accent: string;
  memberCount: number;
  dimmed: boolean;
  selected: boolean;
};

interface UseCanvasNodesProps {
  agents: Agent[];
  campaignNodes: CampaignNode[];
  map: MapLayer;
  fronts: FrontClock[];
  selectedEntity: BoardSelection | null;
  activeTool: string;
  connectionSourceKey: string | null;
  frontNodes: Array<{ front: FrontClock; position: Position }>;
  campaignLayoutPositions?: Map<string, { x: number; y: number }> | null;
  hasActiveSpotlight: boolean;
  connectedNodeIds: Set<string>;
  flowNodeId: (type: string, id: string) => string;
  nodeTypeForKind: (kind: string | undefined) => string;
  flowPosition: (position: Position, layoutPositions?: Map<string, { x: number; y: number }> | null, nodeId?: string) => Position;
  accentFor: (kind: string) => string;
  showFronts: boolean;
  showRegions: boolean;
  forcedVisibleNodeIds: Set<string>;
  hiddenNodeIds: Set<string>;
  structuredLayoutPositions?: Map<string, { x: number; y: number }> | null;
  primaryNodeIds: Set<string>;
  agentClusters: ClusterDisplay[];
  infraClusters: ClusterDisplay[];
  suppressedStructuredLayoutIds: Set<string>;
  /** Map from flowNodeId → list of groups the node belongs to */
  nodeGroupMembership: Map<string, Array<{ name: string; accent: string }>>;
  /** Set of node IDs currently selected for group assignment */
  groupSelectedNodeIds: Set<string>;
}

function compactLabel(label: string) {
  return label.split(" ").slice(0, 2).join(" ");
}

export function useCanvasNodes({
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
  forcedVisibleNodeIds,
  hiddenNodeIds,
  structuredLayoutPositions,
  primaryNodeIds,
  agentClusters,
  infraClusters,
  suppressedStructuredLayoutIds,
  nodeGroupMembership,
  groupSelectedNodeIds,
}: UseCanvasNodesProps) {
  return useMemo<Node<WorldNodeData>[]>(() => {
    const isDraggable = activeTool !== "delete" && activeTool !== "connect";

    const positionFor = (position: Position, nodeId?: string, campaignOnly = false) => {
      // CRITICAL FIX: Skip structuredLayoutPositions for manually dragged nodes
      // This prevents teleporting when clusters expand and recalculate layouts
      if (nodeId && suppressedStructuredLayoutIds.has(nodeId)) {
        // For suppressed nodes, use their original position (will be overridden by stable cache)
        return position;
      }
      
      if (nodeId && structuredLayoutPositions?.has(nodeId)) {
        return structuredLayoutPositions.get(nodeId)!;
      }
      return flowPosition(position, campaignOnly ? campaignLayoutPositions : undefined, nodeId);
    };

    const labelVisibilityFor = (nodeId: string): WorldNodeData["labelVisibility"] => {
      if (forcedVisibleNodeIds.has(nodeId) || primaryNodeIds.has(nodeId)) return "full";
      if (hasActiveSpotlight && !connectedNodeIds.has(nodeId)) return "hidden";
      return "compact";
    };

    const emphasisFor = (nodeId: string): WorldNodeData["emphasis"] =>
      primaryNodeIds.has(nodeId) ? "primary" : hasActiveSpotlight && !connectedNodeIds.has(nodeId) ? "latent" : "secondary";

    const clusterNodes: Node<WorldNodeData>[] = [...agentClusters, ...infraClusters].map((cluster) => ({
      id: cluster.id,
      type: "cluster",
      position: cluster.position,
      draggable: isDraggable,
      dragHandle: ".drag-handle",
      selected: cluster.selected,
      data: {
        label: cluster.label,
        subtitle: cluster.subtitle,
        accent: cluster.accent,
        tone: "cluster",
        nodeKind: "cluster",
        dimmed: cluster.dimmed,
        labelVisibility: "full",
        countBadge: `${cluster.memberCount}`,
        emphasis: "secondary",
      },
    }));

    const regionNodes: Node<WorldNodeData>[] = showRegions
      ? map.regions.flatMap((region) => {
          const nodeId = flowNodeId("region", region.id);
          if (hiddenNodeIds.has(nodeId)) return [];
          return [
            {
              id: nodeId,
              type: nodeTypeForKind("region"),
              position: positionFor(region.center, nodeId),
              draggable: isDraggable,
              selected: (selectedEntity?.type === "region" && selectedEntity.id === region.id) || connectionSourceKey === nodeId,
              data: {
                label: region.name,
                subtitle: `Region - ${region.kind}`,
                accent: accentFor("region"),
                tone: "region",
                nodeKind: "region",
                dimmed: hasActiveSpotlight && !connectedNodeIds.has(nodeId),
                labelVisibility: labelVisibilityFor(nodeId),
                emphasis: emphasisFor(nodeId),
              },
            } satisfies Node<WorldNodeData>,
          ];
        })
      : [];

    const siteNodes: Node<WorldNodeData>[] = map.sites.flatMap((site) => {
      const nodeId = flowNodeId("site", site.id);
      if (hiddenNodeIds.has(nodeId)) return [];
      // Only show sites when explicitly selected or spotlighted — they're infrastructure context
      const isSelected = selectedEntity?.type === "site" && selectedEntity.id === site.id;
      const isSpotlit = connectedNodeIds.has(nodeId);
      if (!isSelected && !isSpotlit && !forcedVisibleNodeIds.has(nodeId)) return [];
      return [
        {
          id: nodeId,
          type: nodeTypeForKind("site"),
          position: positionFor(site.position, nodeId),
          draggable: isDraggable,
          selected: isSelected || connectionSourceKey === nodeId,
          data: {
            label: site.name,
            subtitle: site.kind === "capital" ? "Capital" : site.kind === "stronghold" ? "Stronghold" : site.kind === "market" ? "Market" : site.kind,
            accent: accentFor("site"),
            tone: "site",
            nodeKind: "site",
            dimmed: hasActiveSpotlight && !isSpotlit,
            labelVisibility: "full",
            emphasis: emphasisFor(nodeId),
          },
        } satisfies Node<WorldNodeData>,
      ];
    });

    const agentNodes: Node<WorldNodeData>[] = agents.flatMap((agent) => {
      const nodeId = flowNodeId("agent", agent.id);
      if (hiddenNodeIds.has(nodeId)) return [];
      // Find the region this agent is in for a meaningful subtitle
      const agentRegion = map.regions.find((r) => {
        const dx = r.center.x - agent.position.x;
        const dy = r.center.y - agent.position.y;
        return Math.hypot(dx, dy) < (r.radius ?? 120) * 1.5;
      });
      const subtitle = agentRegion ? `${agent.type} · ${agentRegion.name}` : agent.type;
      return [
        {
          id: nodeId,
          type: nodeTypeForKind("agent"),
          position: positionFor(agent.position, nodeId),
          draggable: isDraggable,
          selected: (selectedEntity?.type === "agent" && selectedEntity.id === agent.id) || connectionSourceKey === nodeId,
          data: {
            label: agent.name,
            subtitle,
            accent: accentFor("agent"),
            tone: "agent",
            nodeKind: "agent",
            dimmed: hasActiveSpotlight && !connectedNodeIds.has(nodeId),
            labelVisibility: labelVisibilityFor(nodeId),
            emphasis: emphasisFor(nodeId),
            groupTags: nodeGroupMembership.get(nodeId),
            groupSelectHighlight: groupSelectedNodeIds.has(nodeId),
            description: agent.description,
          },
        } satisfies Node<WorldNodeData>,
      ];
    });

    const campaignNodesList: Node<WorldNodeData>[] = campaignNodes.flatMap((node) => {
      const nodeId = flowNodeId("campaignNode", node.id);
      if (hiddenNodeIds.has(nodeId)) return [];
      // Routes are edges, not movable nodes
      const isRouteDraggable = node.kind === "route" ? false : isDraggable;
      return [
        {
          id: nodeId,
          type: nodeTypeForKind(node.kind),
          position: positionFor(node.position, nodeId, true),
          draggable: isRouteDraggable,
          selected: (selectedEntity?.type === "campaignNode" && selectedEntity.id === node.id) || connectionSourceKey === nodeId,
          data: {
            label: node.name,
            subtitle: node.kind,
            accent: accentFor(node.kind),
            tone: "campaignNode",
            nodeKind: node.kind,
            dimmed: hasActiveSpotlight && !connectedNodeIds.has(nodeId),
            status: node.status,
            labelVisibility: labelVisibilityFor(nodeId),
            emphasis: emphasisFor(nodeId),
            groupTags: nodeGroupMembership.get(nodeId),
            groupSelectHighlight: groupSelectedNodeIds.has(nodeId),
            description: node.description,
          },
        } satisfies Node<WorldNodeData>,
      ];
    });

    const frontNodesList: Node<WorldNodeData>[] = showFronts
      ? frontNodes.flatMap((item) => {
          const nodeId = flowNodeId("front", item.front.id);
          if (hiddenNodeIds.has(nodeId)) return [];
          return [
            {
              id: nodeId,
              type: nodeTypeForKind("front"),
              position: positionFor(item.position, nodeId),
              draggable: isDraggable,
              selected: (selectedEntity?.type === "front" && selectedEntity.id === item.front.id) || connectionSourceKey === nodeId,
              data: {
                label: item.front.name,
                subtitle: "Front",
                accent: accentFor("front"),
                tone: "front",
                nodeKind: "front",
                dimmed: hasActiveSpotlight && !connectedNodeIds.has(nodeId),
                status: item.front.status,
                labelVisibility: "full",
                emphasis: "primary",
              },
            } satisfies Node<WorldNodeData>,
          ];
        })
      : [];

    const tokenNodes: Node<WorldNodeData>[] = map.tokens.flatMap((token) => {
      const nodeId = flowNodeId("token", token.id);
      if (hiddenNodeIds.has(nodeId)) return [];
      // Tokens are presence markers — only show when selected or spotlighted
      const isSelected = selectedEntity?.type === "token" && selectedEntity.id === token.id;
      const isSpotlit = connectedNodeIds.has(nodeId);
      if (!isSelected && !isSpotlit && !forcedVisibleNodeIds.has(nodeId)) return [];
      const kindLabel = token.kind === "faction" ? "Forces" : token.kind === "party" ? "Party" : "Threat";
      return [
        {
          id: nodeId,
          type: nodeTypeForKind(token.kind),
          position: positionFor(token.position, nodeId),
          draggable: isDraggable,
          selected: isSelected || connectionSourceKey === nodeId,
          data: {
            label: token.name,
            subtitle: kindLabel,
            accent: accentFor(token.kind),
            tone: "token",
            nodeKind: token.kind,
            dimmed: hasActiveSpotlight && !isSpotlit,
            labelVisibility: "full",
            emphasis: emphasisFor(nodeId),
          },
        } satisfies Node<WorldNodeData>,
      ];
    });

    const withCompactLabels = (nodes: Node<WorldNodeData>[]) =>
      nodes.map((node) =>
        node.data.labelVisibility === "compact"
          ? {
              ...node,
              data: {
                ...node.data,
                label: compactLabel(node.data.label),
              },
            }
          : node,
      );

    return withCompactLabels([
      ...clusterNodes,
      ...agentNodes,
      ...campaignNodesList,
      ...frontNodesList,
    ]);
  }, [
    accentFor,
    activeTool,
    agentClusters,
    agents,
    campaignLayoutPositions,
    campaignNodes,
    connectionSourceKey,
    connectedNodeIds,
    flowNodeId,
    flowPosition,
    forcedVisibleNodeIds,
    frontNodes,
    fronts,
    hasActiveSpotlight,
    hiddenNodeIds,
    infraClusters,
    map.regions,
    map.sites,
    map.tokens,
    nodeTypeForKind,
    primaryNodeIds,
    selectedEntity,
    showFronts,
    showRegions,
    structuredLayoutPositions,
  ]);
}
