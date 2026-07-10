# No Hidden Legacy DOM Execution Plan

Date: 2026-07-10

Companion docs:

- `docs/REACT_GUI_EXECUTION_PLAN.md`
- `docs/FRONTEND_ARCHITECTURE_DEEPENING_PLAN.md`
- `docs/REACT_GUI_MIGRATION.md`

## Purpose

Finish the React migration by deleting the remaining hidden legacy DOM and
turning `src/runtimeBridge.ts` into a real runtime adapter rather than a
legacy GUI host.

This is not a visual rewrite. The visible React surfaces already exist. The
work is to move the remaining behaviour behind deeper modules with small
interfaces:

- dialog input/control state belongs in React intents and controller inputs,
  not hidden inputs;
- info/about dialog content belongs in snapshots, not generated hidden HTML;
- context menus should be typed data rendered by React, not HTML strings;
- archive/create string render helpers should be deleted once no bridge path
  depends on them;
- runtime event wiring should sit in React interaction adapters or app
  controllers;
- `runtimeBridge.ts` should only compose adapters, publish snapshots, and route
  commands while the final runtime module is extracted.

## Current Smell Inventory

Observed current state:

- `src/main.ts` is already a small React composition root.
- `src/ui/react/AppShell.tsx` dynamically imports `src/runtimeBridge.ts` and
  mounts `<div id="zmanager-runtime-bridge-root" />`.
- `src/runtimeBridge.ts` still writes a hidden legacy app into that root with
  `appRoot.innerHTML`.
- `src/runtimeBridge.ts` still captures many hidden DOM refs, including extract,
  info, about, archive, create, context menu, toolbar, status, and table
  elements.
- `src/runtimeBridge.ts` still has `privatizeLegacy*` functions that rename IDs
  to avoid colliding with React-owned visible IDs.
- `src/runtimeBridge.ts` still imports `src/ui/archiveWorkspaceView.ts` and
  `src/ui/createWorkspaceView.ts`.
- `src/ui/archiveWorkspaceView.ts` and `src/ui/createWorkspaceView.ts` still
  contain string render helpers and `innerHTML` writers.
- React extract submit and browse intents still write form data back into
  hidden controls via `writeReactExtractFormToLegacyControls`.
- `createExtractStartController` still asks the bridge to read extract input
  through a `readInput(mode)` callback.
- `createStartController` still supports a default `passwordInput()` callback
  that reads hidden create password fields.
- Info/about snapshots exist, but the bridge still generates hidden HTML for
  info/about and parses `aboutDiagnostics` DOM to copy diagnostics text.
- Context menu snapshots still carry raw `html`, and React renders it with
  `dangerouslySetInnerHTML`.
- Some controller interfaces still have render callbacks such as
  `renderCreateBrowser`, `renderPlanState`, `renderCreateSources`, and
  `renderCreateDestinationHistory`, which keeps the bridge as an imperative UI
  coordinator.

## Target Architecture

The final shape:

```text
src/main.ts
  React composition root only.

src/ui/react/*
  Visible rendering, local form state, interaction adapters, and typed intents.

src/app/workspaces/*
  Workflow state and snapshot derivation. No DOM. No Tauri imports.

src/app/controllers/*
  Async orchestration using injected adapters and typed input objects.
  No hidden DOM reads.

src/app/commands/*
  Command routing and typed context-menu models for every command surface.

src/app/display/*
  Locale, translator, formatting, and dialog snapshot builders.

src/desktop/*
  Tauri/native adapters, dialogs, clipboard, timers, file drop, file manager,
  native drag, preview cleanup, and window effects.

src/runtimeBridge.ts
  Temporary compatibility entry during migration, then either deleted or reduced
  to a very small runtime-adapter export with no DOM construction.
```

Important module depth goals:

- The dialog module should expose typed dialog snapshots and typed submit/browse
  intents. Its implementation may manage complex local form and password retry
  behaviour, but callers should not know about hidden controls.
- The context menu module should expose typed menu item snapshots. Its
  implementation may build labels, disabled reasons, checked state, and payloads,
  but callers should not know about HTML strings.
- The create workspace module should own create row selection/focus and create
  option state. The bridge should not hold parallel `selectedCompressRows`,
  `focusedCompressRowPath`, or hidden option controls.
- The archive workspace module should be the source for archive path, folder,
  entries, selection, search, sort, tree expansion, and command context. The
  bridge should not mirror those facts in separate variables unless the mirror
  is a clearly named adapter during a slice.
- The runtime adapter should expose one React-facing interface: current snapshot,
  subscription, and actions. It should not be a second renderer.

## Non-Negotiable Rules

