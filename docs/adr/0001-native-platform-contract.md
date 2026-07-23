# ADR-0001: Enforce a complete native platform contract

- Status: Accepted
- Date: 2026-07-11
- Extended by: ADR-0009 (first-class capabilities must report unavailable,
  never return an unconditional observable fallback while enabled)
- Refined: 2026-07-23 by the Native Integration Contract foundation

## Context

The Desktop Shell calls a small set of native operations for platform
registration, integration metadata, system file icons, and native file drag.
Windows and Linux previously exposed matching free functions through conditional
re-exports. Their matching shape was conventional rather than compiler-enforced,
and every non-Windows target was incorrectly routed to the Linux module.

Maintainers need to be able to move platform work between Windows and Linux and
immediately see the complete implementation checklist. A future supported target
must not compile until it implements the same native capabilities.

## Decision

`src-tauri::platform` owns compile-time selection of the supported
operating-system adapter. The Native Integration Contract catalog owns the
complete capability vocabulary. Each supported operating system declares every
catalog capability as `required`, `optional`, or `notApplicable`, plus its source
expectation, package expectation, installed probe, user-enabled layer, runtime
probe, normalized failures, and evidence identifiers.

Adapter completeness means every capability has an explicit, validated
declaration. It does not mean every operating system exposes identical
behavior. Capability-specific interfaces own behavior; the active platform
composition supplies their native implementations. `ActivePlatform` is selected
only with an explicit `target_os` condition, and shared callers never select an
operating system directly.

Runtime snapshots keep source support, package inclusion, installed
registration, user-enabled state, and runtime readiness separate. A temporary
`transitionalPlatformProfile` may project legacy window and presentation
settings while migration is active, but it is not a source of capability truth
and architecture checks prevent new production callers.

Targets without an adapter fail compilation with a descriptive error. An
individual native operation may still return its documented fallback result,
such as no system icon bitmap, but the operation itself must be implemented.

## Consequences

- Missing catalog declarations or required source expectations fail generation.
- Missing capability-specific adapter methods remain compiler errors where the
  behavior is required.
- Callers remain independent of platform selection and native implementation
  details.
- Windows, Linux, and macOS behavior stays local to their respective adapter modules.
- Supporting another operating system requires an explicit catalog column,
  module, adapter, and `ActivePlatform` selection; it can never silently use
  Linux behavior.
- The contract is static and does not support runtime platform switching, which
  matches Rust target compilation and Tauri packaging.

## Verification

- Generator tests reject unknown or duplicate capabilities, missing
  applicability, missing evidence, and a required capability without an
  implemented source expectation.
- Shared Rust and TypeScript fixtures prove aligned identifiers, package kinds,
  layer states, and normalized availability.
- Snapshot validation rejects an `available` capability without the required
  source, package membership, registration, user-enabled, or runtime-ready
  state.
- Architecture checks reject frontend operating-system branches used in place
  of capability state.
- `cargo test platform::tests` continues to prove the active target satisfies
  the remaining composition interface.
- `cargo test` on every supported operating system compiles that operating
  system's adapter through `ActivePlatform`.
- Host and VM builds compile each supported adapter; packaging remains explicit
  for the platforms that this repository ships.
