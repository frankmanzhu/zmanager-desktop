# React GUI Execution Plan

Date: 2026-07-09

Companion docs:

- `docs/REACT_GUI_MIGRATION.md`
- `docs/FRONTEND_ARCHITECTURE_DEEPENING_PLAN.md`
- `docs/FRONTEND_ARCHITECTURE_EXECUTION_PLAN.md`

## Purpose

Migrate the ZManager Desktop GUI from imperative HTML/CSS/TypeScript rendering
to React 19, shadcn/ui-style components, and Tailwind CSS v4 without moving
archive semantics out of Rust or workflow state out of `src/app`.

This plan starts from the current bridge:

- `src/main.ts` is a small React composition root.
- `src/ui/react/AppShell.tsx` mounts the current app.
- `src/runtimeBridge.ts` contains the remaining controller/runtime bridge.

The goal is to delete visible imperative GUI scaffolding once every visible
surface is rendered by React components backed by existing app/workspace
snapshots and controllers.

## Execution Rules

- Migrate one surface at a time.
- Add characterization coverage before moving behavior out of the runtime
  bridge.
- Keep React components mostly presentational: render snapshots, emit typed
  intents, and call injected handlers.
- Do not put passwords, Tauri promises, DOM nodes, mutable `Set`/`Map`, or
  localized labels into workspace snapshots.
- Do not import Tauri outside `src/api` and `src/desktop`.
- Route new command controls through `src/app/commands/commandRouter.ts`.
- Use shadcn-style primitives in `src/ui/components/ui`.
- Import Tailwind CSS only for React surfaces that are ready for its global
  style effects.
- Run `npm.cmd run test:frontend`, `npm.cmd run build`, and
  `npm.cmd run ast:lint` before marking a phase complete.

## Target Shape

```text
src/main.ts
  Small React composition root.

src/ui/react/AppShell.tsx
  Creates the React app shell and wires app/controller/store providers.

src/ui/react/shell/*
  Titlebar, menu bar, toolbar, mode switch, path/status/drop shell.

src/ui/react/archive/*
  Archive tree, path bar, search, table, details, extract/info dialogs.

src/ui/react/create/*
  Source list, create plan tree/table, options, destination, validation.

src/ui/react/jobs/*
  Jobs drawer, quick-action progress panel, job rows, job actions.

src/ui/react/preferences/*
  Preferences pages, validation, display and create/extract defaults.

src/ui/components/ui/*
  shadcn-style reusable controls.

src/app/*
  Workflow state, command routing, controllers, display context.

src/api/*
src/desktop/*
  Tauri invoke wrappers and concrete desktop adapters.
```

## Phase Ledger

| Phase | Name | Status | Primary Gate |
| --- | --- | --- | --- |
| 0 | React bridge and tooling | Complete | React root boots existing workspace through `AppShell`. |
| 1 | React app runtime seam | Complete | React can subscribe to app snapshots and dispatch typed intents without owning workflow state. |
| 2 | Shell chrome and command surfaces | Complete | Titlebar/menu/toolbar/mode/status render in React and route through command router. |
| 3 | Archive browse workspace | Complete | Archive tree/path/search/table/details render in React from archive snapshots. |
| 4 | Extract, info, preview, and dialogs | Complete | Archive dialogs render in React while request building stays in workspaces/controllers. |
| 5 | Create workspace | Complete | Source list, plan browser, options, destination, and validation render in React. |
| 6 | Jobs and quick-action progress | Complete | Jobs drawer/status/progress render in React from jobs workspace snapshots. |
| 7 | Preferences and display refresh | Complete | Preferences render in React and locale/display refresh is snapshot-driven. |
| 8 | Drop, context menus, keyboard, and drag | Complete | Cross-surface interaction adapters are React-owned and workflow-free. |
| 9 | Typed Rust/TS command contract | Complete | DTO drift is guarded by generated bindings or explicit contract tests. |
| 10 | Delete legacy GUI | In Progress | Runtime bridge scaffolding is removed and no tests inspect legacy HTML. |
| 11 | Visual QA and release gate | Pending | Desktop and browser smoke checks pass on supported platforms. |

Active phase: 10

