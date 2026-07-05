# Display Localization And Translation Isolation Plan

## Goal

ZManager Desktop should be able to replace the GUI language by changing a
locale preference and providing one translated message catalog per supported
language. The first implementation can remain English-only, but English display
text should be extracted out of the UI so future translation work does not
require editing the main application flow.

The archive engine, Tauri command DTOs, job registry, and persisted preference
values must stay language-neutral. Translation belongs at the display boundary.

## Current State

- `src/main.ts` contains most static application markup and many hard-coded
  English labels.
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

Future languages should add sibling catalog files:

```text
src/app/i18n/messages.zh-CN.ts
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
  "preferences.title": "Preferences",
  "preferences.language.title": "Language",
  "preferences.language.systemDefault": "System default",
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

Extend `AppPreferences` with:

```ts
locale: "system" | "en" | "zh-CN";
```

Persist it with a dedicated key:

```ts
zmanager.locale
```

Resolution rules:

1. If the preference is `"system"`, choose the best supported match from
   `navigator.languages`.
2. If the selected locale is supported, use it.
3. If no match is supported, fall back to English.

The stored value should remain `"system"` when the user chooses System default,
even if the resolved runtime locale is currently English.

## Rendering Strategy

Use two rendering patterns.

For static markup owned by `src/main.ts`, add message keys to the DOM:

```html
<h3 data-i18n="preferences.language.title"></h3>
<button data-i18n="common.save" type="button"></button>
```

Then apply translations at startup and after locale changes:

```ts
applyTranslations(document.body, i18n);
```

For dynamic view helpers, pass the translator explicitly:

```ts
renderPreferencesDialog(elements, preferences, i18n);
renderJobsDrawer(elements, jobs, i18n);
```

Avoid importing global translation state inside low-level helpers. Passing an
`i18n` object keeps tests simple and makes display dependencies visible.

## Formatting Strategy

Text translation and data formatting should share the same resolved locale.

- Dates: use `Intl.DateTimeFormat(resolvedLocale, ...)`.
- Counts and percentages: use `Intl.NumberFormat(resolvedLocale, ...)`.
- Byte units can remain binary units, but numeric formatting should follow the
  active locale.
- Empty placeholders such as `-` should come from the display layer so future
  locales can change them if needed.

`src/app/formatting.ts` should accept a resolved locale or a small formatting
context instead of relying on browser defaults.

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

Passwords must never be included in translated messages, diagnostics, persisted
state, or interpolation parameters.

## Migration Phases

### Phase 1: English Catalog Foundation

- Add `src/app/i18n/*`.
- Add locale preference loading/saving with `"system"` as the default.
- Enable the Language selector with `System default` and `English`.
- Add fallback behavior and key coverage tests.
- Keep the visible app English-only.

### Phase 2: Extract Static Shell Text

- Move static labels from `src/main.ts` into `messages.en.ts`.
- Use `data-i18n` attributes for static DOM text.
- Include buttons, tabs, toolbar labels, dialog titles, dialog actions, and
  Preferences labels.

### Phase 3: Extract View Helper Text

- Update `src/ui/preferencesView.ts`, `src/ui/jobsView.ts`, and other rendering
  helpers to receive an `i18n` object.
- Replace status strings, empty states, and option labels with message keys.
- Add unit tests for rendered English output through the translator.

### Phase 4: Extract Dynamic Workflow Messages

- Move archive open/create/extract/test status messages into the catalog.
- Translate normalized frontend error messages from error codes.
- Add interpolation support for file names, counts, byte values, and job
  summaries.

### Phase 5: Add First Non-English Locale

- Add one complete translated catalog.
- Add key parity tests that fail when any locale is missing a key from English.
- Run visual smoke checks for text overflow in Preferences, Jobs, dialogs, and
  archive table headers.

## Testing Requirements

- `translator.test.ts` verifies lookup, fallback, interpolation, and missing-key
  behavior.
- Preference tests verify locale load/save and invalid-locale fallback.
- Catalog parity tests verify every supported locale has the same keys as
  English.
- View tests verify representative UI text is rendered through the translator.
- Playwright smoke tests cover at least the Preferences dialog and one archive
  workflow after a locale switch.

## Acceptance Criteria

- English GUI text lives in `messages.en.ts` or a small number of clearly named
  catalog files, not scattered through `src/main.ts` and `src/ui`.
- Internal state and command contracts continue to use stable, untranslated
  values.
- The app can switch between `System default` and `English` without restarting,
  unless a future platform-specific string requires restart.
- Adding a new language does not require changing archive logic, Tauri commands,
  or main view flow.
- Missing translations fall back predictably and are caught by tests before
  release.
