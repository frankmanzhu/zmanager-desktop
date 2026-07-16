# macOS Phase 0 installed native baseline capture

This procedure reproduces the installed-system evidence required by Phase 0 of
`MACOS_FULL_TARGET_MIGRATION_EXECUTION_PLAN.md`. Run it in a disposable,
interactively logged-in macOS VM or user account. Do not run it in an account
that contains real ZManager preferences, identities, contacts, trust data, or
archives.

The harness deliberately installs the old native application under the
disposable user's `~/Applications` directory. It does not replace the current
system-wide application. It records preference key presence but never records
preference values.

## Prerequisites

1. Restore a clean macOS 14-or-newer arm64 VM snapshot, or create a new
   interactive standard macOS user.
2. Sign into that user's graphical session.
3. Download the published `v1.0.0` `Z-Manager.zip` from
   <https://github.com/frankmanzhu/zmanager-gui/releases/tag/v1.0.0> and verify
   SHA-256
   `1f127c12b0285f18af05f205c14aeebb1bab4b88c15380b146f2e30d293e8198`.
4. Make `scripts/capture-macos-native-baseline.sh` and
   `scripts/run-macos-phase0-vm-guest.sh` available to the guest. Copy artifacts
   through `/Users/Shared` when using Parallels; repository access is not
   required in the guest.
5. Confirm the account has no
   `~/Library/Preferences/com.frankmanzhu.zmanager.plist` and no
   `~/Library/Application Support/ZManager` directory. The harness refuses to
   prepare the baseline if either exists.

## Automated VM capture

Run the guest helper from an administrator-controlled VM channel such as
`prlctl exec`; it switches GUI operations into the logged-in console session:

```sh
run-macos-phase0-vm-guest.sh baseline
run-macos-phase0-vm-guest.sh upgrade ZManager-current-native.zip
```

The first command extracts and validates the official artifact, verifies nested
signatures, installs it below the disposable user's `~/Applications`, registers
Finder Sync and Quick Look, attempts a cold and warm launch, and captures the
result. The second installs the replacement candidate, verifies preference-key
continuity and nested signatures, attempts launch, and records canonical bundle
counts. Expected product crashes are recorded as known failures; they do not
make the evidence harness itself fail.

## Manual baseline observations

Record screenshots or logs for each observation. Do not include passwords,
private keys, account tokens, contact contents, archive contents, or preference
values.

1. Cold launch and initial Main Window presentation.
2. Close and Dock reopen behavior.
3. Warm activation while the application is already running.
4. Open a non-sensitive ZIP from Finder and record the association/Open With
   behavior.
5. Inspect Finder Sync menus for one file, multiple files, one archive, multiple
   archives, one folder, and a mixed selection.
6. Invoke both macOS Services entries with non-sensitive fixtures.
7. Run Quick Look on a non-sensitive TZAP fixture.
8. Change one non-secret creation default and one non-secret extraction default,
   relaunch, and confirm persistence.
9. Record default-opener status, set one disposable file type, restore it, and
   confirm the previous handler is preserved.
10. Record the number and identifiers of installed applications and extensions
    that claim the ZManager identity.

## Direct capture helper

Choose a new output path in the repository:

```sh
scripts/capture-macos-native-baseline.sh capture \
  docs/migration/phase-0-installed-evidence.md
```

Review the generated report, check every manual observation box, and add links
to the screenshots/logs. Copy the report and evidence into this repository if
the disposable account used another checkout.

## Preserve upgrade state

Do not run cleanup after capture. Preserve a post-upgrade VM snapshot until
Phase 11 implements Replacement Migration and Phase 13 runs the installed
upgrade matrix. For the 2026-07-16 capture, the clean snapshot is
`{37a9b547-fc89-4d8c-b4c1-4dc4fcfaef34}` and the post-upgrade evidence snapshot
is `{10bdef14-c713-4deb-8f31-60305536f3a1}`.

If the account must be discarded before Phase 11, capture the report now and
create a fresh equivalent account from `v1.0.0` when the replacement bundle is
ready. Never copy secret-bearing state into the repository.

## Cleanup after final acceptance

Only after the Phase 13 upgrade/rollback tests are complete:

```sh
scripts/capture-macos-native-baseline.sh cleanup
```

Cleanup unregisters the isolated application and extensions and removes only
the fixed user-local baseline application directory. Preferences and
Application Support evidence remain for explicit account deletion or a
separately reviewed migration cleanup.
