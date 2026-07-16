# macOS Native Host and Public Metadata FFI contract

## Host ABI

The host is a statically linked Swift library with three C-compatible exports:

- `zmanager_macos_host_start(callback, context) -> int32` installs exactly one
  process-lifetime callback and synchronously reports startup when already on
  the AppKit main thread; otherwise it dispatches to that thread.
- `zmanager_macos_host_is_running() -> bool` is diagnostic state only.
- `zmanager_macos_host_shutdown()` is idempotent and clears callback/context
  references before returning.

Callback bytes are borrowed only for the duration of the call. Rust must copy
or parse them before returning. Swift never frees or dereferences the opaque
context. Rust owns the context and may release it only after shutdown has
returned and no callback is executing. The current production bridge uses a
null context and static Rust state.

Return codes are `0` success, `1` missing callback, and `2` already running.
Callbacks are non-blocking, bounded, reentrancy-safe deliveries: they may enqueue
into Rust but must not call AppKit, Tauri, or Swift synchronously. Cancellation
belongs to the typed operation/session that originated an event. Shutdown stops
new delivery; late native callbacks fail closed. No C++/Swift error, allocation,
AppKit object, password, or secret-bearing buffer crosses the ABI.

## Public Metadata ABI

`zmanager-public-metadata-ffi` exports only ABI version, bounded public TZAP
summary JSON, and string free. Input is a borrowed NUL-terminated UTF-8 path.
Output is an owned allocation that must be released exactly once with the paired
free function. Null, non-UTF-8, overlong, non-file, over-limit, malformed, and
unreadable input returns bounded error JSON instead of panicking across FFI.

The ABI has no password, archive job, account, identity, key, mutation, network,
or general core entry point. Symbol allowlisting enforces this. Quick Look and
Spotlight must never persist returned data or use it to infer private archive
contents.

## Linkage and revisions

The app host and extensions link their Rust/Swift bridge statically. Native
codec libraries that remain dynamic must be embedded under
`Contents/Frameworks`, rewritten to `@rpath`, signed before their consumer, and
proved on a clean machine. Desktop and metadata manifests pin the identical
`zmanager-core` commit; `check-macos-core-revision-and-symbols.sh` enforces this.
