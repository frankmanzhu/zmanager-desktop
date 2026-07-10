# Extraction flow proposal

## Current flow

1. The Extract workspace uses `Browse...` to open a different archive.
2. `Extract All` or `Extract Selected` opens an extraction dialog.
3. The user must choose an output folder before extraction can start.

This creates two ambiguities: `Browse...` does not say whether it browses for an
archive or a destination, and the destination is only introduced after the user
has already chosen an extraction command.

## Recommended flow

Keep the destination visible in the Extract workspace and let extraction
commands run immediately.

- Rename the toolbar command from `Browse...` to `Open Archive...`.
- Add an `Extract to` action bar above the archive contents:
  `Extract to [destination path / recent locations] [Choose folder] [Extract All] [Extract Selected (n)]`.
- Pre-fill a safe destination when an archive opens. For `photos.zip`, suggest a
  sibling folder named `photos` and show the complete resolved path.
- Make `Extract Selected (n)` visible only when entries are selected, or keep it
  disabled with the current selection count in its label.
- Start the job immediately when the destination is valid.
- Move path mode, overwrite policy, strip components, duplicated-root handling,
  and password entry behind an `Options...` command. Preserve the last
  non-sensitive settings; never persist passwords.
- If a collision or password requires input, interrupt only at that point with a
  focused prompt rather than showing the full settings dialog on every run.

## Resulting task flow

1. Open an archive.
2. Confirm or change the already-visible destination.
3. Click `Extract All` or `Extract Selected (n)`; extraction starts.

The default path is one click after opening the archive. Choosing a custom
destination remains two actions, but it is explicit and happens before the
extraction command rather than inside a second modal.

## Evidence

- `01-current-extraction-workspace.png`: the toolbar labels the archive-opening
  command `Browse...`, while no extraction destination is visible.
- `02-current-extract-dialog.png`: the destination and all advanced settings are
  introduced only after `Extract All` is clicked.

Screenshot evidence can show hierarchy and copy, but keyboard focus order,
screen-reader announcements, and native folder-picker behavior still require
interactive accessibility testing.
