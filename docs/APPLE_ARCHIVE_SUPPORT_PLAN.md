# Apple Archive (`.aar` / `.aea`) macOS Support Implementation Plan

## Executive Summary

Apple Archive (`.aar` unencrypted / `.aea` encrypted) is Apple's high-performance native archive format introduced in macOS Big Sur. While `zmanager-core` includes full Apple Archive support via macOS system framework linkage (`libAppleArchive`), ZManager Desktop's GUI and platform contract layer currently lack support for this format.

Because Apple Archive relies on macOS-native system libraries, **Apple Archive creation and extraction are available exclusively on macOS builds**. Windows and Linux builds lack linkage for Apple Archive. Therefore, this feature must be strictly platform-gated across all UI controls, context menus, quick actions, preference selectors, and backend Rust DTO handlers.

### Critical: existing partial implementation

**The codebase already contains scattered, incomplete Apple Archive fragments.** These were added out of order and will cause cascading compile errors if the remaining pieces are not added in the correct dependency order. Specifically:

| Already present | Still missing (compile will break without it) |
|---|---|
| `JobKind` includes `"appleArchiveCreate"` / `"appleArchiveExtract"` (`src/api/types.ts:554-555`) | `StartCreateRequest["format"]` does NOT include `"appleArchive"` |
| `JobKindDto` includes `AppleArchiveCreate` / `AppleArchiveExtract` (`src-tauri/src/job_dto.rs:94-95`) | `ArchiveFormatDto` has NO `AppleArchive` variant (`src-tauri/src/dto.rs:270-276`) |
| `JobsSurfaces.tsx` handles `case "appleArchiveCreate":` and `case "appleArchiveExtract":` | `isCreateJobKind()` does NOT check `"appleArchiveCreate"` (`src/app/jobs.ts:65-72`) |
| i18n has `jobs.kind.appleArchiveCreate` / `jobs.kind.appleArchiveExtract` (en + zh-CN) | No `format.appleArchive`, `shellAction.compressAppleArchive`, or tooltip i18n keys exist |
| `commands.rs` imports `AppleArchiveError` and has `map_apple_archive_error()` (L1837) | `ArchiveFamily` enum lacks `AppleArchive`; `detect_archive_family` doesn't match `.aar`/`.aea`; `start_create_internal` has no Apple Archive arm; extract family→kind mapping has no Apple Archive arm |
| — | `createFormatCapabilities.ts` has NO `appleArchive` entry — TypeScript will fail because `Record<CreateArchiveFormat, CreateFormatCapabilities>` is exhaustive |

**This plan begins with a reconciliation stage (Stage 0) to resolve this desynchronization before adding new functionality.**

---

## Architectural Principles & Platform Gating

### 1. Clean Platform Isolation via Native Capability Snapshots

The codebase already has a `Native Integration Contract` system (see `CONTEXT.md` "Native Integration Contract") that reports capability state per platform. Apple Archive support must be modeled as a native capability surfaced through this system, NOT through ad-hoc `platform === "macos"` string checks.

- **macOS**: Full support for `.aar` (unencrypted) and `.aea` (encrypted) browsing, creation, extraction, quick actions, context menus, and file associations.
- **Windows / Linux**: Apple Archive must be completely absent from:
  - Format dropdowns (Create Workspace, Preferences)
  - Context menus (both OS-generated and in-app)
  - Quick action routing
  - Default format selection
  - File association registration

**Implementation pattern**: The frontend queries `NativeCapabilitySnapshot` (already returned by `project_contract`) for an `appleArchiveAvailable` boolean. All UI gating uses this capability flag, never a raw OS name string. On the Rust side, `#[cfg(target_os = "macos")]` gates the `ArchiveFormatDto::AppleArchive` variant and its command handlers; `#[cfg(not(target_os = "macos"))]` returns `CommandErrorDto::unsupported_format`.

**Short-term bridge**: Until `NativeCapabilitySnapshot` is plumbed into every UI component that needs it, use a single centralized helper function that derives `appleArchiveAvailable` from the platform. The helper lives in exactly one place. Never scatter `platform === "macos"` checks across components.

### 2. Dynamic Extension Switching (`.aar` ↔ `.aea`)

- Plain Apple Archive uses extension `.aar`.
- Encrypted Apple Archive (when password protection is enabled) uses extension `.aea`.
- When the user selects Apple Archive as the creation format:
  - Adding a password automatically transforms the target extension from `.aar` to `.aea`.
  - Clearing the password automatically transforms the target extension back from `.aea` to `.aar`.
  - If the user manually typed an extension that already matches the correct one for the current password state, no change occurs (no double-extension like `.aea.aea`).

### 3. Browsing / Listing

Apple Archive browsing (listing entries within an existing `.aar`/`.aea`) goes through the existing `zmanager-core` Apple Archive backend, which is already wired via `ArchiveBrowserError::AppleArchive` and `map_apple_archive_error()`. The `detect_archive_family` function must be updated to recognize `.aar` and `.aea` extensions and route them to a new `ArchiveFamily::AppleArchive` variant so that entry listing and extraction use the correct backend.

### 4. Archive File Type Recognition

The `archiveFileTypes.ts` module imports from `src/app/generated/archiveFileTypes.generated.json`, which is generated from `manifests/archive-file-types.json` by `scripts/generate-native-contracts.mjs`. Adding `"aar"` and `"aea"` to the manifest's `singleExtensions` array automatically propagates to `isSupportedArchivePath`, `baseNameWithoutKnownArchiveExtension`, `ARCHIVE_OPEN_FILTER`, and all other archive-type helpers once the contract generator is run (Stage 1, step 17).

---

## Dependency Order

```
Stage 0 (reconcile audit)
  → Stage 1 (types, manifests, create flow constants, i18n, capabilities, contract regeneration)
    → Stage 2 (preferences — independent of Stage 3)
    → Stage 3 (create flow tests — independent of Stage 2)
  Stage 2 + Stage 3 → Stage 4 (UI components, jobs)
    → Stage 5 (quick actions, context menus)
      → Stage 6 (Rust backend)
        → Stage 7 (verify generated contracts)
          → Stage 8 (column support — browsing must work first)
            → Stage 9 (final verification)
```

**Key**: Stages 2 and 3 are parallel — both only need Stage 1. Contract regeneration runs as the LAST step of Stage 1, so all generated types (`compressAppleArchive` in `GeneratedShellActionKind`) are available for Stages 2–5. Stage 8 column work requires the Stage 6 Rust backend to have working archive browsing first.

---

## Stage 0: Reconcile Existing Partial Implementation

**Goal:** Audit every existing Apple Archive reference, confirm they are kept, and verify `zmanager-core` readiness. This stage produces NO new code.

**Steps:**

1. **Audit all existing Apple Archive references:**
   ```sh
   grep -rni 'apple_archive\|AppleArchive\|appleArchive' src/ src-tauri/src/ manifests/
   ```
   Confirm the following locations already reference Apple Archive:
   - `src/api/types.ts` — `JobKind` union (lines 554-555)
   - `src/app/i18n/messages.en.ts` — `jobs.kind.appleArchiveCreate`, `jobs.kind.appleArchiveExtract` (lines 378-379)
   - `src/app/i18n/messages.zh-CN.ts` — same keys (lines 259-260)
   - `src/ui/react/jobs/JobsSurfaces.tsx` — `case "appleArchiveCreate":` and `case "appleArchiveExtract":` (lines 870, 877)
   - `src-tauri/src/job_dto.rs` — `JobKindDto::AppleArchiveCreate`, `JobKindDto::AppleArchiveExtract` (lines 94-95)
   - `src-tauri/src/commands.rs` — `use zmanager_core::apple_archive_backend::AppleArchiveError` (line 44), `map_apple_archive_error()` (line 1837), `ArchiveBrowserError::AppleArchive` match arm (line 1691)

