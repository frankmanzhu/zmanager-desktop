# ZManager Desktop Frontend Architecture Redesign Plan

Date: 2026-07-08

## Goal

Turn the frontend from one large event-driven script into a small composition root plus deep workflow modules. The redesign must make archive browsing, archive creation, jobs, commands, dialogs, and desktop integration maintainable without moving archive behavior out of `zmanager-core`.

The primary target is not "more files." The target is depth: modules with small interfaces that hold meaningful behavior behind them. A helper that only formats one value or forwards one event is acceptable locally, but it is not the architecture.

## Critical Review Of The Previous Plan

The previous plan identified a real problem: `src/main.ts` owns too much. At the time of this review, it is roughly 9,000 lines and owns initial markup, DOM queries, archive browsing state, create-plan state, command routing, dialogs, selection, context menus, drag/drop, jobs, quick actions, preference wiring, and desktop window behavior.

What was correct:

- `main.ts` should become a composition root, not the application architecture.
- Archive browsing and create-plan browsing share a real hierarchical table interaction model.
- Existing modules such as `archiveTable.ts`, `archiveTree.ts`, `selection.ts`, `createFlow.ts`, `jobs.ts`, and the `src/ui/*View.ts` files are useful starting points.
- The first implementation slice should be behavior-preserving and covered by Vitest.

What was missing or not quite correct:

- The plan was too table-first. A reusable table module is useful, but it cannot own archive loading, create planning, command availability, extraction readiness, job retry rules, or desktop adapters. Without workspace modules above it, table extraction would create another shallow module.
- The proposed table interface mixed state, rendering, and caller callbacks too early. The first seam should be row derivation and interaction state. DOM rendering and event binding can follow only after the state interface proves stable.
- The plan under-described command routing. Today command availability is partially centralized in `classicCommands.ts`, but execution is scattered across toolbar buttons, menus, shortcuts, context menus, details actions, and table handlers. That is a larger architectural problem than table rendering.
- The create workflow was under-scoped. Create planning is not just another archive table. It owns source paths, plan revisions, inclusion rules, destination defaults, format capabilities, password option visibility, and plan request invalidation.
- The archive workflow was under-scoped. Archive browsing owns load state, password retry, search, flat view, folder history, selection, details data, preview/open outside, extract request preparation, native drag-out, real icons, and command context.
- The jobs and quick-action flow was under-scoped. Polling, retry prompts, focused quick-action windows, progress clocks, auto-close, pause/resume/cancel/dismiss, and output actions need one lifecycle module.
- Modal behavior was correctly called out, but it should not be a first architectural slice. It is important, but it is lower leverage than workflow and command modules.
- The plan did not define the new ownership rules for `src/api`, `src/desktop`, and `src/ui`. Without those rules, future work can keep adding cross-layer shortcuts.
- The plan did not include explicit anti-corruption rules for Rust-owned archive behavior and password handling.

## Target Architecture

The frontend should be organized around workflow modules, view modules, and adapters.

```text
src/main.ts
  Composition root only:
  query stable DOM roots, create adapters, instantiate workspaces, bind top-level startup.

src/app/workspaces/archiveWorkspace.ts
  Archive browsing workflow state and user intents.

src/app/workspaces/createWorkspace.ts
  Archive creation workflow state and user intents.

src/app/workspaces/jobsWorkspace.ts
  Job lifecycle, polling decisions, retry state, and quick-action job state.

src/app/commands/commandRouter.ts
  Command availability plus execution routing for all command surfaces.

src/app/hierarchicalTable.ts
  Shared row derivation, selection, focus, and keyboard intent for folder-like tables.

src/ui/*
  Rendering and DOM event adapters. No durable workflow state.

src/api/*
  Tauri DTOs and invoke wrappers only.

src/desktop/*
  Runtime, native dialogs, paths, window, drag/drop, and shell adapters only.
```

The important seams are:

- Workspace interface: accepts user intents and returns view state plus command context.
- Command interface: accepts command IDs and dispatches to workspace intents or desktop adapters.
- Table interface: accepts hierarchical row input and selection/focus intents, returns derived table state.
- View adapter interface: binds DOM events to typed intents and renders view state.
- Desktop adapter interface: wraps Tauri/window/dialog/file-manager calls so workflow modules can be tested without native runtime.

## Ownership Rules

### `src/main.ts`

`main.ts` should only:

- Render static shell markup or import it from a shell view module.
- Query stable DOM roots.
- Create desktop adapters, command adapters, and workspace modules.
- Connect workspaces to view adapters.
- Run startup flows.

`main.ts` must not own:

- Archive row derivation.
- Create-plan row derivation.
- Selection, focus, or keyboard behavior for table-like panes.
- Command availability or command execution switches.
- Job polling state.
- Dialog focus trap behavior.
- Password retry state.
- Native drag-out request construction.
- Create plan inclusion/exclusion logic.

### `src/app`

`src/app` owns workflow state and pure behavior. It may import DTO types from `src/api/types`, but it should not call Tauri directly. App modules should expose user intents such as `loadArchive`, `navigateToFolder`, `selectRows`, `setCreateSources`, `toggleCreatePathIncluded`, `pollJobs`, or `executeCommand`.

App modules should be tested through their public interfaces. Do not extract private helpers only to test implementation details.

### `src/ui`

`src/ui` owns HTML rendering and DOM event adapters. It can emit typed events or call workspace intents, but it must not duplicate workflow decisions.

UI modules may know about CSS classes and data attributes. Workflow modules should not.

### `src/api`

`src/api` owns serializable command DTOs and invoke wrappers. It must stay boring. It should not know about UI state, DOM, preferences, or workflow modules.

### `src/desktop`

`src/desktop` owns platform/runtime adapters: native file dialogs, file manager actions, Tauri event binding, window geometry, native drag-out, and path helpers. Workflow modules should depend on narrow adapter interfaces, not direct Tauri imports.

## Deep Module Design

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
- Table sort and column settings.
- Selected paths, focused path, anchor path.
- Details pane model.
- Extract/test/preview/open-outside/native-drag request readiness.
- Password retry prompt state for archive listing when appropriate.

Interface direction:

```ts
type ArchiveWorkspace = {
  getSnapshot(): ArchiveWorkspaceSnapshot;
  loadListing(result: ArchiveListingDto): ArchiveWorkspaceSnapshot;
  failLoading(error: CommandErrorDto | string): ArchiveWorkspaceSnapshot;
  navigate(intent: ArchiveNavigationIntent): ArchiveWorkspaceSnapshot;
  updateSearch(query: string): ArchiveWorkspaceSnapshot;
  updateSelection(intent: TableSelectionIntent): ArchiveWorkspaceSnapshot;
  updateSort(intent: ArchiveSortIntent): ArchiveWorkspaceSnapshot;
  buildExtractRequest(input: ExtractDialogInput): StartExtractRequest | null;
};
```

The exact names can change during implementation. The interface should stay intent-based; callers should not mutate sets and globals directly.

Deletion test:

- If this module is deleted, archive load state, search, navigation, selection, details, command context, and extraction readiness would reappear across render functions, context menus, shortcuts, and toolbar handlers. That means it earns its keep.

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
- Plan state, plan revision, plan errors, warnings, and stale-plan detection.
- Included/excluded archive paths.
- Current create-plan folder and expanded create tree folders.
- Destination suggestion and destination history model.
- Format capabilities, compression options, TZAP recovery options, password option visibility.
- Create readiness and unavailable reason.
- Start-create request construction.

Interface direction:

```ts
type CreateWorkspace = {
  getSnapshot(): CreateWorkspaceSnapshot;
  setSources(paths: readonly string[]): CreateWorkspaceSnapshot;
  applyPlan(result: CreatePlanResponse, revision: number): CreateWorkspaceSnapshot;
  failPlan(error: CommandErrorDto | string, revision: number): CreateWorkspaceSnapshot;
  navigatePlanFolder(path: string): CreateWorkspaceSnapshot;
  setPathIncluded(path: string, included: boolean): CreateWorkspaceSnapshot;
  setAllIncluded(included: boolean): CreateWorkspaceSnapshot;
  updateOptions(intent: CreateOptionsIntent): CreateWorkspaceSnapshot;
  buildPlanRequest(): PlanCreateRequest | null;
  buildStartRequest(input: CreateSecretInput): StartCreateRequest | null;
};
```

Deletion test:

- If this module is deleted, plan revision guards, inclusion rules, source mapping, destination readiness, and request construction would spread back through table rendering, form events, quick actions, and start-create handlers.

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
- Poll scheduling decisions, not timers themselves.
- Retry contexts and password retry eligibility.
- Focused quick-action job mode.
- Progress clock snapshot.
- Auto-close decision after focused quick-action completion.
- Pause/resume/cancel/dismiss availability.

Does not own:

- Actual `setTimeout` or native window closing. Those remain adapters called from `main.ts` or a shell controller.

Deletion test:

- If this module is deleted, retry logic, progress derivation, quick-action state, and poll decisions would reappear across the jobs drawer, status bar, quick-action window, and command handlers.

### 4. Command Router

Files to introduce:

- `src/app/commands/commandRouter.ts`
- `src/app/commands/commandRouter.test.ts`

Likely collaborators:

- `src/app/classicCommands.ts`
- Archive, create, and jobs workspaces.

Owns:

- Mapping every `CommandId` to availability and execution.
- One route for toolbar, menu, shortcut, context menu, details pane, and row actions.
- Unsupported command behavior.
- Command-specific status messages.

The existing `selectCommandState` is a good foundation, but execution must join it. New UI surfaces should emit `CommandId`, not call workflow functions directly.

Interface direction:

```ts
type CommandRouter = {
  getState(commandId: CommandId): CommandState;
  getAllStates(): CommandStateMap;
  execute(commandId: CommandId, payload?: CommandPayload): Promise<void> | void;
};
```

Deletion test:

- If this module is deleted, every command needs to be manually wired in menus, toolbar buttons, shortcuts, context menus, details actions, and row event handlers. That is exactly the duplication to remove.

### 5. Hierarchical Table

Files to introduce:

- `src/app/hierarchicalTable.ts`
- `src/app/hierarchicalTable.test.ts`
- `src/ui/hierarchicalTableView.ts`
- `src/ui/hierarchicalTableView.test.ts`

Owns in `src/app`:

- Stable row identity.
- Parent row derivation.
- Synthetic folder derivation.
- Folder, flat, and search row modes.
- Visible selectable path calculation.
- Selection intent application.
- Focus movement intent.
- Selection cleanup when visible rows change.
- Keyboard intent classification where DOM-independent.

Owns in `src/ui`:

- Common row attributes.
- ARIA selected/focused state.
- Empty/loading/error/loaded table bodies.
- Click, double-click, context menu, checkbox, and keydown event decoding.

Does not own:

- Archive columns or create-plan columns.
- Extract/create/test/preview/native drag behavior.
- Tauri commands.
- Passwords.
- Destination history.
- Job polling.

This module should start as a pure row and interaction module. The view adapter can come after archive and create rows share the same state model.

Deletion test:

- If this module is deleted, row identity, parent rows, synthetic folders, selection ranges, focus movement, keyboard row behavior, context triggers, and visible selection cleanup should reappear in both archive browsing and create-plan browsing.

### 6. Dialog And Overlay Controller

Files to introduce after the workflow slices:

- `src/ui/modalController.ts`
- `src/ui/modalController.test.ts`

Owns:

- Open/close state for generic modal behavior.
- Focus trap.
- Return focus.
- Default and cancel actions.
- Escape handling for open dialogs.

