# ZManager Desktop Frontend Architecture Deepening Plan

Date: 2026-07-08

## Goal

Make the frontend easier to manage by moving durable workflow behavior out of `src/main.ts` and into deep modules with small, hard-to-misuse interfaces.

The specific first target is a reusable hierarchical table pane. The table pane should make archive browsing and create-plan browsing share one behavioral implementation instead of growing parallel code paths.

This is an architecture plan only. It does not change runtime behavior yet.

## Current Diagnosis

`src/main.ts` is acting as the application architecture instead of the composition root. It currently owns:

- Initial shell markup and DOM queries.
- Browse/extract archive state.
- Create-plan source state.
- Archive and create-plan folder tree rendering.
- Archive and create-plan table row construction.
- Selection, focus, keyboard movement, and context menu behavior.
- Column rendering, sorting, resizing, and persistence.
- Dialog behavior.
- Job polling and quick-action window behavior.
- Drag/drop and native drag-out behavior.

This explains why the file feels hack-prone. A future change can add behavior anywhere in the module, because the module has no narrow interface that forces new behavior into the right place.

The extracted modules under `src/app` and `src/ui` are useful, but many are still shallow. They hold helper functions while the ordering rules, state transitions, and DOM behavior remain in `src/main.ts`.

## Existing Good Direction

The codebase already has some good seams:

- `src/app/archiveTable.ts` owns archive table columns, formatting, sorting, width normalization, and visibility rules.
- `src/app/archiveTree.ts` owns archive path normalization, tree construction, breadcrumbs, search matching, and visible archive entries.
- `src/app/selection.ts` owns row selection intent logic.
- `src/app/createFlow.ts` owns create request validation and request construction.
- `src/ui/jobsView.ts` and `src/ui/preferencesView.ts` are early examples of render-oriented modules.

The issue is not that everything is wrong. The issue is that these modules do not yet have enough depth. Deleting them would not fully concentrate the complexity back into obvious places; much of the real workflow knowledge already lives outside them.

## Deepening Opportunities

### 1. Archive Workspace Module

Files:

- `src/main.ts`
- `src/app/archiveTree.ts`
- `src/app/archiveTable.ts`
- `src/app/archiveEntryIcons.ts`

Problem:

Archive browsing state is spread across globals: current archive, current folder, search query, flat view, selected entries, expanded folders, focused entry, table sort, column settings, and system icons.

Solution:

Create an Archive Workspace module that owns archive browsing state and exposes a small interface for user intents: load listing, navigate, search, select, sort, and derive view state.

Benefits:

- Locality: folder, search, selection, and sort bugs are fixed in one place.
- Leverage: details pane, toolbar, context menus, and extraction commands can all read one consistent selection/view state.
- Tests: archive browsing behavior can be tested without mounting the full desktop shell.

### 2. Reusable Hierarchical Table Pane

Files:

- `src/main.ts`
- `src/app/archiveTree.ts`
- `src/app/archiveTable.ts`
- `src/app/selection.ts`

Problem:

Browse and create-plan views are two adapters for the same interaction model: a folder-like table with parent rows, folder rows, entry rows, selection, focus, keyboard navigation, optional checkboxes, context menus, and empty/loading states. Today they duplicate the behavior with different data attributes and different globals.

Solution:

Create a deep Hierarchical Table Pane module. Its interface should accept rows, state, behavior options, and adapter callbacks. It should own row identity, focus, selection, keyboard movement, activation, empty/loading rendering, and safe DOM event routing.

Benefits:

- Locality: table interaction changes land in one module instead of two branches in `main.ts`.
- Leverage: archive browsing and create-plan browsing both inherit the same focus, keyboard, selection, and accessibility behavior.
- Tests: the pane becomes the test surface for row behavior, not `main.ts`.

### 3. Create Workspace Module

Files:

- `src/main.ts`
- `src/app/createFlow.ts`
- `src/app/archiveTree.ts`

Problem:

Create flow request construction is extracted, but staged sources, plan entries, inclusion/exclusion, create-plan folder navigation, destination history, and plan rendering are still in `main.ts`.

Solution:

Create a Create Workspace module that owns staged sources, plan state, inclusion state, visible create-plan rows, destination defaults, and create readiness.

Benefits:

