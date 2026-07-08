# ZManager Desktop Frontend Architecture Execution Plan

Date: 2026-07-08

Companion design doc: `docs/FRONTEND_ARCHITECTURE_DEEPENING_PLAN.md`

## Purpose

This is the low-memory execution plan for the frontend architecture deepening
work. The architecture plan explains the target shape. This document explains
how to execute that target in resumable slices without relying on conversation
memory.

Update this file at the end of each meaningful architecture session. It should
always answer:

- What slice is active.
- What was just changed.
- What validation was run.
- What the next smallest safe action is.

## Resume Protocol

When resuming this work after a context reset or handoff:

1. Read `AGENTS.md`, then `docs/FRONTEND_ARCHITECTURE_DEEPENING_PLAN.md`, then
   this file.
2. Run `git status --short` and identify unrelated user changes before editing.
3. Re-scan current ownership anchors:

   ```powershell
   rg -n "selectedEntries|selectedCompressRows|focusedEntryPath|focusedCompressRowPath|pollInFlight|createPlanRevision|selectCommandState|localStorage" src/main.ts src/app src/ui
   ```

4. Pick the first incomplete checklist item in the active slice.
5. Keep changes scoped to that slice unless a test seam requires a tiny
   prerequisite.
6. Run the slice validation command before updating this file.
7. Add a short session note at the bottom of this file with files changed,
   tests run, and the next action.

Do not use this document as a substitute for reading the code being changed.
It is a map, not proof that the terrain still looks the same.

## Current Baseline

Last checked: 2026-07-08

- `src/main.ts` is roughly 9,000 lines and still owns archive selection,
  create-plan table selection, job polling concurrency,
  command wiring, path history storage, and several render/update paths.
- Useful app seeds already exist in `src/app/archiveTable.ts`,
  `src/app/archiveTree.ts`, `src/app/selection.ts`, `src/app/createFlow.ts`,
  `src/app/dropIntent.ts`, `src/app/jobs.ts`, `src/app/quickActions.ts`,
  `src/app/classicCommands.ts`, `src/app/preferences.ts`, and
  `src/app/preferenceStorage.ts`.
- Existing UI seeds are `src/ui/jobsView.ts` and
  `src/ui/preferencesView.ts`.
- Existing desktop seeds are `src/desktop/runtime.ts` and
  `src/desktop/paths.ts`.
- Package scripts are:
  - `npm run test:frontend`
  - `npm run build`
  - `npm run test:e2e`
  - `npm run tauri dev`
  - `cd src-tauri && cargo check`
  - `cd src-tauri && cargo test`

## Execution Rules

- Work one slice at a time.
- Prefer characterization tests before moving behavior.
- Keep DOM rendering unchanged until the app state seam exists.
- Do not add new durable workflow state to `src/main.ts`.
- Do not add direct Tauri imports outside `src/api` or `src/desktop`.
- Do not move password values into snapshots, logs, storage, diagnostics, or
  display strings.
- Keep workflow state language-neutral. Translate and format only at the
  display seam.
- Update this file when a slice changes status.

## Slice Ledger

| Slice | Name | Status | Primary Gate |
| --- | --- | --- | --- |
| 0 | Guardrails and characterization | Complete | Risky current behavior has tests or explicit smoke coverage. |
| 1 | Stable hierarchical row identity | Complete | Archive and create visible row derivation share `src/app/hierarchicalTable.ts`. |
| 2 | Table selection and focus | Complete | Archive/create table selection globals leave row event handlers. |
| 3 | Archive workspace | Complete | Archive browsing state and request readiness move behind `archiveWorkspace.ts`. |
| 4 | Create workspace | Complete | Create sources, plan revision, inclusion, options, and request construction move behind `createWorkspace.ts`. |
| 5 | Shell workspace and path histories | Complete | Mode, status, drop state, histories, preview cleanup metadata move out of `main.ts`. |
| 6 | Command router | Complete | Toolbar, menus, shortcuts, context menus, details, tree, and row actions execute through one router. |
| 7 | Jobs workspace | Complete | Job merge, retry, polling decisions, quick-action state move behind `jobsWorkspace.ts`. |
| 8 | Settings and display context | Complete | Preferences and locale/display refresh flow through one seam. |
| 9 | UI view adapters | In progress | `main.ts` mostly binds intents and renders snapshots. |
| 10 | Desktop adapters and controllers | Not started | Tauri imports are concentrated in `src/api` and `src/desktop`; controllers use injected adapters. |

Active slice: 9

## Slice 0: Guardrails And Characterization

Goal: protect behavior before moving ownership.

Primary files:

- `src/app/archiveTable.test.ts`
- `src/app/createFlow.test.ts`
- `src/app/selection.test.ts`
- `src/app/classicCommands.test.ts`
- `src/app/jobs.test.ts`
- `src/app/dropIntent.test.ts`
- `src/main.ts`

Checklist:

- [x] Identify current archive row behavior that must not regress: root rows,
  nested rows, parent row, synthetic folders, flat view, search view, duplicate
  basenames, selected-hidden-during-search behavior.
- [x] Identify current create-plan row behavior that must not regress: source
  path mapping, folder navigation, included/excluded paths, partial folder
  state, empty/loading/error states.
- [x] Confirm command state coverage for browse, create, job, menu, details,
  and row-action representative commands.
- [x] Confirm create-plan revision tests cover stale plan results and
  destination edits.
- [x] Confirm job polling tests cover in-flight poll, poll-again request, retry
  context, and quick-action focused jobs.
- [x] Confirm drop-intent tests cover archive drop, create-source drop, and
  ambiguous drop choices.

Slice 0 coverage note:

- `archiveTable.test.ts` covers root rows, nested rows, parent row visibility,
  explicit and synthetic folders, flat view, search view, duplicate basenames,
  and selected paths hidden by search.
- `createFlow.test.ts` covers create-plan row derivation, source-path mapping,
  folder navigation, included/excluded/partial inclusion state, filtered plan
  counts, stale plan revision guards, and destination edit recovery.
- `classicCommands.test.ts` covers representative browse, create, job, menu,
  details, and row-action command state.
- `jobs.test.ts` covers poll-in-flight/poll-again decisions, no-pollable-job
  stop decisions, pollable job selection, password retry context, and focused
  quick-action job completion decisions.
- `dropIntent.test.ts` already covers archive drops, create-source drops, and
  ambiguous mixed drops.

Explicit manual smoke gaps retained for later UI/view slices:

- Create-plan empty, loading, and error table render rows remain in `main.ts`
  and should be smoke-tested through the UI until Slice 4/9 exposes a stable
  workspace/view snapshot seam.
- Polling timer scheduling and native quick-action window close/reveal effects
  remain manual smoke coverage until Slice 7/10 moves timers and window effects
  behind adapters.

Completion gate:

- Tests cover or explicitly document the high-risk behavior that later slices
  will move.
- Any missing coverage is added to existing app-level test files before new
  production modules are introduced.

Validation:

```powershell
npm run test:frontend
npm run build
```

## Slice 1: Stable Hierarchical Row Identity

Goal: create the shared row identity and row derivation seam without moving
selection/focus yet.

New files:

- `src/app/hierarchicalTable.ts`
- `src/app/hierarchicalTable.test.ts`

Likely touched files:

- `src/app/archiveTable.ts`
- `src/app/archiveTable.test.ts`
- `src/app/createFlow.ts`
- `src/app/createFlow.test.ts`
- `src/main.ts`

Checklist:

- [x] Define explicit row IDs so parent rows cannot collide with real archive
  paths.
- [x] Support parent rows, folder rows, entry rows, synthetic folders, current
  folder mode, flat mode, and search mode.
- [x] Keep archive-specific columns and sorting outside the shared table
  module.
- [x] Keep create source-path mapping and inclusion state outside the shared
  table module.
- [x] Replace archive visible row derivation with the shared module while
  preserving row order.
- [x] Replace create-plan visible row derivation with the shared module while
  preserving row order.

Completion gate:

- Archive and create-plan visible row derivation both call
  `src/app/hierarchicalTable.ts`.
- DOM rendering remains behavior-preserving.

Validation:

```powershell
npm run test:frontend
npm run build
```

## Slice 2: Table Selection And Focus

Goal: move common selection and focus behavior behind the shared table module.

Likely files:

- `src/app/hierarchicalTable.ts`
- `src/app/hierarchicalTable.test.ts`
- `src/app/selection.ts`
- `src/app/selection.test.ts`
- `src/main.ts`

Checklist:

- [x] Move visible selectable path calculation into the table module.
- [x] Move click replacement, ctrl/meta toggle, shift range, select all,
  invert visible, and visible cleanup into the table module.
- [x] Move focus movement and anchor updates into table intents.
- [x] Preserve hidden-selection behavior during search unless the product
  decision changes.
- [x] Keep marquee DOM hit testing and native drag gesture detection in UI code,
  applying their results through table intents.

Completion gate:

- `selectedEntries`, `selectedCompressRows`, `focusedEntryPath`,
  `focusedCompressRowPath`, `selectionAnchorPath`, and
  `compressSelectionAnchorPath` are not directly mutated by row event handlers.

Validation:

```powershell
npm run test:frontend
npm run build
```

## Slice 3: Archive Workspace

Goal: move archive browsing workflow state behind a deterministic workspace.

New files:

- `src/app/workspaces/archiveWorkspace.ts`
- `src/app/workspaces/archiveWorkspace.test.ts`

Checklist:

- [x] Move archive load state, error state, current archive path, and listing
  metadata into the workspace.
- [x] Move folder navigation, breadcrumbs/current folder normalization, search,
  flat view, and expanded tree folders into the workspace.
- [x] Move table sort snapshot, full selection snapshot, and details model into
  the workspace.
- [x] Move password-required retry state into the workspace without storing
  password values.
- [x] Add extract, test, preview, open-outside, and native-drag readiness
  builders that return serializable requests or unavailable reasons.
- [x] Feed command state from an archive workspace snapshot.

Completion gate:

- `src/main.ts` no longer owns archive browsing state globals.
- Archive command context is derived from workspace snapshots.

Validation:

```powershell
npm run test:frontend
npm run build
```

## Slice 4: Create Workspace

Goal: move archive creation workflow state behind a deterministic workspace.

New files:

- `src/app/workspaces/createWorkspace.ts`
- `src/app/workspaces/createWorkspace.test.ts`

Checklist:

- [x] Move source paths and source removal state.
- [x] Move plan request readiness, plan revision, stale-result guards, plan
  errors, and warnings.
- [x] Move included/excluded archive paths and partial folder inclusion state.
- [x] Move create-plan folder navigation and expanded tree folders.
- [x] Move destination suggestion/readiness, per-format defaults, compression
  options, TZAP options, password option visibility, and create readiness.
