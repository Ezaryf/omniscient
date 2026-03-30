import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
  {
    variants: {
      variant: {
        default: "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]",
        accent: "border-[rgba(34,211,238,0.24)] bg-[rgba(34,211,238,0.12)] text-[rgba(165,243,252,0.95)]",
        success: "border-[rgba(45,212,191,0.24)] bg-[rgba(45,212,191,0.12)] text-[#99f6e4]",
        warning: "border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.12)] text-[#fde68a]",
        danger: "border-[rgba(251,113,133,0.24)] bg-[rgba(251,113,133,0.1)] text-[#fecdd3]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
