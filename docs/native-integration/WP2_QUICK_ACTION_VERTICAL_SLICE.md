# WP2 Quick Action Vertical Slice

- Status: implementation complete; installed acceptance is recorded by WP7/WP8
- Date: 2026-07-23

## Reconciled result

`manifests/shell-actions.json` is the only semantic shell-action catalog. It
owns action identity, canonical labels, native verbs, context order,
applicability, multiplicity, surfaces, aliases, CLSIDs, and window disposition.
Generation now drives Rust and TypeScript policy, Swift Finder policy and
localization, the Windows COM mapping and NSIS registration, Linux desktop and
KDE actions, and the Nautilus action module.

The old Windows/Linux `ShellActionProfile` tables, frontend Finder-token command,
manual Finder action list, Windows COM action table, NSIS action rows, and Linux
file-manager action tables were deleted. The Nautilus diagnostic log now records
only action identity and path count.

Finder writes one versioned request and opens a path-free opaque callback.
The macOS Rust adapter consumes and validates that token before the Native
Launch Inbox accepts an inline request. The frontend cannot receive or consume
Finder tokens. Services enter the same Rust validation seam.

Finder transport construction, request writing, callback opening, cleanup,
consumption, validation, and inbox acceptance have explicit terminal outcomes.
When the App Group is unavailable the Finder extension creates no actionable
menu.

## Automated proof

- `node --test scripts/shell-action-artifact-parity.test.mjs`
- `npm run build`
- focused Vitest generated-contract, native-inbound, and dialog tests
- focused Rust Quick Action, Native Launch Inbox, and macOS ingress tests
- `swift test --package-path native/macos --filter ZManagerFinderExtensionSupportTests`
- `npm run test:architecture`
- `cargo test --manifest-path crates/zmanager-shell-contract/Cargo.toml`

Installed Explorer, Linux file-manager, Finder, and Services acceptance is
captured in the common evidence records introduced in WP7 and evaluated in WP8;
package state is not inferred from this source-level proof.
