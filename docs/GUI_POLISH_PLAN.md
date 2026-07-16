# ZManager Desktop GUI Polish Plan

> Status: Superseded for platform scope by
> `MACOS_FULL_TARGET_MIGRATION_EXECUTION_PLAN.md` and ADR-0004. Completed shared
> UX requirements remain reference evidence.

Date: 2026-06-12

## Design Brief

Make the Windows/Linux desktop GUI feel as easy as the macOS app for everyday archive work. The first goal is ease of use: users should be able to drag files in, right-click from the file manager for quick work, and understand the main window without reading implementation details.

Reference behaviors from the macOS GUI:

- Create view accepts dropped files and folders as sources.
- Browse view accepts a dropped archive and opens it.
- Finder exposes quick actions for compress, clean-source compress, extract here, and extract to folder.
- Quick extraction can run without forcing the main window into the user's way unless attention is required.
- The UI uses calm native-feeling controls, compact spacing, clear file rows, and direct action labels.

Current desktop-shell baseline:

- `src/main.ts` already has a menu bar, command toolbar, archive path/search bar, three-pane browser shell, create/extract dialogs, in-app entry context menu, and job drawer.
- `src/styles.css` already has light/dark variables and compact desktop-utility styling.
- `src-tauri/src/platform/windows.rs` and `src-tauri/src/platform/linux.rs` are the owned integration modules.
- Explorer integration is currently disabled in the Windows profile.
- There is no drag/drop event handling in the Tauri shell yet.

## North Star

The default flow should be:

1. Drop an archive onto the window: it opens and lists contents.
2. Drop files or folders onto the create area: they become create sources.
3. Right-click a file or folder in Explorer/Linux file manager: ZManager offers the same obvious quick actions as macOS.
4. If the action can complete safely with defaults, it runs with job progress. If it needs user input, the app opens directly to the right focused dialog/state.

## Core Rules

- Keep archive logic in `zmanager-core`.
- Keep quick-action routing and path validation in Rust/Tauri command-owned code, not scattered TypeScript.
- Keep frontend drag/drop focused on intent classification, visual feedback, and calling existing command flows.
- Do not store passwords or place them in command-line arguments.
- Keep shell integration platform-owned: Windows in `src-tauri/src/platform/windows.rs`, Linux in `src-tauri/src/platform/linux.rs`.
- Do not add macOS Finder/Quick Look/app packaging code to this repository.

## Slice 1: Shared File-Type And Intent Classification

Goal: make every input route decide the same thing for the same paths.

Scope:

- Add a frontend helper such as `src/app/archiveFileTypes.ts` based on the macOS `ArchiveFileTypes` rules.
- Recognize supported single extensions, compound extensions, and split archive suffixes.
- Add a helper such as `classifyDroppedPaths(paths, activeSurface)` that returns one of:
  - open archive
  - add create sources
  - reject unsupported drop
  - ask user to choose action
- Add a Rust-side quick action model mirroring macOS:
  - `compressZip`
  - `compressCleanSource`
  - `extractHere`
  - `extractToFolder`
- Keep user-facing labels in named constants.

Acceptance criteria:

- Supported archive detection is consistent for dialog filters, drag/drop, quick actions, and file association.
- Dropping a folder never tries to open it as an archive.
- Dropping unsupported files onto browse shows a calm ignored/unsupported message.
- Tests cover common archives, compound archive names, split archive names, ordinary folders, and mixed selections.

Likely files:

- `src/app/archiveFileTypes.ts`
- `src/app/archiveFileTypes.test.ts`
- `src/app/dropIntent.ts`
- `src/app/dropIntent.test.ts`
- `src-tauri/src/dto.rs`
- `src-tauri/src/commands.rs`

## Slice 2: Drag And Drop Into The Window

Goal: make the app feel file-manager-native before adding OS context menus.

Scope:

- Listen for Tauri drag/drop events from the current webview/window.
- Show a full-window drop outline when files hover over the window.
- Add a more specific drop affordance in these states:
  - empty browse: "Drop an archive"
  - open archive browse: "Drop another archive to open"
  - create dialog: "Drop files or folders to add"
  - no archive open details pane: "Drop files to create or an archive to open"
- Route dropped supported archives to `list_archive`.
- Route dropped files/folders to the create dialog source list.
- If a mixed drop includes archives and ordinary files, show a tiny chooser: "Open archive" or "Create archive from selection".

Acceptance criteria:

- Dropping one supported archive opens it and focuses the table.
- Dropping multiple ordinary files/folders opens create dialog and adds them as sources.
- Dropping sources while create dialog is open appends without duplicates.
- Dropping while a create/extract/test job is running either queues nothing or shows a clear busy message.
- Browser-preview mode remains harmless and does not throw when Tauri drag/drop APIs are unavailable.

