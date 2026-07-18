import { isTauri } from "@tauri-apps/api/core";

import {
  completeReplacementMigration,
  prepareReplacementMigration,
} from "../api/commands";
import { resolvePreferenceStorage } from "../app/preferenceStorage";
import { applyReplacementPreferences } from "../app/replacementMigration";

export async function runReplacementMigrationBeforeRuntime(): Promise<void> {
  if (!isTauri()) return;
  try {
    const prepared = await prepareReplacementMigration();
    if (!prepared.requiresCompletion) return;
    const storage = resolvePreferenceStorage();
    const applied = storage
      ? applyReplacementPreferences(storage, prepared.preferences)
      : [];
    await completeReplacementMigration(prepared.schemaVersion, applied);
  } catch {
    // Migration is explicitly non-blocking. Rust persists normalized
    // diagnostics and retries an interrupted state on the next launch.
    console.warn("Replacement migration did not complete; it will retry on next launch.");
  }
}