- [x] Build `StartCreateRequest` only through the workspace interface.

Completion gate:

- `src/main.ts` no longer owns create workflow state globals.
- Plan revision behavior and start-create request construction are tested
  through the workspace interface.

Validation:

```powershell
npm run test:frontend
npm run build
```

## Slice 5: Shell Workspace And Path Histories

Goal: move app-wide shell state and storage-normalized path histories out of
`main.ts`.

New files:

- `src/app/shell/shellWorkspace.ts`
- `src/app/shell/shellWorkspace.test.ts`
- `src/app/pathHistory.ts`
- `src/app/pathHistory.test.ts`

Checklist:

- [x] Move active workspace mode and app-wide status.
- [x] Move drop overlay state and pending drop choices.
- [x] Move recent archive, extract destination, and create destination history
  normalization into `pathHistory.ts`.
- [x] Move preview cleanup root/path metadata into shell state.
- [x] Move quick-action startup mode decisions into shell state.
- [x] Inject storage access instead of calling local storage from workflow code.

Completion gate:

- `src/main.ts` no longer owns workspace mode, pending drop choice, path history
  arrays, or preview cleanup metadata.

Validation:

```powershell
npm run test:frontend
npm run build
```

## Slice 6: Command Router

Goal: route all command surfaces through one availability and execution seam.

New files:

- `src/app/commands/commandRouter.ts`
- `src/app/commands/commandRouter.test.ts`

Checklist:

- [x] Keep command definitions and labels in `src/app/classicCommands.ts`.
- [x] Move command execution switches into `commandRouter.ts`.
- [x] Route toolbar buttons, menu items, shortcuts, context menus, details pane,
  tree actions, and row actions through command IDs plus payloads.
- [x] Use injected effects for dialogs, API calls, desktop actions, status
  messages, clipboard, and window actions.
- [x] Normalize unsupported and disabled command behavior.

Intentional local actions after Slice 6:

- Column sorting direction, column sizing/order/visibility, and reset-columns
  remain local table UI mechanics until the UI/table adapter slice.
- Folder navigation mechanics remain local when the action carries a row/folder
  path (`open-folder`, `open-entry`, context `open-inside`,
  `compress-open-folder`) instead of the current classic selection.
- Create-source include/exclude/remove/clear, reveal-source, and add-source
  dialog choices remain local create workspace or desktop-adapter actions.
- Search focus/clear-search, dialog copy buttons, modal/dev-surface helpers,
  drop choices, window chrome, and quick-action job window controls remain
  local because they are not classic archive commands.
- `extract-folder` remains local because it first selects the folder contents
  from context before opening the extract dialog.

Completion gate:

- Adding a command no longer requires editing unrelated event handlers.
- Representative commands from each surface are covered by router tests.

Validation:

```powershell
npm run test:frontend
npm run build
```

## Slice 7: Jobs Workspace

Goal: move job lifecycle, polling, retry, and quick-action progress state behind
a deterministic workspace.

New files:

- `src/app/workspaces/jobsWorkspace.ts`
- `src/app/workspaces/jobsWorkspace.test.ts`

Checklist:

- [x] Move job event merging and job map updates.
- [x] Move pollable job selection and poll concurrency decisions.
- [x] Move retry contexts, password retry eligibility, and prompted retry job
  IDs.
- [x] Move focused quick-action job mode and auto-close decision.
- [x] Move progress clock snapshot and job output action readiness.
- [x] Keep timers, password prompt UI, and native window calls as adapters.

Completion gate:

- Polling and retry decisions are testable without timers or Tauri globals.

Validation:

```powershell
npm run test:frontend
npm run build
```

## Slice 8: Settings And Display Context

Goal: make preferences, locale, translator, and formatting refresh through one
display seam.

New or deepened files:

- `src/app/display/displayContext.ts`
- `src/app/preferences.ts`
- `src/app/preferenceStorage.ts`
- `src/app/i18n/*`
- `src/ui/preferencesView.ts`

Checklist:

- [x] Centralize preference patch normalization.
- [x] Add display context snapshot for resolved locale, translator, formatter,
  document language, and direction.
- [x] Ensure table settings, toolbar settings, create defaults, and extraction
  defaults update through typed preference state.
- [x] Ensure workflow state and DTOs use stable raw values, not localized
  labels.
- [x] Ensure display context changes rerender active views without changing
  sort/filter semantics.

Completion gate:

- `src/main.ts` no longer owns preference patch application or locale refresh.

Validation:

```powershell
npm run test:frontend
npm run build
```

## Slice 9: UI View Adapters

Goal: move rendering and DOM event decoding into view modules once app seams
exist.

Likely files:

- `src/ui/archiveWorkspaceView.ts`
- `src/ui/createWorkspaceView.ts`
- `src/ui/shellView.ts`
- `src/ui/commandSurfaceView.ts`
- `src/ui/contextMenuView.ts`
- `src/ui/modalController.ts`
- `src/ui/hierarchicalTableView.ts`

Checklist:

- [ ] Move archive browser render/update functions into UI modules.
- [x] Move create workspace render/update functions into UI modules.
- [x] Move command surface binding into UI modules that emit command IDs.
- [x] Move context-menu placement and keyboard focus into UI modules.
- [x] Move generic modal focus trap, return focus, default/cancel, and Escape
  behavior into `modalController.ts`.
- [ ] Keep workflow decisions out of UI modules.

Completion gate:

- `src/main.ts` mostly queries roots, constructs modules, binds intents, and
  renders snapshots.

Validation:

```powershell
npm run test:frontend
npm run build
npm run test:e2e
```

## Slice 10: Desktop Adapters And Controllers

Goal: isolate concrete runtime effects and async orchestration.

New or deepened files:

- `src/app/controllers/*`
- `src/desktop/dialogs.ts`
- `src/desktop/windowController.ts`
- `src/desktop/fileDrop.ts`
- `src/desktop/nativeDrag.ts`
- `src/desktop/previewCleanup.ts`
- `src/desktop/clipboard.ts`
- `src/desktop/timers.ts`
- `src/desktop/runtime.ts`
- `src/desktop/paths.ts`

Checklist:

- [ ] Move native dialogs behind desktop adapters.
- [ ] Move file manager, clipboard, timers, preview cleanup, native drag-out,
  file-drop event binding, and window geometry behind desktop adapters.
- [ ] Add controllers that inject API, desktop, dialog, storage, timer,
  clipboard, and window adapters.
- [ ] Keep controllers responsible for async sequencing, stale-result checks,
  debounce, timers, and effect error mapping.
- [ ] Keep workspaces deterministic and Tauri-free.

Completion gate:

- Most frontend tests run without Tauri globals.
- Direct Tauri imports are concentrated in `src/api` and `src/desktop`.

Validation:

```powershell
npm run test:frontend
npm run build
cd src-tauri && cargo check
```

## Manual Smoke Set

Run this after slices that move visible workflow or command behavior:

- Open archive and browse folders.
- Search archive and toggle flat view.
- Select entries with click, ctrl/meta, shift, select all, invert visible, and
  marquee.
- Open details pane actions and row context menu actions.
- Extract selected entries and whole archive.
- Preview/open outside a selected entry.
- Add create sources, navigate create plan, include/exclude paths, and create an
  archive.
- Check jobs drawer progress, cancel/dismiss, retry where possible, and
  quick-action progress.
- Exercise menu commands, toolbar commands, shortcuts, drop overlay, and
  preferences display refresh.

## Open Decisions To Resolve During Slices

- Whether hidden selections during search are product behavior or accidental
  behavior.
- The exact disabled-reason shape returned by command router execution.
- Whether browser-only create-plan preview should live in a planning adapter or
  a create controller.
- The exact split between shell workspace and jobs workspace for quick-action
  auto-close.
- The display context API shape once preferences and i18n are connected.

## Session Notes

### 2026-07-08

- Created this execution plan from
  `docs/FRONTEND_ARCHITECTURE_DEEPENING_PLAN.md` and a quick source scan.
- No production code changed.
- Next action: start Slice 0 by reviewing existing characterization tests and
  adding missing coverage before introducing `src/app/hierarchicalTable.ts`.

### 2026-07-08 Slice 0 Worker 1

- Read `AGENTS.md`, `docs/FRONTEND_ARCHITECTURE_DEEPENING_PLAN.md`, and this
  execution plan; `git status --short` was clean before editing.
- Added tiny behavior-preserving test seams in existing modules only:
  `archiveTable.ts` for archive browser rows, `createFlow.ts` for create-plan
  rows/inclusion/source mapping/revision guards, and `jobs.ts` for polling and
  focused quick-action job decisions.
- Added/confirmed Slice 0 characterization coverage in
  `archiveTable.test.ts`, `createFlow.test.ts`, `classicCommands.test.ts`,
  `jobs.test.ts`, and existing `dropIntent.test.ts`.
- Validation run: `npm.cmd run test:frontend` passed with 25 files and 199
  tests; `npm.cmd run build` passed. Direct `npm run test:frontend` was blocked
  by the local PowerShell script execution policy before rerunning the same
  package script via `npm.cmd`.
- Manual smoke gaps: create-plan empty/loading/error DOM rows, polling timer
  scheduling, and native quick-action window close/reveal effects remain manual
  until later workspace/view/adapter slices.
- Next smallest safe action: start Slice 1 by introducing
  `src/app/hierarchicalTable.ts` for shared stable row identity, using the
  Slice 0 row characterization as the regression net.

### 2026-07-08 Slice 1 Worker 2

- Read `AGENTS.md`, `docs/FRONTEND_ARCHITECTURE_DEEPENING_PLAN.md`, and this
  execution plan; `git status --short` showed the accepted uncommitted Slice 0
  changes in `docs/FRONTEND_ARCHITECTURE_EXECUTION_PLAN.md`, `src/main.ts`,
  and the existing app/test modules.
- Added `src/app/hierarchicalTable.ts` and
  `src/app/hierarchicalTable.test.ts` for shared row IDs and row derivation:
  parent, folder, entry, synthetic folder, current-folder, flat, and search
  rows.
- Updated `src/app/archiveTable.ts` so archive browser rows call the shared
  hierarchical table builder while archive columns, formatting, and sorting
  remain archive-owned.
- Updated `src/app/createFlow.ts` so create-plan rows call the shared builder
  while create source-path mapping, inclusion state, and create-specific row
  sorting remain create-owned.
- Updated stale row fixtures in `src/app/archiveEntryIcons.test.ts` and
  `src/app/archiveTable.test.ts`, and reused the real parent create row in
  `src/main.ts` for parent-folder icon rendering.
- Validation run: `npm.cmd run test:frontend` passed with 26 files and 205
  tests; `npm.cmd run build` passed.
