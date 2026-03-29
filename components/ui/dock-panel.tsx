import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DockPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("panel-shell h-full min-h-0 overflow-hidden", className)}>{children}</section>;
}

export function PanelHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("panel-header", className)}>
      <div>
        <div className="panel-title">{title}</div>
        {description ? <div className="panel-description">{description}</div> : null}
      </div>
      {action}
    </div>
  );
}
