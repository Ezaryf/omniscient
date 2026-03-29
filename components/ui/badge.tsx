import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
  {
    variants: {
      variant: {
        default: "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]",
        accent: "border-white/12 bg-white/8 text-[var(--text-primary)]",
        success: "border-[rgba(89,176,120,0.24)] bg-[rgba(89,176,120,0.12)] text-[#99d3ae]",
        warning: "border-white/10 bg-white/6 text-[#c4c7cb]",
        danger: "border-[rgba(217,82,82,0.22)] bg-[rgba(217,82,82,0.1)] text-[#f2a5a5]",
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