## Phase 0: React Bridge And Tooling

Status: Complete.

Completed:

- Added React 19, React DOM, lucide-react, Vite React plugin, Tailwind v4, and
  shadcn-style helper dependencies.
- Upgraded Vite to v8.
- Added `src/main.ts` as the React composition root.
- Added `src/ui/react/AppShell.tsx`.
- Moved the old imperative app into `src/legacyMain.ts`.
- Added `components.json`, `src/lib/utils.ts`, first `Button` primitive, and
  `src/styles.tailwind.css`.
- Added `npm run ast:lint` and a first Tauri-import ast-grep guardrail.

Validation already run:

```powershell
npm.cmd run test:frontend
npm.cmd run build
npm.cmd run ast:lint
```

Manual smoke:

- Browser loaded `http://127.0.0.1:5174/`.
- Playwright confirmed `.zmanager-react-shell[data-legacy-state="ready"]` and
  `#zmanager-legacy-root .workspace`.

## Phase 1: React App Runtime Seam

Status: Complete.

Goal: create the state/render bridge React needs before moving visible screens.

Why first: direct component rewrites without a shared runtime seam would push
workflow state into React components. This phase prevents that.

Likely files:

- `src/ui/react/AppShell.tsx`
- `src/ui/react/appRuntime.ts`
- `src/ui/react/appStore.ts`
- `src/ui/react/AppProviders.tsx`
- `src/runtimeBridge.ts`
- Existing app/controller modules as sources of snapshots and commands.

Checklist:

- [x] Define a `ZManagerReactSnapshot` that combines shell, archive, create,
  jobs, preferences/display, and command-state snapshots.
- [x] Define a `ZManagerReactActions` interface for command execution,
  workspace intents, dialogs, and desktop-triggered events.
- [x] Add a tiny subscription store using `useSyncExternalStore` or equivalent
  so React can render snapshots without owning workflow state.
- [x] Expose the existing legacy boot/render loop through an adapter that can
  publish snapshots and accept typed intents.
- [x] Add tests proving React reads immutable snapshots and emits intents
  without importing Tauri or mutating workspaces directly.
- [x] Keep the legacy DOM mounted until at least one complete surface is
  replaced.

Completion gate:

- React components can render a synthetic app snapshot in tests.
- No React component imports `src/api` or `src/desktop`.
- `legacyMain.ts` is the only place still building legacy DOM for migrated
  surfaces.

Validation:

```powershell
npm.cmd run test:frontend
npm.cmd run build
npm.cmd run ast:lint
```

## Phase 2: Shell Chrome And Command Surfaces

Status: Complete.

Goal: move titlebar, app menu, command toolbar, mode switch, path/status shell,
and drop overlay shell chrome into React.

Likely files:

- `src/ui/react/shell/AppFrame.tsx`
- `src/ui/react/shell/TitleBar.tsx`
- `src/ui/react/shell/MenuBar.tsx`
- `src/ui/react/shell/CommandToolbar.tsx`
- `src/ui/react/shell/WorkspaceModeTabs.tsx`
- `src/ui/react/shell/StatusBar.tsx`
- `src/ui/react/shell/DropOverlay.tsx`
- `src/ui/components/ui/button.tsx`
- `src/ui/components/ui/dropdown-menu.tsx`
- `src/ui/components/ui/tooltip.tsx`

Checklist:

- [x] Add React window titlebar rendering while keeping window effects in
  `src/desktop/windowController.ts`.
- [x] Add menu rendering to React from `CLASSIC_MENU_GROUPS`.
- [x] Add toolbar rendering to React from `CLASSIC_TOOLBAR_GROUPS`.
- [x] Route every React menu/toolbar button through command router IDs and
  payloads.
- [x] Preserve disabled reasons, pressed state, primary/secondary command
  classes, keyboard shortcuts, and localization.
- [x] Add status bar rendering to React from shell/job/archive snapshots.
- [x] Add drop overlay rendering to React while preserving drop decisions in
  `shellWorkspace` and `dropIntent`.
- [x] Replace the live legacy shell chrome mount with the React shell frame.
- [x] Add tests for command routing from menu, toolbar, shortcut-facing command
  IDs, status rendering, and drop overlay choices.

