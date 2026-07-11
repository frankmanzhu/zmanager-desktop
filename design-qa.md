# Design QA: Archive options hierarchy

- Source visual truth: `C:\Mac\Home\Documents\Screenshot 2026-07-11 at 12.43.00 pm.png` (the actual filename contains a narrow no-break space before `pm`)
- Expanded implementation: `C:\Users\frankzhu\Projects\zmanager-desktop\.codex-qa\options-advanced-polished-final.png`
- Collapsed implementation: `C:\Users\frankzhu\Projects\zmanager-desktop\.codex-qa\options-advanced-collapsed-final.png`
- Viewport: 1280 x 720
- State: Create workspace, TZAP selected, Advanced options tested collapsed and expanded.

## Findings

No actionable P0, P1, or P2 findings remain.

The source is a compact dark macOS options surface, while the implementation is a resizable light Windows/Linux workspace pane. Theme and surrounding shell differences are intentional. The interaction hierarchy now follows the requested desktop adaptation: format and level, always-visible source handling, then one collapsed Advanced card containing Password, Split size, Recovery, Volume loss tolerance, and Certificates in that order.

## Comparison history

- Earlier P1: Password and other optional controls were exposed before the source-handling checkboxes and outside a single Advanced disclosure. Fixed by moving Clean source, Respect `.gitignore`, Preserve metadata, Replace existing, and Follow symbolic links above a collapsed Advanced card. Post-fix evidence is the collapsed screenshot and the browser DOM sequence.
- Earlier P1: The Advanced interaction did not control the whole optional workflow. Fixed so clicking the single Advanced header reveals Password first and TZAP Certificates last. Post-fix evidence is the expanded screenshot and interaction test.
- Earlier P2: Mixed radii, nested legacy cards, label wrapping, and horizontal overflow made the pane look unfinished. Fixed with consistent rounded Tailwind surfaces, vertical basic fields, simplified password grouping, responsive certificate pickers, and explicit horizontal containment. Post-fix measurement: options pane `clientWidth` and `scrollWidth` both equal 279 px.

## Fidelity surfaces

- Typography: existing desktop font tokens retained; headings, labels, and helper copy use a clear small-control hierarchy without wrapped basic-field labels.
- Spacing and layout: consistent 12 px card radii, compact vertical rhythm, full-width fields, and no horizontal overflow at the tested viewport.
- Colors and tokens: existing neutral desktop surfaces and blue focus/selection treatment retained; no new raw CSS or one-off palette introduced.
- Image quality: no raster imagery exists in this options UI; existing icon-library glyphs remain crisp.
- Copy and content: labels match the existing product terminology and the requested Advanced sequence.

## Functional checks

- Tested switching archive format to TZAP.
- Tested collapsed and expanded Advanced states.
- Confirmed Password appears before Split size and TZAP Certificates appear last.
- Browser console errors: none.
- Focused region comparison was not separately required because the complete options pane is fully visible and readable in both full-view captures; DOM inspection additionally confirmed the exact control order.

final result: passed
