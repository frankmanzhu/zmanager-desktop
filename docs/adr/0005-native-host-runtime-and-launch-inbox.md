# ADR-0005: Join native lifecycle through an acknowledged launch inbox

- Status: Accepted
- Date: 2026-07-16

## Context

macOS can deliver document, URL, Services, and reopen callbacks before Tauri or
the frontend is ready, while the single-instance path can deliver concurrently.

## Decision

The Swift Native Host Runtime registers callbacks early and sends only bounded,
versioned C-compatible event envelopes into the Rust Native Launch Inbox. The
inbox assigns or validates unique IDs, preserves accepted order, deduplicates by
ID/idempotency key, rejects unknown versions and secret-bearing/oversized data,
and buffers to a fixed limit. A window explicitly declares readiness, drains
pending events, and acknowledges each completed event. Unacknowledged events
may replay within a bounded window. Shutdown stops ingestion, detaches emitters
and observers, clears secret-free queued data, and makes late callbacks fail
closed. No AppKit object crosses the seam.

## Consequences

Cold and warm paths share one ordering contract. “Native Intent” is an envelope,
not a second command language; payloads reuse OpenPaths, ShellActionRequest,
HostedAuthCallback, and ReopenApplication.

## Verification

Rust model tests cover ordering, readiness races, acknowledgement, replay,
deduplication, overflow, versions, concurrent producers, and shutdown. Swift
tests cover observer lifecycle and callback error reporting.
