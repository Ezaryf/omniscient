import { useMemo } from "react";
import { type Node } from "@xyflow/react";
import type { Agent, CampaignNode, FrontClock, MapLayer, BoardSelection, Position } from "@/lib/sim/types";
import { type WorldNodeData } from "./canvas-nodes";

interface UseCanvasNodesProps {
  agents: Agent[];
  campaignNodes: CampaignNode[];
  map: MapLayer;
  fronts: FrontClock[];
  selectedEntity: BoardSelection | null;
  activeTool: string;
  connectionSourceKey: string | null;
  frontNodes: Array<{ front: FrontClock; position: Position }>;
  layoutPositions?: Map<string, { x: number; y: number }>;
  tieredPositions?: Record<string, { x: number; y: number }> | null;
  hasActiveSpotlight: boolean;
  connectedNodeIds: Set<string>;
  flowNodeId: (type: string, id: string) => string;
  nodeTypeForKind: (kind: string | undefined) => string;
  flowPosition: (position: Position, layoutPositions?: any, nodeId?: string) => Position;
  accentFor: (kind: string) => string;
  showFronts: boolean;
  showRegions: boolean;
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
  layoutPositions,
  tieredPositions,
  hasActiveSpotlight,
  connectedNodeIds,
  flowNodeId,
  nodeTypeForKind,
  flowPosition,
  accentFor,
  showFronts,
  showRegions,
}: UseCanvasNodesProps) {
  return useMemo<Node<WorldNodeData>[]>(() => {
    const flowNodes: Node<WorldNodeData>[] = [];
    const effectiveLayout = tieredPositions ?? layoutPositions;

    if (showRegions) {
      for (const region of map.regions) {
        const nId = flowNodeId("region", region.id);
        flowNodes.push({
          id: nId,
          type: nodeTypeForKind("region"),
          position: flowPosition(region.center, effectiveLayout, region.id),
          draggable: ["inspect", "move", "connect"].includes(activeTool),
          selected: (selectedEntity?.type === "region" && selectedEntity.id === region.id) || connectionSourceKey === nId,
          data: {
            label: region.name,
            subtitle: `Region · ${region.kind}`,
            accent: accentFor("region"),
            tone: "region",
            nodeKind: "region",
            dimmed: hasActiveSpotlight && !connectedNodeIds.has(nId),
          },
        });
      }
    }

    for (const site of map.sites) {
      const nId = flowNodeId("site", site.id);
      flowNodes.push({
        id: nId,
        type: nodeTypeForKind("site"),
        position: flowPosition(site.position, effectiveLayout, site.id),
        draggable: ["inspect", "move", "connect"].includes(activeTool),
        selected: (selectedEntity?.type === "site" && selectedEntity.id === site.id) || connectionSourceKey === nId,
        data: {
          label: site.name,
          subtitle: `Site · ${site.kind}`,
          accent: accentFor("site"),
          tone: "site",
          nodeKind: "site",
          dimmed: hasActiveSpotlight && !connectedNodeIds.has(nId),
        },
      });
    }

    for (const agent of agents) {
      const nId = flowNodeId("agent", agent.id);
      flowNodes.push({
        id: nId,
        type: nodeTypeForKind("agent"),
        position: flowPosition(agent.position, effectiveLayout ?? layoutPositions, agent.id),
        draggable: ["inspect", "move", "connect"].includes(activeTool),
        selected: (selectedEntity?.type === "agent" && selectedEntity.id === agent.id) || connectionSourceKey === nId,
        data: {
          label: agent.name,
          subtitle: "Agent",
          accent: accentFor("agent"),
          tone: "agent",
          nodeKind: "agent",
          dimmed: hasActiveSpotlight && !connectedNodeIds.has(nId),
        },
      });
    }

    for (const node of campaignNodes) {
      const nId = flowNodeId("campaignNode", node.id);
      flowNodes.push({
        id: nId,
        type: nodeTypeForKind(node.kind),
        position: flowPosition(node.position, effectiveLayout ?? layoutPositions, node.id),
        draggable: ["inspect", "move", "connect"].includes(activeTool),
        selected: (selectedEntity?.type === "campaignNode" && selectedEntity.id === node.id) || connectionSourceKey === nId,
        data: {
          label: node.name,
          subtitle: node.kind,
          accent: accentFor(node.kind),
          tone: "campaignNode",
          nodeKind: node.kind,
          dimmed: hasActiveSpotlight && !connectedNodeIds.has(nId),
          status: node.status,
        },
      });
    }

    if (showFronts) {
      for (const item of frontNodes) {
        const nId = flowNodeId("front", item.front.id);
        flowNodes.push({
          id: nId,
          type: nodeTypeForKind("front"),
          position: item.position,
          draggable: ["inspect", "move", "connect"].includes(activeTool),
          selected: (selectedEntity?.type === "front" && selectedEntity.id === item.front.id) || connectionSourceKey === nId,
          data: {
            label: item.front.name,
            subtitle: "Front",
            accent: accentFor("front"),
            tone: "front",
            nodeKind: "front",
            dimmed: hasActiveSpotlight && !connectedNodeIds.has(nId),
            status: item.front.status,
          },
        });
      }
    }

    return flowNodes;
  }, [activeTool, agents, campaignNodes, connectionSourceKey, connectedNodeIds, frontNodes, hasActiveSpotlight, map.regions, map.sites, selectedEntity, showFronts, showRegions, layoutPositions, tieredPositions, flowNodeId, nodeTypeForKind, flowPosition, accentFor]);
}
