# Phase 7 — Native host operations and adapter parity

- Completed: 2026-07-18
- Source revision: `2a897c408ce82bdf1d7b86a8a1b80967ea039f7b` plus the recorded working-tree migration
- Result: PASS with one installed-automation limitation recorded below

## Implemented ownership path

- Batched file and folder icons use the Swift host `NSWorkspace` operation and
  return typed PNG data URLs through the Rust command seam.
- Existing Tauri dialog, opener, and webview-drop adapters remain the single
  frontend interfaces after an option audit found no required semantic fork.
  Archive open is a single-file filtered panel; create/extract destinations use
  the existing save/folder contracts; cancellation remains a non-error result.
- Launch Services status, set, and restore use a typed Swift/Rust/desktop
  controller path. Rust owns an atomic, owner-only, versioned snapshot of the
  previous handlers and deletes it only after a clean restore.
- The standard application, File, Edit, Window, and Help menus are native. All
  product menu identifiers are allowlisted and delivered to the shared command
  router; AppKit does not own product workflow state.
- Services, open-document, URL, activation/reopen, main-window, and disposable
  task-window lifecycle remain on the Native Launch Inbox and shared window
  adapters. The affected product content remains React.
- The macOS app window reveal capability now includes every API used by
  persisted geometry restoration. A regression test prevents an ACL omission
  from leaving the installed app hidden again.

## Automated proof

- `swift test --package-path native/macos`: 11 passed, including real icon,
  Launch Services status, and Services pasteboard-to-request mapping.
- Default-handler controller tests: status, set, restore, immutable snapshots,
  and normalized errors passed.
- Native-menu adapter tests: allowlisted commands route once and unknown
  identifiers are ignored.
- Desktop drop and drop-intent suites cover files, directories, multiple paths,
  normalization, mixed-mode decisions, invalid/empty input, and cancellation.
- Tauri capability tests cover every registered product command and every
  persisted-geometry operation.

## Installed proof

Parallels macOS VM snapshot
`{6d9cc999-31a1-4801-8b16-50035986663e}` contains the ad-hoc-signed installed
`/Applications/ZManager.app`. The installed gate proved:

- canonical `com.frankmanzhu.zmanager` identity and macOS 14 minimum;
- strict deep signature verification and self-contained dynamic linkage;
- a visible 1280×900 React main window after a cold launch;
- native ZManager/File/Edit/Window/Help menus;
- installed host icon and Launch Services status operations; and
- installed Native Host, App Group, and deferred file-promise linkage.

The Parallels command transport has no working pasteboard server, so its
headless Services subcheck reports
`ZMANAGER_MACOS_INSTALLED_SERVICE_SELF_TEST_UNAVAILABLE`. The same production
Services interface passes the AppKit test with a real pasteboard. A normal
interactive installed Services invocation remains part of the Phase 13
installed-system acceptance record; it is not silently counted as automated.

## Deleted ownership

There is no parallel native product renderer, macOS eager icon fallback, menu
workflow switch, or macOS-specific dialog API. Unsupported Windows/Linux
Launch Services calls fail explicitly rather than reporting false success.