- Do not move archive planning, listing, extraction, creation, safety, password
  validation, overwrite policy, symlink/hardlink handling, or zip-bomb behaviour
  into TypeScript UI code.
- Do not put passwords in snapshots, local storage, logs, diagnostics, URLs, or
  command-line arguments.
- Do not keep hidden DOM as a temporary source of truth after the corresponding
  React/controller input exists.
- Do not replace hidden DOM with another broad pass-through module. Use the
  deletion test: if deleting the module only inlines one pass-through call, the
  module is too shallow.
- Do not mark a slice complete until the old ownership path is deleted or named
  as a small adapter with a deletion plan.
- For every regression fix during this work, add a regression test in the same
  change whenever feasible.
- Every behaviour moved out of `runtimeBridge.ts` needs either characterization
  coverage before the move or interface-level coverage after the move.

## Execution Order

The order matters because several smells depend on each other:

1. Add audit guardrails and characterization tests.
2. Move extract/create dialog input out of hidden controls.
3. Make info/about snapshot-only.
4. Replace context menu HTML with typed menu snapshots.
5. Remove create string render helpers and move create bridge state behind the
   create workspace/controller seams.
6. Remove archive string render helpers and redundant archive bridge mirrors.
7. Delete the runtime bridge root and hidden legacy DOM bootstrap.
8. Split/shrink `runtimeBridge.ts` into a runtime adapter.
9. Tighten guardrails and run full validation.

Do not start by deleting `appRoot.innerHTML`; that only becomes safe after
extract, create, info/about, context menu, and remaining render callbacks no
longer depend on captured hidden elements.

## Continuation Audit: 2026-07-10

The React migration is not complete. Treat the current codebase as a hybrid
runtime until the tasks below are closed. The evidence from the latest review:

- `src/ui/react/AppShell.tsx` still imports `src/runtimeBridge.ts` dynamically
  and mounts `#zmanager-runtime-bridge-root`.
- `src/runtimeBridge.ts` is still a 7,000+ line live runtime that builds a
  hidden DOM tree with `appRoot.innerHTML`, captures hidden controls, runs
  `privatizeLegacy*` collision-avoidance code, and binds UI behaviour manually.
- `src/ui/archiveWorkspaceView.ts` and `src/ui/createWorkspaceView.ts` are still
  live legacy string-render modules with `innerHTML` writers.
- Context menus still move through an `html: string` snapshot and React renders
  it with `dangerouslySetInnerHTML`.
- Extract/create controller seams still accept hidden-control-style callbacks
  such as `readInput`, `passwordInput`, `renderPlanState`,
  `renderCreateBrowser`, `renderCreateSources`, and
  `renderCreateDestinationHistory`.
- The project has React 19 and Tailwind 4 dependencies, but most production UI
  styling is still centralized in `src/styles.css`; `src/styles.tailwind.css`
  only imports Tailwind, and shadcn coverage is currently limited to the local
  button primitive. Do not claim a full shadcn/Tailwind migration until the
  styling and component ownership is intentionally completed or explicitly
  scoped out.
- `npm run test:frontend` could not be used as proof during this audit because
  the local `node_modules` install was missing `@vitejs/plugin-react`.

### Continuation Task Ledger

Use this ledger as the remaining execution queue. A task is complete only when
the old ownership path is deleted or reduced to a small named adapter with a
deletion plan, and the changed behaviour has characterization or interface-level
tests.

1. Restore local verification before changing behaviour.
   - Run `npm install` if dependencies are missing.
   - Confirm `npm run test:frontend` starts and record the baseline.
   - Add or update a contract test that lists every remaining allowed legacy
     exception: `zmanager-runtime-bridge-root`, `appRoot.innerHTML`,
     `privatizeLegacy`, `dangerouslySetInnerHTML`, legacy view imports, and
     controller render/input callbacks.

2. Stop using hidden extract controls as the extract source of truth.
   - Change `createExtractStartController` from `startExtract(mode)` plus
     `readInput(mode)` to an explicit `startExtract(mode, input)` seam.
   - Move destination/path-mode/overwrite/strip/deduplicate/password input
     construction into React dialog local state and pure request builders.
   - Delete `writeReactExtractFormToLegacyControls`,
     `currentReactExtractDialogSnapshot`, and
     `syncReactExtractDialogSnapshot` once React no longer mirrors into hidden
     inputs.
   - Add tests for submit validation, browse-destination patching, password
     retry, archive extract, and selection extract without hidden DOM reads.

3. Stop using hidden create controls as create source of truth.
   - Change `createCreateStartController` so the submit path receives explicit
     password input from React rather than defaulting to `passwordInput()`.
   - Move destination, format, advanced options, password visibility, and
     password confirmation ownership fully into `CreateWorkspace` state/intents.
   - Delete hidden create password/destination/option reads from
     `runtimeBridge.ts`.
   - Add tests for password mismatch, encrypted format requirements,
     destination collision strategy, and successful request construction.

