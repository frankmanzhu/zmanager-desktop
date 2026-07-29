import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

import type { StartJobResponseDto } from "../api/types";
import { NOOP_DIAGNOSTIC_RECORDER, type DiagnosticRecorder } from "../app/diagnostics";

type WindowEvent = Readonly<{ payload: unknown }>;

export type DisposableTaskWindowHandle = Readonly<{
  label: string;
  emit<T>(event: string, payload?: T): Promise<void>;
  once<T>(event: string, callback: (event: Readonly<{ payload: T }>) => void): Promise<() => void>;
  setFocus(): Promise<void>;
  show(): Promise<void>;
}>;

export type DisposableTaskWindowManagerOptions = Readonly<{
  createWindow?: (label: string, options: Record<string, unknown>) => DisposableTaskWindowHandle;
  onReady(jobId: string): void;
  onAllClosed(): void;
  onWindowClosed?(jobId: string): void;
  diagnostics?: DiagnosticRecorder;
}>;

export type DisposableTaskWindowManager = Readonly<{
  open(job: StartJobResponseDto): Promise<boolean>;
  getOpenJobIds(): readonly string[];
  hasOpenWindows(): boolean;
}>;

export function createDisposableTaskWindowManager(
  options: DisposableTaskWindowManagerOptions,
): DisposableTaskWindowManager {
  const windows = new Map<string, DisposableTaskWindowHandle>();
  const diagnostics = options.diagnostics ?? NOOP_DIAGNOSTIC_RECORDER;
  const createWindow = options.createWindow ?? ((label, windowOptions) => (
    new WebviewWindow(label, windowOptions) as unknown as DisposableTaskWindowHandle
  ));

  return {
    async open(job) {
      const existing = windows.get(job.jobId);
      if (existing) {
        diagnostics.record({
          scope: "disposableTaskWindow",
          name: "existingWindowFocused",
          fields: { jobKind: job.kind, openWindowCount: windows.size },
        });
        await existing.show();
        await existing.setFocus();
        return false;
      }

      const label = disposableTaskWindowLabel(job.jobId);
      const taskWindow = createWindow(label, {
        url: disposableTaskWindowUrl(job),
        title: disposableTaskWindowTitle(job),
        width: 620,
        height: 460,
        minWidth: 520,
        minHeight: 380,
        center: true,
        resizable: true,
        visible: true,
      });
      windows.set(job.jobId, taskWindow);
      diagnostics.record({
        scope: "disposableTaskWindow",
        name: "created",
        fields: { jobKind: job.kind, initialStatus: job.status, openWindowCount: windows.size },
      });

      const removeWindow = (name: "destroyed" | "creationFailed") => {
        if (windows.get(job.jobId) !== taskWindow) {
          return;
        }
        windows.delete(job.jobId);
        options.onWindowClosed?.(job.jobId);
        diagnostics.record({
          scope: "disposableTaskWindow",
          name,
          fields: { jobKind: job.kind, openWindowCount: windows.size },
        });
        if (windows.size === 0) {
          options.onAllClosed();
        }
      };

      try {
        await Promise.all([
          taskWindow.once<null>("zmanager-task-ready", () => {
            diagnostics.record({
              scope: "disposableTaskWindow",
              name: "ready",
              fields: { jobKind: job.kind, openWindowCount: windows.size },
            });
            options.onReady(job.jobId);
          }),
          taskWindow.once<null>("tauri://destroyed", () => {
            removeWindow("destroyed");
          }),
          taskWindow.once<WindowEvent>("tauri://error", () => {
            removeWindow("creationFailed");
          }),
        ]);
      } catch (error) {
        removeWindow("creationFailed");
        throw error;
      }
      return true;
    },

    getOpenJobIds() {
      return Object.freeze([...windows.keys()]);
    },

    hasOpenWindows() {
      return windows.size > 0;
    },
  };
}

export function disposableTaskWindowLabel(jobId: string): string {
  const safeId = jobId.replace(/[^a-zA-Z0-9-]/g, "-");
  return `task-${safeId}`;
}

function disposableTaskWindowUrl(job: StartJobResponseDto): string {
  const query = new URLSearchParams({
    surface: "disposable-task",
    jobId: job.jobId,
    kind: job.kind,
    status: job.status,
    createdAt: job.createdAt,
  });
  return `index.html?${query.toString()}`;
}

function disposableTaskWindowTitle(job: StartJobResponseDto): string {
  if (job.kind === "testArchive") {
    return "Testing with ZManager";
  }
  return job.kind.endsWith("Create")
    ? "Compressing with ZManager"
    : "Extracting with ZManager";
}