Completion gate:

- Legacy shell/menu/toolbar/status/drop markup is gone from `legacyMain.ts`.
- Characterization tests inspect React components or snapshots instead of
  legacy string HTML for those surfaces.

Validation:

```powershell
npm.cmd run test:frontend
npm.cmd run build
npm.cmd run ast:lint
npm.cmd run test:e2e -- --grep "menu|toolbar|drop|status"
```

Verified:

```powershell
npm.cmd run test:frontend
npm.cmd run build
npm.cmd run ast:lint
npm.cmd run test:e2e -- e2e/gui-visual-scan.spec.ts --grep "primary GUI states"
```

Note: the exact combined Playwright grep is split/avoided on this Windows shell
because `cmd` treats the `|` alternation as a pipeline before Playwright sees
it. The primary GUI smoke exercises React shell drop/status/menu/toolbar paths.

## Phase 3: Archive Browse Workspace

Status: Complete.

Goal: migrate the main archive browsing screen to React.

Likely files:

- `src/ui/react/archive/ArchiveWorkspace.tsx`
- `src/ui/react/archive/ArchiveTree.tsx`
- `src/ui/react/archive/ArchivePathBar.tsx`
- `src/ui/react/archive/ArchiveSearch.tsx`
- `src/ui/react/archive/ArchiveTable.tsx`
- `src/ui/react/archive/ArchiveDetailsPane.tsx`
- `src/ui/react/archive/ArchiveEmptyState.tsx`
- `src/ui/react/table/HierarchicalTable.tsx`

Checklist:

- [x] Render archive tree from `ArchiveWorkspaceSnapshot`.
- [x] Render path bar and search/flat-view controls from snapshot and display
  context.
- [x] Render archive table rows using existing `hierarchicalTable` state and
  archive table column settings.
- [x] Preserve selection, focus, range selection, checkbox selection, keyboard
  movement, sort, column widths/order/visibility, and hidden-selection behavior.
- [x] Render details pane from existing details snapshot/model.
- [x] Preserve native file icon rendering and fallback icons.
- [x] Add tests for table row rendering, selection intents, sort intents,
  search controls, details actions, and empty/error/loading states.

Completion gate:

- Legacy archive browse rendering and event listeners are removed from
  `legacyMain.ts`.
- Archive workflow behavior remains covered through workspace tests; React
  tests cover rendering and intent decoding.

Validation:

```powershell
npm.cmd run test:frontend
npm.cmd run build
npm.cmd run ast:lint
npm.cmd run test:e2e -- --grep "archive|search|flat|selection|details"
```

Verified:

```powershell
npm.cmd run test:frontend
npm.cmd run build
npm.cmd run ast:lint
npm.cmd run test:e2e -- e2e/gui-visual-scan.spec.ts --grep "primary GUI states"
npm.cmd run test:e2e -- e2e/gui-visual-scan.spec.ts --grep "secondary GUI surfaces"
```

Note: the live archive browse surface is React-owned. The legacy archive DOM
scaffold is privatized and hidden in Extract mode so remaining create/dialog
plumbing can keep its captured refs until later phases remove those surfaces.

## Phase 4: Extract, Info, Preview, And Dialogs

Status: Complete.

Goal: migrate archive-related dialogs and overlays to React.

Likely files:

- `src/ui/react/archive/ExtractDialog.tsx`
- `src/ui/react/archive/InfoDialog.tsx`
- `src/ui/react/archive/AboutDialog.tsx`
- `src/ui/react/dialogs/ModalRoot.tsx`
- `src/ui/react/dialogs/PasswordPromptDialog.tsx`

Checklist:

- [x] Build shared React modal primitives with focus trap and return focus.
- [x] Move extract dialog UI to React while request construction remains in
  archive workspace/controller.
- [x] Move info/properties dialog rendering to React.
- [x] Move about diagnostics rendering to React without leaking secrets.
- [x] Move password retry prompt UI to React while password values remain
  transient and are never stored in snapshots.
- [x] Preserve Enter/Escape/default-button behavior, validation state, advanced
  options, and accessibility labels.
- [x] Add tests for extract validation, default/cancel behavior, password
  prompt cancellation, info details, and diagnostics copy text.

