import type {
  ContextMenuActionPayload,
  ContextMenuItem,
} from "../app/commands/contextMenuModel";
import type {
  ZManagerContextMenuIntent,
  ZManagerContextMenuSnapshot,
} from "../ui/react/appRuntime";

export type RuntimeContextMenu = Readonly<{
  getSnapshot(): ZManagerContextMenuSnapshot;
  show(x: number, y: number, items: readonly ContextMenuItem[]): void;
  hide(): boolean;
  handleIntent(
    intent: ZManagerContextMenuIntent,
    handleAction: (payload: ContextMenuActionPayload) => void,
  ): void;
}>;

export type CreateRuntimeContextMenuOptions = Readonly<{
  publishSnapshot(): void;
}>;

export function createRuntimeContextMenu(
  options: CreateRuntimeContextMenuOptions,
): RuntimeContextMenu {
  let snapshot: ZManagerContextMenuSnapshot = { visible: false, id: 0 };
  let sequence = 0;

  function publishIfChanged(nextSnapshot: ZManagerContextMenuSnapshot): void {
    snapshot = nextSnapshot;
    options.publishSnapshot();
  }

  function hide(): boolean {
    if (!snapshot.visible) {
      return false;
    }

    publishIfChanged({
      visible: false,
      id: snapshot.id,
    });
    return true;
  }

  return {
    getSnapshot() {
      return snapshot;
    },
    show(x, y, items) {
      publishIfChanged({
        visible: true,
        id: sequence += 1,
        x,
        y,
        items,
      });
    },
    hide,
    handleIntent(intent, handleAction) {
      switch (intent.type) {
        case "action":
          hide();
          handleAction(intent.payload);
          break;
        case "hide":
          hide();
          break;
      }
    },
  };
}
