# WP0 Baseline And Characterization

- Status: Complete
- Characterized revision: `ed10f09`
- Reconciled implementation date: 2026-07-23
- Scope: behavior before Native Integration Contract ownership moves

## Installed Finder result

The installed application at `/Applications/ZManager.app` was version `1.1.0`
build `1`. Finder exposed the ZManager contextual submenu and PluginKit reported
exactly one enabled `com.frankmanzhu.zmanager.finder-extension`.

The first failing delivery stage is **App Group available**:

| Stage | Result | Secret-free evidence |
| --- | --- | --- |
| Menu action invoked | Passed | Finder displayed the generated action submenu and accepted the action |
| App Group available | Failed | `containermanagerd` rejected `group.com.frankmanzhu.zmanager` for the Finder extension because the installed signature cannot access the protected group container |
| Request written | Not reached | No request file was present after the rejected access |
| Callback URL accepted | Not reached | No request existed to deliver |
| Token received | Not reached | No callback was opened |
| Request consumed | Not reached | No callback was opened |
| Request validated | Not reached | No request reached Rust |
| Native Launch Inbox accepted | Not reached | No request reached Rust |
| Frontend acknowledged | Not reached | No inbox event existed |
| Quick Action execution started | Not reached | No acknowledged event existed |

The deterministic, path- and token-free probe is:

```bash
bash scripts/characterize-macos-finder-action.sh /Applications/ZManager.app 2h
```

The checked-in Native Host linkage self-test is not proof of installed App Group
access: it constructs `AppGroupRequestInbox` with a temporary directory. It
remains useful as synthetic FFI linkage proof only.

## Baseline fixtures

`fixtures/contracts/native-integration-baseline.json` freezes the pre-migration:

- flat Rust platform profiles;
- manually maintained Tauri file associations;
- React, macOS, and frontend native-menu command sets;
- Main, quick-action Main, and Disposable Task Window dimensions; and
- Windows, Linux, and macOS package artifact naming expectations.

`scripts/native-integration-baseline.test.mjs` compares that fixture with the
current ownership paths. Later Work Packages must replace each live comparison
with the corresponding generated-contract test before deleting an old owner;
the historical fixture itself remains evidence of the starting state.

## Architecture finding classification

| Finding | Classification | Resolution |
| --- | --- | --- |
| `native_drag_session.rs` lint-only `cfg_attr` | Guard false positive | Guard now strips lint-level `cfg_attr` only; fixture tests prevent broader exceptions |
| `main.rs` Apple URL-open routing | Architecture violation | Moved behind `NativePlatform::handle_run_event`; shared `main.rs` delegates unconditionally |
| `commands.rs` target-selected AppleArchive error arm | Architecture violation | Replaced with target-neutral display mapping after common semantic mappings |
| Installed Finder App Group rejection | Product regression | Localized here; WP2 owns the transport/readiness correction |
| Installed app signature invalid after launch | Product regression | Runtime diagnostics are written inside the signed bundle; WP7 owns release-layout correction |
| Swift Replacement Migration test using identical current/legacy path | Unrelated pre-existing test-fixture failure | Recorded; no production migration behavior changed in WP0 |

The architecture guard now has its own fixture suite covering lint-only
attributes, production `cfg`, behavioral `cfg_attr`, test-only selection, and
platform-owned selection.

## Verification snapshot

Passed locally on macOS:

- generated native contracts: 19 outputs current;
- focused frontend native inbound, Quick Action, shell packaging, menu, startup,
  and window suites: 77 tests;
- shell-contract crate: 4 tests;
- Rust platform tests: 12 tests;
- Rust Quick Action tests: 22 tests;
- Rust Native Launch Inbox tests: 9 tests;
- Swift Native Host/Finder suite: 24 of 25 tests;
- native-platform architecture guard fixtures and repository guard;
- installed Native Host linkage self-test.

Known gaps and pre-existing failures:

- Swift: one Replacement Migration fixture expects unregistering a path that is
  simultaneously the current application path.
- Windows shell-extension and installed Explorer proof require the Windows
  environment; source/build proof is not treated as installed proof.
- Linux installed Nautilus/KDE and DEB/RPM proof require supported Linux hosts;
  source/build proof is not treated as installed proof.
- `scripts/release-gate-macos.sh` fails strict signature verification after the
  installed runtime adds `Contents/MacOS/logs/zmanager-diagnostics.log`.

No selected path, opaque request token, password, request payload, or private
diagnostic value is recorded in this document or its probe output.
