# ZManager Desktop Frontend Architecture Redesign Plan

Date: 2026-07-08

## Goal

Turn the frontend from one large event-driven script into a small composition
root plus deep workflow modules. The redesign must make archive browsing,
archive creation, jobs, commands, dialogs, settings, display localization, and
desktop integration maintainable without moving archive behavior out of Rust or
`zmanager-core`.

The goal is not "more files." The goal is depth: modules with small interfaces
that keep meaningful behavior behind them. A helper that formats one value or
forwards one event is fine locally, but it is not the architecture.

## Critical Review Of The Current Plan And Code

The existing plan identified the most important problem correctly:
`src/main.ts` owns too much. At this review, it is over 9,000 lines and owns
initial markup, DOM queries, archive browsing state, create-plan state, command
routing, dialogs, selection, context menus, drag/drop, jobs, quick actions,
preferences, localization refresh, preview cleanup, path histories, and desktop
window behavior.

What the current plan gets right:

- `main.ts` should become a composition root, not the application architecture.
- Archive browsing and create-plan browsing share a real hierarchical table
  interaction model.
- Existing modules such as `archiveTable.ts`, `archiveTree.ts`,
  `selection.ts`, `createFlow.ts`, `dropIntent.ts`, `jobs.ts`,
  `quickActions.ts`, `preferences.ts`, and `src/ui/*View.ts` are useful seeds.
- The migration must be behavior-preserving and Vitest-covered.
- Rust and `zmanager-core` must keep archive semantics, safety, and format
  behavior.

What is missing or not correct enough:

- The plan is too table-first. A reusable table module is valuable, but it
  cannot own archive loading, create planning, command availability, password
  retry, preview cleanup, destination histories, quick-action startup, or
  desktop adapters. Without workspace modules above it, table extraction will
  produce another shallow module.
- The first table seam was under-specified. Archive and create rows share folder
  derivation, row identity, selection, focus, keyboard movement, and context
  triggers. They do not share archive columns, source-path mapping, inclusion
  badges, create-plan partial inclusion state, extract actions, or native drag
  requests.
- The previous migration recommendation combined row derivation and
  selection/focus too early. Row identity must be made stable and tested before
  selection/focus moves behind the same interface.
- Command routing is a larger architectural issue than table rendering. Command
  availability is partly centralized in `classicCommands.ts`, but execution is
  still scattered across toolbar buttons, menu items, shortcuts, context menus,
  details-pane actions, tree actions, and row handlers.
- Command execution cannot be a direct Tauri module. It needs an intent-based
  command router plus injected effect adapters for dialogs, API calls, desktop
  actions, and window actions.
- The create workflow was under-scoped. It owns source paths, source removal,
  plan revisions, stale-plan guards, inclusion rules, destination defaults,
  per-format defaults, password option visibility, and start-create request
  readiness.
- The archive workflow was under-scoped. It owns archive load state, password
  retry prompts, current folder, folder history, expanded tree folders, search,
  flat view, table settings, selection, details data, preview/open-outside
  readiness, extract request readiness, native drag readiness, and command
  context.
- The jobs flow was under-scoped. It must own event merging, pollable job
  selection, `pollInFlight`/`pollAgainRequested` concurrency decisions, retry
  contexts, prompted retry state, quick-action focused progress, auto-close
  decisions, and output actions.
- The shell was missing as a first-class module. Workspace mode, quick-action
  startup, drop overlay state, app-level status, preview cleanup lifecycle,
  recent archive history, destination histories, startup fixtures, and render
  invalidation are currently spread through `main.ts`.
- Preferences and display localization were missing from the architecture.
  Preferences drive table settings, toolbar settings, default create/extract
  behavior, locale, formatting, system icon usage, and input behavior. They need
  a stable preference/display context seam so workspaces do not import global
  UI state.
- Path histories were treated as incidental local storage. Extract destination
  history, create destination history, and recent archive history need pure
  normalization and injected storage, similar to the existing preference
  storage approach.
- Dialog behavior was correctly called out, but modal focus is not the only
  dialog issue. Extract/create/password dialogs also mix transient secrets,
  request-building, validation, and native file-picker effects.
- Desktop integration was too narrow. File drop decoding, native drag-out,
  window geometry, quick-action window modes, preview cleanup, file manager
  actions, and native dialogs must be adapters so tests can exercise workflow
  behavior without Tauri globals.