4. Remove controller render callbacks.
   - Replace `renderPlanState`, `renderPlanStatus`, `renderCreateBrowser`,
     `renderCreateSources`, and `renderCreateDestinationHistory` callbacks with
     workspace state changes and snapshot publication.
   - Controllers should coordinate effects and return/feed intents; they should
     not know which UI surface rerenders.
   - Add controller tests proving plan success/failure updates snapshots without
     invoking DOM render callbacks.

5. Make info/about dialogs snapshot-only.
   - Build about diagnostics text from the same snapshot data rendered by React,
     not by querying `#about-diagnostics`.
   - Delete hidden `aboutDialog`, `aboutDiagnostics`, `infoDialog`,
     `infoDialogBody`, and `infoActionGroup` ownership from `runtimeBridge.ts`.
   - Add tests for info rows/actions, about diagnostics copy text, close/focus
     behaviour, and no password leakage in dialog snapshots.

6. Replace context-menu HTML strings with typed menu snapshots.
   - Replace `ZManagerContextMenuSnapshot.html` with typed menu sections/items:
     label, command/action id, payload, disabled reason, checked state, role,
     separator, submenu if needed, and keyboard metadata.
   - Render menu items in React without `dangerouslySetInnerHTML`.
   - Delete HTML attribute payload decoding as the primary command path.
   - Add tests covering archive row menus, empty archive menus, column menus,
     create source menus, add-source menus, disabled states, checked states, and
     keyboard navigation.

7. Delete `src/ui/createWorkspaceView.ts`.
   - Port any remaining source-list, create-plan summary, destination history,
     option-control, and compress-source table behaviour into React components
     or app workspace snapshots.
   - Remove all imports of `createWorkspaceView.ts` from `runtimeBridge.ts`.
   - Delete the file and its legacy-focused tests, replacing them with React
     component or workspace tests at the public seam.

8. Delete `src/ui/archiveWorkspaceView.ts`.
   - Port remaining archive details, tree, path crumbs, browse table, selection,
     empty state, and status rendering into React components or app workspace
     snapshots.
   - Remove all imports of `archiveWorkspaceView.ts` from `runtimeBridge.ts`.
   - Delete the file and its legacy-focused tests, replacing them with React
     component or workspace tests at the public seam.

9. Move runtime event wiring out of hidden DOM.
   - Window chrome events should live in React shell components or desktop
     adapters.
   - Archive tree/table/path/search events should live in React archive
     components and dispatch typed archive intents.
   - Create tree/table/source/destination/options events should live in React
     create components and dispatch typed create intents.
   - Global document listeners should be limited to named React interaction
     adapters for keyboard shortcuts, drag/drop, pointer tracking, focus, or
     resize mechanics.

10. Delete the hidden runtime root.
    - Remove `<div id="zmanager-runtime-bridge-root" />` from `AppShell`.
    - Remove `appRoot.innerHTML`, hidden DOM queries, and `privatizeLegacy*`.
    - Remove CSS that exists only for hidden legacy scaffolding after React
      screenshot/Playwright checks prove visible surfaces still render.
    - Add a browser smoke test that boots with no
      `#zmanager-runtime-bridge-root`.

11. Split or delete `src/runtimeBridge.ts`.
    - If it remains, keep it under 150 lines and limit it to exporting
      `getZManagerRuntimeAdapter()` by delegating to deeper runtime modules.
    - Move startup, controller composition, command execution, quick actions,
      jobs, desktop effects, path history, preferences, and snapshot publication
      into named modules with injected adapters and tests.
    - If deleting it only requires changing one import, delete it.

12. Finish styling/component ownership intentionally.
    - Decide whether this cleanup also requires converting the app to
      Tailwind/shadcn component composition or whether the native desktop CSS
      layer remains an explicit product decision.
    - If Tailwind/shadcn is required, migrate repeated controls to local
      shadcn-style primitives and remove unused legacy CSS selectors as each
      surface moves.
    - If native CSS remains, document that Tailwind/shadcn is not the source of
      truth for the whole UI and remove misleading migration claims.

13. Add final guardrails.
    - Forbid `zmanager-runtime-bridge-root`, `appRoot.innerHTML`,
      `privatizeLegacy`, and live imports of `archiveWorkspaceView.ts` or
      `createWorkspaceView.ts`.
    - Forbid `dangerouslySetInnerHTML` in `src/ui/react`.
    - Forbid broad `innerHTML` in runtime/app/controller modules.
    - Forbid direct Tauri imports outside `src/api` and `src/desktop`.
    - Forbid controller imports from React UI modules.
    - Add a password-safety scan/test for snapshots, storage, diagnostics, and
      logs.

