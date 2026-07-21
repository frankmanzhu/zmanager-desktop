# Phase 14 cutover and retirement record

- Prepared: 2026-07-18
- First replacement version: `1.1.0`
- Rollback version: native `1.0.0`
- Replacement migration schema: `1`
- Status: **NOT AUTHORIZED**

Cutover is permitted only when both parity ledgers contain no planned or
in-progress entry, `macos-release-acceptance.json` passes for arm64 and x86_64,
and the protected Release Bundle checks pass. Until then the former Swift GUI
repository is frozen read-only migration evidence and rollback material; its
packaging/signing/publication path must not publish a competing product, but it
must not be deleted.

At authorization time, release operations must verify exactly one installed
`ZManager.app`, one `zmanager` URL owner, one archive association owner, and
one installed path for Finder, Quick Look preview, Quick Look thumbnail, and
Spotlight identifiers. Support follows `phase-11-rollback.md`: restore native
`1.0.0`, exact-path register it, restore preserved non-secret preferences and
handler mappings, and retain migration diagnostics without secrets.

Rollback assets remain available through the first replacement monitoring
window. Monitor migration-step failures, duplicate extension paths, callback
replay/exhaustion, App Group access failures, and default-handler restoration.
Deleting rollback assets requires an explicit follow-up decision after that
window; it is not part of the first replacement publication.

Current blockers are the missing Developer ID/provisioning/notary credentials,
native Intel installed acceptance, blocked release acceptance entries, and
remaining in-progress installed/protected parity rows. Therefore neither
product retirement nor deletion of the old packager has been performed.

## Final repository review and reviewed VM build

The application-owned legacy GUI inventory is now empty. `src/styles.css` was
deleted, the only stylesheet entry is Tailwind CSS 4, and all touched shell,
workspace, table, tree, details, dialog, preference, account, jobs, drop,
context-menu, and resize surfaces are React with Tailwind/shadcn ownership.
The architecture gate rejects any reintroduction of raw CSS, inline styles,
imperative rendering, manual element creation, or standalone document event
wiring outside the deliberately empty inventory.

The final code review found and fixed stale legacy selectors in archive row
selection/native drag, browser-drop acceptance targeting, drawer/overlay state,
modal Escape routing, compact overflow contracts, and the Playwright Tauri
stub's Native Launch Inbox handshake. The full frontend, architecture, build,
E2E, Rust, Swift, shell-contract, metadata-FFI, release-negative, registration,
workflow-YAML, generated-contract, and diff-hygiene checks pass.

Reviewed arm64 build `12002` passed the 76-check bundle gate and was installed
in the Parallels macOS 26.5.2 VM. Native Host linkage, stable replacement
migration hash `25e88efd421abfa47e894350cbb031916039f85804db6b9e41f24940bc6beeb5`,
exact Finder/Quick Look registration, installed Spotlight metadata, and the
on-screen 1280×900 UI passed. Snapshot
`{244a484a-e4cc-4432-8f75-c58b9b87863d}` preserves the reviewed state.

This completes every repository-owned migration and review action that can be
proved without protected release material. Cutover remains not authorized:
Developer ID/App Group profiles, notarization credentials, a native Intel
installed-system run, and authority to retire the old repository are external
requirements and have not been fabricated or marked complete.
