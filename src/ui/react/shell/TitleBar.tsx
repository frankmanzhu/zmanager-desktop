import { Minus, Square, X } from "lucide-react";

import { APP_TITLE } from "../../../app/constants";
import { useZManagerActions } from "../AppProviders";

export function TitleBar() {
  const actions = useZManagerActions();

  return (
    <header className="window-titlebar" data-tauri-drag-region>
      <div className="window-titlebar-brand" data-tauri-drag-region>
        <span className="window-titlebar-title" data-tauri-drag-region>
          {APP_TITLE}
        </span>
      </div>
      <div className="window-titlebar-controls">
        <button
          id="window-minimize"
          className="window-control"
          type="button"
          aria-label="Minimize window"
          title="Minimize"
          onClick={() => actions.handleDesktopIntent({ type: "windowControl", control: "minimize" })}
        >
          <Minus className="window-control-icon" aria-hidden="true" />
        </button>
        <button
          id="window-maximize"
          className="window-control"
          type="button"
          aria-label="Maximize or restore window"
          title="Maximize or restore"
          onClick={() => actions.handleDesktopIntent({ type: "windowControl", control: "toggleMaximize" })}
        >
          <Square className="window-control-icon" aria-hidden="true" />
        </button>
        <button
          id="window-close"
          className="window-control window-control-close"
          type="button"
          aria-label="Close window"
          title="Close"
          onClick={() => actions.handleDesktopIntent({ type: "windowControl", control: "close" })}
        >
          <X className="window-control-icon" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
