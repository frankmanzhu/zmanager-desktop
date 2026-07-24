# Apple Archive (`.aar` / `.aea`) macOS Support Implementation Plan

## Executive Summary

Apple Archive (`.aar` unencrypted / `.aea` encrypted) is Apple's high-performance native archive format introduced in macOS Big Sur. While `zmanager-core` includes full Apple Archive support via macOS system framework linkage (`libAppleArchive`), ZManager Desktop's GUI and platform contract layer currently lack support for this format.

Because Apple Archive relies on macOS-native system libraries, **Apple Archive creation and extraction are available exclusively on macOS builds**. Windows and Linux builds lack linkage for Apple Archive. Therefore, this feature must be strictly platform-gated across all UI controls, context menus, quick actions, preference selectors, and backend Rust DTO handlers.

This plan is broken down into specific, actionable stages for an agent to implement systematically. Do not proceed to the next stage until the current stage is fully verified and committed.

---

## Architectural Principles & Platform Gating

1. **Platform Isolation**:
   - **macOS**: Full support for `.aar` (unencrypted) and `.aea` (encrypted) browsing, creation, extraction, quick actions, context menus, and file associations.
   - **Windows / Linux**: Apple Archive is hidden from archive creation format dropdowns, preference default format selectors, and context menus. If an API request for `appleArchive` is received on non-macOS platforms, the Rust backend safely returns `CommandErrorDto::unsupported_format`.
2. **Dynamic Extension Switching (`.aar` vs `.aea`)**:
   - Plain Apple Archive uses extension `.aar`.
   - Encrypted Apple Archive (when password protection is enabled) uses extension `.aea`.
   - When the user selects Apple Archive as the creation format:
     - Adding a password automatically transforms the target extension from `.aar` to `.aea`.
     - Clearing the password automatically transforms the target extension back from `.aea` to `.aar`.

---

## Stage 1: Contract Manifests and Frontend Types

**Goal:** Define the Apple Archive format in the central manifests and TypeScript types.

**Steps:**
1. **Update `manifests/archive-file-types.json`:**
   - Add `"aar"` and `"aea"` to `singleExtensions`.
   - Add `appleArchive` to `associationTypes`:
     ```json
     {
       "id": "appleArchive",
       "primaryExtensions": ["aar", "aea"],
       "compoundExtensions": [],
       "splitSuffixes": [],
       "mimeType": "application/x-apple-archive",
       "mimeAliases": [],
       "windows": false,
       "linux": false,
       "macos": true
     }
     ```
   - Add `"aar"` and `"aea"` to the `archives` group under `documentGroups`.

2. **Update `manifests/shell-actions.json`:**
   - Add `compressAppleArchive` shell action for macOS Finder context menu:
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

3. **Update `src/api/types.ts`:**
   - Update `StartCreateRequest["format"]` union to include `"appleArchive"`:
     ```ts
     export type CreateArchiveFormat = "zip" | "tarZst" | "tzap" | "sevenZ" | "tarGz" | "appleArchive";
     ```

4. **Update `src/app/createFormatCapabilities.ts`:**
   - Add `appleArchive` format capabilities:
     ```ts
     appleArchive: Object.freeze({
       password: true, // Supported via .aea format switch
       splitVolumes: false,
       compressionLevel: true,
       zipCompression: false,
       tzapRecovery: false,
       tzapVolumeLossTolerance: false,
       sevenZAdvanced: false,
     }),
     ```
   - Add a new exported helper function `supportedCreateFormats(platform: string): CreateArchiveFormat[]`:
     - This function should return `["zip", "tarZst", "tzap", "sevenZ", "tarGz", "appleArchive"]` if `platform === "macos"`.
     - Otherwise, it should return `["zip", "tarZst", "tzap", "sevenZ", "tarGz"]`.

---

## Stage 2: User Preferences and i18n

**Goal:** Register Apple Archive in user preferences, provide default settings, and add localization keys.