14. Run and record final validation.
    - `npm run test:frontend`
    - `npm run build`
    - `npm run ast:lint`
    - `npm run test:e2e`
    - `cd src-tauri && cargo check`
    - `cd src-tauri && cargo test`
    - Record any command that cannot run with the exact environment reason and
      the residual risk.

## Phase 0: Audit And Guardrails

Goal: make the remaining legacy paths visible and prevent new ones.

Work:

- Add or update GUI contract tests that name the remaining allowed exceptions.
- Add temporary failing/todo assertions for the final target so each slice can
  flip one exception to forbidden.
- Record exact `rg` scans in the tests or docs so reviewers can see what still
  exists.

Suggested scans:

```powershell
rg -n "zmanager-runtime-bridge-root|appRoot\.innerHTML|privatizeLegacy|writeReactExtractFormToLegacyControls" src
rg -n "dangerouslySetInnerHTML|html:" src\ui\react src\runtimeBridge.ts
rg -n "from \"\./ui/(archiveWorkspaceView|createWorkspaceView)\"|from \"\.\./ui/(archiveWorkspaceView|createWorkspaceView)\"" src
rg -n "innerHTML|insertAdjacentHTML" src
rg -n "document\.querySelector|getElementById|addEventListener" src\runtimeBridge.ts src\ui\react src\app src\desktop
```

Tests:

- `src/app/guiLayoutContracts.test.ts` should continue to protect `main.ts` as
  a small composition root.
- Add contract checks that React components do not import `src/api` or
  `src/desktop` directly, except explicit interaction adapter exceptions.
- Add contract checks that `src/app/controllers` do not import React, DOM, or
  Tauri.

Completion gate:

- There is a living list of allowed legacy exceptions, and each exception maps
  to one later phase.

## Phase 1: Dialog Input And Password State

Goal: remove extract/create controller dependence on hidden inputs.

Problem:

- React extract dialog already owns local form state, but submit/browse intents
  write that data into hidden controls.
- `createExtractStartController` calls `readInput(mode)`, which currently reads
  hidden DOM.
- `createStartController` can still read hidden create password fields through
  `passwordInput()`.
- Preview, native drag, test, and quick-action retry flows still use prompt or
  hidden password sources in different ways.

Work:

- Introduce a typed extract input object at the controller seam. It should
  include destination base path, subfolder settings, path mode, overwrite,
  strip-components text or number, deduplicate-root, and password.
- Move extract destination resolution and strip-components resolution behind
  `src/app/extractFlow.ts` or an archive workspace request builder helper.
  The controller should receive input and produce a request without asking the
  DOM for values.
- Change `createExtractStartController` so React submit calls something like
  `startExtract(mode, input)` instead of `startExtract(mode)` plus `readInput`.
- Change extract browse-destination handling so the native dialog returns a new
  dialog snapshot or form patch. Do not write the current React form into hidden
  controls before browsing.
- Replace `syncReactExtractDialogSnapshot`, `currentReactExtractDialogSnapshot`,
  and `writeReactExtractFormToLegacyControls` with a dialog state module that
  builds snapshots directly from app state and explicit form patches.
- Keep extract password as submit-only local React state. Password retry may
  reopen/update the extract dialog snapshot with `passwordPromptOpen: true`, but
  must not put the password itself in the snapshot.
- Make create submit require explicit password input at the action/controller
  call site. Remove the default hidden `passwordInput()` path once every caller
  passes explicit input or is a non-UI quick-action path.
- Audit preview/open-outside/native-drag/test password retry. If they still use
  `window.prompt`, name that as a separate password prompt adapter, not as a
  hidden dialog-control dependency.

Likely files:

- `src/app/controllers/extractStartController.ts`
- `src/app/controllers/createStartController.ts`
- `src/app/extractFlow.ts`
- `src/ui/react/dialogs/DialogRoot.tsx`
- `src/ui/react/appRuntime.ts`
- `src/runtimeBridge.ts`
- `src/app/controllers/*Controller.test.ts`
- `src/ui/react/dialogs/DialogRoot.test.tsx` if added

Tests:

- Extract submit with empty destination reports choose-destination through the
  controller using explicit input.
- Extract selection with no selected entries reports select-entry through the
  controller using explicit input.
- Password-required extract retry updates dialog prompt state without including
  a password in `ZManagerDialogSnapshot`.
- Browse extract destination preserves unsaved React form fields and applies the
  selected destination without writing hidden controls.
- Create submit passes password/passwordConfirm through the explicit React
  intent and clears local password fields after success.

