import { memo } from "react";
import { Handle, Position as HandlePosition, type Node, type NodeProps } from "@xyflow/react";

export type WorldNodeData = {
  label: string;
  subtitle: string;
  accent: string;
  tone: "agent" | "campaignNode" | "region" | "site" | "front";
  nodeKind?: string;
  dimmed?: boolean;
  status?: string;
};

export const InvisibleHandles = memo(function InvisibleHandles() {
  return (
    <>
      <Handle type="target" position={HandlePosition.Top} className="h-2! w-2! border-0! bg-transparent! opacity-0!" />
      <Handle type="target" position={HandlePosition.Left} className="h-2! w-2! border-0! bg-transparent! opacity-0!" />
      <Handle type="source" position={HandlePosition.Right} className="h-2! w-2! border-0! bg-transparent! opacity-0!" />
      <Handle type="source" position={HandlePosition.Bottom} className="h-2! w-2! border-0! bg-transparent! opacity-0!" />
    </>
  );
});

/** Large, prominent faction cards — top of the graph hierarchy */
export const FactionNode = memo(function FactionNode({ data, selected }: NodeProps<Node<WorldNodeData>>) {
  const dimStyle = data.dimmed ? { opacity: 0.18, filter: "saturate(0.3)" } : {};
  return (
    <>
      <InvisibleHandles />
      <div
        className={`graph-node-enter min-w-[210px] rounded-[20px] border-2 px-4 py-3 transition-all duration-200 ${
          selected
            ? "border-white/30 bg-[rgba(18,24,32,0.98)]"
            : "border-white/12 bg-[rgba(10,15,22,0.97)]"
        }`}
        style={{
          ...dimStyle,
          boxShadow: selected
            ? `0 0 0 2px ${data.accent}88 inset, 0 0 28px ${data.accent}22, 0 20px 40px rgba(0,0,0,0.4)`
            : `0 0 0 1px ${data.accent}33 inset, 0 0 16px ${data.accent}11, 0 12px 28px rgba(0,0,0,0.3)`,
        }}
      >
        <div className="mb-2.5 h-2 rounded-full" style={{ backgroundColor: data.accent, opacity: 0.95 }} />
        <div className="truncate text-[15px] font-bold tracking-wide text-white">{data.label}</div>
        <div className="mt-1.5 truncate text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
          {data.subtitle}
        </div>
      </div>
    </>
  );
});

/** Vivid front/event cards — the battlefield center */
export const ConflictNode = memo(function ConflictNode({ data, selected }: NodeProps<Node<WorldNodeData>>) {
  const isCritical = data.status === "critical" || data.status === "rising";
  const dimStyle = data.dimmed ? { opacity: 0.18, filter: "saturate(0.3)" } : {};
  const isSelected = selected;
  const shadow = isSelected
    ? `0 0 0 1.5px ${data.accent} inset, 0 0 24px ${data.accent}33, 0 16px 32px rgba(0,0,0,0.36)`
    : isCritical
    ? `0 0 0 1px ${data.accent}66 inset, 0 0 20px ${data.accent}22, 0 10px 24px rgba(0,0,0,0.28)`
    : `0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 24px rgba(0,0,0,0.26)`;

  return (
    <>
      <InvisibleHandles />
      <div
        className={`graph-node-enter min-w-[180px] rounded-2xl border px-3.5 py-2.5 transition-all duration-200 ${
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
        <div className="mb-2 h-[3px] rounded-full" style={{ backgroundColor: data.accent }} />
        <div className="truncate text-sm font-semibold text-white">{data.label}</div>
        <div className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-white/46">
          {data.subtitle}
        </div>
      </div>
    </>
  );
});

/** Clean, standard agent cards */
export const ActorNode = memo(function ActorNode({ data, selected }: NodeProps<Node<WorldNodeData>>) {
  const dimStyle = data.dimmed ? { opacity: 0.18, filter: "saturate(0.3)" } : {};
  return (
    <>
      <InvisibleHandles />
      <div
        className={`graph-node-enter min-w-[160px] rounded-[14px] border px-3 py-2 transition-all duration-200 ${
          selected
            ? "border-white/24 bg-[rgba(18,22,28,0.98)]"
            : "border-white/8 bg-[rgba(12,16,21,0.96)]"
        }`}
        style={{
          ...dimStyle,
          boxShadow: selected
            ? `0 0 0 1px ${data.accent} inset, 0 14px 28px rgba(0,0,0,0.32)`
            : `0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 20px rgba(0,0,0,0.22)`,
        }}
      >
        <div className="mb-1.5 h-1.5 rounded-full opacity-85" style={{ backgroundColor: data.accent }} />
        <div className="truncate text-[13px] font-semibold text-white">{data.label}</div>
        <div className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
          {data.subtitle}
        </div>
      </div>
    </>
  );
});

/** Muted infrastructure cards — sites, regions, routes */
export const InfraNode = memo(function InfraNode({ data, selected }: NodeProps<Node<WorldNodeData>>) {
  const dimStyle = data.dimmed ? { opacity: 0.12, filter: "saturate(0.2)" } : {};
  const isSelected = selected;
  const shadow = isSelected
    ? `0 0 0 1px ${data.accent}88 inset, 0 10px 20px rgba(0,0,0,0.28)`
    : `0 6px 16px rgba(0,0,0,0.18)`;

  return (
    <>
      <InvisibleHandles />
      <div
        className={`graph-node-enter min-w-[130px] rounded-xl border px-2.5 py-1.5 transition-all duration-200 ${
          isSelected
            ? "border-white/20 bg-[rgba(16,20,26,0.96)]"
            : "border-white/6 bg-[rgba(10,14,18,0.92)]"
        }`}
        style={{
          ...dimStyle,
          opacity: data.dimmed ? 0.12 : isSelected ? 1 : 0.72,
          boxShadow: shadow,
        }}
      >
        <div className="mb-1 h-1 rounded-full opacity-60" style={{ backgroundColor: data.accent }} />
        <div className="truncate text-xs font-medium text-white/80">{data.label}</div>
        <div className="mt-0.5 truncate text-[9px] font-medium uppercase tracking-[0.14em] text-white/30">
          {data.subtitle}
        </div>
      </div>
    </>
  );
});

/** Fallback for unknown node types */
export const EntityNode = memo(function EntityNode({ data, selected }: NodeProps<Node<WorldNodeData>>) {
  const dimStyle = data.dimmed ? { opacity: 0.18, filter: "saturate(0.3)" } : {};
  return (
    <>
      <InvisibleHandles />
      <div
        className={`graph-node-enter min-w-[150px] rounded-[16px] border px-3 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition-all duration-200 ${
          selected
            ? "border-white/28 bg-[rgba(20,26,33,0.98)]"
            : "border-white/10 bg-[rgba(12,16,21,0.96)]"
        }`}
        style={{
          ...dimStyle,
          boxShadow: selected
            ? `0 0 0 1px ${data.accent} inset, 0 16px 32px rgba(0,0,0,0.32)`
            : `0 1px 0 rgba(255,255,255,0.03) inset, 0 10px 24px rgba(0,0,0,0.24)`,
        }}
      >
        <div className="mb-2 h-1.5 rounded-full opacity-90" style={{ backgroundColor: data.accent }} />
        <div className="truncate text-sm font-semibold text-white">{data.label}</div>
        <div className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
          {data.subtitle}
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
};
