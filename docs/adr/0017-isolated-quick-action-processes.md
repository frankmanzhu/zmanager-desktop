# ADR-0017: Isolate Quick Action processes from the normal singleton

- Status: Accepted
- Date: 2026-07-30

## Context

The application previously registered Tauri's single-instance plugin for every
launch. A selected-item shell action supplied a path to a one-shot versioned
request file. On a subsequent Quick Action, the newly launched process parsed
and deleted that file before the single-instance plugin forwarded its original
arguments to the existing process. The existing process then received only a
stale path, classified the request as invalid, and never delivered it to the
Native Launch Inbox.

Quick Actions are independently disposable executions. They do not need to
share the persistent Main Window process, and merging them introduces request
ownership, shutdown, and concurrency races.

## Decision

Startup classifies process ownership without reading or deleting a request
file:

- normal application launches and archive file associations use
  `NormalSingleton` and register the single-instance plugin;
- explicit `--quick-action`, `--action`, `--quick-action-request`, and
  `--shell-action-request` launches use `IsolatedQuickAction` and do not
  register the single-instance plugin; and
- macOS Finder Quick Actions request a new application instance and set the
  Quick Action startup marker.

An isolated Quick Action process owns its request, hidden coordinator webview,
Rust Job Registry entries, and Disposable Task Windows. The request is consumed
exactly once in that process and enters the frontend only through the Native
Launch Inbox.

Generated window disposition remains a separate decision. A
`disposableTask` action keeps the coordinator hidden and presents only its task
window. A `mainWindow` action may reveal the reusable manager in its isolated
process when user review is required.

Successful and cancelled Disposable Task Windows auto-close after brief
acknowledgement. Failed task windows remain visible for diagnosis and recovery.
When a hidden quick-action-only coordinator has no pending requests, active
Jobs, or open task windows, it force-destroys its webview. The Tauri process
then exits because no owned work or windows remain. Normal singleton Main
Windows never use this forced shutdown path and remain under user control.

## Consequences

- Sequential and concurrent Quick Actions cannot consume or redirect one
  another's request files.
- A running normal application does not absorb Quick Action execution.
- Quick Action Jobs remain process-local and independently disposable.
- A hidden coordinator cannot remain alive merely because a close request was
  intercepted or ignored.
- Failed work remains visible instead of disappearing during automatic cleanup.
- File associations continue to reuse the singleton Main Window.

## Verification

- Rust tests classify explicit Quick Action markers as isolated without reading
  request files and classify normal/file-association launches as singleton.
- Frontend adapter tests prove the idle coordinator uses forced window
  destruction, and capability tests require the corresponding Tauri permission.
- Existing Disposable Task Workflow tests prove successful/cancelled
  auto-close and failed-task retention.
- Shell-action parity tests require macOS Finder Quick Actions to request a new
  application instance and provide the Quick Action startup environment marker.