Completion gate:

- Legacy dialog HTML/event wiring for extract/info/about/password retry is
  removed from `legacyMain.ts`.

Validation:

```powershell
npm.cmd run test:frontend
npm.cmd run build
npm.cmd run ast:lint
npm.cmd run test:e2e -- --grep "extract|dialog|password|properties|about"
```

Verified:

```powershell
npm.cmd run test:frontend
npm.cmd run build
npm.cmd run ast:lint
npm.cmd run test:e2e -- e2e/gui-visual-scan.spec.ts --grep "primary GUI states"
npm.cmd run test:e2e -- e2e/gui-visual-scan.spec.ts --grep "secondary GUI surfaces"
```

Note: extract submit still bridges through the captured legacy form controls so
the existing extract start controller remains the request-construction owner.
The React snapshot never stores password values; password text stays local to
the React form until submit.

## Phase 5: Create Workspace

Status: Complete.

Goal: migrate the create/compress workspace to React.

Likely files:

- `src/ui/react/create/CreateWorkspace.tsx`
- `src/ui/react/create/SourceList.tsx`
- `src/ui/react/create/CreateOptionsPanel.tsx`
- `src/ui/react/create/CreateDestinationField.tsx`
- `src/ui/react/create/CreatePlanSummary.tsx`
- `src/ui/react/create/CreatePlanBrowser.tsx`

Checklist:

- [x] Render source list and source actions from `CreateWorkspaceSnapshot`.
- [x] Render destination field, recent destinations, validation, and browse
  actions through controller effects.
- [x] Render per-format options and password controls without persisting
  password values.
- [x] Render create plan tree/table using shared hierarchical table components.
- [x] Preserve include/exclude all, partial inclusion, source removal, source
  reveal, keyboard navigation, Delete behavior, and source context menus.
- [x] Preserve plan revision guards and stale-result behavior in controller and
  workspace tests.
- [x] Add React tests for source actions, option changes, destination changes,
  plan browser intents, and create readiness.

Completion gate:

- Legacy create/compress rendering and event wiring are removed from
  `legacyMain.ts`.

Validation:

```powershell
npm.cmd run test:frontend
npm.cmd run build
npm.cmd run ast:lint
npm.cmd run test:e2e -- --grep "create|compress|source|plan"
```

Verified:

```powershell
npm.cmd run test:frontend
npm.cmd run build
npm.cmd run ast:lint
npm.cmd run test:e2e -- e2e/gui-visual-scan.spec.ts --grep "primary GUI states"
npm.cmd run test:e2e -- e2e/gui-visual-scan.spec.ts --grep "secondary GUI surfaces"
npm.cmd run test:e2e -- e2e/gui-visual-scan.spec.ts --grep "create workspace rows preserve keyboard"
```

Note: the live create/compress surface is React-owned. The captured legacy
create DOM is still privatized as a bridge for the existing create controllers,
selection helpers, and context-menu actions until the later cleanup phases
remove the remaining legacy scaffolding. Password values stay local to React
state and are copied into the existing start controller only on submit.

## Phase 6: Jobs And Quick-Action Progress

Status: Complete.

Goal: migrate job drawer, status job button details, and quick-action focused
progress UI to React.

Likely files:

- `src/ui/react/jobs/JobsDrawer.tsx`
- `src/ui/react/jobs/JobRow.tsx`
- `src/ui/react/jobs/QuickActionProgress.tsx`
- `src/ui/react/jobs/JobOutputActions.tsx`

Checklist:

- [x] Render job list from `JobsWorkspace` snapshots.
- [x] Render cancel/pause/resume/retry-password/dismiss buttons through
  `jobControlController`.
- [x] Render focused quick-action progress and output actions.
- [x] Preserve progress clock updates through injected timer/adapters, not React
  workflow state.
- [x] Preserve quick-action auto-close decisions in jobs workspace/controller.
- [x] Add React tests for job actions, retry prompts, focused progress, and
  terminal job states.

Completion gate:

- Legacy jobs drawer and quick-action progress DOM are removed from
  `legacyMain.ts`.

Validation:

