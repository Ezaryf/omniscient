import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-[112px] w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-white/18 focus:ring-2 focus:ring-white/8",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