- Locality: create-plan bugs stop leaking through table rendering and command wiring.
- Leverage: quick actions, drag/drop, and the create workspace can share the same source/plan model.
- Tests: inclusion/exclusion and plan state can be tested through one interface.

### 4. Command Routing Module

Files:

- `src/main.ts`
- `src/app/classicCommands.ts`

Problem:

Command labels and availability are partly centralized, but execution is manually bound across toolbar buttons, menu items, context menu actions, keyboard shortcuts, and details pane buttons.

Solution:

Create a command routing module. UI surfaces emit command IDs and optional payloads; the workspace state decides availability and execution.

Benefits:

- Locality: command enablement and execution stay aligned.
- Leverage: adding a command updates toolbar, menu, shortcut, and context behavior through the same route.
- Tests: command availability can be tested against workspace state without DOM event wiring.

### 5. Modal Dialog Module

Files:

- `src/main.ts`
- `src/ui/preferencesView.ts`

Problem:

Generic modal behavior is mixed with extract, preferences, info, and about dialog behavior.

Solution:

Create a modal module that owns focus trap, return focus, default/cancel actions, and visibility. Dialog-specific modules own their own view state.

Benefits:

- Locality: accessibility fixes happen once.
- Leverage: new dialogs get correct focus behavior by construction.
- Tests: modal keyboard behavior has one test surface.

### 6. Jobs And Quick Action Workspace Module

Files:

- `src/main.ts`
- `src/app/jobs.ts`
- `src/ui/jobsView.ts`
- `src/app/quickActions.ts`

Problem:

Job state helpers and job rendering are extracted, but polling, retry prompts, quick-action focused mode, auto-close, and window behavior are still interleaved.

Solution:

Create a Jobs Workspace module that owns job state, polling decisions, retry eligibility, and focused quick-action job state. Desktop window calls remain adapters.

Benefits:

- Locality: job lifecycle bugs do not require reading the whole app.
- Leverage: normal jobs and quick-action jobs share lifecycle behavior.
- Tests: polling and retry behavior can be tested without Tauri window state.

## First Target: Reusable Hierarchical Table Pane

### Why This First

This is the strongest first deepening candidate because it already has two real adapters:

- Archive browser table.
- Create-plan table.

One adapter would make this seam hypothetical. Two adapters make it real.

It also attacks the user's visible pain directly: the folder view and table view can be reused, and duplicated code can stop spreading.

### Current Browse Table Responsibilities In `main.ts`

The archive browser path currently owns:

- Building rows from archive entries.
- Parent folder row insertion.
- Folder/file row rendering.
- Search result row behavior.
- Flat view behavior.
- Sort and column rendering.
- Header rendering.
- Select-all state.
- Row checkbox state.
- Focused row state.
- Click, double-click, keyboard, and context menu routing.
- Native drag-out gestures.
- Marquee selection.
- Details pane refresh after selection changes.

Relevant locations:

- `buildBrowserRows`
- `visibleRows`
- `renderTableHeader`
- `renderBrowseRows`
- `updateSelectionByIntent`
- `syncVisibleSelectionUi`
- table event listeners near the end of `main.ts`

### Current Create-Plan Table Responsibilities In `main.ts`

The create-plan path currently owns:

- Building visible rows from plan entries.
- Parent folder row insertion.
- Folder/file row rendering.
- Inclusion checkbox rendering.
- Include/exclude state.
- Source path lookup from row path.
- Selected create-plan rows.
- Focused create-plan row.
- Click, keyboard, delete, and context menu routing.
- Current create-plan folder navigation.

Relevant locations:

- `visibleCompressRows`
- `renderCompressSources`
- `renderCompressPlanRow`
- `updateCompressSelectionByIntent`
- `syncCompressSelectionUi`
- `compressSourceBody` event listeners near the end of `main.ts`

### Shared Concept

Both tables are a hierarchical table:

- Rows have stable path identity.
- Rows may be parent, folder, or entry rows.
- Folder rows can activate navigation.
- Entry rows can activate a caller-defined action.
- Rows may be selectable.
- Rows may be focused.
- Visible rows are derived from a current folder and row source.
- Some visible rows are synthetic folders.
- Some rows carry domain entries.
- The table has loading, empty, and loaded states.
- Keyboard and mouse behavior should be consistent.