```powershell
npm.cmd run test:frontend
npm.cmd run build
npm.cmd run ast:lint
npm.cmd run test:e2e -- --grep "job|progress|quick"
```

Verified:

```powershell
npm.cmd run test:frontend
npm.cmd run build
npm.cmd run ast:lint
npm.cmd run test:e2e -- e2e/gui-visual-scan.spec.ts --grep "primary GUI states"
npm.cmd run test:e2e -- e2e/gui-visual-scan.spec.ts --grep "secondary GUI surfaces"
```

Note: job drawer and quick-action progress IDs are React-owned. The captured
legacy DOM is hidden and privatized so existing job controllers, timers, and
desktop effects remain the operation owners until the legacy cleanup phase.

## Phase 7: Preferences And Display Refresh

Status: Complete.

Goal: migrate preferences UI and make display refresh fully React-driven.

Likely files:

- `src/ui/react/preferences/PreferencesDialog.tsx`
- `src/ui/react/preferences/GeneralPane.tsx`
- `src/ui/react/preferences/ArchiveDefaultsPane.tsx`
- `src/ui/react/preferences/AppearancePane.tsx`
- `src/ui/react/preferences/AdvancedPane.tsx`

Checklist:

- [x] Render preferences pages from typed preferences snapshot.
- [x] Preserve custom output folder validation and display truncation.
- [x] Preserve default create/extract options and toolbar/table settings.
- [x] Preserve locale change behavior through display context without mutating
  workflow values.
- [x] Add tests for preference patch collection, locale refresh, output
  validation, default format changes, and save/cancel behavior.

Completion gate:

- Legacy preferences rendering and event wiring are removed from
  `legacyMain.ts`.

Validation:

```powershell
npm.cmd run test:frontend
npm.cmd run build
npm.cmd run ast:lint
npm.cmd run test:e2e -- --grep "preferences|locale|settings"
```

Verified:

```powershell
npm.cmd run test:frontend
npm.cmd run build
npm.cmd run ast:lint
npm.cmd run test:e2e -- e2e/gui-visual-scan.spec.ts --grep "primary GUI states"
npm.cmd run test:e2e -- e2e/gui-visual-scan.spec.ts --grep "secondary GUI surfaces"
```

Note: preferences pages and public IDs are React-owned. React edits the typed
preferences draft and reuses the existing save/apply flow so persistence,
display refresh, table option refresh, and create-default application remain
controller-owned.

## Phase 8: Drop, Context Menus, Keyboard, And Drag

Status: Complete.

Goal: finish cross-surface interaction adapters in React.

Likely files:

- `src/ui/react/context-menu/ContextMenuRoot.tsx`
- `src/ui/react/interaction/ShellKeyboardShortcuts.tsx`
- `src/ui/react/interaction/BrowserFileDropAdapter.tsx`
- `src/ui/react/archive/ArchiveTable.tsx`
- `src/ui/react/shell/DropOverlay.tsx`

Checklist:

- [x] Move context-menu rendering and keyboard focus to React components.
- [x] Preserve context actions as command IDs or typed local intents.
- [x] Move keyboard shortcut decoding to a React shell adapter that delegates to
  command router/workspace intents.
- [x] Move native drag gesture threshold/hit testing to React UI code while
  native drag execution remains in `src/desktop/nativeDrag.ts`.
- [x] Preserve desktop file-drop binding in `src/desktop/fileDrop.ts`.
- [x] Add tests for context menu placement/actions, keyboard shortcuts, drop
  choices, and native drag request handoff.

Completion gate:

- No table/context/drop/keyboard event wiring remains in `legacyMain.ts`.

Validation:

```powershell
npm.cmd run test:frontend
npm.cmd run build
npm.cmd run ast:lint
npm.cmd run test:e2e -- --grep "context|keyboard|drop|drag"
```

Verified:

```powershell
npm.cmd run test:frontend -- src/ui/react/context-menu/ContextMenuRoot.test.tsx src/ui/react/interaction/ShellKeyboardShortcuts.test.ts src/ui/react/interaction/BrowserFileDropAdapter.test.ts src/ui/react/archive/ArchiveWorkspace.test.tsx src/app/hierarchicalTable.test.ts
npm.cmd run build
npm.cmd run ast:lint
node .\node_modules\@playwright\test\cli.js test --grep "drop|context|keyboard|drag"
```

