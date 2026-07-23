# WP1 Native Integration Contract Foundation

- Status: Complete
- Date: 2026-07-23
- Depends on: WP0

## Implemented contract

`manifests/native-capabilities.json` now owns 16 stable capabilities across
Windows, Linux, and macOS:

- selected-item and background shell actions;
- file associations;
- system file icons;
- default-handler control;
- native application menu;
- Main and Disposable Task Window policy;
- native file drag;
- Finder token transport;
- Native Host lifecycle;
- Replacement Migration;
- Quick Look;
- Spotlight;
- diagnostic logging; and
- installed-capability inspection.

Every capability declares platform applicability, source expectation, package
kinds, installed probe, installed-registration requirement, user-enabled state,
runtime-probe requirement, normalized failure categories, and source/package/
installed evidence identifiers. The structural schema is
`manifests/native-capabilities.schema.json`; semantic validation is enforced by
`scripts/lib/native-capability-contract.mjs`.

The generator emits:

- aligned TypeScript identifiers, package kinds, states, snapshots, and lookup
  helpers;
- aligned Rust identifiers and package kinds;
- the Rust-readable generated catalog; and
- a shared cross-language conformance fixture.

## Runtime behavior

`project_contract` now reports:

- the package kind explicitly (`development` unless a package build supplies
  `ZMANAGER_PACKAGE_KIND`);
- one structured snapshot for every capability; and
- a named `transitionalPlatformProfile` limited to the remaining window,
  association-display, and shell-action compatibility values.

Source support, package inclusion, installed registration, user-enabled state,
and runtime readiness remain separate. The normalized outcome is `available`,
`unavailable`, `failed`, or `notApplicable`. A running development build does
not infer installed shell registration or package inclusion from its operating
system.

The old flat selected-item, background-action, and file-association booleans
were deleted from `PlatformProfile`. Their temporary DTO projection is derived
from normalized capability availability, so source support alone cannot produce
an enabled result. Architecture validation prevents new production callers from
using the compatibility projection.

The frontend now uses capability state for integration diagnostics and
default-handler behavior. Its former macOS-name branch is deleted. Platform
names remain display-only diagnostics.

## Validation and proof

Automated proof includes:

- manifest validation for unknown, duplicate, and missing capabilities;
- exact per-platform applicability and layer declarations;
- incomplete source/package/installed evidence rejection;
- required-without-implementation rejection;
- explicit package-kind validation;
- fail-closed available-state validation for source, package membership,
  registration, user enablement, and runtime readiness;
- separate unavailable, failed, and not-applicable Rust outcomes;
- shared Rust/TypeScript fixture conformance; and
- frontend architecture rejection of operating-system-name behavior branches.

Verification run:

- `npm run build`;
- focused Vitest contract, startup, dialog, and document-adapter suites: 26
  tests passed;
- Node capability and WP0 baseline suites: 11 tests passed;
- Rust Native Integration Contract tests: 4 tests passed;
- Rust platform tests: 12 tests passed;
- native platform and Native Integration Contract architecture checks passed.

## Documentation alignment

ADR-0001 now defines complete platform conformance as complete capability
declaration plus capability-specific implementation, without requiring
identical operating-system behavior. `CONTEXT.md` and `docs/ARCHITECTURE.md`
document the five independent state layers, explicit package kind, normalized
availability, and the prohibition on frontend platform-name branching.

No package or installed state is claimed as proven by this Work Package. WP2
adds real shell-action observations; WP7 supplies package and installed
inspectors.
