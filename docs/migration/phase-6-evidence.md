# Phase 6 — Shared product workflow parity

- Completed: 2026-07-16
- Result: PASS with the accepted retirement in ADR 0011

## Shared workflows

The existing Archive, Create, Extract, Jobs, preferences, preview-cleanup,
quick-action, password-retry, disposable-task-window, certificate creation, and
TZAP verification modules were reconciled against the reference ViewModel
inventory. They remain shared TypeScript/Rust ownership paths with their
existing interface tests; no Swift archive behavior was copied.

The new deep Account slice consists of:

- core-backed Rust account commands and a managed non-secret hosted-auth state;
- immutable `AccountWorkspace` snapshots;
- an injected `AccountController`;
- generated/typed command DTO wrappers;
- Native Launch Inbox hosted-callback routing; and
- a React/shadcn/Tailwind Account surface.

Private recipient key bytes remain inside the core-owned file identity store.
Only public fingerprints and metadata cross the Tauri command seam.

## Retirement decision

ADR 0011 records why the reference hosted relay and its dependent network
obligations cannot be migrated safely from the pinned core protocol: the
reference lifecycle never supplies the required relay body outside the URL,
while its tests correctly reject secret-bearing callback URLs. Recreating that
path would violate a non-negotiable security rule. Those unreachable operations
are formally retired pending an opaque core relay-handle API.

## Automated proof

- Account Rust command tests: callback validation and secret-free inventory
- Account Workspace/controller/React tests: 5 passed
- Native callback controller tests: passed
- Tauri command contract tests: passed
- `npm run build`: passed
- `npm run test:architecture`: passed

The full frontend and Rust suites are part of the Phase 13/final release gate.