Dialog-specific workflow stays outside this module. Extract dialog request building belongs to Archive Workspace. Preferences rendering belongs to the preferences view. About diagnostics belongs to a diagnostics module or shell controller.

### 7. Desktop Adapter Set

Files to introduce or deepen:

- `src/desktop/dialogs.ts`
- `src/desktop/windowController.ts`
- `src/desktop/fileDrop.ts`
- `src/desktop/nativeDrag.ts`

Owns:

- Tauri imports.
- Native dialog calls.
- Window sizing, placement, minimize/maximize/close.
- Desktop file-drop event decoding.
- Native drag-out invocation.
- File manager reveal/open calls.

Workflow modules receive these as adapters. Tests use fake adapters.

## Migration Plan

### Slice 0: Establish Guardrails

Scope:

- Update this plan and `AGENTS.md`.
- Do not add new workflow behavior to `main.ts` while the redesign is underway.
- Add TODO comments only when they point to a named target module from this plan.

Done when:

- Architecture rules are documented.
- Future changes have a clear destination module.

### Slice 1: Create The Hierarchical Table App Module

Scope:

- Add `src/app/hierarchicalTable.ts`.
- Move shared row derivation concepts out of `main.ts` without changing DOM rendering.
- Support parent rows, folder rows, entry rows, synthetic folders, flat mode, search mode, and current folder.
- Keep archive-specific sort in `archiveTable.ts`; the table module should accept a comparator or sorted rows where needed.

Done when:

- Archive browser and create-plan browser call the same row derivation module.
- Existing visible row order is preserved.
- Vitest covers root folder, nested folder, explicit directory, synthetic folder, parent row, flat view, and search view.

### Slice 2: Move Table Selection And Focus State

Scope:

- Move selection, anchor, focus, visible selectable paths, and cleanup into the table module.
- Preserve intentional hidden-selection behavior during search if product behavior requires it.

Done when:

- `selectedEntries`, `selectedCompressRows`, `focusedEntryPath`, `focusedCompressRowPath`, `selectionAnchorPath`, and `compressSelectionAnchorPath` are no longer directly mutated by row event handlers.
- Vitest covers click replacement, ctrl/meta toggle, shift range, select all, invert visible, cleanup, and focus movement.

### Slice 3: Introduce Archive Workspace

Scope:

- Move archive load state, folder navigation, search, flat view, sort snapshot, selection snapshot, details model, and extract/test/preview readiness into `archiveWorkspace.ts`.
- Keep Tauri command calls outside the workspace at first; pass command results into workspace intents.

Done when:

- `main.ts` no longer owns archive browsing state globals.
- Command state reads an archive workspace snapshot instead of scattered globals.
- Tests cover load success, load failure, navigation history, search, flat view, selection, and extract request readiness.

### Slice 4: Introduce Create Workspace

Scope:

- Move create sources, plan state, plan revision guards, inclusion/exclusion, create-plan folder navigation, destination readiness, and request construction into `createWorkspace.ts`.
- Keep the existing `createFlow.ts` helpers, but let the workspace become the interface callers use.

Done when:

- `main.ts` no longer owns create workflow state globals.
- Plan revision behavior and inclusion rules are covered by tests.
- Start-create request construction is tested through the workspace interface.

### Slice 5: Add The Command Router

Scope:

- Keep command labels and menu definitions in `classicCommands.ts`.
- Move command execution into `commandRouter.ts`.
- Convert toolbar, menus, shortcuts, context menus, details pane, and row actions to emit command IDs and payloads.

Done when:

- Every command surface reaches the same router.
- Unsupported operations and disabled reasons are consistent.
- Adding a new command no longer requires editing unrelated event handlers.

### Slice 6: Introduce Jobs Workspace

Scope:

- Move job map, event merging, retry contexts, focused quick-action state, and poll decisions into `jobsWorkspace.ts`.
- Keep actual timers and native window calls as adapters.