- Snapshot contracts were not explicit. View modules should receive immutable,
  render-ready snapshots and emit typed intents. They should not receive mutable
  `Set`, `Map`, DOM nodes, password strings, or Tauri promises.
- The plan did not define the async effect loop. Workspaces should be mostly
  pure state machines; controllers coordinate `src/api` and `src/desktop`
  adapters, then feed success/failure back into workspace intents.
- The plan did not include enough anti-corruption rules for Rust-owned archive
  behavior, password handling, localization, and display string escaping.

## Target Architecture

The frontend should be organized around shell state, workflow state, command
routing, view adapters, and platform adapters.

```text
src/main.ts
  Composition root only:
  query stable DOM roots, create adapters, instantiate controllers/workspaces,
  bind startup, connect render functions to snapshots.

src/app/shell/shellWorkspace.ts
  App-wide mode, status, drop decisions, quick-action startup state,
  preview cleanup state, history snapshots, and render invalidation hints.

src/app/workspaces/archiveWorkspace.ts
  Archive browsing workflow state and archive user intents.

src/app/workspaces/createWorkspace.ts
  Archive creation workflow state and create user intents.

src/app/workspaces/jobsWorkspace.ts
  Job lifecycle, poll decisions, retry state, quick-action job state.

src/app/commands/commandRouter.ts
  Command availability and execution routing for every command surface.

src/app/controllers/*
  Async orchestration around workspaces using injected API, desktop, dialog,
  storage, timer, clipboard, and window adapters. No direct Tauri imports.

src/app/hierarchicalTable.ts
  Shared row identity, row derivation, selection, focus, and keyboard intents
  for folder-like tables.

src/app/pathHistory.ts
  Pure normalization for recent archives and destination histories.

src/app/preferences.ts
src/app/display/displayContext.ts
  Persisted preferences, resolved locale, translator/formatting context, and
  view-affecting preference snapshots.

src/ui/*
  Rendering and DOM event adapters. No durable workflow state.

src/api/*
  Tauri command DTOs and invoke wrappers only.

src/desktop/*
  Runtime, native dialogs, file manager actions, file drop, window control,
  native drag-out, preview cleanup, clipboard, timers, and path adapters.
```

Important seams:

- Shell interface: accepts app-wide intents and returns a shell snapshot.
- Workspace interface: accepts workflow intents and returns workflow snapshots
  plus command context.
- Controller interface: accepts intents that require effects, calls injected
  adapters, then commits results back to shell/workspace modules.
- Command interface: accepts command IDs and payloads from all command surfaces,
  checks command state, and delegates to workspace intents or effect adapters.
- Table interface: accepts hierarchical row input and table intents, returns
  derived row/selection/focus state.
- View adapter interface: renders snapshots and emits typed intents.
- Desktop adapter interface: wraps Tauri, browser runtime, native dialogs,
  timers, clipboard, path, window, file-drop, and file-manager calls.
- Display context interface: provides translator and formatting behavior at the
  rendering seam without making workflow state language-dependent.

## State And Effect Model

The intended loop is:

```text
DOM event or desktop event
  -> UI adapter decodes typed intent
  -> command router or controller accepts the intent
  -> workspace/shell pure state update
  -> optional injected API/desktop effect
  -> success/failure intent updates workspace/shell
  -> render snapshots
```

Rules:

- Workspaces should be deterministic modules. Given state plus intent, they
  return next state and a snapshot.
- Workspaces may build serializable command DTOs, but they do not invoke Tauri.
- Controllers own async sequencing, stale-result checks, debouncing, timer
  lifecycles, and adapter calls.
- Controllers use injected adapter interfaces. Tests use fake adapters.
- Snapshots are immutable and render-ready. Prefer arrays and plain objects over
  mutable `Set` or `Map`.
- Snapshots must not include passwords or other secrets.
- UI modules may store transient DOM facts such as current focus target while
  decoding an event, but durable workflow state belongs in `src/app`.
- Rendering should be idempotent from snapshots. It should not secretly mutate
  workflow state.

## Ownership Rules

### `src/main.ts`

`main.ts` should only:

- Import shell markup or render static shell markup.
- Query stable DOM roots.
- Create API, desktop, storage, timer, clipboard, and window adapters.
- Instantiate shell, workspace, controller, command, and view modules.
- Bind top-level startup and event streams.
- Start the first render.

`main.ts` must not own:

