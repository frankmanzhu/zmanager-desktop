import { describe, expect, it, vi } from "vitest";

import { createReactRuntimeStore } from "./reactRuntimeStore";

describe("react runtime store", () => {
  it("sends the current snapshot immediately when a listener subscribes", () => {
    let value = 1;
    const listener = vi.fn();
    const store = createReactRuntimeStore({
      createSnapshot: () => ({ value }),
    });

    store.subscribe(listener);
    value = 2;
    store.publishSnapshot();

    expect(listener).toHaveBeenCalledWith({ value: 1 });
    expect(listener).toHaveBeenCalledWith({ value: 2 });
  });

  it("does not create snapshots for normal publishes without listeners", () => {
    const createSnapshot = vi.fn(() => ({ value: 1 }));
    const store = createReactRuntimeStore({ createSnapshot });

    store.publishSnapshot();

    expect(createSnapshot).not.toHaveBeenCalled();
  });

  it("stops publishing to unsubscribed listeners", () => {
    let value = 1;
    const listener = vi.fn();
    const store = createReactRuntimeStore({
      createSnapshot: () => ({ value }),
    });

    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    value = 2;
    store.publishSnapshot();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ value: 1 });
  });
});
