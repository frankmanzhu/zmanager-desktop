# Phase 12 — Unified packaging, signing, and release identity

- Implementation date: 2026-07-18
- Source revision: working tree based on `2a897c408ce82bdf1d7b86a8a1b80967ea039f7b`
- Result: **BLOCKED at the protected release exit gate**

## Unified pipeline

`scripts/build-macos.sh` is now the sole active macOS bundle pipeline in this
repository. It builds one explicit thin Rust/Swift target, embeds Finder Sync,
Quick Look preview/thumbnail, Spotlight, and the pinned metadata FFI, prepares
the complete app, signs inside-out, and only then creates architecture-labelled
ZIP and DMG artifacts. This fixes the previous ordering defect where Tauri
could create a DMG before native targets were embedded and signed.

Canonical manifests now generate the main application document types, exported
UTI, URL scheme, and Services declarations. The build synchronizes the package
version and positive build number across the host and every nested bundle. The
Rust build script selects a matching Swift triple so native Intel and Apple
silicon runners cannot accidentally link a host library for the wrong slice.
The same generator enforces complete, duplicate-free archive associations and
embeds English and Simplified Chinese Info.plist/Services localization files.

Protected builds require all of the following rather than silently falling
back to development signing:

- a `Developer ID Application` identity for Team `9PMA523YY4`;
- host and Finder Developer ID provisioning profiles authorizing the frozen
  `group.com.frankmanzhu.zmanager` App Group;
- a validated `notarytool` keychain profile; and
- hardened runtime, secure timestamps, notarization, stapling, and Gatekeeper
  acceptance for both the app and DMG.

The ZIP is recreated after stapling the app. The DMG is created from that same
stapled app, signed, notarized, and stapled. The gate compares the app signature
hash to the payload in both installable artifacts.

## Executable release gate

`scripts/release-gate-macos.sh` inspects exact identifiers, generated metadata,
versions, build numbers, minimum OS, the complete thin architecture allowlist,
unexpected Mach-O files, nested signatures, entitlements, provisioning
profiles, hardened runtime, timestamps, load paths, rpaths, metadata ABI
symbols, the packaged Quick Look selector, ZIP/DMG payload identity,
notarization, staples, and Gatekeeper. It emits a JSON inspection report.

`scripts/test-release-gate-macos.sh` proves the gate fails closed for every
required negative case: missing slice, identifier mismatch, version mismatch,
unsigned nested code, unexpected executable, invalid entitlement, bad rpath,
failed notarization, and missing staple.

Local registration is exact-path and deterministic through
`scripts/macos-register-bundle.sh`; it never resets the global Launch Services
or Spotlight databases. Its dry-run contract test proves the fixed app,
extension, and importer paths are present in both register and unregister
plans.

## Automated results

- arm64 app/ZIP/DMG build: PASS, version `1.1.0`, reviewed build `12002`.
- structural bundle inspection: PASS, 76 checks including ZIP and DMG payloads
  and an exact executable-file allowlist.
- negative release-gate suite: PASS, all nine required failure categories.
- deterministic register/unregister plan: PASS.
- workflow YAML parse and shell syntax: PASS.
- generated acceptance schema and fail-closed publication validator: PASS.
- protected gate against the ad-hoc bundle: expected FAIL with Developer ID,
  profile, notarization, staple, and Gatekeeper diagnostics.

The exact reviewed arm64 ZIP (SHA-256
`1d779b9af96372e08969fa6643e4b0bea47b771993f472364059e3a2acb4d818`)
was installed into `/Applications/Z-Manager.app` in the Parallels VM as build
`12002`. Installed linkage, Spotlight metadata, replacement migration, and the
on-screen application window passed. `pluginkit` resolves Finder and both Quick
Look extensions only from the installed bundle. The 1280×900 React window was
captured without clipping after the final Tailwind migration. `qlmanage` did
not emit a thumbnail file through the macOS 26 VM provider host, so registration
is recorded without presenting it as fresh rendering proof; Phase 10 retains
the cache-isolated provider evidence. Snapshot
`{244a484a-e4cc-4432-8f75-c58b9b87863d}` preserves reviewed build `12002`.

The local x86_64 cross-build reached the final linker and failed because this
Apple-silicon host has only arm64 Homebrew `liblz4` and `liblzma` slices. The CI
matrix therefore builds x86_64 on the native `macos-15-intel` runner and arm64
on `macos-15`; both jobs explicitly install their own architecture's codec
libraries. No universal or inferred slice is accepted.

## External blockers and exit decision

The development keychain contains only an Apple Development identity. It has no
Developer ID Application certificate, no host/Finder Developer ID provisioning
profiles, and no `ZManagerNotary` credentials. Consequently a genuinely
Developer-ID-signed, notarized, stapled Release Bundle cannot be fabricated or
claimed locally. The old independent packager remains frozen reference evidence
until that protected output and both installed architecture gates pass.

Phase 12 implementation is complete, but its exit condition remains **BLOCKED**
on protected Apple credentials and the native Intel release runner. This is a
hard publication failure, not an optional warning.