Deletion gate:

- Remove `writeReactExtractFormToLegacyControls`.
- Remove hidden extract input reads from `extractStartController` setup.
- Remove hidden create password reads from `createStartController` setup.
- Remove extract hidden-control sync functions.

Status 2026-07-10: partially complete for extract. `createExtractStartController`
now receives explicit `ExtractStartInput` in `startExtract(mode, input)`, the
runtime bridge no longer configures a controller `readInput` callback, and React
extract submit/browse no longer writes form state into hidden extract controls.
The legacy extract dialog still uses hidden controls for its own direct button
and keyboard paths, and `currentReactExtractDialogSnapshot` /
`syncReactExtractDialogSnapshot` remain until the full dialog-state module
replaces that ownership path.

## Phase 2: Snapshot-Only Info And About Dialogs

Goal: make info/about snapshots the only dialog content source.

Problem:

- `showArchiveInfo`, `showEntryInfo`, and `showSelectionInfo` generate hidden
  info HTML and then also set React snapshots.
- `renderAboutDiagnostics` writes hidden HTML and returns data.
- `diagnosticsText()` parses hidden DOM to build clipboard text.

Work:

- Add a pure dialog snapshot builder module. Good homes are
  `src/app/display/dialogSnapshots.ts` or `src/app/dialogSnapshots.ts`.
- Build archive, entry, selection, and about snapshots directly from archive
  workspace snapshots, display context, healthcheck, and project contract data.
- Add a pure serializer for diagnostics and info detail rows.
- Change copy-about-diagnostics to serialize the about snapshot data rather
  than reading `aboutDiagnostics`.
- Change info actions to use the action objects already in
  `ZManagerDialogSnapshot`, not hidden `data-info-action` buttons.
- Keep return-focus metadata in the dialog snapshot or a tiny focus adapter. Do
  not keep hidden dialog elements for focus fallback.

Likely files:

- `src/runtimeBridge.ts`
- `src/ui/react/dialogs/DialogRoot.tsx`
- `src/ui/react/appRuntime.ts`
- `src/app/display/displayContext.ts`
- new `src/app/display/dialogSnapshots.ts`

Tests:

- Archive info snapshot contains archive name, path, format, entry count, size,
  packed size, and last test status.
- Entry info snapshot includes preview/copy/archive actions based on entry kind.
- Selection info snapshot handles multi-selection and copy-details text.
- About diagnostics text serializer produces the same support text without DOM.
- Locale refresh changes labels through display context rather than persisted
  workflow state.

Deletion gate:

- Remove `infoDialogBody.innerHTML`.
- Remove `aboutDiagnostics.innerHTML`.
- Remove `diagnosticsText()` DOM parsing.
- Remove hidden `aboutDialog`, `infoDialog`, `infoActionGroup`, and their close
  button listeners once React modal focus is covered.

## Phase 3: Typed Context Menu Snapshots

Goal: delete raw HTML context menu payloads and React
`dangerouslySetInnerHTML`.

Problem:

- `ZManagerContextMenuSnapshot` contains an HTML string.
- `ContextMenuRoot` renders that string with `dangerouslySetInnerHTML`.
- Context menu builders in `runtimeBridge.ts` mix labels, command availability,
  checked state, path payloads, and HTML escaping.

Work:

- Replace the context menu snapshot shape with typed menu rows:
  action item, checkbox item, caption, separator, and optional disabled reason.
- Put command payloads in typed data, not `data-*` attributes.
- Move builders into `src/app/commands/contextMenuModel.ts` or a nearby command
  module so context menus share command-router vocabulary.
- Keep React as the renderer. It should map typed rows to buttons and dispatch
  `ZManagerContextMenuIntent`.
- Preserve keyboard/menu behaviour and disabled states.

Likely files:

- `src/ui/react/appRuntime.ts`
- `src/ui/react/context-menu/ContextMenuRoot.tsx`
- `src/app/commands/commandRouter.ts`
- new `src/app/commands/contextMenuModel.ts`
- `src/runtimeBridge.ts`
- `src/app/guiLayoutContracts.test.ts`

Tests:

- Startup empty context menu exposes open/paste/recent actions as typed items.
- Archive row/folder context menu maps to the same command payloads as before.
- Header context menu preserves sort, column movement, visibility, reset width,
  and reset columns actions.
- Create row/source context menus preserve reveal, include/exclude, remove, and
  clear actions.
- React context menu test verifies no `dangerouslySetInnerHTML`.

Deletion gate:

- Remove `ZManagerContextMenuSnapshot.html`.
- Remove `showContextMenu(x, y, html)` in favour of
  `showContextMenu(x, y, items)`.
