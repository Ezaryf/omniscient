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
  connectedNodeIds: Set<string>;
  flowNodeId: (type: string, id: string) => string;
  selectionToFlowId: (selection: BoardSelection | null) => string | null;
  EDGE_TONE: Record<string, { stroke: string; glow: string }>;
  aliasNodeIds?: Map<string, string>;
  primaryNodeIds?: Set<string>;
}

function collapseFlowId(flowId: string, aliasNodeIds?: Map<string, string>) {
  return aliasNodeIds?.get(flowId) ?? flowId;
}

function buildEdgeId(prefix: string, source: string, target: string, suffix?: string) {
  return `${prefix}:${[source, target].sort().join("->")}${suffix ? `:${suffix}` : ""}`;
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
  aliasNodeIds,
  primaryNodeIds,
}: UseCanvasEdgesProps) {
  return useMemo<Edge[]>(() => {
    const flowEdges: Edge[] = [];
    const selectedFlowId = selectionToFlowId(selectedEntity);
    const seenEdges = new Set<string>();

    function isEdgeConnected(sourceFlowId: string, targetFlowId: string): boolean {
      if (!hasActiveSpotlight) return true;
      return connectedNodeIds.has(sourceFlowId) || connectedNodeIds.has(targetFlowId);
    }

    function edgePriority(sourceFlowId: string, targetFlowId: string) {
      return primaryNodeIds?.has(sourceFlowId) || primaryNodeIds?.has(targetFlowId) ? "primary" : "secondary";
    }

    function shouldSkip(sourceFlowId: string, targetFlowId: string) {
      return sourceFlowId === targetFlowId;
    }

    if (showRelationships) {
      for (const relationship of relationships) {
        const sourceId = collapseFlowId(flowNodeId("agent", relationship.sourceAgentId), aliasNodeIds);
        const targetId = collapseFlowId(flowNodeId("agent", relationship.targetAgentId), aliasNodeIds);
        if (shouldSkip(sourceId, targetId)) continue;
        const dedupeId = buildEdgeId("relationship", sourceId, targetId);
        if (seenEdges.has(dedupeId)) continue;
        seenEdges.add(dedupeId);
        const isConnected = selectedFlowId === sourceId || selectedFlowId === targetId;
        flowEdges.push({
          id: dedupeId,
          source: sourceId,
          target: targetId,
          type: "smoothstep",
          style: {
            stroke: relationship.trust > 0 ? "#2dd4bf" : "#f97316",
            strokeDasharray: "4 6",
            strokeWidth: 1.25,
            strokeOpacity: isConnected ? 0.42 : hasActiveSpotlight ? 0.04 : 0.09,
          },
          selectable: false,
          interactionWidth: 12,
          zIndex: 1,
        });
      }
    }

    for (const route of map.routes) {
      const tone = EDGE_TONE.route;
      const sourceId = collapseFlowId(flowNodeId("site", route.fromSiteId), aliasNodeIds);
      const targetId = collapseFlowId(flowNodeId("site", route.toSiteId), aliasNodeIds);
      if (shouldSkip(sourceId, targetId)) continue;
      const dedupeId = `route:${route.id}`;
      const isSelected = selectedEntity?.type === "route" && selectedEntity.id === route.id;
      const connected = isEdgeConnected(sourceId, targetId);
      const priority = edgePriority(sourceId, targetId);
      flowEdges.push({
        id: dedupeId,
        source: sourceId,
        target: targetId,
        label: isSelected ? route.name : undefined,
        type: "smoothstep",
        markerEnd: isSelected ? { type: MarkerType.ArrowClosed, color: tone.stroke } : undefined,
        style: {
          stroke: tone.stroke,
          strokeOpacity: isSelected ? 0.92 : priority === "primary" ? (connected ? 0.38 : 0.12) : connected ? 0.22 : 0.05,
          strokeWidth: isSelected ? 3.5 : priority === "primary" ? 2.6 : 1.6,
        },
        selected: isSelected,
        interactionWidth: 24,
        zIndex: priority === "primary" ? 3 : 2,
      });
    }

    const LINK_STROKE_WIDTH: Record<string, number> = {
      conflict: 4.6,
      alliance: 3.1,
      causal: 2.4,
      dependency: 1.6,
    };

    for (const link of boardLinks) {
      const tone = EDGE_TONE[link.type] ?? EDGE_TONE.causal;
      const sourceId = collapseFlowId(flowNodeId(link.source.type, link.source.id), aliasNodeIds);
      const targetId = collapseFlowId(flowNodeId(link.target.type, link.target.id), aliasNodeIds);
      if (shouldSkip(sourceId, targetId)) continue;
      const dedupeId = `boardLink:${link.id}`;
      const isSelected = selectedEntity?.type === "boardLink" && selectedEntity.id === link.id;
      const connected = isEdgeConnected(sourceId, targetId);
      const priority = edgePriority(sourceId, targetId);
      const baseWidth = LINK_STROKE_WIDTH[link.type] ?? 2.5;
      const dash = link.type === "dependency" ? "7 5" : link.type === "causal" ? "10 6" : undefined;
      const dimmedOpacity = priority === "primary" ? 0.18 : 0.08;
      const selectedOpacity = link.type === "conflict" ? 0.98 : 0.9;
      const activeOpacity =
        link.type === "conflict"
          ? 0.88
          : link.type === "alliance"
            ? 0.74
            : priority === "primary"
              ? 0.58
              : 0.34;
      const opacity = isSelected ? selectedOpacity : connected ? activeOpacity : hasActiveSpotlight ? dimmedOpacity : activeOpacity * 0.55;
      const z =
        link.type === "conflict" ? 7 : link.type === "alliance" ? 6 : priority === "primary" ? 5 : 4;

      flowEdges.push({
        id: dedupeId,
        source: sourceId,
        target: targetId,
        label: isSelected ? (link.label ?? link.type) : undefined,
        type: "smoothstep",
        markerEnd:
          link.type === "conflict" || link.type === "causal"
            ? { type: MarkerType.ArrowClosed, color: tone.stroke }
            : undefined,
        style: {
          stroke: tone.stroke,
          strokeOpacity: opacity,
          strokeWidth: isSelected ? baseWidth + 1.4 : priority === "primary" ? baseWidth : Math.max(1.2, baseWidth - 0.6),
          strokeDasharray: dash,
        },
        animated: link.type === "conflict" && priority === "primary",
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
        source: collapseFlowId(flowNodeId(link.source.type, link.source.id), aliasNodeIds),
        target: collapseFlowId(flowNodeId(link.target.type, link.target.id), aliasNodeIds),
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
        zIndex: 8,
      });
    }

    return flowEdges;
  }, [
    EDGE_TONE,
    aliasNodeIds,
    boardLinks,
    connectedNodeIds,
    flowNodeId,
    hasActiveSpotlight,
    map.routes,
    optimisticLink,
    primaryNodeIds,
    relationships,
    selectedEntity,
    selectionToFlowId,
    showRelationships,
  ]);
}
