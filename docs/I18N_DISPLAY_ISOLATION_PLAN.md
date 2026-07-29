# Display Localization And Translation Isolation Plan

## Goal

ZManager Desktop should be able to replace the GUI language by changing a
locale preference and providing one translated message catalog per supported
language. The first implementation can remain English-only and should only
advertise complete locale choices in production UI, but English display text
should be extracted out of the UI so future translation work does not require
editing the main application flow.

The archive engine, Tauri command DTOs, job registry, and persisted preference
values must stay language-neutral. Translation belongs at the display boundary.

## Current State

- `src/main.ts` contains most static application markup and many hard-coded
  English labels.
- `src/app/*` contains display-owned metadata that also reaches the GUI,
  including command/menu labels, archive table headers, archive entry kind
  labels, icon labels, and display constants from `src/app/constants.ts` such
  as mode labels, browse statuses, empty states, table titles, and password
  prompts. These modules must keep ids, command codes, layout numbers, DTO
  values, and other machine constants stable while routing user-visible copy
  through the catalog.
- `src/ui/*View.ts` helpers contain additional user-visible status text.
- `src/app/preferences.ts` persists UI settings but does not currently include a
  language or locale preference.
- `src/app/formatting.ts` already has locale-aware date formatting hooks, but
  active locale selection is not wired through the app.
- The Preferences dialog has a disabled Language selector.

## Architectural Rule

Keep stable internal values in code and translate only when rendering.

Examples of values that should not be translated:

- preference enum values such as `askEveryTime`, `extractHere`, and
  `extractToFolder`
- archive format ids such as `zip`, `tarZst`, `tzap`, and `sevenZ`
- Tauri command names and DTO fields
- job ids, error codes, and machine-readable status values

Examples of values that should be translated:

- button labels
- dialog titles and descriptions
- option labels
- table headers
- status messages
- recovery hints and normalized frontend error messages

## Proposed Module Layout

```text
src/app/i18n/
  locale.ts
  messages.en.ts
  translator.ts
  translator.test.ts
```

Phase 2 should add Simplified Chinese as the first architecture-proving locale,
then future languages can add sibling catalog files the same way:

```text
src/app/i18n/messages.ja.ts
src/app/i18n/messages.de.ts
```

The desired end state is that adding a complete GUI translation usually means:

1. Copy `messages.en.ts` to `messages.<locale>.ts`.
2. Translate the string values.
3. Add the locale metadata to `locale.ts`.
4. Run key coverage tests.

No archive behavior, command DTO, or view-flow code should need to change for a
complete translation.

## Message Catalog Shape

Use semantic keys rather than English text as keys.

```ts
export const enMessages = {
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.save": "Save",
  "preferences.title": "Options",
  "preferences.language.title": "Language",
  "preferences.language.systemDefault": "System default",
  "preferences.language.english": "English",
  "preferences.extraction.askEveryTime": "Ask every time",
  "preferences.extraction.extractHere": "Extract here",
  "preferences.extraction.extractToFolder": "Extract to folder",
} as const;
```

The translator API should support simple lookup first:

```ts
t("preferences.title")
```

Then add interpolation and plural handling before migrating job and archive
summary messages:

```ts
t("jobs.completedEntries", { count: 3 })
```

Do not use English source strings as lookup keys. They make refactors brittle
and can hide missing translations.

## Locale Preference

Keep the stored preference separate from the resolved runtime locale. The
initial implementation should only support `System default` and English:

```ts
export type SupportedLocale = "en";
export type LocalePreference = "system" | SupportedLocale;

locale: LocalePreference;
```

Persist it with a dedicated key:

```ts
zmanager.locale
```

Add the key through `src/app/preferenceStorage.ts` by extending both
`PreferenceStorageKey` and `PREFERENCE_KEYS`. The preference module currently
uses `PREFERENCE_KEYS satisfies Record<PreferenceStorageKey, string>`, so adding
ad hoc string literals in `preferences.ts` would bypass the existing typed
storage contract and make future preference audits harder.

When the first non-English catalog is complete, extend `SupportedLocale` and
the locale metadata at the same time:

```ts
export type SupportedLocale = "en" | "zh-CN";
```

Resolution rules:

1. Load the stored preference only if it is `"system"` or a supported locale;
   invalid stored values fall back to `"system"`.
2. If the preference is `"system"`, choose the best supported match from
   `navigator.languages`.
3. If the selected locale is supported, use it.
4. If no match is supported, fall back to English.

Normalize browser language tags before matching. Prefer exact matches first,
then explicit aliases from `locale.ts` such as mapping `en-US` and `en-AU` to
`en`. Do not silently expose or persist a locale such as `zh-CN` until its
catalog is complete and included in `SupportedLocale`.