- Remove `dangerouslySetInnerHTML`.
- Remove string context menu builders from `runtimeBridge.ts`.

Status 2026-07-10: complete for the live React context-menu path. Context menu
snapshots now carry typed `ContextMenuModelItem` rows from
`src/app/commands/contextMenuModel.ts`; `ContextMenuRoot` renders those rows
without `dangerouslySetInnerHTML`; `decodeContextMenuAction` was deleted; and
`src/app/guiLayoutContracts.test.ts` now guards the typed snapshot seam.

## Phase 4: Create Workspace Deepening

Goal: delete create legacy render helpers and bridge-held create UI state.

Problem:

- `runtimeBridge.ts` imports many functions from `src/ui/createWorkspaceView.ts`.
- Create controllers still call render callbacks such as `renderCreateBrowser`,
  `renderPlanState`, `renderPlanStatus`, and `renderCreateSources`.
- The bridge still owns create row selection/focus state separately from the
  create workspace snapshot.
- Hidden create controls still drive option state sync and destination history.

Work:

- Move create table selection/focus/anchor into `createWorkspace` or a dedicated
  create table module behind the create workspace interface.
- Make `CreateWorkspaceSnapshot` include every render-ready fact React needs for
  selection, focus, destination history, option controls, and plan status.
- Change `createPlanController` render callbacks into snapshot/result callbacks
  that the runtime adapter can publish. The controller should not know about
  browsers, `innerHTML`, or hidden controls.
- Change `quickActionController` dependencies from `renderCreateSources` and
  `renderCompressBrowser` to create workspace/controller intents plus snapshot
  publication.
- Remove `syncCreateOptionControls`, hidden destination/select/password option
  control updates, and create datalist rendering.
- Preserve browser-preview create planning in a testable adapter.

Likely files:

- `src/app/workspaces/createWorkspace.ts`
- `src/app/controllers/createPlanController.ts`
- `src/app/controllers/createStartController.ts`
- `src/app/controllers/quickActionController.ts`
- `src/ui/react/create/CreateWorkspace.tsx`
- `src/ui/react/appRuntime.ts`
- `src/runtimeBridge.ts`
- `src/ui/createWorkspaceView.ts`

Tests:

- Create workspace snapshot exposes selected/focused rows and inclusion state as
  arrays/plain data.
- Create plan controller queues, begins, accepts, rejects stale results, and
  reports status through its interface without render callbacks.
- Quick-action create review populates create workspace through controller
  intents and publishes one React snapshot.
- Create destination history renders from `pathHistory` snapshot only.

Deletion gate:

- No imports of `src/ui/createWorkspaceView.ts`.
- Delete `src/ui/createWorkspaceView.ts`.
- Remove hidden create DOM refs from `runtimeBridge.ts`.
- Remove bridge-level `selectedCompressRows`, `focusedCompressRowPath`, and
  `compressSelectionAnchorPath` unless they have been moved into a named create
  workspace module with tests.

## Phase 5: Archive Workspace Deepening

Goal: delete archive legacy render helpers and bridge-held archive mirrors.

Problem:

- `runtimeBridge.ts` imports string render helpers from
  `src/ui/archiveWorkspaceView.ts`.
- The bridge mirrors archive workspace facts in variables such as current path,
  folder, search query, entries, selected paths, sort, expanded folders, and
  tree children.
- Some command execution and native effects read those mirrors instead of
  asking the archive workspace snapshot or a focused selector module.

Work:

- Replace bridge mirrors with selectors over `archiveWorkspace.getSnapshot()`.
  Keep a short-lived adapter only where an effect genuinely needs mutable local
  process state.
- Move archive tree child derivation into archive workspace or a tested archive
  display selector.
- Make command context use archive workspace snapshots directly.
- Make status/meta/path/details snapshots the source for React. Do not call
  `renderBrowse`, `renderTree`, `renderDetails`, `renderPathBar`, or
  `updateStatusBar` as render functions.
- Keep native drag request building in archive workspace/controller code, with
  desktop `startNativeFileDrag` injected as an adapter.
- Keep preview cleanup metadata in shell/desktop adapters, not table DOM.

Likely files:

- `src/app/workspaces/archiveWorkspace.ts`
- `src/app/archiveTable.ts`
- `src/app/archiveTree.ts`
- `src/app/controllers/archivePreviewController.ts`
- `src/app/controllers/archiveLoadController.ts`
- `src/ui/react/archive/*`
- `src/runtimeBridge.ts`
- `src/ui/archiveWorkspaceView.ts`

Tests:

- Archive load preserves folder/search/selection/sort when requested without
  bridge mirrors.
- Tree expansion and folder navigation are covered through archive workspace
  interface tests.
