import { describe, expect, it } from "vitest";
import { resolveDestinationCollisionStrategy } from "./collisionPolicy";

describe("collisionPolicy", () => {
  it("honors explicitly provided destinationCollisionStrategy first", () => {
    expect(
      resolveDestinationCollisionStrategy({
        replaceExisting: true,
        destinationCollisionStrategy: "rename",
      }),
    ).toBe("rename");
  });

  it("returns rename for disposable tasks unless replace was explicitly selected", () => {
    expect(
      resolveDestinationCollisionStrategy({ isDisposableTask: true, replaceExisting: false }),
    ).toBe("rename");
    expect(
      resolveDestinationCollisionStrategy({ isDisposableTask: true, overwrite: "refuse" }),
    ).toBe("rename");
    expect(
      resolveDestinationCollisionStrategy({ isDisposableTask: true, overwrite: "ask" }),
    ).toBe("rename");
  });

  it("returns rename for quick actions unless replace was explicitly selected", () => {
    expect(
      resolveDestinationCollisionStrategy({ isQuickAction: true, replaceExisting: false }),
    ).toBe("rename");
    expect(
      resolveDestinationCollisionStrategy({ isQuickAction: true, overwrite: "rename" }),
    ).toBe("rename");
  });

  it("returns undefined when replace/overwrite is explicitly requested without an explicit strategy override", () => {
    expect(
      resolveDestinationCollisionStrategy({ isDisposableTask: true, replaceExisting: true }),
    ).toBeUndefined();
    expect(
      resolveDestinationCollisionStrategy({ isQuickAction: true, overwrite: "replace" }),
    ).toBeUndefined();
    expect(
      resolveDestinationCollisionStrategy({ replaceExisting: true }),
    ).toBeUndefined();
  });

  it("returns undefined when no collision strategy is requested for standard tasks", () => {
    expect(
      resolveDestinationCollisionStrategy({ replaceExisting: false }),
    ).toBeUndefined();
  });
});
