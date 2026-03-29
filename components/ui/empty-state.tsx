import type { ReactNode } from "react";

export function EmptyState({
  title,
  copy,
  action,
}: {
  title: ReactNode;
  copy: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-copy">{copy}</div>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
