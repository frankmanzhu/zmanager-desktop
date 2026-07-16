# ZManager Desktop Windows GUI Design Guide

> Status: Windows-specific visual guidance only. Its historical macOS exclusion
> is superseded by ADR-0004 and does not govern repository ownership.

Date: 2026-07-07

## Design Goal

ZManager Desktop should feel like a fast Windows file utility: compact, native, readable, and centered on archive rows. It should not feel like a web landing page, a settings dashboard, or a clone of the macOS app. The macOS app is useful as a workflow reference, but this shell should use Windows-native density and controls.

## Product Shape

- The center table is the primary work surface.
- The left pane is navigation only: folders, roots, and source grouping.
- The right pane is contextual: details for the selected archive/entry, or creation options while compressing.
- The top chrome is command access, not content.
- The bottom status bar is low-noise progress and selection feedback.

## Visual Rules

- Use Segoe UI and system-native control sizes.
- Keep radius at 4px for controls and 7-8px for popovers/dialogs.
- Use neutral Windows surfaces with blue only for selection, primary action, focus, and active mode.
- Avoid large decorative panels, hero sections, marketing copy, and ornamental backgrounds.
- Borders should separate regions quietly; the main table should carry the most visual weight.
- Empty states may be helpful, but they must not dominate once rows exist.

## Layout Rules

- Minimum supported audit viewport is 760x540.
- Preserve the five-region shell: menu, toolbar, optional path bar, body, status.
- Compress mode hides the path bar and uses the create panel above the file table.
- Extract mode shows the path/search bar and archive table.
- Navigation and details panes can collapse/reflow in compact viewports, but controls must remain reachable without horizontal page overflow.
- Resizers should be visible enough to discover, but not read as thick decorative bars.

## Table Rules

- Table headers are sticky, slightly stronger than body text, and must never clip at the audit widths.
- Rows use stable height and full-row selection.
- Selected rows need both background and a left accent edge so selection survives low-contrast monitors.
- File/folder icons stay at row scale; native icon images must never enlarge rows.
- Long paths and names truncate in-row; details panes can wrap full values.

## Command Rules

- Use icon buttons for common toolbar actions and labels only where they improve scanning.
- The active mode switch must be obvious without relying on color alone.
- Primary actions are reserved for `Create Archive`, `Extract Selected`, and similarly committing operations.
- Disabled controls should remain visible when they teach availability, but they must not look like fake functionality.
- Context menus should use plain verbs and keep destructive actions separated.

## Dialog Rules

- Dialogs should open directly to the decision the user needs to make.
- Put advanced archive settings behind disclosure unless they are required for the current operation.
- Footer actions align right, with the primary action closest to the dialog edge.
- Password fields must never persist values or appear in diagnostics.

## Audit Workflow

Use the existing Playwright visual scan before and after GUI work:

```powershell
npm.cmd run test:e2e -- e2e/gui-visual-scan.spec.ts
```

The scan refreshes `docs/gui-audit/*.png` and checks for clipped labels, overlapping controls, horizontal overflow, out-of-viewport controls, oversized icons, and terminal jobs with indeterminate progress.

For design review, inspect the screenshots as a set. The important states are:

- Compress empty and with sources.
- Create options, including advanced options.
- Extract empty and loaded archive.
- Entry context menus and column menus.
- Preferences, About, Jobs drawer, and job terminal states.
- Compact and minimum-size Windows viewports.

## Current Design Direction

The July 2026 pass makes these changes:

- Stronger Windows-neutral color tokens and clearer text contrast.
- More separation between navigation, table, and details panes.
- A cleaner Compress create strip that no longer reads like a boxed form.
- More intentional empty/drop states.
- Stronger sticky table headers and row selection.
- Dialog, job, and status surfaces tuned to the same visual system.

## Guardrails

- Do not reimplement archive behavior in TypeScript.
- Do not add macOS-only UI, Finder Sync, Quick Look, signing, notarization, or `.app` packaging code here.
- Keep the GUI compact and task-first.
- Update this guide when the visual language changes, and refresh `docs/gui-audit` screenshots with the e2e scan.