**Steps:**
1. **Update `src/app/preferences.ts`:**
   - Include `"appleArchive"` in `ARCHIVE_FORMATS` array.
   - Add `appleArchive` default creation options to `DEFAULT_APP_PREFERENCES.createFormatDefaults`:
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
     }
     ```
   - In the preference normalization logic (e.g., `normalizePreferences`), ensure that if `defaultArchiveFormat` is `"appleArchive"` and the current platform is NOT macOS, it falls back to `"tarZst"`.

2. **Update `src/app/i18n/messages.en.ts` and `messages.zh-CN.ts`:**
   - Add localized string keys:
     - `shellAction.compressAppleArchive`: "Add to .aar" / "添加到 .aar"
     - `format.appleArchive`: "Apple Archive (.aar / .aea)" / "Apple Archive (.aar / .aea)"

---

## Stage 3: Dynamic Password Extension Logic (`.aar` <-> `.aea`)

**Goal:** Ensure the application correctly handles the file extension swap based on password presence.

**Steps:**
1. **Update `src/app/createFlow.ts`:**
   - Update `CREATE_FORMAT_EXTENSIONS` to map `appleArchive` to `"aar"`.
   - Update `CREATE_FORMAT_ALLOWED_EXTENSIONS` to map `appleArchive` to `["aar", "aea"]`.
   - Ensure `RECOGNIZED_CREATE_EXTENSIONS` includes `"aar"` and `"aea"`.
   - Ensure `CREATE_PASSWORD_FORMATS` includes `"appleArchive"`.
   - Update `getCreateFormatExtension(format: CreateArchiveFormat, hasPassword = false): string` to return `"aea"` if `format === "appleArchive"` and `hasPassword` is true.
   - Update `withCreateArchiveExtension(path: string, format: CreateArchiveFormat, hasPassword = false): string` to respect the `hasPassword` parameter.

---

## Stage 4: Frontend UI & Workspace Integration

**Goal:** Wire the UI components and workspace logic to respect platform limits and dynamic extensions.

**Steps:**
1. **Update `src/app/workspaces/createWorkspace.ts`:**
   - Ensure the format selector dropdown items are populated dynamically by calling `supportedCreateFormats(platform)`.
   - Ensure the `changeFormat` mutation allows accepting a `hasPassword` flag so that if a user already has a password typed and switches the format to Apple Archive, the initial extension is correctly set to `.aea`.

2. **Update `src/ui/react/create/CreateWorkspace.tsx`:**
   - Verify that the `Select` or dropdown component for the format uses the localized label for `appleArchive`.
   - Ensure the dropdown only displays `appleArchive` if it is present in the supported formats list.
   - Add a `useEffect` that listens to `format` (from snapshot options) and `password` (from `useCreatePasswordState()`). If the format is `"appleArchive"`, and the password state changes between empty and non-empty, automatically call `zmanager.create.setOptions({ destinationPath: ... })` with the correctly swapped extension (`.aea` or `.aar`). *(Note: We must use the React component for this effect because passwords are kept out of the durable workspace snapshot for security).*

3. **Update `src/ui/react/preferences/PreferencesDialog.tsx`:**
   - Filter the default archive format options dropdown using `supportedCreateFormats(currentPlatform)`. On non-macOS systems, `appleArchive` must be completely omitted from the dropdown.

---

## Stage 5: Quick Actions

**Goal:** Route the new `compressAppleArchive` shell action.

**Steps:**
1. **Update `src/app/quickActions.ts`:**
   - Add a case for `compressAppleArchive` in `runQuickActionRequest` (or the equivalent handler):
     ```ts
     case "compressAppleArchive":
       await handlers.startCreate(
         request.paths,
         "appleArchive",
         createDefaultsForFormat(preferences, "appleArchive").cleanSource,
       );
       break;
     ```

---

## Stage 6: Backend Rust Implementation & OS Linkage

**Goal:** Ensure the backend Rust application recognizes the new enum variant, builds the job for macOS, and firmly rejects it on other platforms.

**Steps:**
1. **Update `src-tauri/src/dto.rs`:**
   - Add `AppleArchive` variant to `ArchiveFormatDto`:
     ```rust
     pub enum ArchiveFormatDto {
         Zip,
         TarZst,
         TarGz,
         Tzap,
         SevenZ,
         AppleArchive,
     }
     ```

2. **Update `src-tauri/src/commands.rs`:**
   - In the handler `start_create_archive_job` (or equivalent creation command), add the match arm for `ArchiveFormatDto::AppleArchive`.
   - Use `#[cfg]` attributes to isolate the platform logic:
     ```rust
     crate::dto::ArchiveFormatDto::AppleArchive => {
         #[cfg(target_os = "macos")]
         {
             // Call zmanager_core Apple Archive job builder
             // Be sure to pass the password for .aea encrypted archive creation if it is present.
         }
         #[cfg(not(target_os = "macos"))]
         {
             return Err(crate::error::CommandErrorDto::unsupported_format(
                 "Apple Archive format (.aar / .aea) is only supported on macOS",
             ));
         }
     }
     ```

