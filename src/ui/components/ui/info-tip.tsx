import { Info } from "lucide-react";
import { useCallback } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export function InfoTip({
  content,
}: Readonly<{ content: React.ReactNode }>) {
  const preventLabelActivation = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
    },
    [],
  );

  if (!content) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:hover:text-slate-300"
          aria-label="More information"
          onMouseDown={preventLabelActivation}
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="max-w-72 text-xs leading-relaxed"
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}
