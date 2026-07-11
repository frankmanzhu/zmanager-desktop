export type DisposableTaskLifecycleSnapshot = Readonly<{
  normalLaunchObserved: boolean;
  quickActionOnlyCoordinator: boolean;
}>;

export type DisposableTaskLifecycle = Readonly<{
  getSnapshot(): DisposableTaskLifecycleSnapshot;
  observeNormalLaunch(): void;
  observeQuickActionLaunch(): void;
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
  });

  return Object.freeze({
    getSnapshot: () => snapshot,
    observeNormalLaunch: () => {
      snapshot = Object.freeze({
        normalLaunchObserved: true,
        quickActionOnlyCoordinator: false,
      });
    },
    observeQuickActionLaunch: () => {
      if (!snapshot.normalLaunchObserved) {
        snapshot = Object.freeze({ ...snapshot, quickActionOnlyCoordinator: true });
      }
    },
    observeMainWindowHiddenForTasks: () => {
      snapshot = Object.freeze({ ...snapshot, quickActionOnlyCoordinator: true });
    },
    shouldCloseCoordinator: (input) =>
      input.desktopRuntime
      && snapshot.quickActionOnlyCoordinator
      && !input.hasOpenTaskWindows
      && !input.hasActiveJobs
      && !input.mainWindowShown,
  });
}
