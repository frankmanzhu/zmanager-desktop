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
      className={`absolute inset-0 z-[80] place-items-center bg-slate-950/35 p-6 ${visible ? "grid pointer-events-auto" : "hidden pointer-events-none"}`}
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
        className="grid max-w-lg gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role={showActions ? "dialog" : "status"}
        aria-modal={showActions ? "false" : undefined}
      >
        <strong id="drop-overlay-title">
          {copy ? i18n.t(copy.titleKey) : i18n.t("drop.title")}
        </strong>
        <span id="drop-overlay-message">
          {copy
            ? i18n.t(copy.messageKey, copy.messageParams)
            : i18n.t("drop.defaultMessage")}
        </span>
        <span
          id="drop-overlay-support"
          className="text-xs text-slate-500 dark:text-slate-400"
          hidden={!supportText}
        >
          {supportText}
        </span>
        <div
          id="drop-overlay-actions"
          className="flex flex-wrap justify-center gap-2"
          hidden={!showActions}
        >
          <button
            id="drop-open-archive"
            className="min-h-9 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            ref={primaryActionRef}
            type="button"
            data-drop-choice="open-archive"
            onClick={() =>
              actions.handleDesktopIntent({
                type: "dropChoice",
                choice: "openArchive",
              })
            }
          >
            {i18n.t("drop.action.openArchive")}
          </button>
          <button
            id="drop-add-compress"
            className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            type="button"
            data-drop-choice="add-compress"
            onClick={() =>
              actions.handleDesktopIntent({
                type: "dropChoice",
                choice: "addToCompress",
              })
            }
          >
            {i18n.t("drop.action.addCompress")}
          </button>
          <button
            className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            type="button"
            data-drop-choice="cancel"
            onClick={() =>
              actions.handleDesktopIntent({
                type: "dropChoice",
                choice: "cancel",
              })
            }
          >
            {i18n.t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