- Next smallest safe action: start Slice 2 by moving visible selectable path
  calculation and selection/focus intents into `src/app/hierarchicalTable.ts`
  without changing DOM event decoding.

### 2026-07-08 Slice 2 Worker 3

- Read `AGENTS.md`, `docs/FRONTEND_ARCHITECTURE_DEEPENING_PLAN.md`, and this
  execution plan; `git status --short` showed accepted uncommitted Slice 0/1
  changes only.
- Deepened `src/app/hierarchicalTable.ts` with DOM-independent visible
  selectable path calculation, row click/range/toggle selection, select all,
  invert visible, visible cleanup, focus movement, checkbox set, ensure
  selected, clear, and marquee result helpers.
- Kept marquee rectangle hit testing and native drag gesture detection in
  `src/main.ts`; their decoded paths now apply through hierarchical table
  helpers.
- Updated archive and create table adapters in `src/main.ts` so row event
  handlers no longer directly assign `selectedEntries`, `selectedCompressRows`,
  `focusedEntryPath`, `focusedCompressRowPath`, `selectionAnchorPath`, or
  `compressSelectionAnchorPath`; temporary centralized adapter functions still
  assign those globals until workspace slices exist.
- Preserved archive hidden-selection behavior during search/filtering. Create
  plan visible cleanup continues to drop paths that are no longer visible.
- Validation run: `npm.cmd run test:frontend` passed with 26 files and 217
  tests; `npm.cmd run build` passed.
- Next smallest safe action: start Slice 3 by introducing
  `src/app/workspaces/archiveWorkspace.ts` around archive browsing state and
  request readiness without moving Tauri calls into app modules.

### 2026-07-08 Slice 3 Worker 4

- Read `AGENTS.md`, `docs/FRONTEND_ARCHITECTURE_DEEPENING_PLAN.md`, and this
  execution plan; `git status --short` showed accepted uncommitted Slice 0/1/2
  changes before editing.
- Added `src/app/workspaces/archiveWorkspace.ts` and
  `src/app/workspaces/archiveWorkspace.test.ts` for deterministic archive
  load/listing state: current archive path, browse state, language-neutral
  status payloads, command error payloads, entries, entry count, total size,
  listing revision, reset behavior, and password-free snapshots.
- Integrated the workspace into the existing `src/main.ts` load/listing seam:
  `loadArchive` now begins/fails loads through the workspace, and
  `loadArchiveListingIntoState` applies the workspace's normalized listing and
  preserved-state snapshot before existing render code runs. Existing Tauri
  calls, DOM rendering, folder navigation handlers, search handlers, details,
  and request builders remain in `main.ts` for later Slice 3 tasks.
- Validation run: `npm.cmd run test:frontend` passed with 27 files and 226
  tests; `npm.cmd run build` passed.
- Next smallest safe action: move folder navigation plus breadcrumbs/current
  folder history behind `archiveWorkspace.ts`, preserving the existing
  `main.ts` render functions and avoiding request-builder migration.

### 2026-07-08 Slice 3 Worker 5

- Read `AGENTS.md`, `docs/FRONTEND_ARCHITECTURE_DEEPENING_PLAN.md`, and this
  execution plan; `git status --short` showed accepted uncommitted Slice 0/1/2
  plus partial Slice 3 changes before editing.
- Extended `src/app/workspaces/archiveWorkspace.ts` with deterministic
  navigation and view-state intents for current folder, breadcrumbs, navigation
  history/back/up, search query, flat view, expanded archive tree folders, and a
  small selection mirror used only to keep the existing compatibility globals in
  sync.
- Updated `src/main.ts` so archive navigation, search input, clear search,
  flat-view toggles, preference-applied flat view, load-state preservation, and
  archive tree expand/collapse flow through the workspace snapshot before
  syncing back to the existing render globals. DOM rendering and event decoding
  remain in `main.ts`.
- Updated `src/app/workspaces/archiveWorkspace.test.ts` for navigation history,
  current-folder normalization, breadcrumbs, search clearing/preservation,
  flat-view state, expanded tree folders, and preserved load view state. Updated
  `src/app/guiLayoutContracts.test.ts` for workspace-owned breadcrumb paths
  with UI-owned root archive labeling.
- Validation run: `npm.cmd run test:frontend` passed with 27 files and 233
  tests; `npm.cmd run build` passed.
- Slice 3 remains active/partial. Done in this session: folder navigation,
  breadcrumbs/current folder normalization, search query, flat view, and
  expanded tree folders. Still pending: password retry state, table sort
  snapshot, full selection snapshot/details model, request readiness builders,
  and command state from the workspace snapshot.
- Next smallest safe action: move password-required listing retry state into
  `archiveWorkspace.ts` without storing password values, leaving extract/test/
  preview/native-drag readiness builders for a later Slice 3 subtask.

### 2026-07-08 Slice 3 Worker 6

- Read the accepted partial Slice 3 workspace and current `src/main.ts` wiring
  before editing; adapted to the existing compatibility mirrors rather than
  removing request-builder globals that later Slice 3 work still needs.
- Extended `src/app/workspaces/archiveWorkspace.ts` so the archive workspace now
  owns table sort state, row-option-aware sorted visible rows, immutable
  selected/focused/anchor snapshots, visible selected row and entry facts,
  hidden-selection-during-search facts, focused-entry facts, and a
  language-neutral details model for no archive, hidden selection, archive
  summary, synthetic folder, single entry, and multiple visible selection.
- Updated `src/main.ts` to seed sort/row preferences into the workspace, persist
  sort from the workspace snapshot, render table rows and the details pane from
  workspace facts, and sync the remaining archive compatibility mirrors from
  workspace snapshots.
- Added archive workspace coverage for sort toggles, row derivation across
  folder/search/flat/parent-row modes, immutable selection snapshots, hidden
  search selections, and each details-model branch.
- Validation run: `npm.cmd run test:frontend` passed with 27 files and 237
  tests; `npm.cmd run build` passed.
- Slice 3 remains active/partial. Still pending: password retry state, extract/
  test/preview/open-outside/native-drag readiness builders, and command state
  fed entirely from the workspace snapshot.
- Next smallest safe action: add extract/test/preview/open-outside/native-drag
  readiness builders that return serializable requests or unavailable reasons.

### 2026-07-08 Slice 3 Worker 7

- Added password retry decision state to `src/app/workspaces/archiveWorkspace.ts`
  for current archive operations without storing password values. The retry
  snapshot records only operation, archive path, password error code, prompt
  message key, and attempt count.
- Wired listing/loading, test archive, extract archive/selection dialog retry,
  preview/open-outside, and native drag-out in `src/main.ts` through the archive
  workspace retry model. Prompt text is still rendered at the UI seam, and
  passwords still flow directly from prompt/dialog input into command DTOs.
- Preserved out-of-scope job password retry and quick-action extract/create
  prompts for later slices.
- Added archive workspace tests for required vs invalid prompts, retry attempt
  increment/replacement behavior, non-password errors, clearing on success/
  failure/explicit clear/reset, and password-free serializable snapshots.
- Updated the extract dialog GUI contract test to lock in the workspace-routed
  retry prompt behavior.
- Validation run: `npm.cmd run test:frontend` passed with 27 files and 242
  tests; `npm.cmd run build` passed.
- Slice 3 remains active/partial. Still pending: extract/test/preview/open-
  outside/native-drag readiness builders and command state fed entirely from the
  workspace snapshot.
- Next smallest safe action: add archive workspace readiness builders for
  extract/test/preview/open-outside/native-drag requests.

### 2026-07-08 Slice 3 Worker 8

- Added archive workspace readiness builders for extract, test, preview/open-
  outside, and native drag-out requests. Builders return serializable API DTOs
  or language-neutral unavailable reasons and keep Tauri, DOM, storage, i18n,
  and command execution outside `src/app/workspaces/archiveWorkspace.ts`.
- Moved selected extraction path derivation into the workspace, including
  folder expansion to file descendants, synthetic folder descendants, and
  explicit empty-folder fallback. `src/main.ts` now asks the workspace for
  extract reference paths before applying the DOM-derived strip options.
- Moved native drag path and strip-depth derivation into the workspace. Dragging
  a selected row uses the selected rows, dragging an unselected row uses only
  that row, synthetic folder rows are supported, and strip depth is zero for
  root, search, and flat views.
- Wired `src/main.ts` start-extract, test-archive, preview/open-outside, and
  native drag-out call sites through the workspace builders while leaving
  dialogs, password prompts, command calls, preview cleanup, and destination
  history at the UI/runtime seam.
- Added archive workspace tests for extract archive/selection requests, test
  archive requests, preview/open-outside single-file readiness, native drag
  selected vs unselected row behavior, synthetic folder drag requests, strip
  depth, unavailable reasons, and password passthrough without snapshot storage.
- Validation run: `git diff --check` passed with line-ending warnings only;
  `npm.cmd run test:frontend` passed with 27 files and 248 tests;
  `npm.cmd run build` passed.
- Slice 3 remains active/partial. Still pending: command state fed entirely from
  the archive workspace snapshot.
- Next smallest safe action: feed toolbar/menu/shortcut command enablement from
  the archive workspace snapshot instead of compatibility mirrors.

### 2026-07-08 Slice 3 Worker 9

- Added an archive command snapshot to `src/app/workspaces/archiveWorkspace.ts`
  with the archive-derived inputs consumed by `selectCommandState`: browse
  state, archive presence, focused row, navigation readiness, open-inside
  readiness, selection counts, visible selectable count, and UI readiness facts
  for listing/search/back navigation.
- Updated `src/main.ts` so command enablement, search controls, select-all,
  refresh, test, and up/back navigation buttons read from the workspace command
  snapshot plus external command inputs such as active-job state. Command
  enablement rules and disabled reason strings remain owned by
  `src/app/classicCommands.ts`.
- Added archive workspace coverage for command context/readiness in idle,
  loading, loaded root, loaded nested folder, single selected directory, single
  selected file, multiple selection, and empty archive states, plus a selector
  feed test that uses the workspace snapshot with `selectCommandState`.
- Validation run: `git diff --check` passed with line-ending warnings only;
  `npm.cmd run test:frontend` passed with 27 files and 250 tests;
  `npm.cmd run build` passed.
- Slice 3 is complete. Archive workflow ownership now lives behind the
  workspace snapshot; the remaining `main.ts` archive globals are compatibility
  mirrors for render and DOM seams to remove in later UI/controller slices.
- Next smallest safe action: start Slice 4 by introducing
  `src/app/workspaces/createWorkspace.ts` around create-source and plan state.

### 2026-07-08 Slice 4 Worker 10

