import { cn } from "@/lib/utils";

export function MetricBadge({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className={cn("metric-tile", className)}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}
