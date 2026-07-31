# ADR-0002: Use atomic, versioned shell-action requests

- Status: Accepted
- Date: 2026-07-11
- Extended by: ADR-0006 (Finder App Group transport uses opaque tokens rather
  than URL-encoded path payloads)
- Process ownership amended by: ADR-0017

## Context

Legacy Windows registry verbs substitute one selected path into `%1`. Explorer
may invoke the executable once per selected item, so the application previously
waited for a short burst and guessed which launches belonged to one selection.
That approach had no reliable batch boundary and could create multiple archives
when Explorer launches arrived outside the timing window.

Windows exposes the complete selection to `IExplorerCommand::Invoke` as one
`IShellItemArray`. Linux file managers can likewise launch one process with all
selected paths through their native extension or `%F` contracts. The desktop
application needs one platform-neutral boundary that preserves this atomicity.

## Decision

Shell integrations produce one versioned `ShellActionRequest` for one operating
system selection. Version 1 contains:

```json
{
  "version": 1,
  "action": "compressZip",
  "paths": ["C:/work/folder1", "C:/work/folder2"]
}
```

The shared Rust crate `crates/zmanager-shell-contract` owns serialization and
version validation. Shell integrations may write the request to a uniquely
created local file and launch the desktop executable once with
`--shell-action-request <path>`. The desktop consumes and removes the file,
then applies its normal validation and command routing.

Windows selected-item verbs use a thin `IExplorerCommand` COM DLL. The DLL only
decodes `IShellItemArray`, writes the request, and launches ZManager. It never
plans, creates, opens, or extracts archives. Folder-background verbs remain
single-path executable commands because the background itself is one target.

The desktop does not debounce or coalesce separate Quick Action launches.
ADR-0017 assigns every explicit Quick Action to an isolated process, which
consumes the atomic request directly and passes it to the frontend command seam
so persisted per-format defaults are applied before any job begins. The
single-instance boundary is reserved for normal and file-association launches.

Legacy `--quick-action` arguments and unversioned `--quick-action-request` files
remain accepted for compatibility, but new integrations use the versioned
contract.

## Consequences

- Multi-selection is atomic and independent of machine or Explorer timing.
- One fixed-format selection starts one archive job containing every selected
  source.
- General **Add to archive** requests add all selected paths to the singleton
  Create Workspace in one operation.
- Windows and Linux can share the serialized boundary without sharing native
  integration code.
- The Windows installer must ship an architecture-matched COM DLL and register
  its CLSIDs before registering selected-item verbs.
- Shell extension code is security-sensitive and must remain small, local-only,
  non-secret, and archive-semantic-free.

## Verification

- Contract tests round-trip all paths and reject unknown versions.
- Desktop command tests prove versioned files are consumed, deleted, validated,
  and routed normally.
- Windows extension tests construct a real `IShellItemArray` with two folders
  and prove both paths survive in order.
- A Rust regression proves one two-folder request remains one pending frontend
  intent, and a frontend controller regression proves that intent produces one
  create request with the selected format defaults.
- Windows package builds must include the DLL and register/unregister every COM
  class through the NSIS hook.
