import { beforeEach, describe, expect, it, vi } from "vitest";

import { PREFERENCE_KEYS } from "../app/preferenceStorage";
import { runReplacementMigrationBeforeRuntime } from "./replacementMigration";

const mocks = vi.hoisted(() => ({
  isTauri: vi.fn(() => true),
  prepare: vi.fn(),
  complete: vi.fn(),
  storage: new Map<string, string>(),
}));

vi.mock("@tauri-apps/api/core", () => ({ isTauri: mocks.isTauri }));
vi.mock("../api/commands", () => ({
  prepareReplacementMigration: mocks.prepare,
  completeReplacementMigration: mocks.complete,
}));
vi.mock("../app/preferenceStorage", async (importOriginal) => ({
  ...await importOriginal<typeof import("../app/preferenceStorage")>(),
  resolvePreferenceStorage: () => ({
    getItem: (key: string) => mocks.storage.get(key) ?? null,
    setItem: (key: string, value: string) => { mocks.storage.set(key, value); },
    removeItem: (key: string) => { mocks.storage.delete(key); },
  }),
}));

describe("replacement migration desktop bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storage.clear();
    mocks.isTauri.mockReturnValue(true);
    mocks.complete.mockResolvedValue(undefined);
  });

  it("applies preferences before acknowledging the durable marker", async () => {
    mocks.prepare.mockResolvedValue({
      schemaVersion: 1,
      requiresCompletion: true,
      preferences: {
        defaultArchiveFormat: "tzap",
        defaultCleanSourceEnabled: null,
        legacyDefaultCreateProfile: null,
        defaultOutputLocation: null,
        customOutputFolderPath: null,
        quickOpenExtractionEnabled: null,
        quickExtractionLocation: null,
        quickExtractionFolderPath: null,
        previewCleanupPolicy: null,
      },
    });
    await runReplacementMigrationBeforeRuntime();
    expect(mocks.storage.get(PREFERENCE_KEYS.defaultArchiveFormat)).toBe("tzap");
    expect(mocks.complete).toHaveBeenCalledWith(1, ["defaultArchiveFormat"]);
  });

  it("does not invoke migration in browser preview", async () => {
    mocks.isTauri.mockReturnValue(false);
    await runReplacementMigrationBeforeRuntime();
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it("allows a clean launch when prepare fails", async () => {
    mocks.prepare.mockRejectedValue(new Error("corrupt legacy data"));
    await expect(runReplacementMigrationBeforeRuntime()).resolves.toBeUndefined();
    expect(mocks.complete).not.toHaveBeenCalled();
  });
});