- Workspace mode or app status state.
- Archive row derivation.
- Create-plan row derivation.
- Selection, focus, keyboard behavior, or marquee behavior for table-like panes.
- Command availability or command execution switches.
- Job lifecycle state, poll concurrency state, retry state, or progress clocks.
- Dialog focus trap behavior.
- Password retry state.
- Native drag-out request construction.
- File-drop decision state.
- Preview cleanup lifecycle state.
- Recent archive or destination history normalization.
- Create plan inclusion/exclusion logic.
- Preference patch normalization, locale resolution, or display context refresh.

### `src/app`

`src/app` owns workflow state, state transitions, request readiness, pure
derivations, and interfaces for injected effects. It may import DTO types from
`src/api/types`, but it should not import Tauri packages or concrete desktop
adapters.

App modules should expose user intents such as `loadArchiveSucceeded`,
`loadArchiveFailed`, `navigateToFolder`, `selectRows`, `setCreateSources`,
`toggleCreatePathIncluded`, `pollJobsSucceeded`, or `executeCommand`.

App modules should be tested through their public interfaces. Do not extract
private helpers only to test implementation details.

### `src/ui`

`src/ui` owns HTML rendering and DOM event adapters. It can emit typed intents
or call controller methods, but it must not duplicate workflow decisions.

UI modules may know about CSS classes, ARIA, element IDs, data attributes, and
focus restoration. Workflow modules should not.

### `src/api`

`src/api` owns serializable command DTOs and invoke wrappers. It must stay
boring. It should not know about UI state, DOM state, preferences, workspaces,
controllers, or desktop windows.

### `src/desktop`

`src/desktop` owns concrete runtime adapters: Tauri imports, native file
dialogs, file manager actions, Tauri event binding, browser fallback behavior,
window geometry, timers, clipboard, preview cleanup invocation, native
drag-out, and path helpers.

Workflow modules receive narrow adapter interfaces. Tests use fake adapters.

### Display And Localization

Workflow state, command DTOs, preference values, job statuses, and archive
semantics stay language-neutral. User-visible text and formatting happen at the
display seam through a display context. This plan must remain consistent with
`docs/I18N_DISPLAY_ISOLATION_PLAN.md`.

Display-producing helpers may receive a translator/formatter. Sorting,
filtering, command IDs, DTO values, and persisted preferences must not depend on
localized labels.

## Deep Module Design

### 0. Shell Workspace

Files to introduce:

- `src/app/shell/shellWorkspace.ts`
- `src/app/shell/shellWorkspace.test.ts`

Likely collaborators:

- Archive, Create, and Jobs workspaces
- `src/app/dropIntent.ts`
- `src/app/pathHistory.ts`
- `src/app/preferences.ts`
- `src/app/display/displayContext.ts`
- `src/app/quickActions.ts`

Owns:

- Active workspace mode: create/compress vs extract/browse.
- App-wide operational status and status severity.
- Drop overlay state and pending drop choice.
- Startup mode and quick-action startup decisions after desktop state is read.
- Recent archive, extract destination, and create destination history snapshots.
- Current preview cleanup root/path metadata, without performing cleanup.
- Render invalidation hints for views that need refresh after preference or
  locale changes.

Does not own:

- Archive list results.
- Create plan results.
- Job event details.
- DOM focus trap behavior.
- Tauri calls.

Deletion test:

- If this module is deleted, app mode, drop state, histories, quick-action
  startup decisions, preview cleanup state, and app status would spread back
  across startup, drag/drop, dialogs, commands, jobs, and render functions.

### 1. Archive Workspace

Files to introduce:

- `src/app/workspaces/archiveWorkspace.ts`
- `src/app/workspaces/archiveWorkspace.test.ts`

Likely collaborators:

- `src/app/archiveTree.ts`
- `src/app/archiveTable.ts`
- `src/app/archiveEntryIcons.ts`
- `src/app/extractFlow.ts`
- `src/app/hierarchicalTable.ts`
- `src/api/types.ts`

Owns:

- Current archive path, listing state, error state, entry count, total size.
- Current folder, folder history, breadcrumbs, expanded tree folders.
- Search query and flat view.
- Table sort and column settings snapshot.
- Selected paths, focused path, anchor path, marquee selection result.
- Details pane model.
- Extract/test/preview/open-outside/native-drag request readiness.
- Password retry prompt state for archive listing when appropriate.
- Command context for archive commands.

