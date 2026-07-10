import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../../lib/utils";

const buttonVariants = cva(
  "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-transparent px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-zinc-950 text-white hover:bg-zinc-800",
        secondary: "border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-100",
        ghost: "text-zinc-900 hover:bg-zinc-100",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        mode: "h-full min-w-[92px] rounded-none border-transparent bg-transparent px-[14px] text-[var(--text)] shadow-none hover:bg-[var(--native-selection-bg-hover)]",
        toolbar: "min-h-[30px] min-w-0 gap-[5px] rounded-[3px] border-transparent bg-transparent px-2 py-1 text-xs text-[var(--text)] shadow-none hover:bg-[var(--native-control-bg-hover)]",
        dialog: "min-h-[30px] rounded-[3px] border border-[var(--border)] bg-[var(--native-control-bg)] px-[12px] py-[5px] text-[13px] text-[var(--text)] shadow-none hover:bg-[var(--native-control-bg-hover)]",
        dialogPrimary: "min-h-[30px] rounded-[3px] border border-[var(--accent)] bg-[var(--accent)] px-[12px] py-[5px] text-[13px] text-white shadow-none hover:bg-[var(--accent-strong)]",
      },
      size: {
        default: "h-9 px-3",
        sm: "h-8 px-2.5 text-xs",
        icon: "size-9 p-0",
        unset: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export { buttonVariants };