2. **Decision: KEEP all existing fragments.** They are all correct in isolation. The problem is only that their dependent types haven't been added yet.

3. **Verify `zmanager-core` readiness.** Before any desktop work, confirm that `zmanager_core::apple_archive_backend` exports the necessary public items. Check for:
   - A function to run an Apple Archive create job from sources with plan options (name TBD — verify the actual API)
   - A function to run an Apple Archive extract job with password and policy (name TBD)
   - A create options struct (name TBD)
   - A create report type (name TBD)
   - If any of these are missing, this stage must produce a `zmanager-core` prerequisite issue before proceeding.

**Verifiable Bar:**
- `npm run build` passes (current state as of this writing).
- Audit report documents every existing reference.
- `zmanager-core` API availability confirmed OR prerequisite issue filed.

---

## Stage 1: Contract Manifests, Frontend Types, Create Flow, i18n, Capabilities, and Contract Regeneration

**Goal:** Add Apple Archive to every TypeScript type, constant, manifest, and i18n key that defines the set of known formats. Regenerate native contracts at the end so that `GeneratedShellActionKind` includes `"compressAppleArchive"` for use in Stages 4–5.

**Dependency:** Stage 0 complete.

### 1A: Manifest files

**File: `manifests/archive-file-types.json`**

1. Add `"aar"` and `"aea"` to the `singleExtensions` array (line 3).
   - These are single extensions. No compound extensions (like `tar.gz`) apply.
   - No split suffixes apply.

2. Add to `associationTypes` array (after the last entry, before `"genericPackages"`):
   ```json
   {"id":"appleArchive","primaryExtensions":["aar","aea"],"compoundExtensions":[],"splitSuffixes":[],"mimeType":"application/x-apple-archive","mimeAliases":[],"windows":false,"linux":false,"macos":true}
   ```
   The `windows: false, linux: false` fields ensure the manifest declares platform support explicitly.

3. Add `"aar"` and `"aea"` to the `archives` group `extensions` array in `documentGroups` (line 36).

**File: `manifests/shell-actions.json`**

4. Add `compressAppleArchive` shell action (after the `compressTarGz` entry, around line 155):
   ```json
   {
     "id": "compressAppleArchive",
     "rustCase": "CompressAppleArchive",
     "canonicalLabel": "Add to .aar",
     "canonicalLabelZhHans": "添加到 .aar",
     "displayKey": "shellAction.compressAppleArchive",
     "nativeVerb": "AddToAar",
     "order": 77,
     "contextMenuOrder": 95,
     "contextMenuContexts": ["archiveSingle", "archiveMultiple", "creation", "container"],
     "selectionShapes": ["single-archive", "multiple-archives", "files", "folders", "mixed"],
     "multiplicity": "one-or-more",
     "nativeSurfaces": ["macosFinder"],
     "compatibilityAliases": ["compress-aar", "compress-apple-archive", "add-to-aar", "add-to-apple-archive"],
     "windowsClsid": null,
     "windowDisposition": "disposableTask"
   }
   ```
   Key differences from `compressTarGz`:
   - `nativeSurfaces` is `["macosFinder"]` only — NOT all platforms.
   - `windowsClsid` is `null` — no Windows shell extension registration.
   - There is no corresponding macOS Service entry (unlike `compress`/`extract`). Apple Archive is Finder context menu only.

### 1B: API types

**File: `src/api/types.ts`**

5. Update `StartCreateRequest["format"]` union (line 255):
   ```ts
   format: "zip" | "tarZst" | "tzap" | "sevenZ" | "tarGz" | "appleArchive";
   ```
   - `JobKind` (lines 554-555) already includes `"appleArchiveCreate"` and `"appleArchiveExtract"` — no change needed here.
   - `QuickActionKind` is an alias for `GeneratedShellActionKind` — it will pick up `"compressAppleArchive"` after contract regeneration (step 17, this stage).

### 1C: Create flow constants

**File: `src/app/createFlow.ts`**

6. Add to `CREATE_FORMAT_EXTENSIONS` (line 15):
   ```ts
   appleArchive: "aar",
   ```

7. Add to `CREATE_FORMAT_ALLOWED_EXTENSIONS` (line 23):
   ```ts
   appleArchive: ["aar", "aea"],
   ```

8. Add `"aar"` and `"aea"` to `RECOGNIZED_CREATE_EXTENSIONS` (line 31). No substring collision risk — `"aar"` and `"aea"` are unique suffixes that don't overlap with any existing entry (verified: existing entries are `tar.gz`, `tar.zst`, `zip`, `tgz`, `tzst`, `tzap`, `7z`).

9. Add `"appleArchive"` to `CREATE_PASSWORD_FORMATS` (line 32).

10. Update `getCreateFormatExtension` to accept an optional `hasPassword` parameter with default `false`:
    ```ts
    export function getCreateFormatExtension(format: CreateArchiveFormat, hasPassword = false): string {
      if (format === "appleArchive" && hasPassword) return "aea";
      return CREATE_FORMAT_EXTENSIONS[format];
    }
    ```
    **Backward compat**: Existing callers that don't pass `hasPassword` default to `false` → get `"aar"` for Apple Archive, which is correct.

11. Update `withCreateArchiveExtension` to accept an optional `hasPassword` parameter and handle the `.aar` ↔ `.aea` swap:
    ```ts
    export function withCreateArchiveExtension(
      path: string,
      format: CreateArchiveFormat,
      hasPassword = false,
    ): string {
      const trimmed = path.trim();
      if (!trimmed) return trimmed;

      const allowedExtensions = CREATE_FORMAT_ALLOWED_EXTENSIONS[format];
      const existingExtension = getCreateArchiveExtension(trimmed);

      // If the existing extension is already recognized for this format
      if (existingExtension && allowedExtensions.includes(existingExtension)) {
        // For appleArchive, check if extension matches password state
        if (format === "appleArchive") {
          const isCurrentlyAea = existingExtension === "aea";
          const wantsAea = hasPassword;
          if (isCurrentlyAea === wantsAea) return trimmed;
          // Swap: strip existing extension, append the correct one
          const basePath = trimmed.slice(0, -(existingExtension.length + 1));
          return `${basePath}.${getCreateFormatExtension(format, hasPassword)}`;
        }
        return trimmed;
      }

      // Has an unrecognized extension → replace it
      if (existingExtension) {
        const basePath = trimmed.slice(0, -(existingExtension.length + 1));
        return `${basePath}.${getCreateFormatExtension(format, hasPassword)}`;
      }

      // No recognized extension → append
      return `${trimmed}.${getCreateFormatExtension(format, hasPassword)}`;
    }
    ```
    **Backward compat**: Existing callers that don't pass `hasPassword` default to `false`. For non-Apple formats, the parameter is ignored. For Apple Archive, it defaults to `.aar`.