- Archive command state is selected from workspace snapshots.
- Native drag selection and password retry use workspace/controller seams, not
  DOM rows.

Deletion gate:

- No imports of `src/ui/archiveWorkspaceView.ts`.
- Delete `src/ui/archiveWorkspaceView.ts`.
- Remove hidden archive DOM refs and `privatizeLegacyArchiveSurfaceIds`.
- Remove legacy archive row attribute privatization.

## Phase 6: Runtime Event Wiring

Goal: move remaining event wiring to React interaction adapters or desktop/app
controllers.

Problem:

- `runtimeBridge.ts` still binds many DOM events with `addEventListener`.
- Some bindings now target hidden elements that should not exist.
- Some bindings represent real runtime streams and should live in desktop
  adapters or controller startup code.

Work:

- Keep React-owned visible interactions in `src/ui/react/interaction/*` or the
  relevant React surface.
- Keep Tauri/native event streams in `src/desktop/*` adapters.
- Keep startup orchestration in `startupController`.
- Keep timers in `src/desktop/timers.ts` and controllers.
- Move window titlebar/resize behaviour into React titlebar interaction or a
  small window adapter call. Do not bind hidden window buttons.
- Remove modal controller usage for hidden extract/info/about dialogs after
  React dialog focus is tested. If React needs shared modal focus behaviour,
  expose it as a React hook or interaction adapter.

Likely files:

- `src/ui/react/interaction/*`
- `src/ui/react/shell/TitleBar.tsx`
- `src/ui/react/dialogs/DialogRoot.tsx`
- `src/desktop/fileDrop.ts`
- `src/desktop/windowController.ts`
- `src/desktop/quickActionEvents.ts`
- `src/runtimeBridge.ts`
- `src/ui/modalController.ts`

Tests:

- Keyboard shortcuts route typed intents and do not require hidden controls.
- Browser/Tauri file drop adapters dispatch typed desktop intents.
- Dialog escape/default/cancel behaviour is covered in React tests.
- Linux window resize handle still calls `beginResizeDrag` through a tested
  adapter path.

Deletion gate:

- `runtimeBridge.ts` has no `document.querySelector` for visible/hidden UI
  controls.
- `runtimeBridge.ts` has no event listeners for UI controls. Runtime streams are
  allowed only through named desktop adapters.
- `#zmanager-runtime-bridge-root` is no longer required by any code.

## Phase 7: Delete Hidden Legacy DOM Bootstrap

Goal: remove the hidden DOM root and all generated hidden HTML.

Work:

- Remove `<div id="zmanager-runtime-bridge-root" />` from `AppShell`.
- Remove `appRoot.innerHTML = ...` from `runtimeBridge.ts`.
- Remove all legacy DOM queries that only existed to capture generated hidden
  elements.
- Remove `privatizeLegacyArchiveSurfaceIds`,
  `privatizeLegacyExtractDialogIds`,
  `privatizeLegacyInfoAboutDialogIds`, and
  `privatizeLegacyCreateWorkspaceIds`.
- Remove CSS that only targets hidden legacy scaffolding, after checking React
  surfaces do not still depend on those selectors.
- Rename any test names that still claim "legacy" where the code is now the
  product path.

Tests:

- Browser smoke boots with no `#zmanager-runtime-bridge-root`.
- Extract, create, info, about, jobs, context menu, keyboard shortcuts, file
  drop, and quick action startup still pass focused tests.
- GUI contract test forbids `appRoot.innerHTML`,
  `zmanager-runtime-bridge-root`, and `privatizeLegacy`.

Deletion gate:

- `rg -n "zmanager-runtime-bridge-root|appRoot\.innerHTML|privatizeLegacy" src`
  returns no matches.

## Phase 8: Shrink Or Delete `runtimeBridge.ts`

Goal: make the runtime adapter deep enough to keep, or delete the bridge name.

Problem:

- A large `runtimeBridge.ts` that owns workspaces, controllers, command routing,
  dialogs, quick actions, jobs, desktop effects, and snapshot publication is
  still a god module even after hidden DOM is gone.

Work:

- Extract a runtime module that owns app startup and snapshot publication.
- Extract command execution effects into a command runtime/controller module.
- Keep native/Tauri calls in `src/desktop` and command DTO calls in `src/api`.
- Keep app state mutation in shell/workspace/controller modules.
- Decide whether `src/runtimeBridge.ts` remains as a tiny compatibility export
  or is deleted in favour of a clearly named runtime adapter module.

Possible final options:

- `src/runtimeBridge.ts` is deleted, and `AppShell` imports a named runtime
  adapter module.
