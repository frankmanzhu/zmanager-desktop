# ADR-0004: Own the canonical macOS product and distribution here

- Status: Accepted
- Date: 2026-07-16
- Supersedes: the separate-macOS-product consequence in ADR-0003

## Context

The native product shipped as `ZManager.app` with identifier
`org.tzap-org.zmanager`. A differently named application with the same
identifier leaves duplicate Launch Services registrations. The Desktop Shell
must replace that product without downgrading version or splitting ownership.

## Decision

This repository owns the macOS product, Native Host, Extension Suite,
Replacement Migration, and Release Bundle. Identity values are frozen in
`docs/migration/macos-identity-decision.json`: Team `9PMA523YY4`, App Group
`group.org.tzap-org.zmanager`, macOS 14, separate arm64/x86_64 artifacts,
unsandboxed hardened main app, sandboxed extensions, and direct Developer ID
distribution. `package.json` is the product version source. Application GUI is
React; Swift/AppKit is limited to operating-system-mandated surfaces.

## Consequences

The former SwiftUI repository becomes evidence and is frozen after cutover.
Only one macOS packager and publication path may remain. Protected release jobs
must verify Apple registrations and credentials rather than trusting local
development signing.

## Verification

Ledger, version, bundle-layout, signing, notarization, installed upgrade, and
single-owner Launch Services gates enforce the decision.
