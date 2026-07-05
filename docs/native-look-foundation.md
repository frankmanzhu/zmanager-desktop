# Native Look Foundation

ZManager Desktop should read as a conservative Windows 11/File Explorer style utility, not a branded web app.

## Principles

- Start from `src/styles.css` native tokens before adding one-off colors, radii, shadows, or control states.
- Keep archive behavior in Rust and app state modules; UI polish should not reimplement archive logic in TypeScript.
- Prefer system-like bands and panes over floating cards: menu bar, command bar, address/search row, navigation pane, file table, details pane, and status bar.
- Use compact desktop sizing. Rows, menu items, toolbar buttons, and status text should feel scannable under repeated use.
- Keep selection, hover, focus, disabled, and pressed states explicit. A control is not complete until those states exist.
- Keep dialogs and context menus close to WinUI/File Explorer: subtle border, modest radius, native flyout shadow, compact item rows.

## CSS Contract

The top of `src/styles.css` defines the native foundation:

- `--native-window-bg`
- `--native-chrome-bg`
- `--native-layer-bg`
- `--native-control-*`
- `--native-selection-*`
- `--native-row-*`
- `--native-accent*`
- `--native-shadow-*`

New UI should map existing semantic app variables to these tokens, or consume these tokens directly for primitive controls. Avoid raw hex colors in component sections unless they represent file-type icon colors or status severity colors.

## Framework Decision

Do not introduce a UI framework just to get native feel. The current app is vanilla TypeScript and has a classic desktop utility structure already. If future work needs a component framework, prefer one that can consume these tokens rather than replace the visual foundation.
