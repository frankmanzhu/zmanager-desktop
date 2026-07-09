import { useEffect, useRef } from "react";

import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import { translatorForSnapshot } from "./shellHelpers";

export function DropOverlay() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const { mode, copy } = snapshot.shell.dropOverlay;
  const visible = mode !== "idle";
  const showActions = Boolean(copy?.showActions);
  const supportText = copy?.supportKey ? i18n.t(copy.supportKey) : "";
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (showActions) {
      primaryActionRef.current?.focus();
    }
  }, [showActions]);

  return (
    <div
      id="drop-overlay"
      className="drop-overlay"
      aria-hidden={!visible}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          actions.handleDesktopIntent({ type: "dropChoice", choice: "cancel" });
        }
      }}
    >
      <div
        id="drop-overlay-card"
        className="drop-overlay-card"
        role={showActions ? "dialog" : "status"}
        aria-modal={showActions ? "false" : undefined}
      >
        <strong id="drop-overlay-title">{copy ? i18n.t(copy.titleKey) : i18n.t("drop.title")}</strong>
        <span id="drop-overlay-message">
          {copy ? i18n.t(copy.messageKey, copy.messageParams) : i18n.t("drop.defaultMessage")}
        </span>
        <span id="drop-overlay-support" className="drop-overlay-support" hidden={!supportText}>
          {supportText}
        </span>
        <div id="drop-overlay-actions" className="drop-overlay-actions" hidden={!showActions}>
          <button
            id="drop-open-archive"
            ref={primaryActionRef}
            type="button"
            data-drop-choice="open-archive"
            onClick={() => actions.handleDesktopIntent({ type: "dropChoice", choice: "openArchive" })}
          >
            {i18n.t("drop.action.openArchive")}
          </button>
          <button
            id="drop-add-compress"
            type="button"
            data-drop-choice="add-compress"
            onClick={() => actions.handleDesktopIntent({ type: "dropChoice", choice: "addToCompress" })}
          >
            {i18n.t("drop.action.addCompress")}
          </button>
          <button
            type="button"
            data-drop-choice="cancel"
            onClick={() => actions.handleDesktopIntent({ type: "dropChoice", choice: "cancel" })}
          >
            {i18n.t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
