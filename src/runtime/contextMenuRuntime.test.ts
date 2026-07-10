import { describe, expect, it, vi } from "vitest";

import type { ContextMenuItem } from "../app/commands/contextMenuModel";
import { createRuntimeContextMenu } from "./contextMenuRuntime";

const actionItem: ContextMenuItem = {
  type: "action",
  label: "Open",
  payload: {
    action: "open-archive",
  },
};

describe("runtime context menu", () => {
  it("publishes visible snapshots with stable incrementing ids", () => {
    const publishSnapshot = vi.fn();
    const contextMenu = createRuntimeContextMenu({ publishSnapshot });

    contextMenu.show(10, 20, [actionItem]);
    expect(contextMenu.getSnapshot()).toEqual({
      visible: true,
      id: 1,
      x: 10,
      y: 20,
      items: [actionItem],
    });

    contextMenu.show(30, 40, []);
    expect(contextMenu.getSnapshot()).toEqual({
      visible: true,
      id: 2,
      x: 30,
      y: 40,
      items: [],
    });
    expect(publishSnapshot).toHaveBeenCalledTimes(2);
  });

  it("hides a visible menu without advancing its id", () => {
    const publishSnapshot = vi.fn();
    const contextMenu = createRuntimeContextMenu({ publishSnapshot });

    contextMenu.show(10, 20, [actionItem]);
    expect(contextMenu.hide()).toBe(true);
    expect(contextMenu.getSnapshot()).toEqual({
      visible: false,
      id: 1,
    });

    expect(contextMenu.hide()).toBe(false);
    expect(publishSnapshot).toHaveBeenCalledTimes(2);
  });

  it("hides before dispatching an action intent", () => {
    const calls: string[] = [];
    const contextMenu = createRuntimeContextMenu({
      publishSnapshot: () => calls.push("publish"),
    });

    contextMenu.show(10, 20, [actionItem]);
    contextMenu.handleIntent({ type: "action", payload: actionItem.payload }, (payload) => {
      calls.push(`action:${payload.action}:${contextMenu.getSnapshot().visible}`);
    });

    expect(calls).toEqual([
      "publish",
      "publish",
      "action:open-archive:false",
    ]);
  });
});
