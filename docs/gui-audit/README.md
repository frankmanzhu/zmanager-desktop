# GUI Audit Evidence

This directory contains browser-backed visual evidence for the shared React
manager and manual Tauri screenshots where native behavior matters.

The active automated audit is `e2e/gui-visual-scan.spec.ts`. It covers the
reusable Main Window at normal, compact, and minimum sizes, including create and
extract setup, archive browsing, tables, dialogs, context menus, drop overlays,
selection details, preferences, and native-icon fixtures. The suite also checks
for clipped labels, overlaps, horizontal overflow, out-of-bounds controls, and
oversized icons.

Run it with:

```sh
npm run test:e2e -- e2e/gui-visual-scan.spec.ts
```

The command refreshes the active numbered PNG files. Review generated image
changes before committing them because rendering differences can be
environmental.

Job-drawer screenshots are intentionally absent. The Main Window has no shared
job surface under ADR-0016. Every accepted create, extract, or test Job is
presented in an independent Disposable Task Window, whose behavior is covered
by task-window component/controller tests and desktop smoke testing.

Historical subdirectories and `manual-tauri-*.png` files remain evidence for
specific earlier investigations; they are not current architecture
specifications.