Experimental or test-only catalogs should not be accepted by production
preference validation. If a phase needs to exercise a future locale before it
is user-ready, use direct translator tests, an injected test locale list, or a
dev-only fixture instead of adding that locale to the production
`SupportedLocale` union.

The stored value should remain `"system"` when the user chooses System default,
even if the resolved runtime locale is currently English.

## Rendering Strategy

Use two rendering patterns.

For static markup owned by `src/main.ts`, add message keys to the DOM. Use
text keys only on elements whose visible text is fully owned by the translator:

```html
<h3 data-i18n-text="preferences.language.title"></h3>
<button data-i18n-text="common.save" type="button"></button>
```

Then apply translations at startup and after locale changes:

```ts
applyTranslations(document.body, i18n);
```

Changing the locale must also refresh stateful dynamic surfaces. The save flow
should persist the stored preference, resolve the runtime locale, rebuild the
translator and formatting context, set `document.documentElement.lang` to the
resolved locale, apply static DOM translations, then rerender active dynamic
views such as the archive browser, table headers and cells, detail panes, job
drawer, focused quick-progress view, status bars, dialogs, and Preferences.
Static `data-i18n-*` updates alone are not enough because many visible strings
and formatted values are produced by render functions after startup.

Startup must use the same locale initialization path before the first user
interaction. Load the stored locale preference with the other app preferences,
resolve the runtime locale, build the translator and formatting context, set
`document.documentElement.lang`, apply static translations, and render the
initial dynamic UI from that context. Save-time switching and restart/startup
loading should not be separate translation systems.

Keep text direction as explicit locale metadata when an RTL locale is added.
English and zh-CN can keep the current left-to-right direction, but future RTL
support should update `document.documentElement.dir` through the same locale
application path.

Do not put a text-content translation attribute on icon buttons or elements
with important child markup, because setting `textContent` would remove the
icon. For non-text surfaces, translate specific attributes:

```html
<button
  data-i18n-aria-label="commands.openArchive"
  data-i18n-title="commands.openArchive.tooltip"
  type="button"
></button>
<input data-i18n-placeholder="search.placeholder" type="search" />
<option value="system" data-i18n-text="preferences.language.systemDefault"></option>
<option value="en" data-i18n-text="preferences.language.english"></option>
```

For mixed-content labels that contain form controls, put the translation key on
a dedicated text child instead of the label itself:

```html
<label class="toggle-line">
  <input id="pref-create-clean-source" type="checkbox" />
  <span data-i18n-text="preferences.create.cleanSource"></span>
</label>
```

`applyTranslations` should update `data-i18n-text`, `data-i18n-aria-label`,
`data-i18n-title`, and `data-i18n-placeholder`. Add more explicit attributes as
needed instead of translating every attribute generically.

For dynamic view helpers, pass the translator explicitly:

```ts
buildPreferencesSnapshot(preferences, displayContext);
buildDisposableTaskSnapshot(job, displayContext);
```

Avoid importing global translation state inside low-level helpers. Passing an
`i18n` object keeps tests simple and makes display dependencies visible.

Treat translator output as plain text. Helpers that build HTML strings, such as
`renderJobsListHtml`, must escape translated strings and interpolated values
before inserting them into markup, or switch to DOM construction. Interpolation
parameters can include untrusted file names, archive paths, backend messages,
and job ids, so the translator must not become an HTML templating layer.

The Preferences view model must include the language selector as a normal
preference control with stable option values, not labels. Add the element to
`PreferencesViewElements`, give the static DOM select a real id, and make
`renderPreferencesDialog` set its stored value (`"system"` or `"en"` in phase
1). `collectPreferencesFromDialog` should save that stored value. Locale
resolution happens after saving and should not overwrite `"system"` with the
current resolved locale.

## Formatting Strategy

Text translation and data formatting should share the same resolved locale.

- Dates: use `Intl.DateTimeFormat(resolvedLocale, ...)`.
- Counts and percentages: use `Intl.NumberFormat(resolvedLocale, ...)`.
- Byte units can remain binary units, but numeric formatting should follow the
  active locale.
- Durations and byte-rate labels should come from the formatting/display
  context rather than hard-coded suffixes such as `m`, `s`, or `/s`.
- Empty placeholders such as `-` should come from the display layer so future
  locales can change them if needed.
- Sorting and filtering must continue to use raw values, timestamps, and stable
  ids, not localized display strings.

`src/app/formatting.ts` should accept a resolved locale or a small formatting
context instead of relying on browser defaults.

Display-producing helpers in `src/app`, including `formatArchiveTableValue`,
archive table column metadata, command/menu metadata, and archive entry icon or
kind labels, should either receive the same translator/formatting context or
expose stable ids that the rendering boundary maps to localized text. Do not
sort or filter by these localized labels.