- Added `src/app/workspaces/createWorkspace.ts` as a deterministic create-source
  workspace. It owns source path normalization, trimming, de-duplication,
  replacement, removal, clearing, reset no-ops, immutable source snapshots, and
  source-count/readiness facts.
- Wired `src/main.ts` source add, remove, clear, quick-create review assignment,
  source-list rendering, plan preview/request inputs, create request inputs, and
  destination auto-suggestion through the create workspace snapshot. The
  temporary `createSources` variable is now only a compatibility mirror synced
  from the workspace.
- Preserved existing UI/runtime side effects in `main.ts`: source removal and
  clearing still reset excluded paths, compress selection, current plan, empty
  folder state, rendering, and queued plan runs; adding the first source still
  suggests a destination at the UI seam.
- Added `src/app/workspaces/createWorkspace.test.ts` coverage for add/de-dupe/
  trim/order, source replacement, removal, clearing, reset/no-op behavior, and
  immutable snapshots.
- Validation run: `git diff --check` passed with line-ending warnings only;
  `npm.cmd run test:frontend` passed with 28 files and 262 tests;
  `npm.cmd run build` passed.
- Slice 4 remains active/partial. Still pending: plan readiness/revision/stale
  guards, included/excluded archive paths, create-plan folder navigation/tree
  expansion, destination/options/readiness, and `StartCreateRequest`
  construction through the workspace interface.

### 2026-07-08 Slice 4 Worker 11

- Extended `src/app/workspaces/createWorkspace.ts` so the create workspace now
  owns plan lifecycle state: idle/loading/ready/error, current immutable plan,
  language-neutral status payloads, warning snapshots, revision issuance, plan
  request readiness, and stale result/error acceptance guards.
- Updated `src/main.ts` so `queuePlanRun`, `runPlan`, source mutations,
  quick-create review, destination edit recovery, and create validation/start
  errors route through the workspace. `main.ts` still owns debounce timers, DOM
  option reads, browser preview fixtures, command execution, rendering, and
  localized text.
- Added `src/app/workspaces/createWorkspace.test.ts` coverage for no-source
  readiness, revision/loading state, request construction from source plus
  option input, current result/error acceptance, stale result/error ignoring,
  source-change plan reset, warning exposure, destination-edit recovery, and
  immutable plan snapshots.
- Validation run: `git diff --check` passed with line-ending warnings only;
  `npm.cmd run test:frontend` passed with 28 files and 271 tests;
  `npm.cmd run build` passed.
- Slice 4 remains active/partial. Still pending: included/excluded archive
  paths and partial folder inclusion state, create-plan folder navigation/tree
  expansion, destination/options/readiness, and `StartCreateRequest`
  construction through the workspace interface.

### 2026-07-08 Slice 4 Worker 12

- Extended `src/app/workspaces/createWorkspace.ts` so the create workspace now
  owns excluded archive paths, include/exclude path mutations, include-all and
  exclude-all mutations, current-folder inclusion toggles, row/path inclusion
  state, current-folder include-all control facts, filtered plan snapshots, and
  included entry snapshots.
- Accepted plan results now prune excluded archive paths to the new plan, stale
  plan results leave inclusion untouched, and source changes clear inclusion
  state along with resetting the plan lifecycle.
- Updated `src/main.ts` so create summaries, include-all controls, row badges and
  checkboxes, context-menu include/exclude actions, plan summaries, and existing
  `StartCreateRequest` construction read inclusion facts from the workspace.
  Rendering, localization, DOM event decoding, and command execution remain in
  `main.ts`.
- Added `src/app/workspaces/createWorkspace.test.ts` coverage for single-file
  include/exclude, folder excluded/partial/included transitions, include-all and
  exclude-all, current-folder include-all facts, filtered plan counts/bytes,
  pruning on accepted plan results, stale result protection, source-change
  clearing, and immutable excluded-path snapshots.
- Validation run: `git diff --check` passed with line-ending warnings only;
  `npm.cmd run test:frontend` passed with 28 files and 280 tests;
  `npm.cmd run build` passed.
- Slice 4 remains active/partial. Still pending: create-plan folder
  navigation/tree expansion, destination/options/readiness, and
  `StartCreateRequest` construction through the workspace interface.

### 2026-07-08 Slice 4 Worker 13

- Extended `src/app/workspaces/createWorkspace.ts` so the create workspace now
  owns create-plan folder navigation, expanded tree folder state, visible rows,
  and tree folder snapshots. Navigation normalizes and rejects invalid folders,
  keeps the active branch expanded, resets on source/plan loss, and reconciles
  current folders against accepted plan results.
- Updated `src/main.ts` to consume the create workspace view snapshot for
  visible create-plan rows and tree rendering, and to call workspace navigation
  and tree-toggle methods instead of mutating create navigation globals.
- Added `src/app/workspaces/createWorkspace.test.ts` coverage for valid and
  invalid navigation, root and nested visible rows, tree folder snapshots,
  active-branch expansion protection, reset behavior, and preserving/resetting
  current folders across accepted plan results.
- Validation run: `git diff --check` passed with line-ending warnings only;
  `npm.cmd run test:frontend` passed with 28 files and 286 tests;
  `npm.cmd run build` passed.
- Slice 4 remains active/partial. Still pending: destination/options/readiness
  and `StartCreateRequest` construction through the workspace interface.

### 2026-07-08 Slice 4 Worker 14

- Extended `src/app/workspaces/createWorkspace.ts` so the create workspace owns
  create destination path state, format/default option state, compression and
  volume option normalization, TZAP recovery facts, password option
  visibility/disabled facts, and language-neutral create readiness including
  submission-in-flight state.
- Updated `src/main.ts` so create form controls are rendered from the workspace
  option snapshot and DOM events call workspace methods for defaults, format
  changes, destination edits/suggestions, option updates, and create readiness.
  Password text remains DOM-only; `StartCreateRequest` is still constructed in
  `runCreate` for the next checklist item.
- Added `src/app/workspaces/createWorkspace.test.ts` coverage for per-format
  defaults, destination suggestions, extension changes, password/TZAP
  visibility, numeric normalization, readiness transitions, submission state,
  destination-edit recovery, and snapshot password exclusion.
- Validation run: targeted `npm.cmd run test:frontend --
  src/app/workspaces/createWorkspace.test.ts` passed with 42 tests;
  `npm.cmd run test:frontend` passed with 28 files and 293 tests;
  `npm.cmd run build` passed; `git diff --check` passed with line-ending
  warnings only.
- Slice 4 remains active/partial. Still pending: `StartCreateRequest`
  construction through the workspace interface.

### 2026-07-08 Slice 4 Worker 15

- Added `StartCreateRequest` construction to
  `src/app/workspaces/createWorkspace.ts`, including destination extension,
  state/readiness validation, language-neutral unavailable reasons, workspace
  inclusion exclusions, password support filtering, TZAP defaults, and a
  stateless quick-create helper.
- Updated `src/main.ts` so normal create and quick create no longer call the
  lower-level `buildStartCreateRequest` helper directly; they now use the
  create workspace interface while preserving job startup, destination history,
  progress/output actions, and password-field clearing side effects.
- Added `src/app/workspaces/createWorkspace.test.ts` coverage for successful
  start request building, destination extension, excluded paths, unsupported
  password formats, password mismatch and unavailable reasons, password-free
  snapshots, and the quick-create helper.
- Validation run: targeted `npm.cmd run test:frontend --
  src/app/workspaces/createWorkspace.test.ts` passed with 50 tests;
  `npm.cmd run test:frontend` passed with 28 files and 301 tests;
  `npm.cmd run build` passed; `git diff --check` passed with line-ending
  warnings only.
- Slice 4 is complete and review-ready. Next smallest safe action: begin Slice
  5 by moving shell workspace or path-history state behind the planned app
  modules.

### 2026-07-08 Slice 4 Completion Gate Worker 16

- Removed the remaining create workflow compatibility mirror globals from
  `src/main.ts`: sources, plan state/current/error, current create folder, and
  plan revision now stay behind the create workspace snapshot.
- Updated create render/action code to derive plan status, current folder,
  inclusion controls, table/tree loading text, source-path removal, and
  quick-create review state from `createWorkspace` snapshots directly.
- Updated the GUI layout contract assertion that protected root-only source
  removal so it checks the snapshot-backed current-folder guard.
- Validation run: `npm.cmd run test:frontend` passed with 28 files and 301
  tests; `npm.cmd run build` passed.
- Slice 4 completion gate is now met, so Slice 4 remains complete and active
  work can continue in Slice 5.

### 2026-07-08 Slice 5 Worker 17

- Added `src/app/pathHistory.ts` for pure path-history normalization,
  record-prepending, duplicate removal, and max-size capping for extract
  destinations, create destinations, and recent archives.
- Updated `src/main.ts` so storage load/save and DOM rendering remain in the
  composition root, while loaded lists are normalized through `pathHistory.ts`
  and set/record operations are capped through named helpers.
- Added `src/app/pathHistory.test.ts` coverage for blank filtering, trimming,
  first-occurrence dedupe, duplicate records moving to the front, blank record
  ignores, and the existing 10/10/8 max sizes.
- Validation run: targeted `npm.cmd run test:frontend --
  src/app/pathHistory.test.ts` passed with 7 tests; `npm.cmd run
  test:frontend` passed with 29 files and 308 tests; `npm.cmd run build`
  passed; `git diff --check` passed with line-ending warnings only.
- Slice 5 remains active/partial. Still pending: shell workspace state,
  preview cleanup metadata, quick-action startup decisions, storage injection,
  and eventually moving the path-history arrays themselves out of `main.ts`.

### 2026-07-08 Slice 5 Worker 18

- Added `src/app/shell/shellWorkspace.ts` to own preview cleanup metadata as
  immutable plain snapshots, with methods for tracking, clearing, cleanup
  availability, before-next cleanup root checks, and cached preview reuse.
- Updated `src/main.ts` to remove the preview cleanup root/path/entry globals
  while keeping cleanup effects, desktop opening, lifecycle handling, and
  messages in the composition root.
- Added `src/app/shell/shellWorkspace.test.ts` coverage for empty state,
  set/clear, cleanup availability, cached preview matching, and snapshot
  immutability/serialization.
- Slice 5 remains active/partial. Still pending: broader shell workspace state,
  quick-action startup decisions, storage injection, and moving path-history
  arrays themselves out of `main.ts`.

### 2026-07-08 Slice 5 Worker 19

- Extended `src/app/shell/shellWorkspace.ts` to own active workspace mode and
  raw operational status text in immutable plain snapshots, with focused tests
  for defaults, updates, and serialization.
- Updated `src/main.ts` so workspace mode reads/writes and operational status
  rendering flow through the shell workspace while preserving translation and
  DOM rendering in the composition root.