Does not own:

- Native file dialogs.
- Preview cleanup execution.
- Native drag invocation.
- Password values after request construction.
- Rust archive safety.

Interface direction:

```ts
type ArchiveWorkspace = {
  getSnapshot(): ArchiveWorkspaceSnapshot;
  beginLoading(input: BeginArchiveLoadInput): ArchiveWorkspaceSnapshot;
  loadSucceeded(result: ArchiveListingDto, options?: ArchiveLoadOptions): ArchiveWorkspaceSnapshot;
  loadFailed(error: CommandErrorDto | string): ArchiveWorkspaceSnapshot;
  navigate(intent: ArchiveNavigationIntent): ArchiveWorkspaceSnapshot;
  updateSearch(query: string): ArchiveWorkspaceSnapshot;
  updateSelection(intent: TableSelectionIntent): ArchiveWorkspaceSnapshot;
  updateSort(intent: ArchiveSortIntent): ArchiveWorkspaceSnapshot;
  buildExtractRequest(input: ExtractDialogInput): StartExtractRequest | null;
  buildPreviewRequest(input: PreviewInput): PreviewEntryRequest | null;
  buildNativeDragRequest(input: NativeDragInput): NativeFileDragRequest | null;
};
```

Deletion test:

- If this module is deleted, archive load state, search, navigation, selection,
  details, command context, password retry, preview readiness, native drag
  readiness, and extraction readiness would reappear across render functions,
  context menus, shortcuts, toolbar handlers, details actions, and drag code.

### 2. Create Workspace

Files to introduce:

- `src/app/workspaces/createWorkspace.ts`
- `src/app/workspaces/createWorkspace.test.ts`

Likely collaborators:

- `src/app/createFlow.ts`
- `src/app/hierarchicalTable.ts`
- `src/app/preferences.ts`
- `src/api/types.ts`

Owns:

- Source paths and source removal.
- Plan request readiness and plan revision numbers.
- Plan state, plan errors, warnings, and stale-plan detection.
- Included/excluded archive paths and partial folder inclusion state.
- Current create-plan folder and expanded create tree folders.
- Destination suggestion, destination readiness, and destination validation state.
- Format capabilities, per-format defaults, compression options, TZAP recovery
  options, password option visibility.
- Create readiness and unavailable reason.
- Start-create request construction.

Does not own:

- Native file picker calls.
- Local storage.
- Tauri plan/create invocation.
- Password persistence.

Interface direction:

```ts
type CreateWorkspace = {
  getSnapshot(): CreateWorkspaceSnapshot;
  setSources(paths: readonly string[]): CreateWorkspaceSnapshot;
  addSources(paths: readonly string[]): CreateWorkspaceSnapshot;
  removeSources(paths: readonly string[]): CreateWorkspaceSnapshot;
  beginPlan(): { snapshot: CreateWorkspaceSnapshot; request: PlanCreateRequest | null; revision: number };
  applyPlan(result: CreatePlanResponse, revision: number): CreateWorkspaceSnapshot;
  failPlan(error: CommandErrorDto | string, revision: number): CreateWorkspaceSnapshot;
  navigatePlanFolder(path: string): CreateWorkspaceSnapshot;
  setPathIncluded(path: string, included: boolean): CreateWorkspaceSnapshot;
  setAllIncluded(included: boolean): CreateWorkspaceSnapshot;
  updateOptions(intent: CreateOptionsIntent): CreateWorkspaceSnapshot;
  buildStartRequest(input: CreateSecretInput): StartCreateRequest | null;
};
```

Deletion test:

- If this module is deleted, plan revision guards, inclusion rules, source
  mapping, destination readiness, per-format option rules, and request
  construction would spread back through table rendering, form events,
  quick actions, and start-create handlers.

### 3. Jobs Workspace

Files to introduce:

- `src/app/workspaces/jobsWorkspace.ts`
- `src/app/workspaces/jobsWorkspace.test.ts`

Likely collaborators:

- `src/app/jobs.ts`
- `src/app/quickActions.ts`
- `src/ui/jobsView.ts`
- `src/api/types.ts`

Owns:

- Job map and event merging.
- Pollable job selection.
- Poll concurrency decisions, including in-flight and poll-again state.
- Retry contexts and password retry eligibility.
- Prompted retry job IDs.
- Focused quick-action job mode.
- Progress clock snapshot and whether a clock is needed.
- Auto-close decision after focused quick-action completion.
- Pause/resume/cancel/dismiss availability.
- Job output actions.