Notes:

- React owns the public `#context-menu`, browser drop fallback, global shortcut
  decoder, archive row native-drag gesture, marquee selection, and visible
  archive table click/keyboard/context interactions.
- The Tauri desktop file-drop binding remains in `src/desktop/fileDrop.ts`.
- `runtimeBridge.ts` still applies workspace state changes and builds command
  context-menu item HTML during the bridge period, but it no longer binds live
  archive table/context/drop/keyboard event listeners for the migrated visible
  surfaces.

## Phase 9: Typed Rust/TS Command Contract

Status: Complete.

Goal: prevent Rust/TypeScript DTO drift before further command changes.

Options:

- Preferred: add `tauri-specta` or another generated binding path.
- Fallback: add explicit contract tests comparing command names and DTO
  serialization shape.

Checklist:

- [x] Decide generated bindings versus explicit contract tests.
- [x] Choose explicit contract tests for this migration slice; leave Rust
  derives/config unchanged.
- [x] Defer generated TS bindings and avoid adding `src/api/generated` until a
  dedicated binding toolchain is introduced.
- [x] Add tests that lock existing wrappers to Rust command names.
- [x] Keep public `src/api` wrapper functions stable for app/controllers.
- [x] Add CI/build validation for generated bindings or contract tests.

Completion gate:

- A command/DTO change fails tests or build if Rust and TypeScript drift.

Validation:

```powershell
npm.cmd run test:frontend
npm.cmd run build
cd src-tauri; cargo test
```

Verified:

```powershell
npm.cmd run test:frontend -- src/api/commands.contract.test.ts src/api/dtoContract.test.ts
npm.cmd run build
```

Notes:

- Chose explicit contract tests instead of introducing generated bindings during
  the React migration.
- Added `src/api/commands.contract.test.ts` to compare TS wrapper command names
  with Rust `tauri::generate_handler!` and verify the `{ request }` envelope.
- Added `src/api/dtoContract.test.ts` to compare Rust request struct field names
  with TypeScript request DTO field names.
- Added `src/vite-env.d.ts` for raw source imports used by the contract tests.
- No Rust DTO derives or public `src/api` wrappers were changed.

Known local caveat:

- `cargo check/test` may require vcpkg/libarchive environment variables on this
  machine. If blocked, record the exact environment gap.

## Phase 10: Delete Legacy GUI

Goal: remove the imperative GUI once all surfaces are React-owned.

Checklist:

- [x] Remove `src/legacyMain.ts`.
- [x] Remove legacy string-rendering tests or convert them to React/snapshot
  component tests.
- [x] Remove unused `src/ui/*View.ts` modules that only served legacy HTML.
- [x] Remove unused CSS selectors and consolidate styles into React/Tailwind
  surfaces.
- [x] Keep app/workspace/controller tests intact.
- [x] Confirm `src/main.ts` remains a small composition root.
- [x] Confirm `rg "runtimeBridge|innerHTML =|insertAdjacentHTML|querySelector"`
  has no architecture-breaking remnants except intentionally local DOM helpers.

Phase 10 notes:

- `src/runtimeBridge.ts` is now the runtime adapter, not the composition root.
  It still owns intentionally local hidden DOM helpers for extract/info/about
  dialog compatibility, context-menu HTML payloads, and DTO/control bridging.
- Deleted legacy string-rendering tests for archive/create workspaces after
  moving visible-surface coverage to React component tests and GUI contracts.
- Moved visible pane resize and column resize behavior to React surfaces; the
  bridge keeps archive table column preference updates behind a typed React
  intent.

Completion gate:

- App boots without `legacyMain.ts`.
- No behavior-critical tests still depend on legacy HTML strings.

Validation:

```powershell
npm.cmd run test:frontend
npm.cmd run build
npm.cmd run ast:lint
npm.cmd run test:e2e
```

## Phase 11: Visual QA And Release Gate

Goal: prove the new GUI is usable and does not just compile.

Checklist:

