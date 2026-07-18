# Phase 9 — Finder and Services request transport

- Completed: 2026-07-18
- Source revision: `2a897c408ce82bdf1d7b86a8a1b80967ea039f7b` plus the recorded working-tree migration
- Result: PASS; interactive Finder selection smoke remains in the Phase 13 matrix

## Finder and Services implementation

The repository now owns a Finder Sync extension with the frozen identifier
`com.frankmanzhu.zmanager.finder-extension`. Its action visibility, ordering,
multiplicity, identifiers, and display keys come from the canonical shell-action
and archive-type manifests. Native strings provide English and Simplified
Chinese labels. The extension contains no archive semantics.

Single-folder, files, folders, mixed, single-archive, and multiple-archive menu
fixtures are tested. The port found and corrected two manifest contradictions:
`open` and `extractToFolder` are exactly-one actions, matching the shared
quick-action validator.

Host-process Services use the same typed `ShellActionRequest` payload directly.
Finder uses a secure App Group transport and opens only
`zmanager://shell-request/<opaque-token>`.

## Security boundary

- tokens contain 192 random bits and use a bounded base64url grammar;
- request files are exclusive-created, mode `0600`, fsynced, and atomically
  renamed inside a mode `0700` request directory;
- host consumption uses `lstat`, `O_NOFOLLOW`, and a second `fstat` identity
  check;
- regular-file type, single link, effective owner, exact mode, size, UTF-8,
  contract version, timestamp/TTL, and local paths are validated;
- valid-token files are deleted after success and every terminal validation
  failure; replay therefore fails;
- callback-open failure discards the unconsumed request; and
- expired cleanup is bounded.

The Swift consume operation returns bytes to Rust, which parses the shared Rust
contract and reuses the existing quick-action validator. The frontend then feeds
the request into the injected quick-action controller. The previous uninitialized
token handler was deleted.

## Automated proof

- `swift test --package-path native/macos`: 19 passed at phase completion.
- Security fixtures cover invalid/traversal-shaped tokens, symlink, wrong mode,
  stale and future timestamps, oversize, replay, exclusive creation, bounded
  cleanup, failed callback cleanup, compound/split archive classification,
  selection shapes, and one versioned request for multi-selection.
- Native C-interface tests prove one successful consume and replay rejection.
- Rust quick-action tests prove contract/version/size/path validation.
- TypeScript command-contract, Native Launch Inbox controller, and capability
  suites prove the token command is authorized and routed once.

## Package and installed proof

The unified build embeds a real arm64 Mach-O Finder extension, its plist,
localized resources, and sandbox/App Group/read-only-user-selection entitlements
before inside-out signing. The main app declares its `zmanager` URL scheme and
Services entries.

Parallels snapshot `{07f29b1d-4130-4ae9-aa41-fdc4ad4b7e3e}` contains the
installed ad-hoc app. `pluginkit` reports the exact installed extension as
enabled (`+`), strict deep signature verification passes, the Native Host
self-test passes, and the main React window is visible. Because Parallels CLI
does not inject mouse selection into the Aqua Finder session, the real Finder
context-menu click matrix is explicitly retained for Phase 13 rather than being
claimed from the menu-builder test alone.