Does not own:

- Actual timers.
- Native window closing/showing.
- Password prompt UI.
- Concrete API calls.

Deletion test:

- If this module is deleted, retry logic, progress derivation, quick-action
  state, poll decisions, output actions, and terminal job handling would
  reappear across the jobs drawer, status bar, quick-action window, and command
  handlers.

### 4. Command Router

Files to introduce:

- `src/app/commands/commandRouter.ts`
- `src/app/commands/commandRouter.test.ts`

Likely collaborators:

- `src/app/classicCommands.ts`
- Shell, Archive, Create, and Jobs workspaces.

Owns:

- Mapping every `CommandId` to availability and disabled reason.
- One execution route for toolbar, menu, shortcut, context menu, details pane,
  tree, and row actions.
- Unsupported command behavior.
- Command payload validation.
- Command-specific status messages.

Does not own:

- DOM events.
- Tauri imports.
- Native dialogs directly.
- Workflow state mutation outside workspace intents.

The existing `selectCommandState` is a good foundation, but execution must join
it. New UI surfaces should emit `CommandId`, not call workflow functions
directly.

Interface direction:

```ts
type CommandRouter = {
  getState(commandId: CommandId): CommandState;
  getAllStates(): CommandStateMap;
  execute(commandId: CommandId, payload?: CommandPayload): Promise<void> | void;
};
```

Deletion test:

- If this module is deleted, every command needs to be manually wired in menus,
  toolbar buttons, shortcuts, context menus, details actions, tree actions, and
  row event handlers. That is exactly the duplication to remove.

### 5. Hierarchical Table

Files to introduce:

- `src/app/hierarchicalTable.ts`
- `src/app/hierarchicalTable.test.ts`
- `src/ui/hierarchicalTableView.ts`
- `src/ui/hierarchicalTableView.test.ts`

Owns in `src/app`:

- Stable row identity. Parent row IDs must not collide with real paths.
- Parent row derivation.
- Synthetic folder derivation.
- Folder, flat, and search row modes.
- Visible selectable path calculation.
- Selection intent application.
- Focus movement intent.
- Selection cleanup when visible rows change.
- Hidden-selection policy during search or filtering.
- Keyboard intent classification where DOM-independent.

Owns in `src/ui`:

- Common row attributes.
- ARIA selected/focused state.
- Empty/loading/error/loaded table bodies.
- Click, double-click, context menu, checkbox, and keydown event decoding.

Does not own:

- Archive columns or create-plan columns.
- Create source-path mapping.
- Create inclusion/partial inclusion rules.
- Extract/create/test/preview/native drag behavior.
- Tauri commands.
- Passwords.
- Destination history.
- Job polling.

This module should start as a pure row-identity and row-derivation module. Move
selection/focus only after archive and create-plan rows use the same stable row
identity model.

Deletion test:

- If this module is deleted, row identity, parent rows, synthetic folders,
  selection ranges, focus movement, keyboard row behavior, context triggers, and
  visible selection cleanup should reappear in both archive browsing and
  create-plan browsing.

### 6. Preferences, Display Context, And Path History

Files to introduce or deepen:

- `src/app/display/displayContext.ts`
- `src/app/pathHistory.ts`
- `src/app/pathHistory.test.ts`
- Existing `src/app/preferences.ts`
- Existing `src/app/preferenceStorage.ts`

Owns:

- Preference patch normalization.
- View-affecting preference snapshots.
- Resolved locale, translator, formatting context, and document language/dir
  metadata.
- Recent archive history normalization.
- Extract destination history normalization.
- Create destination history normalization.
- Storage key ownership through typed storage modules.

Does not own:

- Rendering specific DOM nodes.
- Archive semantics.
- Native dialogs.
- Passwords.

Deletion test:

- If these modules are deleted, table settings, toolbar settings, locale
  refresh, create/extract defaults, path history limits, and storage keys would
  scatter through `main.ts`, dialogs, workspace modules, and view helpers.

### 7. Drop And Native Drag Modules

Files to introduce or deepen:

- Existing `src/app/dropIntent.ts`
- `src/ui/dropOverlayView.ts`
- `src/ui/nativeDragGesture.ts`
- `src/desktop/fileDrop.ts`
- `src/desktop/nativeDrag.ts`

