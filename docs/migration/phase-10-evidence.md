# Phase 10 — Quick Look, thumbnail, and Spotlight

- Completed: 2026-07-18
- Source revision: `2a897c408ce82bdf1d7b86a8a1b80967ea039f7b` plus the recorded working-tree migration
- Result: PASS for implementation and installed-bundle proof; Developer ID/Gatekeeper acceptance remains a Phase 12–13 credential gate

## Bounded metadata implementation

`zmanager-public-metadata-ffi` is a separate static metadata boundary pinned to
the same exact `zmanager-core` revision as the application. Its C ABI accepts
only a local path and returns bounded, public JSON. It rejects null, non-UTF-8,
overlong, missing, non-regular, symlink, malformed, and oversized input before
or during public-header inspection. It has no account, key, password, job, or
mutation interface.

The Quick Look preview, Quick Look thumbnail, and Spotlight importer each link
that boundary directly. The build rejects an extension executable unless all
three allowlisted ABI symbols are present. It also rejects a preview executable
that lacks `providePreviewForFileRequest:completionHandler:`. That gate found
and corrected a real packaging defect: the provider subclass implemented the
method but did not explicitly declare `QLPreviewingController` conformance, so
the earlier packaged executable was only a provider stub.

Swift characterization tests cover encrypted multi-volume metadata, missing
volumes, verified, untrusted, and unsigned signature presentation, HTML
escaping, malformed JSON, and oversized/hostile responses. Rust tests cover
null and malformed files plus a sparse archive beyond the inspection limit.
The core-backed fixture generator creates plain, encrypted, and split-volume
TZAP files without adding archive semantics to Swift or Objective-C.

## Packaged and installed proof

The unified app contains arm64 Mach-O executables for both Quick Look
extensions and an arm64 Spotlight bundle. Their extension points, exact TZAP
UTI, macOS 14 minimum, sandbox entitlements, schema, localized display strings,
and nested signing order are generated and inspected by the build.

The corrected ad-hoc app was installed at `/Applications/Z-Manager.app` in the
Parallels macOS 26.5.2 arm64 VM. `pluginkit` resolved exactly the installed
thumbnail and preview bundle paths and version `1.1.0`; the installed preview
binary contains the required Objective-C selector and all three metadata ABI
symbols.

An installed-bundle Spotlight smoke harness loads the exact packaged
`.mdimporter` via CFPlugIn and calls its real `MDImporterInterfaceStruct`
callback. For a newly core-generated TZAP fixture it returned:

```json
{"com_frankmanzhu_zmanager_tzapEncryption":"none","com_frankmanzhu_zmanager_tzapSignatureStatus":"No public signature","com_frankmanzhu_zmanager_tzapVolumeCount":1,"kMDItemDescription":"TZAP archive","kMDItemKind":"TZAP archive","kMDItemSecurityMethod":"No public signature"}
```

A cache-reset `qlmanage` thumbnail run produced the current build's PNG before
the final VM restart. On the restarted VM, the console was at `loginwindow`, so
an Aqua-hosted repeat correctly remained pending instead of being counted as a
pass. Preview CLI validation on macOS 26.5.2 reaches Apple's
ExtensionFoundation host and terminates with its `key cannot be nil` exception
before provider invocation; the last installed native ZManager Quick Look
extension fails at the identical Apple stack frame. Provider conformance,
selector presence, metadata invocation, rendering characterization, exact
installed registration, and crash isolation are therefore the deterministic
proof used here. The clean-account interactive matrix remains mandatory in
Phase 13.

`mdimport` will not let a development/ad-hoc build participate as a trusted
system importer. The direct installed-bundle harness proves the importer code;
Gatekeeper registration is deliberately retained for the Developer ID,
notarized Release Bundle gate rather than being weakened locally.

## Identity correction

Signing inspection showed that the certificate common-name suffix
`N864W8975T` is not the Team Identifier. The designated Team Identifier is
`9PMA523YY4`. The frozen identity ledger, ADR, phase evidence, and validator now
agree with the signed app's `TeamIdentifier`; the migration-ledger validator
passes with 15 native capabilities and 44 replacement entries.

## Automated and recovery evidence

- `cargo test --manifest-path crates/zmanager-public-metadata-ffi/Cargo.toml`
  passed during the phase implementation.
- `swift test --package-path native/macos` passed the metadata support and
  native target suites during the phase implementation.
- `scripts/build-macos.sh --no-install` produced the corrected unified app.
- `scripts/run-macos-spotlight-importer-smoke.sh` passed against the packaged
  importer on the host and its compiled harness passed against the exact
  installed importer in the VM.
- `node scripts/validate-macos-migration-ledgers.mjs` passed after the Team
  Identifier correction.
- Parallels snapshot `{7fae728f-bac5-405e-98e8-1a2a6bba4de4}` preserves the
  corrected installed app and registered native targets.

