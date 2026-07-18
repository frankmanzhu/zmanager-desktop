# Replacement migration rollback procedure

This procedure applies to replacement migration schema `1`. The migration
deliberately retains the old application, its `UserDefaults` domain, and its
`~/Library/Application Support/ZManager/tzap-state` directory during the
initial successful migration window.

## Roll back to the last native application

1. Quit every ZManager process and preserve
   `~/Library/Application Support/com.frankmanzhu.zmanager/` for diagnosis.
2. Reinstall the recorded last-native Release Bundle at its original
   `/Applications/ZManager.app` path. Do not copy identity JSON by hand.
3. Register that exact app path with Launch Services and `pluginkit`. Because
   old and replacement bundles intentionally share identifiers, register the
   selected rollback app last and verify every resolved extension path rather
   than trying to distinguish them by identifier.
4. Launch the native app. It reads its retained preference domain and retained
   `Application Support/ZManager/tzap-state` directory; replacement
   `localStorage` and the replacement identity copy are not its inputs.
5. Verify the URL scheme, TZAP association, Finder extension, Quick Look
   extensions, Spotlight importer, and default opener on the rollback build.

The replacement migration record is
`~/Library/Application Support/com.frankmanzhu.zmanager/replacement-migration-v1.json`.
It is owner-only, contains the backed-up compatible preference values,
default-opener restore mapping, pre-migration registration owners, exact legacy
paths, step markers, and normalized key/code diagnostics. It contains no auth
tokens or diagnostic values.

## Roll back migrated replacement preferences only

The frontend records exactly which typed keys it created. A rollback may remove
one of those keys only when its current value still equals the migrated value.
If the user changed it after migration, the newer value wins and must remain.
The tested `rollbackReplacementPreferences` policy implements this comparison.

## Non-reversible and non-merged state

- Stale `zmanager-preview-*` roots are temporary extracted material and are
  deleted; their contents are not backed up and cannot be restored.
- The identity inventory is decoded and re-saved by `zmanager-core`; raw secret
  files are never copied. The legacy inventory remains intact. Identity,
  contact, or trust changes made after cutover are not automatically merged
  back into the legacy store because a two-way secret merge would be unsafe.
- Pending hosted-auth relay state is not migrated because its client/session
  lifetime is not reusable. Start authentication again after rollback.
- Launch Services and extension registration are mutable system caches. They
  are restored by registering and verifying the selected app, not by restoring
  cache files.

Rollback acceptance must use a snapshot or clean account and must record the
resolved application and extension paths. A bundle-identifier-only check is
insufficient because both generations deliberately use the replacement
identity.