Owns:

- Pure drop intent classification in `src/app/dropIntent.ts`.
- Drop overlay rendering and choice events in `src/ui`.
- Pointer threshold and DOM hit testing for native drag gestures in `src/ui`.
- Native file-drop event binding and path normalization in `src/desktop`.
- Native drag-out Tauri invocation in `src/desktop`.
- Native drag request readiness in Archive Workspace.

Does not own:

- Archive listing state.
- Create source list state.
- Selection state beyond decoded table intents.

Deletion test:

- If these modules are deleted, drop decisions, drop overlay state, native drag
  gesture tracking, and Tauri drag calls would stay entangled with archive
  selection and shell startup.

### 8. Dialog And Overlay Controller

Files to introduce after workflow slices:

- `src/ui/modalController.ts`
- `src/ui/modalController.test.ts`
- `src/ui/contextMenuView.ts`
- `src/ui/contextMenuView.test.ts`

Owns:

- Generic modal open/close behavior.
- Focus trap.
- Return focus.
- Default and cancel actions.
- Escape handling for open dialogs.
- Generic context-menu placement and keyboard focus.

Does not own:

- Extract request building.
- Create request building.
- Password storage.
- Preferences state.
- About diagnostics.

Dialog-specific workflow stays outside this module. Extract dialog request
building belongs to Archive Workspace. Create dialog validation belongs to
Create Workspace. Preferences rendering belongs to preferences UI modules.
About diagnostics belongs to shell/controller code.

### 9. Desktop Adapter Set

Files to introduce or deepen:

- `src/desktop/dialogs.ts`
- `src/desktop/windowController.ts`
- `src/desktop/fileDrop.ts`
- `src/desktop/nativeDrag.ts`
- `src/desktop/previewCleanup.ts`
- `src/desktop/clipboard.ts`
- `src/desktop/timers.ts`
- Existing `src/desktop/runtime.ts`
- Existing `src/desktop/paths.ts`

Owns:

- Tauri imports.
- Native dialog calls.
- Window sizing, placement, minimize/maximize/close/show.
- Desktop file-drop event decoding.
- Native drag-out invocation.
- Preview cleanup invocation.
- Clipboard access.
- Timer adapters.
- File manager reveal/open calls.

Workflow modules receive these as adapters. Tests use fake adapters.

## Migration Plan

### Slice 0: Establish Guardrails And Characterization

Scope:

- Update this plan and `AGENTS.md`.
- Add or identify characterization tests for current archive rows, create rows,
  command state, create plan revision handling, job polling decisions, and drop
  intent behavior before moving code.
- Do not add new workflow behavior to `main.ts` while the redesign is underway.
- Add TODO comments only when they point to a named target module from this
  plan.

Done when:

- Architecture rules are documented.
- Existing high-risk behavior has tests or explicit manual smoke coverage.
- Future changes have a clear destination module.

### Slice 1: Create Stable Hierarchical Row Identity

Scope:

- Add `src/app/hierarchicalTable.ts`.
- Move shared row identity and row derivation concepts out of `main.ts` without
  changing DOM rendering.
- Support parent rows, folder rows, entry rows, synthetic folders, flat mode,
  search mode, and current folder.
- Avoid parent row path collisions by using explicit row IDs.
- Keep archive-specific sort in `archiveTable.ts`; the table module should
  accept sorted input or a comparator.
- Keep create source-path mapping and inclusion state in Create Workspace or
  current create code until the workspace exists.

Done when:

- Archive browser and create-plan browser call the same row derivation module.
- Existing visible row order is preserved.
- Vitest covers root folder, nested folder, explicit directory, synthetic
  folder, parent row identity, flat view, search view, and duplicate basename
  cases.

### Slice 2: Move Table Selection And Focus State

Scope:

- Move selection, anchor, focus, visible selectable paths, range selection,
  select all, invert visible, and cleanup into the table module.
- Preserve intentional hidden-selection behavior during search if product
  behavior requires it.
- Keep native drag gesture and marquee DOM hit testing in UI modules, while
  applying their results through table selection intents.

Done when:

- `selectedEntries`, `selectedCompressRows`, `focusedEntryPath`,
  `focusedCompressRowPath`, `selectionAnchorPath`, and
  `compressSelectionAnchorPath` are no longer directly mutated by row event
  handlers.
