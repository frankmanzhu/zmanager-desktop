import type { ReactNode } from "react";

import { cn } from "../../../lib/utils";

export function ErrorDetailsPanel({
  children,
  className = "",
}: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <div
      data-dialog-nested-scroll="details"
      className={cn(
        "max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-red-500/20 bg-red-950/[0.04] p-3 text-xs leading-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
