import { memo } from "react";
import { Handle, Position as HandlePosition, type Node, type NodeProps } from "@xyflow/react";

export type WorldNodeData = {
  label: string;
  subtitle: string;
  accent: string;
  tone: "agent" | "campaignNode" | "region" | "site" | "front" | "token" | "cluster";
  nodeKind?: string;
  dimmed?: boolean;
  status?: string;
  labelVisibility?: "full" | "compact" | "hidden";
  countBadge?: string;
  emphasis?: "primary" | "secondary" | "latent";
  semanticHint?: string;
  dragging?: boolean;
  connectMode?: boolean;
  isConnectionSource?: boolean;
  groupTags?: Array<{ name: string; accent: string }>; // groups this node belongs to
  groupSelectHighlight?: boolean; // node is selected for group assignment
  description?: string; // character/entity description for simulation engine
};

export const InvisibleHandles = memo(function InvisibleHandles() {
  return (
    <>
      <Handle type="target" position={HandlePosition.Top} className="h-2! w-2! border-0! bg-transparent! opacity-0! pointer-events-none!" />
      <Handle type="target" position={HandlePosition.Left} className="h-2! w-2! border-0! bg-transparent! opacity-0! pointer-events-none!" />
      <Handle type="source" position={HandlePosition.Right} className="h-2! w-2! border-0! bg-transparent! opacity-0! pointer-events-none!" />
      <Handle type="source" position={HandlePosition.Bottom} className="h-2! w-2! border-0! bg-transparent! opacity-0! pointer-events-none!" />
    </>
  );
});

/** Small group membership tags shown at the bottom of a node */
const GroupTags = memo(function GroupTags({ tags }: { tags?: Array<{ name: string; accent: string }> }) {
  if (!tags?.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag.name}
          className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: `${tag.accent}20`, color: `${tag.accent}cc`, border: `1px solid ${tag.accent}30` }}
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
});

/** Animated ring shown when a node is selected for group assignment */
const GroupSelectRing = memo(function GroupSelectRing({ active }: { active?: boolean }) {
  if (!active) return null;
  return (
    <div
      className="pointer-events-none absolute inset-[-3px] rounded-[inherit] animate-pulse"
      style={{ boxShadow: "0 0 0 2px #2dd4bf, 0 0 12px #2dd4bf66", borderRadius: "inherit" }}
    />
  );
});

/** Large, prominent faction cards — top of the graph hierarchy */
export const FactionNode = memo(function FactionNode({ data, selected, dragging }: NodeProps<Node<WorldNodeData>>) {
  const dimStyle = data.dimmed ? { opacity: 0.32, filter: "saturate(0.25)" } : {};
  const accent = data.accent || "#38bdf8";
  const isDragging = dragging || data.dragging;
  const isConnectionSource = data.isConnectionSource;
  const inConnectMode = data.connectMode && !isConnectionSource;
  
  return (
    <>
      <InvisibleHandles />
      <div className="relative">
        <GroupSelectRing active={data.groupSelectHighlight} />
      <div
        className={`drag-handle graph-node-enter min-w-[210px] select-none rounded-[20px] border-2 px-4 py-3 transition-all duration-200 ${
          isDragging ? "scale-105 cursor-grabbing" : inConnectMode ? "cursor-pointer hover:scale-102" : "cursor-grab active:cursor-grabbing"
        } ${
          isConnectionSource ? "animate-pulse" : ""
        } ${
          selected
            ? "border-white/30 bg-[rgba(18,24,32,0.98)]"
            : "border-white/12 bg-[rgba(10,15,22,0.97)]"
        }`}
        style={{
          ...dimStyle,
          boxShadow: isConnectionSource
            ? `0 0 0 3px ${accent} inset, 0 0 48px ${accent}66, 0 28px 56px rgba(0,0,0,0.5)`
            : isDragging
            ? `0 0 0 2px ${accent} inset, 0 0 40px ${accent}44, 0 28px 56px rgba(0,0,0,0.5)`
            : selected
            ? `0 0 0 2px ${accent}88 inset, 0 0 28px ${accent}22, 0 20px 40px rgba(0,0,0,0.4)`
            : `0 0 0 1px ${accent}33 inset, 0 0 16px ${accent}11, 0 12px 28px rgba(0,0,0,0.3)`,
        }}
      >
        <div className="mb-2.5 h-2 rounded-full" style={{ backgroundColor: accent, opacity: 0.95 }} />
        <div className="truncate text-[15px] font-bold tracking-wide text-white">{data.label}</div>
        <div className="mt-1.5 truncate text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
          {data.subtitle}
        </div>
        <GroupTags tags={data.groupTags} />
      </div>
      </div>
    </>
  );
});
export const ConflictNode = memo(function ConflictNode({ data, selected, dragging }: NodeProps<Node<WorldNodeData>>) {
  const isCritical = data.status === "critical" || data.status === "rising";
  const dimStyle = data.dimmed ? { opacity: 0.32, filter: "saturate(0.25)" } : {};
  const accent = data.accent || "#f59e0b";
  const isSelected = selected;
  const isDragging = dragging || data.dragging;
  
  const shadow = isDragging
    ? `0 0 0 2px ${accent} inset, 0 0 32px ${accent}44, 0 24px 48px rgba(0,0,0,0.48)`
    : isSelected
    ? `0 0 0 1.5px ${accent} inset, 0 0 24px ${accent}33, 0 16px 32px rgba(0,0,0,0.36)`
    : isCritical
    ? `0 0 0 1px ${accent}66 inset, 0 0 20px ${accent}22, 0 10px 24px rgba(0,0,0,0.28)`
    : `0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 24px rgba(0,0,0,0.26)`;

  return (
    <>
      <InvisibleHandles />
      <div className="relative">
        <GroupSelectRing active={data.groupSelectHighlight} />
      <div
        className={`drag-handle graph-node-enter min-w-[180px] select-none rounded-2xl border px-3.5 py-2.5 transition-all duration-200 ${
          isDragging ? "scale-105 cursor-grabbing" : "cursor-grab active:cursor-grabbing"
        } ${
          isCritical ? "graph-pulse" : ""
        } ${
          isSelected
            ? "border-white/28 bg-[rgba(20,24,30,0.98)]"
            : "border-white/10 bg-[rgba(14,18,24,0.97)]"
        }`}
        style={{
          ...dimStyle,
          boxShadow: shadow,
        }}
      >
        <div className="mb-2 h-[3px] rounded-full" style={{ backgroundColor: accent }} />
        <div className="truncate text-sm font-semibold text-white">{data.label}</div>
        <div className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-white/46">
          {data.subtitle}
        </div>
        <GroupTags tags={data.groupTags} />
      </div>
      </div>
    </>
  );
});