- Slice 5 remains active/partial. Still pending: drop overlay state and pending
  choices, quick-action startup decisions, storage injection, and moving
  path-history arrays themselves out of `main.ts`.

### 2026-07-08 Slice 5 Worker 20

- Extended `src/app/shell/shellWorkspace.ts` to own drop overlay mode/copy and
  pending ask-action choices in immutable plain snapshots.
- Updated `src/main.ts` so drop overlay rendering, clearing, ask-action storage,
  and pending-choice activation flow through shell workspace state while keeping
  localized copy and DOM event handling in the composition root.
- Slice 5 remains active/partial. Still pending: quick-action startup
  decisions, storage injection, and moving path-history arrays themselves out
  of `main.ts`.

### 2026-07-08 Slice 5 Worker 21

- Extended `src/app/shell/shellWorkspace.ts` to own quick-action shell window
  mode/shown state and the pure startup reveal decision for normal vs compact
  job windows.
- Updated `src/main.ts` so startup quick-action reveal, compact job window
  transitions, backgrounding, normal-window restoration, and direct
  mode/background checks flow through shell workspace state while leaving job
  IDs, focused job contexts, polling, timers, and auto-close logic in
  `main.ts` for Slice 7.
- Added `src/app/shell/shellWorkspace.test.ts` coverage for quick-action
  window mode/shown snapshots, job-mode/background queries, and startup reveal
  decisions for existing jobs, direct job requests, errors, and non-job quick
  actions.
- Validation run: targeted `npm.cmd run test:frontend --
  src/app/shell/shellWorkspace.test.ts` passed with 15 tests; `npm.cmd run
  test:frontend` passed with 30 files and 323 tests; `npm.cmd run build`
  passed; `rg -n "let quickActionWindowMode|let quickActionWindowShown"
  src/main.ts` returned no matches.
- Slice 5 remains active/partial. Still pending: storage injection and moving
  path-history arrays themselves out of `main.ts`.

### 2026-07-08 Slice 5 Worker 22

- Extended `src/app/pathHistory.ts` from pure normalization helpers into an
  injected path-history store that owns extract destination, create
  destination, and recent archive snapshots plus storage load/save.
- Updated `src/main.ts` to instantiate the store at the composition root,
  remove the path-history arrays and path-history-specific `localStorage`
  helpers, and read immutable snapshots at render/defaulting seams.
- Added `src/app/pathHistory.test.ts` coverage for injected storage loading,
  persistence writes, blank record no-ops, no-storage operation, and immutable
  plain snapshots.
- Validation run: targeted `npm.cmd run test:frontend --
  src/app/pathHistory.test.ts` passed with 11 tests; targeted `npm.cmd run
  test:frontend -- src/app/shell/shellWorkspace.test.ts` passed with 15 tests;
  full `npm.cmd run test:frontend` passed with 30 files and 327 tests;
  `npm.cmd run build` passed; `rg -n "let extractDestinationHistory|let
  createDestinationHistory|let recentArchiveHistory|loadStringListFromStorage|saveStringListToStorage"
  src/main.ts` returned no matches.
- Slice 5 implementation checklist is complete.

### 2026-07-08 Slice 6 Worker 23

- Added `src/app/commands/commandRouter.ts` and
  `src/app/commands/commandRouter.test.ts` as the first command execution seam,
  while keeping command definitions, labels, menus, toolbar groups, and
  availability selection in `src/app/classicCommands.ts`.
- Routed menu and toolbar command-ID buttons through the router with injected
  effects for dialogs, navigation, archive actions, preferences, status
  reporting, clipboard-backed copy, sorting, flat view, jobs, and preview
  cleanup.
- Normalized disabled and unsupported command attempts through shared router
  outcomes and injected reporting effects.
- Validation run: targeted `npm.cmd run test:frontend --
  src/app/commands/commandRouter.test.ts src/app/classicCommands.test.ts`
  passed with 18 tests; full `npm.cmd run test:frontend` passed with 31 files
  and 331 tests; `npm.cmd run build` passed.
- Slice 6 remains active/partial. Still pending: route shortcuts, context
  menus, details-pane actions, tree actions, and row actions through command
  IDs plus payloads; complete the remaining execution switches; broaden router
  tests across every surface.

### 2026-07-08 Slice 6 Worker 24

- Added a pure `selectKeyboardCommand` classifier in
  `src/app/commands/commandRouter.ts` for global shortcuts that map to classic
  command IDs and payloads.
- Updated `src/main.ts` shortcut handling so Ctrl+O, Ctrl+N, Ctrl+A, F5,
  Ctrl+R, Backspace/Alt+ArrowUp, Enter preview, and F3 execute through the
  command router. Modal focus, Escape behavior, editable-target suppression,
  and Ctrl+F search focus remain local UI handling.
- Preserved the current Enter-before-Alt+Enter shortcut precedence while
  documenting it in router tests.
- Validation run: targeted `npm.cmd run test:frontend --
  src/app/commands/commandRouter.test.ts` passed with 7 tests; `npm.cmd run
  build` passed.
- Slice 6 remains active/partial. Still pending: route context menus,
  details-pane actions, tree actions, and row actions through command IDs plus
  payloads; broaden router tests across every surface.

### 2026-07-08 Slice 6 Worker 25

- Added a pure `selectDetailsCommand` classifier in
  `src/app/commands/commandRouter.ts` for details-pane actions that map to
  classic command IDs.
- Extended routed info execution with an `infoTarget` payload so details-pane
  archive info can force archive-level details while normal info/properties
  commands still use the current selection.
- Updated `src/main.ts` details-pane click handling to keep direct copy-value
  handling local and route open, preview, extract selected, test selected,
  properties, and archive info through the command router.
- Validation run: targeted `npm.cmd run test:frontend --
  src/app/commands/commandRouter.test.ts` passed with 10 tests; `npm.cmd run
  build` passed.
- Slice 6 remains active/partial. Still pending: route context menus, tree
  actions, and row actions through command IDs plus payloads; broaden router
  tests across every surface.

### 2026-07-08 Slice 6 Worker 26

- Added a pure `selectTreeCommand` classifier in
  `src/app/commands/commandRouter.ts` for explicit navigation-tree actions.
- Updated `src/main.ts` tree action handling so open/create tree buttons route
  through the command router, while folder navigation, tree expansion, and
  create-workspace source tree behavior remain local to their workspace/UI
  handlers.
- Validation run: targeted `npm.cmd run test:frontend --
  src/app/commands/commandRouter.test.ts` passed with 12 tests; `npm.cmd run
  build` passed.
- Slice 6 remains active/partial. Still pending: route context menus and row
  actions through command IDs plus payloads; broaden router tests across every
  surface.

### 2026-07-08 Slice 6 Worker 27

- Added a pure `selectContextCommand` classifier in
  `src/app/commands/commandRouter.ts` for context-menu actions that are classic
  command intents.
- Extended routed payloads for open sources (`dialog`, `clipboard`, path),
  extract destinations (`dialog`, `here`), and context info behavior.
- Updated `src/main.ts` context-menu handling so open, paste path, open recent,
  create, open outside, preview/view, select/deselect by type, extract,
  extract here/all, test, and info route through the command router. Folder
  navigation, column layout, source include/exclude, source removal, and reveal
  source remain local because they still carry context-specific UI/workspace
  payloads.
- Preserved previous context info behavior, including multi-selection info and
  archive-info fallback when no entry path is present.
- Validation run: targeted `npm.cmd run test:frontend --
  src/app/commands/commandRouter.test.ts` passed with 14 tests; `npm.cmd run
  build` passed.
- Slice 6 remains active/partial. Still pending: route row actions through
  command IDs plus payloads and decide whether remaining context-specific
  actions should gain command IDs or remain non-classic UI/workspace actions.

### 2026-07-08 Slice 6 Worker 28

- Routed table row preview activation through the command router's `view`
  command after row-specific selection/focus state has been updated locally.
- Updated row activation, single-click open, double-click preview, and context
  open-entry preview paths to call `runRoutedCommand("view")` instead of
  invoking preview directly.
- Left folder navigation, checkbox selection, focus movement, and context menu
  opening local because those are row interaction mechanics rather than classic
  command execution.
- Validation run: full `npm.cmd run test:frontend` passed with 31 files and
  341 tests; `npm.cmd run build` passed.
- Slice 6 remains active/partial. Still pending: remove per-command menu and
  toolbar binding churn, then decide whether remaining context-specific
  actions should gain command IDs or remain non-classic UI/workspace actions.

### 2026-07-08 Slice 6 Worker 29

- Consolidated routed command execution in `src/main.ts` behind
  `runRoutedCommand(commandId, payload)`, so keyboard, menu/toolbar, details,
  tree, context, row activation, and empty/info-dialog classic actions all use
  the same payload fallback and router status reporting path.
- Removed the remaining redundant per-command toolbar status assignments and
  unused toolbar button bindings for open/new/add/test/jobs/nav-up. The shared
  `[data-command-id]` click and state loops now own classic command buttons.
- Documented the remaining local action boundary in Slice 6: column UI
  mechanics, row/folder-specific navigation, create-source mutations,
  reveal-source, search/dialog/window/drop mechanics, quick-action controls,
  and `extract-folder`.
- Validation run: targeted `npm.cmd run test:frontend --
  src/app/commands/commandRouter.test.ts src/app/classicCommands.test.ts`
  passed with 28 tests; full `npm.cmd run test:frontend` passed with 31 files
  and 341 tests; `npm.cmd run build` passed.
- Useful scan: `rg -n "commandRouter\.run|runRoutedCommand\(" src/main.ts`
  shows the only direct `commandRouter.run` call is inside `runRoutedCommand`.
- Slice 6 is complete. Next smallest safe action: begin Slice 7 by moving job
  event merging or poll concurrency decisions behind `jobsWorkspace.ts`.

### 2026-07-08 Slice 7 Worker 30

- Added `src/app/workspaces/jobsWorkspace.ts` as the first deterministic jobs
  workspace foothold. It owns the job map plus retry contexts, output actions,
  and prompted password retry IDs while keeping password values out of
  workspace state.
- Updated `src/main.ts` to add jobs, merge poll snapshots, mark poll-read
  failures, remove/dismiss jobs, query retry eligibility, access output
  actions, and feed render helpers through `jobsWorkspace`. Timers,
  password-prompt UI, native window calls, focused quick-action job IDs,
  focused progress contexts, and auto-close behavior remain in `main.ts`.
- Added `src/app/workspaces/jobsWorkspace.test.ts` coverage for add/merge/fail
  state updates, cloned render seams, polling selection, password retry
  prompting, output action access, metadata cleanup, fixture replacement, and
  pause/resume status updates.
