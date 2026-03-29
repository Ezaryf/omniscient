import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/12 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "border-white/14 bg-white/92 px-4 text-[var(--accent-foreground)] shadow-[0_12px_30px_rgba(255,255,255,0.06)] hover:bg-[var(--accent-primary-strong)]",
        secondary:
          "border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-panel)]",
        ghost:
          "border-transparent bg-transparent px-3 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]",
        outline:
          "border-[var(--border-strong)] bg-transparent px-4 text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]",
        danger:
          "border-[rgba(217,82,82,0.28)] bg-[rgba(217,82,82,0.12)] px-4 text-[#f3b1b1] hover:bg-[rgba(217,82,82,0.18)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-5 text-sm",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