/** Clean, standard agent cards */
export const ActorNode = memo(function ActorNode({ data, selected, dragging }: NodeProps<Node<WorldNodeData>>) {
  const dimStyle = data.dimmed ? { opacity: 0.32, filter: "saturate(0.25)" } : {};
  const accent = data.accent || "#8b5cf6";
  const isDragging = dragging || data.dragging;
  
  return (
    <>
      <InvisibleHandles />
      <div className="relative">
        <GroupSelectRing active={data.groupSelectHighlight} />
      <div
        className={`drag-handle graph-node-enter min-w-[160px] select-none rounded-[14px] border px-3 py-2 transition-all duration-200 ${
          isDragging ? "scale-105 cursor-grabbing" : "cursor-grab active:cursor-grabbing"
        } ${
          selected
            ? "border-white/24 bg-[rgba(18,22,28,0.98)]"
            : "border-white/8 bg-[rgba(12,16,21,0.96)]"
        }`}
        style={{
          ...dimStyle,
          boxShadow: isDragging
            ? `0 0 0 1.5px ${accent} inset, 0 0 28px ${accent}33, 0 20px 40px rgba(0,0,0,0.42)`
            : selected
            ? `0 0 0 1px ${accent} inset, 0 14px 28px rgba(0,0,0,0.32)`
            : `0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 20px rgba(0,0,0,0.22)`,
        }}
      >
        <div className="mb-1.5 h-1.5 rounded-full opacity-85" style={{ backgroundColor: accent }} />
        <div className="truncate text-[13px] font-semibold text-white">{data.label}</div>
        <div className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
          {data.subtitle}
        </div>
        <GroupTags tags={data.groupTags} />
      </div>
      </div>
    </>
  );
});

/** Muted infrastructure cards — sites, regions, routes */
export const InfraNode = memo(function InfraNode({ data, selected, dragging }: NodeProps<Node<WorldNodeData>>) {
  const dimStyle = data.dimmed ? { opacity: 0.25, filter: "saturate(0.2)" } : {};
  const accent = data.accent || "#64748b";
  const isSelected = selected;
  const isDragging = dragging || data.dragging;
  
  const shadow = isDragging
    ? `0 0 0 1.5px ${accent} inset, 0 0 24px ${accent}33, 0 16px 32px rgba(0,0,0,0.36)`
    : isSelected
    ? `0 0 0 1px ${accent}88 inset, 0 10px 20px rgba(0,0,0,0.28)`
    : `0 6px 16px rgba(0,0,0,0.18)`;

  return (
    <>
      <InvisibleHandles />
      <div className="relative">
        <GroupSelectRing active={data.groupSelectHighlight} />
      <div
        className={`drag-handle graph-node-enter min-w-[130px] select-none rounded-xl border px-2.5 py-1.5 transition-all duration-200 ${
          isDragging ? "scale-105 cursor-grabbing" : "cursor-grab active:cursor-grabbing"
        } ${
          isSelected
            ? "border-white/20 bg-[rgba(16,20,26,0.96)]"
            : "border-white/6 bg-[rgba(10,14,18,0.92)]"
        }`}
        style={{
          ...dimStyle,
          opacity: data.dimmed ? 0.12 : isSelected || isDragging ? 1 : 0.72,
          boxShadow: shadow,
        }}
      >
        <div className="mb-1 h-1 rounded-full opacity-60" style={{ backgroundColor: accent }} />
        <div className="truncate text-xs font-medium text-white/80">{data.label}</div>
        <div className="mt-0.5 truncate text-[9px] font-medium uppercase tracking-[0.14em] text-white/30">
          {data.subtitle}
        </div>
        <GroupTags tags={data.groupTags} />
      </div>
      </div>
    </>
  );
});