- Validation run: targeted `npm.cmd run test:frontend --
  src/app/workspaces/jobsWorkspace.test.ts src/app/jobs.test.ts` passed with 20
  tests; full `npm.cmd run test:frontend` passed with 32 files and 349 tests;
  `npm.cmd run build` passed.
- Useful scan: `rg -n "const jobs =|jobRetryContexts|jobOutputActions|
  promptedPasswordRetryJobs|jobs\.set|jobs\.delete|jobs\.clear|jobs\.size|
  jobs\.values\(" src/main.ts` returned no matches.
- Slice 7 remains active/partial. Still pending: move full poll concurrency
  state, focused quick-action job mode and auto-close decisions, progress clock
  snapshots, and timer/native/UI adapter boundaries.

### 2026-07-08 Slice 7 Worker 31

- Moved poll concurrency flags into `jobsWorkspace`: `beginPolling()` now owns
  pollable selection plus in-flight/request-again decisions, and
  `finishPolling()` clears in-flight state and reports whether `main.ts` should
  schedule the follow-up poll. `main.ts` still owns the timer, API calls,
  password prompts, native window effects, and render calls.
- Tightened the jobs workspace read boundary. Job state, retry context, output
  actions, password retry details, fixture inputs, polled snapshots, and failed
  events are cloned at workspace boundaries so callers no longer receive live
  mutable internal job/retry objects or internal arrays/maps.
- Added workspace tests for the new polling handshake, clear/reset behavior, and
  clone/detachment guarantees for returned and inbound job/retry data.
- Validation run: targeted `npm.cmd run test:frontend --
  src/app/workspaces/jobsWorkspace.test.ts src/app/jobs.test.ts` passed with 21
  tests; full `npm.cmd run test:frontend` passed with 32 files and 350 tests;
  `npm.cmd run build` passed.
- Useful scan: `rg -n "pollInFlight|pollAgainRequested"
  src/main.ts src/app/workspaces/jobsWorkspace.ts` shows both flags only inside
  `src/app/workspaces/jobsWorkspace.ts`, with no `main.ts` matches.
- Slice 7 remains active/partial. Still pending: focused quick-action job mode
  and auto-close decisions, progress clock snapshots, and further timer/native/UI
  adapter boundary cleanup.

### 2026-07-08 Slice 7 Worker 32

- Moved focused quick-action job IDs, focused progress context storage, focused
  controllable-job selection, auto-close action value, and pure quick-action
  completion decision selection into `jobsWorkspace`.
- Kept timer handles, `window.setTimeout/clearTimeout`, native close/reveal/
  minimize effects, DOM mutation, and localized quick-progress rendering in
  `src/main.ts`.
- Stored focused progress contexts as language-neutral request facts
  (paths/options/format/selection mode) in the workspace; `main.ts` now formats
  the existing labels, titles, and path previews at the render seam.
- Added workspace tests for focused quick-action tracking, context cloning,
  controllable IDs, completion/needs-attention decisions, auto-close action
  reset, and cleanup when tracked jobs are removed.
- Validation run: targeted `npm.cmd run test:frontend --
  src/app/workspaces/jobsWorkspace.test.ts src/app/jobs.test.ts` passed with 26
  tests; full `npm.cmd run test:frontend` passed with 32 files and 355 tests;
  `npm.cmd run build` passed.
- Useful scan: `rg -n
  "quickActionJobIds|focusedJobProgressContexts|quickActionAutoCloseAction"
  src/main.ts src/app/workspaces/jobsWorkspace.ts` shows no `src/main.ts`
  matches; remaining focused context storage is inside `jobsWorkspace`.
- Slice 7 remains active/partial. Still pending: progress clock snapshots and
  further timer/native/UI adapter boundary cleanup.

### 2026-07-08 Slice 7 Worker 33

- Moved progress-clock read decisions into `jobsWorkspace` via a plain
  `ProgressClockSnapshot`, and updated `main.ts` so `syncProgressClock()` starts
  or stops the real `window` interval from that snapshot while retaining timer
  ownership in `main.ts`.
- Added deterministic job-list and focused quick-progress read snapshots in
  `jobsWorkspace`. The focused quick-progress aggregate now owns the old
  `main.ts` progress math, including elapsed/remaining time, processed and
  total bytes/files, compressed bytes, speed, percent, active/paused/terminal
  flags, current file/status fallback, latest job, and cloned focused context.
  `main.ts` keeps localized labels, duration/byte/ratio formatting, and DOM
  rendering.
- Moved output action readiness into `jobsWorkspace`: ready actions now require
  a completed job plus valid action kind, integer index, and non-empty path.
  `main.ts` passes raw DOM dataset values to the workspace resolver and still
  performs only the native `openDesktopPath`/`revealInFileManager` effects.
- Updated `src/app/workspaces/jobsWorkspace.test.ts` coverage for progress clock
  snapshots, job-list read snapshots, focused quick-progress aggregate
  snapshots, cloned focused contexts, and output action readiness failures.
- Validation run: targeted `npm.cmd run test:frontend --
  src/app/workspaces/jobsWorkspace.test.ts src/app/jobs.test.ts` passed with 29
  tests; full `npm.cmd run test:frontend` passed with 32 files and 358 tests;
  `npm.cmd run build` passed.
- Useful scans: `rg -n "deriveJobProgress|progressSnapshots" src/main.ts`
  returned no matches; `rg -n "getOutputActions:|getOutputAction\\(|Number\\.isInteger\\(output"
  src/main.ts` shows `main.ts` rendering through
  `getReadyOutputActions()` and resolving output actions through
  `jobsWorkspace.getOutputAction()` with no direct output-index validation.
- Slice 7 remains active/partial. Still pending: deeper timer/native/UI adapter
  boundary cleanup; the existing `src/ui/jobsView.ts` row renderer still derives
  per-row progress internally until that UI seam is in scope.

### 2026-07-08 Slice 7 Worker 34

- Added local adapter-shaped seams in `src/main.ts` for the remaining concrete
  jobs effects: `jobTimers` owns polling/progress-clock/quick-action auto-close
  timer handles and `window` timer calls; `focusedJobWindowEffects` wraps the
  quick-action focused-window show/minimize/restore calls; `appWindowEffects`
  keeps the existing close/minimize/maximize window controls explicit; and
  `jobPasswordPrompts` plus `jobOutputEffects` wrap prompt UI and native
  open/reveal output actions.
- Preserved existing behavior: polling interval, progress clock interval,
  quick-action auto-close timeout, background/minimize/restore/reveal/close
  flows, quick-action password prompts, password retry prompts, and completed
  output open/reveal actions still execute in `main.ts` rather than the
  deterministic jobs workspace.
- Validation run: targeted `npm.cmd run test:frontend --
  src/app/workspaces/jobsWorkspace.test.ts src/app/jobs.test.ts` passed with 2
  files and 29 tests; full `npm.cmd run test:frontend` passed with 32 files and
  358 tests; `npm.cmd run build` passed.
- Useful scans: `rg -n
  "setTimeout|setInterval|getCurrentWindow|openDesktopPath|revealInFileManager|\bprompt\s*\(|i18n|message\("
  src/app/workspaces/jobsWorkspace.ts` returned no matches. `rg -n
  "jobTimers|focusedJobWindowEffects|jobPasswordPrompts|jobOutputEffects|window\.setInterval|window\.setTimeout|openDesktopPath|revealInFileManager|promptForArchivePassword"
  src/main.ts` shows job timer/native prompt/output effects grouped inside the
  new local seams; remaining `openDesktopPath`, `revealInFileManager`, and
  non-job `window.setTimeout` matches are preview, context-menu, modal, or
  debounce behavior outside Slice 7.
- Slice 7 is complete. Remaining `src/ui/jobsView.ts` row-render progress
  derivation is a UI view-adapter concern for Slice 9 rather than a jobs
  workspace determinism or effect-boundary blocker.

### 2026-07-08 Slice 8 Worker 35

- Added `src/app/display/displayContext.ts` as the first display seam. The
  snapshot owns resolved locale, translator, document language, document
  direction, and locale-bound bytes/date/ratio formatter functions.
- Routed `src/main.ts` through `displayContext`: it now recreates the display
  snapshot on locale preference changes, applies `documentElement.lang/dir`
  from the snapshot, applies translations with the snapshot translator, and
  uses snapshot formatters for bytes, dates, and compression ratios.
- Kept preference patching, storage, and workflow-default update flows in
  `main.ts` for later Slice 8 work. Command DTOs and workflow state remain on
  raw values; localized text is still used only at render/dialog seams.

### 2026-07-08 Slice 8 Worker 36

- Added `AppPreferencePatch` as the typed app-level preference patch seam and
  routed `src/main.ts` table saves, toolbar/flat-view patches, and full
  preferences-dialog saves through `preferencesWithPatch`.
- `saveTablePreferences()` now persists normalized table settings and refreshes
  the local table-column settings mirror from the normalized preference state.
- Added preference helper coverage for full preference-shaped dialog saves,
  including custom output trimming and table column normalization.
- Slice 8 remains active/partial. Locale/display refresh still lives in
  `main.ts` via the Worker 35 display seam, and the full preference UI flow has
  not moved out of the composition root.

### 2026-07-08 Slice 8 Worker 37

- Deepened `src/app/display/displayContext.ts` with a display refresh seam that
  creates/commits the display context, applies document metadata and static
  translations, refreshes command labels, and selects active browse/create,
  jobs, and preferences surfaces for rerender through injected callbacks.
- Replaced `src/main.ts` locale-refresh ownership with
  `refreshDisplayFromPreferences()`, leaving concrete DOM binding and render
  callbacks in `main.ts` while moving the refresh decision/order into the app
  display seam.
- Added `src/app/display/displayContext.test.ts` coverage for refresh surface
  selection, effect order, active-view rerender callbacks, and preserving raw
  archive sort/search/flat-view options across a display-context refresh.
- Validation run: targeted `npm.cmd run test:frontend --
  src/app/display/displayContext.test.ts src/app/preferences.test.ts
  src/ui/preferencesView.test.ts` passed with 20 tests; full
  `npm.cmd run test:frontend` passed with 33 files and 366 tests;
  `npm.cmd run build` passed.
- Useful scans: `rg -n "function applyLocaleFromPreferences|applyLocaleFromPreferences\\(|document\\.documentElement\\.lang|document\\.documentElement\\.dir|applyTranslations\\("
  src/main.ts src/app/display` returned no matches; `rg -n "let i18n|let
  resolvedLocale|createTranslator|resolveLocalePreference|localeDirection|formatBytesValue|formatDateValue|formatCompressionRatio"
  src/main.ts` returned no matches.
