import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-white/18 focus:ring-2 focus:ring-white/8",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
