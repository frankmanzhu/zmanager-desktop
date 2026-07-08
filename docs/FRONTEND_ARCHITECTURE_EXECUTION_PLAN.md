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
  create-plan selection, create-plan revision state, job polling concurrency,
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
| 0 | Guardrails and characterization | Not started | Risky current behavior has tests or explicit smoke coverage. |
| 1 | Stable hierarchical row identity | Not started | Archive and create visible row derivation share `src/app/hierarchicalTable.ts`. |
| 2 | Table selection and focus | Not started | Archive/create table selection globals leave row event handlers. |
| 3 | Archive workspace | Not started | Archive browsing state and request readiness move behind `archiveWorkspace.ts`. |
| 4 | Create workspace | Not started | Create sources, plan revision, inclusion, options, and request construction move behind `createWorkspace.ts`. |
| 5 | Shell workspace and path histories | Not started | Mode, status, drop state, histories, preview cleanup metadata move out of `main.ts`. |
| 6 | Command router | Not started | Toolbar, menus, shortcuts, context menus, details, tree, and row actions execute through one router. |
| 7 | Jobs workspace | Not started | Job merge, retry, polling decisions, quick-action state move behind `jobsWorkspace.ts`. |
| 8 | Settings and display context | Not started | Preferences and locale/display refresh flow through one seam. |
| 9 | UI view adapters | Not started | `main.ts` mostly binds intents and renders snapshots. |
| 10 | Desktop adapters and controllers | Not started | Tauri imports are concentrated in `src/api` and `src/desktop`; controllers use injected adapters. |

Active slice: 0

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

- [ ] Identify current archive row behavior that must not regress: root rows,
  nested rows, parent row, synthetic folders, flat view, search view, duplicate
  basenames, selected-hidden-during-search behavior.
- [ ] Identify current create-plan row behavior that must not regress: source
  path mapping, folder navigation, included/excluded paths, partial folder
  state, empty/loading/error states.
- [ ] Confirm command state coverage for browse, create, job, menu, details,
  and row-action representative commands.
- [ ] Confirm create-plan revision tests cover stale plan results and
  destination edits.
- [ ] Confirm job polling tests cover in-flight poll, poll-again request, retry
  context, and quick-action focused jobs.
- [ ] Confirm drop-intent tests cover archive drop, create-source drop, and
  ambiguous drop choices.

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

- [ ] Define explicit row IDs so parent rows cannot collide with real archive
  paths.
- [ ] Support parent rows, folder rows, entry rows, synthetic folders, current
  folder mode, flat mode, and search mode.
- [ ] Keep archive-specific columns and sorting outside the shared table
  module.
- [ ] Keep create source-path mapping and inclusion state outside the shared
  table module.
- [ ] Replace archive visible row derivation with the shared module while
  preserving row order.
- [ ] Replace create-plan visible row derivation with the shared module while
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

- [ ] Move visible selectable path calculation into the table module.
- [ ] Move click replacement, ctrl/meta toggle, shift range, select all,
  invert visible, and visible cleanup into the table module.
- [ ] Move focus movement and anchor updates into table intents.
- [ ] Preserve hidden-selection behavior during search unless the product
  decision changes.
- [ ] Keep marquee DOM hit testing and native drag gesture detection in UI code,
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

- [ ] Move archive load state, error state, current archive path, and listing
  metadata into the workspace.
- [ ] Move folder navigation, breadcrumbs, search, flat view, expanded tree
  folders, table sort snapshot, selection snapshot, and details model into the
  workspace.
- [ ] Move password-required retry state into the workspace without storing
  password values.
- [ ] Add extract, test, preview, open-outside, and native-drag readiness
  builders that return serializable requests or unavailable reasons.
- [ ] Feed command state from an archive workspace snapshot.

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

- [ ] Move source paths and source removal state.
- [ ] Move plan request readiness, plan revision, stale-result guards, plan
  errors, and warnings.
- [ ] Move included/excluded archive paths and partial folder inclusion state.
- [ ] Move create-plan folder navigation and expanded tree folders.
- [ ] Move destination suggestion/readiness, per-format defaults, compression
  options, TZAP options, password option visibility, and create readiness.
- [ ] Build `StartCreateRequest` only through the workspace interface.

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

- [ ] Move active workspace mode and app-wide status.
- [ ] Move drop overlay state and pending drop choices.
- [ ] Move recent archive, extract destination, and create destination history
  normalization into `pathHistory.ts`.
- [ ] Move preview cleanup root/path metadata into shell state.
- [ ] Move quick-action startup mode decisions into shell state.
- [ ] Inject storage access instead of calling local storage from workflow code.

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

- [ ] Keep command definitions and labels in `src/app/classicCommands.ts`.
- [ ] Move command execution switches into `commandRouter.ts`.
- [ ] Route toolbar buttons, menu items, shortcuts, context menus, details pane,
  tree actions, and row actions through command IDs plus payloads.
- [ ] Use injected effects for dialogs, API calls, desktop actions, status
  messages, clipboard, and window actions.
- [ ] Normalize unsupported and disabled command behavior.

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

- [ ] Move job event merging and job map updates.
- [ ] Move pollable job selection and poll concurrency decisions.
- [ ] Move retry contexts, password retry eligibility, and prompted retry job
  IDs.
- [ ] Move focused quick-action job mode and auto-close decision.
- [ ] Move progress clock snapshot and job output action readiness.
- [ ] Keep timers, password prompt UI, and native window calls as adapters.

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

- [ ] Centralize preference patch normalization.
- [ ] Add display context snapshot for resolved locale, translator, formatter,
  document language, and direction.
- [ ] Ensure table settings, toolbar settings, create defaults, and extraction
  defaults update through typed preference state.
- [ ] Ensure workflow state and DTOs use stable raw values, not localized
  labels.
- [ ] Ensure display context changes rerender active views without changing
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
- [ ] Move create workspace render/update functions into UI modules.
- [ ] Move command surface binding into UI modules that emit command IDs.
- [ ] Move context-menu placement and keyboard focus into UI modules.
- [ ] Move generic modal focus trap, return focus, default/cancel, and Escape
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
