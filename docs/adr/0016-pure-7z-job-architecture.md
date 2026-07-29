# ADR-0016: Adopt the 7-Zip manager/task workflow

- Status: Accepted
- Date: 2026-07-29

## Context

The app had three overlapping job-progress systems, but only one actually ran on
desktop:

1. **Disposable task windows** — separate OS windows, one per job, with
   self-contained progress UI and their own terminal completion policy. This is
   the system that actually runs on desktop for all focused jobs.

2. **Main window "jobOnly" freeze** — forcibly resizes/centers the main window
   and replaces the workspace with a focused progress view. Dead on desktop
   because `addJobState`'s `useDisposableWindow` flag is always true when
   `isDesktopRuntime()` is true.

3. **Job drawer** — a sidebar listing all jobs with progress bars and actions
   (cancel, pause, dismiss). Redundant with the disposable task window: the
   user already sees live progress in the popup, and all control actions
   already exist there.

The result was hundreds of lines of dead code in the main-window path, a
confusing dual-progress experience (drawer + popup showing the same job), and a
fragile "jobOnly" freeze mechanism that replaced the entire workspace.

The 7-Zip 26.01 sibling source provides the reference behavior. Its File
Manager (`7zFM.exe`) calls the GUI worker (`7zG.exe`) for Add and Extract
without waiting for the worker process to finish. ZManager adopts that
manager/task responsibility split while retaining its own Tauri-window and
Rust Job Registry implementation.

## Decision

Follow **7-Zip's architecture**:

| 7-Zip | ZManager |
|---|---|
| `7zFM.exe` — persistent file manager that launches work without waiting | Main Window — persistent browser and create/extract launcher |
| `7zG.exe` — separate GUI worker for an operation | Disposable Task Window — one window per accepted create/extract Job |
| No job drawer, no shared job history | No job drawer, no shared job history |
| Multiple concurrent operations via multiple 7zG instances | Multiple concurrent operations via multiple disposable windows |

The main window is **persistent and reusable**. It never resizes, centers, or
hides merely because a job is running. Each accepted compress or extract
operation opens a Disposable Task Window that shows progress and handles
pause/cancel. Successful and cancelled tasks auto-close after brief
acknowledgement; failed tasks remain visible for diagnosis and recovery. The
user can start multiple concurrent operations, each with its own window.

### Job Handoff and manager reset

An accepted create or extract request crosses one **Job Handoff** seam:

1. Rust validates the request, starts the Job, and returns its Job ID.
2. The frontend registers/subscribes to that Job and opens its Disposable Task
   Window.
3. The Main Window clears the submitted operation's transient setup and becomes
   browse-ready for the next operation immediately.

The reset is driven by accepted job start, never by job completion. It clears
one-shot sources or entry selections, operation-only form state, secrets,
validation messages, and submission flags. It preserves global defaults, path
histories, and reusable manager preferences. Browse context may remain where it
helps select the next operation, but the submitted selection is no longer armed.

If request validation or job start fails, the Main Window preserves non-secret
setup state for correction and retry. If task-window presentation fails after
Rust has accepted the Job, the Job remains authoritative and the app reports a
presentation/recovery error; it must not silently start the same request again.

Quick actions from the OS shell (Finder "Extract Here", context menu "Add to
.zip") go directly to a Disposable Task Window. A quick-action-only process
keeps the Main Window hidden. Main-window actions such as **Add to archive...**
prefill the reusable manager and use the same Job Handoff once the user starts
the operation.

This is a behavioral topology, not a process-topology requirement. ZManager may
host the Main Window and all Disposable Task Windows in one Tauri process; Rust
continues to own Jobs centrally through the Job Registry.

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
  primary progress UI for create and extract operations.
- **`disposableTaskLifecycle`** — process lifecycle for quick-action-only
  coordinator mode (process exits when all disposable windows close).
- **`jobsWorkspace`** — an internal, non-presentational store for retained Job
  snapshots, active-job close guards, retry metadata, and output actions.
- **`appWindowEffects.close()`** — hide-vs-close logic using
  `jobsWorkspace.hasActiveJob()`.

## Consequences

- Main window is never resized, centered, or hidden during jobs. It stays
  fully functional and returns to a browse-ready launcher immediately after
  each accepted create/extract start.
- Multiple concurrent operations are natural: each gets a disposable window.
- No redundant progress displays: the disposable window IS the progress.
- ~2000 lines of dead code removed across ~10 files.
- Password retry is inlined in the runtime adapter instead of routed through
  `jobControlController`.
- `jobsWorkspace` loses its Main Window presentation responsibilities and
  remains an internal lifecycle/retry store.
- `shellWorkspace` loses `quickActionWindowMode`, `QuickActionWindowMode`,
  and `jobDrawerOpen`.
- The React snapshot loses `jobs`, `quickActionProgress`, and
  `handleJobsIntent`.
- No job history in the main window — each operation is fire-and-forget from
  the main window's perspective. The disposable window is the sole
  interaction surface for an in-progress job.

## Implementation status

The independent Disposable Task Window topology, task-window terminal policy,
quick-action-only coordinator lifecycle, and removal of the Main Window
progress surfaces are implemented.

The explicit post-start Main Window reset described by Job Handoff is not yet
implemented consistently. The current create start path records the destination
and opens a task window but retains Create Workspace sources and plan state.
The current extract start path closes its dialog and opens a task window but
retains the submitted archive/selection state. This ADR defines the target for
the next implementation change; those retained launch states must not be
mistaken for the completed architecture.

Task-window creation failure is currently diagnostic-only after an accepted Job;
the recovery/error surface required by Job Handoff also remains to be
implemented.

## Verification

- Controller/interface tests must prove an accepted create start opens one task
  window, resets submitted Create Workspace state, and permits a second start
  without waiting for the first Job.
- Controller/interface tests must prove an accepted extract start opens one task
  window, clears submitted extraction state, and leaves the manager browse-ready.
- Start rejection tests must prove non-secret setup is preserved and no task
  window opens.
- Lifecycle tests must prove Job completion does not trigger or mutate the Main
  Window reset.
- Window-manager tests must prove distinct Job IDs create distinct task windows
  and duplicate presentation of one Job ID focuses the existing window.
- Quick-action tests must prove disposable actions do not reveal the Main
  Window and a quick-action-only coordinator exits only after requests, Jobs,
  and task windows settle.
- Cross-platform smoke checks must prove the Main Window remains reusable while
  two create/extract task windows run and that the task completion policy is
  consistent on Windows, Linux, and macOS.
