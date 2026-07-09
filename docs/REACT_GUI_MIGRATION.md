# React GUI Migration

Date: 2026-07-09

ZManager Desktop is migrating its GUI layer to React 19, shadcn/ui, Tailwind CSS v4,
Vite, TypeScript, and Tauri v2 while keeping archive semantics in Rust and
`zmanager-core`.

## Boundary

- React owns rendering and UI composition.
- shadcn/ui components live in `src/ui/components`.
- Tailwind is available through `src/styles.tailwind.css`; import it only for
  React-rendered surfaces that are ready for Tailwind's global styles.
- Existing `src/app` workflow modules remain the source of deterministic state
  transitions and request readiness.
- Existing `src/api` modules remain the command DTO and invoke boundary.
- Existing `src/desktop` modules remain the concrete Tauri/runtime adapter
  boundary.

## Current Slice

The current entrypoint is React-based:

- `src/main.ts` renders `AppShell`.
- `src/ui/react/AppShell.tsx` owns the first React shell boundary.
- `src/legacyMain.ts` keeps the current imperative GUI mounted inside
  `#zmanager-legacy-root` until each workspace is converted.

This is intentionally a bridge. Future work should move one surface at a time
from `legacyMain.ts` into React components backed by existing app/workspace
snapshots.

## Rules

- Do not put archive workflow state into React components.
- Do not call Tauri directly from React components.
- Do not pass passwords through React snapshots, logs, diagnostics, URLs, or
  persisted state.
- Route new command surfaces through `src/app/commands/commandRouter.ts`.
- Prefer React components in `src/ui/react` and reusable shadcn-style controls
  in `src/ui/components/ui`.
- Add characterization tests before moving behavior out of `legacyMain.ts`.
- Keep `src/main.ts` as a small composition root.

## Next Slices

Detailed execution plan: `docs/REACT_GUI_EXECUTION_PLAN.md`.

1. Convert shell chrome and toolbar to React components that emit command IDs.
2. Convert the archive workspace view from string HTML to React using
   `ArchiveWorkspaceSnapshot`.
3. Convert create workspace and jobs drawer after archive browsing has stable
   component and selection coverage.
4. Add generated Rust/TypeScript command bindings or explicit command-contract
   tests before changing DTOs.
