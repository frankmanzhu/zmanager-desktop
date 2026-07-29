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

Concretely, `CPanel::AddToArchive()` calls `CompressFiles(..., waitFinish =
false)`, while Extract and Test launch `7zG` through the same non-waiting call
path. `Call7zGui()` waits for either early worker exit or the event confirming
that the worker consumed shared launch input; it does not generally wait for
archive work to complete. Progress dialogs own their worker thread, controls,
questions, terminal message, and closing. The File Manager has no global
worker-running workflow state and receives no completion transition that
unlocks it.

The analogy covers concurrency and state ownership. ZManager deliberately
resets submitted setup after accepted Job start even though 7-Zip's
`AddToArchive()` currently leaves its `KillSelection()` call commented out.

## Decision

Follow **7-Zip's architecture**:

| 7-Zip | ZManager |
|---|---|
| `7zFM.exe` — persistent file manager that launches work without waiting | Main Window — persistent browser and create/extract/test launcher |
| `7zG.exe` — separate GUI worker for an operation | Disposable Task Window — one window per accepted create/extract/test Job |
| No job drawer, no shared job history | No job drawer, no shared job history |
| Multiple concurrent operations via multiple 7zG instances | Multiple concurrent operations via multiple disposable windows |

The main window is **persistent and reusable**. It never resizes, centers, or
hides merely because a job is running. Each accepted create, extract, or test
operation opens a Disposable Task Window that shows progress and handles
available controls. Successful and cancelled tasks auto-close after brief
acknowledgement; failed tasks remain visible for diagnosis and recovery. The
user can start multiple concurrent operations, each with its own window.

ZManager keeps the same state simplicity even though its windows may share one
process:

- the Main Window owns browse/setup state and one short-lived
  `submissionInFlight` guard, not a global `jobRunning` mode;
- each Disposable Task Window mirrors one Rust Job and owns only its controls,
  close prompt, terminal acknowledgement, and recovery UI; and
- a quick-action-only coordinator owns only the pending-request, active-Job,
  and open-task-window counts required to decide when the hidden process exits.

Job completion never unlocks the Main Window because accepted Job start never
locks it. Active-Job accounting remains internal and is used only for
close/shutdown decisions.

### Job Handoff and manager reset

An accepted create, extract, or test request crosses one **Job Handoff** seam:

1. Rust validates the request, starts the Job, and returns its Job ID.
2. The frontend records active process work and opens the Job's Disposable Task
   Window; that task window subscribes directly to its bootstrap Job.
3. The Main Window clears the submitted operation's transient setup and becomes
   browse-ready for the next operation immediately.

Job Handoff is a one-way accepted-start action, not another Job lifecycle state
machine. It ends after recording active process work, presenting the task
window, resetting submitted state when applicable, and reporting any degraded
presentation. The task window subscribes directly to its bootstrap Job; later
progress and completion belong to the Job Registry and Disposable Task Window.

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
- **Global active-Job manager gating** — no `jobRunning` command state and no
  active-Job checks that block normal commands, drops, browsing, selection, or
  launching another independent operation.
- **Completion-driven manager orchestration** — no terminal Job callback resets
  or unlocks the Main Window.

### What stays

- **`disposableTaskWindows`** and **`DisposableTaskRuntimeApp`** — the
  primary progress UI for create, extract, and test operations.
- **`disposableTaskLifecycle`** — process lifecycle for quick-action-only
  coordinator mode, limited to the session flag and request/Job/window counts
  needed for shutdown.
- **Shell active-Job accounting** — bounded Job IDs/counts reconciled from the
  Rust catalog for coordinator shutdown and Main Window hide-vs-close behavior.
- **`appWindowEffects.close()`** — hide-vs-close logic using Shell accounting,
  without retaining per-Job presentation state in the Main Window.

## Consequences

- Main window is never resized, centered, or hidden during jobs. It stays
  fully functional and returns to a browse-ready launcher immediately after
  each accepted create/extract/test start.
- Multiple concurrent operations are natural: each gets a disposable window.
- No redundant progress displays: the disposable window IS the progress.
- The dead Main Window progress paths and their duplicate state are removed
  instead of retained behind compatibility wrappers.
- Recovery interaction and output actions stay with the one-Job Disposable Task
  Workflow. A retry accepted by Rust crosses normal Job Handoff and receives a
  new task window.
- The internal `jobsWorkspace` is removed; Shell accounting consumes only the
  Rust catalog information needed for close/shutdown decisions.
- `shellWorkspace` loses `quickActionWindowMode`, `QuickActionWindowMode`,
  and `jobDrawerOpen`.
- The React snapshot loses `jobs`, `quickActionProgress`, and
  `handleJobsIntent`.
- No job history in the main window — each operation is fire-and-forget from
  the main window's perspective. The disposable window is the sole
  interaction surface for an in-progress job.

## Implementation status

The simplified ownership model is implemented:

- Create and Extract reset submitted transient state exactly once after
  accepted Job Handoff while preserving preferences, histories, columns, and
  reusable archive browse context.
- Create, Extract, and Test share one Main Window awaiting-acceptance guard.
  Acceptance releases it immediately, so one accepted Job never gates the next
  operation.
- The Main Window has no per-Job subscription, progress store, global
  active-Job command/drop/selection gate, Jobs command, or Job drawer fixture.
- Shell process accounting retains only active Job IDs/counts and reconciles
  them from the authoritative catalog for hide/close and quick-action
  coordinator shutdown.
- Each Disposable Task Window subscribes directly to one Job, owns its
  controls, terminal UI, output actions, and password recovery, and hands an
  accepted retry back through Job Handoff for a new task window.
- Rust requires the exact `task-{jobId}` caller for per-Job subscription and
  controls in addition to the task-only Tauri capability boundary.
- Presentation and feed failures are surfaced without resubmitting accepted
  work, and catalog transitions reevaluate coordinator shutdown.
- Native quick actions execute only through the acknowledged Native Launch
  Inbox; completed event IDs are deduplicated before acknowledgement so
  in-process replay does not repeat a Job start. Startup state is
  disposition-only.
- Native Main Window close requests use the same active-Job/open-task
  accounting as application close commands instead of bypassing the
  coordinator.
- The obsolete `JobsWorkspace`, shared per-Job subscription set, legacy
  frontend `JobState`, Jobs command, and stale Job drawer end-to-end scenarios
  are deleted.
- Native source metadata and platform-dependent Job/error mapping are isolated
  under `src-tauri/src/platform`, restoring the production platform boundary.

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
- Command, drop, and selection tests must prove unrelated active Jobs do not
  block normal Main Window use.
- Window-manager tests must prove distinct Job IDs create distinct task windows
  and duplicate presentation of one Job ID focuses the existing window.
- Quick-action tests must prove disposable actions do not reveal the Main
  Window and a quick-action-only coordinator exits only after requests, Jobs,
  and task windows settle.
- Retry tests must prove an accepted replacement extraction Job receives its
  own Disposable Task Window without introducing shared progress state.
- Cross-platform smoke checks must prove the Main Window remains reusable while
  two create/extract task windows run and that the task completion policy is
  consistent on Windows, Linux, and macOS.