- Vitest covers click replacement, ctrl/meta toggle, shift range, select all,
  invert visible, cleanup, focus movement, and marquee result application.

### Slice 3: Introduce Archive Workspace

Scope:

- Move archive load state, folder navigation, search, flat view, tree expansion,
  sort snapshot, selection snapshot, details model, password retry state, and
  extract/test/preview/native-drag readiness into `archiveWorkspace.ts`.
- Keep Tauri command calls outside the workspace. Pass command results and
  failures into workspace intents.

Done when:

- `main.ts` no longer owns archive browsing state globals.
- Command state reads an archive workspace snapshot instead of scattered
  globals.
- Tests cover load success, load failure, password-required retry state,
  navigation history, search, flat view, selection, details, and request
  readiness.

### Slice 4: Introduce Create Workspace

Scope:

- Move create sources, plan state, plan revision guards, inclusion/exclusion,
  create-plan folder navigation, destination readiness, per-format defaults,
  password option visibility, and request construction into
  `createWorkspace.ts`.
- Keep existing `createFlow.ts` helpers, but let the workspace become the
  interface callers use.

Done when:

- `main.ts` no longer owns create workflow state globals.
- Plan revision behavior and inclusion rules are covered by tests.
- Start-create request construction is tested through the workspace interface.
- Browser-only plan preview is behind an injected planning adapter, not inline
  in `main.ts`.

### Slice 5: Add Shell Workspace And Path Histories

Scope:

- Move workspace mode, app status, drop overlay state, pending drop choice,
  recent archive history, destination histories, preview cleanup metadata, and
  quick-action startup state into shell/path-history modules.
- Keep storage access injected.

Done when:

- `main.ts` no longer owns workspace mode, pending drop choice, path history
  arrays, or preview cleanup metadata.
- Path history tests cover trimming, dedupe, max length, blank rejection, and
  storage failure fallback.
- Drop overlay state is testable without DOM.

### Slice 6: Add The Command Router

Scope:

- Keep command labels and menu definitions in `classicCommands.ts`.
- Move command execution into `commandRouter.ts`.
- Use injected command effects for dialogs, API calls, desktop actions, window
  actions, clipboard, and status messages.
- Convert toolbar, menus, shortcuts, context menus, details pane, tree actions,
  and row actions to emit command IDs and payloads.

Done when:

- Every command surface reaches the same router.
- Unsupported operations and disabled reasons are consistent.
- Adding a new command no longer requires editing unrelated event handlers.
- Tests cover representative commands from each surface class.

### Slice 7: Introduce Jobs Workspace

Scope:

- Move job map, event merging, retry contexts, prompted password retry IDs,
  focused quick-action state, output actions, and poll decisions into
  `jobsWorkspace.ts`.
- Keep actual timers, password prompt UI, and native window calls as adapters.

Done when:

- Normal jobs and quick-action jobs share lifecycle behavior.
- Password retry logic is tested through the jobs workspace.
- Polling start/stop/re-poll decisions can be tested without timers.

### Slice 8: Extract Settings And Display Context

Scope:

- Deepen preferences and display context so locale, formatting, table settings,
  toolbar settings, create defaults, and extraction defaults are updated through
  one interface.
- Make active views rerender from snapshots when display context changes.
- Keep string rendering aligned with `docs/I18N_DISPLAY_ISOLATION_PLAN.md`.

Done when:

- `main.ts` no longer owns preference patch application or locale refresh.
- Workflow state uses stable IDs and raw values, not localized labels.
- Tests prove command labels/tooltips, table headers/cells, jobs, preferences,
  and status text refresh through display context without changing sort/filter
  semantics.

### Slice 9: Extract UI View Adapters

Scope:

- Add or deepen view modules for shell, archive browser, create workspace,
  command surfaces, context menus, details pane, tree panes, drop overlay, and
  modal behavior.
- Move DOM event decoding out of `main.ts` once the corresponding workspace or
  command interface exists.

Done when:

- `main.ts` mostly wires `view.bind({ onIntent })` and
  `view.render(snapshot)`.
- UI modules contain data attributes, ARIA, focus behavior, and HTML.
- App modules contain state transitions and request readiness.

### Slice 10: Split Desktop Adapters And Controllers

Scope:

- Move native dialogs, file manager actions, window geometry, timers, clipboard,
  file drop, preview cleanup, and native drag-out into narrow desktop adapters.