- [x] Browser smoke at desktop and compact viewports.
- [x] Windows Tauri/Rust smoke with the static environment
  (`cargo check`, `cargo test`, and recovery smoke). Packaged app launch was
  skipped because this migration did not build or change packaging artifacts.
- [x] Linux chrome smoke if available. Not available on this Windows ARM64
  host; Linux native-drag behavior remains covered by the Playwright fixture.
- [x] Playwright screenshot checks for archive browse, create, jobs,
  preferences, dialogs, context menu, and drop overlay.
- [x] Keyboard-only pass for menu, toolbar, tables, dialogs, and context menus.
- [x] Screen-reader basics: labels, roles, modal focus, selected/focused rows.
- [x] Password safety audit: no snapshot/log/storage/diagnostic leakage.
- [x] Run Windows ARM64 release gate when packaging changes are involved. Not
  required for this migration because no packaging files changed; Windows
  static recovery smoke passed.

Phase 11 notes:

- Full Playwright e2e passed after fixing compact React details/selectors and
  quick-action job-only presentation.
- `cargo check` and `cargo test` require `VCPKG_ROOT=C:\vcpkg` and
  `VCPKG_DEFAULT_TRIPLET=arm64-windows-static-md` on this machine.
- Password audit found only transient form/action plumbing and tests that
  assert snapshots/diagnostics remain password-free.

Completion gate:

- React GUI is functionally complete enough to replace the legacy GUI for daily
  development.

Validation:

```powershell
npm.cmd run test:frontend
npm.cmd run build
npm.cmd run ast:lint
npm.cmd run test:e2e
powershell -ExecutionPolicy Bypass -File scripts/release-gate-windows-arm64.ps1
```

## Manual Smoke Checklist

Run after any phase that moves a visible surface:

- Open archive from dialog.
- Open archive from clipboard/recent path.
- Browse folders, parent row, tree, breadcrumbs.
- Search and toggle flat view.
- Select with click, ctrl/meta, shift, checkboxes, select all, invert visible,
  and marquee.
- Sort and resize/reorder/toggle columns.
- Right-click rows, folders, empty space, source rows, and tree items.
- Extract selected entries and whole archive.
- Preview and open outside selected entry.
- Add create sources from files/folder/drop.
- Navigate create plan and include/exclude paths.
- Create ZIP, 7Z, TAR.ZST, and TZAP where supported.
- Watch jobs, pause/resume/cancel/dismiss, retry password where possible.
- Open preferences, change locale, save/cancel.
- Use keyboard shortcuts and menu accelerators.
- Test drop overlay choices in browse and create modes.

## Risk Register

- Tailwind preflight can change legacy CSS if imported globally too early.
  Mitigation: import Tailwind only when a React surface is ready for it.
- React Strict Mode can double-run effects in development.
  Mitigation: side effects must be idempotent and controllers should own
  effect sequencing.
- Password inputs can accidentally enter React state.
  Mitigation: keep password values local to transient submit/prompt handlers.
- Large table rendering can regress performance.
  Mitigation: migrate archive table with deterministic row tests first; add
  virtualization only if measurement proves it is needed.
- Context menus and keyboard behavior are easy to subtly regress.
  Mitigation: keep event-decoding tests plus Playwright keyboard smoke.
- Generated command bindings can be a larger Rust change than expected.
  Mitigation: keep Phase 9 separate and allow explicit contract tests as a
  fallback.

## Session Notes

### 2026-07-09

- Created this plan after establishing the React bridge.
- Active next phase: Phase 1, React app runtime seam.
- Recommended next action: design `ZManagerReactSnapshot` and
  `ZManagerReactActions` around existing shell/archive/create/jobs snapshots
  without changing visible UI.
- Implemented Phase 1 runtime seam:
  `src/ui/react/appRuntime.ts`, `src/ui/react/appStore.ts`, and
  `src/ui/react/AppProviders.tsx`.
- Wired `AppShell` to the legacy runtime adapter and added snapshot/action
  tests.
- Started Phase 2 with React shell components under `src/ui/react/shell/`:
  titlebar, menu, toolbar/mode tabs, status bar, drop overlay, and `AppFrame`.
  Live shell replacement remains open because the legacy body still assumes it
  owns the outer workspace mount.
