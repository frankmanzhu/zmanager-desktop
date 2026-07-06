import { describe, expect, it } from "vitest";
import {
  geometryInLogicalPixels,
  normalizeStoredWindowGeometry,
  restorableWindowGeometry,
  type WindowMonitorGeometry,
} from "./windowGeometry";

const primaryMonitor: WindowMonitorGeometry = {
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1080 },
  workArea: {
    position: { x: 0, y: 0 },
    size: { width: 1920, height: 1040 },
  },
  scaleFactor: 1,
};

describe("window geometry", () => {
  it("normalizes stored geometry and keeps logical units", () => {
    expect(normalizeStoredWindowGeometry({
      width: 1180.9,
      height: 760.4,
      x: 120.8,
      y: 90.9,
      unit: "logical",
    })).toEqual({
      width: 1180,
      height: 760,
      x: 120,
      y: 90,
      unit: "logical",
    });
  });

  it("converts older physical-pixel geometry to logical pixels", () => {
    expect(geometryInLogicalPixels({
      width: 2360,
      height: 1520,
      x: 200,
      y: 160,
    }, 2)).toEqual({
      width: 1180,
      height: 760,
      x: 100,
      y: 80,
      unit: "logical",
    });
  });

  it("restores saved geometry when its center is inside a current monitor", () => {
    expect(restorableWindowGeometry({
      width: 1180,
      height: 760,
      x: 260,
      y: 120,
      unit: "logical",
    }, [primaryMonitor], 1)).toEqual({
      width: 1180,
      height: 760,
      x: 260,
      y: 120,
      unit: "logical",
    });
  });

  it("rejects stale off-screen geometry so startup can fall back to centering", () => {
    expect(restorableWindowGeometry({
      width: 1180,
      height: 760,
      x: 4200,
      y: 1600,
      unit: "logical",
    }, [primaryMonitor], 1)).toBeNull();
  });

  it("clamps oversized geometry to the current monitor work area", () => {
    expect(restorableWindowGeometry({
      width: 2600,
      height: 1500,
      x: -120,
      y: -80,
      unit: "logical",
    }, [primaryMonitor], 1)).toEqual({
      width: 1920,
      height: 1040,
      x: 0,
      y: 0,
      unit: "logical",
    });
  });
});