- Slice 8 remains active/partial. Remaining work: complete the stable raw value
  audit for workflow state and command DTOs. Residual UI gap: the display
  refresh behavior is covered through the app-level helper contract rather than
  a full browser/modal harness; that broader UI adapter coverage belongs with
  Slice 9 unless the raw-value audit exposes a narrower test seam.

### 2026-07-08 Slice 8 Worker 38

- Audited workflow and DTO/display boundaries for localized strings in
  `src/app/workspaces/*`, `src/app/commands/*`, `src/app/shell/*`,
  `src/app/preferences.ts`, `src/api/*`, and `src/main.ts` request/display
  seams.
- Found and fixed one clear workflow-state leak: shell drop overlay copy was
  storing translated `title`/`message`/support strings. `DropOverlayCopy` now
  stores stable `drop.*` message keys plus raw interpolation params, and
  `src/main.ts` translates them only while rendering the overlay.
- Added shell workspace regression coverage proving drop overlay copy remains
  language-neutral, detached from caller-owned params, frozen in snapshots, and
  serializable.
- Validation run: targeted `npm.cmd run test:frontend --
  src/app/display/displayContext.test.ts src/app/preferences.test.ts
  src/app/commands/commandRouter.test.ts
  src/app/workspaces/archiveWorkspace.test.ts
  src/app/workspaces/createWorkspace.test.ts
  src/app/workspaces/jobsWorkspace.test.ts
  src/app/shell/shellWorkspace.test.ts` passed with 7 files and 147 tests; full
  `npm.cmd run test:frontend` passed with 33 files and 367 tests; `npm.cmd run
  build` passed.
- Useful scans: `rg -n Translator src/app/workspaces src/app/commands
  src/app/shell src/app/preferences.ts src/api` returned no matches; `rg -n
  MessageKey src/app/workspaces src/app/commands src/app/shell
  src/app/preferences.ts src/api` shows only local raw message-key unions for
  workspace/shell status copy; `rg -n "message\\(" src/app/workspaces
  src/app/commands src/app/shell src/app/preferences.ts src/api` returned no
  matches; `rg -n "appPreferences\\s*=\\s*\\{" src/main.ts`, `rg -n
  "function applyLocaleFromPreferences|applyLocaleFromPreferences\\("
  src/main.ts`, and `rg -n
  "document\\.documentElement\\.lang|document\\.documentElement\\.dir|applyTranslations\\("
  src/main.ts` returned no matches.
- Slice 8 is complete. Next smallest safe action: begin Slice 9 by moving one
  render/event adapter surface out of `src/main.ts`, with the drop overlay,
  command surface, or preferences dialog as likely low-risk first candidates.

### 2026-07-08 Slice 9 Worker 39

- Added `src/ui/shellView.ts` as the first Slice 9 UI view-adapter foothold for
  the shell drop overlay. It owns drop-overlay dataset, visibility, ARIA role
  and modal attributes, title/message/support rendering through an injected
  message callback, action visibility, primary-action focus, and DOM click/Escape
  decoding into typed drop-overlay actions.
- Updated `src/main.ts` to build a typed shell view element bag, delegate
  `renderDropOverlay()` and drop-overlay action binding to `shellView`, and keep
  all drop intent decisions, pending-choice activation, and workflow effects in
  `main.ts`/the shell workspace.
- Added `src/ui/shellView.test.ts` coverage for idle/default, active with
  support text, choosing with action/dialog semantics, blocked target rendering,
  action decoding, Escape cancellation, and primary-action focus.
- Updated the GUI layout source-scan contract to assert that drop-overlay DOM
  ownership now lives in `src/ui/shellView.ts` while `main.ts` keeps the drop
  decision plumbing.
- Validation run: targeted `npm.cmd run test:frontend --
  src/ui/shellView.test.ts src/app/shell/shellWorkspace.test.ts` passed with 22
  tests; full `npm.cmd run test:frontend` passed with 34 files and 373 tests;
  `npm.cmd run build` passed.
- Useful scans: `rg -n
  "function renderDropOverlay|dropOverlay\\.addEventListener|dropOverlayTitle|dropOverlayMessage|dropOverlaySupport|dropOverlayActions"
  src/main.ts src/ui` shows the main wrapper plus the new UI adapter ownership;
  `rg -n "message\\(|displayContext|translator|Tauri|invoke"
  src/ui/shellView.ts` shows only the injected `message` callback and no runtime
  display/Tauri dependency.
- Slice 9 remains active/partial. Next smallest safe action: move another
  bounded render or DOM-decoding surface, such as command surface binding,
  context-menu placement, or a workspace table view seam, without moving
  workflow decisions.

### 2026-07-08 Slice 9 Worker 40

- Added `src/ui/modalController.ts` for generic modal DOM behavior: dialog
  surface lookup, visible/focusable element discovery, initial focus, focus
  trapping, return focus, default/cancel button activation, Escape cancellation,
  and focus containment.
- Updated `src/main.ts` to instantiate the modal controller with app-specific
  dialog lists, fallback focus targets, context-menu return-focus exclusion, and
  extract-dialog close cleanup. Extract-specific safe text-input Enter handling
  remains in `main.ts`.
- Added `src/ui/modalController.test.ts` coverage for open/close focus restore,
  ignored return-focus roots, Tab trapping, default/cancel activation, fallback
  close behavior, focus containment, and exported helper behavior.
- Updated the GUI layout source-scan contract to assert modal DOM ownership in
  `src/ui/modalController.ts` while `main.ts` retains extract workflow decisions.
- Validation run: targeted `npm.cmd run test:frontend --
  src/ui/modalController.test.ts` passed with 7 tests; full
  `npm.cmd run test:frontend` passed with 35 files and 380 tests.
- Slice 9 remains active/partial. Next smallest safe action: move another
  bounded UI adapter surface, such as command surface binding or context-menu
  placement, while keeping workflow decisions in app/main/controller modules.

### 2026-07-08 Slice 9 Worker 41

- Added `src/ui/commandSurfaceView.ts` to own classic command surface DOM
  click decoding, menu-popover close signaling, label/tooltip refresh, disabled
  and ARIA state application, toggle pressed state, unsupported markers, and
  primary/secondary visual classes from render-ready inputs.
- Updated `src/main.ts` so command buttons and menu items bind through
  `bindCommandSurface()`, command display text refreshes through
  `refreshCommandSurfaceText()`, and command button state applies through
  `applyCommandSurfaceState()`. Command state selection, pressed values, visual
  class decisions, command routing, and workflow effects remain in `main.ts`
  and app modules.
- Added `src/ui/commandSurfaceView.test.ts` coverage for click decoding,
  invalid command IDs, menu-popover close signaling, label/tooltip refresh,
  fallback text behavior, disabled/ARIA state, pressed state, unsupported
  markers, and visual command classes.
- Slice 9 remains active/partial. Next smallest safe action: move another
  bounded UI adapter surface, such as context-menu placement/focus or one
  workspace render/update seam, while keeping workflow decisions out of UI
  modules.

### 2026-07-08 Slice 9 Worker 42

- Added `src/ui/contextMenuView.ts` to own generic context-menu DOM behavior:
  viewport clamping, first-item focus, return-focus restoration, hide/show DOM
  mechanics, keyboard traversal/activation, Escape/Tab hide, focusout hide, and
  `data-context-action` payload decoding.
- Updated `src/main.ts` so menu HTML construction, context entry/source state,
  command selection, and workflow action execution remain in main while the UI
  adapter emits decoded plain action payloads and a hide callback clears context
  state.
- Added `src/ui/contextMenuView.test.ts` coverage for placement clamp,
  first-item focus, return-focus behavior, dataset action decoding, keyboard
  navigation/activation/hide, and focusout hide.
- Slice 9 remains active/partial. Next smallest safe action: move another
  bounded UI adapter surface, such as details-pane actions, a tree-pane seam, or
  one workspace render/update seam, while keeping workflow decisions out of UI
  modules.

### 2026-07-08 Slice 9 Worker 43

- Added `src/ui/archiveWorkspaceView.ts` as a bounded archive table render
  foothold. It now owns the archive browser table header, min-width/colspan,
  start-empty visibility toggles, search count display, empty/loading/error
  rows, select-all checked/indeterminate state, and parent/folder/entry row
  HTML from render-ready inputs.
- Updated `src/main.ts` so `renderBrowseRows()` gathers the archive workspace
  snapshot, visible columns, translator/formatters, native drag attributes, and
  icon HTML helper, delegates table rendering to the UI adapter, and keeps
  archive workspace decisions, selection/focus logic, effects, tree/details
  rendering, and event handlers in `main.ts`/app modules.
- Added `src/ui/archiveWorkspaceView.test.ts` coverage for loading/error/no
  archive/start-empty states, search-empty versus folder-empty rows, select-all
  checked/indeterminate state, parent/folder/entry row datasets/classes/native
  drag attributes, and header labels/min-width.
- Updated `src/app/guiLayoutContracts.test.ts` source-scan expectations so the
  moved table DOM contracts are asserted against `src/ui/archiveWorkspaceView.ts`
  while workflow/search/detail ownership remains asserted in `src/main.ts`.
- Validation run: targeted `npm.cmd run test:frontend --
  src/ui/archiveWorkspaceView.test.ts src/app/archiveTable.test.ts
  src/app/workspaces/archiveWorkspace.test.ts` passed with 56 tests; full
  `npm.cmd run test:frontend` passed with 38 files and 396 tests;
  `npm.cmd run build` passed.
- Useful scans: `rg -n
  "function renderBrowseRows|function renderTableHeader|function renderNameCell|function renderCell|setArchiveEmptyStateVisible|tableMinimumWidth|tableColspan"
  src/main.ts src/ui/archiveWorkspaceView.ts` shows the table helpers in the UI
  adapter and only the thin `renderBrowseRows()` wrapper in `main.ts`; `rg -n
  "invoke|Tauri|archiveWorkspace\\.|runRoutedCommand|commandRouter|openNativeDialog"
  src/ui/archiveWorkspaceView.ts` returned no matches.
- Slice 9 remains active/partial. Next smallest safe action: move another
  bounded workspace view seam, such as details-pane rendering/actions,
  archive-tree rendering, or create workspace table rendering, while keeping
  workflow decisions out of UI modules.

### 2026-07-08 Slice 9 Worker 44

- Moved archive details-pane HTML rendering into `src/ui/archiveWorkspaceView.ts`
  with render-ready detail models, reusable detail-row/copy-button rendering,
  middle truncation, detail actions, and injected copy label/icon helpers.
- Updated `src/main.ts` so `renderDetails()` clears details in Compress mode,
  derives archive-specific rows, titles, icon HTML, preview availability,
  last-test status, and action IDs, then delegates DOM rendering to the UI
  adapter. Details-pane click routing and workflow decisions remain in
  `main.ts`/app modules.