Done when:

- Normal jobs and quick-action jobs share lifecycle behavior.
- Password retry logic is tested through the jobs workspace.
- Polling start/stop decisions can be tested without timers.

### Slice 7: Extract UI View Adapters

Scope:

- Add or deepen view modules for archive browser, create workspace, shell commands, context menus, and modal behavior.
- Move DOM event decoding out of `main.ts` once the corresponding workspace interface exists.

Done when:

- `main.ts` mostly wires `view.bind({ onIntent })` and `view.render(snapshot)`.
- UI modules contain data attributes and HTML; app modules contain state transitions.

### Slice 8: Split Desktop Adapters

Scope:

- Move native dialogs, file manager actions, window geometry, file drop, and native drag-out into narrow desktop adapters.
- Inject adapters into shell/workflow setup.

Done when:

- Most frontend tests can run without Tauri globals.
- Tauri imports are concentrated in `src/api` and `src/desktop`.

## Testing Strategy

Test the public interface of each deep module:

- `hierarchicalTable.test.ts`: row derivation, selection, focus, cleanup, keyboard intents.
- `archiveWorkspace.test.ts`: loading, navigation, search, flat view, command context, extract readiness.
- `createWorkspace.test.ts`: sources, plan revisions, inclusion, destination readiness, request construction.
- `commandRouter.test.ts`: command availability and execution dispatch.
- `jobsWorkspace.test.ts`: event merging, retry state, polling decisions, focused quick-action state.
- `modalController.test.ts`: focus trap, default/cancel, return focus.

Keep Playwright for end-to-end confidence, especially:

- Open archive and browse folders.
- Search and flat view.
- Select and extract selected entries.
- Create archive from multiple sources with inclusion/exclusion.
- Jobs drawer and quick-action progress.
- Keyboard navigation and context menus.

Do not use Playwright as the main proof for workflow state. Workflow behavior should be mostly Vitest-covered.

## Security And Architecture Guardrails

- Passwords remain ephemeral. Do not store them in workspace snapshots, local storage, logs, diagnostics, URLs, or command-line strings.
- TypeScript may assemble command DTOs, but archive planning, extraction safety, overwrite policy enforcement, symlink/hardlink checks, path normalization, and zip-bomb guards remain Rust/core-owned.
- Command DTOs stay small and serializable.
- Do not add direct Tauri imports outside `src/api` and `src/desktop`.
- Do not add new table row listeners in `main.ts`.
- Do not add new workflow globals in `main.ts`.
- Do not duplicate archive path tree logic for create-plan rows; generalize it through the hierarchical table module while preserving source-path mapping in Create Workspace.
- Do not create a frontend framework migration inside this refactor.
- Do not redesign the visual UI as part of architecture extraction.
- Do not introduce a general-purpose table library unless the local table module proves too expensive to own after the first two slices.

## Success Criteria

The redesign is successful when:

- `main.ts` is a composition root, not the owner of workflows.
- Archive browsing, create planning, jobs, and commands each have a deep module with a small interface.
- Archive and create-plan folder tables share one row/selection/focus implementation.
- Every command surface routes through one command router.
- Tauri imports are concentrated in `src/api` and `src/desktop`.
- Workflow tests cover the main state transitions without mounting the full shell.
- Adding a third hierarchical table requires a new adapter, not copied event handlers.
- Adding a command updates one router path and the relevant command definition, not six event surfaces.
- Password and archive safety rules remain enforceable by construction.

## Recommended Next Step

Start with Slice 1 and Slice 2 together:

1. Add `src/app/hierarchicalTable.ts` and focused tests.
2. Replace archive and create-plan visible row derivation with the shared module.
3. Move selection and focus state behind the table module interface.

This is the best first move because it has two real adapters today: archive browsing and create-plan browsing. Once that interface is stable, extract Archive Workspace and Create Workspace above it.