Likely files:

- `src/main.ts`
- `src/styles.css`
- `src/app/createFlow.ts`
- `src/app/dropIntent.ts`

## Slice 3: In-App Context Menus That Match User Intent

Goal: right-click inside ZManager should feel as useful as Finder context actions.

Scope:

- Add context menu actions in the archive table:
  - Preview
  - Extract Selected
  - Extract Here
  - Extract To...
  - Info
- Add context menu actions in the empty/browser surface:
  - Open Archive
  - Create Archive From Dropped/Selected Sources when relevant
- Add context menu actions in the create source list:
  - Remove Source
  - Reveal in File Manager
  - Clear All
- Add disabled-state explanations through `title` or accessible descriptions.

Acceptance criteria:

- A selected file and selected folder both expose extraction.
- Multi-selection exposes Extract Selected and accurate selected count.
- Preview only enables for supported file entries.
- Right-click behavior does not clear selection unexpectedly.

Likely files:

- `src/main.ts`
- `src/styles.css`
- `src/app/archiveTree.ts`

## Slice 4: OS Quick Actions Contract

Goal: define one durable contract for Windows Explorer and Linux file-manager actions.

Scope:

- Add a `QuickActionRequest` model that can be built from process arguments or a platform callback.
- Use a command shape like:
  - `zmanager --quick-action compress --path <path>...`
  - `zmanager --quick-action extract --path <archive>...`
- Reject invalid combinations before starting work:
  - compress actions require at least one local file/folder
  - extract actions accept one or more supported archives
- Use single-instance forwarding if needed so a second quick action reaches the existing app.
- Add a lightweight startup handler that opens the right window state when user attention is required.

Acceptance criteria:

- Quick-action validation matches the macOS `FinderActionSelection` behavior.
- Invalid quick actions show a normal app notice, not a silent failure.
- No password is ever passed through args.
- Failed/background actions surface the main window with a clear job/error state.

Likely files:

- `src-tauri/src/main.rs`
- `src-tauri/src/dto.rs`
- `src-tauri/src/commands.rs`
- `src-tauri/src/platform/mod.rs`
- `src-tauri/src/platform/windows.rs`
- `src-tauri/src/platform/linux.rs`
- `src/api/types.ts`
- `src/main.ts`

## Slice 5: Windows Explorer Context Menu

Goal: match the macOS Finder actions on Windows without putting Windows behavior in the shared frontend.

Scope:

- Decide installer-time registration first; avoid requiring users to manually edit registry.
- Register context-menu verbs for supported selections:
  - Compress using ZManager
  - Extract using ZManager
- Route both verbs through app preferences instead of separate Explorer menu items.
- Hide extraction actions for unsupported file types where possible; still validate again inside the app.
- Keep file associations and context-menu registration in Windows-owned packaging/platform code.

Acceptance criteria:

- Right-clicking a normal folder offers Compress using ZManager.
- Right-clicking a supported archive offers Extract using ZManager and Compress using ZManager.
- Quick action launches the app, starts the correct job when safe, and opens the app if user attention is needed.
- Installer uninstall removes the registered actions.

Likely files:

- `src-tauri/src/platform/windows.rs`
- `packaging/windows/README.md`
- `scripts/build-windows-static.ps1`
- `scripts/smoke-windows-static.ps1`
- possibly `src-tauri/tauri.conf.json` bundle metadata

## Slice 6: Linux File-Manager Actions

Goal: provide the Linux equivalent without pretending all file managers behave identically.

Scope:

- Add `.desktop` actions for ZManager where supported.
- Document/install file-manager-specific helpers only where needed:
  - GNOME Files/Nautilus scripts or extension route
  - KDE Dolphin service menu route
  - generic `.desktop` open-with behavior
- Keep Linux registration in `src-tauri/src/platform/linux.rs` and packaging docs/scripts.

Acceptance criteria:

- Open With ZManager opens supported archives.
- At least one common Linux file-manager quick action path is packaged or documented.
- Unsupported action routes fail visibly and safely.

Likely files:

- `src-tauri/src/platform/linux.rs`
- `packaging/linux/README.md`
- `src-tauri/tauri.conf.json`

## Slice 7: Quick Extract And Quick Create Behavior

Goal: make context-menu actions feel immediate but still safe.

Scope:

- Add default destination policy aligned with macOS:
  - Extract using ZManager follows the default extraction behavior preference.
  - Compress using ZManager follows the default format, output location, and clean-source preferences.
- Add conflict handling through existing core-owned overwrite/collision policy.
- If destination exists, either choose the next safe name or ask before replacing depending on the operation.
- Add a small "background action completed" path; if the app was launched only for a successful quick action, it may close or remain minimized later, but first pass can show the job drawer.

Acceptance criteria:

- A user can right-click a folder and create an archive with no extra form scanning.
- A user can right-click an archive and extract beside it with no destination picker.
- Password-required archives stop and ask for password in the app.
- Failures leave the user in a recoverable state.

Likely files:

- `src-tauri/src/commands.rs`
- `src/app/createFlow.ts`
- `src/app/extractFlow.ts`
- `src/main.ts`

## Slice 8: Modern Clean UI Pass

Goal: make the existing shell feel more like the macOS app: calm, direct, and native-feeling.

Scope:

- Make the empty state more useful:
  - Open Archive
  - Create Archive
  - "Drop an archive or files here"
- Replace remaining text-heavy buttons with icon-plus-label controls where helpful.
- Reduce visual clutter in dialogs:
  - Create dialog should lead with sources, output, format, and Create.
  - Advanced options stay collapsed.
  - Warnings are inline and concise.
- Tighten table rhythm:
  - alternating row background or subtle hover
  - stable row heights
  - middle truncation for long paths
  - clear selected row color
- Use a slightly softer macOS-inspired polish while staying Windows/Linux appropriate:
  - compact radii
  - system font
  - quieter borders
  - no hero/marketing layout
  - no decorative backgrounds
- Add a clear active job chip in the status bar.

Acceptance criteria:

- First screen explains itself within a few seconds.
- Main content is dominated by archive/source rows, not panels of settings.
- Drag/drop states are visible without feeling loud.
- Light/dark modes both pass a quick screenshot review.
- Text does not overflow toolbar buttons, dialogs, or status surfaces at minimum window size.

Likely files:

- `src/main.ts`
- `src/styles.css`

## Slice 9: Preferences For Defaults

Goal: support fast actions without making users choose every time.

Scope:

- Add preferences equivalent to the macOS defaults:
  - default archive format
  - clean-source default
  - default output location
  - default extraction behavior: ask every time, extract here, extract to folder
  - quick open extraction enabled
  - preview cleanup policy
- Store only non-sensitive settings.
- Move preference UI out of the main workspace, likely under Tools or Help/Preferences.

Acceptance criteria:

- Quick actions use preferences.
- Passwords are never persisted.
- Defaults are testable without launching the full UI.

Likely files:

- `src/app/preferences.ts`
- `src/app/preferences.test.ts`
- `src/main.ts`
- `src-tauri/src/commands.rs` if preferences are stored natively

## Slice 10: Verification And Release Gate

Goal: prove the polish works at the behavior boundary.

Frontend tests:

- archive type detection
- drop intent classification
- create source dedupe
- quick-action label/availability mapping
- preference defaults

Rust tests:

- quick-action request parsing
- quick-action validation
- create quick action starts a create job
- extract quick action starts an extract job
- invalid archive selection rejects with normalized error
- password-required extraction asks for attention

Manual smoke:

- Drag archive into empty app.
- Drag files/folders into create dialog.
- Right-click archive in Explorer: Extract using ZManager.
- Right-click folder in Explorer: Compress using ZManager.
- Verify failed/password-required quick action opens the app with recovery state.
- Run the Windows static release gate.

Commands:

```powershell
npm run test:frontend
npm run build
cd src-tauri && cargo test
powershell -ExecutionPolicy Bypass -File scripts/smoke-windows-static.ps1
powershell -ExecutionPolicy Bypass -File scripts/release-gate-windows-static.ps1
```

## Recommended Execution Order

1. Shared file type and drop-intent helpers.
2. Tauri drag/drop support in the main window and create dialog.
3. In-app context menu polish.
4. Quick-action request model and validation.
5. Windows Explorer context menu registration.
6. Quick extract/create startup handling.
7. Linux file-manager actions.
8. Modern clean UI pass.
9. Preferences for quick-action defaults.
10. Full smoke/release gate.

This order gives users visible ease-of-use improvements early, then adds OS integration, then finishes with visual refinement once the workflows are real.

## Open Decisions

1. Should quick Extract Here process multiple archives in sequence, like the macOS background extraction queue, or open the app after the first archive?
2. Should first-pass Windows quick actions live directly under the Explorer context menu or under a `ZManager` submenu?
3. Should quick Compress default to ZIP for Windows familiarity or TZST to match the macOS default preference?
4. Should dropping a mixed selection ask every time, or should archive drops always win when exactly one supported archive is present?
5. Should a successful quick action leave the app open for now, or close/minimize when the app was launched only for that action?

Recommended defaults:

- Process multiple Extract Here archives sequentially.
- Use a `ZManager` submenu if registration is reliable; otherwise use direct verbs.
- Default quick Compress to ZIP on Windows/Linux first, then add preferences for TZST/TZAP/7Z.
- Ask on mixed drops.
- Keep the app open in the first pass; add background close/minimize behavior after the job lifecycle is proven.
