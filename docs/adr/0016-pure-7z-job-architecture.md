# ADR-0016: Pure 7-Zip job architecture — remove freeze, drawer, and focused progress

- Status: Accepted
- Date: 2026-07-29

## Context

The app had three overlapping job-progress systems, but only one actually ran on
desktop:

1. **Disposable task windows** — separate OS windows, one per job, with
   self-contained progress UI and auto-close on completion. This is the system
   that actually runs on desktop for all focused jobs.

2. **Main window "jobOnly" freeze** — forcibly resizes/centers the main window
   and replaces the workspace with a focused progress view. Dead on desktop
   because `addJobState`'s `useDisposableWindow` flag is always true when
   `isDesktopRuntime()` is true.

3. **Job drawer** — a sidebar listing all jobs with progress bars and actions
   (cancel, pause, dismiss). Redundant with the disposable task window: the
   user already sees live progress in the popup, and all control actions
   already exist there.

The result: hundreds of lines of dead code in the main-window path, a confusing
dual-progress experience (drawer + popup showing the same job), and a fragile
"jobOnly" freeze mechanism that replaced the entire workspace.

## Decision

Follow **7-Zip's architecture**:

| 7-Zip | ZManager |
|---|---|
| `7zFM.exe` — persistent file manager, never freezes | Main window — browse, create, extract launcher |
| `7zG.exe` — one per operation, auto-closes | Disposable task window — one per operation, auto-closes |
| No job drawer, no shared job history | No job drawer, no shared job history |
| Multiple concurrent operations via multiple 7zG instances | Multiple concurrent operations via multiple disposable windows |

The main window is **persistent and reusable**. It never resizes, centers, or
hides during jobs. Each compress or extract operation opens a disposable task
window that shows progress, handles pause/cancel, and auto-closes on
completion. The user can start multiple concurrent operations — each gets its
own window.

Quick actions from the OS shell (Finder "Extract Here", context menu "Add to
.zip") remain unchanged — they open disposable task windows as before.

### What is removed

- **"JobOnly" freeze mode** — `revealQuickActionJobWindow`,
  `closeFocusedJobProgress`, `sendQuickActionJobsToBackground`,
  `QuickActionProgress` React component, `quickActionWindowMode` state,
  `revealProgressWindow`/`minimizeProgressWindow` in the window controller.
- **Job drawer** — `JobsDrawer` React component, `renderJobs()` function,
  `openJobDrawer()`/`closeJobDrawer()`, `jobDrawerOpen` state, all
  `ZManagerJobsIntent` types.
- **Focused progress tracking** — `focusedQuickActionJobIds` in
  `jobsWorkspace`, `selectQuickActionJobCompletionDecision` in `jobs.ts`,
  `maybeCloseCompletedQuickActionWindow` in `jobControlController`.
- **`jobControlController`** — entirely removed; all functionality either
  lived in the drawer or is now inlined (password retry).
- **Progress clock timer** — `jobTimers.startProgressClock` removed; no
  drawer to refresh.

### What stays

- **`disposableTaskWindows`** and **`DisposableTaskRuntimeApp`** — the
  primary progress UI for all operations.
- **`disposableTaskLifecycle`** — process lifecycle for quick-action-only
  coordinator mode (process exits when all disposable windows close).
- **`jobsWorkspace`** — simplified to a minimal job state store: add, remove,
  hasActiveJob (for close-guard), and password retry support.
- **`appWindowEffects.close()`** — hide-vs-close logic using
  `jobsWorkspace.hasActiveJob()`.

## Consequences

- Main window is never resized, centered, or hidden during jobs. It stays
  fully functional — the user can browse another archive while a job runs.
- Multiple concurrent operations are natural: each gets a disposable window.
- No redundant progress displays: the disposable window IS the progress.
- ~2000 lines of dead code removed across ~10 files.
- Password retry is inlined in the runtime adapter instead of routed through
  `jobControlController`.
- `jobsWorkspace` loses ~12 methods and ~6 types, becoming a minimal store.
- `shellWorkspace` loses `quickActionWindowMode`, `QuickActionWindowMode`,
  and `jobDrawerOpen`.
- The React snapshot loses `jobs`, `quickActionProgress`, and
  `handleJobsIntent`.
- No job history in the main window — each operation is fire-and-forget from
  the main window's perspective. The disposable window is the sole
  interaction surface for an in-progress job.

## Verification

- `npm run test:frontend` passes with all removed code (97 files, 801 tests).
- `npx tsc --noEmit` passes with zero errors.
- On macOS: "Extract all" opens a disposable window. Main window stays
  visible and functional. Starting a second operation opens a second
  disposable window. Both auto-close on completion.
- Quick actions from Finder: behavior unchanged.
- Password-protected archives: prompt works, retry opens a new disposable
  window.
- Main window close with active jobs: window hides instead of closing.
- Linux (custom window chrome) and Windows: same behavior.