The module should be named after that concept, not after archive extraction or create planning.

### Target Module Shape

Recommended files:

- `src/app/hierarchicalTable.ts`
- `src/app/hierarchicalTable.test.ts`
- `src/ui/hierarchicalTableView.ts`
- `src/ui/hierarchicalTableView.test.ts`

Keep pure state and row derivation in `src/app`. Keep HTML rendering and DOM event binding in `src/ui`.

The seam should sit above low-level row helpers and below workspace-specific actions. In other words:

- The pane owns table behavior.
- Archive Workspace owns archive-specific commands.
- Create Workspace owns create-plan-specific commands.
- `main.ts` wires adapters together.

### Proposed Interface Direction

The interface should be small enough that callers cannot bypass the core behavior casually.

Illustrative shape:

```ts
type HierarchicalTableState<TEntry> = {
  rows: HierarchicalTableRow<TEntry>[];
  selectedPaths: Set<string>;
  focusedPath: string;
  anchorPath: string;
  currentFolder: string;
  status: "empty" | "loading" | "loaded" | "error";
};

type HierarchicalTableAdapter<TEntry> = {
  getPath: (entry: TEntry) => string;
  getKind: (entry: TEntry) => "folder" | "entry";
  getLabel: (entry: TEntry) => string;
  renderCells: (row: HierarchicalTableRow<TEntry>) => string[];
  onActivateFolder: (path: string) => void;
  onActivateEntry: (path: string) => void;
  onContextMenu: (path: string, point: { x: number; y: number }) => void;
};
```

This is not final code. It is the shape of the seam: table behavior is common, while cells and actions are adapters.

### What The Pane Should Own

The pane should own:

- Parent row behavior.
- Visible row derivation from current folder.
- Stable row IDs and row data attributes.
- Selection intent application.
- Select-all and visible selection state.
- Focus movement.
- Keyboard behavior for arrows, space, enter, context menu, and optional delete.
- Click and double-click interpretation.
- Empty, loading, error, and loaded table states.
- ARIA selection state.
- Optional checkbox cell behavior.
- Optional context menu trigger.
- Optional column header behavior.

The pane should not own:

- Tauri commands.
- Archive extraction or creation behavior.
- Password handling.
- Native file dialogs.
- Create destination history.
- Job polling.
- User-visible archive safety rules.

### Required Adapters

#### Archive Browser Adapter

Owns archive-specific behavior:

- Archive entry DTO mapping.
- Archive table columns.
- Real file icon lookup.
- Preview/open action.
- Extract selection action.
- Native drag-out action.
- Archive context menu actions.
- Details pane data.

The pane should give this adapter row activation and selection change events. The adapter should not reimplement row selection.

#### Create Plan Adapter

Owns create-specific behavior:

- Create plan entry DTO mapping.
- Inclusion/exclusion state.
- Include-all state.
- Source path lookup.
- Remove source action.
- Reveal source action.
- Create-plan context menu actions.

The pane should give this adapter a slot for inclusion cells and delete-key behavior. The adapter should not reimplement focus and selection.

### Anti-Hack Guardrails

These rules should be enforced during the refactor:

- No new table row event listeners in `main.ts`.
- No new folder row builders in `main.ts`.
- No new selection globals for table-like panes in `main.ts`.
- No direct `innerHTML` table body rendering for archive/create rows outside the table view module.
- No duplicate parent-row or synthetic-folder logic.
- No table-specific DOM data attribute names owned by adapters unless the pane defines them.
- No command-specific behavior inside the generic table pane.
- No archive behavior reimplemented in TypeScript beyond presentation and command DTO assembly.

### Deletion Test

After the refactor, deleting the Hierarchical Table Pane module should force the following complexity to reappear in both archive browsing and create-plan browsing:

- Row identity.
- Folder navigation rows.
- Selection ranges.
- Focus movement.
- Keyboard behavior.
- Empty/loading/error rendering.
- ARIA row state.
- Context menu triggers.

If deleting the module would only remove a thin `renderRows()` wrapper, the module is too shallow.

## Migration Plan

### Slice 1: Freeze Current Behavior With Focused Tests

Scope:

- Add tests around existing pure helpers before moving behavior.
- Prefer `src/app/archiveTree.ts`, `src/app/archiveTable.ts`, and `src/app/selection.ts`.
- Add missing tests for folder row derivation if a helper is extracted.

