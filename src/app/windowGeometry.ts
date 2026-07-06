import {
  APP_MIN_WINDOW_HEIGHT_PX,
  APP_MIN_WINDOW_WIDTH_PX,
} from "./constants";

export type WindowGeometry = {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  unit?: "logical";
};

export type WindowMonitorGeometry = {
  position: { x: number; y: number };
  size: { width: number; height: number };
  workArea?: {
    position: { x: number; y: number };
    size: { width: number; height: number };
  };
  scaleFactor?: number;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function normalizeStoredWindowGeometry(value: unknown): WindowGeometry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const rawWidth = (value as { width?: unknown }).width;
  const rawHeight = (value as { height?: unknown }).height;
  if (!isFiniteNumber(rawWidth) || !isFiniteNumber(rawHeight)) {
    return null;
  }

  const geometry: WindowGeometry = {
    width: Math.max(APP_MIN_WINDOW_WIDTH_PX, Math.floor(rawWidth)),
    height: Math.max(APP_MIN_WINDOW_HEIGHT_PX, Math.floor(rawHeight)),
  };

  const x = (value as { x?: unknown }).x;
  const y = (value as { y?: unknown }).y;
  if (isFiniteNumber(x)) {
    geometry.x = Math.floor(x);
  }
  if (isFiniteNumber(y)) {
    geometry.y = Math.floor(y);
  }

  if ((value as { unit?: unknown }).unit === "logical") {
    geometry.unit = "logical";
  }

  return geometry;
}

export function geometryInLogicalPixels(geometry: WindowGeometry, scaleFactor: number): WindowGeometry {
  if (geometry.unit === "logical" || scaleFactor <= 0) {
    return geometry;
  }

  return {
    width: geometry.width === undefined ? undefined : Math.max(APP_MIN_WINDOW_WIDTH_PX, Math.floor(geometry.width / scaleFactor)),
    height: geometry.height === undefined ? undefined : Math.max(APP_MIN_WINDOW_HEIGHT_PX, Math.floor(geometry.height / scaleFactor)),
    x: geometry.x === undefined ? undefined : Math.floor(geometry.x / scaleFactor),
    y: geometry.y === undefined ? undefined : Math.floor(geometry.y / scaleFactor),
    unit: "logical",
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (maximum < minimum) {
    return minimum;
  }
  return Math.min(Math.max(value, minimum), maximum);
}

function containsPoint(rect: Rect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    y >= rect.y &&
    x <= rect.x + rect.width &&
    y <= rect.y + rect.height
  );
}

function monitorWorkAreaInLogicalPixels(monitor: WindowMonitorGeometry, scaleFactor: number): Rect | null {
  const divisor = scaleFactor > 0 ? scaleFactor : monitor.scaleFactor ?? 1;
  if (divisor <= 0) {
    return null;
  }

  const workArea = monitor.workArea ?? {
    position: monitor.position,
    size: monitor.size,
  };

  return {
    x: Math.floor(workArea.position.x / divisor),
    y: Math.floor(workArea.position.y / divisor),
    width: Math.floor(workArea.size.width / divisor),
    height: Math.floor(workArea.size.height / divisor),
  };
}

export function restorableWindowGeometry(
  geometry: WindowGeometry,
  monitors: WindowMonitorGeometry[],
  scaleFactor: number,
): WindowGeometry | null {
  const logicalGeometry = geometryInLogicalPixels(geometry, scaleFactor);
  if (
    !isFiniteNumber(logicalGeometry.width) ||
    !isFiniteNumber(logicalGeometry.height) ||
    !isFiniteNumber(logicalGeometry.x) ||
    !isFiniteNumber(logicalGeometry.y)
  ) {
    return null;
  }

  const centerX = logicalGeometry.x + logicalGeometry.width / 2;
  const centerY = logicalGeometry.y + logicalGeometry.height / 2;
  const monitor = monitors
    .map((candidate) => monitorWorkAreaInLogicalPixels(candidate, scaleFactor))
    .find((rect): rect is Rect => {
      if (!rect) {
        return false;
      }
      return containsPoint(rect, centerX, centerY);
    });

  if (!monitor) {
    return null;
  }

  const width = Math.min(logicalGeometry.width, monitor.width);
  const height = Math.min(logicalGeometry.height, monitor.height);

  return {
    width,
    height,
    x: clamp(logicalGeometry.x, monitor.x, monitor.x + monitor.width - width),
    y: clamp(logicalGeometry.y, monitor.y, monitor.y + monitor.height - height),
    unit: "logical",
  };
}
