import { useMemo } from "react";
import { type Edge, MarkerType } from "@xyflow/react";
import type { BoardLink, BoardLinkType, BoardSelection, MapLayer, RelationshipEdge } from "@/lib/sim/types";

interface UseCanvasEdgesProps {
  boardLinks: BoardLink[];
  map: MapLayer;
  relationships: RelationshipEdge[];
  selectedEntity: BoardSelection | null;
  optimisticLink: any;
  showRelationships: boolean;
  hasActiveSpotlight: boolean;
  connectedNodeIds: Set<Set<string> | string>;
  flowNodeId: (type: string, id: string) => string;
  selectionToFlowId: (selection: BoardSelection | null) => string | null;
  EDGE_TONE: Record<string, { stroke: string; glow: string }>;
}

export function useCanvasEdges({
  boardLinks,
  map,
  relationships,
  selectedEntity,
  optimisticLink,
  showRelationships,
  hasActiveSpotlight,
  connectedNodeIds,
  flowNodeId,
  selectionToFlowId,
  EDGE_TONE,
}: UseCanvasEdgesProps) {
  return useMemo<Edge[]>(() => {
    const flowEdges: Edge[] = [];
    const selectedFlowId = selectionToFlowId(selectedEntity);

    /** Check if an edge connects to the selected node (for spotlight) */
    function isEdgeConnected(sourceFlowId: string, targetFlowId: string): boolean {
      if (!hasActiveSpotlight) return true;
      return (connectedNodeIds as Set<string>).has(sourceFlowId) && (connectedNodeIds as Set<string>).has(targetFlowId);
    }

    if (showRelationships) {
      for (const relationship of relationships) {
        const sourceId = flowNodeId("agent", relationship.sourceAgentId);
        const targetId = flowNodeId("agent", relationship.targetAgentId);
        const isConnected = sourceId === selectedFlowId || targetId === selectedFlowId;
        flowEdges.push({
          id: `relationship:${relationship.id}`,
          source: sourceId,
          target: targetId,
          type: "smoothstep",
          style: {
            stroke: relationship.trust > 0 ? "#2dd4bf" : "#f97316",
            strokeDasharray: "4 4",
            strokeWidth: 1,
            strokeOpacity: isConnected ? 0.5 : hasActiveSpotlight ? 0.04 : 0.08,
          },
          selectable: false,
          interactionWidth: 12,
          zIndex: 1,
        });
      }
    }

    for (const route of map.routes) {
      const tone = EDGE_TONE.route;
      const sourceId = flowNodeId("site", route.fromSiteId);
      const targetId = flowNodeId("site", route.toSiteId);
      const isSelected = selectedEntity?.type === "route" && selectedEntity.id === route.id;
      const connected = isEdgeConnected(sourceId, targetId);
      flowEdges.push({
        id: `route:${route.id}`,
        source: sourceId,
        target: targetId,
        label: isSelected ? route.name : undefined,
        type: "smoothstep",
        markerEnd: isSelected ? { type: MarkerType.ArrowClosed, color: tone.stroke } : undefined,
        style: {
          stroke: tone.stroke,
          strokeOpacity: isSelected ? 0.95 : connected ? 0.35 : 0.06,
          strokeWidth: isSelected ? 3.5 : 2,
        },
        selected: isSelected,
        interactionWidth: 24,
        zIndex: 2,
      });
    }

    // Semantic stroke widths per board link type
    const LINK_STROKE_WIDTH: Record<string, number> = {
      conflict: 4,
      alliance: 3,
      causal: 2.5,
      dependency: 1.5,
    };

    for (const link of boardLinks) {
      const tone = EDGE_TONE[link.type] ?? EDGE_TONE.causal;
      const sourceId = flowNodeId(link.source.type, link.source.id);
      const targetId = flowNodeId(link.target.type, link.target.id);
      const isSelected = selectedEntity?.type === "boardLink" && selectedEntity.id === link.id;
      const connected = isEdgeConnected(sourceId, targetId);
      const baseWidth = LINK_STROKE_WIDTH[link.type] ?? 2.5;
      
      const opacity = isSelected ? 1 : connected ? 0.7 : 0.12;
      const dash = link.type === "dependency" ? "7 5" : link.type === "causal" ? "10 6" : undefined;
      const z = link.type === "conflict" ? 6 : link.type === "alliance" ? 5 : 4;

      flowEdges.push({
        id: `boardLink:${link.id}`,
        source: sourceId,
        target: targetId,
        label: isSelected ? (link.label ?? link.type) : undefined,
        type: "smoothstep",
        style: {
          stroke: tone.stroke,
          strokeOpacity: opacity,
          strokeWidth: isSelected ? baseWidth + 1.5 : baseWidth,
          strokeDasharray: dash,
        },
        selected: isSelected,
        interactionWidth: 30,
        zIndex: z,
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
        type: "smoothstep",
        style: {
          stroke: tone.stroke,
          strokeOpacity: 0.92,
          strokeWidth: 3.6,
          strokeDasharray: "8 5",
        },
        animated: true,
        interactionWidth: 24,
        zIndex: 7,
      });
    }

    return flowEdges;
  }, [boardLinks, connectedNodeIds, hasActiveSpotlight, map.routes, optimisticLink, relationships, selectedEntity, showRelationships, flowNodeId, selectionToFlowId, EDGE_TONE]);
}
