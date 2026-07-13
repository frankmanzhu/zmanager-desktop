export type TimerHandle = unknown;

export interface TimerClock {
  setTimeout(callback: () => void, delayMs: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
  setInterval(callback: () => void, delayMs: number): TimerHandle;
  clearInterval(handle: TimerHandle): void;
}

export interface AppTimerOptions {
  quickActionAutoCloseDelayMs: number;
  createPlanDebounceMs: number;
  progressClockIntervalMs?: number;
  clock?: TimerClock;
}

export interface JobTimerAdapter {
  hasQuickActionAutoClosePending(): boolean;
  clearQuickActionAutoClose(): void;
  scheduleQuickActionAutoClose(callback: () => void): void;
  startProgressClock(callback: () => void): void;
  stopProgressClock(): void;
}

export interface DebounceTimerAdapter {
  hasPending(): boolean;
  cancel(): void;
  schedule(callback: () => void): void;
}

export interface OneShotTimerAdapter {
  schedule(callback: () => void, delayMs: number): TimerHandle;
  cancel(handle: TimerHandle): void;
}

export interface AppTimers {
  jobs: JobTimerAdapter;
  createPlanDebounce: DebounceTimerAdapter;
  uiDeferrals: OneShotTimerAdapter;
}

function browserTimerClock(): TimerClock {
  return {
    setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimeout: (handle) => window.clearTimeout(handle as number),
    setInterval: (callback, delayMs) => window.setInterval(callback, delayMs),
    clearInterval: (handle) => window.clearInterval(handle as number),
  };
}

function createDebounceTimer(clock: TimerClock, delayMs: number): DebounceTimerAdapter {
  let timer: TimerHandle | null = null;
  const cancel = (): void => {
    if (timer === null) {
      return;
    }

    clock.clearTimeout(timer);
    timer = null;
  };

  return {
    hasPending(): boolean {
      return timer !== null;
    },
    cancel,
    schedule(callback: () => void): void {
      cancel();
      timer = clock.setTimeout(() => {
        timer = null;
        callback();
      }, delayMs);
    },
  };
}

function createOneShotTimer(clock: TimerClock): OneShotTimerAdapter {
  return {
    schedule(callback: () => void, delayMs: number): TimerHandle {
      return clock.setTimeout(callback, delayMs);
    },
    cancel(handle: TimerHandle): void {
      clock.clearTimeout(handle);
    },
  };
}

export function createAppTimers(options: AppTimerOptions): AppTimers {
  const clock = options.clock ?? browserTimerClock();
  const progressClockIntervalMs = options.progressClockIntervalMs ?? 1000;
  let progressClockTimer: TimerHandle | null = null;
  let quickActionAutoCloseTimer: TimerHandle | null = null;

  return {
    jobs: {
      hasQuickActionAutoClosePending(): boolean {
        return quickActionAutoCloseTimer !== null;
      },
      clearQuickActionAutoClose(): void {
        if (quickActionAutoCloseTimer === null) {
          return;
        }

        clock.clearTimeout(quickActionAutoCloseTimer);
        quickActionAutoCloseTimer = null;
      },
      scheduleQuickActionAutoClose(callback: () => void): void {
        quickActionAutoCloseTimer = clock.setTimeout(() => {
          quickActionAutoCloseTimer = null;
          callback();
        }, options.quickActionAutoCloseDelayMs);
      },
      startProgressClock(callback: () => void): void {
        if (progressClockTimer !== null) {
          return;
        }

        progressClockTimer = clock.setInterval(callback, progressClockIntervalMs);
      },
      stopProgressClock(): void {
        if (progressClockTimer === null) {
          return;
        }

        clock.clearInterval(progressClockTimer);
        progressClockTimer = null;
      },
    },
    createPlanDebounce: createDebounceTimer(clock, options.createPlanDebounceMs),
    uiDeferrals: createOneShotTimer(clock),
  };
}
