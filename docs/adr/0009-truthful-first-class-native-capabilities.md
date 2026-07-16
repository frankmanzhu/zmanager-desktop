# ADR-0009: First-class native capabilities fail closed and report truthfully

- Status: Accepted
- Date: 2026-07-16
- Extends: ADR-0001

## Context

A complete trait implementation can still mislead callers if an enabled feature
always returns a placeholder, empty icon, or success without installed support.

## Decision

Build support, package inclusion/verification, and installed/user state are
separate records. A first-class capability may be enabled only when its real
implementation is present. Missing or failed enabled behavior returns a
normalized unavailable/error state; unconditional observable fallbacks are
allowed only for explicitly optional presentation data and must not masquerade
as feature success.

## Consequences

Frontend behavior derives from capability records, never browser metadata.
Finder may be packaged but disabled by the user without making the source
profile false.

## Verification

Architecture checks reject enabled stubs; contract, package, and installed tests
exercise the three state layers and failure mapping.
