export type DisposableTaskLifecycleSnapshot = Readonly<{
  normalLaunchObserved: boolean;
  quickActionOnlyCoordinator: boolean;
  quickActionActivityObserved: boolean;
  pendingQuickActionRequests: number;
}>;

export type DisposableTaskLifecycle = Readonly<{
  getSnapshot(): DisposableTaskLifecycleSnapshot;
  observeNormalLaunch(): void;
  observeQuickActionLaunch(): void;
  beginQuickActionRequest(): void;
  endQuickActionRequest(): void;
  observeMainWindowHiddenForTasks(): void;
  shouldCloseCoordinator(input: Readonly<{
    desktopRuntime: boolean;
    hasOpenTaskWindows: boolean;
    hasActiveJobs: boolean;
    mainWindowShown: boolean;
  }>): boolean;
}>;

/** Owns process-presence decisions independently from window and job effects. */
export function createDisposableTaskLifecycle(): DisposableTaskLifecycle {
  let snapshot: DisposableTaskLifecycleSnapshot = Object.freeze({
    normalLaunchObserved: false,
    quickActionOnlyCoordinator: false,
    quickActionActivityObserved: false,
    pendingQuickActionRequests: 0,
  });

  return Object.freeze({
    getSnapshot: () => snapshot,
    observeNormalLaunch: () => {
      snapshot = Object.freeze({
        normalLaunchObserved: true,
        quickActionOnlyCoordinator: false,
        quickActionActivityObserved: snapshot.quickActionActivityObserved,
        pendingQuickActionRequests: snapshot.pendingQuickActionRequests,
      });
    },
    observeQuickActionLaunch: () => {
      if (!snapshot.normalLaunchObserved) {
        snapshot = Object.freeze({ ...snapshot, quickActionOnlyCoordinator: true });
      }
    },
    beginQuickActionRequest: () => {
      snapshot = Object.freeze({
        ...snapshot,
        quickActionOnlyCoordinator: snapshot.normalLaunchObserved
          ? false
          : true,
        quickActionActivityObserved: true,
        pendingQuickActionRequests: snapshot.pendingQuickActionRequests + 1,
      });
    },
    endQuickActionRequest: () => {
      snapshot = Object.freeze({
        ...snapshot,
        pendingQuickActionRequests: Math.max(0, snapshot.pendingQuickActionRequests - 1),
      });
    },
    observeMainWindowHiddenForTasks: () => {
      snapshot = Object.freeze({
        ...snapshot,
        quickActionOnlyCoordinator: true,
        quickActionActivityObserved: true,
      });
    },
    shouldCloseCoordinator: (input) =>
      input.desktopRuntime
      && snapshot.quickActionOnlyCoordinator
      && snapshot.quickActionActivityObserved
      && snapshot.pendingQuickActionRequests === 0
      && !input.hasOpenTaskWindows
      && !input.hasActiveJobs
      && !input.mainWindowShown,
  });
}
