# ADR-0007: Give extensions a metadata-only pinned core ABI

- Status: Accepted
- Date: 2026-07-16

## Context

Quick Look and Spotlight need public TZAP metadata in sandboxed/system hosts but
must not load the general archive/account FFI or inherit Homebrew dependencies.

## Decision

`zmanager-public-metadata-ffi` is a separate crate with a small C ABI for bounded
public metadata parsing and result freeing. It exposes no jobs, extraction,
creation, account state, identity/private keys, mutations, arbitrary paths, or
network access. Input, allocation, record, string, and time limits are explicit.
The desktop, shell contract, and metadata FFI pin one exact core revision.
Extensions link it statically unless a packaged linkage ADR later proves a
dynamic library safer.

## Consequences

Metadata consumers share one parser and fixture corpus without acquiring
general product authority. ABI version changes require generated headers and
cross-language contract updates.

## Verification

Rust/Swift/Objective-C fixture, malformed-input, limit, ABI, symbol, dependency,
and package-linkage tests run in required gates.