12. Update `suggestedCreateArchiveName` signature to accept `hasPassword` as an optional 4th parameter:
    ```ts
    export function suggestedCreateArchiveName(
      sources: string[],
      format: CreateArchiveFormat,
      fallback = "archive",
      hasPassword = false,
    ): string {
      const firstSource = sources[0];
      const sourceName = firstSource ? getArchiveName(firstSource, fallback) : fallback;
      const safeName = sourceName.replace(/[<>:"/\\|?* -]/g, "_").trim() || fallback;
      return `${safeName}.${getCreateFormatExtension(format, hasPassword)}`;
    }
    ```
    **Backward compat**: Existing callers with 2–3 arguments don't pass `hasPassword`, defaulting to `false`.

13. Update `buildStartCreateRequest` (line 488) to pass `hasPassword`:
    ```ts
    destinationPath: withCreateArchiveExtension(input.destinationPath, input.format, Boolean(input.password)),
    ```
    Also add `appleArchive` to the volume size exclusion guard (line 503):
    ```ts
    ...(volumeSize !== undefined && input.format !== "tarZst" && input.format !== "tarGz" && input.format !== "appleArchive" ? { volumeSize } : {}),
    ```

### 1D: Create format capabilities

**File: `src/app/createFormatCapabilities.ts`**

14. Add `appleArchive` to the `CAPABILITIES` record (after the `tarGz` entry, around line 58):
    ```ts
    appleArchive: Object.freeze({
      password: true,        // Supported via .aea format switch
      splitVolumes: false,
      compressionLevel: true,
      zipCompression: false,
      tzapRecovery: false,
      tzapVolumeLossTolerance: false,
      sevenZAdvanced: false,
    }),
    ```
    **If this entry is missing, TypeScript will fail** because `CAPABILITIES` is typed as `Record<CreateArchiveFormat, CreateFormatCapabilities>` and the record must be exhaustive.

### 1E: i18n strings

**File: `src/app/i18n/messages.en.ts`**

15. Add localization keys. **Do NOT add `jobs.kind.appleArchiveCreate` or `jobs.kind.appleArchiveExtract` — they already exist at lines 378-379.** Add only the new keys:
    ```ts
    "shellAction.compressAppleArchive": "Add to .aar",
    "format.appleArchive": "Apple Archive (.aar / .aea)",
    "create.preserveMetadata.appleArchive.tooltip": "Store permission bits and modification times for files, folders, and symbolic links.",
    ```

**File: `src/app/i18n/messages.zh-CN.ts`**

