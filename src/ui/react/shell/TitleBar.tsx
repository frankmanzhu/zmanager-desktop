import { Minus, Square, X } from "lucide-react";

import { APP_TITLE } from "../../../app/constants";
import { useZManagerActions } from "../AppProviders";

export function TitleBar() {
  const actions = useZManagerActions();

  return (
    <header
      className="hidden h-[34px] min-h-[34px] shrink-0 select-none items-center justify-between border-b border-slate-300 bg-slate-100 text-slate-950 [body.custom-window-chrome_&]:flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
      data-shell-chrome="title"
      data-tauri-drag-region
    >
      <div
        className="flex h-full min-w-0 flex-1 items-center px-3"
        data-tauri-drag-region
      >
        <span className="min-w-0 truncate font-semibold" data-tauri-drag-region>
          {APP_TITLE}
        </span>
      </div>
      <div className="flex h-full shrink-0 items-stretch">
        <button
          id="window-minimize"
          className="flex h-full w-11 items-center justify-center border-0 bg-transparent p-0 hover:bg-slate-200 active:bg-slate-300 dark:hover:bg-slate-800 dark:active:bg-slate-700"
          type="button"
          aria-label="Minimize window"
          title="Minimize"
          onClick={() =>
            actions.handleDesktopIntent({
              type: "windowControl",
              control: "minimize",
            })
          }
        >
          <Minus className="size-[15px]" aria-hidden="true" />
        </button>
        <button
          id="window-maximize"
          className="flex h-full w-11 items-center justify-center border-0 bg-transparent p-0 hover:bg-slate-200 active:bg-slate-300 dark:hover:bg-slate-800 dark:active:bg-slate-700"
          type="button"
          aria-label="Maximize or restore window"
          title="Maximize or restore"
          onClick={() =>
            actions.handleDesktopIntent({
              type: "windowControl",
              control: "toggleMaximize",
            })
          }
        >
          <Square className="size-[15px]" aria-hidden="true" />
        </button>
        <button
          id="window-close"
          className="flex h-full w-11 items-center justify-center border-0 bg-transparent p-0 hover:bg-red-600 hover:text-white active:bg-red-700"
          type="button"
          aria-label="Close window"
          title="Close"
          onClick={() =>
            actions.handleDesktopIntent({
              type: "windowControl",
              control: "close",
            })
          }
        >
          <X className="size-[15px]" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