Done when:

- Existing archive table sorting and selection tests still pass.
- Folder mode, flat mode, search mode, and parent row behavior have test coverage.

### Slice 2: Extract Row Derivation

Scope:

- Move shared visible-row derivation into `src/app/hierarchicalTable.ts`.
- Support parent, folder, entry, synthetic folder, search, flat view, and current folder.
- Make archive entries and create plan entries use adapters.

Done when:

- `buildBrowserRows` and `visibleCompressRows` are replaced by calls into the same module.
- Archive browser and create-plan browser produce the same visible row order as before.

### Slice 3: Extract Selection And Focus State

Scope:

- Move selected paths, focused path, anchor path, visible selectable paths, and selection cleanup into the table state.
- Preserve hidden-selection behavior where intentionally used by search.

Done when:

- Browse and create-plan selection changes use the same state transition.
- `selectedEntries`, `selectedCompressRows`, `focusedEntryPath`, `focusedCompressRowPath`, `selectionAnchorPath`, and `compressSelectionAnchorPath` stop being directly mutated by row event handlers.

### Slice 4: Extract View Rendering

Scope:

- Add `src/ui/hierarchicalTableView.ts`.
- Render table body states and common row attributes in one place.
- Keep archive-specific cells and create-specific cells behind adapters.

Done when:

- Archive and create-plan table bodies are rendered through one view module.
- Select-all state and ARIA state are set by the table view module.

### Slice 5: Extract DOM Event Routing

Scope:

- Move click, double-click, keydown, checkbox, and context menu routing into the table view module.
- Adapters receive typed events such as activate folder, activate entry, selection changed, delete requested, context requested.

Done when:

- `main.ts` no longer binds table-specific row events directly.
- Archive and create-plan keyboard behavior remains consistent.

### Slice 6: Connect Workspace Modules

Scope:

- Let Archive Workspace and Create Workspace own the adapters.
- Let `main.ts` keep composition only: instantiate workspaces, pass DOM roots, and call high-level render/update functions.

Done when:

- `main.ts` no longer knows how a table row is selected, focused, or activated.
- `main.ts` only routes application-level commands and desktop adapters.

## Testing Strategy

Add tests at the interface, not behind it.

Recommended coverage:

- Row derivation:
  - root folder.
  - nested folders.
  - explicit directory entries.
  - synthetic folders.
  - parent row.
  - flat view.
  - search view.
- Selection:
  - click replacement.
  - ctrl/meta toggle.
  - shift range.
  - hidden selection preservation under search.
  - selection cleanup when visible rows disappear.
- Focus:
  - arrow movement.
  - focus restoration after render.
  - focused row removed from visible rows.
- Rendering:
  - loading state.
  - empty state.
  - error state.
  - selectable row ARIA state.
  - checkbox state.
- Adapter events:
  - folder activation.
  - entry activation.
  - context request.
  - delete request for create-plan rows.

Keep Playwright coverage for end-to-end confidence, but do not make Playwright the primary proof of table behavior. The pane should be testable in Vitest.

## Success Criteria

The table-pane refactor is successful when:

- Archive browsing and create-plan browsing share one table behavior module.
- `main.ts` no longer owns row building, row selection, row focus, or row keyboard behavior.
- Adding a third hierarchical table requires a new adapter, not copied event handlers.
- The pane interface makes bypassing selection/focus behavior awkward.
- Search, flat view, parent folder rows, create-plan inclusion, context menus, and keyboard navigation still work.
- `npm run test:frontend` covers the table pane directly.

## Non-Goals

- Do not migrate to a frontend framework as part of this refactor.
- Do not redesign the visual UI during the architecture work.
- Do not change archive command contracts.
- Do not move archive behavior from Rust into TypeScript.
- Do not introduce a general-purpose table library unless this module proves too expensive to own.

## Recommended Next Step

Start with Slice 1 and Slice 2 together:

1. Add missing row-derivation tests.
2. Extract the row derivation into `src/app/hierarchicalTable.ts`.
3. Make both archive browsing and create-plan browsing call the same derivation module.

That first step is low-risk because it does not need to change DOM event behavior yet. It creates the real seam first, then later slices move selection, rendering, and event routing behind it.