- `src/runtimeBridge.ts` remains under 150 lines and only exports
  `getZManagerRuntimeAdapter()` by delegating to deeper modules. It must contain
  no DOM construction, no workflow state mirrors, no HTML strings, and no
  controller implementations.

Tests:

- Runtime adapter store publishes immutable snapshots and unsubscribes cleanly.
- Command runtime executes all command-router effects through injected adapters.
- Startup controller still fetches healthcheck/contract/quick-action startup
  state and publishes correct snapshots.
- Password safety contract confirms snapshots contain no password fields or
  values.

Completion gate:

- `runtimeBridge.ts` passes the deletion test. If deleting it only requires
  changing one import, delete it. If it earns its keep, it should expose a small
  runtime adapter interface and hide meaningful composition behind it.

## Phase 9: Final Guardrails And Validation

Goal: make the cleanup durable.

Guardrails to add or tighten:

- Forbid `appRoot.innerHTML`, `insertAdjacentHTML`, and broad `innerHTML` in
  runtime/app/controller modules. Allow local React test rendering and tightly
  named DOM helpers only where justified.
- Forbid `dangerouslySetInnerHTML` in React UI unless a future explicit ADR
  allows a sanitized rich-text renderer.
- Forbid imports of `src/ui/archiveWorkspaceView.ts` and
  `src/ui/createWorkspaceView.ts`.
- Forbid `zmanager-runtime-bridge-root` and `privatizeLegacy`.
- Forbid direct Tauri imports outside `src/api` and `src/desktop`.
- Forbid controller imports from `src/ui/react`.
- Guard against password leakage in snapshots, storage, diagnostics, and logs.

Automated validation:

```powershell
npm.cmd run test:frontend
npm.cmd run build
npm.cmd run ast:lint
npm.cmd run test:e2e
cd src-tauri; cargo check
cd src-tauri; cargo test
```

Manual smoke:

- Browser fixture archive opens and supports navigation, selection, search,
  context menus, info dialog, preview/open-outside actions, extract dialog, and
  keyboard shortcuts.
- Create workspace supports adding sources, source context menus, plan preview,
  inclusion/exclusion, destination history, format changes, password options,
  and start-create request validation.
- Jobs drawer and quick-action progress support polling, pause/resume/cancel,
  retry password prompt, output actions, dismiss, and focused quick-action
  auto-close behaviour.
- Preferences save/cancel, locale refresh, toolbar preferences, create defaults,
  and output folder validation work without hidden controls.
- About diagnostics copy works and matches visible about data.
- File drop and native drag remain desktop-only where appropriate and report
  browser-preview limitations clearly.

## Definition Of Done

The cleanup is complete only when all are true:

- No hidden legacy DOM root exists.
- No `appRoot.innerHTML` bootstrap exists.
- No `privatizeLegacy*` functions exist.
- No React path writes form state into hidden controls.
- Info/about dialogs are built from snapshots only.
- Context menus are typed snapshots rendered by React.
- `src/ui/archiveWorkspaceView.ts` and `src/ui/createWorkspaceView.ts` are
  deleted or contain no legacy string render helpers and no live imports.
- `runtimeBridge.ts` is deleted or is a small runtime adapter with no DOM
  construction, no HTML strings, no hidden control refs, and no broad workflow
  state mirrors.
- The final `rg` scans from Phase 0 have no architecture-breaking remnants.
- The automated validation suite has been run, or any environment-blocked
  command is recorded with the exact gap.

## Suggested PR Slices

Keep slices narrow and deletion-focused:

1. Guardrails and audit tests.
2. Extract dialog explicit input controller seam.
3. Create submit explicit password seam.
4. Snapshot-only info/about.
5. Typed context menu model.
6. Create workspace helper deletion.
7. Archive workspace helper deletion.
8. Runtime event wiring cleanup.
9. Hidden root deletion.
10. Runtime adapter extraction/shrink.
11. Final guardrails and e2e release proof.

Each PR should state:

- which old ownership path was deleted;
- which new module owns the behaviour;
- which tests prove the moved behaviour;
- which legacy exceptions remain and which later PR owns them.

## Residual Risks To Watch

- Password retry flows are easy to accidentally split between prompt, hidden
  control, and React local state. Keep one explicit password adapter per flow.
- Quick-action startup touches create, extract, jobs, window state, and startup
  visibility. Preserve its controller tests before moving wiring.
- Context menus currently encode payload in HTML attributes. The typed model
  must preserve every payload, disabled state, checked state, and command route.
- CSS cleanup can break React surfaces if selectors were shared with legacy
  markup. Delete CSS only after screenshot or Playwright coverage.
- Removing bridge mirrors may reveal missing workspace snapshot fields. Add
  fields only when they are render-ready plain data, not mutable structures or
  localized workflow state.
