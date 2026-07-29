import { Info } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "./popover";

function preventLabelActivation(e: React.MouseEvent) {
  e.preventDefault();
}

export function InfoTip({
  content,
  ariaLabel = "More information",
}: Readonly<{ content: React.ReactNode; ariaLabel?: string }>) {
  if (!content) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:text-slate-500 dark:hover:text-slate-300"
          aria-label={ariaLabel}
          onMouseDown={preventLabelActivation}
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="z-[110] max-w-72 text-xs leading-relaxed"
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}
