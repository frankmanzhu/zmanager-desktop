# macOS replacement migration Phase 0 baseline

- Phase: 0 — freeze the baseline and collect evidence
- Evidence date: 2026-07-16 (Australia/Sydney)
- Gate status: **PASS with recorded baseline failures**
- Desktop Shell commit: `b6390446a23592300b4b75953200b18c257724c4`
- Last tagged native release: `v1.0.0`
- Last tagged native release commit: `88cc6820417ae8097981617daf0ab241482735c7`
- Current native reference commit: `850f4ffcc74b66d7502b08a6861664f30ca3da2b`
- Native reference working tree note: the `cli` submodule was already checked out at
  `ade42602e350dadd666b52319642c206d9df52b6` instead of the superproject's
  recorded `e2d4d40a5d3032b3e753e6bfb3601d812e736b58`; this pre-existing change was
  not modified.

This record freezes the evidence collected before implementation of the full
macOS target. The installed-system and replacement evidence is recorded in
[`phase-0-installed-evidence.md`](phase-0-installed-evidence.md).

## Baseline environment

- Host: macOS 26.5.2
- Architecture: `arm64`
- Filesystem: APFS
- Disposable test system: Parallels Desktop Apple Virtualization VM `macOS`
- Guest: macOS 26.5.2 (`25F84`), `arm64`, user `localadmin` (UID 501)
- Clean snapshot: `{37a9b547-fc89-4d8c-b4c1-4dc4fcfaef34}`
- Captured installed-upgrade snapshot:
  `{10bdef14-c713-4deb-8f31-60305536f3a1}`
- Swift test deployment target: `arm64e-apple-macos14.0`
- Available signing identity: Apple Development for Team ID `9PMA523YY4`
- Developer ID Application identity: not present in the local keychain

## Baseline commands and results

All commands below were run before any migration implementation changed this
repository.

| Command | Revision/source | Result |
|---|---|---|
| `npm run test:frontend` | Desktop Shell commit above | PASS — 80 files, 628 tests |
| `npm run test:architecture` | Desktop Shell commit above | PASS |
| `npm run build` | Desktop Shell commit above | PASS; Vite reported only the pre-existing large-chunk warning |
| `(cd src-tauri && cargo test)` | Desktop Shell commit above | PASS — 92 tests |
| `cargo test --manifest-path crates/zmanager-shell-contract/Cargo.toml` | Desktop Shell commit above | PASS — 2 tests, 0 doctests |
| `bash ../ZManager/scripts/build-ffi.sh && swift test --package-path ../ZManager/gui` | current native reference worktree | PASS — 121 tests |
| `bash scripts/build-ffi.sh && swift test --package-path gui` | clean detached `v1.0.0` worktree with its recorded submodule revision `aa5a44e5563354700b6f195f1d35b266085c25b3` | PASS — 57 tests |

The Desktop Shell package build itself was not run as part of the initial
baseline because `scripts/build-macos.sh --no-install` reruns tests and builds a
new application artifact. Phase 4 will require a packaged, ad-hoc-signed host
linkage proof before accepting the linkage model.

## Last native release identity

The `v1.0.0` tag and native packaging script define this release identity:

- Application bundle identifier: `com.frankmanzhu.zmanager`
- Shipped product version: `1.0.0` (Git tag `v1.0.0`)
- Build number: `1`
- Application bundle name: `ZManager.app`
- Minimum macOS version: 14.0
- Published GUI architecture: Apple Silicon only. The GitHub `v1.0.0` release
  contains one arm64 ZIP and one arm64 DMG; it contains no Intel GUI artifact.
- URL scheme: `zmanager`
- Exported UTType: `com.frankmanzhu.zmanager.tzap`
- Finder extension: `com.frankmanzhu.zmanager.finder-extension`
- Quick Look preview extension: `com.frankmanzhu.zmanager.quicklook-preview`
- The tagged release embeds Finder Sync and Quick Look preview extensions only.
- Quick Look thumbnail (`com.frankmanzhu.zmanager.quicklook-thumbnail`) and
  Spotlight importer (`com.frankmanzhu.zmanager.spotlight-importer`) declarations
  are later current-reference behavior, not artifacts embedded by `v1.0.0`.