- Extended `src/ui/archiveWorkspaceView.test.ts` for no-archive, hidden
  selection, archive summary icon/rows, synthetic folder, entry preview and
  no-preview states, multiple-selection actions, escaping, copy attributes, and
  middle-truncated sr-only path values.
- Updated GUI source-scan contracts so details value/action markup is asserted
  against the UI adapter while action IDs and row derivation stay asserted
  against `src/main.ts`.
- Validation run: targeted `npm.cmd run test:frontend --
  src/ui/archiveWorkspaceView.test.ts src/app/workspaces/archiveWorkspace.test.ts`
  passed with 47 tests; full `npm.cmd run test:frontend` passed with 38 files
  and 403 tests; `npm.cmd run build` passed.
- Useful scans: `rg -n
  "function renderDetails|function renderDetailRows|function renderDetailDefinition|type DetailRow|middleTruncateDetailValue|detailValueMode"
  src/main.ts src/ui/archiveWorkspaceView.ts` shows detail render helpers in
  the UI adapter and only the thin `renderDetails()` adapter in `main.ts`;
  `rg -n
  "invoke|Tauri|archiveWorkspace\\.|runRoutedCommand|commandRouter|openNativeDialog"
  src/ui/archiveWorkspaceView.ts` returned no matches.
- Slice 9 remains active/partial. The archive browser checkbox stays unchecked
  because archive tree rendering and several browser update seams still remain
  outside UI view adapters.

### 2026-07-08 Slice 9 Worker 45

- Moved archive and create navigation-tree HTML rendering into
  `src/ui/archiveWorkspaceView.ts` with render-ready tree folder models,
  injected empty messages, injected icon HTML, and fixed archive/create data
  attribute configs.
- Updated `src/main.ts` so `renderTree()` and `renderCompressSourceTree()`
  still derive workspace state, source snapshots, root labels, active folders,
  disclosure eligibility, and native icon data, then delegate DOM writes to the
  UI adapter. Tree click/keydown routing and navigation decisions remain in
  `main.ts`/app modules.
- Extended `src/ui/archiveWorkspaceView.test.ts` for archive empty state,
  archive root placeholder/disclosure/active/icon behavior, escaped tree labels,
  create empty/loading/no-entry messages, and create folder/root label/data
  attributes.
- Validation run: targeted `npm.cmd run test:frontend --
  src/ui/archiveWorkspaceView.test.ts
  src/app/workspaces/archiveWorkspace.test.ts
  src/app/workspaces/createWorkspace.test.ts` passed with 102 tests; full
  `npm.cmd run test:frontend` passed with 38 files and 408 tests;
  `npm.cmd run build` passed.
- Useful scans: `rg -n
  "function renderTree|function renderCompressSourceTree|treeContentElement\\.innerHTML|tree-disclosure|data-tree-toggle|data-compress-tree-toggle"
  src/main.ts src/ui/archiveWorkspaceView.ts` shows tree markup and DOM writes
  in the UI adapter, with thin delegating functions and event selectors left in
  `main.ts`; `rg -n
  "invoke|Tauri|archiveWorkspace\\.|createWorkspace\\.|runRoutedCommand|commandRouter|openNativeDialog"
  src/ui/archiveWorkspaceView.ts` returned no matches.
- Slice 9 remains active/partial. The archive browser checkbox stays unchecked
  because path bar rendering, details/table model preparation, and several
  browser update seams still remain outside UI view adapters.

### 2026-07-08 Slice 9 Worker 46

- Added `src/ui/createWorkspaceView.ts` as a bounded create-workspace view
  adapter for source-list rendering, source-remove DOM event decoding, create
  action/status DOM updates, create plan summary/status HTML, and create
  destination history controls.
- Updated `src/main.ts` so create workspace state/readiness derivation,
  source mutations, path-history snapshots, and async plan orchestration remain
  in `main.ts`/app layers while DOM writes for those bounded create seams
  delegate to the UI adapter.
- Added `src/ui/createWorkspaceView.test.ts` covering empty and non-empty source
  lists, escaping, remove-button data attributes and click decoding, ready and
  warning action status states, plan status/summary escaping, warnings, empty
  samples, and destination history rendering.
- Slice 9 remains active/partial. The create workspace checkbox should stay
  unchecked because the complex compress source table/browser rendering,
  selection/focus synchronization, and row-level event handling still remain in
  `src/main.ts`.

### 2026-07-08 Slice 9 Worker 47

- Moved compress source table body rendering into
  `src/ui/createWorkspaceView.ts`, covering empty-source, planning,
  folder-empty, parent, folder, and entry rows with render-ready row models.
- Updated `src/main.ts` so create workspace snapshots, plan/readiness checks,
  selection/focus state, source-path derivation, inclusion decisions,
  localization, formatting, icon selection, event handlers, and inclusion/column
  DOM sync remain in the composition/app seams while table DOM writes delegate
  to the UI adapter.
- Extended `src/ui/createWorkspaceView.test.ts` for empty/planning/folder-empty
  table states, parent row escaping/aria, folder selected/focused/excluded/
  partial cases, source-path attributes, inclusion checkbox state/aria, escaped
  names/icon labels/badges, entry detail columns, and omitted empty source-path
  attributes. Updated `src/app/guiLayoutContracts.test.ts` so the layout
  contract follows the new split between UI markup and main-side row-model
  preparation.
- Validation run: targeted `npm.cmd run test:frontend --
  src/ui/createWorkspaceView.test.ts
  src/app/workspaces/createWorkspace.test.ts
  src/app/guiLayoutContracts.test.ts` passed with 85 tests; full `npm.cmd run
  test:frontend` passed with 39 files and 421 tests; `npm.cmd run build`
  passed.
- Useful scans: `rg -n
  "compressSourceBody\\.innerHTML|renderCompressPlanRow|renderCompressInclusionCheckbox|renderCompressPlanNameCell"
  src/main.ts` returned no matches; `rg -n
  "invoke|Tauri|archiveWorkspace\\.|createWorkspace\\.|runRoutedCommand|commandRouter|openNativeDialog|localStorage|password"
  src/ui/createWorkspaceView.ts` returned no matches.
- Slice 9 remains active/partial. The create workspace checkbox stays unchecked
  because create option/control DOM sync, compress table inclusion/focus sync,
  and column resizing still remain in `src/main.ts`, even though the meaningful
  compress source table body markup has moved to the UI adapter.

### 2026-07-08 Slice 9 Worker 48

- Moved create option-control DOM sync for archive format, cleanup/safety
  toggles, compression level, split-volume size, TZAP recovery visibility/state,
  and password option-container visibility into `src/ui/createWorkspaceView.ts`.
- Added a password-free option-control decoder in `src/ui/createWorkspaceView.ts`
  so `src/main.ts` can pass non-secret create option patches to the create
  workspace while retaining workspace mutation, plan refresh/queueing, password
  field clearing, and password field type toggling in `src/main.ts`.
- Extended `src/ui/createWorkspaceView.test.ts` to cover option render/sync
  behavior, `null` optional numeric values becoming empty strings, numeric
  stringification, TZAP hidden/disabled/value states, boolean-only password
  option visibility, and decoder output that contains no password fields.
- Slice 9 remains active/partial. The create workspace checkbox stays unchecked
  because create table inclusion/focus synchronization and column resizing still
  remain in `src/main.ts`.

### 2026-07-08 Slice 9 Worker 49

- Moved compress source table DOM sync and lookup helpers into
  `src/ui/createWorkspaceView.ts`: include-all checkbox state render/read,
  per-row inclusion indeterminate sync, selected/focused row class and
  `aria-selected` sync from readonly path arrays, row/selectable-row queries,
  path-based row lookup, and first-row focusing.
- Updated `src/main.ts` so `selectedCompressRows`, `focusedCompressRowPath`,
  `compressSelectionAnchorPath`, hierarchical selection algorithms, inclusion
  decisions, and event handlers remain in the composition/app layer while row
  DOM updates and lookups delegate to the create workspace view adapter.
- Extended `src/ui/createWorkspaceView.test.ts` for include-all state and read
  decoding, row inclusion indeterminate sync, selected/focused class and ARIA
  updates, row query helpers, path lookup with selector-significant characters,
  and first-row focus behavior. Updated `src/app/guiLayoutContracts.test.ts`
  so the source-scan contract follows the new include-all ownership.
- Validation run: targeted `npm.cmd run test:frontend --
  src/ui/createWorkspaceView.test.ts
  src/app/workspaces/createWorkspace.test.ts
  src/app/guiLayoutContracts.test.ts` passed with 93 tests; full `npm.cmd run
  test:frontend` passed with 39 files and 429 tests; `npm.cmd run build`
  passed.
- Useful scans: `rg -n
  "compressIncludeAllInput\\.(checked|indeterminate|disabled)|querySelectorAll<HTMLTableRowElement>\\(\"tr\\[data-compress|classList\\.toggle\\(\"is-selected\"|classList\\.toggle\\(\"is-focused-row\""
  src/main.ts` returned no matches when run with the `src/main.ts` glob; `rg -n
  "invoke|Tauri|archiveWorkspace\\.|createWorkspace\\.|runRoutedCommand|commandRouter|openNativeDialog|localStorage|passwordInput|passwordConfirm|\\.value.*password|password.*\\.value"
  src/ui/createWorkspaceView.ts` returned no matches.
- Slice 9 remains active/partial. The create workspace checkbox stays unchecked
  because column resizing and other meaningful create UI update mechanics still
  remain in `src/main.ts`.

### 2026-07-08 Slice 9 Worker 50

- Moved compress source table column geometry/style DOM helpers into
  `src/ui/createWorkspaceView.ts`: escaped header lookup by
  `data-compress-column-id`, rendered column-width measurement with
  default/min/max clamping, and CSS custom property plus table `minWidth`
  application.
- Updated `src/main.ts` so compress source column width state, column id
  validation, and pointer resize lifecycle remain in the composition root while
  DOM query/measurement/style writes delegate to the create workspace view
  adapter.
- Extended `src/ui/createWorkspaceView.test.ts` for rendered width measurement,
  fallback/default behavior, min/max clamping, CSS variable/min-width
  application, and tricky column id escaping. Updated
  `src/app/guiLayoutContracts.test.ts` to keep the moved query/style ownership
  asserted.
- The Slice 9 create-workspace render/update checklist item is now checked:
  meaningful create source list, action/status, plan summary, destination
  history, option control, compress table body, inclusion/selection sync, and
  column geometry/style update mechanics live in UI modules. Secret password
  values, event orchestration, workspace mutation, and async planning remain in
  `src/main.ts` by design.