---

## Stage 7: Native Contract Generation

**Goal:** Propagate manifest changes to the generated native files.

**Steps:**
1. Open terminal and run:
   ```bash
   node scripts/generate-native-contracts.mjs
   ```
2. Verify that the following files are updated:
   - `src/api/generated/shellActions.generated.ts`
   - `src/app/generated/archiveFileTypes.generated.json`
   - `src-tauri/src/generated/archive_file_types.generated.json`
   - `crates/zmanager-shell-contract/src/generated.rs`
   - `native/macos/Sources/ZManagerGenerated/ArchiveFileTypes.generated.swift`
   - `native/macos/Sources/ZManagerGenerated/ShellActions.generated.swift`
   - `native/macos/Generated/InfoPlist.archive-types.generated.plist`
   - `packaging/macos/archive-types.generated.json`
   - `packaging/macos/main-info.generated.json`
   - `fixtures/contracts/archive-associations.conformance.json`
   - `fixtures/contracts/native-contracts.conformance.json`

---

## Stage 8: Verification & Testing

**Goal:** Prove the changes are correct via automated and manual testing.

**Automated Tests to Add/Run:**
1. **Frontend:** run `npm run test:frontend`
   - `archiveFileTypes.test.ts`: Verify `.aar` and `.aea` identification on macOS.
   - `createFlow.test.ts`: Verify dynamic extension switching (`.aar` <-> `.aea`) based on password presence.
   - `createWorkspace.test.ts`: Verify format dropdown filtering on macOS vs non-macOS platforms.
   - `quickActions.test.ts`: Verify `compressAppleArchive` action routing.
   - `preferences.test.ts`: Verify preference normalization and platform fallback.
2. **Backend:** run `cd src-tauri && cargo test`
   - Test `ArchiveFormatDto::AppleArchive` serialization/deserialization and the `#[cfg(not(target_os = "macos"))]` error handling.
3. **Build:** run `npm run build`
   - Ensure a strict TypeScript build passes without errors.
4. **Rust Build:** run `cd src-tauri && cargo check`
   - Ensure the Rust backend compiles cleanly.

**Manual Smoke Verification (macOS):**
1. Launch app on macOS: `npm run tauri dev`.
2. Open **Create Workspace**: Confirm "Apple Archive (.aar / .aea)" is listed in format dropdown.
3. Enter a target name `test.aar`.
   - Add a password -> verify filename automatically updates to `test.aea`.
   - Delete password -> verify filename reverts to `test.aar`.
4. Right-click a file in Finder -> verify "Add to .aar" appears in Finder context menu.
5. Create an archive and verify the extraction works via `zmanager-core`.
