import { describe, expect, it, vi } from "vitest";

import {
  WINDOW_GEOMETRY_KEY,
  createWindowController,
  type AppWindowHandle,
  type WindowControllerStorage,
} from "./windowController";
import type { WindowMonitorGeometry } from "../app/windowGeometry";

type FakeStorage = WindowControllerStorage & {
  values: Map<string, string>;
};

const primaryMonitor: WindowMonitorGeometry = {
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1080 },
  workArea: {
    position: { x: 0, y: 0 },
    size: { width: 1920, height: 1040 },
  },
  scaleFactor: 1,
};

function createStorage(initial: Record<string, unknown> = {}): FakeStorage {
  const values = new Map<string, string>(
    Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]),
  );

  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

function createFakeWindow(): AppWindowHandle & {
  calls: string[];
} {
  const calls: string[] = [];
  const record = (name: string) => {
    calls.push(name);
  };

  return {
    calls,
    close: vi.fn(async () => {
      record("close");
    }),
    minimize: vi.fn(async () => {
      record("minimize");
    }),
    toggleMaximize: vi.fn(async () => {
      record("toggleMaximize");
    }),
    show: vi.fn(async () => {
      record("show");
    }),
    unminimize: vi.fn(async () => {
      record("unminimize");
    }),
    setMinSize: vi.fn(async () => {
      record("setMinSize");
    }),
    setSize: vi.fn(async () => {
      record("setSize");
    }),
    center: vi.fn(async () => {
      record("center");
    }),
    setPosition: vi.fn(async () => {
      record("setPosition");
    }),
    scaleFactor: vi.fn(async () => 1),
    innerSize: vi.fn(async () => ({
      toLogical: () => ({ width: 1180.9, height: 760.4 }),
    })),
    innerPosition: vi.fn(async () => ({
      toLogical: () => ({ x: 120.8, y: 90.9 }),
    })),
    startResizeDragging: vi.fn(async () => {
      record("startResizeDragging");
    }),
  };
}

function createController({
  fakeWindow = createFakeWindow(),
  storage = createStorage(),
  monitors = [primaryMonitor],
  isDesktopRuntime = () => true,
  isQuickActionJobMode = () => false,
}: {
  fakeWindow?: AppWindowHandle;
  storage?: WindowControllerStorage | null;
  monitors?: WindowMonitorGeometry[];
  isDesktopRuntime?: () => boolean;
  isQuickActionJobMode?: () => boolean;
} = {}) {
  return {
    fakeWindow,
    storage,
    controller: createWindowController({
      getCurrentWindow: () => fakeWindow,
      availableMonitors: async () => monitors,
      createLogicalSize: (width, height) => ({ kind: "size", width, height }),
      createLogicalPosition: (x, y) => ({ kind: "position", x, y }),
      storage,
      isDesktopRuntime,
      isQuickActionJobMode,
    }),
  };
}

describe("desktop window controller", () => {
  it("restores saved geometry before showing the normal window", async () => {
    const fakeWindow = createFakeWindow();
    const { controller } = createController({
      fakeWindow,
      storage: createStorage({
        [WINDOW_GEOMETRY_KEY]: {
          width: 1180.9,
          height: 760.4,
          x: 120.8,
          y: 90.9,
          unit: "logical",
        },
      }),
    });

    await controller.revealNormalWindow();

    expect(fakeWindow.setSize).toHaveBeenCalledWith({ kind: "size", width: 1180, height: 760 });
    expect(fakeWindow.setPosition).toHaveBeenCalledWith({ kind: "position", x: 120, y: 90 });
    expect(fakeWindow.center).not.toHaveBeenCalled();
    expect(fakeWindow.calls).toEqual(["setSize", "setPosition", "show"]);
  });

  it("centers the normal window when saved geometry is not restorable", async () => {
    const fakeWindow = createFakeWindow();
    const { controller } = createController({
      fakeWindow,
      storage: createStorage({
        [WINDOW_GEOMETRY_KEY]: {
          width: 1180,
          height: 760,
          x: 4200,
          y: 1600,
          unit: "logical",
        },
      }),
    });

    await controller.restoreNormalWindowGeometryOrCenter();

    expect(fakeWindow.setSize).not.toHaveBeenCalled();
    expect(fakeWindow.setPosition).not.toHaveBeenCalled();
    expect(fakeWindow.center).toHaveBeenCalledTimes(1);
  });

  it("persists current geometry in logical pixels", async () => {
    const storage = createStorage();
    const { controller } = createController({ storage });

    await controller.persistCurrentWindowGeometry();

    expect(JSON.parse(storage.values.get(WINDOW_GEOMETRY_KEY) ?? "{}")).toEqual({
      width: 1180,
      height: 760,
      x: 120,
      y: 90,
      unit: "logical",
    });
  });

  it("does not persist quick-action job geometry", async () => {
    const storage = createStorage();
    const fakeWindow = createFakeWindow();
    const { controller } = createController({
      fakeWindow,
      storage,
      isQuickActionJobMode: () => true,
    });

    await controller.persistCurrentWindowGeometry();

    expect(fakeWindow.innerSize).not.toHaveBeenCalled();
    expect(storage.values.has(WINDOW_GEOMETRY_KEY)).toBe(false);
  });

  it("sizes, centers, and shows the focused progress window", async () => {
    const fakeWindow = createFakeWindow();
    const { controller } = createController({ fakeWindow });

    await controller.revealProgressWindow();

    expect(fakeWindow.setMinSize).toHaveBeenCalledWith({ kind: "size", width: 540, height: 360 });
    expect(fakeWindow.setSize).toHaveBeenCalledWith({ kind: "size", width: 620, height: 420 });
    expect(fakeWindow.calls).toEqual(["unminimize", "setMinSize", "setSize", "center", "show"]);
  });

  it("delegates Linux resize dragging to the current window", async () => {
    const fakeWindow = createFakeWindow();
    const { controller } = createController({ fakeWindow });

    await controller.beginResizeDrag("SouthEast");

    expect(fakeWindow.startResizeDragging).toHaveBeenCalledWith("SouthEast");
  });
});