- Add controller modules that inject those adapters into workflow operations.

Done when:

- Most frontend tests can run without Tauri globals.
- Tauri imports are concentrated in `src/api` and `src/desktop`.
- Controllers can be tested with fake command and desktop adapters.

## Testing Strategy

Test the public interface of each deep module:

- `hierarchicalTable.test.ts`: row identity, row derivation, selection, focus,
  cleanup, keyboard intents.
- `archiveWorkspace.test.ts`: loading, password retry state, navigation, search,
  flat view, command context, details, extract/preview/native-drag readiness.
- `createWorkspace.test.ts`: sources, plan revisions, inclusion, destination
  readiness, format options, request construction.
- `shellWorkspace.test.ts`: mode, drop overlay, pending choices, histories,
  status, quick-action startup state, preview cleanup metadata.
- `pathHistory.test.ts`: dedupe, trimming, limits, ordering, storage fallback.
- `commandRouter.test.ts`: command availability, disabled reasons, payload
  validation, execution dispatch.
- `jobsWorkspace.test.ts`: event merging, retry state, polling decisions,
  focused quick-action state, output actions.
- `modalController.test.ts`: focus trap, default/cancel, return focus.
- Display tests: locale/display context refresh without mutating workflow
  values.

Keep Playwright for end-to-end confidence, especially:

- Open archive and browse folders.
- Search and flat view.
- Select and extract selected entries.
- Preview/open outside selected entry.
- Native drag-out smoke coverage where platform permits.
- Create archive from multiple sources with inclusion/exclusion.
- Jobs drawer and quick-action progress.
- Keyboard navigation, menus, details actions, context menus, and drop overlay.
- Preferences and locale/display refresh.

Do not use Playwright as the main proof for workflow state. Workflow behavior
should be mostly Vitest-covered.

## Security And Architecture Guardrails

- Passwords remain ephemeral. Do not store them in workspace snapshots, local
  storage, logs, diagnostics, URLs, command-line strings, or translated
  interpolation values.
- TypeScript may assemble command DTOs, but archive planning, extraction
  safety, overwrite policy enforcement, symlink/hardlink checks, path
  normalization, collision handling, and zip-bomb guards remain Rust/core-owned.
- Command DTOs stay small and serializable.
- Do not add direct Tauri imports outside `src/api` and `src/desktop`.
- Do not add new table row listeners in `main.ts`.
- Do not add new workflow globals in `main.ts`.
- Do not duplicate archive path tree logic for create-plan rows. Generalize it
  through the hierarchical table module while preserving source-path mapping in
  Create Workspace.
- Do not put localized labels into workflow state, persisted settings, command
  DTOs, or sort/filter logic.
- Escape translated and interpolated text before inserting it into string-built
  HTML.
- Do not create a frontend framework migration inside this refactor.
- Do not redesign the visual UI as part of architecture extraction.
- Do not introduce a general-purpose table library unless the local table
  module proves too expensive to own after the first two slices.

## Success Criteria

The redesign is successful when:

- `main.ts` is a composition root, not the owner of workflows.
- Shell, Archive, Create, Jobs, Commands, Settings/Display, and Desktop Effects
  each have a deep module or controller with a small interface.
- Archive and create-plan folder tables share one row/selection/focus
  implementation where their behavior is genuinely shared.
- Every command surface routes through one command router.
- Tauri imports are concentrated in `src/api` and `src/desktop`.
- Workflow tests cover the main state transitions without mounting the full
  shell.
- Adding a third hierarchical table requires a new adapter, not copied event
  handlers.
- Adding a command updates one router path and the relevant command definition,
  not six event surfaces.
- Preference and locale changes flow through display context, not scattered
  rerender calls.
- Path histories and preview cleanup are owned by shell/controller modules, not
  by ad hoc globals.
- Password and archive safety rules remain enforceable by construction.

## Recommended Next Step

Do not start by moving selection/focus and row derivation in one sweep.

Start with Slice 0 and Slice 1:

1. Add characterization coverage for current archive/create row output and the
   command state most likely to regress.
2. Add `src/app/hierarchicalTable.ts` with stable row identity and row
   derivation tests.
3. Replace archive and create-plan visible row derivation with the shared module
   while keeping DOM rendering unchanged.

Once row identity is stable in both real table adapters, move selection and
focus behind the table module. Then extract Archive Workspace and Create
Workspace above it.
