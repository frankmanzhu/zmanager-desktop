# Phase 13 — Required macOS CI and release target

- Implementation date: 2026-07-18
- Result: **BLOCKED pending execution of protected and installed gates**

## Pull-request gate

The Package workflow now has required arm64 (`macos-15`) and x86_64
(`macos-15-intel`) jobs. Each runs frontend, architecture, Rust application,
shell-contract, metadata FFI, and Swift suites; builds a native ad-hoc app/ZIP/
DMG; emits a JSON inspection report; and runs the release-gate negative suite
and deterministic registration test. Artifacts and inspection reports upload
per architecture.

## Protected release gate

The Release workflow imports the Developer ID PKCS#12 into a temporary
keychain, imports host and Finder provisioning profiles, stores and validates
the App Store Connect notary API key, builds each native architecture, signs
inside-out, notarizes, staples, Gatekeeper-checks, emits checksums/reports, and
deletes credentials on success or failure. Publication depends on both macOS
jobs and recognizes only canonical architecture-labelled files.

## Installed-system publication gate

`docs/migration/macos-release-acceptance.json` records a complete required-check
matrix separately for arm64 and x86_64. The Release workflow binds both package
jobs to the record's exact version and build number, then requires the overall,
architecture, and per-check states to be `passed` before publication. The
publisher also rejects a missing architecture ZIP, DMG, inspection report,
checksum, or acceptance record. The completed record is uploaded and published
with the release. The current record is deliberately `blocked`; the validator
demonstrably rejects it with a nonzero exit.

## Exit decision

CI/release ownership is implemented and fail-closed. It has not executed with
production Apple credentials or on a native Intel installed-system environment,
so Phase 13 cannot be recorded as passing and publication remains blocked.
