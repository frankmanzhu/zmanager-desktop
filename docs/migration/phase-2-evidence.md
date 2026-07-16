# macOS replacement migration Phase 2 evidence

- Phase: 2 — governing documentation and ADRs
- Completion date: 2026-07-16 (Australia/Sydney)
- Result: **PASS**

## Governing policy

`AGENTS.md`, `CONTEXT.md`, architecture, requirements, roadmap, developer setup,
and release hardening now make Windows, Linux, and macOS first-class targets of
one product. Historical documents with separate-product constraints are marked
as superseded rather than silently rewritten. The glossary defines macOS Native
Host, macOS Extension Suite, Native Launch Inbox, Native Drag Session, Public
Metadata FFI, Release Bundle, and Replacement Migration.

## Accepted decisions

- ADR-0004 freezes full-target ownership, canonical identity, and distribution;
  it explicitly supersedes ADR-0003's separate-product consequence.
- ADR-0005 defines Native Host and Launch Inbox ordering, acknowledgement,
  replay, bounds, readiness, and shutdown.
- ADR-0006 extends ADR-0002 with atomic App Group files and opaque tokens for
  Finder/Services transport.
- ADR-0007 bounds Public Metadata FFI and exact core revision pinning.
- ADR-0008 supersedes eager macOS staging with asynchronous file promises after
  installed parity passes.
- ADR-0009 extends ADR-0001 so enabled first-class capabilities report real
  availability instead of unconditional observable fallbacks.

## Enforced architecture

`scripts/check-macos-full-target-architecture.mjs` rejects:

- `navigator.userAgent`, `navigator.platform`, and `navigator.userAgentData` OS selection;
- imperative HTML, CSS modules, new raw CSS, unallowlisted inline styles, and
  unallowlisted standalone DOM event wiring;
- macOS Swift/Objective-C source outside `native/macos`;
- active governing language that assigns macOS to a separate product.

The exact legacy allowlist is
`docs/migration/frontend-legacy-gui-allowlist.json`. It contains no wildcard
paths. Each file is content-addressed; changing it requires every recorded
violation category to shrink. `src/styles.tailwind.css` is the only named
Tailwind entrypoint and `src/styles.css` is the one content-addressed legacy CSS
surface.

Fixture tests prove OS detection, imperative GUI/inline styling/DOM wiring, and
non-shrinking allowlist changes fail closed.

## Proof

```text
npm run test:architecture
  PASS — 5 Node architecture fixtures plus native, ledger, version, and ast-grep checks
```

## Exit decision

**PASS.** Governing policy, domain language, decisions, and executable
architecture checks consistently permit and constrain the full macOS target;
no active policy assigns required implementation to the former product.