Command shortcuts and accelerator tokens remain stable command metadata, not
translated message text. Localized command tooltips should be composed from
localized labels plus stable shortcut metadata instead of storing strings such
as `Open archive (Ctrl+O)` wholesale in the catalog. `aria-keyshortcuts` values
must continue to come from the stable shortcut metadata.

Archive table rendering and sorting need separate APIs. A localized cell
formatter can receive `i18n`, but `compareArchiveRows` must not call a localized
display formatter. Keep a raw sort-value helper for stable comparisons and a
separate localized display formatter for rendered cells, with tests proving row
sort order does not change when the locale changes.

## OS And Font Boundary

Bundle localization catalogs with the app, but do not bundle a dedicated CJK
font in the initial implementation. Use the existing system UI font stack and
trust modern Windows and mainstream Linux distributions to provide Chinese font
fallback.

App-owned GUI text, menus, dialogs, table headers, tooltips, and status messages
should come from the message catalogs. OS-owned surfaces such as native file
picker chrome, permission prompts, window chrome, and system dialog buttons
remain controlled by the operating system language and should not block in-app
localization. App-supplied native dialog titles, file type filter labels, and
default-name helper text are still app-owned display strings and should be
catalog-backed or built from localized display metadata.

Explorer, Nautilus, and other shell integration labels are platform packaging
surfaces. They can be localized separately if needed, but they should not be
part of the first in-app catalog migration unless the installer or desktop
integration already has a clean platform-specific localization hook.

Only revisit bundled fonts if QA on supported target systems finds missing CJK
glyphs, poor fallback, or unreadable rendering. If that happens, evaluate font
licensing, installer size, and rendering differences before adding a bundled
font.

## Error And Job Message Strategy

Rust and Tauri should prefer structured, language-neutral responses:

```ts
{
  code: "password_required",
  severity: "recoverable",
  details: { archivePath }
}
```

The frontend should map those codes to message keys:

```ts
t("errors.passwordRequired")
```

If a backend error currently includes an English message, preserve it as a
developer diagnostic where needed, but do not make it the primary localized GUI
message.

During migration, unknown backend messages may be shown as sanitized fallback
text only when there is no known code mapping. Known command errors and job
events should be displayed from frontend message keys. Job status display must
map both `eventType` and `code`; falling back to raw `eventType` values such as
`completed` or `failed` is an implementation fallback, not the localized UI
contract.

Passwords must never be included in translated messages, diagnostics, persisted
state, or interpolation parameters.

## Migration Phases

### Phase 1: English Catalog Foundation

- Add `src/app/i18n/*`.
- Add locale preference loading/saving with `"system"` as the default and
  reject unsupported stored locale values.
- Enable the Language selector with `System default` and `English`.
- Add fallback behavior and key coverage tests, including the English language
  option key.
- Add `data-i18n-*` application tests that prove icon button markup is
  preserved while labels, placeholders, titles, and aria labels translate.
- Keep the visible app English-only.

### Phase 2: Add zh-CN Architecture Slice

- Add `messages.zh-CN.ts` for the phase 1 catalog keys as an experimental
  catalog fixture, but do not add `zh-CN` to the production `SupportedLocale`
  union or preference validation yet.
- Keep `Simplified Chinese` out of the production Language selector until every
  user-visible surface included in the current release has a complete zh-CN
  catalog entry. A hidden test fixture, dev-only flag, or direct unit test can
  exercise zh-CN before it is advertised to users.
- Add catalog parity tests for `en` and `zh-CN`; from this point forward, every
  migrated key must exist in both catalogs before it is considered complete.
- Verify the locale resolver with an injected test supported-locale list that
  includes `zh-CN`, regional Chinese browser language values, unsupported
  languages, and English fallback.
- Run a focused Preferences dialog smoke check in both English and zh-CN to
  prove runtime switching, fallback behavior, and layout resilience through an
  injected test or dev-only locale registry. The production Preferences selector
  must still offer only `System default` and `English` in this phase.
- Confirm zh-CN renders with the system font stack on supported Windows and
  Linux targets; do not add bundled fonts unless QA finds a real fallback
  problem.
- Keep untranslated application surfaces in English until their text is
  migrated in later phases.

### Phase 3: Extract Static Shell Text

- Move static labels from `src/main.ts` into `messages.en.ts`.
- Add matching `messages.zh-CN.ts` translations for every extracted key in the
  same change.
- Use explicit `data-i18n-*` attributes for static DOM text and translated
  element attributes.
- Include buttons, tabs, toolbar labels, dialog titles, dialog actions, and
  Preferences labels.
