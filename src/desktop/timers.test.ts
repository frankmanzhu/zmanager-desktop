import { describe, expect, it, vi } from "vitest";

import { createAppTimers, type TimerClock } from "./timers";

type TimerEntry = {
  callback: () => void;
  delayMs: number;
  cleared: boolean;
};

function createFakeClock() {
  let nextHandle = 1;
  const timeouts = new Map<number, TimerEntry>();
  const intervals = new Map<number, TimerEntry>();
  const clock: TimerClock = {
    setTimeout(callback, delayMs) {
      const handle = nextHandle;
      nextHandle += 1;
      timeouts.set(handle, { callback, delayMs, cleared: false });
      return handle;
    },
    clearTimeout(handle) {
      const entry = timeouts.get(handle as number);
      if (entry) {
        entry.cleared = true;
      }
    },
    setInterval(callback, delayMs) {
      const handle = nextHandle;
      nextHandle += 1;
      intervals.set(handle, { callback, delayMs, cleared: false });
      return handle;
    },
    clearInterval(handle) {
      const entry = intervals.get(handle as number);
      if (entry) {
        entry.cleared = true;
      }
    },
  };

  return {
    clock,
    timeouts,
    intervals,
    fireTimeout(handle: number) {
      const entry = timeouts.get(handle);
      if (entry && !entry.cleared) {
        entry.cleared = true;
        entry.callback();
      }
    },
    activeTimeouts() {
      return [...timeouts.entries()].filter(([, entry]) => !entry.cleared);
    },
    activeIntervals() {
      return [...intervals.entries()].filter(([, entry]) => !entry.cleared);
    },
  };
}

function createTimersWithFakeClock(fakeClock = createFakeClock()) {
  return {
    fakeClock,
    timers: createAppTimers({
      quickActionAutoCloseDelayMs: 650,
      createPlanDebounceMs: 350,
      clock: fakeClock.clock,
    }),
  };
}

describe("desktop timer adapter", () => {
  it("starts the progress clock as a singleton 1000ms interval", () => {
    const { fakeClock, timers } = createTimersWithFakeClock();
    const firstCallback = vi.fn();
    const duplicateCallback = vi.fn();

    timers.jobs.startProgressClock(firstCallback);
    timers.jobs.startProgressClock(duplicateCallback);

    expect(fakeClock.activeIntervals()).toHaveLength(1);
    expect(fakeClock.activeIntervals()[0][1].delayMs).toBe(1000);

    fakeClock.activeIntervals()[0][1].callback();
    expect(firstCallback).toHaveBeenCalledTimes(1);
    expect(duplicateCallback).not.toHaveBeenCalled();

    timers.jobs.stopProgressClock();
    expect(fakeClock.activeIntervals()).toHaveLength(0);
  });

  it("tracks and clears quick-action auto-close timeouts", () => {
    const { fakeClock, timers } = createTimersWithFakeClock();
    const callback = vi.fn();

    expect(timers.jobs.hasQuickActionAutoClosePending()).toBe(false);
    timers.jobs.scheduleQuickActionAutoClose(callback);

    expect(timers.jobs.hasQuickActionAutoClosePending()).toBe(true);
    expect(fakeClock.activeTimeouts()).toHaveLength(1);
    expect(fakeClock.activeTimeouts()[0][1].delayMs).toBe(650);

    timers.jobs.clearQuickActionAutoClose();

    expect(timers.jobs.hasQuickActionAutoClosePending()).toBe(false);
    expect(fakeClock.activeTimeouts()).toHaveLength(0);
    fakeClock.fireTimeout(1);
    expect(callback).not.toHaveBeenCalled();
  });

  it("clears quick-action auto-close pending state when it fires", () => {
    const { fakeClock, timers } = createTimersWithFakeClock();
    const callback = vi.fn();

    timers.jobs.scheduleQuickActionAutoClose(callback);
    const handle = fakeClock.activeTimeouts()[0][0];
    fakeClock.fireTimeout(handle);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(timers.jobs.hasQuickActionAutoClosePending()).toBe(false);
    expect(fakeClock.activeTimeouts()).toHaveLength(0);
  });

  it("cancels an existing create-plan debounce before scheduling another", () => {
    const { fakeClock, timers } = createTimersWithFakeClock();
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();

    timers.createPlanDebounce.schedule(firstCallback);
    timers.createPlanDebounce.schedule(secondCallback);

    expect(timers.createPlanDebounce.hasPending()).toBe(true);
    expect(fakeClock.timeouts.get(1)?.cleared).toBe(true);
    expect(fakeClock.activeTimeouts()).toHaveLength(1);
    expect(fakeClock.activeTimeouts()[0][1].delayMs).toBe(350);

    fakeClock.fireTimeout(1);
    expect(firstCallback).not.toHaveBeenCalled();

    fakeClock.fireTimeout(2);
    expect(secondCallback).toHaveBeenCalledTimes(1);
    expect(timers.createPlanDebounce.hasPending()).toBe(false);
    expect(fakeClock.activeTimeouts()).toHaveLength(0);
  });

  it("cancels pending create-plan debounce callbacks", () => {
    const { fakeClock, timers } = createTimersWithFakeClock();
    const callback = vi.fn();

    timers.createPlanDebounce.schedule(callback);
    expect(timers.createPlanDebounce.hasPending()).toBe(true);

    timers.createPlanDebounce.cancel();

    expect(timers.createPlanDebounce.hasPending()).toBe(false);
    expect(fakeClock.activeTimeouts()).toHaveLength(0);
    fakeClock.fireTimeout(1);
    expect(callback).not.toHaveBeenCalled();
  });

  it("schedules independent one-shot UI deferrals with supplied delays", () => {
    const { fakeClock, timers } = createTimersWithFakeClock();
    const focusCallback = vi.fn();
    const resetCallback = vi.fn();

    const focusHandle = timers.uiDeferrals.schedule(focusCallback, 0);
    const resetHandle = timers.uiDeferrals.schedule(resetCallback, 1400);

    expect(fakeClock.activeTimeouts()).toHaveLength(2);
    expect(fakeClock.timeouts.get(focusHandle as number)?.delayMs).toBe(0);
    expect(fakeClock.timeouts.get(resetHandle as number)?.delayMs).toBe(1400);

    fakeClock.fireTimeout(focusHandle as number);
    expect(focusCallback).toHaveBeenCalledTimes(1);
    expect(resetCallback).not.toHaveBeenCalled();

    fakeClock.fireTimeout(resetHandle as number);
    expect(resetCallback).toHaveBeenCalledTimes(1);
  });

  it("cancels one-shot UI deferrals", () => {
    const { fakeClock, timers } = createTimersWithFakeClock();
    const callback = vi.fn();

    const handle = timers.uiDeferrals.schedule(callback, 240);
    timers.uiDeferrals.cancel(handle);

    expect(fakeClock.activeTimeouts()).toHaveLength(0);
    fakeClock.fireTimeout(handle as number);
    expect(callback).not.toHaveBeenCalled();
  });
});
