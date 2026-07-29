import { describe, expect, it, vi } from "vitest";

import { createDisposableTaskWindowManager, type DisposableTaskWindowHandle } from "./disposableTaskWindowManager";
import type { StartJobResponseDto } from "../api/types";

function job(jobId = "job-1"): StartJobResponseDto {
  return { jobId, kind: "zipCreate", status: "queued", createdAt: "2026-07-11T00:00:00Z" };
}

function harness() {
  const callbacks = new Map<string, Map<string, () => void>>();
  const handles = new Map<string, DisposableTaskWindowHandle>();
  const createWindow = vi.fn((label: string) => {
    const listeners = new Map<string, () => void>();
    callbacks.set(label, listeners);
    const handle: DisposableTaskWindowHandle = {
      label,
      emit: vi.fn(async () => undefined),
      once: vi.fn(async (event, callback) => {
        listeners.set(event, () => callback({ payload: null }));
        return () => undefined;
      }),
      setFocus: vi.fn(async () => undefined),
      show: vi.fn(async () => undefined),
    };
    handles.set(label, handle);
    return handle;
  });
  const onReady = vi.fn();
  const onAllClosed = vi.fn();
  const manager = createDisposableTaskWindowManager({ createWindow, onReady, onAllClosed });
  return { callbacks, createWindow, handles, manager, onAllClosed, onReady };
}

describe("disposable task window manager", () => {
  it("creates one window per job and focuses duplicate requests", async () => {
    const test = harness();

    expect(await test.manager.open(job())).toBe(true);
    expect(await test.manager.open(job())).toBe(false);

    expect(test.createWindow).toHaveBeenCalledTimes(1);
    expect(test.manager.getOpenJobIds()).toEqual(["job-1"]);
    expect(test.handles.get("task-job-1")?.show).toHaveBeenCalledTimes(1);
    expect(test.handles.get("task-job-1")?.setFocus).toHaveBeenCalledTimes(1);
  });

  it("reports readiness and final window cleanup", async () => {
    const test = harness();
    await test.manager.open(job());
    const listeners = test.callbacks.get("task-job-1");

    listeners?.get("zmanager-task-ready")?.();
    expect(test.onReady).toHaveBeenCalledWith("job-1");

    listeners?.get("tauri://destroyed")?.();
    expect(test.manager.getOpenJobIds()).toEqual([]);
    expect(test.onAllClosed).toHaveBeenCalledTimes(1);
  });

  it("removes a window when listener registration fails", async () => {
    const onAllClosed = vi.fn();
    const handle: DisposableTaskWindowHandle = {
      label: "task-job-1",
      emit: vi.fn(),
      once: vi.fn(async (event) => {
        if (event === "tauri://error") {
          throw new Error("registration failed");
        }
        return () => undefined;
      }),
      setFocus: vi.fn(),
      show: vi.fn(),
    };
    const manager = createDisposableTaskWindowManager({
      createWindow: () => handle,
      onReady: vi.fn(),
      onAllClosed,
    });

    await expect(manager.open(job())).rejects.toThrow("registration failed");
    expect(manager.hasOpenWindows()).toBe(false);
    expect(onAllClosed).toHaveBeenCalledOnce();
  });

  it("reports asynchronous window creation failure for the accepted Job", async () => {
    const callbacks = new Map<string, () => void>();
    const onPresentationFailed = vi.fn();
    const handle: DisposableTaskWindowHandle = {
      label: "task-job-1",
      emit: vi.fn(),
      once: vi.fn(async (event, callback) => {
        callbacks.set(event, () => callback({ payload: null }));
        return () => undefined;
      }),
      setFocus: vi.fn(),
      show: vi.fn(),
    };
    const manager = createDisposableTaskWindowManager({
      createWindow: () => handle,
      onReady: vi.fn(),
      onAllClosed: vi.fn(),
      onPresentationFailed,
    });
    const accepted = job();

    await manager.open(accepted);
    callbacks.get("tauri://error")?.();

    expect(onPresentationFailed).toHaveBeenCalledWith(
      accepted,
      expect.any(Error),
    );
    expect(manager.hasOpenWindows()).toBe(false);
  });
});