- Preserve existing user-facing copy unless the change intentionally renames a
  surface. For example, the current Preferences dialog title is `Options` and
  the command label is `Options...`; catalog keys should not silently change
  those labels during extraction.

### Phase 4: Extract View Helper Text

- Update `src/ui/preferencesView.ts`, `src/ui/jobsView.ts`, and other rendering
  helpers to receive an `i18n` object.
- Replace status strings, empty states, and option labels with message keys.
- Move display-owned `src/app` labels, such as command/menu labels, archive
  table headers, archive entry kind labels, icon labels, and display constants
  from `src/app/constants.ts`, behind catalog lookups or stable ids mapped by
  the rendering layer. Leave command codes, error codes, layout dimensions, and
  other machine constants unchanged.
- Add unit tests for rendered English and zh-CN output through the translator.

### Phase 5: Extract Dynamic Workflow Messages

- Move archive open/create/extract/test status messages into the catalog.
- Translate normalized frontend error messages from error codes.
- Add interpolation support for file names, counts, byte values, and job
  summaries.
- Add catalog validation for interpolation and plural placeholders so translated
  messages keep the same required placeholder names and plural variables as the
  English source.
- Add escaping tests for translated/interpolated text rendered through
  `innerHTML`-based helpers so file names, archive paths, job ids, and backend
  fallback messages cannot inject markup.
- Run visual smoke checks for text overflow in Preferences, Jobs, dialogs, and
  archive table headers in both English and zh-CN.
- Enable `Simplified Chinese` in the production Language selector only after
  the release's user-visible migrated surfaces have complete zh-CN coverage.

## Testing Requirements

- `translator.test.ts` verifies lookup, fallback, interpolation, and missing-key
  behavior.
- Preference tests verify locale load/save and invalid-locale fallback.
- Preference storage tests verify `zmanager.locale` is declared through
  `PREFERENCE_KEYS` and not read or written as an untracked literal key.
- Locale resolution tests verify exact matches, alias matches, and English
  fallback from representative `navigator.languages` values.
- Catalog parity tests verify every production supported locale and every
  checked-in experimental catalog has the same keys as English.
- Catalog shape tests verify translated messages preserve required interpolation
  placeholders and plural variables from the English message.
- Locale-switch tests verify saving a new locale rerenders static DOM text,
  dynamic table headers and cells, details, jobs, status bars, quick progress,
  and Preferences without restarting, and updates
  `document.documentElement.lang` to the resolved locale.
- Startup locale tests verify a stored locale preference is loaded before first
  render, updates `document.documentElement.lang`, and drives initial static and
  dynamic UI without requiring a save action in the current session.
- Archive table tests verify sorting uses raw values and remains unchanged
  across locale switches, even when rendered cell labels are localized.
- Native dialog option-builder tests verify app-supplied dialog titles and file
  type filter labels come from localized catalog/display metadata, while OS
  chrome remains outside app control.
- Job and quick-progress tests verify elapsed time, remaining time, and speed
  labels update through the formatting/display context across locale switches.
- Command metadata tests verify shortcuts and `aria-keyshortcuts` remain stable
  across locale switches while labels and tooltips localize around them.
- View tests verify representative UI text is rendered through the translator.
- Static DOM translation tests verify `textContent` updates do not remove icon
  markup and that `aria-label`, `title`, and `placeholder` attributes translate.
- Mixed-content label tests verify translating checkbox and form labels does
  not remove or replace their child controls.
- HTML-rendering view tests verify translated text and interpolated values are
  escaped when inserted into string-built markup.
- A display-string audit test should flag remaining user-visible English string
  literals in `src/main.ts`, `src/ui/*`, and display-producing `src/app/*`.
  Keep an explicit allowlist for machine constants, file type names, byte units,
  test fixtures, brand names, command/error codes, and layout numbers.
- Playwright smoke tests cover at least the Preferences dialog and one archive
  workflow after a locale switch.
- zh-CN visual smoke checks should flag missing glyph boxes and severe fallback
  rendering issues, but font bundling remains a follow-up decision rather than
  a phase 2 requirement.

## Acceptance Criteria

- English GUI text lives in `messages.en.ts` or a small number of clearly named
  catalog files, not scattered through `src/main.ts`, `src/ui`, or
  display-producing `src/app` modules.
- Internal state and command contracts continue to use stable, untranslated
  values.
- The app can switch between `System default`, `English`, and any advertised
  non-English locale without restarting once that locale is complete for the
  release's user-visible migrated surfaces, unless a future platform-specific
  string requires restart.
- Adding a new language does not require changing archive logic, Tauri commands,
  or main view flow.
- The app relies on bundled catalogs and the system font stack; bundled fonts
  are deferred until target-system QA proves they are necessary.
- Missing translations fall back predictably and are caught by tests before
  release.
