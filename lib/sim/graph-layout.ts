/**
 * graph-layout.ts
 *
 * Tiered auto-layout engine for the campaign board.
 * Assigns Y-bands by entity category and X-positions by faction clustering.
 *
 * Band 0 (Top):      Factions — wide spacing, anchors
 * Band 1 (Upper):    Fronts/Events — the "battlefield center"
 * Band 2 (Middle):   Agents — clustered by faction
 * Band 3 (Lower):    Regions / Sites / Places
 * Band 4 (Bottom):   Routes / Parties
 */

import type { CampaignNode, CampaignNodeKind } from "./types";

// --- Constants ---

const BAND_Y: Record<string, number> = {
  faction: 0,
  front: 260,
  event: 320,
  agent: 580,
  place: 840,
  region: 840,
  site: 1020,
  route: 1180,
  party: 1180,
};

const NODE_H_SPACING = 280;  // Min horizontal gap between nodes in same band
const NODE_V_JITTER = 28;    // Slight vertical randomness within a band
const FACTION_CLUSTER_GAP = 120; // Extra X gap between faction clusters

// --- Types ---

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
}

// --- Helpers ---

function bandForKind(kind: CampaignNodeKind): number {
  return BAND_Y[kind] ?? 840;
}

/** Deterministic jitter from node id (avoids Math.random) */
function jitterFromId(id: string, magnitude: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return ((hash % (magnitude * 2)) - magnitude);
}

// --- Main ---

/**
 * Compute a tiered layout for all campaign nodes.
 *
 * Strategy:
 * 1. Group nodes by band (Y)
 * 2. Within each band, sort by factionId to cluster allies together
 * 3. Assign X positions with faction-gap spacing
 * 4. Apply subtle Y jitter to break grid rigidity
 * 5. Respect any existing manual positions (nodes with "manual" tag keep their pos)
 */
export function computeTieredLayout(
  nodes: CampaignNode[],
  existingPositions?: Map<string, { x: number; y: number }>
): LayoutResult {
  const positions = new Map<string, { x: number; y: number }>();

  // Separate manual nodes — they keep their position
  const manualNodes = nodes.filter((n) => n.tags.includes("manual"));
  const autoNodes = nodes.filter((n) => !n.tags.includes("manual"));

  for (const node of manualNodes) {
    const existing = existingPositions?.get(node.id);
    positions.set(node.id, existing ?? { x: node.position.x, y: node.position.y });
  }

  // Group auto nodes by band
  const bands = new Map<number, CampaignNode[]>();
  for (const node of autoNodes) {
    const bandY = bandForKind(node.kind);
    const list = bands.get(bandY) ?? [];
    list.push(node);
    bands.set(bandY, list);
  }

  // For each band, sort by factionId + name, then assign X positions
  for (const [bandY, bandNodes] of bands) {
    // Sort: group by faction, then alphabetically within faction
    bandNodes.sort((a, b) => {
      const factionCmp = (a.factionId ?? "zzz").localeCompare(b.factionId ?? "zzz");
      if (factionCmp !== 0) return factionCmp;
      return a.name.localeCompare(b.name);
    });

    // Compute total width needed and center the band
    let currentX = 0;
    let prevFaction: string | null = null;

    for (const node of bandNodes) {
      // If the user already dragged this node, keep their position
      const existing = existingPositions?.get(node.id);
      if (existing) {
        positions.set(node.id, existing);
        currentX = existing.x + NODE_H_SPACING;
        prevFaction = node.factionId;
        continue;
      }

      // Add extra gap when faction changes within the same band
      if (prevFaction !== null && node.factionId !== prevFaction) {
        currentX += FACTION_CLUSTER_GAP;
      }

      const yJitter = jitterFromId(node.id, NODE_V_JITTER);
      positions.set(node.id, {
        x: currentX,
        y: bandY + yJitter,
      });

      currentX += NODE_H_SPACING;
      prevFaction = node.factionId;
    }

    // Center the entire band horizontally around x=0
    const bandPositions = bandNodes
      .map((n) => positions.get(n.id))
      .filter((p): p is { x: number; y: number } => p !== undefined);

    if (bandPositions.length > 0) {
      const minX = Math.min(...bandPositions.map((p) => p.x));
      const maxX = Math.max(...bandPositions.map((p) => p.x));
      const centerOffset = (maxX + minX) / 2;

      for (const node of bandNodes) {
        const pos = positions.get(node.id);
        if (pos && !existingPositions?.has(node.id)) {
          positions.set(node.id, {
            x: pos.x - centerOffset,
            y: pos.y,
          });
        }
      }
    }
  }

  return { positions };
}

/**
 * Determine if the nodes are already well-spread or need auto-layout.
 * Returns true if nodes overlap heavily.
 */
export function needsAutoLayout(nodes: CampaignNode[]): boolean {
  if (nodes.length <= 2) return false;

  let overlapCount = 0;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = Math.abs(nodes[i].position.x - nodes[j].position.x);
      const dy = Math.abs(nodes[i].position.y - nodes[j].position.y);
      // If two nodes are within 80px of each other, they're overlapping
      if (dx < 80 && dy < 60) {
        overlapCount++;
      }
    }
  }

  // If more than 25% of node pairs overlap, auto-layout is needed
  const totalPairs = (nodes.length * (nodes.length - 1)) / 2;
  return overlapCount / totalPairs > 0.15;
}
