# macOS replacement migration Phase 4 evidence

- Phase: 4 — Swift host linkage and metadata-only FFI
- Completion date: 2026-07-16 (Australia/Sydney)
- Result: **PASS**

## Selected linkage

- Cargo builds `ZManagerMacOSHost` as a Swift static library and links it into
  the Tauri Rust executable. `nm` shows the three frozen host ABI exports in the
  packaged executable.
- Rust starts the host from Tauri setup, receives borrowed callback bytes on the
  AppKit main thread, and shuts the host down on `RunEvent::Exit`.
- `zmanager-public-metadata-ffi` builds as rlib/staticlib/cdylib for testing but
  extensions consume its static ABI. Its exported allowlist contains only ABI
  version, public summary, and paired free.
- Desktop and metadata FFI resolve exact core commit
  `ade42602e350dadd666b52319642c206d9df52b6`.
- ADR-0010 records the selected embedding/rpath/signing contract for transitive
  non-system `liblzma` and `liblz4` dependencies.

Memory, callback, cancellation, reentrancy, error, and shutdown ownership is
frozen in `macos-host-ffi-contract.md`.

## Automated proof

```text
swift test --package-path native/macos
  PASS — 5 tests
cargo test --manifest-path crates/zmanager-public-metadata-ffi/Cargo.toml
  PASS — 2 tests (null/malformed and oversized sparse fixtures)
cargo build --release --manifest-path crates/zmanager-public-metadata-ffi/Cargo.toml
  PASS
scripts/check-macos-core-revision-and-symbols.sh <metadata dylib>
  PASS — exact revision and 3-symbol allowlist
cargo test --manifest-path src-tauri/Cargo.toml platform::tests::active_platform_satisfies_the_complete_native_interface
  PASS — statically linked Swift host
scripts/build-macos.sh --skip-tests --no-install --bundle app
  PASS — self-contained ad-hoc-signed app
```

Swift tests prove single start, main-thread callback, duplicate-start rejection,
shutdown, App Group atomic write/0600/consume/delete/replay rejection,
invalid/oversized request rejection, and an `NSFilePromiseProvider` whose fake
Rust stream remains untouched until a destination is supplied.

## Installed package proof

The app was built, embedded, rewritten, signed inside-out, and copied to the
clean Parallels macOS 26.5.2 arm64 VM. It contains no `/opt/homebrew` or
`/usr/local` executable load command and passes deep strict signature checking.

- ZIP SHA-256:
  `523961af1e86b1ef5f9063a4684446be292f1c62a7c665d8b862b2d7a1d6b6d9`
- Runtime markers:
  `ZMANAGER_MACOS_HOST_CALLBACK_OK`,
  `ZMANAGER_MACOS_INSTALLED_LINKAGE_SELF_TEST_OK`, and
  `ZMANAGER_MACOS_HOST_SHUTDOWN_OK`
- Installed self-test: atomic App Group handoff and deferred file-promise stream
  both PASS inside the signed application process.
- Preserved VM snapshot:
  `{98484aab-398a-4820-bfee-a2f54e8e2c7c}`

The diagnostic self-test runs only when
`ZMANAGER_MACOS_LINKAGE_SELF_TEST=1`; normal product startup performs no fixture
I/O.

## Exit decision

**PASS.** The selected static host and static extension-ABI model works inside a
self-contained signed package on a clean machine. Its ABI, dynamic native-codec
embedding contract, symbols, revision pin, App Group transport, and deferred
file-promise behavior are frozen for production implementation.