- Finder App Group: none in the reference release
- Services selectors: `compressUsingZManager` and `extractUsingZManager`
- Service titles: “Compress using ZManager” and “Extract using ZManager”

At initial evidence collection, `/Applications/ZManager.app` was not the native
release. It was an ad-hoc-signed Desktop Shell build with bundle identifier
`com.frankmanzhu.zmanager.desktop`, product version `0.1.0`, arm64-only code,
and no embedded extension or importer. It therefore cannot serve as the
required old-product upgrade source.

After the initial baseline was frozen, the user installed the current native
reference build at `/Applications/ZManager.app`. A read-only inspection on
2026-07-16 found bundle identifier `com.frankmanzhu.zmanager`, product version
`1.0`, build `1`, a valid nested code signature, and embedded Finder Sync,
Quick Look preview, and Spotlight importer bundles. `pluginkit` reports the
Finder Sync and Quick Look identifiers. This strengthens package inventory
evidence but does not replace the clean per-user installed baseline because the
current account already contains native preferences and Application Support
state.

The published artifacts used for installed-system capture were downloaded from
the GitHub [`v1.0.0` release](https://github.com/frankmanzhu/zmanager-gui/releases/tag/v1.0.0):

- `ZManager.zip` — SHA-256
  `1f127c12b0285f18af05f205c14aeebb1bab4b88c15380b146f2e30d293e8198`
- `ZManager.dmg` — SHA-256
  `931372c3b0efc42adaf5f65921216c0331bfd7ac23ed03230196afb2f78e3aa0`

The published app passes `codesign --verify --deep --strict` and its executable
is arm64-only. For reproducibility comparison, an isolated artifact was also
built from a clean detached `v1.0.0` worktree. That rebuild is not byte-identical
to the published artifact and was not used for the installed-system capture:

- `ZManager.app`
- `ZManager.zip` — SHA-256
  `7647949bdbb06b04bdb8b30c399947d81d07ba959e892ac74e0492055b012046`
- `ZManager.dmg` — SHA-256
  `7d7278dabd6c4aaa496322cf2475fc60b4818132854f9d92270d04e5bbfda0ac`

## Native source inventory

Every first-party native implementation source present at the current reference
revision is listed here. Generated SwiftPM `.build` content is excluded.

| Source | Observable ownership to disposition in Phase 1 |
|---|---|
| `gui/Sources/ZManagerFinderExtension/ZManagerFinderSync.swift` | Finder menus, selection rules, action order, callback launch |
| `gui/Sources/ZManagerQuickLookPreview/TzapPreviewProvider.swift` | Quick Look preview and thumbnail rendering |
| `gui/Sources/ZManagerShared/ArchiveExtractionDestinations.swift` | quick-extraction destination and collision behavior evidence |
| `gui/Sources/ZManagerShared/ArchiveFileTypes.swift` | archive suffix and split-volume policy |
| `gui/Sources/ZManagerShared/FinderActionRequest.swift` | Finder callback request validation and encoding |
| `gui/Sources/ZManagerTracer/AppPreferences.swift` | native preference keys, defaults, compatibility reads |
| `gui/Sources/ZManagerTracer/ArchiveBrowserView.swift` | archive browse, extract, password retry, preview behavior evidence plus SwiftUI presentation to retire |
| `gui/Sources/ZManagerTracer/ArchiveJobViewModel.swift` | create/job behavior evidence plus SwiftUI workflow ownership to retire |
| `gui/Sources/ZManagerTracer/ContentView.swift` | SwiftUI product presentation to retire; acceptance evidence only |
| `gui/Sources/ZManagerTracer/CreateViewConfiguration.swift` | create-format configuration evidence |
| `gui/Sources/ZManagerTracer/DefaultOpenerArchiveTypes.swift` | default-opener archive grouping and type mapping |
| `gui/Sources/ZManagerTracer/DefaultOpenerManager.swift` | Launch Services status, set, restore, previous-handler persistence |
| `gui/Sources/ZManagerTracer/MonotonicProgress.swift` | progress normalization evidence |
| `gui/Sources/ZManagerTracer/PreferencesView.swift` | SwiftUI preferences presentation to retire |
| `gui/Sources/ZManagerTracer/PreviewTempCleanup.swift` | native preview-root cleanup policy |
| `gui/Sources/ZManagerTracer/QuickArchiveProgressWindow.swift` | system-icon evidence and SwiftUI progress presentation to retire |
| `gui/Sources/ZManagerTracer/TzapAccountView.swift` | SwiftUI account presentation to retire |
| `gui/Sources/ZManagerTracer/TzapAccountViewModel.swift` | account, contacts, verification, sharing, hosted callback behavior evidence |
| `gui/Sources/ZManagerTracer/TzapObligationBridge.swift` | account/obligation FFI behavior evidence |
| `gui/Sources/ZManagerTracer/ZManagerTracerApp.swift` | lifecycle, open URLs/documents, Services, activation, windows |
| `gui/Spotlight/ZManagerSpotlightImporter.m` | Spotlight public-metadata import |

Supporting native inputs that require an explicit disposition are:

- `gui/FinderExtension/Info.plist`
- `gui/FinderExtension/ZManagerFinderExtension.entitlements`
- `gui/QuickLook/ZManagerQuickLook.entitlements`
- `gui/Spotlight/schema.xml`
- `gui/Spotlight/en.lproj/schema.strings`
- `gui/Package.swift`
- `scripts/build-ffi.sh`
- `scripts/build-macos-tracer.sh`
- `scripts/generate-macos-icon.sh`
- `scripts/package-macos-app.sh`
- `scripts/release-smoke.sh`
- `scripts/run-macos-app.sh`
- `scripts/smoke-ffi-swift.sh`

General CLI benchmarks, fixture generation, repository synchronization, and
CLI-only staging/obligation scripts are not macOS GUI product sources. They
remain core/CLI evidence and must not be copied into the Desktop Shell.

## Native test inventory

| Test source | Behavior inventory |
|---|---|
| `gui/Tests/ZManagerFinderExtensionTests/FinderMenuBuilderTests.swift` | Finder menu visibility, order, names, selection multiplicity |
| `gui/Tests/ZManagerQuickLookPreviewTests/TzapPreviewProviderTests.swift` | public preview and thumbnail metadata rendering |
| `gui/Tests/ZManagerSharedTests/FinderActionRequestTests.swift` | callback scheme and request validation |
| `gui/Tests/ZManagerTracerTests/AppDelegateTests.swift` | lifecycle, Services, Finder callbacks, concurrent quick actions, windows |
| `gui/Tests/ZManagerTracerTests/AppPreferencesTests.swift` | preference compatibility and preview cleanup |
| `gui/Tests/ZManagerTracerTests/ArchiveBrowserViewModelTests.swift` | listing, extraction, retry, preview, selection, destination behavior |
| `gui/Tests/ZManagerTracerTests/ArchiveJobViewModelTests.swift` | create planning, formats, passwords, progress, clean source |
| `gui/Tests/ZManagerTracerTests/DefaultOpenerManagerTests.swift` | Launch Services status/set/restore and persistence |
| `gui/Tests/ZManagerTracerTests/TestSupport.swift` | native test adapters and isolated preference suites |
| `gui/Tests/ZManagerTracerTests/TzapAccountViewModelTests.swift` | account, certificate, contact, verification, sharing, hosted callback behavior |
| `gui/Tests/ZManagerTracerTests/TzapObligationBridgeTests.swift` | obligation bridge DTO and normalized-error behavior |

## Bundle, extension, and artifact inventory

The native packager owns these outputs:

1. `ZManager.app` application bundle.
2. `Contents/MacOS/ZManager` SwiftUI executable.
3. `Contents/Frameworks/libzmanager_ffi.dylib` shared general-purpose FFI.
4. `Contents/PlugIns/ZManagerFinderExtension.appex`.
5. `Contents/PlugIns/ZManagerQuickLookPreview.appex`.
6. Optional `Contents/PlugIns/ZManagerQuickLookThumbnail.appex`.
7. `Contents/Library/Spotlight/ZManagerSpotlight.mdimporter`.
8. ZIP release artifact.
9. DMG release artifact.

The script signs nested executable content before the application, optionally
notarizes the ZIP, staples the application and DMG, and registers installed
Finder, Quick Look, and Spotlight content. These behaviors are packaging
evidence; the hand-assembled second packager must be deleted only after the
unified Release Bundle passes its gates.

## Entitlement and extension-point inventory

- Finder Sync extension point: `com.apple.FinderSync`
- Quick Look preview extension point: `com.apple.quicklook.preview`
- Optional Quick Look thumbnail extension point:
  `com.apple.quicklook.thumbnail`
- Finder extension entitlements: app sandbox and user-selected read-only files
- Quick Look entitlements: app sandbox and user-selected read-only files
- Stable App Group: absent and therefore a required new identity decision
- Spotlight importer factory identifier:
  `C483C010-8E7F-458A-A792-48C5C6C194DA`

## Preference, storage, and cleanup inventory

Allowlisted non-secret native `UserDefaults` keys discovered in source:

- `defaultArchiveFormat`
- `defaultCleanSourceEnabled`
- `defaultCreateProfile` (legacy compatibility key)
- `defaultOutputLocation`
- `customOutputFolderPath`
- `quickOpenExtractionEnabled`
- `quickExtractionLocation`
- `quickExtractionFolderPath`
- `previewCleanupPolicy`
- `defaultOpenerSavedPreviousHandlers`

Native preview roots use the `zmanager-preview-` prefix in the user's temporary
directory. Account inventory is stored below the user's Application Support
directory under the native application's `ZManager` path; its contents may
include security-sensitive identity material and must only be inspected or
migrated through core-owned operations. This baseline records paths and key
names only, not values.

The current user has both a native preferences plist at
`~/Library/Preferences/com.frankmanzhu.zmanager.plist` and a
`~/Library/Application Support/ZManager` directory. They are migration inputs,
not a disposable upgrade test fixture, and were not changed.

## Known baseline failures and later release prerequisites

The controlled VM capture established these failures in the old and current
native packages. They are migration requirements, not Phase 0 blockers:

1. Both packaged applications reference
   `/opt/homebrew/opt/xz/lib/liblzma.5.dylib` and do not embed it. They terminate
   on a clean machine before UI startup.
2. The tagged app is named `ZManager.app`, while the current reference build is
   named `ZManager.app`. Installing the latter beside the former leaves two
   user-local bundles with the canonical identifier and makes `open -b` owner
   resolution ambiguous.
3. The published GUI release matrix is arm64-only. Supporting `x86_64` in the
   replacement is a new release decision and must be proved by the later build
   and installed-system matrices rather than inferred from the old release.
4. A Developer ID Application certificate and notarization credentials are not
   present on this development host. They are protected Phase 12/13 release
   prerequisites, not Phase 0 prerequisites.

## Phase 0 exit

**PASS.** The starting behavior, revisions, published release identity, source
and test inventories, automated test baseline, clean installed-system state,
non-secret preference continuity, extension registration, and replacement
behavior are reproducible and recorded. The capture scripts are
`scripts/capture-macos-native-baseline.sh` and
`scripts/run-macos-phase0-vm-guest.sh`; the operator runbook is
[`macos-phase-0-installed-capture.md`](macos-phase-0-installed-capture.md).