16. Add Chinese localization (same note — don't duplicate existing job kind keys at lines 259-260):
    ```ts
    "shellAction.compressAppleArchive": "添加到 .aar",
    "format.appleArchive": "Apple Archive (.aar / .aea)",
    "create.preserveMetadata.appleArchive.tooltip": "保存文件、文件夹和符号链接的权限位及修改时间。",
    ```

### 1F: Regenerate native contracts

17. Run the contract generator NOW so all subsequent stages have `"compressAppleArchive"` available in `GeneratedShellActionKind`:
    ```bash
    node scripts/generate-native-contracts.mjs
    ```

18. Verify the generated output includes:
    - `src/api/generated/shellActions.generated.ts`: `SHELL_ACTION_IDS` includes `"compressAppleArchive"`, `SHELL_ACTION_POLICIES` includes the new action with its full policy.
    - `src/app/generated/archiveFileTypes.generated.json`: `singleExtensions` includes `"aar"` and `"aea"`.
    - `src-tauri/src/generated/` (if applicable): includes `CompressAppleArchive` variant.

**Verifiable Bar:**
- `npm run build` passes with zero TypeScript errors. If `CAPABILITIES` is missing `appleArchive`, or if `CreateArchiveFormat` doesn't include `"appleArchive"`, TypeScript will fail.
- `git diff` shows expected changes in generated files.
- `npm run test:frontend` passes (existing tests should not break — the `hasPassword` parameter defaults to `false`, which preserves existing behavior).

---

## Stage 2: User Preferences (Platform-Aware)

**Goal:** Register Apple Archive in user preferences. Platform-gating of the default format value is deferred to the UI layer — preferences storage accepts `"appleArchive"` on all platforms, but the UI dropdown filters it out on non-macOS.

**Dependency:** Stage 1 complete (types, constants, and generated contracts exist).

**Steps:**

**File: `src/app/preferences.ts`**

1. Add `"appleArchive"` to the `ARCHIVE_FORMATS` const array (line 196):
   ```ts
   const ARCHIVE_FORMATS = ["zip", "tarZst", "tzap", "sevenZ", "tarGz", "appleArchive"] as const;
   ```

2. Add `appleArchive` to `DEFAULT_APP_PREFERENCES.createFormatDefaults` (after the `tarGz` entry, around line 164):
   ```ts
   appleArchive: {
     cleanSource: true,
     respectGitignore: false,
     followSymlinks: false,
     compressionLevel: null,
     volumeSize: null,
     tzapRecoveryPercentage: null,
     preserveMetadata: true,
     replaceExisting: false,
     promptForPassword: false,
   },
   ```

3. **No other code changes needed in this file.** The `loadCreateFormatDefaults` (line 289) and `normalizeCreateFormatDefaults` (line 648) functions iterate over `ARCHIVE_FORMATS` — adding `"appleArchive"` to the array automatically includes it in load/normalize. The `saveAppPreferences` function (line 545) persists whatever value is set — no format-specific logic needs updating.

4. **Platform-gating strategy for the default format**: Preferences storage accepts `"appleArchive"` on all platforms. The backend rejects `appleArchive` create requests on non-macOS with `unsupported_format`. The UI dropdowns (Stage 4) filter `"appleArchive"` out on non-macOS. This two-layer defense (UI hides it; backend rejects if bypassed) is the correct pattern. When `NativeCapabilitySnapshot` is later plumbed into preferences, the storage layer can also reject it, but that's future hardening, not required for this feature.

**Verifiable Bar:**
- `npm run build` passes.
- `npm run test:frontend` — `preferences.test.ts` passes.
- New test in `preferences.test.ts`:
  ```ts
  it("includes appleArchive in create format defaults", () => {
    const prefs = loadAppPreferences(/* mock storage with defaults */);
    expect(prefs.createFormatDefaults.appleArchive).toBeDefined();
    expect(prefs.createFormatDefaults.appleArchive.preserveMetadata).toBe(true);
    expect(prefs.createFormatDefaults.appleArchive.promptForPassword).toBe(false);
  });
  it("appleArchive defaults to cleanSource true", () => {
    const prefs = loadAppPreferences(/* mock storage with defaults */);
    expect(prefs.createFormatDefaults.appleArchive.cleanSource).toBe(true);
  });
  ```

---

## Stage 3: Dynamic Password Extension Logic & Create Flow Tests

**Goal:** Add comprehensive tests for the `.aar` ↔ `.aea` extension swap and all create-flow edge cases. This stage confirms the Stage 1 code changes are correct before any UI integration.

**Dependency:** Stage 1 complete (create flow functions updated with `hasPassword` parameter). Stage 2 is NOT required.

**Steps:**

**File: `src/app/createFlow.test.ts`** (add new describe block)

1. Add tests for `withCreateArchiveExtension` with Apple Archive:
   ```ts
   describe("withCreateArchiveExtension - appleArchive", () => {
     it("uses .aar when no password", () => {
       expect(withCreateArchiveExtension("test", "appleArchive", false)).toBe("test.aar");
     });
     it("uses .aea when hasPassword is true", () => {
       expect(withCreateArchiveExtension("test", "appleArchive", true)).toBe("test.aea");
     });
     it("keeps .aar when no password and extension already matches", () => {
       expect(withCreateArchiveExtension("test.aar", "appleArchive", false)).toBe("test.aar");
     });
     it("swaps .aar to .aea when password added", () => {
       expect(withCreateArchiveExtension("test.aar", "appleArchive", true)).toBe("test.aea");
     });
     it("swaps .aea to .aar when password removed", () => {
       expect(withCreateArchiveExtension("test.aea", "appleArchive", false)).toBe("test.aar");
     });
     it("keeps .aea when password present and extension already matches", () => {
       expect(withCreateArchiveExtension("test.aea", "appleArchive", true)).toBe("test.aea");
     });
     it("does not produce double extension (.aea.aea)", () => {
       expect(withCreateArchiveExtension("test.aea", "appleArchive", true)).toBe("test.aea");
     });
     it("defaults hasPassword to false", () => {
       // Backward compat: caller omitting hasPassword gets .aar
       expect(withCreateArchiveExtension("test", "appleArchive")).toBe("test.aar");
     });
   });
   ```

2. Add tests for `getCreateFormatExtension` with Apple Archive:
   ```ts
   describe("getCreateFormatExtension - appleArchive", () => {
     it("returns aar when hasPassword is false", () => {
       expect(getCreateFormatExtension("appleArchive", false)).toBe("aar");
     });
     it("returns aea when hasPassword is true", () => {
       expect(getCreateFormatExtension("appleArchive", true)).toBe("aea");
     });
     it("defaults to aar when hasPassword is omitted", () => {
       expect(getCreateFormatExtension("appleArchive")).toBe("aar");
     });
   });
   ```

3. Add tests for `suggestedCreateArchiveName` with Apple Archive:
   ```ts
   describe("suggestedCreateArchiveName - appleArchive", () => {
     it("suggests .aar extension by default", () => {
       expect(suggestedCreateArchiveName(["/tmp/src"], "appleArchive")).toBe("src.aar");
     });
     it("suggests .aea extension with password", () => {
       expect(suggestedCreateArchiveName(["/tmp/src"], "appleArchive", "archive", true)).toBe("src.aea");
     });
   });
   ```

4. Add tests for `createFormatSupportsPassword`:
   ```ts
   it("appleArchive supports password", () => {
     expect(createFormatSupportsPassword("appleArchive")).toBe(true);
   });
   ```

5. Add tests for `buildStartCreateRequest` with Apple Archive:
   ```ts
   describe("buildStartCreateRequest - appleArchive", () => {
     it("uses .aea extension when password is present", () => {
       const req = buildStartCreateRequest({
         sources: ["/tmp/src"],
         destinationPath: "output.aar",
         format: "appleArchive",
         cleanSource: true,
         replaceExisting: false,
         preserveMetadata: true,
         password: "secret",
       });
       expect(req.destinationPath).toBe("output.aea");
       expect(req.format).toBe("appleArchive");
     });
     it("uses .aar extension when no password", () => {
       const req = buildStartCreateRequest({
         sources: ["/tmp/src"],
         destinationPath: "output",
         format: "appleArchive",
         cleanSource: true,
         replaceExisting: false,
         preserveMetadata: true,
       });
       expect(req.destinationPath).toBe("output.aar");
     });
     it("omits volumeSize for appleArchive format", () => {
       const req = buildStartCreateRequest({
         sources: ["/tmp/src"],
         destinationPath: "output",
         format: "appleArchive",
         cleanSource: true,
         replaceExisting: false,
         preserveMetadata: true,
         volumeSize: 1000000,
       });
       expect(req.volumeSize).toBeUndefined();
     });
   });
   ```

**Verifiable Bar:**
- All new tests pass: `npm run test:frontend -- --reporter=verbose src/app/createFlow.test.ts`
- Coverage for `.aar`/`.aea` swap: no password, with password, extension already correct, swap both directions, no double extension, backward compat default.

---

## Stage 4: Frontend UI, Workspaces & Jobs Integration

**Goal:** Wire UI components and workspace logic to respect platform capabilities and dynamic extensions. Apple Archive must only appear on macOS. The `hasPassword` parameter (added in Stage 1 with default `false`) is now actively passed from UI state.

**Dependency:** Stages 1, 2, 3 complete.

### 4A: Jobs module

**File: `src/app/jobs.ts`**

1. Add `"appleArchiveCreate"` to `isCreateJobKind` (line 65):
   ```ts
   export function isCreateJobKind(kind: JobKind): boolean {
     return (
       kind === "zipCreate" ||
       kind === "sevenZCreate" ||
       kind === "tarZstdCreate" ||
       kind === "tarGzCreate" ||
       kind === "tzapCreate" ||
       kind === "appleArchiveCreate"
     );
   }
   ```
   **Without this, Apple Archive create jobs are treated as extract jobs** — breaking progress display (line 188), compression ratio calculation, and byte-counting logic in `deriveJobProgress` (line 280).

2. Add corresponding tests in `src/app/jobs.test.ts`:
   ```ts
   it("isCreateJobKind returns true for appleArchiveCreate", () => {
     expect(isCreateJobKind("appleArchiveCreate")).toBe(true);
   });
   it("isCreateJobKind returns false for appleArchiveExtract", () => {
     expect(isCreateJobKind("appleArchiveExtract")).toBe(false);
   });
   ```

### 4B: Platform-aware format list helper

**File: `src/app/createFormatCapabilities.ts`** (add at the bottom)

3. Add a centralized helper for filtering formats by platform:
   ```ts
   const ALL_CREATE_FORMATS: CreateArchiveFormat[] = ["zip", "tarZst", "tzap", "sevenZ", "tarGz", "appleArchive"];

   export function supportedCreateFormats(appleArchiveAvailable: boolean): CreateArchiveFormat[] {
     if (appleArchiveAvailable) return ALL_CREATE_FORMATS;
     return ALL_CREATE_FORMATS.filter((f) => f !== "appleArchive");
   }
   ```
   This is the **single source of truth** for which formats appear in UI. Every dropdown and selector that lists formats must use this function. Obtain `appleArchiveAvailable` from the capability snapshot where available; fall back to a platform check only at the initial call site where the capability value is resolved.

### 4C: Create workspace (app layer)

**File: `src/app/workspaces/createWorkspace.ts`**

4. The `changeFormat` mutation (around line 733) already calls `withCreateArchiveExtension`. Update it to pass the current password state:
   ```ts
   nextOptions.destinationPath = withCreateArchiveExtension(
     currentPath,
     newFormat,
     Boolean(password),  // was: only 2 args, now passes hasPassword
   );
   ```

5. Update `suggestedCreateArchiveName` calls (lines 516, 1408, 1423) — no changes needed unless the source has a password at creation time. For initial archive naming, `hasPassword` defaults to `false` (correct — password hasn't been set yet).

6. Verify `applyDefaultsToOptions` (around line 1285): No new format-specific case needed for `appleArchive`. It only has special branches for `zip`, `tzap`, and `sevenZ`. `appleArchive` falls through to the generic path, which is correct.

### 4D: Create workspace (UI layer)

**File: `src/ui/react/create/CreateWorkspace.tsx`**

7. In the format dropdown (around line 948), use `supportedCreateFormats(appleArchiveAvailable)` to generate the option list. Obtain `appleArchiveAvailable` from the workspace state or a platform capability context.

8. Add a `useEffect` that watches both `format` and `password`. When `format === "appleArchive"` and the password toggles between empty and non-empty, update the destination path via the workspace's path mutation to swap `.aar` ↔ `.aea`.

### 4E: Preferences dialog

**File: `src/ui/react/preferences/PreferencesDialog.tsx`**

9. In the `FormatSelect` component (around line 1497), use `supportedCreateFormats(appleArchiveAvailable)` to conditionally include `<option value="appleArchive">Apple Archive (.aar / .aea)</option>`.

### 4F: Jobs surfaces

**File: `src/ui/react/jobs/JobsSurfaces.tsx`**

10. **Already done** — `case "appleArchiveCreate":` (line 870) and `case "appleArchiveExtract":` (line 877) exist. Verify they render correctly with the existing i18n keys. No code change needed.

**Verifiable Bar:**
- `npm run build` passes.
- `npm run test:frontend` passes (including `createWorkspace.test.ts`, `jobs.test.ts`, `preferences.test.ts`).
- Manual verification (macOS): Create Workspace shows "Apple Archive (.aar / .aea)" in format dropdown. Type password → extension changes to `.aea`. Clear password → reverts to `.aar`.

---

## Stage 5: Quick Actions and OS Context Menus

**Goal:** Route `compressAppleArchive` through the quick action system and prove it never leaks to Windows/Linux context menus.

**Dependency:** Stage 1 (generated contracts include `compressAppleArchive`), Stage 4.

### 5A: Quick action routing

**File: `src/app/quickActions.ts`**

1. Add a case in `runQuickActionRequest` (after the `compressTarGz` case, around line 226):
   ```ts
   case "compressAppleArchive":
     await handlers.startCreate(
       request.paths,
       "appleArchive",
       createDefaultsForFormat(preferences, "appleArchive").cleanSource,
     );
     break;
   ```
   The destination is always `.aar` at quick-action time (the user hasn't typed a password yet). The extension swap happens later in the Create Workspace if the user adds a password. The existing `quickCreateDestination` function calls `withCreateArchiveExtension` and `suggestedCreateArchiveName` without `hasPassword` — they default to `false`, producing `.aar`. This is correct.

### 5B: Quick action controller test

**File: `src/app/controllers/quickActionController.test.ts`**

2. Add a test entry for `compressAppleArchive` (following the pattern at line 279):
   ```ts
   { format: "appleArchive", kind: "compressAppleArchive" },
   ```

### 5C: Context menu tests — verify Linux exclusion

**File: `src/app/linuxContextMenuScript.test.ts`**

3. Add a test assertion that `compressAppleArchive` / `AddToAar` does NOT appear in the generated Linux context menu payload.

### 5D: Context menu tests — verify Windows exclusion

**File: `src/app/windowsContextMenuScript.test.ts`**

4. Add a test assertion that `compressAppleArchive` / `AddToAar` does NOT appear in the generated Windows context menu payload.

### 5E: Context menu model

**File: `src/app/commands/contextMenuModel.ts`** (and its test file)

5. Add a test confirming that actions with `nativeSurfaces: ["macosFinder"]` are excluded from Linux and Windows context menus. Since `compressAppleArchive` uses this surface restriction, the filter should be automatic — the test proves it works.

**Verifiable Bar:**
- `npm run test:frontend` — specifically:
  - `quickActionController.test.ts`: `compressAppleArchive` maps to `startCreate` with `"appleArchive"`.
  - `linuxContextMenuScript.test.ts`: `compressAppleArchive` is absent.
  - `windowsContextMenuScript.test.ts`: `compressAppleArchive` is absent.
  - `contextMenuModel.test.ts`: `nativeSurfaces` filter excludes `macosFinder`-only actions on non-macOS.
- Manual verification (macOS): Right-click a file in Finder → ZManager submenu shows "Add to .aar".

---

## Stage 6: Backend Rust Implementation & OS Linkage

**Goal:** Integrate `AppleArchive` into Rust DTOs, enums, command handlers, and archive family detection, with strict `#[cfg]` platform gating.

**Dependency:** Stages 1–5 complete. Stage 0 item 3 confirmed (`zmanager-core` exports exist).

**Important:** All function names and struct fields in this stage are **conjectural** — they follow the naming pattern of existing formats (e.g., `run_tar_gz_create_job_from_sources_with_plan_options`, `TarGzCreateOptions`, `TarGzCreateReport`). Verify the actual `zmanager_core::apple_archive_backend` API before writing code.

### 6A: DTOs

**File: `src-tauri/src/dto.rs`**

1. Add `AppleArchive` variant to `ArchiveFormatDto` (line 270):
   ```rust
   #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
   #[serde(rename_all = "camelCase")]
   pub enum ArchiveFormatDto {
       Zip,
       TarZst,
       TarGz,
       Tzap,
       SevenZ,
       AppleArchive,
   }
   ```

**File: `src-tauri/src/job_dto.rs`**

2. **Already done**: `AppleArchiveCreate` and `AppleArchiveExtract` are already in `JobKindDto` (lines 94-95). No change needed.

### 6B: Archive family detection

**File: `src-tauri/src/commands.rs`**

3. Add `AppleArchive` to the `ArchiveFamily` enum (line 2641):
   ```rust
   enum ArchiveFamily {
       Zip,
       TarZst,
       SevenZ,
       Rar,
       Tzap,
       AppleArchive,
       Archive,
   }
   ```

4. Update `detect_archive_family` (line 2650) to detect `.aar` and `.aea` BEFORE the `stem` extraction (to avoid unused-variable warnings from the early return):
   ```rust
   fn detect_archive_family(path: &str) -> ArchiveFamily {
       let path = Path::new(path);
       let extension = path
           .extension()
           .and_then(|value| value.to_str())
           .map(|value| value.to_ascii_lowercase());

       // Apple Archive detection (macOS-only format)
       // Check BEFORE stem extraction to avoid unused-variable warning on early return
       if matches!(extension.as_deref(), Some("aar") | Some("aea")) {
           return ArchiveFamily::AppleArchive;
       }

       let stem = path
           .file_stem()
           .and_then(|value| value.to_str())
           .map(|value| value.to_ascii_lowercase());
       // ... rest of existing detection logic unchanged ...
   }
   ```

### 6C: Create command

**File: `src-tauri/src/commands.rs`**

5. Update `create_progress_estimate_for_format` (line 364) to include `AppleArchive`:
   ```rust
   crate::dto::ArchiveFormatDto::Zip
   | crate::dto::ArchiveFormatDto::TarZst
   | crate::dto::ArchiveFormatDto::TarGz
   | crate::dto::ArchiveFormatDto::SevenZ
   | crate::dto::ArchiveFormatDto::AppleArchive => manifest.included_count(),
   ```

6. Update `start_create_internal` format→kind mapping (line 443):
   ```rust
   crate::dto::ArchiveFormatDto::AppleArchive => JobKindDto::AppleArchiveCreate,
   ```

7. Add the create thread match arm (after the `SevenZ` arm, around line 708). The non-macOS block must consume all moved (non-Copy) values to satisfy Rust's ownership rules:
   ```rust
   crate::dto::ArchiveFormatDto::AppleArchive => {
       #[cfg(target_os = "macos")]
       {
           let level = compression_level
               .and_then(|value| i32::try_from(value).ok())
               .unwrap_or(3); // Verify actual default in zmanager-core
           let create_options = zmanager_core::apple_archive_backend::AppleArchiveCreateOptions {
               level,
               preserve_metadata,
               replace_existing,
               password: password.as_deref().map(SecretString::from),
           };
           zmanager_core::apple_archive_backend::run_apple_archive_create_job_from_sources_with_plan_options(
               &request_sources,
               &destination,
               &create_options,
               &plan_options,
               &token,
               &mut sink,
           )
           .map(to_terminal_summary_for_apple_archive_create)
           .map_err(map_apple_archive_error)
       }
       #[cfg(not(target_os = "macos"))]
       {
           // Suppress unused variable warnings: consume all moved (non-Copy) values,
           // and reference Copy values so they are "used" on this platform.
           let _ = (&request_sources, &destination, &plan_options, &token);
           let _ = (compression_level, &password);
           Err(CommandErrorDto::unsupported_format(
               "Apple Archive format (.aar / .aea) is only supported on macOS",
           ))
       }
   }
   ```
   **Rust note:** `request_sources` (`Vec<String>`), `destination` (`String`), `plan_options` (`PlanOptions`), `token` (`CancellationToken`), and `password` (`Option<String>`) are all non-Copy. The macOS block moves them; the non-macOS block must also consume them (the `let _ = (...)` pattern). `compression_level`, `preserve_metadata`, `replace_existing` are `Copy` types — just referencing them is sufficient.

### 6D: Extract command

**File: `src-tauri/src/commands.rs`**

8. Update the family→kind mapping in `start_extract_internal` (line 925):
   ```rust
   ArchiveFamily::AppleArchive => JobKindDto::AppleArchiveExtract,
   ```

9. Add the extract thread match arm (after the `ArchiveFamily::Archive` arm, around line 1035). The extract path has two sub-paths: full extraction (`entry_paths.is_empty()`) and selected-entry extraction (via `run_selected_extract_job`). The selected-entry path passes `kind` as a parameter (line 1056) — it automatically gets `JobKindDto::AppleArchiveExtract` from the mapping above, so no additional change is needed. Only the full-extraction match needs a new arm:
   ```rust
   ArchiveFamily::AppleArchive => {
       #[cfg(target_os = "macos")]
       {
           run_apple_archive_extract_job_with_password_and_policy(
               &archive_path,
               &destination_path,
               password.as_deref(),
               policy,
               &token,
               &mut sink,
           )
           .map(to_terminal_summary_for_extract)
           .map_err(map_apple_archive_error)
       }
       #[cfg(not(target_os = "macos"))]
       {
           let _ = (&archive_path, &destination_path, &password, &token);
           Err(CommandErrorDto::unsupported_format(
               "Apple Archive format (.aar / .aea) is only supported on macOS",
           ))
       }
   }
   ```

10. **No changes needed to `run_selected_extract_job`** (line 1307). It accepts `kind: JobKindDto` as a parameter and is format-agnostic. The caller already passes the correct `kind` from the family→kind mapping.

### 6E: Terminal summary mapping

**File: `src-tauri/src/commands.rs`**

11. Add `to_terminal_summary_for_apple_archive_create` function, following the pattern of `to_terminal_summary_for_tar_gz_create` (around line 2370). The exact implementation depends on the create report type returned by `zmanager-core`. Template:
    ```rust
    fn to_terminal_summary_for_apple_archive_create(
        report: zmanager_core::apple_archive_backend::AppleArchiveCreateReport,
    ) -> JobTerminalSummaryDto {
        JobTerminalSummaryDto {
            written_entries: report.written_entries,
            skipped_entries: None,
            written_bytes: report.written_bytes,
            warnings: report.warnings,
        }
    }
    ```

### 6F: Job registry and quick action

**File: `src-tauri/src/job_registry.rs`**

12. Verify that `JobKindDto::AppleArchiveCreate` and `JobKindDto::AppleArchiveExtract` flow through the existing registry logic. The registry is generic over `JobKindDto` — no changes expected.

**File: `src-tauri/src/quick_action.rs`**

13. Verify that `CompressAppleArchive` is parsed correctly by `zmanager_shell_contract::ShellActionKind` after contract regeneration. The existing `validate_request` function handles all `Compress*` actions generically — no changes expected.

### 6G: Rust unit tests

14. Add tests in the `#[cfg(test)] mod tests` block (line 2699):
    ```rust
    #[test]
    fn apple_archive_format_serializes_correctly() {
        let format = crate::dto::ArchiveFormatDto::AppleArchive;
        let json = serde_json::to_string(&format).unwrap();
        assert_eq!(json, "\"appleArchive\"");
    }

    #[test]
    fn detect_archive_family_recognizes_aar() {
        assert_eq!(detect_archive_family("test.aar"), ArchiveFamily::AppleArchive);
    }

    #[test]
    fn detect_archive_family_recognizes_aea() {
        assert_eq!(detect_archive_family("test.aea"), ArchiveFamily::AppleArchive);
    }
    ```

**Verifiable Bar:**
- `cd src-tauri && cargo check` passes on macOS.
- `cd src-tauri && cargo test` passes (including new Apple Archive tests).
- Cross-compilation check (if CI supports it): `cargo check --target x86_64-pc-windows-msvc` does not fail due to Apple Archive linkage (the `#[cfg]` gates ensure this).
- `cd src-tauri && cargo fmt` passes.

---

## Stage 7: Verify Generated Contracts (Post-Implementation)

**Goal:** Confirm that the generated contracts from Stage 1 (step 17) are still consistent with all code changes made in Stages 2–6. If any manifest was edited after Stage 1, regenerate now.

**Steps:**

1. Run the contract generator again to ensure idempotency:
   ```bash
   node scripts/generate-native-contracts.mjs
   ```

2. Verify generated files are unchanged from Stage 1 (i.e., no manual edits to generated files were made during Stages 2–6):
   ```bash
   git diff src/api/generated/ src-tauri/src/generated/
   ```

3. If manifests were edited after Stage 1 (e.g., tweaking shell action order), the diff will show the expected delta. Review and commit.

**Verifiable Bar:**
- `npm run build` passes after any regeneration.
- `git status` shows only expected changes in generated files.

---

## Stage 8: Apple Archive Column Support (Table View)

**Goal:** Once Apple Archive browsing is wired (Stage 6), enhance the table columns
to show all available per-entry metadata from the format.

**Reference:** `docs/IMPROVE_COLUMN_SUPPORT_MATRIX_IMPLEMNTATION_PLAN.md` — the
master column implementation plan. Apple Archive column tasks are Phase 5B of that
plan and are **zmanager-core only** (no upstream changes needed).

### Verified Apple Archive field keys (from `aa` tool + SDK headers)

Apple's native `aa archive` command writes **11 field keys by default**. Every entry
header in an `.aar`/`.aea` file can carry any combination of these keys. The
field key set is controlled by `-include-field` / `-exclude-field` flags.

| Key | Type | Default? | Our `EntryMetadata` | Column |
|---|---|---|---|---|
| TYP | uint | Always | ✅ (via `kind()`) | kind |
| PAT | string | Always | ✅ (via `path()`) | name |
| LNK | string | For symlinks | ✅ (via `link_target()`) | linkTarget |
| SIZ | uint | Opt-in (`-include-field siz`) | ✅ (via `size()`) | size |
| MOD | uint | **Always** | ✅ | mode |
| UID | uint | **Always** | ❌ not read | uid |
| GID | uint | **Always** | ❌ not read | gid |
| MTM | timespec | **Always** | ✅ | modified |
| CTM | timespec | **Always** | **❌ not read** | **created** |
| FLG | uint | **Always** | **❌ not read** | **attributes** |
| CKS | uint | Opt-in (`-include-field cks`) | **❌ not read** | **crc** |
| DAT | blob | For files | ✅ (internal) | — |
| DEV | uint | For devices | ❌ not read | — |
| XAT | blob | **Always** | ❌ not read | — (binary key-value blobs) |
| SH1/SH2/SH3/SH5 | blob | Opt-in | ❌ not read | — (too heavy for listing) |
| BTM | timespec | Opt-in | ❌ not read | — (backup time) |
| ACL | blob | Opt-in | ❌ not read | — (access control list) |

**Key findings from real archive inspection:**

- **CTM (creation time)** is **always written by default** by `aa archive`.
  There is NO access time (ATM) field — Apple deliberately excludes atime.
- **FLG (BSD/macOS file flags)** is always written — maps to `attributes` column.
- **CKS (CRC32)** is opt-in, but trivially available if the archive includes it.
- **XAT (extended attributes)** is always written but stores binary key-value
  blobs (quarantine flags, Finder info, resource forks) — not suitable for a
  single table cell value. Skip for columns.

### Apple Archive column availability (after Phase 5B)

| Column | Status | Notes |
|---|---|---|
| name | ✅ | PAT — always present |
| size | ✅ | SIZ — opt-in; reads `data_size()` as fallback |
| modified | ✅ | MTM — timespec, sub-second precision, always present |
| mode | 🔧 | MOD — always present, `EntryMetadata.mode`, not wired |
| encrypted | 🔧 | Archive-level: `.aea` path or native stream check |
| method | 🔧 | Archive-level: `CompressionAlgorithm` enum |
| crc | 🔧 | CKS — opt-in 32-bit POSIX CRC, not wired |
| created | 🔧 | CTM — **always present**, timespec, not wired |
| attributes | 🔧 | FLG — **always present**, BSD flags uint, not wired |
| linkTarget | 🔧 | LNK — present for symlinks, `Entry.link_target()`, not wired |
| uid | 🔧 | UID — **always present**, uint, not wired |
| gid | 🔧 | GID — **always present**, uint, not wired |
| kind | ✅ | TYP — always present |
| compressedSize | ❌ | Not exposed |
| accessed | ❌ | **No ATM field in Apple Archive format** |
| owner | ❌ | No user name field (numeric UID only) |
| group | ❌ | No group name field (numeric GID only) |

### Implementation tasks (Phase 5B of column plan)

**Step 1 — Extend `EntryMetadata`** (`zmanager-apple-archive/src/lib.rs`):
```rust
pub struct EntryMetadata {
    pub mode: Option<u32>,
    pub modified: Option<SystemTime>,
    pub created: Option<SystemTime>,   // CTM field
    pub flags: Option<u32>,            // FLG field
    pub crc: Option<u32>,              // CKS field
    pub uid: Option<u32>,              // UID field
    pub gid: Option<u32>,              // GID field
}
```

**Step 2 — Read in `Header::to_entry()`** (same file):
Add `timespec_for_key(b"CTM")`, `uint_for_key(b"FLG")`, `uint_for_key(b"CKS")`,
`uint_for_key(b"UID")`, `uint_for_key(b"GID")`.

**Step 3 — Thread through `AppleArchiveListEntry`** (`apple_archive_backend.rs`):
Add `mode`, `created`, `flags`, `crc`, `uid`, `gid`, `link_target` fields.

**Step 4 — Thread through `BrowserEntry`** (`archive_browser.rs`):
Map new fields + `encrypted` (from path) + `method` (from compression algo).

**Effort:** ~35 lines across 3 crates.

### Per-format column filtering

Once wired, Apple Archive's format keys (`aar` and `aea`) show:
```
aar: ["name","size","modified","mode","encrypted","method","crc","created","linkTarget","attributes","uid","gid","kind"]
aea: ["name","size","modified","mode","encrypted","method","crc","created","linkTarget","attributes","uid","gid","kind"]
```

---

## Stage 9: Final Verification & Testing

**Goal:** Prove all changes are correct via automated and manual testing.

### Automated Checkpoints

1. **`npm run build`** — Strict TypeScript build passes without errors.
2. **`npm run test:frontend`** — All tests pass, including:
   - `createFlow.test.ts` — `.aar` ↔ `.aea` swap, password support, volume exclusion, backward compat.
   - `createFormatCapabilities.test.ts` — `appleArchive` capabilities: `password: true`, `splitVolumes: false`.
   - `preferences.test.ts` — `appleArchive` in create format defaults.
   - `jobs.test.ts` — `isCreateJobKind("appleArchiveCreate")` is `true`, `isCreateJobKind("appleArchiveExtract")` is `false`.
   - `quickActions.test.ts` — `compressAppleArchive` routes to `startCreate` with `"appleArchive"`.
   - `quickActionController.test.ts` — `{ format: "appleArchive", kind: "compressAppleArchive" }` entry passes.
   - `linuxContextMenuScript.test.ts` — `compressAppleArchive` is absent from Linux context menu.
   - `windowsContextMenuScript.test.ts` — `compressAppleArchive` is absent from Windows context menu.
   - `contextMenuModel.test.ts` — `nativeSurfaces` filter excludes `macosFinder`-only actions on non-macOS.
   - `archiveFileTypes.test.ts` — `.aar` and `.aea` recognized by `isSupportedArchivePath`.
3. **`cd src-tauri && cargo test`** — Rust tests pass, including `detect_archive_family` tests and serialization tests.
4. **`cd src-tauri && cargo fmt`** — Code is formatted.
5. **`npm run test:architecture`** — Architecture guardrails pass.

### Manual Verification (macOS only)

1. Run `npm run tauri dev`.
2. **Create Flow:**
   - Open Create Workspace. "Apple Archive (.aar / .aea)" is in the format dropdown.
   - Enter name `test`. Extension becomes `test.aar`.
   - Add a password → extension updates to `test.aea`.
   - Delete password → extension reverts to `test.aar`.
   - Manually type `test.aea` → add password → stays `test.aea` (no double extension).
   - Manually type `test.aar` → delete password → stays `test.aar`.
3. **Context Menu:** Right-click a file in Finder → ZManager submenu shows "Add to .aar".
4. **Execution (unencrypted):** Create a small `.aar` archive. Verify the job completes. Extract it and verify contents match.
5. **Execution (encrypted):** Create with password → produces `.aea`. Extract with correct password → succeeds. Extract with wrong password → shows password error.
6. **Browsing:** Open an existing `.aar` file → entries listed correctly. Open `.aea` with password → password prompt → entries listed.
7. **Preferences:** "Apple Archive (.aar / .aea)" is in the Default Format dropdown on macOS.
8. **Jobs panel:** Apple Archive create jobs show the correct icon and label.

### Cross-Platform Verification (Windows/Linux)

9. On a non-macOS build:
   - Apple Archive does NOT appear in Create Workspace format dropdown.
   - Apple Archive does NOT appear in Preferences default format dropdown.
   - Context menus do NOT include "Add to .aar".
   - Sending `start_create` with `format: "appleArchive"` returns `unsupported_format` error.

---

## Complete File Checklist (Punch List)

Derived from tracing every file the `tarGz` format touches.

| # | File | Action | Stage |
|---|---|---|---|
| 1 | `manifests/archive-file-types.json` | Add `aar`/`aea` to extensions, associationTypes, documentGroups | 1 |
| 2 | `manifests/shell-actions.json` | Add `compressAppleArchive` action | 1 |
| 3 | `src/api/types.ts` | Add `"appleArchive"` to `StartCreateRequest["format"]` union (line 255) | 1 |
| 4 | `src/app/createFlow.ts` | Add to 4 constants + `hasPassword` param to `getCreateFormatExtension`, `withCreateArchiveExtension`, `suggestedCreateArchiveName` + volume guard in `buildStartCreateRequest` | 1 |
| 5 | `src/app/createFormatCapabilities.ts` | Add `appleArchive` to `CAPABILITIES` record + add `supportedCreateFormats` helper | 1, 4 |
| 6 | `src/app/i18n/messages.en.ts` | Add `shellAction`, `format`, `create.preserveMetadata` keys (do NOT duplicate existing `jobs.kind.*` keys) | 1 |
| 7 | `src/app/i18n/messages.zh-CN.ts` | Add Chinese equivalents of above | 1 |
| 8 | `scripts/generate-native-contracts.mjs` | Run to regenerate contracts after manifest changes | 1 |
| 9 | `src/app/generated/` + `src-tauri/src/generated/` | Verify regenerated output includes `compressAppleArchive`, `aar`/`aea` | 1, 7 |
| 10 | `src/app/preferences.ts` | Add `"appleArchive"` to `ARCHIVE_FORMATS` + `DEFAULT_APP_PREFERENCES.createFormatDefaults` | 2 |
| 11 | `src/app/preferences.test.ts` | Add tests for appleArchive in defaults | 2 |
| 12 | `src/app/createFlow.test.ts` | Add 12+ tests: `.aar`↔`.aea` swap, password support, volume exclusion, backward compat | 3 |
| 13 | `src/app/jobs.ts` | Add `"appleArchiveCreate"` to `isCreateJobKind` | 4 |
| 14 | `src/app/jobs.test.ts` | Add `isCreateJobKind` tests for appleArchive | 4 |
| 15 | `src/app/workspaces/createWorkspace.ts` | Wire `hasPassword` through `changeFormat` | 4 |
| 16 | `src/ui/react/create/CreateWorkspace.tsx` | Conditionally render appleArchive in format dropdown; useEffect for password→extension sync | 4 |
| 17 | `src/ui/react/preferences/PreferencesDialog.tsx` | Conditionally render appleArchive in default format dropdown | 4 |
| 18 | `src/app/quickActions.ts` | Add `case "compressAppleArchive"` to `runQuickActionRequest` | 5 |
| 19 | `src/app/quickActions.test.ts` | Add test for `compressAppleArchive` routing | 5 |
| 20 | `src/app/controllers/quickActionController.test.ts` | Add `{ format: "appleArchive", kind: "compressAppleArchive" }` test entry | 5 |
| 21 | `src/app/linuxContextMenuScript.test.ts` | Assert `compressAppleArchive` is absent from Linux context menu | 5 |
| 22 | `src/app/windowsContextMenuScript.test.ts` | Assert `compressAppleArchive` is absent from Windows context menu | 5 |
| 23 | `src/app/commands/contextMenuModel.test.ts` | Assert `nativeSurfaces` filter excludes `macosFinder`-only actions | 5 |
| 24 | `src-tauri/src/dto.rs` | Add `AppleArchive` to `ArchiveFormatDto` | 6 |
| 25 | `src-tauri/src/commands.rs` | Add `ArchiveFamily::AppleArchive`; update `detect_archive_family`, `create_progress_estimate_for_format`, `start_create_internal` (kind + `#[cfg]` thread spawn), `start_extract_internal` (kind + `#[cfg]` thread spawn), `to_terminal_summary_for_apple_archive_create`; add 3 Rust unit tests | 6 |
| 26 | `docs/APPLE_ARCHIVE_SUPPORT_PLAN.md` | Update with as-built notes after implementation | 8 |

**Files that already have Apple Archive fragments (verify only — do not re-add):**

| # | File | Existing Content |
|---|---|---|
| A | `src/api/types.ts` (lines 554-555) | `JobKind` includes `"appleArchiveCreate"` / `"appleArchiveExtract"` |
| B | `src/app/i18n/messages.en.ts` (lines 378-379) | `jobs.kind.appleArchiveCreate` / `jobs.kind.appleArchiveExtract` |
| C | `src/app/i18n/messages.zh-CN.ts` (lines 259-260) | Chinese equivalents of above |
| D | `src/ui/react/jobs/JobsSurfaces.tsx` (lines 870, 877) | `case "appleArchiveCreate":` / `case "appleArchiveExtract":` |
| E | `src-tauri/src/job_dto.rs` (lines 94-95) | `JobKindDto::AppleArchiveCreate` / `JobKindDto::AppleArchiveExtract` |
| F | `src-tauri/src/commands.rs` (line 44) | `use zmanager_core::apple_archive_backend::AppleArchiveError` |
| G | `src-tauri/src/commands.rs` (line 1691) | `ArchiveBrowserError::AppleArchive` in error mapping |
| H | `src-tauri/src/commands.rs` (line 1837) | `fn map_apple_archive_error()` |

**Files explicitly verified as NOT needing changes:**

| File | Reason |
|---|---|
| `src/app/volumeSizePresets.ts` | Apple Archive does not support split volumes |
| `src-tauri/src/job_registry.rs` | Generic over `JobKindDto` — no format-specific logic |
| `src-tauri/src/quick_action.rs` | `CompressAppleArchive` handled by existing generic `Compress*` pattern |
| `src/app/extractFlow.ts` | Extraction is format-agnostic at the TypeScript level |

---

## Open Questions / Design Decisions to Finalize

1. **`zmanager-core` function names**: The actual public API of `zmanager_core::apple_archive_backend` must be verified before writing Stage 6. The names used in this plan (`run_apple_archive_create_job_from_sources_with_plan_options`, `AppleArchiveCreateOptions`, `AppleArchiveCreateReport`, `run_apple_archive_extract_job_with_password_and_policy`) are conjectural, following the naming convention of existing formats. If any of these don't exist yet, a `zmanager-core` prerequisite issue must be resolved first.

2. **`NativeCapabilitySnapshot` integration depth**: The plan uses a centralized `supportedCreateFormats(appleArchiveAvailable)` helper with a boolean flag. The source of that boolean should eventually be `NativeCapabilitySnapshot.appleArchiveAvailable`, but the initial implementation can derive it from the platform at a single call site. The key constraint: the check lives in exactly one place; UI components never check the platform string directly.

3. **Browsing/listing of `.aea` (encrypted)**: Does `zmanager-core`'s Apple Archive backend support listing entries in an encrypted `.aea` without a password? If not, the frontend must show a password prompt before the listing request, which affects the archive index/listing flow. This may require frontend work beyond what this plan covers. Verify during Stage 0.

4. **Apple Archive compression level range**: What is the valid range for Apple Archive compression levels? The answer determines the compression slider min/max/step in the Create Workspace UI. Until confirmed, use the same range as `tarZst`/`tarGz` (whatever `zmanager-core` defines as its default).
