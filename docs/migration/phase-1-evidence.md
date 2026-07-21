# macOS replacement migration Phase 1 evidence

- Phase: 1 — replacement parity ledger and identity decision
- Completion date: 2026-07-16 (Australia/Sydney)
- Desktop Shell starting commit: `b6390446a23592300b4b75953200b18c257724c4`
- Result: **PASS**

## Implemented contracts

- `macos-native-capability-parity.json` contains all 15 strategic
  Windows/Linux-to-macOS capability rows with owner, disposition, Interface,
  package, installed proof, status, and not-applicable decision fields.
- `macos-replacement-parity.json` contains 44 stable entries covering all 21
  native implementation sources, all 11 native characterization-test sources,
  and required product flows for account/authentication, hosted callbacks,
  certificates and recipient keys, contacts, verification, encrypted sharing,
  preferences, preview cleanup, default openers, lifecycle, Finder, Quick Look,
  Spotlight, and packaging.
- `scripts/validate-macos-migration-ledgers.mjs` rejects missing fields,
  duplicate identifiers, unknown status/disposition values, missing proof,
  unapproved retirement or native presentation, non-React application GUI, and
  SwiftUI product-screen migration to native targets.
- `package.json#/version` is the canonical version source. The first replacement
  version is `1.1.0`; npm, Cargo, Tauri, and the identity decision agree.
- `scripts/check-product-version-consistency.test.mjs` includes a deliberately
  mismatched Finder bundle fixture and proves the check fails closed.

## Frozen identity and distribution decisions

| Decision | Frozen value |
|---|---|
| Application bundle and installed name | `com.frankmanzhu.zmanager`; `ZManager.app` |
| Team | `9PMA523YY4` |
| App Group | `group.com.frankmanzhu.zmanager` |
| Finder / Quick Look preview / thumbnail / Spotlight | Released identifiers under `com.frankmanzhu.zmanager.*` |
| URL scheme / exported UTType | `zmanager`; `com.frankmanzhu.zmanager.tzap` |
| Minimum OS | macOS 14.0 |
| Initial architectures | Separate `arm64` and `x86_64` artifacts |
| Runtime posture | Unsandboxed main app, sandboxed extensions, hardened runtime |
| Distribution | Direct Developer ID, notarized and stapled |

The Team ID is verified from the valid local Apple Development signing
identity. A hardened-runtime test binary signed successfully with the frozen
App Group entitlement, and entitlement extraction reproduced the exact group.
The protected Developer ID release job must reverify the group and certificate
before publication; development signing is not treated as release signing.

## Clean-machine replacement identity proof

The Parallels VM was restored to clean snapshot
`{37a9b547-fc89-4d8c-b4c1-4dc4fcfaef34}`. The published `v1.0.0` application was
installed first. An identity-only `1.1.0` fixture was then installed at the
same `ZManager.app` path, registered with Launch Services, and inspected.

- Fixture SHA-256:
  `3c88198745a60011bb8d365677226a0cecf129507bba47da75c00c39deda2e1f`
- Bundle identifier/version: `com.frankmanzhu.zmanager` / `1.1.0`
- Canonical user-local application count after replacement: `1`
- Finder extension: `com.frankmanzhu.zmanager.finder-extension`
- Quick Look preview: `com.frankmanzhu.zmanager.quicklook-preview`
- Nested signature verification: PASS
- Duplicate canonical product: no
- Preference values emitted: no
- Preserved VM snapshot:
  `{600a5fbb-c9df-4058-93eb-7910e076ffb5}`

This is intentionally an identity fixture, not a release candidate or product
launch proof. It proves that preserving both the canonical identifier and the
released installed bundle name avoids the duplicate-product defect captured in
Phase 0. The scripts are `build-macos-phase1-identity-fixture.sh` and
`run-macos-phase1-identity-vm-guest.sh`.

## Automated proof

```text
node scripts/validate-macos-migration-ledgers.mjs
  PASS — 15 native capabilities, 44 replacement entries
node --test scripts/check-product-version-consistency.test.mjs
  PASS — 2 tests, including intentionally mismatched nested bundle
node scripts/check-product-version-consistency.mjs
  PASS — product version 1.1.0
cargo check --manifest-path src-tauri/Cargo.toml
  PASS
```

## Exit decision

**PASS.** Every old-product source, characterization test, and required product
flow has an explicit disposition. Identity, storage-sharing, callback, signing,
minimum-OS, architecture, sandbox, and version decisions needed by later phases
are frozen and executable checks enforce them.