/** Fallback for unknown node types */
export const EntityNode = memo(function EntityNode({ data, selected, dragging }: NodeProps<Node<WorldNodeData>>) {
  const dimStyle = data.dimmed ? { opacity: 0.32, filter: "saturate(0.25)" } : {};
  const accent = data.accent || "#06b6d4";
  const isDragging = dragging || data.dragging;
  
  return (
    <>
      <InvisibleHandles />
      <div className="relative">
        <GroupSelectRing active={data.groupSelectHighlight} />
      <div
        className={`drag-handle graph-node-enter min-w-[150px] select-none rounded-[16px] border px-3 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition-all duration-200 ${
          isDragging ? "scale-105 cursor-grabbing" : "cursor-grab active:cursor-grabbing"
        } ${
          selected
            ? "border-white/28 bg-[rgba(20,26,33,0.98)]"
            : "border-white/10 bg-[rgba(12,16,21,0.96)]"
        }`}
        style={{
          ...dimStyle,
          boxShadow: isDragging
            ? `0 0 0 1.5px ${accent} inset, 0 0 32px ${accent}44, 0 24px 48px rgba(0,0,0,0.42)`
            : selected
            ? `0 0 0 1px ${accent} inset, 0 16px 32px rgba(0,0,0,0.32)`
            : `0 1px 0 rgba(255,255,255,0.03) inset, 0 10px 24px rgba(0,0,0,0.24)`,
        }}
      >
        <div className="mb-2 h-1.5 rounded-full opacity-90" style={{ backgroundColor: accent }} />
        <div className="truncate text-sm font-semibold text-white">{data.label}</div>
        <div className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
          {data.subtitle}
        </div>
      </div>
      </div>
    </>
  );
});

/** Cluster node for collapsed groups */
export const ClusterNode = memo(function ClusterNode({ data, selected, dragging }: NodeProps<Node<WorldNodeData>>) {
  const dimStyle = data.dimmed ? { opacity: 0.35, filter: "saturate(0.4)" } : {};
  const accent = data.accent || "#22d3ee";
  const isDragging = dragging || data.dragging;

  return (
    <>
      <InvisibleHandles />
      <div
        className={`drag-handle graph-node-enter min-w-[160px] select-none rounded-xl border transition-all duration-200 ${
          isDragging
            ? "scale-105 cursor-grabbing border-white/20 bg-[rgba(18,22,28,0.98)]"
            : "cursor-pointer border-white/10 bg-[rgba(12,16,21,0.94)] hover:border-white/20 hover:bg-[rgba(16,20,26,0.97)]"
        } ${selected ? "border-white/24 bg-[rgba(18,22,28,0.98)]" : ""}`}
        style={{
          ...dimStyle,
          boxShadow: isDragging
            ? `0 0 0 1.5px ${accent} inset, 0 0 24px ${accent}33, 0 16px 32px rgba(0,0,0,0.36)`
            : selected
            ? `0 0 0 1px ${accent}88 inset, 0 12px 24px rgba(0,0,0,0.3)`
            : `0 0 0 1px ${accent}22 inset, 0 8px 20px rgba(0,0,0,0.24)`,
        }}
        title="Click to expand (Inspect mode) · Drag to move (Move mode)"
      >
        {/* Header bar with accent + count */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-0">
          <div className="h-1 w-10 rounded-full" style={{ backgroundColor: accent, opacity: 0.7 }} />
          {data.countBadge && (
            <div
              className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: `${accent}30`, border: `1px solid ${accent}40` }}
            >
              {data.countBadge}
            </div>
          )}
        </div>
        <div className="px-3 pb-2.5 pt-1.5">
          <div className="truncate text-[13px] font-semibold text-white/90">{data.label}</div>
          <div className="mt-0.5 flex items-center gap-1">
            <span className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-white/35">{data.subtitle}</span>
            {!isDragging && (
              <span className="shrink-0 text-[9px] text-white/20">· tap to expand</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
});

export const nodeTypes = {
  entity: EntityNode,
  faction: FactionNode,
  conflict: ConflictNode,
  actor: ActorNode,
  infra: InfraNode,
  cluster: ClusterNode,
};
